# Requirements Document

## Introduction

### Feature: Hardening and Kiro workflow evidence

| Field | Value |
|---|---|
| Spec title | Scam Lens – Hardening and Kiro workflow evidence |
| Goal | Make existing behaviour more robust and make the Kiro workflow visible, without adding user-facing features. |
| Scope | `server.js`, new tests, `scripts/check-secrets.js`, one new hook, two new steering files, `docs/KIRO_JOURNEY.md`, `package.json` (devDependency, one script, test files), and counts in `README.md` and `.kiro/steering/*.md`. |
| Out of scope | Rescue Mode (`rescue.js`, its steps, order and wording), risk wording, the privacy text, `.env`, `public/style.css`, new runtime dependencies, any accuracy or WCAG claim. |

## Requirements

### Requirement 0: Previous task

**User Story:** As the project owner, I want the page footer from the previous task confirmed before new work starts, and not invented if it is missing, so that its content comes from me.

- REQ-HE-0.1: `public/index.html` SHALL have exactly one `<footer>` after `</main>`, holding the credit line, the privacy link and the description. IF it is missing, THEN this spec SHALL NOT invent it, and SHALL leave it for the author.

#### Acceptance Criteria

1. `public/index.html` has exactly one `<footer>` after `</main>`, holding the credit line, the privacy link and the description.
2. If the footer is missing, this spec does not create it and leaves it for the author.

### Requirement 1: Prompt delimiter

**User Story:** As the project owner, I want a user's message unable to break out of the prompt's message delimiter, so that text inside a message cannot pose as instructions to the model.

- REQ-HE-1.1: BEFORE the message is placed in the model prompt, every literal `<MESSAGE>` or `</MESSAGE>` tag in it (any case, with optional spaces or attributes) SHALL be neutralised, so that the user's text cannot close or reopen the delimiter.
- REQ-HE-1.2: Evidence-quote validation SHALL still compare against the original submitted text.

#### Acceptance Criteria

1. Before the message is placed in the model prompt, every literal `<MESSAGE>` or `</MESSAGE>` tag in it, in any case and with optional spaces or attributes, is neutralised.
2. The prompt sent to the model contains exactly one opening and one closing `MESSAGE` delimiter, even when the message itself contains such tags.
3. Evidence quotes are still checked against the original submitted text, so a kept quote is a substring of what the user sent.

### Requirement 2: Money already moved, in Hindi and Hinglish

**User Story:** As a Hindi or Hinglish speaker who has already sent money, I want my message to trigger the advice to contact my bank and call 1930, so that I get the urgent step even when I do not write in English.

- REQ-HE-2.1: THE detection SHALL keep every existing English phrase and SHALL also detect past-tense Hinglish phrases (for example `paise bhej diye`, `paisa bhej diya`, `transfer kar diya`, `paise kat gaye`, `paisa kat gaya`, `account se paise nikal gaye`) and their Devanagari equivalents.
- REQ-HE-2.2: A message without such a phrase (for example "Aapka khata block ho jayega") and a demand to pay (for example "paise bhej do") SHALL NOT trigger it.

#### Acceptance Criteria

1. Every existing English phrase still triggers the 1930 step.
2. Past-tense Hinglish phrases such as `paise bhej diye`, `paisa bhej diya`, `transfer kar diya`, `paise kat gaye`, `paisa kat gaya` and `account se paise nikal gaye`, and their Devanagari equivalents, trigger it.
3. A message without such a phrase (for example "Aapka khata block ho jayega") and a demand to pay (for example "paise bhej do") do not trigger it.

### Requirement 3: Upload error messages

**User Story:** As a user whose screenshot or audio could not be processed, I want a short plain message, so that I know whether to wait, try another file or try again.

- REQ-HE-3.1: `/api/analyze-image` and `/api/transcribe` SHALL return plain user messages (service busy, could not read this file, try again) in place of developer messages, keeping every HTTP status code.
- REQ-HE-3.2: Details SHALL still be logged on the server only. A response SHALL NOT contain provider details, error text from the provider, a key or submitted content.

#### Acceptance Criteria

1. `/api/analyze-image` and `/api/transcribe` return plain user messages (service busy, could not read this file, try again) in place of the earlier developer messages.
2. Every HTTP status code of those routes stays the same.
3. Details are still logged on the server only, and no response contains provider details, provider error text, a key or submitted content.

### Requirement 4: Health

**User Story:** As the project owner running the deployed app, I want the health check to say whether an AI key is configured, without ever exposing the key, so that I can spot a missing key quickly.

- REQ-HE-4.1: `/api/health` SHALL return `ok: true` and `aiConfigured`, a boolean that is true only when the API key is set. It SHALL never return the key.

#### Acceptance Criteria

1. `/api/health` returns `ok: true` and `aiConfigured`, a boolean that is true only when the API key is set.
2. The response never contains the key.

### Requirement 5: Recommended next steps

**User Story:** As a user reading the results, I want each next step shown once and the list kept short, so that the advice is easy to follow.

- REQ-HE-5.1: THE steps returned for results SHALL NOT contain two steps that say the same thing, including different wordings of "do not share the OTP", "report at cybercrime.gov.in" and "call 1930". The first one SHALL be kept.
- REQ-HE-5.2: THE list SHALL be capped at 6 and keep its order.
- REQ-HE-5.3: THE rule SHALL be one small pure function with tests. Rescue Mode SHALL NOT change.

#### Acceptance Criteria

1. The next steps returned with results contain no two steps that say the same thing, including different wordings of "do not share the OTP", "report at cybercrime.gov.in" and "call 1930". The first of them is kept.
2. The list keeps its order and has at most 6 steps.
3. The rule is one small pure function with tests, and Rescue Mode is not changed.

### Requirement 6: Property-based tests

**User Story:** As the project owner, I want property-based tests with a fixed seed, so that broad input classes are checked and any failure can be reproduced exactly.

- REQ-HE-6.1: `fast-check` SHALL be a devDependency only. `tests/properties.test.js` SHALL use `node:test`, run offline with no API key in under 10 seconds, and use a fixed seed that is shown in the test names.
- REQ-HE-6.2: Properties P1 to P4 in `design.md` SHALL be tested. A failing property SHALL NOT be weakened. The counterexample SHALL be reported, and the code SHALL be fixed only if the bug is real and the fix is small.

#### Acceptance Criteria

1. `fast-check` is a devDependency only.
2. `tests/properties.test.js` uses `node:test`, runs offline with no API key in under 10 seconds, and uses a fixed seed that is shown in the test names.
3. Properties P1 to P4 in `design.md` are tested. A failing property is not weakened. Its counterexample is reported, and the code is fixed only if the bug is real and the fix is small.

### Requirement 7: Secret scanning

**User Story:** As the project owner, I want an offline check that finds key-like strings without printing them, so that a secret is not committed by mistake.

- REQ-HE-7.1: `scripts/check-secrets.js` (no dependencies) SHALL scan project text files, skipping `node_modules`, `.git`, `.env` and `benchmark/results`. It SHALL report key-like strings (`gsk_` plus 16 or more letters or digits, `sk-` plus 20 or more) and any non-placeholder `GROQ_API_KEY=` value in files other than `.env`, and SHALL check that `.gitignore` lists `.env`.
- REQ-HE-7.2: IT SHALL exit non-zero on a finding and print the file and line, but NEVER the secret.
- REQ-HE-7.3: `npm run check:secrets` SHALL run it. `tests/secrets.test.js` SHALL build fake keys at runtime (no key-like literal in the repository), check detection, and check that `.env.example` gives no finding.

#### Acceptance Criteria

1. `scripts/check-secrets.js` has no dependencies and scans the project's text files, skipping `node_modules`, `.git`, `.env` and `benchmark/results`.
2. It reports `gsk_` followed by 16 or more letters or digits, `sk-` followed by 20 or more characters, and any non-placeholder `GROQ_API_KEY=` value in files other than `.env`, and it checks that `.gitignore` lists `.env`.
3. It exits non-zero on a finding and prints the file and line, never the secret.
4. `npm run check:secrets` runs it. `tests/secrets.test.js` builds fake keys at run time (no key-like literal in the repository), checks detection, and checks that `.env.example` gives no finding.

### Requirement 8: Hook

**User Story:** As the project owner, I want the secret check to run automatically after the agent saves files, so that a leak is noticed early.

- REQ-HE-8.1: A second hook in `.kiro/hooks/` SHALL run `node scripts/check-secrets.js` after file saves, in the same v1 format and fields as `run-tests-on-save.json`.
- REQ-HE-8.2: NO document SHALL claim the hook ran unless it was seen firing.

#### Acceptance Criteria

1. A second hook in `.kiro/hooks/` runs `node scripts/check-secrets.js` after file saves, in the same v1 format and with the same fields as `run-tests-on-save.json`.
2. No document claims the hook ran unless it was seen firing.

### Requirement 9: Steering

**User Story:** As the project owner, I want Kiro to be given the project's security, privacy and accessibility rules, so that future changes follow them.

- REQ-HE-9.1: `.kiro/steering/security-and-privacy.md` (`inclusion: always`) SHALL summarise the security and privacy rules.
- REQ-HE-9.2: `.kiro/steering/accessibility.md` SHALL use `inclusion: fileMatch` with `fileMatchPattern` for `public/` files, and summarise the rules from `.kiro/specs/accessibility/`.

#### Acceptance Criteria

1. `.kiro/steering/security-and-privacy.md` exists with `inclusion: always` and summarises the security and privacy rules.
2. `.kiro/steering/accessibility.md` exists with `inclusion: fileMatch` and a `fileMatchPattern` for `public/` files, and summarises the rules from `.kiro/specs/accessibility/`.

### Requirement 10: Kiro journey

**User Story:** As a reviewer, I want a factual record of how Kiro was used, built from the repository, so that I can check every claim it makes.

- REQ-HE-10.1: `docs/KIRO_JOURNEY.md` SHALL be a factual record built only from repository files: specs with requirement and task counts and completion state, steering files and inclusion modes, hooks, and test counts.
- REQ-HE-10.2: IT SHALL include the author-provided sections exactly as given, and mark everything else "TO COMPLETE BY AUTHOR".

#### Acceptance Criteria

1. `docs/KIRO_JOURNEY.md` is a factual record built only from repository files: the specs with their requirement and task counts and completion state, the steering files and their inclusion modes, the hooks, and the test counts.
2. It includes the author-provided sections exactly as given, and marks everything else "TO COMPLETE BY AUTHOR".

### Requirement 11: Documentation

**User Story:** As a reader of the README and steering files, I want the test counts and tooling descriptions to match the real project, so that the documentation can be trusted.

- REQ-HE-11.1: Test counts in `README.md` and `.kiro/steering/*.md` SHALL match `npm test`. `tech-stack.md` SHALL no longer say there are no devDependencies. The README test section SHALL list the new test files and the `check:secrets` script.

#### Acceptance Criteria

1. The test counts in `README.md` and `.kiro/steering/*.md` match the output of `npm test`.
2. `tech-stack.md` no longer says there are no devDependencies.
3. The README test section lists the new test files and the `check:secrets` script.

## Overall Acceptance Criteria

These criteria cover the whole spec and keep their original numbers 1 to 11.

1. `analyzeText` sends exactly one `<MESSAGE>` and one `</MESSAGE>` to the model when the user's text contains such tags, and a quote kept in the result is a substring of the original text.
2. Every listed Hinglish and Devanagari phrase triggers the 1930 step. "Aapka khata block ho jayega", "paise bhej do" and "transfer kar do" do not.
3. `server.js` contains none of "backend terminal", "Groq access" or "Groq configuration" in a response. The image and audio routes keep status codes 502 and 503.
4. `healthStatus` returns exactly `{ ok, aiConfigured }`, both booleans.
5. `dedupeNextSteps` removes same-meaning repeats, keeps order and caps at 6, and `validateAnalysis` uses it.
6. P1 to P4 run with seed 20261122 and pass, or their counterexamples are reported.
7. `npm run check:secrets` exits 0 on the project. It exits 1 on a temporary folder with a fake key, and its output does not contain the key.
8. The new hook file parses as JSON, and has one hook with the same fields as the existing one.
9. Both steering files exist with the stated front matter.
10. `docs/KIRO_JOURNEY.md` exists with the required sections.
11. `npm test` passes with `GROQ_API_KEY` defined but empty, apart from any failure caused by the open Phase 0 footer item, which is reported.

## Out of scope

- Phase 4 (an evidence-count field and results line) is optional and is not done in this session.
- Any change to Rescue Mode, risk wording, privacy text, `public/style.css` or `.env`.

## Glossary

| Term | Definition |
|---|---|
| `aiConfigured` | The boolean in the `/api/health` response that is true only when an AI key is set. |
| Counterexample | A generated input for which a property fails. `fast-check` reports it with the seed and path needed to repeat it. |
| Devanagari | The script used to write Hindi, for example "पैसे भेज दिए". |
| devDependency | A package that is needed only for development and tests, not at runtime. `fast-check` is the only one. |
| `fast-check` | The property-based testing library used by `tests/properties.test.js`. |
| Fixed seed | The constant random seed (20261122) given to `fast-check` so that every run generates the same inputs. |
| Hinglish | Hindi written in Latin letters, often mixed with English, for example "paise bhej diye". |
| Hook | A JSON file in `.kiro/hooks/` that tells Kiro to run a command when an event happens, for example after a file is saved. |
| `MESSAGE` delimiter | The `<MESSAGE>` and `</MESSAGE>` tags that surround the user's text in the prompt sent to the model. |
| Placeholder | A value in `.env.example` or documentation that stands for a real key without being one, for example `your-groq-api-key-here`. |
| Property-based test | A test that checks a rule against many generated inputs instead of a few hand-written examples. |
| Steering file | A Markdown file in `.kiro/steering/` that Kiro includes as project guidance, either always or for matching files. |
