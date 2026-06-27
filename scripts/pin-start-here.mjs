// Publish the "Start here" welcome to each PUBLIC channel and PIN it, so the channel
// (the TG-Ads destination) opens on a clear value prop + a bot CTA carrying a per-channel
// attribution tag (?start=ch_<lang>). Same compliance gate + disclaimer injection as every
// other post. VIP is skipped (members are already inside). Re-run any time to refresh the
// pinned welcome (Telegram replaces the channel's single pinned message). Edit the source in
// content/_broadcast/start-here-<id>/<lang>.json, then dispatch the workflow.
//
//   DRY=1 node scripts/pin-start-here.mjs   → gate-check + log only, no send/pin
//   node scripts/pin-start-here.mjs         → send + pin for real (needs TELEGRAM_BOT_TOKEN)
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { CHANNELS } from '../src/config.js';
import { render } from '../src/render.js';
import { checkText } from '../src/compliance.js';
import { sendMessage, sendPhoto, validateCaptionLength } from '../src/telegram.js';
import { resolveImagePath, REPO_ROOT } from '../src/posts.js';

const DRY = process.env.DRY === '1';
const token = process.env.TELEGRAM_BOT_TOKEN;
const communityLink = process.env.COMMUNITY_LINK || '';
const BID = 'start-here-20260627';
const dir = join(REPO_ROOT, 'content', '_broadcast', BID);

if (!DRY && !token) { console.error('FATAL: TELEGRAM_BOT_TOKEN not set'); process.exit(1); }

async function pin(chatId, messageId) {
  const r = await fetch(`https://api.telegram.org/bot${token}/pinChatMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, message_id: messageId, disable_notification: true }),
  });
  return r.json();
}

for (const ch of Object.values(CHANNELS)) {
  if (ch.key === 'vip') { console.log('vip: skipped (members already inside)'); continue; }
  const file = join(dir, `${ch.key}.json`);
  if (!existsSync(file)) { console.log(`${ch.key}: no file — skip`); continue; }
  const post = JSON.parse(readFileSync(file, 'utf8'));
  const text = render(post, { channel: ch, communityLink });
  const gate = checkText(text, { lang: post.lang || ch.key });
  if (!gate.ok) {
    console.log(`${ch.key}: ⛔ BLOCKED ${gate.violations.map((v) => v.code + ':' + v.detail).join(' | ')}`);
    continue;
  }
  // Photo header (optional): if the post carries an image, send it as a photo with the
  // rendered text as the caption (hard 1024-char cap), else send a plain text message.
  const isPhoto = typeof post.image === 'string' && post.image.trim() !== '';
  let imageAbs = null;
  if (isPhoto) {
    const img = resolveImagePath(post.image);
    if (!img.exists) { console.log(`${ch.key}: ⛔ image not found ("${post.image}")`); continue; }
    imageAbs = img.abs;
    const cap = validateCaptionLength(text);
    if (!cap.ok) { console.log(`${ch.key}: ⛔ caption ${cap.length} > ${cap.max} chars`); continue; }
  }

  if (DRY) { console.log(`${ch.key}: DRY ok (${isPhoto ? 'photo, caption ' : 'text '}${text.length} chars)`); continue; }
  try {
    const res = isPhoto
      ? await sendPhoto({ token, chatId: ch.chatId, absImagePath: imageAbs, caption: text })
      : await sendMessage({ token, chatId: ch.chatId, text });
    const mid = res && res.message_id;
    const p = await pin(ch.chatId, mid);
    console.log(`${ch.key}: ✅ sent msg=${mid} pin=${p.ok ? 'ok' : 'FAIL ' + (p.description || '')}`);
  } catch (e) {
    console.log(`${ch.key}: ERROR ${e.message}`);
  }
}
