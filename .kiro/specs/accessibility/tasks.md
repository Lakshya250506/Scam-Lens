# Implementation Plan: Accessibility improvements

## Overview

Requirements are in `requirements.md`. The audit table and the design are in `design.md`. Do not change `server.js`, `public/rescue.js`, any Rescue Mode step, any risk wording, the privacy text or any API behaviour. Do not edit existing tests. Do not touch `.env`. Do not claim WCAG conformance anywhere.

## Task Dependency Graph

Waves follow the existing sections below. Priority 1 (tasks 1 to 3) comes first. Task 4 runs `npm test` "before starting Priority 2". Priority 2 (tasks 5 to 8) follows, then the documentation tasks 9 and 10, then task 11 verifies everything.

```json
{
  "waves": [
    {
      "id": 0,
      "tasks": [
        "1",
        "2",
        "3"
      ]
    },
    {
      "id": 1,
      "tasks": [
        "4"
      ]
    },
    {
      "id": 2,
      "tasks": [
        "5",
        "6",
        "7",
        "8"
      ]
    },
    {
      "id": 3,
      "tasks": [
        "9",
        "10"
      ]
    },
    {
      "id": 4,
      "tasks": [
        "11"
      ]
    }
  ]
}
```

## Tasks

### Priority 1

- [x] 1. Markup in `public/index.html`
  - Skip link, `#liveAnnouncer`, `#newTabHint`, `div.app-shell` around `main#mainContent` and `footer`, one `nav`, `tabindex="-1"` on every view `h1` and on the "URL inspection" `h2`, `aria-current` on the Home button, `aria-hidden` on decorative marks and icons.
  - Forms: counter and helper linked to `#messageInput`, helper links for the review textareas, `fieldset` and `legend` around the rescue checkboxes, `p#imageError[role="alert"]`.
  - Voice: `aria-pressed`, `aria-describedby`, `aria-hidden` on `#recordDot`, `role="timer"` and `aria-live="off"` on `#recordTimer`.
  - Remove `aria-live` from `section.rescue-checklist-panel`. Remove `role="status"` from `#incidentSummaryStatus`.
  - `aria-describedby="newTabHint"` on every `target="_blank"` link.
  - _Requirements: REQ-A11Y-1, 2, 5, 6.3, 7.1, 7.3, 13_

- [x] 2. Script in `public/index.html` (existing nonce-protected block only)
  - `announce`, `startBusy` and `endBusy`, `showFieldError` and `clearFieldError`.
  - `showView`: focus the `h1`, update the title, `aria-current`, reduced-motion scrolling.
  - Results focus, review-textarea focus, announcements for copy, save, delete, checklist and recording, history cards as `h2`, new-tab description on the script-created link.
  - _Requirements: REQ-A11Y-3, 4, 6, 7_

- [x] 3. Styles in `public/style.css` (Priority 1 parts)
  - `.visually-hidden`, `.skip-link`, `:focus-visible` rules using `--focus-ring`, remove `outline: none`, fieldset reset, history `h2` selector.
  - _Requirements: REQ-A11Y-1.2, 5.3, 8_

- [x] 4. Tests
  - Add `tests/a11y.test.js`. Change only the `test` script line in `package.json`. Run `npm test` before starting Priority 2.
  - _Requirements: REQ-A11Y-15_

### Priority 2

- [x] 5. Colour contrast (values only)
  - `--muted`, placeholder colour, idle record dot, dead footer colour, new `--control-border` and `--focus-ring`. Report the ratios.
  - _Requirements: REQ-A11Y-9_

- [x] 6. Touch targets and reflow
  - 44 px minimum for buttons and the checkbox row at max-width 640px, a larger checkbox, and `white-space: normal` on the rescue buttons on very narrow screens.
  - _Requirements: REQ-A11Y-10, 11_

- [x] 7. Reduced motion
  - Confirm the CSS rule exists. Script follows the preference (done in task 2).
  - _Requirements: REQ-A11Y-12_

- [x] 8. New-tab hint
  - Done through `aria-describedby="newTabHint"` (tasks 1 and 2). Tests cover it.
  - _Requirements: REQ-A11Y-13_

### Documentation and verification

- [x] 9. `public/privacy.html`
  - Skip link, `div.app-shell` containing `header`, `main#mainContent` and `footer`, `aria-describedby` on the new-tab links, hidden hint element. No text change.
  - _Requirements: REQ-A11Y-2.4_

- [x] 10. `README.md` "Accessibility" section and test counts in `README.md` and `.kiro/steering/*.md`.
  - _Requirements: REQ-A11Y-15.3_

- [-] 11. Verify (blocked: see Results)
  - `node --check` on `server.js` and `public/rescue.js`, the inline script of `index.html`, JSON-LD validity, `npm test` with `GROQ_API_KEY` defined but empty, and a check that `server.js`, `rescue.js`, `tests/server.test.js`, `tests/rescue.test.js` and `.env` were not modified.

## Results

- Priority 1 (items 1 to 8) and Priority 2 (items 9 to 13) are implemented. Item 10 is a 44 px labelled row with a 24 px checkbox, not a 44 by 44 px checkbox (see `design.md` Decisions).
- An earlier full run passed: `npm test` with `GROQ_API_KEY` defined but empty (kept empty after `dotenv.config()`) gave 129 tests, 129 pass, 0 fail (85 server, 17 rescue, 27 accessibility).
- **Open, 2026-11-22 13:18:** after that run, `public/index.html` was modified outside this task and its whole page `footer` (credit, privacy link, description) was removed. The accessibility edits are still present. The latest `npm test` gives 129 tests, 128 pass, 1 fail ("index.html has one header, one nav, one main and one footer"). The footer was not restored, because the change may be intentional. Task 11 stays open until the owner decides.
- `server.js`, `public/rescue.js`, `tests/server.test.js`, `tests/rescue.test.js`, the hook and `.env` were not modified.

## Notes

- Everything that needs a real browser or screen reader is listed in `design.md` under "Manual verification list" and stays unverified until the author checks it.
