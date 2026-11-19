# Scam Lens

An AI-assisted scam and phishing awareness checker for Indian users.

Scam Lens helps people review suspicious messages, screenshots, calls, and links before taking action. It explains possible manipulation tactics and suggests safer next steps — without replacing human judgement.

---

## Features

- **Text analysis** — Paste a suspicious SMS, WhatsApp message, or email. The app identifies possible scam tactics, extracts evidence phrases directly from your text, and suggests next steps.
- **Screenshot analysis** — Upload a screenshot. The app extracts visible text via OCR, then lets you review and edit the extracted text before running the analysis.
- **Voice recording analysis** — Record or upload a suspicious call. The app transcribes the audio (English, Hindi, or Hinglish), then lets you review the transcript before analyzing it. This feature transcribes speech; it does not detect cloned voices or verify the caller's identity.
- **Link inspection** — Submit a URL for structural analysis: HTTP vs HTTPS, raw IP addresses, punycode hostnames, embedded credentials, known URL-shortening domains, unusually long hostnames or URLs, many subdomain levels, and encoded characters in the hostname. No live website is visited and no reputation feed is queried.
- **Local history** — Explicitly save and re-read past analyses. All history is stored in your browser's localStorage — nothing is uploaded to a server.
- **Rescue Mode** — An AI-free checklist of immediate actions for people who have already been scammed. It runs in the browser with fixed, human-written steps (no AI call, no network lookup), and an incident summary you create stays in your browser. Steps are prioritised by urgency and cover money transfers, shared credentials, suspicious apps, and digital arrest threats. Each step that relies on an official source shows that source (I4C / NCTAU, RBI, CERT-In or PIB) and what it supports. Other advice is labelled as general safety advice.

### Supported inputs and size limits

| Input | Accepted | Limit |
|---|---|---|
| Text | Plain text in English, Hindi or Hinglish | 10,000 characters |
| Screenshot | JPEG, PNG or WebP | Up to 12 MB selected; the browser compresses it and the server accepts up to 6 MB |
| Audio | WebM, MP4/M4A, MP3, OGG, WAV, FLAC or MPGA, recorded or uploaded | 20 MB |
| Link | An HTTP or HTTPS URL | 2,000 characters |

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
| Tests | Node.js built-in test runner (`node:test`) |

---

## Architecture

```
Browser
  │
  │  HTTP  (all traffic same-origin)
  ▼
server.js  (Express)
  ├─ GET /                   → serves index.html with per-request CSP nonce
  ├─ POST /api/analyze       → text scam analysis (rate-limited)
  ├─ POST /api/analyze-image → screenshot OCR (rate-limited)
  ├─ POST /api/transcribe    → audio transcription (rate-limited)
  ├─ POST /api/check-link    → structural URL inspection (no network calls)
  └─ GET  /api/health        → liveness check
  
public/
  ├─ index.html   SPA shell with all tool UIs and Rescue Mode
  ├─ rescue.js    Deterministic Rescue Mode logic (no AI calls)
  ├─ style.css
  ├─ privacy.css
  └─ privacy.html
```

All AI content is inserted into the DOM as plain text (`textContent`), never as HTML, to prevent XSS. A Content Security Policy with a per-request nonce is applied to every HTML response.

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

> **Note:** Verify that the default model names are still available on Groq before deploying. Model availability changes over time.

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

This runs 77 tests across two files:

- **`tests/server.test.js`** (60 tests) — pure function tests for `validateAnalysis`, `inspectLink`, `hasImageSignature`, `hasAudioSignature`, `recoverExactQuote`, malformed-completion guards, and `analyzeText` and `extractImageText` (screenshot OCR) with injected mock clients (truncated, empty, malformed and invalid AI output). No network calls. No Groq API key required.
- **`tests/rescue.test.js`** (17 tests) — exhaustive scenario-combination tests for `getRescueSteps` (every non-empty combination of the four scenarios, in every selection order), plus checks on step content, helpline numbers and that the on-page source list matches the code. Runs entirely locally. These are not randomised property-based tests.

The test suite completes in under 10 seconds on first run after `npm install`.

---

## Benchmark

The `benchmark/` directory contains a 40-example synthetic evaluation dataset and a runner script.

```bash
npm run benchmark -- --split dev
```

**Important limitations:**
- All examples are synthetic and manually authored. Results are not a measure of real-world scam detection accuracy.
- The benchmark tests text analysis only. Screenshot OCR, audio transcription, URL inspection, and Rescue Mode are not evaluated.
- Do not run the benchmark without a configured `GROQ_API_KEY`. It makes real API calls and consumes quota.

See `benchmark/README.md` for full methodology and metric definitions.

---

## Security and privacy design

- **CSP with per-request nonce** — every HTML response carries a `Content-Security-Policy` header with a cryptographically random nonce, restricting inline script execution to the server-authorised script block.
- **File signature validation** — uploaded images and audio files are checked against their declared MIME types by inspecting magic bytes, not just file extensions.
- **Evidence quote validation** — every suspicious phrase returned by the AI must be found in the original submitted message (matched case-insensitively, ignoring differences in whitespace) or it is dropped before anything is shown to the user.
- **No server-side storage** — submitted messages, screenshots, and audio are processed and discarded. No application database is used.
- **Local history only** — saved reports are stored in the browser's `localStorage` under the key `scamLensHistoryV3`. They are never uploaded.
- **In-memory rate limiting** — each API route has an independent in-memory rate limiter. On a single-instance deployment this limits abuse per IP. Rate limit counters reset on server restart; a production multi-instance deployment should use a shared store.
- **Incomplete AI replies are rejected** — if the model's reply for text analysis or screenshot OCR is cut off (`finish_reason: length`), the app shows an error instead of a partial result. A failed text analysis is never shown as "Safe". Audio transcription has no such check.
- **API key** — the Groq API key is read from environment variables and is not written to logs or returned in responses. Server error logs for failed requests record error codes or provider error details, not the submitted content.

---

## Known limitations

- Risk classification is probabilistic, not deterministic. Results are decision support, not proof of fraud or authenticity.
- The link inspector checks URL structure only. It does not visit websites or query live malicious-domain databases.
- Voice analysis transcribes speech. It does not detect voice cloning, verify caller identity, or authenticate phone numbers.
- OCR accuracy depends on image quality, language, and font. Always review extracted text before analyzing it.
- In-memory rate limiters reset on server restart and do not work across multiple server instances.
- The benchmark uses synthetic examples. A score on the development set does not indicate real-world performance.

---

## Emergency guidance for Indian users

If you have already transferred money or shared credentials:

1. **Call your bank immediately** — use the number on your card or in the official banking app.
2. **Call 1930** — India's national cyber financial fraud helpline.
3. **Report at [cybercrime.gov.in](https://cybercrime.gov.in/)** — the National Cyber Crime Reporting Portal.

For immediate physical danger, call **112**.

If someone threatens you with "digital arrest": the I4C / NCTAU advisory of 6 March 2025 says there is no concept of Digital Arrest under Indian law, and the Ministry of Home Affairs (PIB, 27 October 2024) says no government agency conducts investigations over phone or video calls. Verify the claim yourself with your nearest police station, using contact details you find independently.

---

## How Kiro was used

This project uses [Kiro](https://kiro.dev) for spec-driven development. The `.kiro/specs/stability-security/` directory contains the full specification, design document, and task execution history for a post-development improvement sprint covering:

- Bug fixes: duplicate image event listeners (BUG-01) and duplicate history event listeners (BUG-02).
- Security hardening: Content Security Policy with per-request nonces, file signature validation, API key security.
- Quality: automated unit tests for the server-side pure functions and exhaustive scenario-combination tests for Rescue Mode logic.
- Post-audit improvements (this release): rescue tests added to `npm test`, source attribution for Rescue Mode, finish_reason handling, README, licence, and Kiro steering documentation.

Other Kiro files in the repository:

- **Steering files** in `.kiro/steering/` (`product.md`, `tech-stack.md`, `structure.md`) describe the product, stack and project layout for the agent.
- **Hook** `.kiro/hooks/run-tests-on-save.json` is a `PostFileSave` hook that runs `npm test` (offline, no Groq key needed). Per Kiro's documentation it fires when the agent saves a matching file (`server.js`, `rescue.js`, `index.html` or a `*.test.js` file). Its execution inside a Kiro session could not be independently verified, so treat it as configured but unconfirmed (Task 7.4 is deferred).

Kiro's spec-driven workflow was used to write requirements, design decisions, implementation tasks, and verification steps. The `tasks.meta.json` file records the actual Kiro session execution history for each sub-task.

---

## Hackathon category: Frankenstein

Scam Lens stitches together four distinct techniques (three AI models and one deterministic parser) into one safety tool:

1. **LLM classification** (text analysis) — a chat model reasons about manipulation tactics in unstructured text.
2. **Vision OCR** (screenshot analysis) — a vision model extracts text from images.
3. **Speech transcription** (voice analysis) — a Whisper model converts audio to text.
4. **Deterministic structural parsing** (link inspection) — pure algorithmic URL analysis with no AI.

These four modalities were never designed to work together. Combining them into one coherent threat-assessment workflow — with a shared validation layer, consistent evidence formatting, and a unified UI — is the Frankenstein element.

---

## Licence
MIT — see [LICENSE](LICENSE).