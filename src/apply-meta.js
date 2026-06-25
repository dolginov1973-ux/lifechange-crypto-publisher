// One-off: apply v2 Title + Description (Bio) to every channel via the Bot API.
// Run in the cloud (GitHub Actions) where api.telegram.org is reachable. Requires the bot to
// be an admin WITH the "Change channel info" (can_change_info) right in each target channel.
//
//   node src/apply-meta.js            # apply for real (needs TELEGRAM_BOT_TOKEN)
//   DRY_RUN=1 node src/apply-meta.js  # print the plan + length guards only, no API calls
//
// Per-channel outcomes are reported and NEVER abort the whole run:
//   OK          — title/description set
//   UNCHANGED   — already equal (Telegram "...is not modified")
//   NEEDS-RIGHT — bot lacks can_change_info in that channel (grant it, re-run)
//   NOT-FOUND   — channel/@username doesn't exist yet (e.g. id not created)
//   FAIL        — anything else (description printed)

import { CHANNELS } from './config.js';
import { CHANNEL_META } from './channel-meta.js';

const API = 'https://api.telegram.org';
const TITLE_MAX = 128; // Telegram setChatTitle limit
const DESC_MAX = 255; // Telegram setChatDescription limit

const DRY = !!process.env.DRY_RUN;
const token = process.env.TELEGRAM_BOT_TOKEN;

if (!DRY && !token) {
  console.error('TELEGRAM_BOT_TOKEN is required (or set DRY_RUN=1 to preview).');
  process.exit(1);
}

const len = (s) => [...s].length; // count code points (emoji-safe), matches Telegram limits

async function call(method, params) {
  const res = await fetch(`${API}/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = await res.json().catch(() => ({}));
  return { httpOk: res.ok, status: res.status, ...data };
}

// PROBE mode (PROBE=1): read-only diagnostics. For each channel, can the bot resolve it
// (getChat works for PUBLIC usernames even without membership) and is the bot an admin with
// the rights we need? Distinguishes "channel doesn't exist" from "bot not admin / lacks right".
async function probe() {
  const me = await call('getMe', {});
  const botId = me.result?.id;
  console.log(`\nPROBE — bot @${me.result?.username || '?'} (id ${botId ?? '?'}) · token ok: ${!!me.ok}\n`);
  for (const [key, ch] of Object.entries(CHANNELS)) {
    const c = await call('getChat', { chat_id: ch.chatId });
    if (!c.ok) {
      console.log(`  ${key.padEnd(3)} ${String(ch.chatId).padEnd(26)} NOT-FOUND   (${c.description || c.status})`);
      continue;
    }
    const chat = c.result;
    let bot = 'bot-member: ?';
    if (botId) {
      const m = await call('getChatMember', { chat_id: ch.chatId, user_id: botId });
      bot = m.ok
        ? `bot=${m.result.status} change_info=${m.result.can_change_info ?? '-'} post=${m.result.can_post_messages ?? '-'} invite=${m.result.can_invite_users ?? '-'}`
        : `bot-member: ${m.description || m.status}`;
    }
    console.log(`  ${key.padEnd(3)} ${String(ch.chatId).padEnd(26)} EXISTS id=${chat.id} type=${chat.type} title="${chat.title || ''}" | ${bot}`);
  }
  console.log('');
}

if (process.env.PROBE) {
  await probe();
  process.exit(0);
}

function classify(desc = '') {
  const d = desc.toLowerCase();
  if (d.includes('not modified')) return 'UNCHANGED';
  if (d.includes('chat not found') || d.includes('not found')) return 'NOT-FOUND';
  if (d.includes('not enough rights') || d.includes('chat_admin_required') || d.includes('admin'))
    return 'NEEDS-RIGHT';
  return 'FAIL';
}

async function applyOne(method, chatId, field, value) {
  if (DRY) return { state: 'DRY', note: `${field}=${len(value)}c` };
  const r = await call(method, { chat_id: chatId, [field]: value });
  if (r.ok) return { state: 'OK' };
  return { state: classify(r.description), note: r.description || `HTTP ${r.status}` };
}

let hardFail = 0;
let needsRight = 0;
const rows = [];

for (const [key, ch] of Object.entries(CHANNELS)) {
  const meta = CHANNEL_META[key];
  if (!meta) {
    rows.push([key, ch.chatId, 'NO-META', '—']);
    continue;
  }
  if (len(meta.title) > TITLE_MAX) {
    rows.push([key, ch.chatId, 'FAIL', `title ${len(meta.title)}>${TITLE_MAX}`]);
    hardFail++;
    continue;
  }
  if (len(meta.description) > DESC_MAX) {
    rows.push([key, ch.chatId, 'FAIL', `desc ${len(meta.description)}>${DESC_MAX}`]);
    hardFail++;
    continue;
  }

  const t = await applyOne('setChatTitle', ch.chatId, 'title', meta.title);
  const d = await applyOne('setChatDescription', ch.chatId, 'description', meta.description);

  const states = [t.state, d.state];
  let status = 'OK';
  if (states.includes('FAIL')) status = 'FAIL';
  else if (states.includes('NEEDS-RIGHT')) status = 'NEEDS-RIGHT';
  else if (states.includes('NOT-FOUND')) status = 'NOT-FOUND';
  else if (states.every((s) => s === 'UNCHANGED')) status = 'UNCHANGED';
  else if (states.includes('DRY')) status = 'DRY';

  if (status === 'FAIL') hardFail++;
  if (status === 'NEEDS-RIGHT') needsRight++;

  const note = [t.note && `t:${t.note}`, d.note && `d:${d.note}`].filter(Boolean).join(' | ');
  rows.push([key, ch.chatId, status, note || '✓ title+desc']);
}

console.log(`\nApply Channel Meta — ${DRY ? 'DRY RUN (no API calls)' : 'LIVE'}\n`);
for (const [k, id, st, note] of rows) {
  console.log(`  ${st.padEnd(11)} ${k.padEnd(3)} ${String(id).padEnd(26)} ${note}`);
}
console.log(`\nDone. ${rows.length} channels · hardFail=${hardFail} · needsRight=${needsRight}`);
if (needsRight) {
  console.log('→ Grant the bot the "Change channel info" right in the flagged channels, then re-run.');
}
process.exit(0);
