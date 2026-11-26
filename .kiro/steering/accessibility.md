---
inclusion: fileMatch
fileMatchPattern: "public/**/*"
---

# Scam Lens — Accessibility Rules for `public/`

Summary of `.kiro/specs/accessibility/`. These describe improvements, not conformance. Never claim WCAG conformance. The work has not had a formal audit.

## Structure

- Keep one `header`, one `nav`, one `main id="mainContent" tabindex="-1"` and one `footer` per page. The footer goes after `</main>`.
- The first focusable element is the "Skip to main content" link to `#mainContent`.
- Each view has exactly one `h1` with `tabindex="-1"`. Heading levels never skip, including headings created by script.

## Focus and announcements

- `showView` moves focus to the view's `h1` and updates `document.title`. Never move focus on initial page load.
- Working buttons use `startBusy` and `endBusy` (`aria-busy`, "Analysing, please wait"). Results move focus to their heading. Review textareas get focus after extraction or transcription.
- Short status messages go through `announce()` and the single polite `#liveAnnouncer` region. Do not make the same element a live region as well, or text is read twice.
- Errors use `role="alert"` and `showFieldError` and `clearFieldError`, which link the error to its field with `aria-describedby` and `aria-invalid` only while it is visible.
- The voice tool exposes `aria-pressed` and announces start and stop once. The timer is `aria-live="off"` and is never announced.

## Forms and links

- Every `input`, `textarea` and `select` has a label. Related controls go in a `fieldset` with a `legend`.
- Every `target="_blank"` link keeps `rel="noopener noreferrer"` and has `aria-describedby="newTabHint"`.

## Styles

- No `outline: none`. Use `:focus-visible` with `--focus-ring`.
- Text pairs need at least 4.5:1 contrast. Field borders and focus rings need at least 3:1. Change colour values only, and check with `tests/a11y.test.js`.
- Targets are at least 44 px tall below 640 px width. Respect `prefers-reduced-motion` in CSS and in script scrolling.
- Use `.visually-hidden` for screen-reader-only text. No inline `style` attributes or event handlers (CSP).

## Checks

- `tests/a11y.test.js` reads the files as text. It cannot replace testing in a browser and with screen readers, which still needs to be done by hand.
