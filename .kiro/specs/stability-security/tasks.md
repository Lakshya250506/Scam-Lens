# Implementation Plan: Scam Lens – Stability and Security Improvements

## Overview

Six tasks fix the functional bugs and security gaps identified in the architecture audit. Tasks 1 and 2 edit `public/index.html` only. Task 3 is independent. Task 4 depends on Task 1 (Block A must be removed before the nonce placeholder is added). Task 5 depends on Tasks 1–4 (server.js must be in its final state before the test guard and exports are added). Task 6 covers post-audit fixes identified in the independent audit of November 2026 and depends on Tasks 1–5. Task 7 (seven tasks in total) lists the open follow-ups from that audit, most of them manual owner actions, and depends on Task 6.

## Task Dependency Graph

```json
{
  "waves": [
    {
      "id": 0,
      "tasks": [
        "1",
        "3"
      ]
    },
    {
      "id": 1,
      "tasks": [
        "2",
        "4"
      ]
    },
    {
      "id": 2,
      "tasks": [
        "5"
      ]
    },
    {
      "id": 3,
      "tasks": [
        "6"
      ]
    },
    {
      "id": 4,
      "tasks": [
        "7"
      ]
    }
  ]
}
```

## Tasks

- [x] 1. Remove duplicate image event listeners (BUG-01)
  - **Requirements:** REQ-1.1, REQ-1.2, REQ-1.3, REQ-1.4, REQ-1.5, REQ-1.6, REQ-1.7, REQ-1.8, REQ-1.9
  - **Files:** `public/index.html`
  - **Prerequisite:** None.
  - [x] 1.1 Open `public/index.html`. Locate the first screenshot block — currently **lines 983 through 1120**. It begins at this comment on line 983:
    ```
    // --------------------------------------------------
    // SCREENSHOT TOOL
    // --------------------------------------------------
    let selectedImageData = '';
    ```
    and ends at the closing `});` of the first `analyzeImageTextBtn` listener on line 1120. The block contains:
    - The section comment (lines 983–985)
    - `let selectedImageData = '';` (line 986)
    - The first `$('imageInput').addEventListener('change', ...)` handler
    - The first `$('extractImageBtn').addEventListener('click', ...)` handler
    - The first `$('analyzeImageTextBtn').addEventListener('click', ...)` handler (closing `});` at line 1120)
  - [x] 1.2 Delete lines 983–1120 in their entirety. After deletion, the second screenshot block (which begins at the comment `// SCREENSHOT TOOL` now at line 1121) becomes the sole screenshot implementation. Confirm that line 1121 now reads `// --------------------------------------------------` and line 1122 reads `// SCREENSHOT TOOL`.
  - [x] 1.3 Confirm the following items from Block B are present and unchanged after the deletion: `let selectedImageFile = null;`, `let imagePreviewUrl = null;`, the `$('imageInput').addEventListener('change', ...)` handler that calls `URL.createObjectURL`, the `prepareImage(file)` function, the `$('extractImageBtn').addEventListener('click', ...)` handler that calls `prepareImage`, the `$('analyzeImageTextBtn').addEventListener('click', ...)` handler, and the `window.addEventListener('beforeunload', ...)` handler that revokes `imagePreviewUrl`.
  - [x] 1.4 Verify: search the file for `selectedImageData` — zero matches; `imageInput.*addEventListener` — exactly one match; `extractImageBtn.*addEventListener` — exactly one match; `prepareImage` — at least two matches (definition + call).
  - [x] 1.5 Manual regression: (a) select a small image (< 1 MB) → preview appears, no errors; (b) select an image between 6 MB and 12 MB → preview appears, no size error; (c) select an image > 12 MB → error "Please select an image smaller than 12 MB." shown, no preview; (d) click "Extract text from screenshot" with a valid image → one network request to `/api/analyze-image` with a JPEG data URL body in DevTools Network tab; (e) no JS errors in the browser console.

- [x] 2. Remove duplicate history event listeners (BUG-02)
  - **Requirements:** REQ-2.1, REQ-2.2, REQ-2.3, REQ-2.4, REQ-2.5, REQ-2.6, REQ-2.7
  - **Files:** `public/index.html`
  - **Prerequisite:** Task 1 complete (line numbers shift after Block A is removed; use actual current line numbers at the time of this edit).
  - [x] 2.1 Search `public/index.html` for the **second** occurrence of `$('saveHistoryBtn').addEventListener('click', () => {`. In the current file (before Task 1 runs) this is on line 2277. After Task 1 removes 138 lines, it will be approximately line 2139 — always locate by content, not by hardcoded line number.
  - [x] 2.2 Delete everything from that second `$('saveHistoryBtn').addEventListener` call through to and including the closing `});` of the second `$('clearHistoryBtn').addEventListener` call. This removes the second copies of: `$('saveHistoryBtn').addEventListener('click', () => { ... });`, `function renderHistory() { ... }`, and `$('clearHistoryBtn').addEventListener('click', () => { ... });`. After deletion the file must end with: the closing `});` of Block C's `clearHistoryBtn` listener, a blank line, `</script>`, `</body>`, `</html>`.
  - [x] 2.3 Verify: search for `saveHistoryBtn.*addEventListener` — exactly one match; `function renderHistory` — exactly one match; `clearHistoryBtn.*addEventListener` — exactly one match.
  - [x] 2.4 Manual regression: (a) run any analysis, click "Save locally"; (b) open DevTools → Application → Local Storage → `scamLensHistoryV3` and confirm exactly one new entry; (c) navigate to History and confirm exactly one card; (d) reload the page, navigate to History — still exactly one card; (e) click "Delete" on the card — card removed, "No saved reports yet" shown; (f) run another analysis, save it, click "Delete all" — all entries removed.

- [x] 3. Improve API key security
  - **Requirements:** REQ-3.1, REQ-3.2, REQ-3.3, REQ-3.4, REQ-3.5, REQ-3.6
  - **Files:** `.gitignore`, `.env.example` (new file)
  - **Prerequisite:** None (independent of Tasks 1 and 2).
  - [x] 3.1 Open `.gitignore`. Confirm it already contains `node_modules/`, `.env`, and `.DS_Store`. Append two new lines at the end: `*.log` and `npm-debug.log*`. The final file should read:
    ```
    node_modules/
    .env
    .DS_Store
    *.log
    npm-debug.log*
    ```
  - [x] 3.2 Create a new file `.env.example` at the project root with this exact content:
    ```dotenv
    # Copy this file to .env and fill in your real values.
    # Never commit .env to version control.

    PORT=3000
    GROQ_API_KEY=your-groq-api-key-here
    GROQ_MODEL=openai/gpt-oss-120b
    GROQ_VISION_MODEL=qwen/qwen3.8-27b
    GROQ_TRANSCRIPTION_MODEL=whisper-large-v3
    ```
  - [x] 3.3 Search `server.js` for any `console.log`, `console.warn`, or `console.error` call that outputs `process.env.GROQ_API_KEY`. Confirm none exist. No change to `server.js` is needed for this step.
  - [x] 3.4 Verify: `git check-ignore -v .env` → `.env` is listed as ignored; `git check-ignore -v .env.example` → no output (file is tracked); `.env.example` contains no string beginning with `gsk_`.

- [x] 4. Add Content Security Policy
  - **Requirements:** REQ-4.1, REQ-4.2, REQ-4.3, REQ-4.5, REQ-4.6, REQ-4.7, REQ-4.8, REQ-4.9, REQ-4.10, REQ-4.11, REQ-4.12
  - **Files:** `public/index.html`, `public/privacy.html`, `public/privacy.css` (new file), `server.js`
  - **Prerequisite:** Task 1 complete.
  - [x] 4.1 Open `public/privacy.html`. Locate the `<style>...</style>` block inside `<head>`. Create a new file `public/privacy.css`. Copy the entire contents of that `<style>` block (every CSS rule, unchanged) into `public/privacy.css`. Then in `public/privacy.html`, replace the entire `<style>...</style>` block with `<link rel="stylesheet" href="/privacy.css">`, placed after the existing `<link rel="stylesheet" href="/style.css">` line.
  - [x] 4.2 Open `public/index.html`. Locate the opening `<script>` tag near the bottom of `<body>` (the line that reads `<script>`). Change it to `<script nonce="CSP_NONCE_PLACEHOLDER">`.
  - [x] 4.3 At the top of `server.js`, after the existing `require('node:path')` and `require('node:net')` lines, add:
    ```js
    const crypto = require('node:crypto');
    const fs = require('node:fs');
    ```
  - [x] 4.4 After the `PUBLIC_DIR` constant and before the middleware block, add:
    ```js
    const indexHtmlTemplate = fs.readFileSync(
        path.join(PUBLIC_DIR, 'index.html'),
        'utf8'
    );
    ```
  - [x] 4.5 In the existing global security-header middleware block (the one that sets `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, and `Permissions-Policy`), add an unconditional baseline CSP — no path condition, every response receives this header:
    ```js
    // Baseline CSP for all responses.
    // The explicit / and /index.html routes override this with a nonce-bearing variant.
    res.setHeader(
        'Content-Security-Policy',
        [
            "default-src 'self'",
            "script-src 'self'",
            "style-src 'self'",
            "img-src 'self' blob: data:",
            "connect-src 'self'",
            "media-src blob:",
            "object-src 'none'",
            "base-uri 'self'",
            "form-action 'self'"
        ].join('; ')
    );
    ```
  - [x] 4.6 Define the `serveIndexWithNonce` function and register it as `app.get('/')` and `app.get('/index.html')` **before** the `app.use(express.static(...))` line. Remove the existing `app.get('/', ...)` route:
    ```js
    function serveIndexWithNonce(_req, res) {
        const nonce = crypto.randomBytes(16).toString('base64');

        const html = indexHtmlTemplate.replace(
            'nonce="CSP_NONCE_PLACEHOLDER"',
            `nonce="${nonce}"`
        );

        // Override the baseline CSP with a nonce-bearing variant for this page.
        res.setHeader(
            'Content-Security-Policy',
            [
                "default-src 'self'",
                `script-src 'nonce-${nonce}'`,
                "style-src 'self'",
                "img-src 'self' blob: data:",
                "connect-src 'self'",
                "media-src blob:",
                "object-src 'none'",
                "base-uri 'self'",
                "form-action 'self'"
            ].join('; ')
        );

        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.send(html);
    }

    // These routes MUST appear before app.use(express.static(...)).
    app.get('/', serveIndexWithNonce);
    app.get('/index.html', serveIndexWithNonce);
    ```
  - [x] 4.7 Update the `express.static` call to add `{ index: false }`:
    ```js
    app.use(express.static(PUBLIC_DIR, { index: false }));
    ```
  - [x] 4.8 Verify: (a) start the server with `npm start`; (b) open `http://localhost:3000`, in DevTools → Network confirm the document response includes `Content-Security-Policy` with a `nonce-` value in `script-src`; (c) open DevTools → Console and confirm no CSP violation errors; (d) use all four tools — no CSP errors; (e) save a report from History — no errors; (f) open `http://localhost:3000/privacy.html` and confirm the page renders correctly with its styles applied and the response includes a `Content-Security-Policy` header; (g) in the browser console attempt `eval('1')` — confirm it is blocked.

- [x] 5. Add automated unit tests
  - **Requirements:** REQ-5.1, REQ-5.2, REQ-5.3, REQ-5.4, REQ-5.5, REQ-5.6, REQ-5.7, REQ-5.8, REQ-5.9, REQ-5.10, REQ-5.11, REQ-5.12
  - **Files:** `server.js`, `package.json`, `tests/server.test.js` (new file)
  - **Prerequisite:** Tasks 1–4 complete.
  - [x] 5.1 Locate the `app.listen` call at the bottom of `server.js`. Wrap it in a `NODE_ENV` guard:
    ```js
    if (process.env.NODE_ENV !== 'test') {
        app.listen(PORT, () => {
            console.log(`Scam Lens running at http://localhost:${PORT}`);
            console.log(`Text model: ${MODEL}`);
            console.log(`Vision model: ${VISION_MODEL}`);
            console.log(`Audio model: ${TRANSCRIPTION_MODEL}`);

            if (!groq) {
                console.warn('GROQ_API_KEY is missing. Add it to .env.');
            }
        });
    }
    ```
  - [x] 5.2 At the very end of `server.js`, after the `app.listen` guard, add:
    ```js
    // Pure-function exports for unit testing only.
    // These are not part of the production API.
    if (process.env.NODE_ENV === 'test') {
        module.exports = {
            validateAnalysis,
            inspectLink,
            hasImageSignature,
            hasAudioSignature,
            recoverExactQuote
        };
    }
    ```
  - [x] 5.3 In `package.json`, add the `"test"` script. The existing `scripts` block currently contains only `"start"`:
    ```json
    "scripts": {
        "start": "node server.js",
        "test": "node --test tests/server.test.js"
    }
    ```
  - [x] 5.4 Create the directory `tests/` and the file `tests/server.test.js`. The file must set `process.env.NODE_ENV = 'test'` before requiring `server.js`, then import and test the five exported functions:
    ```js
    'use strict';

    process.env.NODE_ENV = 'test';

    const { test } = require('node:test');
    const assert = require('node:assert/strict');

    const {
        validateAnalysis,
        inspectLink,
        hasImageSignature,
        hasAudioSignature,
        recoverExactQuote
    } = require('../server.js');

    function makeAnalysis(overrides = {}) {
        return {
            risk_level: 'Safe',
            scam_category: 'None detected',
            explanation_summary: 'Looks fine.',
            scam_breakdown: [],
            manipulation_sequence: [],
            safe_next_steps: ['Stay safe.'],
            safe_response_template: null,
            ...overrides
        };
    }
    ```
  - [x] 5.5 Implement VA-T1 through VA-T8 for `validateAnalysis` (REQ-5.6):
    - **VA-T1:** Safe response with empty arrays returns `risk_level: 'Safe'` and `scam_category: 'None detected'`.
    - **VA-T2:** `Highly Dangerous` with a phrase absent from the original message is demoted to `Suspicious`:
      ```js
      const result = validateAnalysis(makeAnalysis({
          risk_level: 'Highly Dangerous',
          scam_category: 'Banking or UPI fraud',
          scam_breakdown: [{ suspicious_phrase: 'this phrase is not in the message', detected_tactics: ['Urgency'], why_it_matters: 'It matters.' }],
          manipulation_sequence: [{ step: 1, title: 'Create fear', description: 'Using fear.', evidence_quote: 'this phrase is not in the message' }],
          safe_next_steps: ['Do something.']
      }), 'A completely different message with no matching text.');
      assert.strictEqual(result.risk_level, 'Suspicious');
      ```
    - **VA-T3:** `Highly Dangerous` with a verbatim phrase present in the message retains `Highly Dangerous` and `scam_breakdown.length === 1`.
    - **VA-T4:** Unrecognised `risk_level` throws `Error('Invalid risk level.')`.
    - **VA-T5:** Tactic alias `'impersonation'` is normalised to `'Authority impersonation'`.
    - **VA-T6:** Unrecognised scam category is replaced with `'Unclear'`.
    - **VA-T7:** `safe_next_steps` for a non-Safe result always starts with the four standard safety advisories (`result.safe_next_steps[0]` includes `'Do not share OTPs'`).
    - **VA-T8:** Original message containing `"already paid"` causes `result.safe_next_steps[0]` to include `'1930'`.
  - [x] 5.6 Implement IL-T1 through IL-T9 for `inspectLink` (REQ-5.7):
    - **IL-T1:** `https://example.com` → `risk_level: 'No obvious structural warning'`, empty `findings`.
    - **IL-T2:** `http://example.com` → finding containing "HTTP instead of HTTPS".
    - **IL-T3:** `https://xn--nxasmq6b.com` → finding, `risk_level: 'High caution'`.
    - **IL-T4:** `https://192.168.1.1/path` → finding, `risk_level: 'High caution'`.
    - **IL-T5:** `https://bit.ly/abc123` → finding about URL shortening.
    - **IL-T6:** `example.com` (no scheme) → `https://` prepended, parsed without error.
    - **IL-T7:** Empty string → throws `Error('Please enter a URL.')`.
    - **IL-T8:** String of 2001 characters → throws `Error('The URL is too long.')`.
    - **IL-T9:** `http://user:pass@example.com` → finding about embedded username or password.
  - [x] 5.7 Implement IS-T1 through IS-T6 for `hasImageSignature` (REQ-5.8):
    - **IS-T1:** Buffer `[0xFF, 0xD8, 0xFF, ...]` (12+ bytes), subtype `'jpeg'` → `true`.
    - **IS-T2:** Buffer with 8-byte PNG magic `[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, ...]`, subtype `'png'` → `true`.
    - **IS-T3:** Buffer with `RIFF` at bytes 0–3 and `WEBP` at bytes 8–11, subtype `'webp'` → `true`.
    - **IS-T4:** JPEG buffer, subtype `'png'` → `false`.
    - **IS-T5:** Buffer of 11 bytes (shorter than 12) → `false` for all subtypes.
    - **IS-T6:** Non-Buffer value (e.g. a string) → `false`.
  - [x] 5.8 Implement AS-T1 through AS-T9 for `hasAudioSignature` (REQ-5.9):
    - **AS-T1:** Buffer `[0x1A, 0x45, 0xDF, 0xA3, ...]`, extension `'.webm'` → `true`.
    - **AS-T2:** Buffer beginning with ASCII `OggS`, extension `'.ogg'` → `true`.
    - **AS-T3:** Buffer with `RIFF` at 0–3 and `WAVE` at 8–11, extension `'.wav'` → `true`.
    - **AS-T4:** Buffer beginning with ASCII `fLaC`, extension `'.flac'` → `true`.
    - **AS-T5:** Buffer with ASCII `ftyp` at bytes 4–7, extension `'.m4a'` → `true`.
    - **AS-T6:** Buffer beginning with ASCII `ID3`, extension `'.mp3'` → `true`.
    - **AS-T7:** Buffer `[0xFF, 0xFB, ...]` (MP3 sync word), extension `'.mp3'` → `true`.
    - **AS-T8:** WEBM buffer, extension `'.ogg'` → `false`.
    - **AS-T9:** Buffer of 3 bytes (shorter than 4) → `false` for any extension.
  - [x] 5.9 Implement RQ-T1 through RQ-T5 for `recoverExactQuote` (REQ-5.10):
    - **RQ-T1:** Phrase found verbatim in the message → returned with original casing.
    - **RQ-T2:** Phrase with different internal whitespace (double space) → still matched and returned.
    - **RQ-T3:** Phrase not present in the message → `null`.
    - **RQ-T4:** Empty string input → `null`.
    - **RQ-T5:** Input string `'none'` (case-insensitive) → `null`.
  - [x] 5.10 Run `npm test` — all 37 tests must pass and exit code must be 0. Temporarily delete the demotion rule in `validateAnalysis` (`if (riskLevel === 'Highly Dangerous' && breakdown.length === 0)` block) and run `npm test` — VA-T2 must fail. Restore the rule. Run `npm test` with no `GROQ_API_KEY` environment variable set — all tests must still pass.

- [x] 6. Post-audit fixes (from independent audit, November 2026)
  - **Requirements:** REQ-5.2 (extend test command), new audit findings BUG-A through HACK-B
  - **Files:** `package.json`, `public/rescue.js`, `tests/rescue.test.js`, `.gitignore` (verify), project root (new files)
  - **Prerequisite:** Tasks 1–5 complete.
  - [x] 6.1 Fix `npm test` to include the rescue test suite. Open `package.json`. Change the `"test"` script from:
    ```json
    "test": "node --test tests/server.test.js"
    ```
    to:
    ```json
    "test": "node --test tests/server.test.js tests/rescue.test.js"
    ```
    Verify: run `npm test` — the output must now report 48 tests (37 server + 11 rescue), all passing, exit code 0.
  - [x] 6.2 Add the I4C advisory URL to `SOURCES.verify` in `public/rescue.js`. Locate the `SOURCES` object:
    ```js
    const SOURCES = {
        verify: {
            label: 'I4C (Ministry of Home Affairs) public advisory on "digital arrest", October 2024',
            url: null
        }
    };
    ```
    Replace `url: null` with the confirmed I4C advisory URL. The URL must start with `https://`. If the official advisory page cannot be confirmed, replace `url: null` with a comment explaining why:
    ```js
    // url is intentionally null: the I4C October 2024 "digital arrest" advisory
    // has not been assigned a stable permanent URL. Update this when one is confirmed.
    url: null
    ```
    Then update the rescue test so the absence of a URL is an explicit documented choice rather than a silent gap: in `tests/rescue.test.js`, in the `'claim-bearing steps carry a visible source label'` test, add an assertion that either `s.url` is a valid `https://` URL or the step comment documents why it is null. At minimum, add a comment in the test explaining the null is intentional.
  - [x] 6.3 Add a `LICENSE` file at the project root. Create `LICENSE` containing the MIT licence text with the current year (2026) and the author name "Lakshya Garg":
    ```
    MIT License

    Copyright (c) 2026 Lakshya Garg

    Permission is hereby granted, free of charge, to any person obtaining a copy
    of this software and associated documentation files (the "Software"), to deal
    in the Software without restriction, including without limitation the rights
    to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
    copies of the Software, and to permit persons to whom the Software is
    furnished to do so, subject to the following conditions:

    The above copyright notice and this permission notice shall be included in
    all copies or substantial portions of the Software.

    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
    IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
    FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
    AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
    LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
    OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
    THE SOFTWARE.
    ```
    Verify: the file exists at the project root as `LICENSE` (no extension).
  - [x] 6.4 Add `TRUST_PROXY` to `.env.example` with an explanatory comment. Open `.env.example` and append after the last line:
    ```dotenv
    # Set TRUST_PROXY=1 only when the app runs behind a trusted reverse proxy
    # (e.g. Render, Railway). Never set this on a server with a public IP.
    # TRUST_PROXY=1
    ```
  - [x] 6.5 Create `README.md` at the project root. The file must contain all of the following sections in this order:
    1. **Title and one-line description** — "Scam Lens — AI-assisted scam and phishing awareness checker"
    2. **What it does** — describe the four tools (text, screenshot, voice, link) and Rescue Mode in plain language suitable for a hackathon judge; include the multi-modality Frankenstein justification (four different AI paradigms stitched into one safety tool)
    3. **Quick start** — prerequisites (Node.js ≥ 22), installation (`npm install`), configuration (copy `.env.example` to `.env`, add Groq API key with link to console.groq.com, note to verify model names are still available), running (`npm start`, open `http://localhost:3000`)
    4. **Running tests** — `npm test` (runs 48 tests: 37 server unit tests + 11 Rescue Mode property-based tests); description of what each suite covers
    5. **Benchmark** — `npm run benchmark -- --split dev`; note that the dataset is 40 synthetic examples and results are not real-world accuracy; link to `benchmark/README.md`
    6. **Project structure** — brief annotated file tree (server.js, public/, tests/, benchmark/, .kiro/)
    7. **How Kiro was used** — describe spec-driven development, the stability-security spec, task execution, and that the `.kiro/specs/stability-security/` directory contains the full requirements, design, and task history
    8. **Limitations** — this is decision support, not verified fraud detection; structural URL check only (no live reputation feed); voice feature transcribes speech but does not detect cloned voices; benchmark uses synthetic data
    9. **Privacy** — link to `/privacy.html`
    10. **Licence** — MIT
    Do NOT include the sentence "Revoke the Groq API key that was included in the uploaded .env file" or any reference to the previous key exposure. Do NOT copy the internal handoff instructions from `README.txt`.
  - [x] 6.6 Keep README.txt locally but exclude it from the public repository by adding it to .gitignore. Do not delete it.
  - [x] 6.7 Mark `analyzeText` export clearly in `server.js`. Locate the test export block at the bottom of `server.js`:
    ```js
    if (process.env.NODE_ENV === 'test') {
        module.exports = {
            validateAnalysis,
            inspectLink,
            hasImageSignature,
            hasAudioSignature,
            recoverExactQuote
        };
    }
    ```
    Add `analyzeText` with a comment distinguishing it from the pure functions:
    ```js
    if (process.env.NODE_ENV === 'test') {
        module.exports = {
            // Pure functions: no network I/O, safe to call in unit tests without a GROQ_API_KEY.
            validateAnalysis,
            inspectLink,
            hasImageSignature,
            hasAudioSignature,
            recoverExactQuote,
            // benchmark/run.js only — requires a live GROQ_API_KEY; never called by server.test.js.
            analyzeText
        };
    }
    ```
    Verify: run `npm test` — still 48 tests passing, exit code 0.
  - [x] 6.8 Surface truncated, empty and malformed AI responses as clear user-facing errors, with mocked-client tests (analyzeText accepts an injected client)
  - [x] 6.9 Add Kiro steering files (product, tech-stack, structure)
  - [x] 6.10 Add the PostFileSave test hook in .kiro/hooks/run-tests-on-save.json
  - [x] 6.11 Correct the privacy policy feedback-count statement
  - **Traceability (Task 6 sub-tasks to Requirement 6):**
    - 6.1 → REQ-6.1 to 6.3
    - 6.2 → REQ-6.4 to 6.10
    - 6.3 → REQ-6.23
    - 6.4 → REQ-6.26
    - 6.5 → REQ-6.24
    - 6.6 → REQ-6.25, 6.27
    - 6.7 → REQ-6.11
    - 6.8 → REQ-6.12 to 6.19
    - 6.9 → REQ-6.29
    - 6.10 → REQ-6.30 to 6.32, 6.34
    - 6.11 → REQ-6.20 to 6.22
  - **Superseded figures:** the "48 tests" figures in sub-tasks 6.1 and 6.7 and in the first Post-audit checklist line were correct when written. The suite is now 64 tests (52 in `tests/server.test.js` plus 12 in `tests/rescue.test.js`). `requirements.md` Acceptance Criterion 2 is authoritative.
  - [x] 6.12 Remove the non-functional "Was this analysis useful?" feedback controls and retitle the privacy section
    - Removed the controls from `public/index.html` together with the three `renderAnalysis` statements that referenced `#feedbackStatus`, `#feedbackYes` and `#feedbackNo`. Retitled `public/privacy.html` section 5 to "History in your browser".
    - Verified: no `feedbackStatus`, `feedbackYes` or `feedbackNo` in `public/index.html`; `public/privacy.html` contains no "feedback" and has the heading "5. History in your browser".
    - _Requirements: REQ-6.20, 6.22_
  - [x] 6.13 Align the Rescue Mode source in `rescue.js` and the static source list in `index.html`
    - `SOURCES.verify` and the static "Official guidance used" link both use `https://cybercrime.gov.in/pdf/Advisories/ADVISORYTAU-ADV-003DigitalArrest06.03.2025.pdf`, labelled "I4C / NCTAU: Digital Arrest Scam Advisory, 6 March 2025". Added the rescue test "dynamic and static Rescue Mode sources agree and links are safe".
    - Verified: URL and label present in both files; the test is at `tests/rescue.test.js` line 131. The PDF content was not machine-verified (see Task 7, sub-task 7.3).
    - _Requirements: REQ-6.4, 6.5, 6.6, 6.7, 6.8_
  - [x] 6.14 Extend the PostFileSave hook matcher to include `index.html`
    - `.kiro/hooks/run-tests-on-save.json` still defines one hook; name, command, timeout and enabled are unchanged.
    - Verified: matcher is `(^|[\\/])(server\.js|rescue\.js|index\.html|[^\\/]+\.test\.js)$`.
    - _Requirements: REQ-6.30, 6.31_
  - [x] 6.15 Correct test counts and wording in `README.md` and the steering files
    - Verified: `README.md` states 64 tests and describes the rescue tests as exhaustive scenario tests, not randomised property-based tests; `structure.md` says 64 tests; `tech-stack.md` has the same wording.
    - _Requirements: REQ-6.24, 6.29_
  - [x] 6.16 Update `requirements.md` (Requirement 6) and `design.md` (Task 6 section, Properties 27 to 34) to cover Task 6
    - Documentation only; no code change.
    - _Requirements: REQ-6.1 to 6.34 (documentation)_

- [~] 7. Open follow-ups from the audit (manual or optional) — all sub-tasks done except 7.4, which is deferred
  - **Prerequisite:** Task 6 complete.
  - [x] 7.1 Rotate the Groq API key (manual, owner only)
    - Never record the key value in any file, spec or chat.
    - Done when the old key is revoked in the Groq console and the local `.env` holds the new key.
    - Completed 2026-11-18, based on the owner's confirmation: the previously exposed key was revoked, a replacement key was generated, and the local `.env` was updated. The agent did not read or check `.env` and did not verify this independently.
    - _Requirements: REQ-3.1, REQ-3.3 (Requirement 3 context)_
  - [x] 7.2 Resolve the missing `README.txt`
    - `README.txt` is listed in `.gitignore` but is not present in the project root (verified; no copy found). The owner either restores it from the original download, or changes REQ-6.25 and `requirements.md` Acceptance Criterion 21 to accept its absence.
    - Done when the file exists and `.gitignore` lists it, or when the requirement and criterion have been amended.
    - _Requirements: REQ-6.25_
    - Resolved 2026-11-18: REQ-6.25 and Acceptance Criterion 21 amended. `README.txt` is optional; the `.gitignore` rule for it is kept.
  - [x] 7.3 Confirm the Rescue Mode official sources
    - Implemented 2026-11-18 in `public/rescue.js`, `public/index.html` and `tests/rescue.test.js`: new I4C, CERT-In and PIB labels; per-step source notes; corrected Digital Arrest, bank, device and PIB wording; review date 18 November 2026; 112 step unchanged. `npm test` passes (69 tests, 17 in `tests/rescue.test.js`). See `design.md`, "Task 7.3 Rescue Mode source wording".
    - Source checks: the PIB release and the RBI page were read by the agent. The owner independently verified the I4C advisory PDF and the CERT-In advisory (CICA-2026-3492), and confirmed that both support the revised guidance and the documented CERT-In scope limitation.
    - Resolved 2026-11-18: Verified against the four official sources on 2026-11-18.
    - _Requirements: REQ-6.10 (Acceptance Criterion 25)_
  - [~] 7.4 Verify the PostFileSave hook fires in a Kiro session
    - Ask Kiro to make a trivial edit to `server.js` and watch for `npm test` output in the hook or agent panel, then revert the edit.
    - Done when the firing is observed, or when the Agent Hooks panel shows why it did not fire.
    - **Deferred 2026-11-18:** actual hook execution could not be independently verified in the Kiro environment. No further investigation is planned. The hook configuration is unchanged and its command is `npm test`.
    - _Requirements: REQ-6.34_
  - [x] 7.5 Run `npm test` manually with an empty `GROQ_API_KEY` and mocked clients (no network calls)
    - Run `npm test` with `GROQ_API_KEY` defined but empty, so the tests cannot depend on a real key. This covers Acceptance Criteria 2 to 4, which no test asserts. The machine is not disconnected from the network; "no network" means the tests make no network calls.
    - Done when the output shows 64 tests and 0 failures. The suite has since grown to 69 tests (Task 7.3), so the expected figure is now 69.
    - Resolved 2026-11-18: ran `npm test` in a child process with `GROQ_API_KEY` defined but empty. A probe confirmed it stayed empty after `dotenv.config()`, because dotenv does not override an existing variable. Result: 69 tests, 69 pass, 0 fail, exit code 0. The tests inject a fake client into `analyzeText` and contain no `openai`, `fetch`, `http`, `https` or `net` use. The machine was not physically disconnected from the network.
    - _Requirements: REQ-6.1, 6.2, 6.3_
  - [x] 7.6 (optional) Check `finish_reason` in `/api/analyze-image`
    - Add the same `finish_reason === 'length'` rejection used by `analyzeText`, with a mocked-client test.
    - Done when a truncated OCR reply is rejected with a clear message and `npm test` passes.
    - Resolved 2026-11-18: the vision call moved into `extractImageText(imageDataUrl, client = groq)` in `server.js`, which throws `AnalysisError('truncated', ...)` when `finish_reason === 'length'`. The endpoint returns that message with status 502: "Image analysis was incomplete, so no text is shown. Please try again with a clearer or smaller image." Request validation, the vision model, `max_completion_tokens: 2500` and the 422 empty-text answer are unchanged. Added tests OC-T1 to OC-T8 (mock client, no network). Result: 77 tests, 77 pass, 0 fail.
    - _Requirements: REQ-6.19 (known limitation)_
  - [x] 7.7 (optional) Remove the unused `.feedback-section` rules from `public/style.css`
    - Remove both the screen and the print blocks, after a visual check of the results page.
    - Done when no `.feedback-section` rule remains and the results page looks unchanged.
    - Resolved 2026-11-18: `.feedback-section` appeared only in `public/style.css` (the screen rule and one entry in the print `display: none` list). No markup, script, test or document used it. Both were removed, and the "Feedback and reports" comment became "Reports". `.report-actions` and the other print selectors are untouched. No visual check was made in a browser.
    - _Requirements: REQ-6.20_
  - Notes: sub-tasks 7.1 to 7.4 are owner actions that the agent cannot perform or verify. 7.1 and 7.3 are recorded as done on the owner's confirmation; 7.4 is deferred. Current suite: 77 tests (60 in `tests/server.test.js`, 17 in `tests/rescue.test.js`).

## Notes

- Tasks 1 and 2 touch only `public/index.html`. They can be performed in a text editor without running the server.
- Task 3 creates one new file and edits one existing file. No server restart is needed to verify it.
- Task 4 requires a server restart after each change to observe the CSP headers. Keep the browser DevTools Console open during verification.
- Task 5 requires no running server and no live API key. The `NODE_ENV=test` guard prevents Express from starting when `server.js` is imported by the test runner.
- Do not change the AI system prompt, any API endpoint logic, rate limiting, file signature validation, or response sanitisation. Those are out of scope for this spec.
- Manual regression checklist items for BUG-01 and BUG-02 must be performed in a browser after Tasks 1 and 2 respectively; they cannot be automated without a DOM environment.

### Completion checklist

Before closing this spec, all of the following must be true:

**BUG-01 (image)**
- [x] `selectedImageData` does not appear in `index.html`.
- [x] `imageInput` has exactly one `change` listener.
- [x] `extractImageBtn` has exactly one `click` listener (image workflow).
- [x] Image preview, extraction, and analysis all function correctly.

**BUG-02 (history)**
- [x] `saveHistoryBtn` has exactly one `click` listener.
- [x] `renderHistory` is defined exactly once.
- [x] `clearHistoryBtn` has exactly one `click` listener.
- [x] Saving a report creates exactly one `localStorage` entry.

**API key security**
- [x] `.gitignore` excludes `.env`, `*.log`, `npm-debug.log*`.
- [x] `.env.example` exists with placeholder values only.
- [x] No real API key appears in any tracked file.

**CSP**
- [x] All HTTP responses include a `Content-Security-Policy` header.
- [x] HTML responses include a per-request nonce in `script-src`.
- [x] No CSP violations in the browser console during normal use.
- [x] `privacy.html` inline styles are served from a separate CSS file.

**Tests**
- [x] `npm test` exits 0 with all tests passing.
- [x] All 37 test cases (VA-T1–T8, IL-T1–T9, IS-T1–T6, AS-T1–T9, RQ-T1–T5) are present.
- [x] Deliberately breaking `validateAnalysis` causes the relevant test to fail.
- [x] No network calls are made during the test run.

**Post-audit fixes**
- [x] `npm test` runs both `server.test.js` and `rescue.test.js` (48 tests total).
- [x] `LICENSE` file exists at the project root (MIT, 2026, Lakshya Garg).
- [x] `README.md` exists and covers setup, tools, Kiro usage, limitations, and licence.
- [x] README.txt is excluded from the public repository via .gitignore (kept locally).
- [x] `.env.example` documents `TRUST_PROXY`.
- [x] `analyzeText` export in `server.js` has a comment distinguishing it from pure functions.

**Open follow-ups**
- [x] Old Groq key revoked and new key in local `.env` (7.1, owner-confirmed 2026-11-18)
- [x] `README.txt` restored or REQ-6.25 amended (7.2)
- [x] Official Rescue Mode source links opened and confirmed by the owner (7.3)
- [~] PostFileSave hook observed firing in a Kiro session (7.4, deferred: execution could not be independently verified)
- [x] Manual `npm test` run with an empty `GROQ_API_KEY` and mocked clients shows 69 tests (64 before Task 7.3), 0 failures; the machine was not disconnected from the network (7.5)
- [x] `/api/analyze-image` rejects a `finish_reason: 'length'` reply; `npm test` shows 77 tests, 0 failures (7.6)
- [x] Unused `.feedback-section` CSS removed (7.7)

**Post-audit fixes (additional)**
- [x] Feedback controls removed and privacy section 5 retitled (6.12)
- [x] Rescue Mode dynamic and static sources use the same I4C advisory URL (6.13)
- [x] Hook matcher includes `index.html` (6.14)
- [x] README and steering files state 64 tests with accurate test descriptions (6.15)
