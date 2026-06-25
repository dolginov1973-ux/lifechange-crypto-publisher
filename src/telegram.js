// Telegram Bot API sender. Zero-dependency: uses Node 20+ native fetch / FormData / Blob.
// parse_mode=HTML, web preview disabled. Bodies are HTML-escaped (no markup in posts).
//
// Two send paths:
//   sendMessage — plain text post (default).
//   sendPhoto   — photo post (P&L #RealResults / Teardown #LessonLearned): a local screenshot
//                 uploaded as multipart/form-data with the rendered text as `caption`.
// The caption is HTML-escaped exactly like a text body and is subject to the SAME compliance
// gate upstream in publish.js — the photo path never relaxes the gate.

import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { escapeHtml } from './render.js';

const API = 'https://api.telegram.org';

// Telegram hard limit on a photo caption. Over this the API rejects the send (400), so we
// validate before we ever upload. See RULES.captionMaxLength in config.js.
export const CAPTION_MAX_LENGTH = 1024;

export async function sendMessage({ token, chatId, text }) {
  const url = `${API}/bot${token}/sendMessage`;
  const payload = {
    chat_id: chatId,
    text: escapeHtml(text),
    parse_mode: 'HTML',
    disable_web_page_preview: true,
  };
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) {
    const desc = data.description || `HTTP ${res.status}`;
    throw new Error(`Telegram sendMessage failed for ${chatId}: ${desc}`);
  }
  return data.result; // includes message_id
}

// Returns { ok, length } — counts the RAW (pre-escape) caption length, which is what Telegram
// limits. Used by the gate (check.js) and as a defensive guard in sendPhoto.
export function validateCaptionLength(caption, max = CAPTION_MAX_LENGTH) {
  const length = [...caption].length; // count code points (emoji-safe), matches Telegram
  return { ok: length <= max, length, max };
}

// Send a photo post: local screenshot file + caption (multipart/form-data).
//   absImagePath — absolute path to a local image (resolved by the caller, must exist).
//   caption      — the rendered text (already passed the compliance gate); HTML-escaped here.
export async function sendPhoto({ token, chatId, absImagePath, caption }) {
  const { ok, length, max } = validateCaptionLength(caption);
  if (!ok) {
    throw new Error(
      `Telegram sendPhoto caption too long for ${chatId}: ${length} > ${max} chars.`,
    );
  }

  const url = `${API}/bot${token}/sendPhoto`;
  const bytes = readFileSync(absImagePath); // throws if missing — caller checks first
  const blob = new Blob([bytes]);

  const form = new FormData();
  form.append('chat_id', chatId);
  form.append('parse_mode', 'HTML');
  form.append('caption', escapeHtml(caption));
  // `photo` as a file upload (multipart) — not a URL/file_id.
  form.append('photo', blob, basename(absImagePath));

  const res = await fetch(url, { method: 'POST', body: form }); // fetch sets the multipart boundary
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) {
    const desc = data.description || `HTTP ${res.status}`;
    throw new Error(`Telegram sendPhoto failed for ${chatId}: ${desc}`);
  }
  return data.result; // includes message_id
}
