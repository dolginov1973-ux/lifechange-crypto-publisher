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
  // --- v2 launch locales (added 2026-06-25). Same rubric grid, each on its own tz.
  // Localization = cultural adaptation, not translation; exchange terms stay EN; the
  // risk disclaimer is FULLY localized (injected per-channel so it can never be forgotten).
  pt: {
    key: 'pt',
    chatId: '@LifeChange_crypto_pt',
    tz: 'America/Sao_Paulo', // BRT (Brazil)
    riskDisclaimer:
      'Apenas educacional — não é consultoria financeira. Futuros de cripto carregam alto risco de perda total.',
  },
  vi: {
    key: 'vi',
    chatId: '@LifeChange_crypto_vi',
    tz: 'Asia/Ho_Chi_Minh', // ICT (Vietnam)
    riskDisclaimer:
      'Chỉ mang tính giáo dục — không phải tư vấn tài chính. Crypto futures có rủi ro mất vốn toàn bộ.',
  },
  es: {
    key: 'es',
    chatId: '@LifeChange_crypto_es',
    tz: 'America/Mexico_City', // CST (LatAm reference)
    riskDisclaimer:
      'Solo con fines educativos — no es asesoría financiera. Los futuros de criptomonedas conllevan un alto riesgo de pérdida total.',
  },
  tr: {
    key: 'tr',
    chatId: '@LifeChange_crypto_tr',
    tz: 'Europe/Istanbul', // TRT (Turkey)
    riskDisclaimer:
      'Yalnızca eğitim amaçlıdır — finansal tavsiye değildir. Kripto futures yüksek kayıp riski taşır.',
  },
  id: {
    key: 'id',
    chatId: '@LifeChange_crypto_id',
    tz: 'Asia/Jakarta', // WIB (Indonesia)
    riskDisclaimer:
      'Hanya untuk edukasi — bukan nasihat keuangan. Crypto futures membawa risiko kerugian total yang tinggi.',
  },
  // --- RU / СНГ locale (added 2026-06-27). Home market — the project's roots (LC News).
  ru: {
    key: 'ru',
    chatId: '@LifeChange_crypto_ru',
    tz: 'Europe/Moscow', // MSK (СНГ reference)
    riskDisclaimer:
      'Только в образовательных целях — не является финансовой консультацией. Криптофьючерсы несут высокий риск полной потери средств.',
  },
};

// VIP private room (the PAID signal channel). Registered ONLY when VIP_CHAT_ID is set in the
// env (a publisher secret) — public-only runs are unaffected, and the scheduler never posts here
// because there is no content/vip/ folder; it receives only what a broadcast explicitly targets
// via a vip.json. Uses the default publisher bot token, so add the publisher bot
// (@LifeChange_ResearchBot) as an admin with "Post Messages" in the VIP group. Same hard
// compliance gate + injected risk disclaimer as every other channel.
if (process.env.VIP_CHAT_ID) {
  CHANNELS.vip = {
    key: 'vip',
    chatId: process.env.VIP_CHAT_ID,
    tz: 'Asia/Manila',
    riskDisclaimer:
      'Educational only — not financial advice. Crypto futures carry high risk of loss.',
  };
}

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
  // --- v2 launch locales. Income-promise (group B) + licensed/regulated (group C) per
  // content pack v2 §6.5. EN list always runs too (see compliance.js), so these only need
  // the language-specific fabricated-income / guarantee phrasings. Kept conservative to
  // avoid false positives on normal trading copy.
  pt: [
    'lucro garantido', // guaranteed profit
    'lucros? garantidos?',
    'ganhos? garantidos?',
    'ganho garantido',
    'fique rico', // get rich
    'dinheiro fácil', // easy money
    'renda passiva', // passive income
    'sem risco', // risk-free
    'dobre (o seu|seu) (dinheiro|capital|conta)', // double your money
    // Fake advertised win/hit-rate: only block when paired with a fabricated % figure
    // (bare "taxa de acerto" can appear in the negated "NOT a fixed win-rate" guidance).
    '\\d{2,3}\\s?%\\s?(de )?(acerto|acertos|ganho|sucesso)', // 92% win/accuracy
    '(taxa|índice) de (acerto|acertos|vit[óo]rias)\\s?(de\\s?)?\\d{2,3}\\s?%', // hit-rate 92%
    'licenciad[ao]', // licensed
    'regulamentad[ao]', // regulated
  ],
  vi: [
    'lợi nhuận đảm bảo', // guaranteed profit
    'cam kết lợi nhuận', // committed profit
    'đảm bảo thắng', // guaranteed win
    'chắc chắn thắng', // sure win
    'làm giàu', // get rich
    'tiền dễ', // easy money
    'thu nhập thụ động', // passive income
    'không rủi ro', // risk-free
    'nhân đôi (tài khoản|tiền)', // double your account/money
    // Fake win-rate: block only with a fabricated % (bare "tỷ lệ thắng" appears in the
    // negated "NOT a fixed win-rate %" template guidance, which is allowed).
    '\\d{2,3}\\s?%\\s?(thắng|chính xác|thành công)', // 92% win/accuracy/success
    't[ỷỉ] lệ thắng\\s?(là\\s?)?\\d{2,3}\\s?%', // win rate is 92%
    'được cấp phép', // licensed
    'được quản lý', // regulated (as a claim)
  ],
  es: [
    'ganancia garantizada', // guaranteed profit
    'ganancias garantizadas',
    'beneficio garantizado',
    'hazte rico', // get rich
    'dinero fácil', // easy money
    'ingreso pasivo', // passive income
    'ingresos pasivos',
    'sin riesgo', // risk-free
    'duplica tu (dinero|cuenta|capital)', // double your money
    // Fake hit-rate: block only with a fabricated % (bare "tasa de aciertos" can appear
    // in the negated "NO un porcentaje de éxito fijo" template guidance, which is allowed).
    '\\d{2,3}\\s?%\\s?(de )?(acierto|aciertos|ganancia|éxito|exito)', // 92% win/accuracy
    'tasa de (acierto|aciertos|éxito|exito)\\s?(del?\\s?)?\\d{2,3}\\s?%', // hit-rate of 92%
    'con licencia', // licensed (as a claim)
    'regulad[ao]', // regulated
  ],
  tr: [
    'garantili kazanç', // guaranteed profit/earnings
    'garantili kâr',
    'garantili kar',
    'kesin kazanç', // sure win
    'zengin ol', // get rich
    'kolay para', // easy money
    'pasif gelir', // passive income
    'risksiz', // risk-free
    'paranı (ikiye katla|katla)', // double your money
    'hesabını ikiye katla',
    // Fake success/win-rate: block only with a fabricated % (bare "kazanç oranı" appears
    // in the negated "sabit kazanç oranı % VERİLMEZ" template guidance, which is allowed).
    '%\\s?\\d{2,3}\\s?(kazanç|başarı|isabet|doğruluk)', // %92 win/success/accuracy
    '(kazanç|başarı|isabet) oranı\\s?%?\\s?\\d{2,3}', // win/success rate 92
    'lisanslı', // licensed
    'denetimli', // regulated/supervised
  ],
  id: [
    'profit (dijamin|terjamin)', // guaranteed profit
    'keuntungan (dijamin|terjamin)',
    'dijamin (untung|profit|cuan)', // guaranteed win
    'pasti (untung|profit|menang)', // sure profit/win
    'cepat kaya', // get rich quick
    'uang mudah', // easy money
    'penghasilan pasif', // passive income
    'tanpa risiko', // risk-free
    'gandakan (uang|modal|akun)', // double your money
    // Fake advertised win-rate: block only with a fabricated % (bare "win rate" /
    // "tingkat kemenangan" can appear in the negated "NOT a fixed win-rate %" guidance).
    '\\d{2,3}\\s?%\\s?(win ?rate|akurasi|menang|profit)', // 92% win-rate/accuracy
    '(win ?rate|tingkat (kemenangan|akurasi))\\s?\\d{2,3}\\s?%', // win rate 92%
    'berlisensi', // licensed
    'teregulasi', // regulated
    'diatur (pemerintah|regulator)', // government regulated
  ],
  // --- RU / СНГ locale. Income-promise (group B) + licensed/regulated (group C). EN list
  // always runs too. Conservative to avoid false positives on normal trading copy.
  ru: [
    'прибыл[ьи]', //          profit (прибыль / прибыли) — NOT "прибыл" (arrived) which has no suffix
    'прибыльн', //            profitable (прибыльный)
    'доходност', //           доходность (returns / yield)
    'гарантирован', //        guaranteed
    'гаранти[яюи]', //        гарантия / гарантию / гарантии
    'гарантированн\\w{0,3} доход', // guaranteed income
    'заработок', //           earnings
    'зарабатыва', //          зарабатывай (earn)
    'заработа[йт]', //        заработай / заработать (earn)
    'удво[ий]', //            удвой / удвоить (double your money)
    'разбогат', //            get rich (разбогатеть)
    'без риска', //           risk-free
    'безрисков',
    'пассивн\\w{0,3} доход', // passive income
    'л[её]гкие деньги', //    easy money
    'быстрые деньги', //      quick money
    'миллионер', //           millionaire
    'памп', //                pump
    '\\d{2,3}\\s?%\\s?(прибыл|доход|годовых)', //        NN% profit/income/annual
    '\\d{2,3}\\s?%\\s?(точност|винрейт|побед|успех)', // NN% winrate/accuracy/success
    'лицензирован', //        licensed (claim)
    'регулиру[ею]м', //       regulated (claim)
  ],
};

// Bitunix must never be called "licensed" / "regulated" (§1.5 item 3).
// Matches the brand within proximity of the forbidden adjectives, either order.
export const BITUNIX_FORBIDDEN = [
  'bitunix[^.\\n]{0,40}\\b(licen[cs]ed|regulated)\\b',
  '\\b(licen[cs]ed|regulated)\\b[^.\\n]{0,40}bitunix',
  // Hindi transliteration safety net
  'bitunix[^.\\n]{0,40}(रेगुलेटेड|लाइसेंस)',
  // Russian safety net (лицензирован / регулируем near the brand)
  'bitunix[^.\\n]{0,40}(лицензирован|регулиру)',
  '(лицензирован|регулиру)\\w*[^.\\n]{0,40}bitunix',
];
