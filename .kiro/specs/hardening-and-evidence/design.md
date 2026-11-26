# Design Document

## Overview

This spec hardens existing behaviour and makes the Kiro workflow visible, without adding user-facing features. In `server.js` it neutralises `MESSAGE` tags before the prompt is built, detects money that has already moved in Hinglish and Devanagari, replaces developer error messages in the image and audio routes with plain ones, reports `aiConfigured` in `/api/health`, and removes same-meaning duplicates from the next steps. It adds property-based tests with `fast-check`, a secret scanner with its tests and a second Kiro hook, two steering files, and `docs/KIRO_JOURNEY.md`. The check table below records what existed before, and "Design" describes each item.

## Architecture

```
server.js
  analyzeText(message) ── neutraliseDelimiters(message) → prompt between <MESSAGE> tags
     └─ validateAnalysis(parsed, original message)
          ├─ moneyAlreadyMoved(original message) → 1930 step first
          └─ dedupeNextSteps(nextSteps) → safe_next_steps (at most 6)
  /api/analyze-image, /api/transcribe ── provider error → providerFailureMessage(kind, error)
                                       ── no key → SERVICE_UNAVAILABLE_MESSAGE (503)
  /api/health ── healthStatus() → { ok, aiConfigured }
  checkBrandLookalike ── ALL_OFFICIAL_DOMAINS exemption (added after property P4a)
scripts/check-secrets.js ── npm run check:secrets ── .kiro/hooks/check-secrets-on-save.json
tests/server.test.js (HE-T1 to HE-T13), tests/properties.test.js, tests/secrets.test.js
.kiro/steering/security-and-privacy.md, .kiro/steering/accessibility.md, docs/KIRO_JOURNEY.md
```

All new server functions are pure apart from `healthStatus`, which reads the module's `groq` client by default. They are exported for tests only, under the existing `NODE_ENV === 'test'` guard.

## Components and Interfaces

| Component | Signature or form | Role |
|---|---|---|
| `neutraliseDelimiters` | `neutraliseDelimiters(text) → string` | Replaces every `<MESSAGE>` or `</MESSAGE>` tag (any case, spaces or attributes) with `[message]` or `[/message]`. Used only in the prompt. |
| `moneyAlreadyMoved` | `moneyAlreadyMoved(text) → boolean` | True if any pattern in `MONEY_MOVED_PATTERNS` (the English expression plus Hinglish and Devanagari past-tense phrases) matches. |
| `dedupeNextSteps` | `dedupeNextSteps(steps, limit = 6) → string[]` | Keeps the first step for each meaning, using the topic keys in `NEXT_STEP_TOPICS` (`credentials`, `portal`, `helpline`), keeps order and caps the list. |
| `providerFailureMessage` | `providerFailureMessage(kind, error) → string` | Chooses a plain message from the provider's HTTP status only. `kind` is `'image'` or `'audio'`. |
| `SERVICE_UNAVAILABLE_MESSAGE` | string constant | The 503 text of the image and audio routes when no key is set. |
| `healthStatus` | `healthStatus(client = groq) → { ok, aiConfigured }` | Liveness plus whether a client (and so a key) exists. |
| `ALL_OFFICIAL_DOMAINS` | `Set` of every official domain in `INDIAN_BRANDS` | Hosts under any listed official domain skip Rule A (fix for the P4a counterexample). |
| Test-only exports | `neutraliseDelimiters`, `moneyAlreadyMoved`, `dedupeNextSteps`, `providerFailureMessage`, `healthStatus`, `INDIAN_BRANDS`, `LOOKALIKE_KEYWORDS`, `LOOKALIKE_SUSPICIOUS_TLDS` | Added to the `NODE_ENV === 'test'` export list. |
| `scanText` | `scanText(text) → [{ line, kind }]` | Reports key-like strings and real-looking `GROQ_API_KEY=` values in one file's text, without the matched value. |
| `scanProject` | `scanProject(root) → { findings: [{ file, line, kind }], gitignoreOk }` | Walks the project, skipping `node_modules`, `.git`, `.env`, `benchmark/results`, binary files and files over 2 MB. |
| `gitignoreListsEnv` | `gitignoreListsEnv(root) → boolean` | True when `.gitignore` has a `.env` or `/.env` line. |
| `listFiles`, `main` | `listFiles(root) → string[]`, `main(argv) → 0 or 1` | File walk, and the command-line entry that prints `file:line: kind (value not shown)`. |
| Hook | `.kiro/hooks/check-secrets-on-save.json` | v1 hook "Check for secrets after file saves": `PostFileSave`, runs `node scripts/check-secrets.js`, timeout 60 s, enabled. |
| Steering | `security-and-privacy.md` (`inclusion: always`), `accessibility.md` (`inclusion: fileMatch`, `fileMatchPattern: "public/**/*"`) | Rules given to Kiro. |

## Data Models

This spec adds no persistent data. The data shapes it adds or changes are:

- `/api/health` response: `{ "ok": true, "aiConfigured": <boolean> }`. Nothing else is returned, and never the key.
- `dedupeNextSteps` input: any array. Non-strings and blank strings are ignored. Output: the kept original strings, in their original order, at most `limit` long.
- `safe_next_steps` in the analysis response keeps its existing type (array of strings) but now has at most 6 entries instead of 9.
- Scanner finding: `{ file, line, kind }`, where `file` is relative to the project root with `/` separators and `kind` is one of "possible Groq API key", "possible sk- style API key" or "non-empty GROQ_API_KEY value outside .env". `scanProject` returns `{ findings, gitignoreOk }`. The command exits with 0 or 1.

## Error Handling

- **Provider failure in the image and audio routes:** status 502 with a plain message from `providerFailureMessage` (busy for 429 or 503, "could not read this file" for 400, 413, 415 or 422, otherwise "try again"). See "3. Upload error messages" below for the exact texts. The provider's details are logged with `console.error` on the server only, and the response never includes `error.message`.
- **No API key in those routes:** status 503 with `SERVICE_UNAVAILABLE_MESSAGE`. `/api/analyze` keeps its earlier 503 text (an open item below).
- **Model reply:** truncated, empty, malformed or invalid replies are still rejected with `AnalysisError` as before. `neutraliseDelimiters` only changes the prompt text, and evidence quotes are still checked against the original message.
- **Scanner:** unreadable files, binary files (any NUL byte) and files over 2 MB are skipped. A missing `.gitignore`, or one without `.env`, is reported as a problem. Any problem gives exit code 1.
- **Hook:** the command has a 60-second timeout, and a non-zero exit is reported to the agent by Kiro.

## Correctness Properties

Properties 1 to 5 are generated tests in `tests/properties.test.js`, run by `fast-check` with seed 20261122. Properties 6 to 11 are example-based tests in `tests/server.test.js` and `tests/secrets.test.js`.

Property 1: For any message string and any list of model-returned phrases, every evidence quote kept by `validateAnalysis` is a substring of the original message (P1).
**Validates: Requirements 1.2, 6.2**

Property 2: For any generated analysis, `validateAnalysis` never returns "Highly Dangerous" when no evidence quote survived (P2).
**Validates: Requirements 6.2**

Property 3: For any input that `inspectLink` does not reject, the risk level is one of the three allowed values, `reputation_check` and `disclaimer` are unchanged, two calls give equal results, and a non-empty `findings` list never gives "No obvious structural warning" (P3).
**Validates: Requirements 6.2**

Property 4: For any listed brand except `axis`, any of its official domains and any one to three generated subdomain labels, the host gets no Rule A finding (P4a). Its first run found the counterexample `incometaxindia.sbi.co.in`, fixed with `ALL_OFFICIAL_DOMAINS` and kept as the regression test HE-T13.
**Validates: Requirements 6.2**

Property 5: For every brand token, sensitive keyword and suspicious TLD, `<token>-<keyword>.<tld>` gets a Rule A finding and "High caution" (P4b).
**Validates: Requirements 6.2**

Property 6: For any message that contains `MESSAGE` tags, the prompt holds exactly one opening and one closing delimiter, and quotes are still verified against the original text (HE-T1, HE-T2, HE-T3).
**Validates: Requirements 1.1, 1.2**

Property 7: Each listed Hinglish and Devanagari past-tense phrase triggers the 1930 step, the English phrases still do, and the listed warnings and demands to pay do not (HE-T4, HE-T5).
**Validates: Requirements 2.1, 2.2**

Property 8: Upload failure messages never contain provider text, codes or developer wording, and the routes keep status codes 502 and 503 (HE-T6, HE-T7).
**Validates: Requirements 3.1, 3.2**

Property 9: `healthStatus` returns exactly the keys `ok` and `aiConfigured`, both booleans (HE-T8).
**Validates: Requirements 4.1**

Property 10: `dedupeNextSteps` keeps the first step of each meaning, keeps order and returns at most 6 steps, `validateAnalysis` uses it, and Rescue Mode steps are unchanged (HE-T9, HE-T10, HE-T11, HE-T12).
**Validates: Requirements 5.1, 5.2, 5.3**

Property 11: The scanner reports key-like strings with file and line, never prints the secret, skips `.env`, `node_modules`, `.git` and `benchmark/results`, gives no finding on `.env.example`, and finds nothing in this repository (SC-T1 to SC-T8).
**Validates: Requirements 7.1, 7.2, 7.3**

Manual and unverified by `npm test`: whether the hook runs in a Kiro session, and whether Kiro loads the two steering files.

## Testing Strategy

Automated, offline, with no API key (`npm test`, latest run 155 tests in total):

| File | Tests | Covers in this spec |
|---|---|---|
| `tests/server.test.js` | 98 | HE-T1 to HE-T13 (13 tests) for items 1 to 5 and the P4a regression |
| `tests/properties.test.js` | 5 | P1, P2, P3, P4a, P4b with seed 20261122 |
| `tests/secrets.test.js` | 8 | SC-T1 to SC-T8 for the scanner |

`npm run check:secrets` also runs the scanner on the project. Manual: watching for the hook output in a Kiro session, and confirming that the steering files appear in Kiro.

## Check table

State of the code **before** this change. Functions and files are cited by name.

| Item | State before | Evidence |
|---|---|---|
| Phase 0: one `<footer>` after `</main>` in `public/index.html` | **Missing** | `public/index.html` has no `<footer>` element. It was removed outside the accessibility task (file last written 2026-11-22 13:18:10). Not recreated here: the content must come from the author. |
| 1. Neutralise `<MESSAGE>` tags before the prompt | **Missing** | `analyzeText` builds `` `<MESSAGE>\n${message}\n</MESSAGE>` `` from the raw text. `validateAnalysis(parsed, message)` already compares against the original text. |
| 2. Hindi and Hinglish "money already moved" | **Partial** | `validateAnalysis` tests one English-only regular expression (`already paid`, `already transferred`, `money was debited`, `money was transferred`, `i paid`, `i transferred`, `amount was deducted`). Its `\b` boundaries do not work for Devanagari. |
| 3. Plain error messages in the image and audio routes | **Missing** | `/api/analyze-image` generic catch returns "Screenshot text extraction failed. Check the backend terminal." `/api/transcribe` catch returns "Audio transcription failed. Check the recording format, Groq access and backend terminal." Both routes return "Groq API key is not configured." with 503. Details are already logged with `console.error`. |
| 4. `/api/health` reports `aiConfigured` | **Missing** | The route returns `{ ok: true }` only. |
| 5. Collapse near-duplicate next steps, cap 6 | **Partial** | `validateAnalysis` removes exact duplicates with `new Set` and caps the list at 9. Steps with the same meaning and different wording all stay. |
| Phase 2: property-based tests (P1 to P4) | **Missing** | No `fast-check`, no `tests/properties.test.js`. `package.json` has no `devDependencies`. |
| Phase 3.1: `scripts/check-secrets.js` | **Missing** | No `scripts/` folder. `.gitignore` already lists `.env`. |
| Phase 3.2: second hook | **Missing** | `.kiro/hooks/` holds only `run-tests-on-save.json`. |
| Phase 3.3: `security-and-privacy.md`, `accessibility.md` steering | **Missing** | Steering has `product.md`, `tech-stack.md`, `structure.md`, all `inclusion: always`. |
| Phase 3.4: `docs/KIRO_JOURNEY.md` | **Missing** | No `docs/` folder. |
| Phase 4: evidence-count field and results line | **Not started (optional, not to be done now)** | — |

## Design

### 1. Delimiter neutralisation

`neutraliseDelimiters(text)` replaces every tag matching `/<\s*\/?\s*message\b[^>]*>/gi` with `[message]` or `[/message]`. This covers `<MESSAGE>`, `</message>`, `< /MESSAGE >` and `<MESSAGE id=1>`. `analyzeText` uses the result only inside the prompt. `validateAnalysis` keeps receiving the original `message`, so every kept quote is still checked against what the user submitted. If the model quotes `[message]`, that quote is not in the original text and is dropped, which is the safe outcome.

### 2. Money-already-moved detection

`moneyAlreadyMoved(text)` returns true if any of these match:

- The existing English expression, unchanged.
- Hinglish, case-insensitive, with flexible spaces: `pais[ae] bhej di(ya|ye|e)`, `transfer kar di(ya|ye|e)`, `pais[ae] ka(a)t (gaya|gaye|liya|liye)`, `pais[ae] nikal (gaya|gaye|liya|liye)` (this also covers `account se paise nikal gaye`).
- Devanagari: `पैसे/पैसा भेज दिए/दिया/दिये`, `ट्रांसफर कर दिया/दिए/दिये`, `पैसे/पैसा कट गए/गया/गये`, `पैसे/पैसा निकल गए/गया/गये`.

These are past tense. Demands such as "paise bhej do" or "transfer kar do" do not match, because a scammer's demand is not evidence that money has moved. Devanagari patterns use no `\b`, because JavaScript word boundaries treat Devanagari letters as non-word characters.

### 3. Upload error messages

`providerFailureMessage(kind, error)`, where `kind` is `image` or `audio`, returns one of three plain messages, chosen from the provider status only:

| Provider status | Message |
|---|---|
| 429 or 503 | "The service is busy right now. Please wait a minute and try again." |
| 400, 413, 415 or 422 | "We could not read this screenshot. Try a clearer or smaller image." or "We could not read this audio file. Try a different recording or format." |
| anything else | "We could not read text from this screenshot right now. Please try again." or "We could not transcribe this recording right now. Please try again." |

The routes keep status 502 for these failures and 503 when no key is set. The 503 text becomes "This feature is not available right now. Please try again later." The `console.error` logging is unchanged and stays on the server. Responses never contain `error.message`, provider details, the key or submitted content. `/api/analyze` is outside the requested scope and keeps its 503 text (see Open items).

### 4. Health

`healthStatus(client = groq)` returns `{ ok: true, aiConfigured: Boolean(client) }`. `groq` is `null` when `GROQ_API_KEY` is missing or blank, so `aiConfigured` is true only when a key is set. The function returns only booleans and never the key.

### 5. Next-steps de-duplication

`dedupeNextSteps(steps, limit = 6)` is pure. It keeps the first step for each meaning and preserves order:

1. It normalises each step (lower case, punctuation and extra spaces removed) and drops exact repeats.
2. It gives each step a set of topic keys. `credentials` means a mention of OTP, PIN, password or CVV together with share, tell, give, disclose or reveal. `portal` means a mention of `cybercrime.gov.in`. `helpline` means a mention of 1930.
3. It drops a step when it has at least one topic and every one of its topics is already covered by an earlier step.
4. It caps the list at `limit`.

`validateAnalysis` calls it in place of `[...new Set(nextSteps)].slice(0, 9)`. The fixed advisories are added first, so their wording is the one kept. The money step and the four standard advisories still lead the list, so VA-T7 and VA-T8 are unaffected. Rescue Mode is not touched. The frontend already renders `safe_next_steps` with `fillList` (`textContent`), so `public/index.html` does not change. Reports saved in History before this change keep their stored list.

### Phase 2: property-based tests

`fast-check` is added as a devDependency. `tests/properties.test.js` runs every property with `seed: 20261122` and the seed in the test name. The test-only exports gain `INDIAN_BRANDS`, `LOOKALIKE_KEYWORDS` and `LOOKALIKE_SUSPICIOUS_TLDS` so the generators read the real data.

- **P1:** messages are full Unicode strings. Phrases mix substrings of the message, case and whitespace variants of them, and random strings. Every kept `suspicious_phrase` and `evidence_quote` must be a substring of the original message. `recoverExactQuote` returns a slice of the message, so this is the normalisation the code uses.
- **P2:** a Highly Dangerous result always has at least one kept quote.
- **P3:** inputs are random strings, generated URLs and URLs built from brand, keyword and TLD vocabulary. For inputs that do not throw, the risk level is one of three values, `reputation_check` and `disclaimer` are byte-identical, two calls give equal results, and a non-empty `findings` list never gives the clean level.
- **P4:** for every brand except `axis`, an official domain plus one to three generated subdomain labels never gets a Rule A finding. Labels mix random lower-case alphanumerics with project vocabulary (brand tokens, keywords, `www`, `bank`), so collisions with real tokens are actually explored. Also, `<token>-<keyword>.<tld>` for every brand token, keyword and suspicious TLD always gets Rule A and High caution.

### Phase 3: workflow evidence

- **`scripts/check-secrets.js`** needs no dependencies. It walks the project, skipping `node_modules`, `.git`, `.env` and `benchmark/results`, as well as files over 2 MB and binary files (any NUL byte). It reports:
  - `groq-key`: `gsk_` followed by 16 or more letters or digits.
  - `sk-key`: `sk-` followed by 20 or more letters, digits, `_` or `-`.
  - `env-assignment`: a line `GROQ_API_KEY=<value>` where the value is not empty, not a placeholder (`your`, `here`, `example`, `placeholder`, `changeme`, `xxx`, `<...>`) and not a variable reference (`$...`).
  - `.gitignore` must contain a line `.env`.

  It prints `file:line: <kind>` and never the matched text. It exits 1 on any finding and 0 otherwise. It exports its functions for tests. The script is `npm run check:secrets`.
- **`tests/secrets.test.js`** builds key-like strings at runtime, so no key-like literal exists in the repository. It runs the scanner on temporary folders and on the real `.env.example`.
- **Second hook:** `.kiro/hooks/check-secrets-on-save.json` uses the same v1 fields as `run-tests-on-save.json`: `name`, `description`, `trigger` `PostFileSave`, `matcher` for text-file extensions and `.gitignore` (which does not match `.env`), command `node scripts/check-secrets.js`, `timeout` 60 and `enabled` true. The schema was checked against https://kiro.dev/docs/hooks/ on 2026-11-25.
- **Steering:** `security-and-privacy.md` uses `inclusion: always`. `accessibility.md` uses `inclusion: fileMatch` with `fileMatchPattern: "public/**/*"`, the syntax checked against https://kiro.dev/docs/steering/ on 2026-11-25.
- **`docs/KIRO_JOURNEY.md`** is built only from repository files. Counts are produced by a counting script, and its method is stated in the file. The author-provided bullets are included as written. Everything else is "TO COMPLETE BY AUTHOR".

### Optional-task marker

Kiro's docs mention optional tasks but do not document their syntax. This spec uses `- [ ]*`, the usual convention in Kiro-generated task lists, and says so.

## Decisions

- **De-duplicate on the server.** One pure function in `validateAnalysis` covers every client and is easy to test. A browser-side copy would duplicate the logic.
- **Conservative topics.** There are only three topic keys. A model step that adds anything new, for example "call your bank", is kept.
- **Errors keep their status codes.** Only the text changes. Clients that check status codes behave as before.
- **No change to `public/index.html`.** It is not needed, and the footer gap must be fixed by the author first.

## Files changed

| File | Change |
|---|---|
| `server.js` | `neutraliseDelimiters`, `moneyAlreadyMoved`, `providerFailureMessage`, `healthStatus`, `dedupeNextSteps`, route messages, test-only exports |
| `tests/server.test.js` | New `describe` blocks only |
| `tests/properties.test.js`, `tests/secrets.test.js` | New |
| `scripts/check-secrets.js` | New |
| `package.json` | devDependency, `check:secrets`, test files in `test` |
| `.kiro/hooks/check-secrets-on-save.json` | New |
| `.kiro/steering/security-and-privacy.md`, `accessibility.md` | New |
| `.kiro/steering/structure.md`, `tech-stack.md`, `README.md` | Counts, devDependency, scripts and test files |
| `docs/KIRO_JOURNEY.md` | New |

## Open items

- The footer in `public/index.html` (Phase 0) is for the author. Until it is restored, one accessibility test fails.
- `/api/analyze` still answers "Groq API key is not configured." with 503. It was not in the requested scope.
- Whether the new hook fires has to be observed in a Kiro session.
