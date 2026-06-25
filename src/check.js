// Standalone compliance linter. Validates every post (or only ready ones) WITHOUT sending.
// Use before committing new content, and as a CI gate.
//
//   node src/check.js          → lint READY posts only (drafts skipped, just listed)
//   node src/check.js --all    → lint ALL posts incl. drafts (drafts expected to have [..])
//
// Exit non-zero if any READY post fails compliance (placeholders, banned terms, etc.).

import { CHANNELS, RULES } from './config.js';
import { loadAllPosts, resolveImagePath } from './posts.js';
import { render } from './render.js';
import { checkText, hasDisclaimer } from './compliance.js';
import { validateCaptionLength } from './telegram.js';

const ALL = process.argv.includes('--all');

function main() {
  const posts = loadAllPosts();
  let failures = 0;
  let readyCount = 0;
  let draftCount = 0;

  // We lint against the WORST case for CTA: communityLink present (so the marker
  // resolves to a URL and the CTA line is actually validated).
  const communityLink = process.env.COMMUNITY_LINK || 'https://t.me/example_community';

  for (const post of posts) {
    const channel = CHANNELS[post.channel];
    if (!channel) {
      console.error(`✗ ${post.id}: unknown channel "${post.channel}"`);
      failures++;
      continue;
    }
    const isReady = post.ready === true;
    if (isReady) readyCount++;
    else draftCount++;

    const text = render(post, { channel, communityLink });
    const gate = checkText(text, { lang: post.lang || post.channel });
    const discOk = hasDisclaimer(text, channel.riskDisclaimer);

    const problems = [...gate.violations];
    if (!discOk) problems.push({ code: 'NO_DISCLAIMER', detail: 'risk disclaimer missing after render' });

    // --- Photo posts: caption length is a HARD send-blocker (Telegram ~1024 limit). ---
    // The text gate above already ran on the caption (photo never relaxes the gate). Here we
    // add caption-length as a real failure for ready photo posts, and a non-fatal note on the
    // image path (real screenshots are intentionally NOT committed — see README §1.3).
    const isPhoto = typeof post.image === 'string' && post.image.trim() !== '';
    if (isPhoto) {
      const cap = validateCaptionLength(text, RULES.captionMaxLength);
      if (!cap.ok) {
        problems.push({
          code: 'CAPTION_TOO_LONG',
          detail: `caption ${cap.length} > ${cap.max} chars (Telegram sendPhoto limit)`,
        });
      }
      const img = resolveImagePath(post.image);
      if (img.error) {
        // Bad path shape (absolute / escapes repo) is a real problem even for drafts.
        problems.push({ code: 'IMAGE_PATH', detail: `${post.image}: ${img.error}` });
      } else if (!img.exists) {
        console.warn(
          `  ⚠ ${post.id}: image "${post.image}" not committed yet (photo post will be blocked at send until it exists; do NOT commit a screenshot showing your balance/personal data — README §1.3).`,
        );
      }
    }

    if (isReady) {
      if (problems.length) {
        failures++;
        console.error(
          `✗ READY  ${post.id}  →  ` + problems.map((p) => `${p.code}: ${p.detail}`).join(' | '),
        );
      } else {
        console.log(`✓ READY  ${post.id}  (${post.rubric}/${post.slot}, cta=${!!post.cta})`);
      }
    } else {
      // Drafts: expected to contain placeholders. Report them but do not fail
      // (unless --all and a NON-placeholder violation appears).
      const nonPlaceholder = problems.filter((p) => p.code !== 'PLACEHOLDER' && p.code !== 'NO_DISCLAIMER');
      if (ALL && nonPlaceholder.length) {
        failures++;
        console.error(
          `✗ DRAFT  ${post.id}  →  ` + nonPlaceholder.map((p) => `${p.code}: ${p.detail}`).join(' | '),
        );
      } else {
        const ph = problems.find((p) => p.code === 'PLACEHOLDER');
        console.log(`· DRAFT  ${post.id}  (${post.rubric}/${post.slot})${ph ? '  — has placeholders (expected)' : ''}`);
      }
    }
  }

  console.log(
    `\nSummary: ${posts.length} posts (${readyCount} ready, ${draftCount} draft). ${failures} failure(s).`,
  );
  process.exit(failures > 0 ? 1 : 0);
}

main();
