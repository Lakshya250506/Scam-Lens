# Requirements Document

## Introduction

### Project: Scam Lens – Stability and Security Improvements

| Field | Value |
|---|---|
| Spec title | Scam Lens – Stability and Security Improvements |
| Source of truth | Architecture audit conducted November 2026 |
| Deadline | November 21, 2026 |
| Scope | Bug fixes, security hardening, test coverage and post-audit fixes (Requirement 6, including documentation, licence and Kiro workspace files, and two small user-visible changes). No new product features, no database. |

The architecture audit identified two functional bugs introduced by copy-paste assembly of `public/index.html`, one exposed API credential, one missing HTTP security header, and a complete absence of automated tests. These issues must be fixed before the application is demonstrated publicly or submitted to a hackathon.

This specification covers six areas: the five above (Requirements 1-5) and the post-audit fixes in Requirement 6. Requirement 6 covers findings from an independent audit in November 2026, carried out after Requirements 1-5 were implemented. Nothing else is in scope.

## Requirements

### Requirement 1: Duplicate image event listeners (BUG-01)

**User Story:** As a developer maintaining Scam Lens, I want `public/index.html` to have exactly one image-selection workflow, so that file selection, preview, compression, and OCR extraction each fire exactly once per user action.

#### Context

`public/index.html` contains two complete implementations of the screenshot image-selection workflow, registered against the same DOM element (`#imageInput`). Both implementations attach a `change` event listener to `#imageInput`. Both attach `click` listeners to `#extractImageBtn` and `#analyzeImageTextBtn`.

**Block A (lines 982–1120):**
- Declares `selectedImageData` (string).
- `change` listener: validates MIME type, rejects files > 6 MB, reads the file with `FileReader.readAsDataURL`, stores the data URL in `selectedImageData`, shows preview via `<img src=dataUrl>`.
- `extractImageBtn` click: sends `selectedImageData` directly to `/api/analyze-image`.
- Uses `FileReader` base64 encoding; no canvas resize.

**Block B (lines 1121–1307):**
- Declares `selectedImageFile` (File) and `imagePreviewUrl` (object URL string).
- `change` listener: validates MIME type, rejects files > 12 MB, creates a preview via `URL.createObjectURL`, properly revokes the previous object URL.
- `prepareImage(file)` function: draws the image onto a canvas capped at 1800 px on the longest edge, compresses to JPEG at 0.82 quality, checks the compressed result is ≤ 6 MB, returns the final data URL.
- `extractImageBtn` click: calls `prepareImage`, then sends the compressed data URL to `/api/analyze-image`.
- Uses canvas resize and compression.

Block B is the correct implementation. It is the only one that resizes large images before sending to the API, properly manages object URLs to avoid memory leaks, and has a sensible pre-resize size limit (12 MB) so the user is not incorrectly rejected before compression. Block A is the redundant implementation and must be removed.

#### Functional Requirements

- REQ-1.1: There must be exactly one `change` event listener registered on `#imageInput`.
- REQ-1.2: There must be exactly one `click` event listener registered on `#extractImageBtn`.
- REQ-1.3: There must be exactly one `click` event listener registered on `#analyzeImageTextBtn` for the image workflow.
- REQ-1.4: The surviving implementation must use canvas-based resizing (`prepareImage`) before sending image data to `/api/analyze-image`.
- REQ-1.5: The surviving implementation must accept files up to 12 MB before compression and reject the compressed result if it exceeds 6 MB.
- REQ-1.6: The surviving implementation must use `URL.createObjectURL` for the preview and revoke the previous object URL when a new file is selected.
- REQ-1.7: The variable `selectedImageData` and all code that reads or writes it must be removed along with Block A.
- REQ-1.8: Image preview, OCR extraction, extracted-text editing, and "Analyze extracted text" must continue to work exactly as they do in Block B after Block A is removed.
- REQ-1.9: The `beforeunload` handler that revokes `imagePreviewUrl` must be preserved.

#### Acceptance Criteria

1. Selecting a valid image file displays the preview exactly once.
2. Selecting a 7 MB PNG displays a preview and does not show an error.
3. Selecting a 13 MB file shows the error "Please select an image smaller than 12 MB." without a preview.
4. Clicking "Extract text from screenshot" on a valid file calls `prepareImage` and sends a compressed JPEG data URL to the API.
5. The variable `selectedImageData` does not appear anywhere in the HTML or script after the fix.
6. Selecting a new file after a previous selection revokes the old object URL and does not leave a dangling reference.

---

### Requirement 2: Duplicate history event listeners (BUG-02)

**User Story:** As a developer maintaining Scam Lens, I want `public/index.html` to register each history event listener and function exactly once, so that saving a report creates exactly one `localStorage` entry and the history view shows no duplicate cards.

#### Context

`public/index.html` contains two complete implementations of the history save/render/clear workflow.

**Block C (lines 2124–2276):**
- `saveHistoryBtn` click handler: reads `getHistory()`, unshifts new entry, writes back sliced to 15, shows "Report saved locally on this device." status, disables the button.
- `renderHistory()` function: clears `#historyList`, iterates history, creates cards with "View report" and "Delete" buttons.
- `clearHistoryBtn` click handler: confirms, removes `HISTORY_KEY` from localStorage, calls `renderHistory()`.

**Block D (lines 2277–2429):** Byte-for-byte identical to Block C. It was pasted again during assembly.

Block C is the canonical implementation (it appears first). Block D must be removed in its entirety. The boundary between Block C and Block D is line 2276 (closing `});` of Block C's `clearHistoryBtn` handler). Block D begins at line 2277.

#### Functional Requirements

- REQ-2.1: There must be exactly one `click` event listener registered on `#saveHistoryBtn`.
- REQ-2.2: There must be exactly one `renderHistory` function definition in the script.
- REQ-2.3: There must be exactly one `click` event listener registered on `#clearHistoryBtn`.
- REQ-2.4: Clicking "Save locally" once must create exactly one new entry in `localStorage` under `scamLensHistoryV3`.
- REQ-2.5: After saving, clicking "Save locally" a second time for the same analysis must have no effect (the button remains disabled).
- REQ-2.6: The History view must display each saved report exactly once.
- REQ-2.7: "Delete" on a history card must remove exactly that entry. "Delete all" must remove all entries.

#### Acceptance Criteria

1. After `saveHistoryBtn` click, `localStorage.getItem('scamLensHistoryV3')` parsed as JSON contains exactly one new entry for the saved analysis.
2. After saving, navigating to History shows exactly one new card.
3. Reloading the page and navigating to History still shows exactly one entry for the saved analysis (not two).
4. `renderHistory` is defined exactly once in the script source.
5. `clearHistoryBtn` listener is registered exactly once; clicking "Delete all" removes all entries without error.

---

### Requirement 3: API key security

**User Story:** As a developer committing Scam Lens to a repository, I want `.env` excluded from Git and a `.env.example` template committed in its place, so that collaborators can configure the application without ever needing to see or share the real API key.

#### Context

The `.env` file at the project root contains a live Groq API key. This file was included in the uploaded project archive, so the key was exposed through that archive. The project owner must rotate the key; this is a manual action outside the repository (the owner confirmed on 2026-11-18 that the exposed key was revoked and a new key was set in the local `.env`; the agent did not check `.env`). The repository must never contain the key value. A `.gitignore` file exists and correctly excludes `.env`. The gap is the absence of a `.env.example` template file. Without it, a collaborator cloning the repository has no guide for which variables are required, increasing the chance that they will request or share a copy of the real `.env`.

#### Functional Requirements

- REQ-3.1: `.gitignore` must include `.env` on its own line. It already does; this must be verified and left unchanged.
- REQ-3.2: A file named `.env.example` must exist at the project root containing placeholder values for every variable used by `server.js`: `PORT`, `GROQ_API_KEY`, `GROQ_MODEL`, `GROQ_VISION_MODEL`, `GROQ_TRANSCRIPTION_MODEL`.
- REQ-3.3: `.env.example` must not contain any real API key or secret. Every secret field must use a clearly fictitious placeholder (e.g. `your-groq-api-key-here`).
- REQ-3.4: `.env.example` must be committed to the repository (it must NOT appear in `.gitignore`).
- REQ-3.5: `server.js` must not log the value of `GROQ_API_KEY` or any other secret at any log level. (Verify existing code; no change needed if already compliant.)
- REQ-3.6: The `.gitignore` must also exclude common editor and OS artefacts: `.DS_Store` (already present), `*.log`, and `npm-debug.log*`.

#### Acceptance Criteria

1. `git check-ignore -v .env` reports that `.env` is ignored.
2. `.env.example` exists and is tracked by Git.
3. `.env.example` contains no string beginning with `gsk_` or any other real credential pattern.
4. `server.js` contains no `console.log` or `console.error` call that outputs `process.env.GROQ_API_KEY`.
5. Running `grep -r "gsk_" .` from the project root (excluding `node_modules`) returns no results after the key is rotated.

---

### Requirement 4: Content Security Policy

**User Story:** As a user of Scam Lens, I want every HTTP response to include a `Content-Security-Policy` header, so that the browser provides a second layer of defence against injected scripts and security scanners do not flag the application.

#### Context

No `Content-Security-Policy` (CSP) header is currently set by `server.js`. All AI-generated content is inserted via `textContent` (never `innerHTML`), so there is no current XSS vector through AI output. However, the absence of a CSP means the browser provides no second layer of defence and security scanners will flag this as a missing control.

The CSP must not break any existing functionality. The relevant resource requirements of the application are:

- All HTML, CSS, JS, and images are served from the same origin (`self`).
- `index.html` contains two script tags that carry the nonce placeholder: an inline `<script>` block and the same-origin `<script src="/rescue.js">`. A third inline `<script type="application/ld+json">` block is a data block and is not executed.
- There are no third-party scripts, fonts, or CSS.
- The application uses `fetch()` to call `/api/*` on the same origin.
- The screenshot tool uses `URL.createObjectURL` and a `<canvas>` element. Object URL blobs are same-origin; canvas operations are same-origin. Neither requires extra CSP directives.
- The voice tool uses `navigator.mediaDevices.getUserMedia`. This is controlled by the `Permissions-Policy` header (already set), not CSP.
- The `<img>` preview tag loads a blob URL (`blob:`) after BUG-01 is fixed.
- No external images are loaded.
- `eval()` and `new Function()` are not used anywhere.
- `privacy.html` currently contains an inline `<style>` block. That block must be extracted into a separate file (`public/privacy.css`) and linked with `<link rel="stylesheet">`, so that `unsafe-inline` is not required in `style-src` for any response.

#### Functional Requirements

- REQ-4.1: `server.js` must set a `Content-Security-Policy` header on all responses (not just API routes).
- REQ-4.2: The policy must include `default-src 'self'`.
- REQ-4.3: Because the page contains an inline script, the policy must include a `script-src` directive that allows it. The preferred mechanism is a nonce. `server.js` must generate a cryptographically random nonce per request, replace every occurrence of the nonce placeholder in the HTML response (both the inline `<script>` and `<script src="/rescue.js">`, not only the first), and include the nonce in the CSP header. If a hash is used instead, the hash of the exact script content must be computed and placed in the header.
- REQ-4.4: `unsafe-inline` for `script-src` is permitted only if a nonce or hash approach introduces disproportionate implementation complexity relative to the hackathon timeline. If `unsafe-inline` is used, it must be documented as a known limitation with a TODO comment referencing the nonce migration path.
- REQ-4.5: `style-src` must allow `'self'` for external stylesheets. `privacy.html` currently contains an inline `<style>` block. That block must be extracted into a separate file (`public/privacy.css`) and linked with `<link rel="stylesheet">`, so that `unsafe-inline` is not required in `style-src` for any response.
- REQ-4.6: `img-src` must allow `'self'`, `blob:`, and `data:` to support the image preview (blob URL after BUG-01 fix, plus any browser-generated data URL paths).
- REQ-4.7: `connect-src` must allow `'self'` for `fetch()` calls to `/api/*`.
- REQ-4.8: `media-src` must allow `blob:` for the MediaRecorder-generated audio blobs used in the voice tool.
- REQ-4.9: `object-src` must be `'none'`.
- REQ-4.10: `base-uri` must be `'self'`.
- REQ-4.11: `form-action` must be `'self'`.
- REQ-4.12: The CSP must not break screenshot preview, canvas image compression, voice recording, audio file upload, link checking, or report printing.

#### Acceptance Criteria

1. Every HTTP response from the server includes a `Content-Security-Policy` header.
2. The policy value satisfies `default-src 'self'` as the base.
3. Loading the application in a browser with CSP violation reporting enabled produces no CSP violations during normal use of all four tools.
4. The browser console shows no CSP violation errors when using the screenshot tool, voice recording tool, or report print function.
5. Attempting to load an external script (e.g. injected via browser console) is blocked by the policy.

---

### Requirement 5: Automated tests

**User Story:** As a developer working on Scam Lens, I want a `npm test` command that runs automated unit tests for all pure server-side functions, so that regressions in validation logic are caught before the application is demonstrated or deployed.

#### Context

There are currently zero automated tests. The application has several pure functions in `server.js` that are straightforward to unit-test: `validateAnalysis`, `inspectLink`, `hasImageSignature`, `hasAudioSignature`, and `recoverExactQuote`. The history save/render workflow in the frontend is stateful but can be exercised with a lightweight DOM testing approach.

The testing framework must:
- Run with `npm test` using no additional dependencies. The project uses no `devDependencies`.
- Not require a running server or live Groq API key.
- Not introduce a build step.
- Produce clear pass/fail output in the terminal.
- Be fast (full suite < 10 seconds on first run after `npm install`).

The recommended framework is **Node.js's built-in test runner** (`node:test` with `node:assert`), available since Node 18 and stable in Node 22, which is the project's minimum version. This requires zero additional dependencies. If a richer assertion library or test runner is preferred, **Vitest** (requires one devDependency) is the alternative.

#### Functional Requirements

- REQ-5.1: A `tests/` directory must exist at the project root.
- REQ-5.2: `package.json` must include a `"test"` script that runs the test suite. Originally `node --test tests/server.test.js`; Requirement 6 (REQ-6.1) now owns the command and extends it to `node --test tests/server.test.js tests/rescue.test.js`.
- REQ-5.3: Tests must be independent: each test must not rely on state left by another test.
- REQ-5.4: Tests must not make network requests.
- REQ-5.5: The test file for server functions must import the functions under test directly. The functions `validateAnalysis`, `inspectLink`, `hasImageSignature`, `hasAudioSignature`, and `recoverExactQuote` must be exported from `server.js` only when `NODE_ENV === 'test'` (or via a dedicated `lib/` extraction), so that importing them does not start the HTTP server.
- REQ-5.6: The following test cases must be implemented for `validateAnalysis` (VA-T1 through VA-T8):
  - **VA-T1:** A valid Safe response with empty `scam_breakdown` and `manipulation_sequence` returns `risk_level: 'Safe'` and `scam_category: 'None detected'`.
  - **VA-T2:** A `Highly Dangerous` response whose `scam_breakdown` contains a phrase not found in the original message is demoted to `Suspicious` after validation (quote recovery fails → breakdown is empty → demotion rule fires).
  - **VA-T3:** A `Highly Dangerous` response with a valid verbatim phrase in `scam_breakdown` retains `Highly Dangerous`.
  - **VA-T4:** An unrecognised `risk_level` value throws `Error('Invalid risk level.')`.
  - **VA-T5:** A tactic alias (`'impersonation'`) is normalised to `'Authority impersonation'`.
  - **VA-T6:** An unrecognised scam category is replaced with `'Unclear'`.
  - **VA-T7:** `safe_next_steps` for a non-Safe result always begins with the four standard safety advisories regardless of what the model returned.
  - **VA-T8:** When the original message contains the phrase "already paid", the money-moved helpline step is prepended.
- REQ-5.7: The following test cases must be implemented for `inspectLink` (IL-T1 through IL-T9):
  - **IL-T1:** A plain HTTPS URL with no flags returns `risk_level: 'No obvious structural warning'` and an empty `findings` array.
  - **IL-T2:** An HTTP URL returns a finding containing "HTTP instead of HTTPS".
  - **IL-T3:** A URL with a punycode hostname (`xn--`) returns a finding and `risk_level: 'High caution'`.
  - **IL-T4:** A URL with a raw IP address returns a finding and `risk_level: 'High caution'`.
  - **IL-T5:** A known shortener domain (`bit.ly`) returns a finding about URL shortening.
  - **IL-T6:** A URL without a scheme has `https://` prepended automatically and is then parsed correctly.
  - **IL-T7:** An empty input throws `Error('Please enter a URL.')`.
  - **IL-T8:** A URL longer than 2000 characters throws `Error('The URL is too long.')`.
  - **IL-T9:** A URL with embedded credentials (`http://user:pass@example.com`) returns a finding about embedded username or password.
- REQ-5.8: The following test cases must be implemented for `hasImageSignature` (IS-T1 through IS-T6):
  - **IS-T1:** A buffer starting with `FF D8 FF` is recognised as JPEG.
  - **IS-T2:** A buffer starting with the 8-byte PNG magic bytes is recognised as PNG.
  - **IS-T3:** A buffer starting with `RIFF....WEBP` is recognised as WEBP.
  - **IS-T4:** A JPEG buffer passed as `subtype: 'png'` returns `false`.
  - **IS-T5:** A buffer shorter than 12 bytes returns `false` for all subtypes.
  - **IS-T6:** A non-Buffer value returns `false`.
- REQ-5.9: The following test cases must be implemented for `hasAudioSignature` (AS-T1 through AS-T9):
  - **AS-T1:** A buffer starting with `1A 45 DF A3` is recognised as `.webm`.
  - **AS-T2:** A buffer starting with `OggS` is recognised as `.ogg`.
  - **AS-T3:** A buffer starting with `RIFF....WAVE` is recognised as `.wav`.
  - **AS-T4:** A buffer starting with `fLaC` is recognised as `.flac`.
  - **AS-T5:** A buffer whose bytes 4–7 are `ftyp` is recognised as `.m4a`.
  - **AS-T6:** A buffer starting with `ID3` is recognised as `.mp3`.
  - **AS-T7:** A buffer starting with the MP3 sync word (`0xFF 0xFB`) is recognised as `.mp3`.
  - **AS-T8:** A WEBM buffer passed as `.ogg` returns `false`.
  - **AS-T9:** A buffer shorter than 4 bytes returns `false`.
- REQ-5.10: The following test cases must be implemented for `recoverExactQuote` (RQ-T1 through RQ-T5):
  - **RQ-T1:** A phrase found verbatim in the message is returned with its original casing and surrounding whitespace preserved from the message.
  - **RQ-T2:** A phrase found with different internal whitespace (e.g. a double space) is still matched and returned.
  - **RQ-T3:** A phrase not found in the message returns `null`.
  - **RQ-T4:** An empty phrase input returns `null`.
  - **RQ-T5:** The string `'none'` (case-insensitive) returns `null`.
- REQ-5.11: The test run must exit with code 0 when all tests pass and code non-zero when any test fails.
- REQ-5.12: No test may import `server.js` in a way that starts the Express HTTP server or binds to a port.

#### Acceptance Criteria

1. `npm test` completes without error on a machine with Node 22, after `npm install`, with no `GROQ_API_KEY` set.
2. All 37 test cases listed in REQ-5.6 through REQ-5.10 (VA-T1–T8, IL-T1–T9, IS-T1–T6, AS-T1–T9, RQ-T1–T5) are present and passing. These 37 cases are the minimum set; the full `npm test` suite contains more tests (see Requirement 6).
3. Introducing a deliberate regression (e.g. removing the demotion rule in `validateAnalysis`) causes VA-T2 to fail.
4. The test suite runs in under 10 seconds.
5. No test produces a `console.error` about a missing API key or attempted network connection.

---

### Requirement 6: Post-audit fixes

**User Story:** As a developer submitting Scam Lens, I want the findings of the November 2026 independent audit fixed and documented, so that the test command covers all tests, Rescue Mode cites verifiable sources, a failed AI response is never shown as a result, and the repository and Kiro workspace files are accurate.

#### Context

An independent audit was carried out in November 2026, after Requirements 1-5 were implemented. Its confirmed findings are implemented and recorded as Task 6 in `tasks.md` (sub-tasks 6.1 to 6.11) and in the Task 6 section of `design.md`. This requirement states the resulting behaviour so that it can be verified. The sub-areas are 6.A (test command), 6.B (Rescue Mode sources), 6.C (AI response failures), 6.D (feedback controls and privacy text), 6.E (repository and documentation files) and 6.F (Kiro workspace configuration).

Facts this requirement relies on: the installed `openai` SDK version is 7.55.0 and retries 429 and 5xx responses twice by default; `analyzeText` in `server.js` calls the chat model with `max_completion_tokens: 3000`; `index.html` loads `/rescue.js` and reads `window.ScamLensRescue`.

#### Functional Requirements

##### 6.A Test command (tasks.md 6.1)

- REQ-6.1: The `"test"` script in `package.json` SHALL be `node --test tests/server.test.js tests/rescue.test.js`, using explicit file paths and no glob, because `cmd.exe` and PowerShell do not expand globs. No dependency or `devDependency` SHALL be added.
- REQ-6.2: IF any test in either file fails, THEN `npm test` SHALL exit with a non-zero code.
- REQ-6.3: WHILE `npm test` runs, THE test suite SHALL make no network calls and SHALL need no `GROQ_API_KEY`.

##### 6.B Rescue Mode source attribution (tasks.md 6.2)

- REQ-6.4: Every entry in `SOURCES` in `public/rescue.js` SHALL have a non-empty `label` and a `url` that is a string starting with `https://`. A `null` or non-https `url` SHALL fail `tests/rescue.test.js`.
- REQ-6.5: The `SOURCES.verify` entry SHALL have a label that contains the date "6 March 2025" and the URL `https://cybercrime.gov.in/pdf/Advisories/ADVISORYTAU-ADV-003DigitalArrest06.03.2025.pdf`.
- REQ-6.6: The static "Official guidance used" list in `public/index.html` SHALL contain the same URL and the same label as `SOURCES.verify`. Update (Task 7.3): the list also contains the RBI, CERT-In and PIB entries, held in `SOURCE_LIST` in `public/rescue.js`, with exact labels and URLs checked by `tests/rescue.test.js`. The list states the review date "18 November 2026".
- REQ-6.7: Every `<a>` tag in `public/index.html` with `target="_blank"` SHALL have `rel="noopener noreferrer"`.
- REQ-6.8: THE Rescue Mode checklist SHALL render source labels and links with DOM APIs (`textContent`, `createElement('a')`) and SHALL NOT use `innerHTML`.
- REQ-6.9: THE Rescue Mode step text and ordering SHALL remain deterministic and unchanged by Requirement 6: contacting the bank, 1930 for financial cyber fraud, 112 only for immediate physical danger, and the single global `RESCUE_ORDER`. Update: Task 7.3 later corrected the wording of the `endCall`, `bank`, `disconnect`, `device` and `verify` steps to match the cited sources. The 112 step, the step ids, the scenarios and `RESCUE_ORDER` are unchanged, and Rescue Mode is still deterministic.
- REQ-6.10: THE project owner SHALL manually confirm that the advisory PDF named in REQ-6.5 supports the claim in the "Verify the claimed authority independently" step. The tooling used during implementation could not read the I4C PDF or the CERT-In advisory, so the document content was not machine-checked by the agent. Status: the owner reported on 2026-11-18 that the I4C and CERT-In sources were verified and support the revised guidance (Task 7.3). The agent read the PIB and RBI pages. The owner's confirmation is recorded, not independently re-verified.

##### 6.C Truncated, empty, malformed and invalid AI responses (tasks.md 6.7, 6.8)

- REQ-6.11: THE `analyzeText` function SHALL accept an optional third parameter, a client object. WHEN the parameter is omitted, THE function SHALL use the Groq client.
- REQ-6.12: WHEN `analyzeText` receives a completion, THE function SHALL check it in this order and reject with an `AnalysisError` carrying the stated `code` at the first failing check: (1) no `choices[0]`: `no_choice`; (2) `finish_reason === 'length'`: `truncated`, checked before the empty-content check and applied even when the content parses as valid JSON; (3) content that is not a non-empty string: `empty`; (4) `JSON.parse` throws: `malformed_json`; (5) `validateAnalysis` throws: `invalid_shape`.
- REQ-6.13: IF `analyzeText` fails for any reason, THEN THE function SHALL NOT resolve to a classification, and SHALL NOT resolve to a `Safe` result.
- REQ-6.14: IF `/api/analyze` receives an `AnalysisError` from `analyzeText`, THEN THE route SHALL respond with status 502 and the `userMessage` of that error. IF the error is not an `AnalysisError` (for example a provider or network error), THEN THE route SHALL respond with status 502 and the generic message "Message analysis failed. Please try again in a moment."
- REQ-6.15: THE text shown to users in an analysis failure and THE server log line for it SHALL NOT contain model output, the submitted message, an API key or a stack trace. The log line SHALL record only an error code or an HTTP status.
- REQ-6.16: THE `analyzeText` function SHALL NOT add a retry loop, because the installed `openai` SDK already retries 429 and 5xx responses twice. THE `max_completion_tokens` value SHALL remain 3000, because a larger limit would only move the point at which a long answer is cut off and would raise the cost of every request; a cut-off answer is treated as an error instead.
- REQ-6.17: THE `validateAnalysis` function and its existing error messages SHALL remain unchanged by Requirement 6.
- REQ-6.18: WHEN `/api/analyze` returns an error, THE frontend SHALL show the server error text in `#textError` and SHALL re-enable the submit button so the user can retry. This is verified by code inspection and is not covered by an automated test.
- REQ-6.19: Known limitation, out of scope for Task 6: `/api/analyze-image` and `/api/transcribe` did not check `finish_reason`. A cut-off OCR result would be returned as extracted text, which the user reviews and can edit before any analysis. Update: Task 7.6 added the check to `/api/analyze-image`. `/api/transcribe` is unchanged.

##### 6.D Non-functional feedback controls and privacy text (tasks.md 6.11)

- REQ-6.20: THE "Was this analysis useful?" Yes and No controls SHALL be absent from `public/index.html`, and the three statements in `renderAnalysis` that referenced `#feedbackStatus`, `#feedbackYes` and `#feedbackNo` SHALL be removed, so that rendering a result does not throw. No feedback storage SHALL be introduced.
- REQ-6.21: THE application SHALL use `localStorage` only under the history key `scamLensHistoryV3`.
- REQ-6.22: THE `public/privacy.html` section 5 heading SHALL be "History in your browser" and the page SHALL make no claim about stored feedback counts. Every statement in `privacy.html` about local history SHALL match the code: up to 15 saved reports; each report holds the submitted text, its analysis and a timestamp; the user can delete one report or all reports; Rescue Mode incident summaries are not stored. The "Last updated" date is intentionally unchanged because the data the application handles did not change.

##### 6.E Repository and documentation files (tasks.md 6.3, 6.4, 6.5, 6.6)

- REQ-6.23: A `LICENSE` file at the project root SHALL contain the standard MIT licence text with year 2026 and holder "Lakshya Garg". The owner changes the holder if a different one is intended.
- REQ-6.24: A `README.md` at the project root SHALL state these limitations: classification is probabilistic, link inspection is structural only, voice transcription is not voice-clone or identity detection, the benchmark is synthetic, and rate limits are in-memory. THE README SHALL make no unmeasured accuracy claim, SHALL contain no demo or repository URL until they exist, SHALL describe only Kiro artefacts that exist in the repository, and SHALL state test counts that match the output of `npm test`.
- REQ-6.25: THE public repository SHALL contain a root-level `README.md` (REQ-6.24). `README.txt` is optional and is not required for public submission. IF a `README.txt` internal handoff note exists, THEN it SHALL remain excluded from Git, and `.gitignore` SHALL continue to list `README.txt`.
- REQ-6.26: THE `.env.example` file SHALL document `TRUST_PROXY` as a commented-out entry with a warning to enable it only behind a trusted reverse proxy.
- REQ-6.27: THE `.gitignore` file SHALL NOT contain any pattern that matches `.kiro/`.
- REQ-6.28: Requirement 6 SHALL NOT modify `benchmark/README.md`.

##### 6.F Kiro workspace configuration (tasks.md 6.9, 6.10)

- REQ-6.29: THE files `.kiro/steering/product.md`, `.kiro/steering/tech-stack.md` and `.kiro/steering/structure.md` SHALL exist, SHALL have the front matter `inclusion: always`, and SHALL describe only what exists in the repository.
- REQ-6.30: THE file `.kiro/hooks/run-tests-on-save.json` SHALL define exactly one hook in the v1 schema: `version` `"v1"`, and one `hooks[]` entry with a `name`, `trigger` `"PostFileSave"`, a `matcher`, `action` `{ "type": "command", "command": "npm test" }`, `timeout` 120 and `enabled` true.
- REQ-6.31: THE hook `matcher` SHALL be the regular expression `(^|[\\/])(server\.js|rescue\.js|index\.html|[^\\/]+\.test\.js)$` (written with escaped backslashes in the JSON file). THE matcher SHALL match `server.js`, `public/rescue.js`, `public/index.html` and `tests/server.test.js`, and SHALL NOT match `README.md`, `package.json`, `tasks.md` or other documentation.
- REQ-6.32: THE hook command SHALL be offline and SHALL need no Groq key, so the hook cannot spend credits.
- REQ-6.33: THE existing specs, the `tasks.md` history and `tasks.meta.json` SHALL be preserved.
- REQ-6.34: Known limitation: Kiro's documentation describes `PostFileSave` as firing when the agent saves a file. Firing inside a Kiro session was not observed during implementation, and a manual save in the editor may not trigger it. Update: repeated attempts in Task 7.4 could not independently verify execution, so Task 7.4 is deferred (`[~]`). The hook is configured but its execution is unconfirmed.

#### Acceptance Criteria

1. `package.json` `scripts.test` equals `node --test tests/server.test.js tests/rescue.test.js`, and `package.json` has no `devDependencies` key.
2. `npm test` exits 0 and reports 77 tests (60 in `tests/server.test.js` and 17 in `tests/rescue.test.js`) with 0 failures. (It was 64 at Task 6 completion and 69 after Task 7.3.) The count must be re-checked and this criterion and the README updated whenever tests are added or removed.
3. Making one test in `tests/rescue.test.js` fail makes `npm test` exit non-zero.
4. `npm test` passes with `GROQ_API_KEY` empty and makes no network calls (the tests use mock clients). Task 7.5 ran it with `GROQ_API_KEY` defined but empty; the machine was not disconnected from the network.
5. Setting any `SOURCES` entry `url` to `null` makes the rescue source test fail.
6. `SOURCES.verify.label` matches `/6 March 2025/` and `SOURCES.verify.url` equals the URL in REQ-6.5.
7. `public/index.html` contains `href="` followed by `SOURCES.verify.url` and contains `SOURCES.verify.label`.
8. Every `<a>` tag in `public/index.html` containing `target="_blank"` also contains `rel="noopener noreferrer"`.
9. The Rescue Mode source note code in `public/index.html` contains no `innerHTML` assignment. This is verified by code inspection.
10. A mock client whose first choice has `finish_reason: 'length'` makes `analyzeText` reject with code `truncated` when the content is empty, partial or complete valid JSON.
11. Mock clients returning no choice, empty or null content, and unparseable JSON make `analyzeText` reject with codes `no_choice`, `empty` and `malformed_json` respectively.
12. A mock client returning JSON that `validateAnalysis` rejects makes `analyzeText` reject with code `invalid_shape`.
13. No failure case in criteria 10 to 12 resolves to a value, so none resolves to `Safe`.
14. `analysisFailure` returns status 502 with the error's `userMessage` for an `AnalysisError`, and status 502 with the generic message for a provider error. Neither message contains the provider error text or the model output.
15. `grep -n "console\.\(log\|warn\|error\)" server.js` shows no failure-path log call that outputs `error.message`, model output or the submitted message for `/api/analyze`. This is verified by code inspection.
16. The strings `feedbackStatus`, `feedbackYes` and `feedbackNo` do not appear in `public/index.html`.
17. `localStorage` is read or written in `public/index.html` only through the `HISTORY_KEY` constant whose value is `scamLensHistoryV3`.
18. `public/privacy.html` contains the heading "5. History in your browser" and contains neither the word "feedback" nor a statement about feedback counts.
19. `LICENSE` exists at the project root, begins with "MIT License" and contains "Copyright (c) 2026 Lakshya Garg".
20. `README.md` exists, contains each limitation listed in REQ-6.24, contains no URL for a demo or repository, and states the current test count (77).
21. `README.md` exists at the project root; `.gitignore` contains the line `README.txt`; `README.txt` is not required to exist on disk, and if it exists `git check-ignore -v README.txt` reports it ignored; and `git check-ignore -v .kiro/specs/stability-security/requirements.md` reports no ignore rule.
22. `.env.example` contains the line `# TRUST_PROXY=1` and a comment warning against enabling it on a directly exposed server, and contains no string beginning with `gsk_`.
23. The three steering files exist and each begins with `---` followed by `inclusion: always`.
24. `.kiro/hooks/run-tests-on-save.json` parses as JSON, has exactly one hook with the values in REQ-6.30, and the matcher in REQ-6.31 matches `server.js`, `public/rescue.js`, `public/index.html` and `tests/server.test.js` and does not match `README.md`, `package.json` or `.kiro/specs/stability-security/tasks.md`.
25. Manual, owner action: the owner has opened the advisory PDF and confirmed the claim in REQ-6.10. Done: owner-confirmed 2026-11-18 (Task 7.3).

#### Out of scope for Requirement 6

- Live Groq calls or benchmark runs.
- Deployment.
- Git initialisation or pushing.
- Rotating the Groq API key (a manual action by the project owner; the owner confirmed it on 2026-11-18, Task 7.1).
- Global rate limiting.
- A readiness endpoint.
- Wiring up feedback storage.

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
| `recoverExactQuote` | A server-side pure function that verifies a proposed suspicious phrase is a verbatim substring of the original message, using whitespace-normalised regex matching. |
| `validateAnalysis` | A server-side pure function that sanitises and validates the raw JSON object returned by the AI model before it is sent to the client. |
| `inspectLink` | A server-side pure function that performs structural analysis of a submitted URL without making any network request to the destination. |
| `hasImageSignature` | A server-side pure function that checks the magic bytes of a buffer to verify it matches a declared image MIME type. |
| `hasAudioSignature` | A server-side pure function that checks the magic bytes of a buffer to verify it matches a declared audio file extension. |
| `scamLensHistoryV3` | The `localStorage` key under which Scam Lens stores up to 15 saved analysis reports in the user's browser. |
| `AnalysisError` | An error type thrown by `analyzeText` for a truncated, empty, malformed or invalid AI response. It carries a short `code` (`no_choice`, `truncated`, `empty`, `malformed_json`, `invalid_shape`) and a user-safe `userMessage`. |
| `analysisFailure` | A function in `server.js` that maps any error from `analyzeText` to `{ status: 502, message }` and logs only an error code or HTTP status. |
| `SOURCES` | The map in `public/rescue.js` from a Rescue Mode step id to the label, `https://` URL and a scope `note` of the official source for that step's claim. |
| `SOURCE_LIST` | The map in `public/rescue.js` of the four official sources (I4C / NCTAU, RBI, CERT-In, PIB) with their exact labels and URLs. `SOURCES` entries are built from it, and the static source list in `index.html` must match it. |
| `rescue.js` | The UMD module `public/rescue.js` that holds Rescue Mode steps, ordering and sources. It makes no AI calls and is loaded by the browser (`window.ScamLensRescue`) and imported by the Node tests. |
| PostFileSave hook | The Kiro hook in `.kiro/hooks/run-tests-on-save.json` that runs `npm test` when the agent saves a file whose path matches the hook's `matcher`. |
