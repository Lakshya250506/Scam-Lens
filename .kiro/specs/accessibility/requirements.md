# Requirements Document

## Introduction

### Feature: Keyboard and screen-reader accessibility improvements

| Field | Value |
|---|---|
| Spec title | Scam Lens – Keyboard and screen-reader accessibility |
| Goal | Make the existing single-page app easier to use with a keyboard and a screen reader, without changing behaviour, features, safety wording or API behaviour. |
| Scope | `public/index.html` (markup and the existing nonce-protected inline script), `public/style.css`, small markup changes in `public/privacy.html`, a new test file `tests/a11y.test.js`, the `test` script line in `package.json`, and an "Accessibility" section plus test counts in `README.md` and `.kiro/steering/*.md`. |
| Out of scope | `server.js`, `public/rescue.js`, Rescue Mode step order and wording, risk wording, the privacy text, any API behaviour, new dependencies, network calls. |
| Related steering | `.kiro/steering/product.md`: plain language, no AI or network in Rescue Mode and link inspection, no new tracking, no overstated claims. |

This work improves accessibility. It makes **no claim of WCAG conformance**. It has not had a formal audit and has not been tested with every screen reader.

## Requirements

### Requirement 1: Skip link (Priority 1, item 1)

**User Story:** As a keyboard user, I want a "Skip to main content" link at the start of the page, so that I can reach the main content without first moving through the header and navigation.

- REQ-A11Y-1.1: THE first focusable element of `index.html` SHALL be a link with the text "Skip to main content" that targets the `main` landmark by id.
- REQ-A11Y-1.2: THE link SHALL be visually hidden until it receives keyboard focus, and SHALL then be fully visible.
- REQ-A11Y-1.3: THE `main` element SHALL be focusable by script (`tabindex="-1"`) so that following the link moves focus on every browser.

#### Acceptance Criteria

1. The first focusable element of `index.html` is a link with the text "Skip to main content" and `href="#mainContent"`, and `id="mainContent"` is on the `main` element.
2. The link is visually hidden until it receives keyboard focus, and is fully visible while it has focus.
3. `main` has `tabindex="-1"`, and following the link moves keyboard focus to `main`. **Needs author clarification:** REQ-A11Y-1.3 says this must work "on every browser", but neither this spec nor `design.md` lists the browsers to check.

### Requirement 2: Landmarks and headings (item 2)

**User Story:** As a screen-reader user, I want each page to have clearly marked areas and headings that never skip a level, so that I can move between parts of the page and understand how it is organised.

- REQ-A11Y-2.1: `index.html` SHALL contain exactly one each of `header`, `nav`, `main` and `footer`. THE `footer` SHALL NOT be inside `main`, so that it is the page footer landmark.
- REQ-A11Y-2.2: EVERY view (home, text, screenshot, voice, link, results, Rescue Mode, history, guide) SHALL have exactly one `h1`.
- REQ-A11Y-2.3: HEADING levels inside a view SHALL NOT skip a level, including headings that script creates (history cards SHALL be `h2`, not `h3`).
- REQ-A11Y-2.4: `privacy.html` SHALL have exactly one `main`, one page `header` and one page `footer` landmark, and a skip link, without changing any privacy text.

#### Acceptance Criteria

1. `index.html` contains exactly one `header`, one `nav`, one `main` and one `footer`, and the `footer` comes after `</main>`.
2. Each view (home, text, screenshot, voice, link, results, Rescue Mode, history and guide) contains exactly one `h1`.
3. Inside each view, heading levels never skip a level, including headings that script creates. History cards use `h2`, not `h3`.
4. `privacy.html` contains exactly one `main`, one page `header`, one page `footer` and a skip link, and its privacy text is unchanged.

### Requirement 3: View changes (item 3)

**User Story:** As a keyboard or screen-reader user, I want focus and the page title to follow me when I switch views, so that I know which view is open without searching for it.

- REQ-A11Y-3.1: WHEN the user opens any view through `showView`, THE script SHALL move keyboard focus to that view's `h1` (which has `tabindex="-1"`) and SHALL update `document.title` to the view's heading plus " – Scam Lens". THE home view SHALL restore the original page title.
- REQ-A11Y-3.2: THE script SHALL NOT move focus on initial page load and SHALL NOT call `showView` at top level.
- REQ-A11Y-3.3: THE active navigation button SHALL expose `aria-current="page"`.
- REQ-A11Y-3.4: SMOOTH scrolling in script SHALL be skipped when the user prefers reduced motion.

#### Acceptance Criteria

1. When a view opens through `showView`, keyboard focus moves to that view's `h1`, which has `tabindex="-1"`.
2. When a view other than home opens, `document.title` becomes the view's heading followed by " – Scam Lens". When the home view opens, the original page title is restored.
3. Loading the page does not move focus, and the script makes no top-level call to `showView`.
4. The navigation button for the current view has `aria-current="page"`.
5. When the user prefers reduced motion, scrolling started by the script is not smooth.

### Requirement 4: Loading, results and errors (item 4)

**User Story:** As a screen-reader user, I want to hear when a check is running, to land on the results when they appear, and to hear each error together with the field it belongs to, so that I always know what happened.

- REQ-A11Y-4.1: WHILE a submit or extract button is working, THE script SHALL set `aria-busy="true"` on it and SHALL announce "Analysing, please wait" once in a polite live region. WHEN work ends it SHALL remove `aria-busy`.
- REQ-A11Y-4.2: WHEN results appear, focus SHALL move to the results heading. For the results view this is the `h1`. For link inspection it is the "URL inspection" `h2` (`tabindex="-1"`). WHEN extracted screenshot text or a transcript appears, focus SHALL move to its review textarea. Existing behaviour that the user reviews text before analysis SHALL NOT change.
- REQ-A11Y-4.3: ERROR messages SHALL use `role="alert"`. Screenshot errors SHALL move from the status line to a new `role="alert"` element, so they are announced as errors.
- REQ-A11Y-4.4: WHERE an error belongs to a field, THE field SHALL reference it with `aria-describedby` and `aria-invalid="true"` only while the error is visible, and SHALL drop both when it is cleared, so a hidden error is not read as a description.

#### Acceptance Criteria

1. While one of the working buttons listed in `design.md` (audit item 4a) is working, it has `aria-busy="true"`, and "Analysing, please wait" is announced once in the polite live region. When the work ends, `aria-busy` is removed.
2. When analysis results appear, focus moves to the results view's `h1`. When link inspection results appear, focus moves to the "URL inspection" `h2`, which has `tabindex="-1"`.
3. When extracted screenshot text or a transcript appears, focus moves to its review textarea, and analysis still starts only after the user has reviewed the text and asked for it.
4. Error messages use `role="alert"`. Screenshot errors appear in their own `role="alert"` element, `imageError`, instead of the status line.
5. While an error that belongs to a field is visible, the field has `aria-describedby` pointing to the error and `aria-invalid="true"`. When the error is cleared, both are removed from the field.

### Requirement 5: Forms (item 5)

**User Story:** As a screen-reader user, I want every form field to have a label, its hints read with it, and related checkboxes grouped under one question, so that I understand each field without seeing the screen.

- REQ-A11Y-5.1: EVERY `input`, `textarea`, `select` and file input SHALL have an associated `label` (`for`/`id`, a wrapping `label`, or `aria-label`).
- REQ-A11Y-5.2: THE character counter SHALL be linked to the message textarea with `aria-describedby`, together with its helper text.
- REQ-A11Y-5.3: THE Rescue Mode situation checkboxes SHALL be inside a `fieldset` with a `legend`.

#### Acceptance Criteria

1. Every `input`, `textarea`, `select` and file input has an associated label: a `label` with a matching `for`, a wrapping `label`, or `aria-label`.
2. The message textarea, `messageInput`, has `aria-describedby` that refers to the character counter, `characterCount`, and to its helper text.
3. The Rescue Mode situation checkboxes are inside a `fieldset` that has a `legend`.

### Requirement 6: Live announcements (item 6)

**User Story:** As a screen-reader user, I want short spoken confirmations when I copy, save or delete something or change my Rescue Mode choices, so that I know the action worked without the whole checklist being read out again.

- REQ-A11Y-6.1: THE page SHALL have one polite live region (`aria-live="polite"`, visually hidden) present in the markup at load.
- REQ-A11Y-6.2: THE script SHALL announce "Copied" after a copied report or a copied incident summary, "Saved locally" after a saved report, "Deleted" after a deleted history item or "Delete all", and "Checklist updated: N steps" when the Rescue Mode selection changes.
- REQ-A11Y-6.3: THE Rescue Mode checklist SHALL stay an ordered list (`ol`). THE `aria-live` attribute on the checklist panel SHALL be removed, because the whole list would otherwise be read again on every change.
- REQ-A11Y-6.4: EXISTING visible status text SHALL stay. WHERE a status element had `role="status"`, its text SHALL be spoken once, not twice.

#### Acceptance Criteria

1. When the page loads, the markup already contains a visually hidden live region with `aria-live="polite"`.
2. "Copied" is announced after a report or an incident summary is copied, "Saved locally" after a report is saved, and "Deleted" after one history item is deleted or after "Delete all".
3. When the Rescue Mode selection changes, "Checklist updated: N steps" is announced, where N is the number of steps in the checklist ("1 step" when there is one).
4. The Rescue Mode checklist is an ordered list (`ol`), and the checklist panel has no `aria-live` attribute.
5. Existing visible status text stays as it was, and a status message from an element that had `role="status"` is spoken once, not twice.

### Requirement 7: Voice tool (item 7)

**User Story:** As a screen-reader user recording a suspicious call, I want to know whether recording is on and to hear when it starts and stops, without hearing the timer every second, so that I can control the recording with confidence.

- REQ-A11Y-7.1: THE start button SHALL expose its state with `aria-pressed` (true while recording). THE record status text SHALL be linked to the record buttons with `aria-describedby`.
- REQ-A11Y-7.2: STARTING and STOPPING a recording SHALL each be announced once ("Recording started", "Recording stopped").
- REQ-A11Y-7.3: THE running timer (`#recordTimer`) SHALL NOT be announced every second (`aria-live="off"`, `role="timer"`), and the update code SHALL NOT call the announcer.
- REQ-A11Y-7.4: MICROPHONE errors SHALL use `role="alert"`.
- REQ-A11Y-7.5: WHEN the focused start or stop button becomes disabled by the recorder, focus SHALL move to the next useful control.

#### Acceptance Criteria

1. The start button has `aria-pressed="true"` while recording and `aria-pressed="false"` when not recording.
2. The record buttons refer to the record status text with `aria-describedby`.
3. "Recording started" is announced once when recording starts, and "Recording stopped" once when it stops.
4. `#recordTimer` has `role="timer"` and `aria-live="off"`, and the code that updates the timer does not call the announcer.
5. Microphone errors use `role="alert"`.
6. When the focused start or stop button becomes disabled by the recorder, focus moves to the next useful control: the stop button when recording starts, and the transcribe button when it stops.

### Requirement 8: Focus visibility (item 8)

**User Story:** As a keyboard user, I want a clearly visible outline on whatever has focus, so that I can always see where I am on the page.

- REQ-A11Y-8.1: EVERY interactive element SHALL show a `:focus-visible` outline of at least 3:1 contrast against its surroundings.
- REQ-A11Y-8.2: `outline: none` (or `0`) SHALL NOT remain in `style.css`.

#### Acceptance Criteria

1. When an interactive element receives keyboard focus, it shows an outline set by a `:focus-visible` rule in `style.css`.
2. The outline has a contrast ratio of at least 3:1 against its surroundings. `design.md` ("Contrast ratios") records its values against the page and surface backgrounds.
3. `style.css` contains no `outline: none` and no `outline: 0`.

### Requirement 9: Colour contrast (Priority 2, item 9)

**User Story:** As a user with low vision, I want text, form-field borders and focus outlines to stand out from their backgrounds, so that I can read the page and find its controls.

- REQ-A11Y-9.1: NORMAL text pairs in `:root`, risk badges and placeholder text SHALL have at least 4.5:1. UI borders that identify a form field, and the focus ring, SHALL have at least 3:1.
- REQ-A11Y-9.2: ONLY colour values SHALL change to meet this. Disabled controls are exempt from the contrast requirement by WCAG and SHALL be reported but not changed.

#### Acceptance Criteria

1. The normal text colour pairs from `:root` listed in `design.md` ("Contrast ratios"), the risk badges and the placeholder text each have a contrast ratio of at least 4.5:1.
2. Borders that identify a form field, and the focus ring, each have a contrast ratio of at least 3:1.
3. The changes that meet these ratios change colour values only.
4. Disabled controls are not changed for contrast, and their ratios are reported in `design.md` ("Contrast ratios").

### Requirement 10: Touch targets (item 10)

**User Story:** As a phone user, I want buttons and the Rescue Mode situation options to be big enough to tap, so that I do not press the wrong control.

- REQ-A11Y-10.1: AT narrow widths (max-width 640px), buttons and links styled as buttons SHALL be at least 44 CSS pixels tall and the situation checkboxes' rows SHALL be at least 44 CSS pixels tall. THE checkbox itself SHALL be enlarged. THE whole label row is the activation area.

#### Acceptance Criteria

1. When the screen is 640 CSS pixels wide or narrower, buttons and links styled as buttons are at least 44 CSS pixels tall.
2. When the screen is 640 CSS pixels wide or narrower, each Rescue Mode situation row is at least 44 CSS pixels tall, and its checkbox is enlarged (to 24 px, as recorded in `design.md`).
3. Tapping anywhere in a situation row toggles its checkbox.

### Requirement 11: Reflow (item 11)

**User Story:** As a user on a small screen or with the page zoomed in, I want the content to fit the screen width, so that I can read everything without scrolling sideways.

- REQ-A11Y-11.1: CSS SHALL allow the layout to reflow at a 320 CSS pixel width and at 200% zoom without relying on horizontal scrolling. Buttons that cannot wrap SHALL be allowed to wrap on very narrow screens. This SHALL be confirmed in a browser by the author.

#### Acceptance Criteria

1. At a viewport 320 CSS pixels wide, the layout reflows so that no horizontal scrolling is needed.
2. At 200% zoom, the layout reflows so that no horizontal scrolling is needed. **Needs author clarification:** the window width to use for this check is not stated.
3. Buttons that could not wrap before (`.rescue-nav-button`, `.rescue-primary-button` and `.rescue-call-link`) can wrap on very narrow screens. **Needs author clarification:** "very narrow" has no width in this spec or in `design.md`.
4. The author confirms criteria 1 to 3 in a browser.

### Requirement 12: Reduced motion (item 12)

**User Story:** As a user who is affected by on-screen motion, I want animations, transitions and smooth scrolling turned off when my device asks for reduced motion, so that the page is comfortable to use.

- REQ-A11Y-12.1: `style.css` SHALL keep a `prefers-reduced-motion: reduce` rule that removes animations, transitions and smooth scrolling. THE script SHALL follow the same preference (REQ-A11Y-3.4).

#### Acceptance Criteria

1. `style.css` has a `prefers-reduced-motion: reduce` rule that removes animations, transitions and smooth scrolling.
2. When the user prefers reduced motion, scrolling started by the script is not smooth, as REQ-A11Y-3.4 requires.

### Requirement 13: New-tab links (item 13)

**User Story:** As a screen-reader user, I want to be told when a link opens in a new tab, so that I am not confused when a new page appears.

- REQ-A11Y-13.1: EVERY link with `target="_blank"` SHALL keep `rel="noopener noreferrer"` and SHALL be described, for screen readers, by a visually hidden "Opens in a new tab" text (`aria-describedby` to one shared element). This includes the link that script creates in the Rescue Mode checklist.
- REQ-A11Y-13.2: THE text inside the existing Rescue Mode source links SHALL NOT change.

#### Acceptance Criteria

1. Every link with `target="_blank"` in `index.html` and `privacy.html`, including the link that script creates in the Rescue Mode checklist, has `rel="noopener noreferrer"` and `aria-describedby="newTabHint"`.
2. Each page has one visually hidden element, `newTabHint`, with the text "Opens in a new tab", shared by all of its new-tab links.
3. The text inside the existing Rescue Mode source links is unchanged.

### Requirement 14: Hard constraints

**User Story:** As the project owner, I want the accessibility changes to follow the existing security and honesty rules, so that the page's script protections and safe text handling keep working and no file overstates what was checked.

- REQ-A11Y-14.1: NO inline `style` attributes, NO inline event handlers, NO `innerHTML`, NO new script blocks. New CSS SHALL be in `public/style.css`. New script SHALL be in the existing nonce-protected inline script. All user and AI content SHALL keep using `textContent`.
- REQ-A11Y-14.2: NO new dependency and NO network call.
- REQ-A11Y-14.3: NO claim of WCAG conformance in any file. The README SHALL state what was improved and that there was no formal audit.

#### Acceptance Criteria

1. `index.html` and `privacy.html` contain no inline `style` attributes, no inline event handlers, no `innerHTML` and no `setAttribute('style'` calls, and this spec adds no new script block.
2. New CSS is only in `public/style.css`, and new script is only in the existing nonce-protected inline script.
3. All user and AI content is still inserted with `textContent`.
4. This spec adds no dependency and no network call.
5. No file claims WCAG conformance, and `README.md` states what was improved and that there was no formal audit.

### Requirement 15: Tests and documentation

**User Story:** As the project owner, I want automated checks for the accessibility changes and an honest README section, so that regressions are caught and readers know what was and was not checked.

- REQ-A11Y-15.1: `tests/a11y.test.js` SHALL read `public/index.html`, `public/privacy.html` and `public/style.css` as text, use `node:test` and `node:assert`, need no DOM library, network or API key, and be part of `npm test`. Only the `test` script line of `package.json` SHALL change.
- REQ-A11Y-15.2: No existing test SHALL be edited.
- REQ-A11Y-15.3: `README.md` SHALL gain a short "Accessibility" section (improvements and known limitations), and the test counts in `README.md` and `.kiro/steering/*.md` SHALL match `npm test`.

#### Acceptance Criteria

1. `tests/a11y.test.js` reads `public/index.html`, `public/privacy.html` and `public/style.css` as text, uses `node:test` and `node:assert`, and needs no DOM library, network access or API key.
2. `npm test` runs `tests/a11y.test.js` and passes with `GROQ_API_KEY` defined but empty (overall criterion 13).
3. The only change this spec makes to `package.json` is the `test` script line, and it edits no existing test.
4. `README.md` has a short "Accessibility" section that lists the improvements and the known limitations.
5. The test counts in `README.md` and `.kiro/steering/*.md` match the output of `npm test`.

## Overall Acceptance Criteria

These criteria cover the whole spec and keep their original numbers 1 to 13. Where another file refers to "acceptance criterion N" of this spec (for example `design.md`, "Current state"), it means this list.

1. The first focusable element of `index.html` is "Skip to main content", with `href="#mainContent"`, and `id="mainContent"` exists on `main`.
2. `index.html` has one `header`, one `nav`, one `main` and one `footer`, and the footer follows `</main>`.
3. Each view section has exactly one `h1` with `tabindex="-1"`, and heading levels in each view never skip a level.
4. `showView` sets `document.title` and focuses the view's `h1`, and no top-level `showView(` call exists.
5. Busy buttons get `aria-busy`, and the strings "Analysing, please wait", "Copied", "Saved locally", "Deleted", "Checklist updated:", "Recording started" and "Recording stopped" are announced through the live region.
6. A polite live region and several `role="alert"` elements exist. `imageError` is a `role="alert"` element.
7. Every form control has a label. `messageInput` references `characterCount`. The rescue checkboxes are in a `fieldset` with a `legend`. `rescueChecklist` is an `ol` and its panel has no `aria-live`.
8. The start button has `aria-pressed`. The timer has `aria-live="off"`. The timer update function does not call `announce`.
9. `style.css` has `:focus-visible` rules, no `outline: none`, a `prefers-reduced-motion` rule, `.visually-hidden` and `.skip-link`.
10. The colour pairs parsed from `:root` meet 4.5:1 (text) or 3:1 (control border, focus ring).
11. No inline `style` attribute, no `on*` handler, no `innerHTML`, and no `setAttribute('style'` anywhere in `index.html` or `privacy.html`.
12. Every `target="_blank"` link has `rel="noopener noreferrer"` and `aria-describedby="newTabHint"`, and `newTabHint` is a visually hidden element containing "Opens in a new tab".
13. `npm test` passes with `GROQ_API_KEY` defined but empty.

## Known limitations (must stay documented)

- No formal accessibility audit has been done and no WCAG conformance is claimed.
- The changes have not been tested with every screen reader, browser or assistive technology. Behaviour of live regions, `aria-describedby` and focus moves differs between screen readers.
- Reflow, focus rings, the skip link, touch-target sizes and the fieldset layout are checked by reading the CSS and by tests on the text of the files. They need checking in a real browser.
- The 24 px checkbox is smaller than 44 px. The whole labelled row is the 44 px activation area.
- Disabled controls keep their reduced-opacity look, which is below 4.5:1. WCAG exempts disabled controls.
- "Opens in a new tab" is attached with `aria-describedby`, which some screen readers do not read in browse mode.

## Out of scope

- Right-to-left or Hindi interface text, high-contrast or dark themes, captions or transcripts for audio, accessibility of the PDF output of the print view, and any change to wording of safety advice.

## Glossary

| Term | Definition |
|---|---|
| `aria-busy` | Marks an element as busy while work is in progress. Here it is set on a button while that button is working. |
| `aria-current` | Marks the item that stands for the current page or view. Here `aria-current="page"` is on the active navigation button. |
| `aria-describedby` | Points from an element to one or more other elements whose text screen readers read as its description. |
| `aria-invalid` | Tells assistive technology that a field's value has an error. Here `aria-invalid="true"` is set only while the error is visible. |
| `aria-pressed` | Says whether a toggle button is on (`true`) or off (`false`). |
| Author | The project owner. Checks that need a real browser or a screen reader are the author's to do. |
| Browse mode | A screen-reader mode for reading page content with the arrow keys, as opposed to typing into form controls. |
| Contrast ratio | How much two colours differ in relative luminance, from 1:1 (none) to 21:1, computed with the WCAG formula. This spec uses 4.5:1 for normal text and 3:1 for form-field borders and the focus ring. |
| Disabled control | A control with the `disabled` attribute. WCAG's contrast minimum does not apply to inactive controls, so their colours are reported but not changed. |
| `fieldset` and `legend` | An HTML element that groups related form controls, and its caption. Screen readers read the legend when focus enters the group. |
| Focus ring (`:focus-visible`) | The outline drawn around the element that has keyboard focus. In `style.css` it comes from `:focus-visible` rules, which match when the browser shows focus, normally after keyboard use rather than a mouse click. |
| Landmark | A page region that screen readers list so users can jump to it. Here: `header`, `nav`, `main` and `footer`. |
| Live region (`aria-live`) | An element whose text changes screen readers read out without moving focus. `aria-live="polite"` waits until the screen reader has finished speaking; `aria-live="off"` does not announce changes. |
| Nonce-protected inline script | The inline `<script>` block in `index.html` that carries the per-request nonce required by the page's Content Security Policy. New script goes only there. |
| Priority 1, Priority 2 (item N) | The two groups and the item numbers of the original accessibility request. Priority 1 is items 1 to 8 and Priority 2 is items 9 to 13. `tasks.md` does Priority 1 first. |
| Reduced motion | A device or browser setting that asks pages to limit movement. CSS reads it with the `prefers-reduced-motion` media feature. |
| Reflow | The layout fitting a narrow screen or a zoomed page without horizontal scrolling. |
| Rescue Mode | The AI-free checklist view for people who have already been scammed. Its steps come from `public/rescue.js`. |
| `role="alert"` | Marks an element whose text screen readers announce straight away. Used for error messages. |
| `role="timer"` | Marks an element that shows a running time. With `aria-live="off"`, its changes are not read out. |
| Skip link | A link placed first on the page that moves keyboard focus to the main content. It stays visually hidden until it has focus. |
| `tabindex="-1"` | Lets script move focus to an element that the Tab key does not reach, such as `main` or a heading. |
| `textContent` | The DOM property that sets an element's text without reading it as HTML. Unlike `innerHTML`, it cannot add markup. |
| Touch target | The area of a control that can be tapped to use it. |
| View (`showView`) | One of the nine page sections in `index.html` (home, text, screenshot, voice, link, results, Rescue Mode, history and guide). `showView` shows one view and hides the others. |
| Visually hidden | Not shown on screen but still read by screen readers. The `.visually-hidden` class in `style.css` does this. |
| WCAG | The Web Content Accessibility Guidelines from the W3C. This spec uses its contrast formula and thresholds as targets. It does not claim WCAG conformance. |
