# Implementation Plan: Hardening and Kiro workflow evidence

## Overview

Requirements are in `requirements.md`, and the check table and design are in `design.md`. Do not change Rescue Mode, risk wording, the privacy text, `public/style.css` or `.env`. Do not edit existing tests. Do not claim accuracy or WCAG conformance.

## Task Dependency Graph

Task 0 (Phase 0) comes first. The property tests (task 6) run against the code from tasks 1 to 5, and the hook (task 8) runs the script from task 7. `docs/KIRO_JOURNEY.md` (task 10) records the results of the earlier tasks, and task 11 verifies them. The optional tasks 12 and 13 (Phase 4) come last; task 13 shows the field that task 12 adds.

```json
{
  "waves": [
    {
      "id": 0,
      "tasks": [
        "0"
      ]
    },
    {
      "id": 1,
      "tasks": [
        "1",
        "2",
        "3",
        "4",
        "5",
        "7",
        "9"
      ]
    },
    {
      "id": 2,
      "tasks": [
        "6",
        "8"
      ]
    },
    {
      "id": 3,
      "tasks": [
        "10"
      ]
    },
    {
      "id": 4,
      "tasks": [
        "11"
      ]
    },
    {
      "id": 5,
      "tasks": [
        "12"
      ]
    },
    {
      "id": 6,
      "tasks": [
        "13"
      ]
    }
  ]
}
```

## Tasks

- [x] 0. Phase 0: check the footer in `public/index.html`, then run `npm test`
  - Done 2026-11-26: footer restored after `</main>` in `public/index.html`; `npm test` 155 of 155 with `GROQ_API_KEY` defined but empty.
  - If the footer is missing, do not recreate it. Leave it for the author.
  - _Requirements: REQ-HE-0.1_

- [x] 1. Neutralise `<MESSAGE>` tags in the prompt (`neutraliseDelimiters`, used in `analyzeText`), with tests
  - Evidence: `neutraliseDelimiters` in `server.js`, used in the `analyzeText` prompt. Tests HE-T1, HE-T2, HE-T3.
  - _Requirements: REQ-HE-1_

- [x] 2. Extend `moneyAlreadyMoved` with Hinglish and Devanagari phrases, with tests
  - Evidence: `moneyAlreadyMoved` in `server.js`, used by `validateAnalysis`. Tests HE-T4, HE-T5.
  - _Requirements: REQ-HE-2_

- [x] 3. Plain upload error messages (`providerFailureMessage`) in `/api/analyze-image` and `/api/transcribe`, with tests
  - Evidence: `providerFailureMessage` in `server.js`, used in `/api/analyze-image` and `/api/transcribe`. Tests HE-T6, HE-T7.
  - _Requirements: REQ-HE-3_

- [x] 4. `healthStatus` and `aiConfigured` in `/api/health`, with tests
  - Evidence: `healthStatus` in `server.js`, used by `/api/health`. Test HE-T8.
  - _Requirements: REQ-HE-4_

- [x] 5. `dedupeNextSteps` (cap 6) used by `validateAnalysis`, with tests
  - Evidence: `dedupeNextSteps` in `server.js`, used by `validateAnalysis`. Tests HE-T9, HE-T10, HE-T11, HE-T12.
  - _Requirements: REQ-HE-5_

- [x] 6. Install `fast-check` as a devDependency and add `tests/properties.test.js` (P1 to P4, fixed seed)
  - Evidence: `fast-check` ^4.11.0 in devDependencies; `tests/properties.test.js` in `npm test`. Tests P1, P2, P3, P4a, P4b (seed 20261122) and the regression HE-T13 for the P4a counterexample.
  - _Requirements: REQ-HE-6_

- [x] 7. `scripts/check-secrets.js`, the `check:secrets` script and `tests/secrets.test.js`
  - Evidence: `scanProject` in `scripts/check-secrets.js`; `check:secrets` script in `package.json`. Tests SC-T1 to SC-T8.
  - _Requirements: REQ-HE-7_

- [x] 8. Second hook `.kiro/hooks/check-secrets-on-save.json`
  - Evidence: .kiro/hooks/check-secrets-on-save.json exists (PostFileSave, runs node scripts/check-secrets.js); seen triggering on the author's machine in the Phase A session. No automated test covers the hook itself.
  - _Requirements: REQ-HE-8_

- [x] 9. Steering files `security-and-privacy.md` and `accessibility.md`
  - Evidence: both steering files exist with front matter (inclusion: always, and inclusion: fileMatch with public/**/*). No automated test covers steering inclusion.
  - _Requirements: REQ-HE-9_

- [x] 10. `docs/KIRO_JOURNEY.md`
  - Evidence: `docs/KIRO_JOURNEY.md` exists, and its counts (requirements, acceptance criteria, tasks and completed tasks per spec, steering inclusion modes, hooks and test counts) were recomputed from the files on 2026-11-26 with Kiro's own spec parsers. Author-provided facts are marked as such; open items are marked TO COMPLETE BY AUTHOR.
  - _Requirements: REQ-HE-10_

- [x] 11. Update `README.md`, `.kiro/steering/structure.md` and `tech-stack.md`, then verify
  - Evidence: `README.md`, `.kiro/steering/structure.md` and `tech-stack.md` updated on 2026-11-26. Test counts checked against `npm test` with `GROQ_API_KEY` defined but empty: 155 tests, 155 pass (98 server, 17 rescue, 27 a11y, 5 properties, 8 secrets). `npm run check:secrets` passes.
  - `npm test` with `GROQ_API_KEY` defined but empty and kept empty after `dotenv.config()`, `npm run check:secrets`, `node --check`, and JSON checks of both hooks.
  - _Requirements: REQ-HE-11_

## Optional (Phase 4, not to be done in this session)

The `- [ ]*` marker is the usual Kiro convention for optional tasks. Kiro's documentation mentions optional tasks but does not document their syntax.

- [ ]* 12. Add an additive field to the analysis response with the number of AI-suggested evidence quotes found in the user's text and the number dropped. No existing field changes. Add tests.
- [ ]* 13. Show one plain line on the results page, for example "3 of 3 quoted phrases were found in your message", rendered with `textContent` in a layout that is safe with the live region. Add tests.

## Notes

- Tasks 12 and 13 are optional (Phase 4) and are not done in this session.
- The `- [ ]*` marker for optional tasks is explained under "Optional (Phase 4, not to be done in this session)" above.
- Do not change Rescue Mode, risk wording, the privacy text, `public/style.css` or `.env` (see Overview).
