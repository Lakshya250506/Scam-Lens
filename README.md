# Scam Lens

An AI-assisted scam and phishing awareness checker for Indian users.

- **Live demo:** https://scam-lens-d41l.onrender.com
- **Repository:** https://github.com/Lakshya250506/Scam-Lens

The demo runs on a free hosting plan, so the first load after it has been idle can take up to a minute.

Scam Lens helps people review suspicious messages, screenshots, calls and links before they act. It explains possible manipulation tactics and suggests safer next steps. Results are decision support, not proof, and do not replace your own judgement.

---

## Features

- **Text analysis**: paste a suspicious SMS, WhatsApp message or email. The app identifies possible scam tactics, quotes the evidence phrases from your own text, and suggests next steps.
- **Screenshot analysis**: upload a screenshot. The app extracts the visible text, then lets you review and edit it before any analysis.
- **Voice recording analysis**: record or upload a suspicious call. The app transcribes it (English, Hindi or Hinglish) and lets you review the transcript before analysis. It transcribes speech only. It does not detect cloned voices or verify who is calling.
- **Link inspection**: structural checks on a URL, covering:
  - HTTP vs HTTPS, raw IP addresses and punycode hostnames.
  - Embedded credentials and known URL shorteners.
  - Very long hostnames or URLs, many subdomain levels, and encoded characters in the hostname.
  - A small **brand lookalike check**. An address that uses a listed Indian bank, payment app or public service name (for example SBI, HDFC, ICICI, Paytm, IRCTC) but is not that organisation's own domain is flagged "High caution" when it also has a warning sign: a word like "login" or "kyc", an uncommon ending like `.xyz`, or the brand in a subdomain. An uncommon ending plus a word like "login", with no brand, gives a weaker "Review carefully".
  - Addresses inside `bank.in` and `fin.in` are not treated as lookalikes.

  No website is visited and no reputation service is queried. See Known limitations for what the lookalike check misses.
- **Local history**: save and re-read past analyses. History is stored only in your browser's `localStorage`.
- **Rescue Mode**: an AI-free checklist for people who have already been scammed.
  - It covers money transfers, shared credentials, suspicious apps and "digital arrest" threats, with steps ordered by urgency.
  - It runs in the browser with fixed, human-written steps, and the incident summary you create stays in your browser.
  - Steps backed by an official source (I4C / NCTAU, RBI, CERT-In or PIB) show that source and what it supports. Other advice is labelled as general safety advice.
- **Accessibility improvements**: keyboard and screen-reader support, described in [Accessibility](#accessibility).

### Supported inputs and size limits

| Input | Accepted | Limit |
|---|---|---|
| Text | Plain text in English, Hindi or Hinglish | 10,000 characters |
| Screenshot | JPEG, PNG or WebP | Up to 12 MB selected; the browser compresses it and the server accepts up to 6 MB |
| Audio | WebM, MP4/M4A, MP3, OGG, WAV, FLAC or MPGA, recorded or uploaded | 20 MB |
| Link | An HTTP or HTTPS URL | 2,000 characters |

---

## How it keeps results trustworthy

The AI model is checked by deterministic code before anything is shown.

- **Quote verification**: every suspicious phrase and evidence quote the model returns must be found in your original message (`recoverExactQuote`), ignoring case and spacing. Anything that is not found is dropped.
- **No "Highly Dangerous" without evidence**: if no evidence quote survives verification, a "Highly Dangerous" result is lowered to "Suspicious".
- **Cut-off replies are rejected**: if the model's text-analysis or screenshot reply is cut off (`finish_reason: length`), the app shows an error, not a partial result. A failed text analysis is never shown as "Safe". Audio transcription has no such check.
- **File-signature checks**: uploaded images and audio are checked by their first bytes, not only by file type or extension.
- **Prompt delimiter**: your message is placed between `<MESSAGE>` tags for the model, and any such tags inside your message are neutralised first. Evidence is still checked against your original text.
- **De-duplicated next steps**: repeated advice (for example two ways of saying "do not share the OTP") is shown once, and the list has at most 6 steps.
- **Safe page rendering**: user and AI text is inserted with `textContent`, never as HTML. A Content Security Policy with a per-request nonce allows only the page's own script.
- **No server-side storage**: submitted messages, screenshots and audio are processed and not stored. There is no application database.

---

## Technology stack

| Layer | Technology |
|---|---|
| Runtime | Node.js ≥ 22 |
| Server | Express 5 |
| AI provider | Groq (OpenAI-compatible API) |
| SDK | openai v7+ |
| Text / analysis model | Configured via `GROQ_MODEL` env var |
| Vision / OCR model | Configured via `GROQ_VISION_MODEL` env var |
| Transcription model | Configured via `GROQ_TRANSCRIPTION_MODEL` env var |
| Frontend | Vanilla HTML, CSS, JavaScript (no framework, no bundler) |
| Tests | Node.js built-in test runner (`node:test`), plus `fast-check` (development dependency) for property-based tests |

---

## Architecture

```
Browser
  │
  │  HTTP  (all traffic same-origin)
  ▼
server.js  (Express)
  ├─ GET  /, /index.html     → index.html with a per-request CSP nonce
  ├─ POST /api/analyze       → text analysis (rate-limited)
  ├─ POST /api/analyze-image → screenshot text extraction (rate-limited)
  ├─ POST /api/transcribe    → audio transcription (rate-limited)
  ├─ POST /api/check-link    → structural URL inspection (rate-limited, no network calls)
  └─ GET  /api/health        → { ok, aiConfigured } (booleans only)
```

```
public/       index.html (all tools, Rescue Mode, History), rescue.js (Rescue Mode logic,
              no AI calls), style.css, privacy.html, privacy.css, robots.txt
tests/        server, rescue, a11y, properties and secrets tests
scripts/      check-secrets.js (secret scanner)
benchmark/    dev.json, run.js, README.md (holdout set is gitignored)
docs/         KIRO_JOURNEY.md (record of how Kiro was used)
.kiro/        specs, steering files and hooks
```

---

## Installation

**Prerequisites:** Node.js 22 or later.

```bash
# 1. Install dependencies
npm install

# 2. Copy the environment template
cp .env.example .env
```

---

## Environment variables

Edit `.env` with your values. See `.env.example` for all variables.

| Variable | Required | Description |
|---|---|---|
| `GROQ_API_KEY` | Yes | Your Groq API key from [console.groq.com](https://console.groq.com) |
| `GROQ_MODEL` | No | Chat model for text analysis. Default: `openai/gpt-oss-120b` |
| `GROQ_VISION_MODEL` | No | Vision model for screenshot OCR. Default: `qwen/qwen3.8-27b` |
| `GROQ_TRANSCRIPTION_MODEL` | No | Transcription model. Default: `whisper-large-v3` |
| `PORT` | No | Server port. Default: `3000` |
| `TRUST_PROXY` | No | Set to `1` only when running behind a trusted reverse proxy (e.g. Render, Railway). Never set this on a server with a public IP. |
| `NODE_ENV` | No | Set to `production` to enable HSTS. Set to `test` to disable the HTTP server for unit tests. |

> **Note:** Check that the default model names are still available on Groq before deploying. Model availability changes over time.

---

## Running the application

```bash
npm start
```

Open [http://localhost:3000](http://localhost:3000).

---

## Running the tests

```bash
npm test
```

This runs 157 tests across five files, offline, with no Groq API key:

| File | Tests | What it checks |
|---|---|---|
| `tests/server.test.js` | 98 | `validateAnalysis`, `inspectLink` and the brand lookalike check, upload signature checks, `recoverExactQuote`, and `analyzeText` and `extractImageText` with mock clients (truncated, empty, malformed and invalid replies). Also the prompt delimiter, Hindi and Hinglish "money already sent" phrases, plain upload error messages, the health response and de-duplicated next steps. |
| `tests/rescue.test.js` | 17 | Every non-empty combination of the four Rescue Mode situations, in every selection order, plus step content, helpline numbers and the on-page source list. These are exhaustive scenario tests, not randomised tests. |
| `tests/a11y.test.js` | 29 | Static accessibility checks that read `index.html`, `privacy.html` and `style.css` as text. They do not run a browser or a screen reader. |
| `tests/properties.test.js` | 5 | Property-based tests with [fast-check](https://github.com/dubzzz/fast-check) and a fixed seed, 20261122, shown in each test name. They generate many inputs and check that kept evidence quotes always appear in the original message, that "Highly Dangerous" always has evidence, that link results are well-formed and repeatable, and that official domains and obvious brand lookalikes are treated consistently. |
| `tests/secrets.test.js` | 8 | The secret scanner, using fake key-like strings built at run time. |

### Secret check

```bash
npm run check:secrets
```

`scripts/check-secrets.js` scans the project's text files, skipping `node_modules`, `.git`, `.env` and `benchmark/results`. It uses no dependencies. It looks for strings that look like API keys and for a real `GROQ_API_KEY=` value outside `.env`, and checks that `.gitignore` lists `.env`. It prints only the file and line number, never the value, and exits non-zero on a finding.

---

## Benchmark

The `benchmark/` folder has a runner and two sets of synthetic, manually written examples:

- **Development set** (`dev.json`, 40 examples, committed). The author's run scored 100% on it, but these examples are synthetic and fairly easy.
- **Holdout set** (`holdout.private.json`, 80 examples, gitignored). The author and AI assistants saw it during development, so it is a regression set, not a blind test.

No accuracy claim is made, and none of these results measures real-world scam detection.

```bash
# Development set
npm run benchmark -- --split dev

# Holdout set (only when tuning is frozen)
npm run benchmark -- --split test --confirm-holdout
```

Limitations:

- The benchmark tests text analysis only. Screenshot OCR, audio transcription, link inspection and Rescue Mode are not evaluated.
- It makes real API calls and uses quota, so it needs a configured `GROQ_API_KEY`.

See `benchmark/README.md` for the method and metric definitions.

---

## Security and privacy design

- **Content Security Policy**: every response has a CSP header. HTML responses carry a cryptographically random per-request nonce, so only the server-authorised scripts run. Responses also set `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` and `Permissions-Policy`, plus HSTS in production.
- **File-signature checks**: images and audio are checked against their declared type by their first bytes.
- **No server-side storage**: submitted content is processed and not stored. There is no application database.
- **Local history only**: saved reports stay in the browser's `localStorage` under `scamLensHistoryV3` and are never uploaded. Rescue Mode incident summaries are never saved or sent.
- **In-memory rate limiting**: each API route has its own per-IP limit over 15 minutes (25 text analyses, 8 screenshots, 5 audio files, 25 link checks). Counters reset when the server restarts and are not shared between server instances.
- **Plain error messages**: failed screenshot or audio processing returns a short plain message ("service busy", "could not read this file", "try again"). Technical details are logged on the server only.
- **API key**: the Groq key is read from environment variables. It is never written to logs or returned in responses, and `/api/health` reports only whether a key is set. Server error logs record error codes or provider error details, not the submitted content.
- **Secret scanning**: `npm run check:secrets` checks the project for key-like strings before code is shared.

---

## Accessibility

Keyboard and screen-reader support was improved in this version. It has not been formally audited, and Scam Lens does not claim to meet any accessibility standard.

What was improved:

- A "Skip to main content" link, and one header, navigation, main and footer area on each page.
- When you open a tool, the results, Rescue Mode or History, keyboard focus moves to the page heading and the browser tab title changes.
- While a check is running, the button is marked busy and "Analysing, please wait" is announced. Errors are announced as alerts and linked to the field they belong to.
- Screen readers announce "Copied", "Saved locally", "Deleted", Rescue Mode checklist updates, and when a recording starts or stops. The recording timer is not read out every second.
- Every form field has a label, the character counter is linked to the message box, and the Rescue Mode situations are grouped under one heading.
- Clearer keyboard focus outlines, darker secondary text and field borders, larger tap areas on narrow screens, less motion when your system asks for it, and a note for screen readers on links that open in a new tab.

Known limitations:

- No formal accessibility audit has been done.
- It has not been tested with every screen reader, browser or phone. Behaviour differs between them, for example whether the "Opens in a new tab" note is read.
- Layout at very narrow widths and at 200% zoom, focus outlines and tap-area sizes were checked by reading the code, not yet in a browser.
- The Rescue Mode situation checkboxes are 24 px wide. The whole row, at least 44 px tall on narrow screens, is the tap area.
- Disabled buttons stay faded and are below the usual contrast minimum.
- The automated checks in `tests/a11y.test.js` read the page text and styles. They do not replace testing with real assistive technology.

---

## Known limitations

- Risk classification is probabilistic. Results are decision support, not proof of fraud or of authenticity.
- Link inspection checks URL structure only. It does not visit websites or query malicious-domain databases.
- The brand lookalike check:
  - **What it reads:** a small list of brands, matching whole words in the hostname only (not the path). It finds the main domain with a simplified rule that is wrong for some country domains.
  - **What it misses:** misspellings (for example "sbbi"), lookalike characters, and fake sites that use no listed brand.
  - **False alarms:** a real domain missing from the list can be flagged if its address also has a word like "login".
  - **Unverified assumptions:** the official-domain list awaits the author's verification, and so does the treatment of `bank.in` and `fin.in`. Addresses there are not flagged, on the assumption that only approved entities can register in them.
  - **"axis":** the word counts as a brand only when "bank" is also in the address.
  - A clean result is not proof that a link is safe.
- Voice analysis transcribes speech. It does not detect voice cloning, verify caller identity or authenticate phone numbers.
- OCR quality depends on the image, language and font. Always review extracted text before analysing it.
- In-memory rate limits reset on server restart and do not work across multiple server instances.
- The benchmark uses synthetic examples, and the holdout set is not blind (see [Benchmark](#benchmark)).

---

## Emergency guidance for Indian users

If you have already transferred money or shared credentials:

1. **Contact your bank immediately**: use the number on your card or in the official banking app, and ask for an acknowledgement of your complaint.
2. **Call 1930**: India's national cyber financial fraud helpline.
3. **Report at [cybercrime.gov.in](https://cybercrime.gov.in/)**: the National Cyber Crime Reporting Portal.

For immediate physical danger, call **112**.

If someone threatens you with "digital arrest":
- The I4C / NCTAU advisory of 6 March 2025 says there is no concept of Digital Arrest under Indian law.
- The Ministry of Home Affairs (PIB, 27 October 2024) says no government agency conducts investigations over phone or video calls.

Verify the claim yourself with your nearest police station, using contact details you find independently.

---

## Development timeline

Development of Scam Lens began on 10 November 2026, locally, before this GitHub repository existed. The repository was created later, so commit dates show when the code was uploaded, not when it was written.

## Tools and AI assistance

- **Kiro**: spec-driven development, steering files and two hooks (see below).
- **ChatGPT and Claude**: used outside Kiro for review, test and benchmark design, prompt drafting and documentation drafting.
- The author reviewed and ran all code and content. Some edits were made by hand.
- **Runtime services**: Groq-hosted models for text analysis and screenshot OCR, and Whisper for speech transcription.
- **Libraries**: Express, the openai SDK and dotenv. `fast-check` is a development dependency only.

---

## How Kiro was used

**Specs** in `.kiro/specs/`, each with `requirements.md`, `design.md` and `tasks.md`:

| Spec | Purpose |
|---|---|
| `stability-security` | Bug fixes, CSP, API key handling, automated tests and post-audit fixes (including Rescue Mode source attribution) |
| `link-lookalike` | The deterministic brand lookalike check in link inspection |
| `accessibility` | Keyboard and screen-reader improvements, starting from an audit table |
| `hardening-and-evidence` | Prompt-delimiter and error-message hardening, property-based tests, the secret scanner, and these Kiro records |

**Steering files** in `.kiro/steering/`:

| File | Inclusion |
|---|---|
| `product.md`, `tech-stack.md`, `structure.md`, `security-and-privacy.md` | `always` |
| `accessibility.md` | `fileMatch` for `public/**/*` |

**Hooks** in `.kiro/hooks/`, both triggered on `PostFileSave`:

- `run-tests-on-save.json` runs `npm test`. It was seen firing repeatedly during the link-lookalike and accessibility sessions.
- `check-secrets-on-save.json` ("Check for secrets after file saves") runs `node scripts/check-secrets.js`. It was seen triggering during the Phase A audit session.

**Where Kiro surprised us:**

- While adding the brand-lookalike check, Kiro noticed that one instruction contradicted an existing test (`axis-login.xyz`). It changed only that one test address, recorded the exception in the spec, and told the author.
- The accessibility spec began with an audit table and found problems nobody had asked about: the footer inside `main`, a skipped heading level, and focus outlines that were too faint.
- It computed real colour-contrast ratios from the CSS and changed only the failing colours.
- When a file changed unexpectedly, it stopped and asked instead of overwriting it.
- It found two mistakes in its own new tests on a full run and fixed them.

**Done outside Kiro:** review, test and benchmark design, prompt drafting and documentation drafting with ChatGPT and Claude, and some manual edits. A fuller record is in [docs/KIRO_JOURNEY.md](docs/KIRO_JOURNEY.md).

---

## SafeSpace Hacks 2026

- **Intended user:** everyday Indian internet users, for example a parent who gets a "digital arrest" call.
- **Risk:** pressure to pay money or share codes before they can check.
- **Practical improvement:** an evidence-based explanation of the tactics, using quotes from their own message, plus an AI-free Rescue Mode with prioritised steps for people who have already acted.
- **Safer outcome:** the user does not send the code and checks with their bank, or stops, does not transfer money, and calls 1930.
- **Honest limitation:** results are decision support, not proof. The benchmark is small and synthetic, so no accuracy claim is made.

## Kiroween 2026 category: Frankenstein

Scam Lens is an LLM stitched to deterministic verifiers: quote checking, file-signature checks, URL parsing and an AI-free Rescue Mode. The model reads messy text, screenshots and speech. Plain code then decides what it may show: dropping unverified quotes, rejecting cut-off replies and lowering unsupported "Highly Dangerous" results.

---

## Licence

MIT. See [LICENSE](LICENSE).
