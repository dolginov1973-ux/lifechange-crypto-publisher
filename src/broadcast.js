// One-off MANUAL broadcast — send ONE photo+caption to every channel RIGHT NOW,
// bypassing the schedule grid but KEEPING the full compliance gate + disclaimer
// injection. The scheduler (publish.js) only fires inside slot windows; this is the
// "post this signal/result to all channels now" tool. The photo is uploaded from the
// repo (assets/...), exactly like the P&L photo posts.
//
// Usage:  BROADCAST_ID=<id> node src/broadcast.js [--dry-run]
//   Reads content/_broadcast/<BROADCAST_ID>/<channelKey>.json for each CHANNELS key
//   that has a file. Each file:
//     { "target":"en", "lang":"en", "cta":true, "image":"assets/signals/x.png", "body":"…" }
//   Real send happens ONLY when LIVE=true AND no --dry-run (same gate as publish.js).

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import { CHANNELS } from './config.js';
import { render } from './render.js';
import { checkText } from './compliance.js';
import { sendPhoto, sendMessage, validateCaptionLength } from './telegram.js';
import { resolveImagePath, REPO_ROOT } from './posts.js';

const LIVE = /^(1|true|yes|on)$/i.test(String(process.env.LIVE || '').trim());
const DRY = process.argv.includes('--dry-run') || process.env.DRY_RUN === '1' || !LIVE;
const BID = (process.env.BROADCAST_ID || '').trim();

function log(...a) {
  console.log('[broadcast]', ...a);
}

async function main() {
  if (!BID) {
    console.error('[broadcast] FATAL: BROADCAST_ID not set.');
    process.exit(1);
  }
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const communityLink = process.env.COMMUNITY_LINK || '';
  if (!token && !DRY) {
    console.error('[broadcast] FATAL: TELEGRAM_BOT_TOKEN not set.');
    process.exit(1);
  }
  if (!LIVE) log('LIVE gate OFF → DRY mode: decisions logged, NOTHING sent.');

  const dir = join(REPO_ROOT, 'content', '_broadcast', BID);
  if (!existsSync(dir)) {
    console.error(`[broadcast] FATAL: ${dir} not found.`);
    process.exit(1);
  }

  let sent = 0;
  let blocked = 0;
  for (const ch of Object.values(CHANNELS)) {
    const file = join(dir, `${ch.key}.json`);
    if (!existsSync(file)) {
      log(`${ch.key}: no file in broadcast set — skip.`);
      continue;
    }
    const post = JSON.parse(readFileSync(file, 'utf8'));

    // Render (community link + disclaimer injection) — identical to the scheduler.
    const text = render(post, { channel: ch, communityLink });

    // HARD compliance gate — same as publish.js, no relaxation for broadcasts.
    const gate = checkText(text, { lang: post.lang || ch.key });
    if (!gate.ok) {
      console.warn(
        `[broadcast] ⛔ BLOCKED ${ch.key}: ` +
          gate.violations.map((v) => `${v.code}: ${v.detail}`).join(' | '),
      );
      blocked++;
      continue;
    }

    const isPhoto = typeof post.image === 'string' && post.image.trim() !== '';
    let imageAbs = null;
    if (isPhoto) {
      const img = resolveImagePath(post.image);
      if (!img.exists) {
        console.warn(`[broadcast] ⛔ BLOCKED ${ch.key}: image not found ("${post.image}").`);
        blocked++;
        continue;
      }
      imageAbs = img.abs;
      const cap = validateCaptionLength(text);
      if (!cap.ok) {
        console.warn(
          `[broadcast] ⛔ BLOCKED ${ch.key}: caption ${cap.length} > ${cap.max} chars.`,
        );
        blocked++;
        continue;
      }
    }

    if (DRY) {
      log(
        `DRY → ${ch.chatId} ` +
          (isPhoto ? `photo "${post.image}" caption=${text.length} chars` : `text=${text.length} chars`),
      );
      continue;
    }

    try {
      const r = isPhoto
        ? await sendPhoto({ token, chatId: ch.chatId, absImagePath: imageAbs, caption: text })
        : await sendMessage({ token, chatId: ch.chatId, text });
      sent++;
      log(`✅ SENT ${ch.chatId} msg=${r && r.message_id}`);
    } catch (e) {
      console.error(`[broadcast] SEND ERROR ${ch.key}: ${e.message}`);
    }
  }

  log(`done. sent=${sent} blocked=${blocked} dry=${DRY}`);
}

main().catch((e) => {
  console.error('[broadcast] UNCAUGHT:', e);
  process.exit(1);
});
