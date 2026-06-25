// Idempotency / cadence state. Persisted to state/posted-log.json and committed back
// by the GitHub Action so re-runs never duplicate a send.
//
// Shape:
// {
//   "posts": [ { "id","channel","rubric","slot","cta","dateKey","ts","messageId" } ],
//   "_updated": "ISO"
// }

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const STATE_PATH = join(__dirname, '..', 'state', 'posted-log.json');

export function loadState() {
  if (!existsSync(STATE_PATH)) return { posts: [], _updated: null };
  try {
    const s = JSON.parse(readFileSync(STATE_PATH, 'utf8'));
    if (!Array.isArray(s.posts)) s.posts = [];
    return s;
  } catch {
    return { posts: [], _updated: null };
  }
}

export function saveState(state) {
  state._updated = new Date().toISOString();
  mkdirSync(dirname(STATE_PATH), { recursive: true });
  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2) + '\n', 'utf8');
}

export function postedIds(state) {
  return new Set(state.posts.map((p) => p.id));
}

// Posts already sent to a channel on a given local dateKey.
export function postsOnDay(state, channelKey, dateKey) {
  return state.posts.filter((p) => p.channel === channelKey && p.dateKey === dateKey);
}

// The most recent post sent to a channel (by timestamp), or null.
export function lastPost(state, channelKey) {
  const ch = state.posts
    .filter((p) => p.channel === channelKey)
    .sort((a, b) => String(a.ts).localeCompare(String(b.ts)));
  return ch.length ? ch[ch.length - 1] : null;
}

export function recordPost(state, entry) {
  state.posts.push(entry);
  return state;
}
