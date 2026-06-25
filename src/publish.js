// Main scheduler entrypoint. Run every 30 min by GitHub Actions cron.
// Decides, per channel, whether a post is due RIGHT NOW (schedule grid × local time),
// enforces quiet-hours / daily cap / CTA rules, runs the HARD compliance gate, sends,
// and records the send in the state log (committed back by the Action for idempotency).
//
// Exit code is always 0 on normal operation (skips are not errors). Non-zero only on
// unexpected runtime faults so the Action surfaces them.
//
// Flags:
//   --dry-run   resolve + gate but DO NOT send and DO NOT write state. Prints decisions.

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CHANNELS, RULES, RUBRICS } from './config.js';
import { now, localParts, inQuietHours, inSlotWindow } from './time.js';
import { loadPostsForChannel, pickPost, resolveImagePath } from './posts.js';
import { render } from './render.js';
import { checkText } from './compliance.js';
import { sendMessage, sendPhoto, validateCaptionLength } from './telegram.js';
import {
  loadState,
  saveState,
  postedIds,
  postsOnDay,
  lastPost,
  recordPost,
} from './state.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCHEDULE_PATH = join(__dirname, '..', 'schedule.json');

// --- LIVE GATE (default OFF) -------------------------------------------------
// The publisher only sends for real when LIVE is explicitly turned on. Anything
// else (unset / "false" / "0" / "no") forces DRY mode: decisions are logged, the
// gate runs, but NO Telegram send happens and NO state is written. This is the
// hard "don't go live until I flip it" guarantee — the cron can be enabled and it
// will still send nothing until LIVE=true is set.
const LIVE = /^(1|true|yes|on)$/i.test(String(process.env.LIVE || '').trim());

// Explicit dry-run flag (CLI or DRY_RUN env) OR the live gate being off both force
// dry mode. So: real send happens ONLY when LIVE=true AND no dry-run flag is set.
const DRY_RUN =
  process.argv.includes('--dry-run') || process.env.DRY_RUN === '1' || !LIVE;

function log(...args) {
  console.log('[publish]', ...args);
}

// Seed-week P&L drip: for a configured set of channel-local dates, inject an extra
// pnl slot for that day so the 5 seed P&L posts go out ~1/day the first week instead
// of 1/week on the normal Friday slot. Returns the dueRubrics array with the seed
// pnl entry appended when (a) the seed block is enabled, (b) today's local dateKey is
// in the list, and (c) the same (slot) pnl entry isn't already present from the grid.
function applySeedPnl(schedule, dueRubrics, dateKey) {
  const seed = schedule.seedPnl;
  if (!seed || seed.enabled !== true || !Array.isArray(seed.dates)) return dueRubrics;
  if (!seed.dates.includes(dateKey)) return dueRubrics;
  const slot = seed.slot || 'B';
  const already = dueRubrics.some((e) => e.rubric === 'pnl' && e.slot === slot);
  if (already) return dueRubrics; // weekly grid already fires pnl in this slot today
  return [...dueRubrics, { slot, rubric: 'pnl', cta: false, _seed: true }];
}

async function main() {
  const schedule = JSON.parse(readFileSync(SCHEDULE_PATH, 'utf8'));
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const communityLink = process.env.COMMUNITY_LINK || '';
  const current = now();

  if (!token && !DRY_RUN) {
    console.error('[publish] FATAL: TELEGRAM_BOT_TOKEN not set.');
    process.exit(1);
  }

  if (!LIVE) {
    log(
      'LIVE gate is OFF (env LIVE not set to true) — running in DRY mode: ' +
        'decisions are logged, NOTHING is sent, no state is written. ' +
        'Set repo variable/secret LIVE=true to go live.',
    );
  }

  const state = loadState();
  const sentThisRun = [];

  for (const channel of Object.values(CHANNELS)) {
    const lp = localParts(current, channel.tz);
    // Grid entries due in their slot window right now...
    let dueRubrics = (schedule.grid[lp.weekday] || []).filter((entry) =>
      inSlotWindow(lp.minutesOfDay, RULES.slots[entry.slot]),
    );
    // ...plus any first-week P&L seed slot for today (deduped vs the grid).
    dueRubrics = applySeedPnl(schedule, dueRubrics, lp.dateKey).filter((entry) =>
      inSlotWindow(lp.minutesOfDay, RULES.slots[entry.slot]),
    );

    if (dueRubrics.length === 0) {
      log(`${channel.key}: nothing due (local ${lp.weekday} ${lp.hour}:${String(lp.minute).padStart(2, '0')} ${channel.tz}).`);
      continue;
    }

    // --- Quiet hours hard block (item 8) ---
    if (inQuietHours(lp.hour, RULES.quietHoursStart, RULES.quietHoursEnd)) {
      log(`${channel.key}: SKIP — quiet hours (${lp.hour}:00 local).`);
      continue;
    }

    const posts = loadPostsForChannel(channel.key);
    const alreadyPostedIds = postedIds(state);

    for (const entry of dueRubrics) {
      const rubric = entry.rubric;
      const rubricMeta = RUBRICS[rubric];
      const tag = rubricMeta ? rubricMeta.tag : rubric;

      // --- Daily cap (item 8) ---
      const todays = postsOnDay(state, channel.key, lp.dateKey);
      if (todays.length >= RULES.maxPostsPerChannelPerDay) {
        log(`${channel.key} ${rubric}: SKIP — daily cap reached (${todays.length}/${RULES.maxPostsPerChannelPerDay}).`);
        continue;
      }

      // --- Idempotency: was THIS slot already filled today? ---
      const slotFilled = todays.some((p) => p.slot === entry.slot);
      if (slotFilled) {
        log(`${channel.key} ${rubric}: SKIP — slot ${entry.slot} already posted today.`);
        continue;
      }

      // --- Pick a ready post ---
      const post = pickPost({ posts, rubric, slot: entry.slot, alreadyPostedIds });
      if (!post) {
        log(`${channel.key} ${rubric} (slot ${entry.slot}): SKIP — no ready post available.`);
        continue;
      }

      // --- CTA cadence (item 7): ≤1 CTA/day, never two consecutive ---
      const isCta = post.cta === true;
      if (isCta) {
        const ctaToday = todays.filter((p) => p.cta).length;
        if (ctaToday >= RULES.maxCtaPerChannelPerDay) {
          log(`${channel.key} ${rubric}: SKIP — CTA cap reached today.`);
          continue;
        }
        if (RULES.noConsecutiveCta) {
          const prev = lastPost(state, channel.key);
          if (prev && prev.cta) {
            log(`${channel.key} ${rubric}: SKIP — would be two CTA posts in a row.`);
            continue;
          }
        }
      }

      // --- Render (community link + disclaimer injection) ---
      const text = render(post, { channel, communityLink });

      // --- HARD compliance gate (items 1/2/3) on FINAL text ---
      // For photo posts the rendered `text` IS the Telegram caption — it goes through the
      // EXACT SAME gate (banned terms, unfilled [..], Bitunix, injected disclaimer). The
      // presence of an image never relaxes the gate.
      const gate = checkText(text, { lang: post.lang || channel.key });
      if (!gate.ok) {
        console.warn(
          `[publish] ⛔ BLOCKED ${channel.key}/${post.id}: ` +
            gate.violations.map((v) => `${v.code}: ${v.detail}`).join(' | '),
        );
        continue; // block, do not send
      }

      // --- Photo-post resolution (P&L #RealResults / Teardown) ---
      const isPhoto = typeof post.image === 'string' && post.image.trim() !== '';
      let imageAbs = null;
      if (isPhoto) {
        const img = resolveImagePath(post.image);
        if (!img.exists) {
          console.warn(
            `[publish] ⛔ BLOCKED ${channel.key}/${post.id}: image not found / invalid ` +
              `("${post.image}"${img.error ? `: ${img.error}` : ''}). Photo posts need the screenshot committed.`,
          );
          continue; // block, do not send a photo post with a missing image
        }
        imageAbs = img.abs;
        // Caption length is a HARD Telegram limit (~1024). Block over-limit captions.
        const cap = validateCaptionLength(text, RULES.captionMaxLength);
        if (!cap.ok) {
          console.warn(
            `[publish] ⛔ BLOCKED ${channel.key}/${post.id}: caption ${cap.length} > ${cap.max} chars (Telegram limit). Trim the body.`,
          );
          continue;
        }
      }

      // --- Send (or dry-run) ---
      if (DRY_RUN) {
        log(
          `DRY-RUN would send → ${channel.chatId} [${tag}] id=${post.id} ` +
            (isPhoto
              ? `sendPhoto image="${post.image}" caption=${text.length} chars`
              : `sendMessage (${text.length} chars)`),
        );
        continue;
      }

      let result;
      try {
        result = isPhoto
          ? await sendPhoto({ token, chatId: channel.chatId, absImagePath: imageAbs, caption: text })
          : await sendMessage({ token, chatId: channel.chatId, text });
      } catch (err) {
        console.error(`[publish] SEND ERROR ${channel.key}/${post.id}: ${err.message}`);
        continue; // do not record; next run can retry
      }

      const record = {
        id: post.id,
        channel: channel.key,
        rubric,
        slot: entry.slot,
        cta: isCta,
        photo: isPhoto, // audit flag; cap/idempotency treat photo posts identically
        dateKey: lp.dateKey,
        ts: current.toISOString(),
        messageId: result && result.message_id,
      };
      recordPost(state, record);
      sentThisRun.push(record);
      log(
        `✅ SENT ${channel.chatId} [${tag}] id=${post.id} ` +
          `${isPhoto ? 'photo' : 'text'} msg=${record.messageId}`,
      );
    }
  }

  if (!DRY_RUN && sentThisRun.length > 0) {
    saveState(state);
    log(`state updated: +${sentThisRun.length} post(s).`);
  } else {
    log(DRY_RUN ? 'dry-run complete (no state written).' : 'nothing sent (state unchanged).');
  }

  // Signal to the workflow whether to commit (env file for GH Actions step).
  if (process.env.GITHUB_OUTPUT) {
    const { appendFileSync } = await import('node:fs');
    appendFileSync(process.env.GITHUB_OUTPUT, `sent=${sentThisRun.length}\n`);
  }
}

main().catch((err) => {
  console.error('[publish] UNCAUGHT:', err);
  process.exit(1);
});
