---
inclusion: always
---

# Scam Lens — Technical Stack

## Runtime

- **Node.js ≥ 22** (uses `node:test`, `node:crypto`, `node:net`, `node:fs`, `node:path`)
- **No build step, no bundler, no TypeScript compilation**

## Server

- **Express 5** (`express@^5.3.0`) — single-process HTTP server
- Serves a single-page HTML application from `public/`
- All four AI-backed routes are in `server.js`
- In-memory rate limiters per route (no Redis required for single-instance deployment)

## AI integration

- **Groq** as the AI provider, accessed via the **OpenAI-compatible API**
- SDK: `openai@^7.55.0` — the same SDK used for OpenAI, pointed at `https://api.groq.com/openai/v1`
- Three model roles, each configurable via environment variables:
  - `GROQ_MODEL` — chat model for text classification
  - `GROQ_VISION_MODEL` — vision model for screenshot OCR
  - `GROQ_TRANSCRIPTION_MODEL` — Whisper model for audio transcription
- The SDK performs 2 automatic retries on 429/5xx errors

## Frontend

- Vanilla HTML, CSS, JavaScript — no framework
- Single `index.html` with one inline `<script>` block (nonce-protected)
- `rescue.js` is a UMD module loaded via `<script src="/rescue.js">` — works in both browser and Node.js
- No external CDN dependencies

## Security

- Content Security Policy with per-request cryptographic nonce (server-side injection)
- File magic-byte validation for all uploads
- All AI content inserted as `textContent`, never `innerHTML`
- `express.static` with `{ index: false }` — explicit routes handle `/` and `/index.html`

## Testing

- **Node.js built-in test runner** (`node --test`) — zero extra dependencies
- `tests/server.test.js` — 60 unit tests for pure server-side functions and `analyzeText` / `extractImageText` with mock clients
- `tests/rescue.test.js` — 17 tests for Rescue Mode logic: exhaustive scenario combinations and source labels (not randomised property-based tests)
- Run with: `npm test`
- No network calls during tests; no Groq API key required

## Environment variables

Required:
- `GROQ_API_KEY` — Groq API key

Optional (defaults in parentheses):
- `PORT` (3000)
- `GROQ_MODEL` (openai/gpt-oss-120b)
- `GROQ_VISION_MODEL` (qwen/qwen3.8-27b)
- `GROQ_TRANSCRIPTION_MODEL` (whisper-large-v3)
- `TRUST_PROXY` — set to `1` only when behind a trusted reverse proxy
- `NODE_ENV` — `production` enables HSTS; `test` disables `app.listen`

## Dependencies (`package.json`)

```json
{
  "dependencies": {
    "express": "^5.3.0",
    "dotenv": "^18.0.10",
    "openai": "^7.55.0"
  }
}
```

No devDependencies — the built-in test runner requires none.
