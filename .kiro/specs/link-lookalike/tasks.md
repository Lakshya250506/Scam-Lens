# Implementation Plan: Brand lookalike check for link inspection

## Overview

Requirements are in `requirements.md` and the design is in `design.md`. Do not change any behaviour or file outside the list in the design. Do not touch `.env`. Do not run anything that needs a Groq key.

## Task Dependency Graph

Waves follow the order and dependencies stated in the tasks below. Task 2 uses the constants from task 1, task 3 wires task 2 into `inspectLink`, tasks 4 and 5 check the wired result, and task 7 verifies tasks 1 to 6. The follow-up tasks 8 to 10 change the same check, task 11 tests them, task 12 updates the documents and task 13 verifies.

```json
{
  "waves": [
    {
      "id": 0,
      "tasks": [
        "1"
      ]
    },
    {
      "id": 1,
      "tasks": [
        "2"
      ]
    },
    {
      "id": 2,
      "tasks": [
        "3"
      ]
    },
    {
      "id": 3,
      "tasks": [
        "4",
        "5"
      ]
    },
    {
      "id": 4,
      "tasks": [
        "6"
      ]
    },
    {
      "id": 5,
      "tasks": [
        "7"
      ]
    },
    {
      "id": 6,
      "tasks": [
        "8",
        "9",
        "10"
      ]
    },
    {
      "id": 7,
      "tasks": [
        "11"
      ]
    },
    {
      "id": 8,
      "tasks": [
        "12"
      ]
    },
    {
      "id": 9,
      "tasks": [
        "13"
      ]
    }
  ]
}
```

## Tasks

- [x] 1. Add the data constants to `server.js`
  - `INDIAN_BRANDS` (every official-domain entry marked `TO VERIFY BY AUTHOR`), `LOOKALIKE_KEYWORDS`, `LOOKALIKE_SUSPICIOUS_TLDS`, `REGISTRABLE_SECOND_LEVELS`, `LOOKALIKE_KIND_TEXT`, with a comment block that states the limits.
  - _Requirements: REQ-LL-3.1 to 3.4_

- [x] 2. Add `getRegistrableDomain` and `checkBrandLookalike`
  - Pure functions, no I/O. Implement host preparation, tokenising, Rule A and Rule B as in `design.md`.
  - _Requirements: REQ-LL-1.x, 2.x, 4.x, 5.x, 6.x_

- [x] 3. Wire the check into `inspectLink`
  - Append findings after the existing checks, add the suggestion, and include `lookalike.high` in the High caution test. Leave `reputation_check` and `disclaimer` as they are.
  - _Requirements: REQ-LL-1.4, 5.3, 6.2, 7.1_

- [x] 4. Add tests to `tests/server.test.js`
  - Flagged and not-flagged URL lists, wording, normalisation, punycode, each of (a) (b) (c), Rule B, per-brand table, unchanged `reputation_check` and `disclaimer`, determinism.
  - Do not edit or remove existing tests.
  - _Requirements: REQ-LL-8.3, Acceptance Criteria 1 to 7_

- [x] 5. Confirm the frontend needs no change
  - Read the link-result code in `public/index.html`. It uses `fillList` with `textContent`. Edit it only if the new findings cannot be shown.
  - Result: no change needed. `fillList` renders every finding and suggestion with `textContent`; `public/index.html` was not edited.
  - _Requirements: REQ-LL-7.2_

- [x] 6. Update `README.md` and the steering test counts
  - Link bullet, limitations, and the new `npm test` totals in `README.md`, `.kiro/steering/structure.md` and `.kiro/steering/tech-stack.md`.
  - _Requirements: REQ-LL-8.1, 8.2_

- [x] 7. Verify
  - `node --check server.js`, `npm test` (with `GROQ_API_KEY` defined but empty), and a check that no other file changed.
  - Report every brand and official domain for the author to verify.
  - Result: `npm test` with `GROQ_API_KEY` defined but empty (kept empty after `dotenv.config()`): 91 tests, 91 pass, 0 fail, exit code 0 (74 server tests, 17 rescue tests). `node --check server.js` passes. The official domains are still awaiting author verification.
  - _Requirements: Acceptance Criterion 8_

## Follow-up: restricted namespaces, ordinary-word brand and risk safety

Requirements 9, 10 and 11 in `requirements.md`. Do not add or remove any official domain. Do not touch `.env` or `public/index.html`.

- [x] 8. Treat `bank` and `fin` as second-level labels under `.in`
  - Add `IN_RESTRICTED_SECOND_LEVELS` and use it in `getRegistrableDomain` only when the last label is `in`.
  - _Requirements: REQ-LL-9.1_

- [x] 9. Add `RESTRICTED_NAMESPACES` and skip Rule A for those hosts
  - Constant `['bank.in', 'fin.in']` with the comment "Restricted to RBI-approved entities. Assumption, TO VERIFY BY AUTHOR." Dot-boundary match (`host === ns` or `host.endsWith('.' + ns)`). Rule B and all existing findings stay as they are.
  - _Requirements: REQ-LL-9.2 to 9.5_

- [x] 10. Require `bank` with the brand word `axis`
  - Add `AMBIGUOUS_BRAND_TOKENS` (axis needs bank) and apply it to the token-present test and to Rule A condition (c). `axisbank` always counts. No other brand changes.
  - _Requirements: REQ-LL-10.1 to 10.3_

- [x] 11. Add tests (offline, no key)
  - New describe block: clean `bank.in` addresses, still-flagged lookalikes, axis cases, risk-level safety, unchanged `reputation_check` and `disclaimer`, direct `getRegistrableDomain` test. Export `getRegistrableDomain` under the existing `NODE_ENV === 'test'` guard.
  - Existing tests are not edited, except the axis row of LL-T12, which cannot pass once `axis-login.xyz` stops matching Rule A (REQ-LL-8.3).
  - _Requirements: REQ-LL-8.3, 11.1 to 11.3, Acceptance Criteria 9 to 13_

- [x] 12. Update `README.md` (link limitations, test counts) and the steering test counts
  - _Requirements: REQ-LL-8.1, 8.2_

- [x] 13. Verify
  - `node --check server.js`, `npm test` with `GROQ_API_KEY` defined but empty and kept empty after `dotenv.config()`, and a check that the brand table is unchanged.
  - Result: `npm test` with `GROQ_API_KEY` defined but empty (kept empty after `dotenv.config()`): 102 tests, 102 pass, 0 fail, exit code 0 (85 server tests, 17 rescue tests). `node --check server.js` passes. The brand table and its official domains are unchanged. The axis row of LL-T12 was the only existing test line edited.

## Notes

- The official domains are the author's to confirm. The implementer lists only domains it is sure of.
- Older spec files (`.kiro/specs/stability-security/`) still state 77 tests. They describe the project before this feature and are not edited here.
