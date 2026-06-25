# Lifechange Crypto — Publisher

Lightweight, **zero-dependency** git-based scheduled publisher for the Lifechange Crypto
Telegram channels (7 locales). No Supabase, no Vercel — just Node.js 20+ and a
GitHub Actions cron. Every send passes a **hard compliance gate** before it leaves.

- **EN channel:** `@LifeChange_crypto` (tz reference `Asia/Manila` — India/Philippines evening overlap)
- **Hindi:** `@LifeChange_crypto_hi` (tz `Asia/Kolkata`, IST)
- **Portuguese:** `@LifeChange_crypto_pt` (tz `America/Sao_Paulo`, BRT)
- **Vietnamese:** `@LifeChange_crypto_vi` (tz `Asia/Ho_Chi_Minh`, ICT)
- **Spanish:** `@LifeChange_crypto_es` (tz `America/Mexico_City`, CST — LatAm reference)
- **Turkish:** `@LifeChange_crypto_tr` (tz `Europe/Istanbul`, TRT)
- **Indonesian:** `@LifeChange_crypto_id` (tz `Asia/Jakarta`, WIB)
- Bot `@LifeChange_ResearchBot` must already be an admin (Post Messages) in every channel.

> **Content v2 (Variant B).** Rubrics are the v2 set — #Signal, #MorningBriefing,
> #CryptoSchool, #MindOverMarket, #BeforeYouTrade, #MonthlyResults — carried in the post
> bodies. The folder/key layer is the original v1 registry (the displayed hashtag lives in
> the body, the rubric key is just routing): macro=#MorningBriefing, btc-setup=#Signal,
> education=#CryptoSchool, psychology=#MindOverMarket, checklist=#BeforeYouTrade,
> teardown=#MonthlyResults, realresults/pnl=#RealResults (P&L photos, EN+HI only so far).
> The 5 seed P&L (EN+HI) are unchanged; P&L for pt/vi/es/tr/id is a follow-up.

---

## 1. Repository layout

```
lifechange-crypto-publisher/
├── .github/workflows/
│   ├── publish.yml            # cron every 30 min → runs publisher, commits state back
│   └── lint-posts.yml         # on push/PR → node --check + compliance lint of ready posts
├── content/
│   ├── en/<rubric>/*.json     # English posts, one file per post
│   └── hi/<rubric>/*.json     # Hindi posts
│       rubric folders: macro, btc-setup, education, psychology, checklist,
│                        realresults (P&L / rubric key "pnl"), teardown
├── assets/
│   └── pnl/                   # P&L / Teardown screenshots referenced by photo posts'
│                              # `image` field. .gitkeep tracked. SEE §7 privacy warning.
├── schedule.json              # weekly grid (rubric × slot × day), per-channel timezone
├── state/
│   └── posted-log.json        # idempotency log — committed back by the Action
├── scripts/
│   └── set-secrets.sh         # reads token from local .env.local → gh secret set (no echo)
├── src/
│   ├── config.js              # channels, disclaimers (localized constants), banned lexicon, rules
│   ├── schedule.json access   # (schedule.json lives at repo root)
│   ├── time.js                # timezone-aware local time (Intl, zero-dep)
│   ├── posts.js               # post loader + selection
│   ├── compliance.js          # HARD gate: banned terms, placeholders, Bitunix, disclaimer
│   ├── render.js              # community-link resolution + disclaimer injection + HTML escape
│   ├── telegram.js            # sendMessage via native fetch
│   ├── state.js               # posted-log read/write, caps, idempotency
│   ├── publish.js             # MAIN scheduler entrypoint (run every 30 min)
│   └── check.js               # standalone compliance linter (npm run lint:posts)
├── .env.example               # copy to .env for local testing (never commit .env)
├── .gitignore
└── package.json               # type:module, scripts, no deps
```

---

## 2. How the scheduler + gate work

`src/publish.js` runs every 30 minutes (GitHub Actions cron). For **each channel**:

1. Compute the channel's **local time** (its own timezone) — weekday + minutes-of-day.
2. Look up `schedule.json` grid for that weekday; keep only entries whose **slot window**
   contains the current local time (`A` = 09:00–10:00, `B` = 18:00–19:30).
3. **Quiet-hours hard block** — nothing sends between 22:00 and 08:00 local.
4. **Daily cap** — ≤ 2 posts per channel per day. **Slot idempotency** — if that slot
   was already posted today (per `state/posted-log.json`), skip.
5. **Pick** a `ready:true` post for that rubric+slot not already in the posted log.
   If none → skip cleanly (no error). Draft/market posts stay unsent.
6. **CTA cadence** — ≤ 1 CTA/day, never two CTA posts back-to-back.
7. **Render** — resolve `{{COMMUNITY}}` (drop the line if `COMMUNITY_LINK` is empty),
   inject the localized risk disclaimer if missing.
8. **HARD compliance gate** on the final text (`src/compliance.js`):
   - **Banned terms** (EN always + Hindi lexicon for Hindi posts): profit / returns /
     get rich / guaranteed / double / earn / moon / risk-free / etc. (and Hindi
     equivalents मुनाफ़ा / गारंटी / दोगुना / कमाओ / रिटर्न / "वादा+income" …).
   - **Placeholder validator** — any unfilled `[...]` block blocks the send.
   - **Bitunix** never described as "licensed"/"regulated".
   - **Disclaimer present** (auto-injected, double-checked).
   Any violation → **blocked + warning logged**, post is NOT sent.
9. **Send.** Text post → Telegram `sendMessage`. **Photo post** (the post has an `image`
   field — P&L `#RealResults`, Teardown `#LessonLearned`) → `sendPhoto`: the local
   screenshot is uploaded as multipart/form-data with the rendered text as the **caption**
   (`parse_mode=HTML`, caption HTML-escaped exactly like a text body). The caption first
   passes the **same** gate in step 8 (no relaxation for photos); it is also checked against
   Telegram's **~1024-char caption limit** and the image file must exist on disk — either
   failure blocks the send. Then record in `state/posted-log.json` (photo posts count toward
   the daily cap / CTA cadence / slot idempotency **identically** to text posts; the record
   carries a `photo:true` flag for audit). The Action commits the log back → re-runs never
   duplicate.

Skips are normal and exit 0. The job only fails (non-zero) on unexpected runtime errors.

### Local testing

```bash
cp .env.example .env          # put TELEGRAM_BOT_TOKEN in it (local only)
npm run lint:posts            # compliance-lint every post
npm run dry-run               # resolve + gate, print decisions, send nothing

# Test a specific moment (no real send):
NOW_OVERRIDE="2026-06-30T13:00:00Z" npm run dry-run   # = Hindi 18:30 Tue slot B
```

---

## 3. Seeded content

Per channel (EN + HI), as of launch:

| Post | Rubric | Slot | ready? | Notes |
|------|--------|------|--------|-------|
| Weekly Macro Brief | macro (P1) | A | **draft** | market-dependent (live BTC price / levels / macro event) — placeholders filled day-of |
| BTC Technical Breakdown | btc-setup (P2) | A | **draft** | market-dependent (price, support/resistance, invalidation) |
| Funding Rate | education (P3) | – | **ready** | evergreen, slot-agnostic; carries the community CTA |
| Most People Lose | psychology (P4) | – | **ready** | evergreen pure-value |
| Before You Trade | checklist (P5) | – | **ready** | evergreen pure-value |
| **5× P&L screenshots** | pnl / `#RealResults` (P6) | – (slot-agnostic) | **ready** | **photo posts** (`assets/pnl/*.png`, balances scrubbed). b2-long, ban-long, ban-short, eth-long, skr-short. Drip ~1/day the first week — see §3a. |

Per channel: **8 ready** (3 evergreen + 5 P&L) + **2 draft** (macro, btc-setup). 20 files total.
Drafts are skipped by the scheduler until filled and flipped to `ready:true`. Empty rubrics /
future-locale channels (pt/vi/es/tr — **not yet configured**, see §6) skip cleanly.

### 3a. First-week P&L drip cadence

The 5 seed P&L posts must go out **~1/day for the first week**, not 1/week. Mechanism
(in `schedule.json` → `seedPnl`, fully reversible):

- The normal **weekly grid** fires the **first** P&L on **Fri 2026-06-26** in its natural
  evening slot **B** (18:00–19:30 local).
- For the next four channel-local dates — **Sat 06-27 → Tue 06-30** — `seedPnl` injects a P&L
  post in a **dedicated seed slot `S`** (19:30–20:30 local). Slot `S` is a separate id from
  the grid's A/B, so the seed P&L never collides with or is suppressed by a normal evening
  post (e.g. Mon psychology-B, Tue education-B both still go out; the P&L rides slot S).
- Net result: **5 distinct P&L over Fri–Tue, one per day**, each as `sendPhoto`. After
  2026-06-30 the `seedPnl.dates` are all in the past → the block is inert and **P&L reverts
  to the normal weekly Friday-B slot automatically**. No code change needed to wind it down.
- To stop the drip early: set `schedule.json` → `seedPnl.enabled` to `false` (or delete the block).

---

## 4. FINAL STEPS FOR THE OWNER (one-time setup)

Run from the repo folder (`C:\dev\lifechange-crypto-publisher`) with `gh` authenticated
(`gh auth login`). On Windows use **Git Bash** for the `bash` script.

**(a) Create the private repo and push:**

```bash
git add .
git commit -m "init: Lifechange Crypto publisher (schedule + compliance gate + 5 starter posts)"
gh repo create dolginov1973-ux/lifechange-crypto-publisher --private --source=. --remote=origin --push
```

**(b) Set the bot token secret** (reads the value from your existing
`lc-research-bot\.env.local` — never printed, never committed):

```bash
bash scripts/set-secrets.sh
```

Or manually (paste the token when prompted, value hidden):

```bash
gh secret set TELEGRAM_BOT_TOKEN --repo dolginov1973-ux/lifechange-crypto-publisher
```

**(c) (Optional) Set the community link** so CTA posts include it
(if unset, CTA community lines are simply omitted — the literal `[community link]`
is never published):

```bash
gh secret set COMMUNITY_LINK --repo dolginov1973-ux/lifechange-crypto-publisher
# then paste e.g. https://t.me/your_community
```

**(d) Enable Actions:** GitHub repo → **Actions** tab → enable workflows. The
`Scheduled Publisher` cron then runs every 30 minutes. Test it safely first via
**Actions → Scheduled Publisher → Run workflow → dry_run: true**.

> Cron note: GitHub's scheduled cron can be delayed a few minutes under load — the
> 30-minute cadence + slot windows (60 / 90 min wide) absorb that. Slot idempotency
> prevents double-posting if two runs land in the same window.

### 4a. 🔴 LIVE GATE — the publisher will NOT post for real until you flip it

The send path is gated by a repo **variable** `LIVE`. It is **unset by default**, which
forces the publisher into **DRY mode**: even with the cron enabled and the token secret set,
every run only **logs its decisions and sends nothing** (and writes no state). This is the
intended safety state for go-live prep — you can enable Actions, watch the cron tick, confirm
the right posts/slots are chosen, all with **zero real messages**.

**Go live (one command):**

```bash
gh variable set LIVE --repo dolginov1973-ux/lifechange-crypto-publisher --body true
```

**Revert to dry / pause live:**

```bash
gh variable set LIVE --repo dolginov1973-ux/lifechange-crypto-publisher --body false
# or remove it entirely:
gh variable delete LIVE --repo dolginov1973-ux/lifechange-crypto-publisher
```

The next scheduled run after `LIVE=true` is the first one that can actually send. (`DRY_RUN`
from a manual dispatch, or `--dry-run` locally, still forces dry mode regardless of `LIVE`.)

---

## 5. Adding posts & filling placeholders

### Add a new post

Create a JSON file under `content/<channel>/<rubric>/<NNN>-<slug>.json`:

```json
{
  "id": "en-checklist-002",
  "channel": "en",
  "rubric": "checklist",
  "slot": "A",
  "lang": "en",
  "ready": false,
  "cta": false,
  "title": "Before you trade",
  "body": "✅ Before you trade\n…\n#BeforeYouTrade"
}
```

- `id` must be **globally unique and stable** (used for idempotency). Convention:
  `<channel>-<rubric>-NNN`.
- `cta:true` only if the body contains a `{{COMMUNITY}}` line. The scheduler enforces
  ≤1 CTA/day and no two CTA posts in a row.
- Do **not** put the risk disclaimer in `body` — it's injected automatically per channel.
  (You may include it; the injector won't duplicate it.)
- CTA community link: write `… 👉 {{COMMUNITY}}` — never a literal `[community link]`.
- Run `npm run lint:posts` before committing. Ready posts that fail the gate (placeholders,
  banned terms, missing disclaimer) will fail CI and never publish.

### Photo posts (P&L `#RealResults`, Teardown `#LessonLearned`)

A photo post is a normal post with one extra field — `image` — pointing to a **repo-relative**
screenshot path. When present, the publisher sends it via Telegram **`sendPhoto`** (the
screenshot uploaded as a file) and the `body` becomes the photo **caption**. Without `image`,
the same post would go out as plain text. See the seeded P&L posts under
`content/en/realresults/pnl-*.json` (and the `hi` twins) for working examples.

```json
{
  "id": "en-pnl-001",
  "channel": "en",
  "rubric": "pnl",
  "slot": "B",
  "lang": "en",
  "ready": false,
  "cta": true,
  "title": "Verified result — week recap",
  "image": "assets/pnl/en-pnl-001.png",
  "body": "📊 Real result — what actually happened\n\nThe idea: [idea]\nThe invalidation: [stop]\n…\n#RealResults"
}
```

- `image` is **repo-relative** (e.g. `assets/pnl/<file>.png`). Absolute paths and `../`
  escapes are rejected; the file must exist in the repo or the send is **blocked**.
- The caption goes through the **exact same compliance gate** as any text body
  (banned terms, unfilled `[...]`, Bitunix-not-licensed, injected disclaimer). Having an
  image never weakens the gate.
- **Caption limit:** Telegram caps photo captions at **~1024 characters**. `npm run lint:posts`
  flags a ready photo post whose caption exceeds this (it would be rejected by the API),
  and the publisher blocks it at send time. Keep P&L/Teardown captions short — the screenshot
  carries the detail.
- Cap / CTA cadence / quiet-hours / slot idempotency apply **identically** to photo posts;
  a photo post is just another entry in the daily cap.

> 🔒 **PRIVACY — read before committing any screenshot (content strategy §1.3).**
> P&L screenshots can leak sensitive data. **Before** you add a screenshot to `assets/pnl/`,
> the image must show **only the trade itself** — crop out / blur:
> - the **account balance** and any equity / wallet totals,
> - **realized $ amounts** and lifetime totals,
> - account number, email, name, KYC or any other personal identifier.
>
> Once a screenshot is committed and pushed it is in git history **forever** — there is no
> clean "undo". Treat every file in `assets/pnl/` as public. When in doubt, re-crop, don't
> commit. (This is a human-review step; the linter cannot inspect image contents.)

### Fill placeholders before a slot (market posts)

Market posts (macro, BTC setup, P&L) ship as **drafts** with `[...]` blocks. The editor:

1. Open the file shortly before its slot.
2. Replace **every** `[...]` with the real value of the day (live BTC price, support/
   resistance, macro event + date, etc.). **Never invent numbers** — if a value isn't
   known, leave the post a draft; it simply won't publish.
3. **Photo posts (P&L / Teardown):** drop the screenshot at the `image` path
   (e.g. `assets/pnl/en-pnl-001.png`) — **after** cropping out balance / personal data
   (§5 privacy box). A photo post with a missing image is blocked at send.
4. Set `"ready": true`.
5. Commit & push (or use **Actions → Run workflow** to publish immediately if the slot is open).
6. The gate blocks publication while any `[...]` remains, while a photo post's image is
   missing, or while a caption exceeds ~1024 chars — this is the safety net.

After a market post is published once, either bump its `id` for the next cycle
(`en-macro-002`) or duplicate the file — the posted-log keys on `id`, so a fresh cycle
needs a fresh id.

---

## 6. Risks & limitations

- **Starter content < a full perpetual week.** The §1.2 grid wants ~10 posts/week per channel.
  At launch each channel has 3 evergreen (education / psychology / checklist) + 5 P&L photo
  posts ready, plus macro/btc-setup drafts that need daily fills. Teardown (P7) has **no**
  seeded post yet. The 5 P&L cover the first week's drip (§3a); after that, P&L needs fresh
  screenshots. Empty rubrics/slots skip cleanly.
- **All 7 locales are configured** (`CHANNELS` in `src/config.js`: en/hi/pt/vi/es/tr/id),
  each with `content/<lang>/…` folders and v2 starter posts. Per channel the 3 evergreen
  rubrics (#CryptoSchool / #MindOverMarket / #BeforeYouTrade) are `ready:true`; the 3
  market/template rubrics (#Signal / #MorningBriefing / #MonthlyResults) ship as drafts
  (`ready:false`) until an editor fills the `[..]` and flips them. **P&L (#RealResults) is
  EN+HI only** — the pt/vi/es/tr/id P&L localization is a follow-up. Banned-term lexicons
  exist per locale (EN list always runs + the channel's own list).
- **Photo posts need a committed screenshot.** A P&L / Teardown post with an `image` that
  isn't on disk is blocked at send. The screenshot is uploaded from the repo, so it lives
  in git history — **scrub balance / personal data before committing** (§5 privacy box).
  Caption length is also hard-capped at ~1024 chars by Telegram.
- **Market posts require a human editor** to fill `[...]` and flip `ready` before each
  slot. There is no live market-data feed (by design — no invented numbers).
- **Banned-term lexicon is heuristic.** It catches the §1.4/§1.5 list but is regex-based;
  human review (checklist items 4/6/7/9/10) still matters for tone, framing, Hindi
  cultural adaptation. Extend `BANNED_TERMS` in `src/config.js` as new phrasings appear.
- **Cron timing** is best-effort on GitHub's side; slot windows absorb minor delays but
  a long GitHub outage during a slot means that slot is missed (no catch-up replays).
- **Single bot token** gates both channels. Rotate via `gh secret set` if leaked; never
  commit it. The local `.env` is git-ignored.
- **No analytics / no edit-after-send.** This is a fire-and-forget publisher; engagement
  tracking and corrections are out of scope.
```
