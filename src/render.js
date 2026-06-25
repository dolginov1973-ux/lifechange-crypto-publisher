// Renders a stored post into the final message text:
//  1. Resolves {{COMMUNITY}} CTA marker against COMMUNITY_LINK env.
//  2. Injects the per-channel risk disclaimer if not already present.
//
// CTA convention in post bodies:
//   Lines that promote the community wrap the link marker like:
//     "… join if you want to follow the reasoning 👉 {{COMMUNITY}}"
//   If COMMUNITY_LINK is empty, the ENTIRE line containing {{COMMUNITY}} is dropped,
//   so the literal "[community link]" / dangling marker is never published.

import { hasDisclaimer } from './compliance.js';

const COMMUNITY_MARKER = '{{COMMUNITY}}';

export function render(post, { channel, communityLink }) {
  let body = post.body;

  // Resolve community CTA marker.
  if (body.includes(COMMUNITY_MARKER)) {
    if (communityLink && communityLink.trim()) {
      body = body.replaceAll(COMMUNITY_MARKER, communityLink.trim());
    } else {
      // Drop whole lines that carry the marker (no link → no orphan CTA).
      body = body
        .split('\n')
        .filter((line) => !line.includes(COMMUNITY_MARKER))
        .join('\n')
        // collapse a resulting run of >2 blank lines
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    }
  }

  // Inject risk disclaimer if missing (item 5 — cannot be forgotten).
  if (!hasDisclaimer(body, channel.riskDisclaimer)) {
    body = `${body}\n\n⚠️ ${channel.riskDisclaimer}`;
  }

  return body.trim();
}

// HTML escape for Telegram parse_mode=HTML. We send posts as escaped plain text inside
// HTML mode (no markup in bodies), which keeps emoji, hashtags, [..] all literal-safe.
export function escapeHtml(text) {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}
