// Compliance gate (§1.5). HARD gate: any failure blocks the send.
// Programmatically gated items: 1 (banned terms), 2 (placeholders), 3 (Bitunix),
// 5 (risk disclaimer present/injected), 8 (quiet-hours + cap). Items 4/6/7/9/10 are
// human-review flags handled in the editor, not here — except CTA frequency (7) which
// is enforced by the scheduler (cap + no-consecutive) in publish.js.

import { BANNED_TERMS, BITUNIX_FORBIDDEN } from './config.js';

// Compile banned-term regexes once.
const EN_BANNED = BANNED_TERMS.en.map((src) => new RegExp(src, 'gi'));
const HI_BANNED = BANNED_TERMS.hi.map((src) => new RegExp(src, 'gi'));
const BITUNIX = BITUNIX_FORBIDDEN.map((src) => new RegExp(src, 'gi'));

// Unfilled placeholder = a [...] block. We treat ANY [ ... ] containing a letter as a
// live placeholder. (Markdown links are not used in post bodies; CTA uses {{COMMUNITY}}.)
const PLACEHOLDER_RE = /\[[^\]\n]*[A-Za-zऀ-ॿ][^\]\n]*\]/g;

// Run text-level compliance checks on the FINAL rendered body (after disclaimer
// injection and community-link rendering). Returns { ok, violations: [...] }.
export function checkText(text, { lang = 'en' } = {}) {
  const violations = [];

  // Item 2 — no unfilled placeholders.
  const placeholders = text.match(PLACEHOLDER_RE);
  if (placeholders) {
    violations.push({
      code: 'PLACEHOLDER',
      detail: `Unfilled placeholder(s): ${[...new Set(placeholders)].join(', ')}`,
    });
  }

  // Item 1 — banned profit/return/guarantee language (EN always + lang lexicon).
  const banks = lang === 'hi' ? [...EN_BANNED, ...HI_BANNED] : EN_BANNED;
  const hits = new Set();
  for (const re of banks) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(text)) !== null) {
      hits.add(m[0].trim());
      if (re.lastIndex === m.index) re.lastIndex++; // guard zero-width
    }
  }
  if (hits.size) {
    violations.push({
      code: 'BANNED_TERM',
      detail: `Banned term(s): ${[...hits].join(', ')}`,
    });
  }

  // Item 3 — Bitunix never "licensed"/"regulated".
  for (const re of BITUNIX) {
    re.lastIndex = 0;
    if (re.test(text)) {
      violations.push({
        code: 'BITUNIX_LICENSED',
        detail: 'Bitunix described as licensed/regulated — forbidden.',
      });
      break;
    }
  }

  return { ok: violations.length === 0, violations };
}

// Item 5 — ensure the localized risk disclaimer is present; if absent, the caller
// injects it. Here we just report presence.
export function hasDisclaimer(text, disclaimer) {
  // Compare on a normalized form (collapse whitespace) to be robust.
  const norm = (s) => s.replace(/\s+/g, ' ').trim();
  return norm(text).includes(norm(disclaimer));
}

export { PLACEHOLDER_RE };
