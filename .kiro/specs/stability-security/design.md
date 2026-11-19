# Design — Scam Lens: Stability and Security Improvements

## Overview

This document describes exactly what will be changed, where, and why, for each of the six improvement tasks in this spec. It records the decisions made and the alternatives rejected.

No new npm dependencies are added to `dependencies`, and no `devDependencies` are used: the built-in `node:test` runner is used (see the Testing Strategy section).

The six tasks are:

| Task | Area | Type |
|---|---|---|
| 1 | Duplicate image event listeners (BUG-01) | Bug fix |
| 2 | Duplicate history event listeners (BUG-02) | Bug fix |
| 3 | API key security | Security hardening |
| 4 | Content Security Policy | Security hardening |
| 5 | Automated tests | Quality |
| 6 | Post-audit fixes | Hardening, quality, documentation |

---

## Architecture

The application is a single-process Node.js/Express server serving a single-page HTML application from the `public/` directory. No database, no build step, no bundler.

```
Client (browser)
    │
    │  HTTP/HTTPS
    ▼
server.js  (Express, Node 22)
    ├── Global security-header middleware
    │       X-Content-Type-Options, X-Frame-Options, Referrer-Policy,
    │       Permissions-Policy, Strict-Transport-Security (prod only),
    │       Content-Security-Policy (baseline, unconditional) ← NEW
    │
    ├── app.get('/')  serveIndexWithNonce  ← NEW explicit route
    ├── app.get('/index.html')  serveIndexWithNonce  ← NEW explicit route
    │       Generates crypto nonce, injects into HTML, overrides CSP header
    │
    ├── app.use(express.static(PUBLIC_DIR, { index: false }))  ← index:false added
    │       Serves style.css, privacy.css (new), rescue.js, robots.txt, privacy.html
    │
    ├── GET  /api/health         — liveness check (not rate-limited)
    ├── POST /api/analyze        — text analysis (rate-limited)
    ├── POST /api/analyze-image  — screenshot OCR (rate-limited)
    ├── POST /api/transcribe     — audio transcription (rate-limited)
    └── POST /api/check-link     — URL structural analysis (rate-limited)
```

**Route ordering rule:** `app.get('/')` and `app.get('/index.html')` must be registered *before* `app.use(express.static(...))`. Without this ordering, `express.static` intercepts the request and serves `index.html` without the nonce injection. The `{ index: false }` option on `express.static` is an additional safeguard against directory-index auto-serving for `/`.

**Static file layout (after all changes):**

```
public/
  index.html       — SPA shell; inline <script> gets nonce="CSP_NONCE_PLACEHOLDER"
  style.css        — unchanged
  privacy.html     — inline <style> replaced with <link href="/privacy.css">
  privacy.css      — NEW: extracted from privacy.html
  rescue.js        - Rescue Mode logic (UMD module); its script tag carries the CSP nonce
  robots.txt       — unchanged
```

---

## Components and Interfaces

### Server-side pure functions

These five functions are exported from `server.js` only when `NODE_ENV === 'test'` so the test runner can import them without starting the HTTP server. Task 6 adds three more test-only exports under the same guard: `analyzeText`, `AnalysisError` and `analysisFailure` (see Task 6 in the Detailed Design). Task 7.6 adds a fourth, `extractImageText`.

| Function | Signature | Purpose |
|---|---|---|
| `validateAnalysis(value, originalMessage)` | `(object, string) → object` | Sanitises and validates the raw AI JSON response before sending to the client. Applies tactic normalisation, quote recovery, risk-level demotion, and standard safety advisories. |
| `recoverExactQuote(message, proposedQuote)` | `(string, string) → string \| null` | Verifies a proposed suspicious phrase is a verbatim substring of the original message using case-insensitive, whitespace-normalised regex matching. Returns `null` if not found or if the input is empty / `'none'`. |
| `inspectLink(input)` | `(string) → object` | Performs structural analysis of a submitted URL without making any network request. Returns findings, suggestions, risk level and hostname. |
| `hasImageSignature(buffer, subtype)` | `(Buffer, string) → boolean` | Checks the magic bytes of a buffer against the declared image MIME subtype (`jpeg`, `png`, `webp`). |
| `hasAudioSignature(buffer, extension)` | `(Buffer, string) → boolean` | Checks the magic bytes of a buffer against the declared audio file extension (`.webm`, `.ogg`, `.wav`, `.flac`, `.m4a`, `.mp3`, `.mpga`). |

### Client-side script blocks in `public/index.html`

The inline `<script>` block in `index.html` is divided into logical sections. After BUG-01 and BUG-02 fixes the remaining blocks are:

| Block | Variable(s) declared | Purpose |
|---|---|---|
| View navigation | `viewIds`, `currentView`, `selectedTool`, `showView()` | Show/hide the eight named `<section class="view">` elements. |
| Text tool | `analyzeMessage()`, `textForm` submit handler | Sends text to `/api/analyze`, renders results. |
| Screenshot tool (Block B only) | `selectedImageFile`, `imagePreviewUrl`, `prepareImage()` | File selection, canvas resize/compress, OCR extraction. |
| Voice tool | `mediaRecorder`, `activeStream`, `audioChunks`, `recordedBlob` | MediaRecorder recording, file upload, transcription. |
| Link tool | `linkForm` submit handler | Sends URL to `/api/check-link`, renders findings. |
| Results rendering | `renderAnalysis()`, `fillList()`, `buildReport()` | Populates the results view from AI or link-check response. |
| History (Block C only) | `HISTORY_KEY`, `getHistory()`, `renderHistory()` | localStorage save/load/delete for up to 15 reports. |

### Nonce injection interface

```js
// Called once at startup
const indexHtmlTemplate = fs.readFileSync(path.join(PUBLIC_DIR, 'index.html'), 'utf8');

// Called per request to / or /index.html
function serveIndexWithNonce(req, res) {
    const nonce = crypto.randomBytes(16).toString('base64');
    const html  = indexHtmlTemplate.replaceAll(
        'nonce="CSP_NONCE_PLACEHOLDER"',
        `nonce="${nonce}"`
    );
    res.setHeader('Content-Security-Policy', buildNonceCsp(nonce));
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
}
```

The placeholder string `nonce="CSP_NONCE_PLACEHOLDER"` appears twice in `index.html`: on `<script src="/rescue.js">` and on the inline `<script>` block. `String.replaceAll` is required. A plain `replace` would nonce only the first tag, and the browser would block the other under `script-src 'nonce-...'`. Both tags receive the same per-request nonce.

---

## Data Models

### AI analysis response (output of `validateAnalysis`)

```ts
{
  risk_level:          'Safe' | 'Suspicious' | 'Highly Dangerous',
  scam_category:       string,          // one of 12 allowed values, else 'Unclear'
  explanation_summary: string,          // ≤ 1800 chars
  scam_breakdown: Array<{
    suspicious_phrase: string,          // exact verbatim quote from original message
    detected_tactics:  string[],        // subset of 10 allowed tactic names
    why_it_matters:    string           // ≤ 600 chars
  }>,
  manipulation_sequence: Array<{
    step:           number,
    title:          string,             // ≤ 100 chars
    description:    string,             // ≤ 500 chars
    evidence_quote: string              // exact verbatim quote from original message
  }>,
  safe_next_steps:        string[],     // ≤ 9 items, ≤ 500 chars each; first items are fixed advisories
  safe_response_template: string | null // ≤ 1000 chars; null for Highly Dangerous
}
```

**Invariants enforced by `validateAnalysis`:**

- `risk_level` must be one of the three allowed values or the function throws.
- If `risk_level === 'Safe'`, `scam_breakdown` and `manipulation_sequence` are forcibly emptied and `scam_category` is set to `'None detected'`.
- If `risk_level === 'Highly Dangerous'` and `scam_breakdown` is empty after quote recovery, `risk_level` is demoted to `'Suspicious'` and `scam_category` to `'Unclear'`.
- Every `suspicious_phrase` and `evidence_quote` is verified against the original message via `recoverExactQuote`; unverifiable entries are dropped.
- Tactic names are normalised through `tacticAliases`; unrecognised tactics are dropped.

### Link inspection response (output of `inspectLink`)

```ts
{
  submitted_url:    string,
  normalized_url:   string,
  hostname:         string,
  risk_level:       'No obvious structural warning' | 'Review carefully' | 'High caution',
  findings:         string[],   // structural issues found
  suggestions:      string[],   // recommended actions
  reputation_check: string,     // states that no reputation check was performed
  disclaimer:       string      // standard disclaimer
}
```

### localStorage history entry

```ts
{
  id:        number,    // Date.now() at time of save
  createdAt: string,    // ISO 8601 timestamp
  message:   string,    // original text submitted for analysis
  analysis:  object     // the full validateAnalysis output object
}
```

Stored under key `scamLensHistoryV3`. Array is sliced to 15 entries on each write.

### CSP nonce flow

```
Request arrives at / or /index.html
    │
    ├─ crypto.randomBytes(16).toString('base64')  →  nonce (22 chars, URL-safe base64)
    │
    ├─ HTML: replace nonce="CSP_NONCE_PLACEHOLDER" → nonce="{nonce}"
    │
    └─ Header: Content-Security-Policy: ... script-src 'nonce-{nonce}' ...
                                                              ▲
                            Browser checks this value matches the script tag's nonce attribute
```

---

## Error Handling

### API endpoint errors

All four API endpoints follow the same error shape:

```json
{ "error": "Human-readable message." }
```

HTTP status codes used:

| Status | Condition |
|---|---|
| 400 | Missing or malformed request body |
| 413 | Payload too large (message, image, or audio) |
| 415 | Unsupported MIME type or magic-byte mismatch |
| 422 | AI returned empty content (no text in screenshot, no speech in audio) |
| 429 | Rate limit exceeded (Retry-After header included) |
| 503 | `GROQ_API_KEY` not configured |
| 502 | Upstream AI call failed, or the AI returned a truncated, empty, malformed or invalid analysis (see Task 6) |

### `validateAnalysis` error handling

- Throws `Error('Invalid AI response.')` if the value is not a plain object.
- Throws `Error('Invalid risk level.')` if `risk_level` is not in the allowed set.
- Throws `Error('Missing evidence list.')` if `scam_breakdown` is not an array.
- Throws `Error('Missing recommended steps.')` if `safe_next_steps` is not an array.
- All these throw paths are caught by the `try/catch` in `/api/analyze` and return a 502. Since Task 6, `analyzeText` wraps them in an `AnalysisError` with code `invalid_shape`, so users see a generic retry message instead of the internal text.

### `inspectLink` error handling

- Throws `Error('Please enter a URL.')` for empty input.
- Throws `Error('The URL is too long.')` for input exceeding 2000 characters.
- Throws `Error('Only HTTP and HTTPS URLs are supported.')` for other protocols.
- Throws `Error('The URL does not contain a valid hostname.')` if `URL` parsing yields no hostname.
- All these throw paths are caught by the `try/catch` in `/api/check-link` and return a 400.

### Client-side error handling

Each tool's submit/click handler wraps its `fetchJson` call in a `try/catch` and writes `error.message` to the tool's dedicated status element (e.g. `#textError`, `#imageStatus`, `#audioError`, `#linkError`). No unhandled promise rejection is introduced.

### Missing API key

If `GROQ_API_KEY` is not set, `groq` is `null`. All endpoints that call the AI check `if (!groq)` and return 503 before any network call. The test suite sets `NODE_ENV=test`, which prevents the server from starting, so the absence of `GROQ_API_KEY` during tests is harmless.

---

## Correctness Properties

The following properties are verified by the automated test suite (REQ-5.6 through REQ-5.10). Each property is linked to one or more named test cases.

### `validateAnalysis` properties

Property 1: A valid Safe response always produces `risk_level: 'Safe'` and `scam_category: 'None detected'` (VA-T1).
**Validates: Requirements 5.6**

Property 2: A `Highly Dangerous` response with no verifiable quotes in `scam_breakdown` is always demoted to `Suspicious` (VA-T2).
**Validates: Requirements 5.6**

Property 3: A `Highly Dangerous` response with a confirmed verbatim quote is never demoted (VA-T3).
**Validates: Requirements 5.6**

Property 4: An unrecognised `risk_level` always throws `Error('Invalid risk level.')` (VA-T4).
**Validates: Requirements 5.6**

Property 5: The tactic alias `'impersonation'` always normalises to `'Authority impersonation'` (VA-T5).
**Validates: Requirements 5.6**

Property 6: An unrecognised `scam_category` is always replaced with `'Unclear'` (VA-T6).
**Validates: Requirements 5.6**

Property 7: The four standard safety advisories are always prepended to `safe_next_steps` for non-Safe results (VA-T7).
**Validates: Requirements 5.6**

Property 8: The 1930 helpline step is always prepended when the original message contains the phrase "already paid" (VA-T8).
**Validates: Requirements 5.6**

### `inspectLink` properties

Property 9: A clean HTTPS URL always returns `risk_level: 'No obvious structural warning'` and an empty `findings` array (IL-T1).
**Validates: Requirements 5.7**

Property 10: HTTP URLs always produce a finding referencing HTTPS (IL-T2).
**Validates: Requirements 5.7**

Property 11: Punycode hostnames (`xn--`) always produce a `High caution` result (IL-T3).
**Validates: Requirements 5.7**

Property 12: Raw IP addresses always produce a `High caution` result (IL-T4).
**Validates: Requirements 5.7**

Property 13: Known shortener domains always produce a shortener finding (IL-T5).
**Validates: Requirements 5.7**

Property 14: Schemeless input always has `https://` prepended before parsing (IL-T6).
**Validates: Requirements 5.7**

Property 15: Empty input always throws `Error('Please enter a URL.')` (IL-T7).
**Validates: Requirements 5.7**

Property 16: Input longer than 2000 characters always throws `Error('The URL is too long.')` (IL-T8).
**Validates: Requirements 5.7**

Property 17: URLs with embedded credentials always produce a credential finding (IL-T9).
**Validates: Requirements 5.7**

### `hasImageSignature` / `hasAudioSignature` properties

Property 18: Each function returns `true` only when the buffer's magic bytes match the declared type (IS-T1-T3, AS-T1-T7).
**Validates: Requirements 5.8**
**Validates: Requirements 5.9**

Property 19: Each function returns `false` for buffers shorter than the required minimum length (IS-T5, AS-T9).
**Validates: Requirements 5.8**
**Validates: Requirements 5.9**

Property 20: Each function returns `false` for non-Buffer values (IS-T6).
**Validates: Requirements 5.8**

Property 21: A buffer for type X passed as type Y always returns `false` (IS-T4, AS-T8).
**Validates: Requirements 5.8**
**Validates: Requirements 5.9**

### `recoverExactQuote` properties

Property 22: A verbatim phrase always returns that phrase with its original casing from the message (RQ-T1).
**Validates: Requirements 5.10**

Property 23: A phrase with normalised internal whitespace is still matched (RQ-T2).
**Validates: Requirements 5.10**

Property 24: A phrase not present in the message always returns `null` (RQ-T3).
**Validates: Requirements 5.10**

Property 25: Empty input always returns `null` (RQ-T4).
**Validates: Requirements 5.10**

Property 26: The string `'none'` (any case) always returns `null` (RQ-T5).
**Validates: Requirements 5.10**

### `analyzeText` failure-handling properties (Task 6)

Property 27: A completion whose `finish_reason` is `'length'` is never accepted, whether its content is empty, partial, or parses as complete JSON (AT-T3, AT-T4, AT-T5). Audit finding REL-A.
**Validates: Requirements 6.12, 6.13**

Property 28: A missing choice, empty or null content, and unparseable JSON are rejected with an `AnalysisError` whose `code` is `no_choice`, `empty` and `malformed_json` respectively (AT-T6, AT-T7, AT-T8). Audit finding REL-A.
**Validates: Requirements 6.12**

Property 29: A reply that parses but fails `validateAnalysis` is rejected with code `invalid_shape` (AT-T10).
**Validates: Requirements 6.12**

Property 30: No failure case resolves to a classification, and in particular none resolves to `Safe` (AT-T11).
**Validates: Requirements 6.13**

Property 31: A provider error propagates out of `analyzeText` unchanged, and `analysisFailure` maps it to status 502 with a generic message that carries no provider detail (AT-T9).
**Validates: Requirements 6.14**

Property 32: The `message` and `userMessage` of an `AnalysisError` never contain the model's output (AT-T6). Failure logs record only an error code or HTTP status. That logging rule is verified by code inspection, not by a test.
**Validates: Requirements 6.15**

### Rescue Mode source properties (Task 6)

Property 33: Every entry in `SOURCES` has a non-null `https://` URL, so a missing source cannot pass silently (rescue.test.js, "claim-bearing steps carry a visible source label"). Audit finding BUG-D.
**Validates: Requirements 6.4**

Property 34: The static "Official guidance used" list in `index.html` contains the same URL and label as `SOURCES.verify` (Task 7.3 extends this to all four `SOURCE_LIST` entries and the review date), and every `target="_blank"` link in the page has `rel="noopener noreferrer"` (rescue.test.js, "dynamic and static Rescue Mode sources agree and links are safe").
**Validates: Requirements 6.5, 6.6, 6.7**

---

## Testing Strategy

### Framework

**Node.js built-in test runner (`node:test` + `node:assert/strict`)**, available and stable in Node 22. Zero additional dependencies required.

Run command: `node --test tests/server.test.js tests/rescue.test.js` (since Task 6; Task 5 originally ran only the first file)
`package.json` script: `"test": "node --test tests/server.test.js tests/rescue.test.js"`

### Test isolation

- `process.env.NODE_ENV = 'test'` is set before `require('../server.js')` in every test file.
- The `app.listen` call in `server.js` is guarded by `if (process.env.NODE_ENV !== 'test')`, so no port is bound.
- Functions are exported via `if (process.env.NODE_ENV === 'test') { module.exports = { ... }; }`.
- No test shares state with another test; all inputs are constructed inline.

### Coverage scope

| Function | Test IDs | Count |
|---|---|---|
| `validateAnalysis` | VA-T1 – VA-T8 | 8 |
| `inspectLink` | IL-T1 – IL-T9 | 9 |
| `hasImageSignature` | IS-T1 – IS-T6 | 6 |
| `hasAudioSignature` | AS-T1 – AS-T9 | 9 |
| `recoverExactQuote` | RQ-T1 – RQ-T5 | 5 |
| Task 5 subtotal (REQ-5.6 to REQ-5.10) | | 37 |
| Malformed-completion guards (`validateAnalysis`) | FN-T1 to FN-T4 | 4 |
| `analyzeText` with an injected mock client, `analysisFailure` | AT-T1 to AT-T11 | 11 |
| **`tests/server.test.js` total at Task 6** | | **52** |
| `extractImageText` with an injected mock client (Task 7.6) | OC-T1 to OC-T8 | 8 |
| **`tests/server.test.js` total (current)** | | **60** |
| Rescue Mode (`tests/rescue.test.js`) at Task 6 | see below | 12 |
| Rescue Mode (`tests/rescue.test.js`) after Task 7.3 | see below | 17 |
| **`npm test` total at Task 6** | | **64** |
| **`npm test` total (current)** | | **77** |

### Rescue Mode and mock-client tests (Task 6)

`tests/rescue.test.js` (12 tests at Task 6, 17 after Task 7.3, which added source-attribution, CERT-In scope, Digital Arrest wording, bank wording and unchanged-112 tests) enumerates every non-empty combination of the four Rescue Mode scenarios (15 combinations) and, for each, every selection order. It checks deterministic ordering and the absence of duplicate steps. It checks that money selections include the bank and 1930 steps, that credentials or money selections include the bank step, and that arrest selections include the 112 step. It checks that only allow-listed helpline numbers and domains appear in step text, that every `SOURCES` entry has an `https://` URL, and that the static source list in `index.html` agrees with `SOURCES`. These are exhaustive scenario tests, not randomised property-based tests.

The `analyzeText` and `extractImageText` tests pass a hand-written client object (`{ chat: { completions: { create } } }`) in place of the Groq client, so they need no network and no `GROQ_API_KEY`. Each failure path is asserted to reject, which also shows that none of them can return a `Safe` classification.
### Out of scope

Frontend history logic (`saveHistoryBtn`, `renderHistory`, `clearHistoryBtn`) is not covered by automated tests because it requires a browser DOM environment. It is covered by the manual regression procedure documented in the detailed design sections below. Also not covered by automated tests: Rescue Mode DOM rendering and clipboard use, route-level behaviour (rate limiting, CSP headers, middleware order), and whether the Kiro hook fires.

### Mutation testing guidance

Temporarily removing the demotion rule in `validateAnalysis` (`if (riskLevel === 'Highly Dangerous' && breakdown.length === 0)`) must cause VA-T2 to fail and all other tests to continue passing. This confirms the test has genuine detection power for that code path.

---

## Detailed Design

### Task 1 — Remove duplicate image listener (BUG-01)

#### Decision: keep Block B, remove Block A

Block B (lines 1121–1307 in the current file) is the correct implementation. The reasons are:

| Concern | Block A | Block B |
|---|---|---|
| Resizes large images | No — sends the raw file encoded as base64 | Yes — canvas resize to max 1800 px |
| Compression | No | Yes — JPEG 0.82 |
| Object URL memory management | No — uses `FileReader` / data URL for preview; no cleanup | Yes — `URL.createObjectURL` + `URL.revokeObjectURL` |
| Pre-upload size limit | 6 MB (too tight for original images) | 12 MB pre-resize, 6 MB post-compress |
| Used by `extractImageBtn` handler | Sends `selectedImageData` directly (Block A's own variable) | Calls `prepareImage(selectedImageFile)` |

Block A's `extractImageBtn` click handler reads `selectedImageData` (a string populated by Block A's own `change` listener). Block B's `extractImageBtn` click handler reads `selectedImageFile` (a File object populated by Block B's own `change` listener). Both click handlers are registered on the same button element. At runtime, both fire on every click. Block B's handler runs second, reads `selectedImageFile` (which Block A's handler never clears), and calls `prepareImage`. The practical outcome is that Block B currently does most of the work, but Block A still fires first, sets `selectedImageData`, and its own API call is never made (because Block A's handler only reads from `selectedImageData` on button click, not on change). However, Block A's `change` listener does run on every file selection: it validates with the 6 MB limit and reads the file with `FileReader`, racing with Block B's listener. For a file between 6–12 MB, Block A sets an error message that Block B immediately overwrites. For any file, Block A's `FileReader` reads the full binary into a data URL in memory unnecessarily.

#### Removal scope

Remove lines 982–1120 from `public/index.html`. Specifically:

```
// --------------------------------------------------
// SCREENSHOT TOOL
// --------------------------------------------------

let selectedImageData = '';

$('imageInput').addEventListener('change', () => { ... });   ← remove

$('extractImageBtn').addEventListener('click', async () => { ... });  ← remove

$('analyzeImageTextBtn').addEventListener('click', async () => { ... });  ← remove
```

The section comment `// SCREENSHOT TOOL` on line 1121–1123 (which introduces Block B) becomes the sole screenshot section heading.

#### Variables removed

- `selectedImageData` (string, declared on line 986)

#### Variables preserved

- `selectedImageFile` (File | null) — declared by Block B
- `imagePreviewUrl` (string | null) — declared by Block B
- `prepareImage(file)` function — declared by Block B

#### `beforeunload` handler

The existing `beforeunload` handler (located after the voice recording section) references `imagePreviewUrl`:

```js
window.addEventListener('beforeunload', () => {
    stopMediaTracks();
    stopRecordingTimer();
    if (imagePreviewUrl) {
        URL.revokeObjectURL(imagePreviewUrl);
    }
});
```

This handler is in Block B's scope and must not be removed. It references only `imagePreviewUrl`, which is preserved. No change required.

#### No server-side changes

`/api/analyze-image` already accepts and validates a base64 data URL in its body. `prepareImage` returns a JPEG data URL, which is what the server expects. No change to `server.js` is needed.

---

### Task 2 — Remove duplicate history listeners (BUG-02)

#### Decision: keep Block C, remove Block D

Block C (lines 2124–2276) appears first and is identical to Block D (lines 2277–2429). The first appearance is the canonical one. Block D is the paste duplicate.

#### Removal scope

Remove lines 2277–2429 from `public/index.html` (after BUG-01 removal has shifted line numbers). The removal target is:

```
$('saveHistoryBtn').addEventListener('click', () => { ... });   ← remove (second copy)

function renderHistory() { ... }   ← remove (second copy)

$('clearHistoryBtn').addEventListener('click', () => { ... });   ← remove (second copy)
```

The end of the file after removal should be the closing `});` of Block C's `clearHistoryBtn` listener, followed by the closing `</script>` and `</body></html>` tags.

#### Note on line 2124

The first `saveHistoryBtn` listener begins at line 2124 with no preceding blank line — `}$('saveHistoryBtn')` — indicating the `getHistory` function's closing brace was on the same line as the start of the next statement. This is a formatting defect from the assembly but is not a bug. The removal of Block D does not touch this line.

#### Verification

After removal, a source scan for the string `saveHistoryBtn` must yield exactly two matches: the HTML `id="saveHistoryBtn"` attribute and the single `addEventListener` call. A scan for `renderHistory` must yield exactly three matches: the function definition, the call inside the history navigation handler, and the calls inside `clearHistoryBtn` and the delete button's listener.

#### Manual regression procedure

Because the history logic runs in a browser environment, the following manual procedure must be followed after BUG-02 is fixed:

1. Open the application in a browser.
2. Run an analysis (use the "Digital arrest" sample).
3. Click "Save locally".
4. Open browser DevTools → Application → Local Storage.
5. Inspect `scamLensHistoryV3`.
6. **Expected:** exactly one entry with the analysis result.
7. Navigate to History.
8. **Expected:** exactly one card for the saved analysis.
9. Reload the page.
10. Navigate to History.
11. **Expected:** still exactly one card — no duplication on reload.

---

### Task 3 — API key security

#### `.gitignore` assessment

The existing `.gitignore` already contains:

```
node_modules/
.env
.DS_Store
```

This is correct. `.env` is excluded. Two additions are needed:

```
*.log
npm-debug.log*
```

#### `.env.example` design

Create a new file `.env.example` at the project root:

```dotenv
# Copy this file to .env and fill in your real values.
# Never commit .env to source control.

PORT=3000
GROQ_API_KEY=your-groq-api-key-here
GROQ_MODEL=openai/gpt-oss-120b
GROQ_VISION_MODEL=qwen/qwen3.8-27b
GROQ_TRANSCRIPTION_MODEL=whisper-large-v3
```

The model name defaults are real values from the existing `.env` and are safe to include; they are not secrets. Only `GROQ_API_KEY` uses a placeholder.

#### `server.js` logging audit

A scan of `server.js` confirms that no `console.log`, `console.warn`, or `console.error` call outputs the value of `process.env.GROQ_API_KEY`. The startup log on `app.listen` prints `MODEL`, `VISION_MODEL`, and `TRANSCRIPTION_MODEL` (the model name strings) but not the API key. No change is needed.

---

### Task 4 — Content Security Policy

#### Resource inventory (post BUG-01 fix)

After BUG-01 is fixed, the application's resource requirements are:

| Resource type | Source | Required CSP directive |
|---|---|---|
| HTML document | `self` | `default-src 'self'` covers this |
| CSS stylesheet (`/style.css`) | `self` | `style-src 'self'` |
| Inline `<script>` block | Inline | `script-src` with nonce or hash |
| `fetch()` to `/api/*` | `self` | `connect-src 'self'` |
| `<img>` preview (blob URL) | `blob:` | `img-src 'self' blob:` |
| `<canvas>` drawing | Same-origin | No extra directive needed |
| Audio `Blob` for MediaRecorder | `blob:` | `media-src blob:` |
| Fonts | None | Not needed |
| External scripts/styles | None, except the same-origin `/rescue.js` script | Covered by the nonce on its `<script src>` tag |

No `data:` is needed in `img-src` after BUG-01 is fixed. Block A used a `FileReader`-generated data URL as the `<img src>`; Block B uses `URL.createObjectURL` which produces a `blob:` URL. However, `data:` is added as a defensive inclusion because the `privacy.html` page does not go through the same JavaScript, and browser-cached data: URLs can appear in edge cases. This is a low-risk addition.

#### Inline script handling — decision

| Option | Mechanism | Strength | Complexity |
|---|---|---|---|
| A — Nonce per request (chosen) | Random nonce generated per request, injected into HTML and CSP header | Strongest | Small: one `crypto.randomBytes` call + string replacement per request |
| B — Script hash | SHA-256 hash of exact script content in CSP header | Strong but fragile | Medium: any whitespace change breaks the hash |
| C — `unsafe-inline` | No verification of inline scripts | Weakest | Minimal |

**Decision: Option A (nonce).** The implementation is small and provides the strongest protection.

For `privacy.html`: no inline scripts exist there, so no nonce is needed. The baseline CSP (with `script-src 'self'` rather than a nonce) is sent with that response via `express.static`.

#### Final CSP header value

```
Content-Security-Policy:
  default-src 'self';
  script-src 'nonce-{nonce}';
  style-src 'self';
  img-src 'self' blob: data:;
  connect-src 'self';
  media-src blob:;
  object-src 'none';
  base-uri 'self';
  form-action 'self'
```

The nonce `{nonce}` is replaced per request.

#### Server-side implementation detail

1. Read `index.html` into memory at startup (once, synchronously, with `fs.readFileSync`).
2. Register `app.get('/', serveIndexWithNonce)` and `app.get('/index.html', serveIndexWithNonce)` **before** the `app.use(express.static(...))` call.
3. Add `{ index: false }` to the `express.static` call as an additional safeguard.
4. For each request to `/` or `/index.html`:
   a. Generate a nonce: `crypto.randomBytes(16).toString('base64')`.
   b. Replace every `nonce="CSP_NONCE_PLACEHOLDER"` in the in-memory HTML string (the inline script and the `rescue.js` script tag) with `nonce="{nonce}"`, using `replaceAll`.
   c. Set the nonce-bearing CSP header (overrides the baseline set by global middleware).
   d. Send the modified HTML.
5. All other static files receive the baseline CSP header set unconditionally by global middleware.

The existing global middleware block must set the **baseline CSP unconditionally** — on every request, with no path-based condition. The nonce route handlers then call `res.setHeader('Content-Security-Policy', ...)` again, which overwrites the baseline with the nonce-bearing variant before the response is sent.

**Required change to `index.html`:** add `nonce="CSP_NONCE_PLACEHOLDER"` to the `<script>` tag: `<script nonce="CSP_NONCE_PLACEHOLDER">`. The `<script src="/rescue.js">` tag that loads Rescue Mode carries the same placeholder.

#### `privacy.html` consideration

`privacy.html` contains no inline scripts. The baseline CSP is sent with that response. `privacy.html` does contain an inline `<style>` block. The `style-src 'self'` directive does not allow inline styles, which would break the page's appearance.

**Resolution:** Extract the inline `<style>` block from `privacy.html` into a new file `public/privacy.css` and replace the inline block with `<link rel="stylesheet" href="/privacy.css">`. This keeps `style-src 'self'` strict with no need for `unsafe-inline`.

---

### Task 5 — Automated tests

#### Framework decision: `node:test` (built-in)

Node.js 22 ships with a stable built-in test runner (`node:test`) and assertion library (`node:assert`). Using it requires:
- Zero new npm dependencies.
- No configuration file.
- Run with: `node --test tests/server.test.js`.

#### Exporting testable functions from `server.js`

Add at the bottom of `server.js`:

```js
// Export pure functions for unit testing (test runner only)
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

Wrap `app.listen` in a guard:

```js
if (process.env.NODE_ENV !== 'test') {
    app.listen(PORT, () => { ... });
}
```

#### Test file structure

```
tests/
  server.test.js    — validateAnalysis, inspectLink, hasImageSignature,
                      hasAudioSignature, recoverExactQuote
```

A file for frontend history tests is deferred: testing `localStorage` and DOM manipulation in Node.js requires JSDOM or a browser test runner (e.g. Playwright), which is out of scope. The history duplicate-prevention requirement (REQ-2.4) is covered by the manual regression procedure in the BUG-02 section above.

#### Test file outline (`tests/server.test.js`)

```js
'use strict';

process.env.NODE_ENV = 'test';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const {
    validateAnalysis,
    inspectLink,
    hasImageSignature,
    hasAudioSignature,
    recoverExactQuote
} = require('../server.js');

// --- validateAnalysis tests (VA-T1 through VA-T8) ---
// --- inspectLink tests (IL-T1 through IL-T9) ---
// --- hasImageSignature tests (IS-T1 through IS-T6) ---
// --- hasAudioSignature tests (AS-T1 through AS-T9) ---
// --- recoverExactQuote tests (RQ-T1 through RQ-T5) ---
```

#### `package.json` changes

```json
"scripts": {
    "start": "node server.js",
    "test": "node --test tests/server.test.js"
}
```

No `devDependencies` are added when using `node:test`.

Task 6 later changed the `test` script to `node --test tests/server.test.js tests/rescue.test.js` so that the Rescue Mode tests also run under `npm test`.

### Task 6 - Post-audit fixes

Task 6 implements the confirmed findings of an independent audit carried out in November 2026. It adds to Tasks 1-5 and does not reopen their decisions, except where noted. Audit finding IDs (BUG-A, REL-A and so on) refer to that audit report. Sub-sections are lettered 6.A to 6.F; the matching sub-task numbers in `tasks.md` are given in each heading.

#### 6.A Test command (tasks.md 6.1, audit BUG-A)

Requirements: REQ-6.1 to REQ-6.3.

`tests/rescue.test.js` existed but `npm test` did not run it, so a Rescue Mode regression would have passed unnoticed. The script is now `node --test tests/server.test.js tests/rescue.test.js`. Explicit file paths are used instead of a glob because `cmd.exe` and PowerShell do not expand globs, so the explicit form behaves the same on every platform. No dependency is added.

#### 6.B Rescue Mode source attribution (tasks.md 6.2, audit BUG-D)

Requirements: REQ-6.4 to REQ-6.10.

- `SOURCES.verify` in `public/rescue.js` has the label "I4C / NCTAU: Digital Arrest Scam Advisory, 6 March 2025" and the URL `https://cybercrime.gov.in/pdf/Advisories/ADVISORYTAU-ADV-003DigitalArrest06.03.2025.pdf`. The URL was previously `null`, so no link appeared beside the step.
- The static "Official guidance used" list in `index.html` uses the same URL and label, so the dynamic checklist and the static list cannot cite different documents. Task 7.3 later changed the wording and the CERT-In and PIB labels (see Task 7.3 below).
- The checklist builds each source note with DOM APIs (`textContent`, `createElement('a')`) and never with `innerHTML`. Links open with `target="_blank"` and `rel="noopener noreferrer"`.
- The URL was supplied by the project owner. The implementation environment could not read PDF content, so the agent did not machine-check the document against the claim it supports. The owner later confirmed the I4C and CERT-In sources (2026-11-18, Task 7.3).
- The guidance text, the 1930 and 112 references and the step ordering are unchanged.
- Tests: Properties 33 and 34.

#### 6.C Truncated and invalid AI responses (tasks.md 6.7 and 6.8, audit REL-A and BUG-E)

Requirements: REQ-6.11 to REQ-6.19.

Decisions:

- No retry loop is added. The `openai` SDK (installed version 7.55.0) retries 429 and 5xx responses itself (`maxRetries` defaults to 2), so a second loop would multiply requests and cost.
- `max_completion_tokens` stays at 3000. A larger limit would only move the point at which a long answer is cut off and raise the cost of every request. A cut-off answer is treated as an error instead.
- `analyzeText(message, language = 'auto', client = groq)` accepts an injected client. Production calls use the default and tests pass a mock, so every failure path can be tested without a network or a key. A comment on the function and on the export marks it as benchmark and test only, because the default client needs a live `GROQ_API_KEY`.
- Failures are raised as `AnalysisError(code, userMessage)`, checked in this order:

| Order | Condition | `code` | Note |
|---|---|---|---|
| 1 | No `choices[0]` | `no_choice` | |
| 2 | `finish_reason === 'length'` | `truncated` | Checked before the empty-content test, because a reasoning model can use its whole budget and return empty content. A cut-off reply is rejected even when its content happens to parse. |
| 3 | Content is not a non-empty string | `empty` | |
| 4 | `JSON.parse` throws | `malformed_json` | The original `SyntaxError` is discarded because its message can quote model output. |
| 5 | `validateAnalysis` throws | `invalid_shape` | `validateAnalysis` and its error messages are unchanged. |

- `analysisFailure(error)` returns `{ status: 502, message }`. An `AnalysisError` yields its own `userMessage`. Any other error, such as a provider or network failure, yields the generic "Message analysis failed. Please try again in a moment." The log line records only `{ code }` or `{ status, code }`. It never records `error.message`, model output or the submitted message.
- The `/api/analyze` catch block uses `analysisFailure`. Before this change every error produced one message telling the user to check the backend terminal and the Groq configuration. That is operator detail, and it hid the real cause from the user.
- No failure path returns a classification, so a failed or truncated analysis can never appear as `Safe`.
- Frontend: no change was needed. `fetchJson` throws the server's error text, the submit handler shows it in `#textError`, and its `finally` block re-enables the button so the user can retry.
- Not changed in Task 6: `/api/analyze-image` and `/api/transcribe` did not check `finish_reason`. Task 7.6 later added the check to `/api/analyze-image` (see "Task 7.6 and 7.7" below). `/api/transcribe` is still unchanged.
- Tests: Properties 27 to 32.

#### 6.D Removal of non-functional feedback controls (tasks.md 6.11)

Requirements: REQ-6.20 to REQ-6.22.

The "Was this analysis useful?" Yes and No buttons had no event handler and stored nothing. They are removed from `index.html`, together with the three statements in `renderAnalysis` that cleared `#feedbackStatus` and re-enabled the two buttons. Removing only the markup would have made those statements throw a `TypeError` on every result render. The unused `.feedback-section` rules remain in `style.css`. In `privacy.html` the section 5 heading is now "History in your browser" and the sentence about locally stored feedback counts is removed. No feedback storage is introduced. The "Last updated" date is unchanged because the data the application handles did not change.

#### 6.E Repository and documentation files (tasks.md 6.3 to 6.6)

Requirements: REQ-6.23 to REQ-6.28.

| File | Decision |
|---|---|
| `LICENSE` | MIT, 2026. The copyright holder is "Lakshya Garg", the name already credited in `privacy.html` and the page metadata. The owner should change it if a different holder is intended. |
| `README.md` | Public README. It states limitations, makes no accuracy claim, and contains no demo or repository URL until those exist. Its test counts must match `npm test`. |
| `README.txt` | An optional internal handoff note. Listed in `.gitignore` so it is not published if it exists. It is not required on disk (REQ-6.25 was amended on 2026-11-18). |
| `.env.example` | Documents `TRUST_PROXY` as a commented-out entry, with a warning not to enable it on a directly exposed server. |
| `.gitignore` | Adds `README.txt`. No pattern matches `.kiro/`, which must stay committed. |

#### 6.F Kiro workspace configuration (tasks.md 6.9 and 6.10)

Requirements: REQ-6.29 to REQ-6.34.

- Steering: `.kiro/steering/product.md`, `tech-stack.md` and `structure.md`, each with front matter `inclusion: always`. They describe only what exists in the repository and must be updated when the stack, the structure or the test counts change.
- Hook: `.kiro/hooks/run-tests-on-save.json` uses the current v1 schema (`version`, then `hooks[]` entries with `name`, `trigger`, `matcher`, `action`, `timeout` and `enabled`). The older `when` and `then` format found in many articles is not used. Its settings:
  - `trigger`: `PostFileSave`
  - `matcher`: `(^|[\\/])(server\.js|rescue\.js|index\.html|[^\\/]+\.test\.js)$`, a regular expression tested against the file path
  - `action`: `{ "type": "command", "command": "npm test" }`
  - `timeout`: 120 seconds
  - `enabled`: `true`
- The matcher selects `server.js`, `rescue.js`, `index.html` and `*.test.js`. It does not select documentation, `package.json` or CSS. It matches a file with one of those names in any folder; this repository has one `index.html`, so the effect equals a stricter pattern.
- Kiro's documentation describes `PostFileSave` as firing when the agent saves or modifies a file, so a manual save in the editor may not trigger it. A non-zero exit reports stderr to the agent. The hook was not observed firing inside a Kiro session during implementation.
- Alternatives considered:
  - The `Stop` trigger was rejected because it runs after every agent turn, including documentation-only turns.
  - An `agent` prompt action was rejected because it is not deterministic.
  - The `matcher` is a regular expression tested against the file path. It matches `index.html` in any folder, which in this repository is the same file as `public/index.html`.
- Matcher coverage is checked by Acceptance Criterion 24 of `requirements.md`. No automated test asserts it.
- The hook has never been observed firing (REQ-6.34). Task 7.4 is deferred: actual execution could not be independently verified.
- The command is offline and needs no Groq key, so the hook cannot spend credits.

#### Task 6 file changes

| File | Change |
|---|---|
| `package.json` | `test` script runs both test files |
| `server.js` | `AnalysisError`, `analysisFailure`, injectable client in `analyzeText`, new `/api/analyze` catch block, extra test-only exports |
| `public/rescue.js` | `SOURCES.verify` label and URL |
| `public/index.html` | Static source link updated; feedback controls and their script references removed |
| `public/privacy.html` | Section 5 heading and feedback sentence |
| `tests/server.test.js` | FN-T1 to FN-T4 and AT-T1 to AT-T11 added; existing tests unchanged |
| `tests/rescue.test.js` | Source test strengthened; static-list agreement test added |
| `.env.example`, `.gitignore`, `LICENSE`, `README.md` | As in 6.E |
| `.kiro/steering/*.md`, `.kiro/hooks/run-tests-on-save.json` | As in 6.F |
| `.kiro/specs/stability-security/tasks.md` | Task 6 and its checklist added |

#### Acceptance criteria verification

This table maps the 25 acceptance criteria of Requirement 6 in `requirements.md` to how each is verified. "Test" means an automated test in `npm test`; "file check" and "code inspection" are done by reading the file; "manual" needs a person.

| Criterion | Verified by |
|---|---|
| 1 | File check: `package.json` `scripts.test` and absence of `devDependencies`. No test asserts it. |
| 2 | Manual run of `npm test`: 64 tests at Task 6 completion (52 in `tests/server.test.js`, 12 in `tests/rescue.test.js`); 69 after Task 7.3 (17 rescue tests); 77 after Task 7.6 (60 server, 17 rescue). No test asserts the count. |
| 3 | Manual: make a rescue test fail and run `npm test`. No test asserts it. |
| 4 | Manual run of `npm test` with `GROQ_API_KEY` defined but empty. No test asserts it; the tests use mock clients and no network code. The machine was not disconnected from the network (Task 7.5). |
| 5 | Test: `claim-bearing steps carry a visible source label` (every `SOURCES` url must be an `https://` string). |
| 6 | Test: `dynamic and static Rescue Mode sources agree and links are safe` checks the exact label and URL of all four sources (I4C / NCTAU, RBI, CERT-In, PIB) against the static list, and the reviewed date (18 November 2026). |
| 7 | Test: `dynamic and static Rescue Mode sources agree and links are safe` (URL as `href="..."` and label in `index.html`). |
| 8 | Test: `dynamic and static Rescue Mode sources agree and links are safe` (`rel="noopener noreferrer"` on every `target="_blank"` tag). |
| 9 | Code inspection of the Rescue Mode source note code in `public/index.html`. |
| 10 | Test: AT-T3, AT-T4, AT-T5 (partial, complete and empty content with `finish_reason: 'length'`). |
| 11 | Test: AT-T8 (`no_choice`), AT-T7 (`empty`), AT-T6 (`malformed_json`). |
| 12 | Test: AT-T10 (`invalid_shape`). |
| 13 | Test: AT-T11 (no failure case resolves to a value). |
| 14 | Test: AT-T9 (provider error, generic message with no provider text) and AT-T10 (`AnalysisError` user message, status 502). |
| 15 | Code inspection of the `console` calls in `server.js` on the `/api/analyze` failure path. |
| 16 | File check: search `public/index.html` for the three strings. |
| 17 | File check or code inspection of `localStorage` use in `public/index.html`. |
| 18 | Code inspection of `public/privacy.html`. |
| 19 | File check of `LICENSE`. |
| 20 | File check of `README.md`, including the 64-test statement. |
| 21 | File check of `README.md`, `.gitignore` and the `.kiro/` ignore rule. `README.txt` is optional; if present, it must be ignored by Git. |
| 22 | File check of `.env.example`. |
| 23 | File check of the three steering files. |
| 24 | File check of `.kiro/hooks/run-tests-on-save.json` and manual matching of the regular expression against the listed paths. No test asserts it. |
| 25 | Manual owner action: open the advisory PDF and confirm the claim. Done 2026-11-18 (Task 7.3). |

#### Task 7.3 Rescue Mode source wording (tasks.md 7.3)

Task 6.B and 6.13 above record the earlier state (one source on `SOURCES.verify`). Task 7.3 supersedes the wording and source list as follows. The 6.13 history is unchanged.

- `public/rescue.js` has `SOURCE_LIST` with four entries, and `RESCUE_REVIEWED_DATE = '18 November 2026'`. Both are exported.
  - I4C: "I4C / NCTAU: Digital Arrest Scam Advisory, 6 March 2025", `https://cybercrime.gov.in/pdf/Advisories/ADVISORYTAU-ADV-003DigitalArrest06.03.2025.pdf`
  - RBI (unchanged): "RBI: Reporting unauthorised transactions"
  - CERT-In: "CERT-In: Sophisticated RTO/eChallan-themed Android Malware Advisory, 17 March 2026"
  - PIB: "PIB (Ministry of Home Affairs): Digital Arrest warning, 27 October 2024"
- `SOURCES` maps step ids to a source plus a `note` that says what the source supports: `verify` to I4C, `endCall` to PIB, `bank` to RBI, `disconnect` and `device` to CERT-In. `renderRescueChecklist` in `index.html` shows the note with `textContent`.
- Step wording:
  - `verify`: no concept of "Digital Arrest" under Indian law; scammers impersonate government and law-enforcement officials; contact the nearest police station independently; share no personal or financial information before verifying. Customs, ED and judges are no longer mentioned.
  - `endCall`: carries the PIB claims only (impersonation of police, CBI, anti-narcotics or RBI officers; no government agency investigates by phone or video call) and reporting through 1930 or cybercrime.gov.in.
  - `bank`: notify the bank immediately, get an acknowledgement, delay may increase loss, no promise of recovery. The remainder is labelled "General safety advice (not from RBI)". RBI page text was read on 18 November 2026 and supports the three RBI claims.
  - `disconnect` and `device`: the CERT-In note says the advisory is about a specific Android e-Challan malware campaign and not every remote-access or screen-sharing incident, and lists its precautions. Other advice is labelled "General safety advice".
  - `emergency112`: unchanged, asserted verbatim by a test.
- The static "Official guidance used" list in `index.html` uses the four labels and URLs above and the review date "18 November 2026".
- The PIB release and RBI page were read by the agent. The owner independently verified the I4C PDF and the CERT-In advisory. Verified against the four official sources on 2026-11-18. Task 7.3 is closed.
- Tests: `tests/rescue.test.js` has 17 tests after Task 7.3 (69 in `npm test` at that point; 77 after Task 7.6). The count of 64 describes the state before Task 7.3.
#### Task 7.6 and 7.7 OCR truncation and unused CSS (tasks.md 7.6, 7.7)

- Task 7.6: the vision call in `/api/analyze-image` now lives in `extractImageText(imageDataUrl, client = groq)`. The client is injectable, as in `analyzeText`, so tests use a mock and no key. When `choices[0].finish_reason === 'length'`, the function throws `AnalysisError('truncated', ...)` before it reads the content. A cut-off OCR result, including an empty one, is therefore never returned as a success. The endpoint's catch block returns an `AnalysisError`'s `userMessage` with status 502 and logs only `{ code }`. Other errors keep the existing generic 502 message and log.
- Unchanged: image validation, the 6 MB limit, MIME and signature checks, the vision model, `max_completion_tokens: 2500`, the prompt, the 422 "no readable text" answer, and the human review step before analysis.
- Tests: `tests/server.test.js` OC-T1 to OC-T8. The HTTP route itself has no test, because the project has no HTTP test harness. The validation code above the extraction call was not edited.
- Task 7.7: `.feedback-section` was used only in `public/style.css` (one screen rule and one entry in the print rule list). Nothing in markup, scripts, tests or documents referenced it, so both were removed.
- Suite after Task 7.6: 77 tests (60 in `tests/server.test.js`, 17 in `tests/rescue.test.js`).

#### Open items and known gaps

- `/api/transcribe` does not check `finish_reason` (REQ-6.19). `/api/analyze-image` has checked it since Task 7.6.
- The I4C and CERT-In sources were verified by the owner on 2026-11-18 (Task 7.3, closed). The owner confirmed that the I4C advisory supports the "Verify the claimed authority independently" step (REQ-6.10, Acceptance Criterion 25). No longer an open gap.
- The `PostFileSave` hook has not been observed firing (REQ-6.34); see the deferred item below.
- `README.txt` is optional. REQ-6.25 and Acceptance Criterion 21 were amended on 2026-11-18 so its absence is acceptable; the `.gitignore` rule stays. This is no longer an open gap.
- The unused `.feedback-section` rules were removed from `public/style.css` in Task 7.7. This is no longer an open gap.
- The `PostFileSave` hook is deferred (Task 7.4): actual execution could not be independently verified.

---

## File Change Summary

This table covers Tasks 1-5. Task 6 file changes are listed at the end of the Task 6 section of the Detailed Design.

| File | Change type | Description |
|---|---|---|
| `public/index.html` | Edit | Remove Block A (lines 982–1120). Remove Block D (lines 2277–2429, shifted after Block A removal). Add `nonce="CSP_NONCE_PLACEHOLDER"` to `<script>` tag. |
| `public/privacy.html` | Edit | Replace inline `<style>` block with `<link rel="stylesheet" href="/privacy.css">`. |
| `public/privacy.css` | Create | New file containing the styles extracted from `privacy.html`'s inline `<style>` block. |
| `server.js` | Edit | Add baseline CSP header to global middleware (unconditional). Register explicit `/` and `/index.html` routes before `express.static`. Add `{ index: false }` to `express.static`. Add nonce injection for HTML routes. Add `app.listen` guard. Add conditional exports for test runner. |
| `.gitignore` | Edit | Add `*.log` and `npm-debug.log*`. |
| `.env.example` | Create | New file with placeholder values. |
| `tests/server.test.js` | Create | New file: all server-side unit tests. |
| `package.json` | Edit | Add `"test"` script. |

---

## What Is Explicitly Not Changed

_This list describes Tasks 1-5. Task 6 deliberately changes some of these items: the `/api/analyze` error handling and `analyzeText`, the privacy heading and feedback sentence, the static source link, and the removed feedback controls in `index.html`. See the Task 6 section of the Detailed Design._

- The system prompt in `server.js` — untouched.
- All four API endpoints and their logic — untouched (except the `app.listen` guard; Task 7.6 later moved the `/api/analyze-image` vision call into `extractImageText` and added the truncation check).
- All rate limiting, file signature validation, and response sanitisation — untouched.
- `public/style.css` — untouched (Task 7.7 later removed the unused `.feedback-section` rules).
- `public/privacy.html` — inline `<style>` block extracted to `privacy.css`; otherwise untouched.
- `public/robots.txt` — untouched.
- `README.txt` — untouched.
- All navigation, tool workflows, voice recording, link checker, results rendering, and report actions — untouched.
- `package.json` dependencies (only `scripts` changes) — `express`, `dotenv`, `openai` are preserved as-is.

---

## Glossary

| Term | Definition |
|---|---|
| Block A | The first (redundant) screenshot workflow in `index.html`, declared at lines 982–1120, which uses `FileReader` and no canvas resize. Must be removed. |
| Block B | The second (correct) screenshot workflow in `index.html`, declared at lines 1121–1307, which uses canvas resize and `URL.createObjectURL`. Must be kept. |
| Block C | The first (canonical) history save/render/clear implementation in `index.html`, lines 2124–2276. Must be kept. |
| Block D | The second (duplicate) history save/render/clear implementation in `index.html`, lines 2277–2429. Must be removed. |
| CSP | Content Security Policy — an HTTP response header that instructs the browser to restrict the sources from which scripts, styles, images, and other resources can be loaded. |
| Nonce | A cryptographically random value generated per HTTP request, injected into both the `<script>` tag and the `Content-Security-Policy` header so the browser can verify the inline script is server-authorised. |
| `prepareImage` | A client-side function in Block B that resizes an image to max 1800 px and compresses it to JPEG 0.82 before sending to `/api/analyze-image`. |
| `recoverExactQuote` | A server-side pure function that verifies a proposed suspicious phrase is a verbatim substring of the original message, using case-insensitive, whitespace-normalised regex matching. |
| `validateAnalysis` | A server-side pure function that sanitises and validates the raw JSON object returned by the AI model before it is sent to the client. |
| `inspectLink` | A server-side pure function that performs structural analysis of a submitted URL without making any network request to the destination. |
| `hasImageSignature` | A server-side pure function that checks the magic bytes of a buffer to verify it matches a declared image MIME type. |
| `hasAudioSignature` | A server-side pure function that checks the magic bytes of a buffer to verify it matches a declared audio file extension. |
| `scamLensHistoryV3` | The `localStorage` key under which Scam Lens stores up to 15 saved analysis reports in the user's browser. |
| `AnalysisError` | An error type thrown by `analyzeText` for truncated, empty, malformed or invalid AI output. It carries a short `code` and a user-safe `userMessage`. |
| `analysisFailure` | A function that maps any error from `analyzeText` to `{ status: 502, message }` and logs only an error code or HTTP status. |
| `rescue.js` | The UMD module holding Rescue Mode steps, ordering and sources. It makes no AI calls and is loaded by the browser and imported by the Node tests. |
| `SOURCES` | The map in `rescue.js` from a Rescue Mode step id to the label, URL and scope note of the official source for its claim. |
| `SOURCE_LIST` | The map in `rescue.js` of the four official sources (I4C / NCTAU, RBI, CERT-In, PIB) with exact labels and URLs, matched against the static list in `index.html`. |
| PostFileSave hook | The Kiro hook `.kiro/hooks/run-tests-on-save.json`, which runs `npm test` when the agent saves a matching file. |
