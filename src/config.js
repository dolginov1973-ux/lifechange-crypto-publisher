// Central configuration: channels, timezones, disclaimers, banned-terms lexicon, cadence rules.
// Source of truth: content_foundation_pack_2026-06-25.md (§1.2, §1.4, §1.5, §2).

// ---------------------------------------------------------------------------
// Channels. chat_id targets the @username (bot @LifeChange_ResearchBot is admin in both).
// risk disclaimer is a LOCALIZED CONSTANT injected per channel (§1.5 note) so it can
// never be forgotten. tz is used for quiet-hours / slot resolution.
// ---------------------------------------------------------------------------
export const CHANNELS = {
  en: {
    key: 'en',
    chatId: '@LifeChange_crypto',
    // EN = evening overlap India/Philippines. Asia/Manila is the reference tz (§1.2 / §5).
    tz: 'Asia/Manila',
    riskDisclaimer:
      'Educational only — not financial advice. Crypto futures carry high risk of loss.',
  },
  hi: {
    key: 'hi',
    chatId: '@LifeChange_crypto_hi',
    tz: 'Asia/Kolkata', // IST
    riskDisclaimer:
      'सिर्फ़ शैक्षिक उद्देश्य से — यह कोई निवेश सलाह नहीं है। क्रिप्टो फ्यूचर्स में नुकसान का जोखिम बहुत ज़्यादा होता है।',
  },
};

// ---------------------------------------------------------------------------
// Cadence rules (§1.2).
// ---------------------------------------------------------------------------
export const RULES = {
  quietHoursStart: 22, // 22:00 local — inclusive start of quiet block
  quietHoursEnd: 8, //   08:00 local — exclusive end (sends allowed from 08:00)
  maxPostsPerChannelPerDay: 2,
  maxCtaPerChannelPerDay: 1, // ≤1 CTA/day
  noConsecutiveCta: true, //   never two CTA posts back-to-back
  // Telegram caption hard limit for sendPhoto is 1024 chars. Photo posts (P&L #RealResults,
  // Teardown #LessonLearned) carry the rendered text as a caption — over this it's rejected
  // by the API, so the gate validates length and the editor must trim. (sendMessage text
  // limit is 4096 and is not relevant here.)
  captionMaxLength: 1024,
  // Slot windows (local). A post is "due" when local time is inside its slot window
  // AND a schedule entry exists for (channel, weekday, slot).
  slots: {
    A: { start: '09:00', end: '10:00' }, // morning
    B: { start: '18:00', end: '19:30' }, // evening, attention peak in start geos
    // S = dedicated SEED slot used ONLY by the first-week P&L drip (schedule.seedPnl).
    // It is a SEPARATE slot id so the seed P&L never collides with — or is suppressed by —
    // a normal grid post that also lands in the B window (Mon psychology-B, Tue education-B).
    // A distinct slot id keeps per-slot idempotency independent. Window is a touch later than
    // B so on Friday the natural B P&L and the seed slot don't both try to post (Fri seed is
    // deduped anyway because the grid already carries pnl-B that day). Inside quiet-hours? No:
    // 19:30–20:30 local is well before the 22:00 quiet block.
    S: { start: '19:30', end: '20:30' }, // seed-week P&L drip (evening, after the B window)
  },
  // How far past the slot start we still allow a publish (cron runs every 30 min,
  // so the slot window itself + this grace covers misfires). Kept inside the window.
};

// ---------------------------------------------------------------------------
// Rubric (pillar) registry → folder + tag (§1.1).
// ---------------------------------------------------------------------------
export const RUBRICS = {
  macro: { id: 'P1', tag: '#MacroBrief', folder: 'macro', evergreen: false },
  'btc-setup': { id: 'P2', tag: '#BTCSetup', folder: 'btc-setup', evergreen: false },
  education: { id: 'P3', tag: '#CryptoSchool', folder: 'education', evergreen: true },
  psychology: { id: 'P4', tag: '#MindOverMarket', folder: 'psychology', evergreen: true },
  checklist: { id: 'P5', tag: '#BeforeYouTrade', folder: 'checklist', evergreen: true },
  // P6/P7 are photo-capable rubrics: a screenshot + caption (sendPhoto). The caption goes
  // through the SAME compliance gate as any text. P&L lives under content/<ch>/realresults/
  // (folder matches the #RealResults tag); the rubric KEY stays "pnl" (schedule + idempotency).
  pnl: { id: 'P6', tag: '#RealResults', folder: 'realresults', evergreen: false },
  teardown: { id: 'P7', tag: '#LessonLearned', folder: 'teardown', evergreen: false },
};

// ---------------------------------------------------------------------------
// Banned-terms lexicon (§1.4 ban list + §1.5 item 1). EN + Hindi.
// Matching is case-insensitive, word-boundary aware where it makes sense.
// Each entry is a RegExp source string compiled in compliance.js.
// Keep this list growing as new phrasings appear (§1.5 note).
// ---------------------------------------------------------------------------
export const BANNED_TERMS = {
  en: [
    '\\bprofit(s|able|ability)?\\b',
    '\\breturns?\\b',
    '\\bget rich\\b',
    '\\bguarantee(d|s)?\\b',
    '\\bdouble (your )?(money|account|capital)\\b',
    '\\bdoubl(e|ing) your\\b',
    '\\bearn(ings)?\\b',
    '\\bX% returns?\\b',
    '\\b\\d+% returns?\\b',
    '\\bmoon(shot|ing)?\\b',
    '\\bto the moon\\b',
    '\\bpump\\b', // anti-pump positioning; only allowed in negated copy reviewed by human
    '\\brisk[- ]free\\b',
    '\\bsure shot\\b',
    '\\bsure[- ]?win\\b',
    '\\beasy money\\b',
    '\\bpassive income\\b',
    '\\bquick (money|cash|profit)\\b',
    '\\bmillionaire\\b',
    '\\b100x your\\b',
  ],
  hi: [
    'मुनाफ़ा', // profit
    'मुनाफा',
    'मुनाफे',
    'कमाई', // earnings
    'कमाओ', // earn (imperative)
    'कमाएं',
    'कमाएँ',
    'गारंटी', // guarantee
    'गारंटीड',
    'दोगुना', // double
    'अमीर बन', // get rich (अमीर बनो / बनना)
    'रिटर्न', // returns (transliterated)
    'मुफ़्त पैसा', // free money
    'मुफ्त पैसा',
    'पक्का मुनाफ़ा', // sure profit
    'आसान पैसा', // easy money
    'वादा.{0,12}(दोहरा|दोगुना|मुनाफ़|मुनाफ|कमाई|रिटर्न)', // "वादा дохода"-style: promise + income word
    'दोहरा करो', // double it
  ],
};

// Bitunix must never be called "licensed" / "regulated" (§1.5 item 3).
// Matches the brand within proximity of the forbidden adjectives, either order.
export const BITUNIX_FORBIDDEN = [
  'bitunix[^.\\n]{0,40}\\b(licen[cs]ed|regulated)\\b',
  '\\b(licen[cs]ed|regulated)\\b[^.\\n]{0,40}bitunix',
  // Hindi transliteration safety net
  'bitunix[^.\\n]{0,40}(रेगुलेटेड|लाइसेंस)',
];
