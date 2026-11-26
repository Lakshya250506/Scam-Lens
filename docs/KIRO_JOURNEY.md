# Kiro Journey — Scam Lens

This is a factual record of how Kiro was used on Scam Lens, as of 26 November 2026. Counts were recomputed on that date from the files in this repository. Facts that cannot be read from the repository were provided by the author and are marked as such. Anything still unknown is marked **TO COMPLETE BY AUTHOR**.

How the counts were made:

- Requirements, User Stories, per-requirement acceptance criteria and task statuses were counted with Kiro's own spec parsers (the user-story and task parsers in the installed Kiro extension).
- **Requirement IDs** are lines that start with `- REQ-…:` in `requirements.md`.
- **Overall acceptance criteria** are the numbered items under `## Overall Acceptance Criteria`.
- **Tasks** are numbered checkbox lines in `tasks.md`, not counting optional `- [ ]*` tasks or the separate "Completion checklist" in `stability-security`.
- Test counts come from `npm test`.

## Specs

Each spec in `.kiro/specs/` has `requirements.md`, `design.md` and `tasks.md`. All twelve files pass Kiro's spec format check with 0 errors and 0 warnings.

| Spec | Purpose | Requirements | Requirement IDs | Acceptance criteria (per requirement + overall) | Tasks | Done |
|---|---|---|---|---|---|---|
| `stability-security` | Bug fixes, CSP, API key handling, automated tests, post-audit fixes | 6 | 80 | 51 + 0 | 61 (7 top-level and their sub-tasks) | 59 of 61 |
| `link-lookalike` | Deterministic brand lookalike check in link inspection | 11 | 40 | 42 + 13 | 13 | 13 of 13 |
| `accessibility` | Keyboard and screen-reader improvements | 15 | 42 | 60 + 13 | 11 | 10 of 11 |
| `hardening-and-evidence` | Prompt and error hardening, property-based tests, secret scanner, these records | 12 | 23 | 32 + 11 | 12, plus 2 optional | 12 of 12 (optional not started) |

Open tasks:

- `stability-security` task 7 and its sub-task 7.4 ("Verify the PostFileSave hook fires in a Kiro session") are marked `[~]`. The project uses `[~]` to mean deferred, but Kiro's task parser reads it as "queued".
- `accessibility` task 11 (Verify) is still marked in progress. It was blocked while the page footer was missing. The footer has since been restored and `npm test` passes, but the task has not been re-marked. **TO COMPLETE BY AUTHOR:** decide whether to close it.
- `hardening-and-evidence` optional tasks 12 and 13 (an evidence-count field and a results line) are not started, by design.

`stability-security` also contains `tasks.meta.json`, Kiro's own record of session execution for that spec.

## Steering files (`.kiro/steering/`)

| File | Inclusion mode |
|---|---|
| `product.md` | `always` |
| `tech-stack.md` | `always` |
| `structure.md` | `always` |
| `security-and-privacy.md` | `always` |
| `accessibility.md` | `fileMatch`, `fileMatchPattern: "public/**/*"` |

## Hooks (`.kiro/hooks/`)

| File | Name | Trigger | Command | Timeout | Enabled |
|---|---|---|---|---|---|
| `run-tests-on-save.json` | Run offline tests after code changes | `PostFileSave` | `npm test` | 120 s | true |
| `check-secrets-on-save.json` | Check for secrets after file saves | `PostFileSave` | `node scripts/check-secrets.js` | 60 s | true |

## Tests

`npm test` runs five files with the Node.js test runner. It needs no network and no API key. Latest run: 157 tests, 157 pass, 0 fail.

| File | Tests | What it covers |
|---|---|---|
| `tests/server.test.js` | 98 | Server pure functions, `analyzeText` and `extractImageText` with mock clients, link inspection and the lookalike rules, hardening (HE-T1 to HE-T13) |
| `tests/rescue.test.js` | 17 | Rescue Mode scenario combinations and sources |
| `tests/a11y.test.js` | 29 | Static accessibility checks on the HTML and CSS text |
| `tests/properties.test.js` | 5 | fast-check properties P1, P2, P3, P4a and P4b (seed 20261122) |
| `tests/secrets.test.js` | 8 | `scripts/check-secrets.js` |
| **Total** | **157** | |

Earlier recorded totals in the specs:

- 37: the Task 5 minimum.
- 48, then 64: during `stability-security`, reaching 64 at the end of its Task 6.
- 69: after its Task 7.3.
- 77: after its Task 7.6.
- 91 and 102: `link-lookalike`.
- 129: `accessibility`.
- 155: `hardening-and-evidence`.

The first property-test run found a real bug. The counterexample `incometaxindia.sbi.co.in` was wrongly flagged as a lookalike. The bug was fixed in `server.js` and kept as the regression test HE-T13.

## Where Kiro surprised us

(Author-provided, included as written.)

- (a) While adding the brand-lookalike check, Kiro noticed that one of my instructions contradicted an existing test (axis-login.xyz), changed only that one test address, recorded the exception in the spec and told me.
- (b) The accessibility spec began with an audit table and found problems I had not asked about (the footer inside main, a skipped heading level, focus outlines too faint).
- (c) It computed real colour-contrast ratios from the CSS and changed only the failing colours.
- (d) When a file changed unexpectedly during the session, it stopped and asked rather than overwriting it.
- (e) It found two mistakes in its own new tests on a full run and fixed them.

## Built outside Kiro

(Author-provided.)

- ChatGPT and Claude were used outside Kiro for review, test and benchmark design, prompt drafting and documentation drafting.
- All code and content was reviewed and run by the author.
- Some edits were made manually.

## Hooks observed

(Author-provided.)

- `run-tests-on-save.json` was seen firing repeatedly during the link-lookalike and accessibility sessions.
- `check-secrets-on-save.json` ("Check for secrets after file saves") was seen triggering in the Phase A session.

Nothing else about hook execution is claimed.

## Timeline

(Author-provided, plus dates recorded in the specs.)

- Development began on 10 November 2026, locally, before the GitHub repository existed.
- The repository was created later, so commit dates show when code was uploaded, not when it was written.
- Dated entries in `.kiro/specs/` run from 18 November 2026 (`stability-security` follow-ups) to 26 November 2026 (this record).

TO COMPLETE BY AUTHOR: dates for each spec, if wanted.

## What we would do differently

TO COMPLETE BY AUTHOR.
