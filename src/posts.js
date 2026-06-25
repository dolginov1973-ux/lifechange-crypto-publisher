// Post storage + loader. Posts are JSON files under content/<channel>/<rubric>/<slug>.json.
//
// Schema (one file = one post):
// {
//   "id":        "en-macro-001",       // unique, stable; used for idempotency log
//   "channel":   "en" | "hi",
//   "rubric":    "macro" | "btc-setup" | "education" | "psychology" | "checklist" | "pnl" | "teardown",
//   "slot":      "A" | "B",            // default slot this post is written for
//   "lang":      "en" | "hi",
//   "ready":     true | false,         // draft gate: false = never published by scheduler
//   "cta":       true | false,         // does this post contain a community CTA?
//   "title":     "Weekly Macro Brief", // human label, not sent
//   "image":     "assets/pnl/x.png",   // OPTIONAL — repo-relative path to a local screenshot.
//                                      //   present → sent via sendPhoto, `body` becomes the
//                                      //   caption (≤1024 chars). Absent → sent via sendMessage.
//                                      //   Used by photo rubrics: pnl (#RealResults), teardown.
//   "body":      "…full post text with the rubric #tag, WITHOUT the risk line…"
// }
//
// The risk disclaimer is injected by the publisher (per-channel constant) if absent,
// so editors cannot forget it. CTA community lines use a {{COMMUNITY}} marker —
// rendered to the real link or dropped entirely if COMMUNITY_LINK is empty.
// The body/caption ALWAYS passes the same compliance gate, image or not.

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname, isAbsolute, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RUBRICS, CHANNELS } from './config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = join(__dirname, '..');
export const CONTENT_ROOT = join(REPO_ROOT, 'content');

// Resolve a post's repo-relative `image` path to an absolute path, confined to the repo.
// Returns { abs, exists }. Rejects absolute paths and ../ escapes (no reading outside repo).
export function resolveImagePath(image) {
  if (!image || typeof image !== 'string' || !image.trim()) {
    return { abs: null, exists: false, error: 'empty image path' };
  }
  const rel = image.trim();
  if (isAbsolute(rel)) {
    return { abs: null, exists: false, error: 'image path must be repo-relative, not absolute' };
  }
  const abs = normalize(join(REPO_ROOT, rel));
  if (!abs.startsWith(normalize(REPO_ROOT))) {
    return { abs: null, exists: false, error: 'image path escapes the repo (../)' };
  }
  return { abs, exists: existsSync(abs) };
}

// Load every post for a channel (all rubrics). Returns array of post objects with _path.
export function loadPostsForChannel(channelKey) {
  const out = [];
  const channelDir = join(CONTENT_ROOT, channelKey);
  if (!existsSync(channelDir)) return out;
  for (const rubricFolder of Object.values(RUBRICS).map((r) => r.folder)) {
    const dir = join(channelDir, rubricFolder);
    if (!existsSync(dir)) continue;
    for (const file of readdirSync(dir)) {
      if (!file.endsWith('.json')) continue;
      const path = join(dir, file);
      const post = JSON.parse(readFileSync(path, 'utf8'));
      post._path = path;
      out.push(post);
    }
  }
  return out;
}

// Load ALL posts across every configured channel (for `lint:posts`).
export function loadAllPosts() {
  return Object.keys(CHANNELS).flatMap((c) => loadPostsForChannel(c));
}

// Pick the next eligible post for (channel, rubric, slot):
//   ready === true, matching rubric, matching slot (or slot-agnostic), not yet posted.
// Returns the post or null. `alreadyPostedIds` is a Set of post ids from the state log.
export function pickPost({ posts, rubric, slot, alreadyPostedIds }) {
  const candidates = posts.filter(
    (p) =>
      p.ready === true &&
      p.rubric === rubric &&
      (p.slot === slot || p.slot === undefined || p.slot === null) && // null/undefined = slot-agnostic evergreen
      !alreadyPostedIds.has(p.id),
  );
  // Deterministic: oldest id first (stable ordering).
  candidates.sort((a, b) => String(a.id).localeCompare(String(b.id)));
  return candidates[0] || null;
}
