# Design Document

## Overview

This spec makes the existing single-page app easier to use with a keyboard and a screen reader, without changing behaviour, features, safety wording or API behaviour. It covers 13 items: skip link, landmarks and headings, focus on view changes, busy and error states, form labels, live announcements, the voice tool and focus visibility (Priority 1), then colour contrast, touch targets, reflow, reduced motion and new-tab links (Priority 2). Changes are limited to `public/index.html` (markup and its one nonce-protected inline script), `public/style.css` and the structure of `public/privacy.html`, and are checked by `tests/a11y.test.js`. The work makes no claim of WCAG conformance and has not had a formal audit. The audit table below records the state before the change, and "Overview of the change" summarises the result.

## Architecture

```
Browser
 ├─ public/index.html
 │    markup: skip link → main#mainContent, #liveAnnouncer, #newTabHint,
 │            header / nav / main / footer, fieldset + legend, role="alert" errors
 │    nonce-protected inline script:
 │            showView → focusViewHeading (focus h1, document.title)
 │            startBusy / endBusy (aria-busy) → announce
 │            showFieldError / clearFieldError (aria-describedby, aria-invalid)
 │            announce → #liveAnnouncer (polite live region)
 ├─ public/style.css     :root colours, :focus-visible, .visually-hidden, .skip-link,
 │                        44 px targets below 640 px, reduced motion
 └─ public/privacy.html  skip link, header / main / footer, new-tab hint
tests/a11y.test.js       reads the three files as text (no browser, no DOM library)
```

A user action runs an existing handler. The handler calls the helpers above, which change attributes (`aria-busy`, `aria-invalid`, `aria-describedby`, `aria-current`, `aria-pressed`), move focus, or set the text of `#liveAnnouncer`, which screen readers read out. No server code, API or Rescue Mode logic changes: `server.js` and `public/rescue.js` are not edited.

## Components and Interfaces

Script functions in the nonce-protected inline script of `public/index.html`:

| Function | Role |
|---|---|
| `scrollBehavior()` | Returns `'auto'` when `prefers-reduced-motion: reduce` matches, otherwise `'smooth'`. |
| `announce(message)` | Clears `#liveAnnouncer`, then sets `message` after 60 ms so a repeated message is spoken again. |
| `setAriaCurrent(element, isCurrent)` | Adds or removes `aria-current="page"`. |
| `focusViewHeading(viewId)` | Sets `document.title` from the view's `h1` (the original title for home) and focuses that `h1` with `preventScroll`. |
| `startBusy(button, label)`, `endBusy(button, label)` | Set or remove `disabled` and `aria-busy` and the button label. `startBusy` announces "Analysing, please wait". |
| `addDescribedBy(field, id)`, `removeDescribedBy(field, id)` | Add or remove one id in a field's `aria-describedby`. |
| `showFieldError(errorId, fieldId, message)`, `clearFieldError(errorId)` | Show or hide a `role="alert"` error, and link or unlink it from its field with `aria-describedby` and `aria-invalid`. |
| `showView(viewId)` | Existing function. Now also sets `aria-current`, uses `scrollBehavior()` and calls `focusViewHeading`. |
| `renderRescueChecklist()` | Existing function. Now returns the number of steps, used for "Checklist updated: N steps". |
| `setIncidentStatus(text, spoken = text)` | Sets the incident-summary status line and announces it once. |

Elements: `#liveAnnouncer` (`div`, `role="status"`, `aria-live="polite"`, `aria-atomic="true"`, visually hidden), `#newTabHint` (`span`, visually hidden, "Opens in a new tab"), `main#mainContent` (`tabindex="-1"`), `p#imageError` (`role="alert"`), the `fieldset` around the Rescue Mode situations with a visually hidden `legend`, `#recordTimer` (`role="timer"`, `aria-live="off"`) and `#startRecordingBtn` (`aria-pressed`). CSS: the `:root` variables `--muted`, `--control-border` and `--focus-ring`, and the classes `.visually-hidden` and `.skip-link`.

## Data Models

This spec adds no persistent data, no API fields and no data models. The only new state is in the page script: `errorFields`, an object that maps an error element id to the id of the field it is linked to, and `announceTimer`, the pending timer of `announce`. The new colour values in `:root` are listed under "Contrast ratios". Local history (`scamLensHistoryV3`) is unchanged.

## Error Handling

This spec adds no new failure modes and does not change the text of any error message. It changes how existing errors are exposed. Errors in the text, link, screenshot and voice tools are shown with `showFieldError` in a `role="alert"` element, linked to their field while visible, and emptied and unlinked by `clearFieldError`. Screenshot errors move from `#imageStatus` to the new `#imageError`. Microphone errors use `#audioError` (`role="alert"`). A blocked clipboard keeps its existing visible message, and that message is also announced.

## Correctness Properties

These properties are checked statically by `tests/a11y.test.js`, which reads `index.html`, `privacy.html` and `style.css` as text. They show that the markup, script and styles contain the features. They do not show how a browser or screen reader behaves.

Property 1: For both pages, the first focusable element is the skip link, and its target `#mainContent` exists on `main` with `tabindex="-1"` ("skip link is the first focusable element and targets an existing id").
**Validates: Requirements 1.1, 1.3**

Property 2: `index.html` has exactly one `header`, `nav`, `main` and `footer`, and the footer comes after `</main>` ("index.html has one header, one nav, one main and one footer, with the footer outside main").
**Validates: Requirements 2.1**

Property 3: `privacy.html` has exactly one `header`, `main` and `footer`, with the footer outside `main`, and one `h1` ("privacy.html has one header, one main and one footer, with the footer outside main").
**Validates: Requirements 2.4**

Property 4: Every view has exactly one `h1`, and it has `tabindex="-1"` ("every view has exactly one h1, and it can receive focus from script").
**Validates: Requirements 2.2**

Property 5: Heading levels never skip a level inside a view, and history cards created by script are `h2` ("heading levels never skip a level inside a view"; "headings that script creates keep the heading order").
**Validates: Requirements 2.3**

Property 6: `showView` calls `focusViewHeading`, which sets `document.title` and focuses the `h1`, and the script has no top-level `showView(` or focus call ("opening a view moves focus to its h1 and updates the page title, but not on load").
**Validates: Requirements 3.1, 3.2**

Property 7: The active navigation button gets `aria-current` ("the active navigation button exposes aria-current").
**Validates: Requirements 3.3**

Property 8: The seven working buttons use `startBusy` and `endBusy`, which set and remove `aria-busy` and announce "Analysing, please wait" ("busy buttons use aria-busy and announce once").
**Validates: Requirements 4.1**

Property 9: Errors are linked to their field only while visible, and hidden errors are emptied ("errors are linked to their field only while they are visible").
**Validates: Requirements 4.4**

Property 10: Every form control has a label, the character counter is linked to the message field, and the situation checkboxes are in a `fieldset` with a `legend` (three tests).
**Validates: Requirements 5.1, 5.2, 5.3**

Property 11: A polite, visually hidden live region exists, and the four error elements are `role="alert"` ("a polite live region and role="alert" regions exist").
**Validates: Requirements 6.1, 4.3**

Property 12: The checklist is an `ol`, its panel is not a live region, and copy, save, delete, recording and checklist changes are announced (two tests).
**Validates: Requirements 6.2, 6.3, 7.2**

Property 13: The start button has `aria-pressed`, the timer has `role="timer"` and `aria-live="off"`, and the timer update never calls `announce` ("voice tool exposes its state and never announces the running timer").
**Validates: Requirements 7.1, 7.3**

Property 14: Neither page has inline `style` attributes or inline event handlers, the script has no `innerHTML`, and there is one inline script with the nonce ("no inline style attributes, inline event handlers or HTML injection").
**Validates: Requirements 14.1**

Property 15: `style.css` has a `:focus-visible` rule using `--focus-ring` and no `outline: none` ("styles have a visible :focus-visible rule and no outline: none").
**Validates: Requirements 8.2**

Property 16: `style.css` has a reduced-motion rule, and the script never forces smooth scrolling ("styles honour prefers-reduced-motion, and script does not force smooth scrolling").
**Validates: Requirements 12.1, 3.4**

Property 17: Every `target="_blank"` link keeps `rel="noopener noreferrer"` and has `aria-describedby="newTabHint"`, and the Rescue Mode source link text is unchanged (two tests).
**Validates: Requirements 13.1, 13.2**

Property 18: The colour pairs parsed from `:root`, the placeholder text and the idle record indicator meet 4.5:1 for text and 3:1 for borders and the focus ring (two tests).
**Validates: Requirements 9.1**

Property 19: The rules below 640 px give buttons and the situation rows `min-height: 44px` and a 24 px checkbox ("narrow-screen rules give buttons and the situation checkboxes a 44px target").
**Validates: Requirements 10.1**

Property 20: The README has an Accessibility section that says there was no formal audit and claims no conformance ("README describes the accessibility work without claiming conformance").
**Validates: Requirements 14.3, 15.3**

Manual and unverified: whether announcements are actually spoken, whether focus moves and is visible in a real browser, the rendered size of touch targets, reflow at narrow widths and 200% zoom, and screen-reader behaviour. None of these is checked by `npm test`.

## Testing Strategy

Automated: `tests/a11y.test.js` has 27 tests. It reads `public/index.html`, `public/privacy.html` and `public/style.css` as text, needs no DOM library, network or API key, and runs as part of `npm test`. The latest run gives 155 tests in total: `tests/server.test.js` 98, `tests/rescue.test.js` 17, `tests/a11y.test.js` 27, `tests/properties.test.js` 5, `tests/secrets.test.js` 8.

Manual (by the author, not yet done): keyboard-only use of every view, including the skip link and the visible focus ring; announcements and reading order with NVDA, VoiceOver and TalkBack; focus moves after each view change and after results; the voice tool announcements; layout at 320 px width and at 200% zoom; touch-target sizes on a phone; and print output.

**Needs author clarification:** the request for this section mentioned a 360 px check, but this spec states 320 px throughout (REQ-A11Y-11.1). This section keeps 320 px.

The existing "Testing" and "Manual verification list" sections below give the same detail in their original wording.

## Audit table

This table records what the code did **before** this change. Elements and selectors are cited, not line numbers. "Gap" says what the change fixes. Nothing here is a claim of conformance.

### Priority 1

| # | Item | What the current code does | Gap |
|---|---|---|---|
| 1 | Skip link | There is none. The first focusable element in `body` is `button.brand#homeBrand`. | Missing. |
| 2a | Landmarks | `header.site-header` appears once. `nav.main-nav[aria-label="Main navigation"]` is the header nav. `main.app-shell` appears once. `footer.site-footer` is a child of `main.app-shell`, so it is not the page footer landmark. A second `nav.footer-links[aria-label="Footer navigation"]` exists inside that footer. | The footer is not a landmark. Two `nav` elements. |
| 2b | One `h1` per view | `#homeView`, `#textView`, `#imageView`, `#voiceView`, `#linkView`, `#resultsView`, `#rescueView`, `#historyView` and `#guideView` each contain one `h1`. `privacy.html` has one `h1`. | None. The `h1` elements have no `tabindex`. |
| 2c | Heading levels | `renderHistory()` creates `article.history-card > h3` directly under the history `h1` (skips `h2`). In `#resultsView`, `renderEvidenceCards()` and `renderSequence()` create `h3` under `h2` (fine). `#linkResults` has `h2` then `h3` (fine). | History cards skip a level. |
| 3 | View changes | `showView(viewId)` toggles `hidden`, toggles `.active` on `[data-nav]` buttons, and calls `window.scrollTo({ behavior: 'smooth' })`. It does not move focus or change `document.title`. `showView` is not called at load. | No focus move, fixed title, no `aria-current`, smooth scroll ignores reduced motion. |
| 4a | Busy state | `#analyzeTextBtn`, `#extractImageBtn`, `#analyzeImageTextBtn`, `#transcribeRecordingBtn`, `#transcribeFileBtn`, `#analyzeTranscriptBtn`, `#checkLinkBtn` set `disabled = true` and change their text. There is no `aria-busy` and no announcement. | Missing. |
| 4b | Results focus | `analyzeMessage()` calls `showView('resultsView')`. `#linkResults` is un-hidden in place. `#extractedImageArea` and `#transcriptArea` are un-hidden. None of these move focus. | Missing. |
| 4c | Errors | `#textError`, `#linkError` and `#audioError` are `p.error-message[role="alert"]`. Screenshot errors are written to `#imageStatus`, which is `role="status"` (polite), not an alert. No field is linked to its error. | Image errors are not alerts. No `aria-describedby`. |
| 5a | Labels | Every `input`, `textarea` and `select` has a `label[for]` or sits inside a wrapping `label` (`label.rescue-option` for the checkboxes). | None found. |
| 5b | Counter | `#characterCount` is a plain `span`. `#messageInput` has no `aria-describedby`. | Not linked. |
| 5c | Checkbox group | `#rescueScenarioOptions` is a `div.rescue-scenario-grid`. There is no `fieldset` or `legend`. | Missing. |
| 6a | Live announcements | `#incidentSummaryStatus` is `role="status"` (create, copy and error messages are spoken). `#reportStatus` is a plain `p.status-message` (copy, save and failure messages are not spoken). Deleting a history item or all items shows nothing. | Copy report, save and delete are silent. |
| 6b | Checklist | `section.rescue-checklist-panel[aria-live="polite"]` wraps the list, so the whole list is read again whenever it is re-rendered. `ol#rescueChecklist` is already an ordered list. | Noisy live region, no "N steps" summary. |
| 7 | Voice tool | `#startRecordingBtn` and `#stopRecordingBtn` swap `disabled`. There is no `aria-pressed`. `#recordStatus` is plain text. `#recordTimer` is a plain `div` (no live attributes, so not announced). `#audioError` is `role="alert"`. When the focused start button disables itself, focus is lost. `#recordDot` is not hidden from assistive technology. | No state, no start/stop announcement, focus lost. |
| 8 | Focus visibility | `input:not([type="file"]), textarea, select` set `outline: none` and replace it with a 2px `box-shadow` at 15% opacity on `:focus`. `button:focus-visible, a:focus-visible` use `rgb(88 114 96 / 30%)`. `.tool-card:focus-visible` uses 25%. Computed contrast of these rings against the page is about 1.4:1 to 1.5:1. | Rings are too faint. `outline: none` is present. |

### Priority 2

| # | Item | What the current code does | Gap |
|---|---|---|---|
| 9 | Colour contrast | See "Contrast ratios" below. `--muted` (`#68736a`) is 4.34:1 on the page background and 4.19:1 on `--accent-soft`. `input::placeholder` (`#818b81`) is 3.22:1. The field border (`#d1d9d0`) is 1.31:1. The idle `#recordDot` is 2.27:1. | Several pairs below 4.5:1 or 3:1. |
| 10 | Touch targets | `.text-button` has `min-height: 34px`. `.nav-button` is about 35px. `.rescue-nav-button` is 35px at max-width 640px. `.back-button` is about 31px. The rescue checkbox is 18 by 18px inside `label.rescue-option`. | Below 44px on narrow screens. |
| 11 | Reflow | `body` has `overflow-x: hidden`, which hides overflow instead of preventing it. `.rescue-primary-button`, `.rescue-call-link` and `.rescue-nav-button` have `white-space: nowrap`. Most layouts use `flex-wrap`, `minmax(0, 1fr)` and `overflow-wrap: anywhere`. | Possible clipping on very narrow screens. Needs a browser check. |
| 12 | Reduced motion | Two `@media (prefers-reduced-motion: reduce)` blocks already shorten animations, transitions and smooth scrolling in CSS. `showView()` and `transcribeAudio()` pass `behavior: 'smooth'` in script, which CSS cannot override. | Script ignores the preference. |
| 13 | New-tab links | Seven static `a[target="_blank"]` links in `index.html` (rescue "Report online", four official sources, the guide link, the footer credit), three in `privacy.html`, and one that `renderRescueChecklist()` creates. All have `rel="noopener noreferrer"`. None says it opens a new tab. | No hint. |

## Contrast ratios

Computed with the WCAG relative-luminance formula (script run during design, not part of the app). "Before" is the value in the code before this change.

| Pair | Before | After | Threshold |
|---|---|---|---|
| `--text` on `--page-bg`, `--surface`, `--surface-muted` | 10.56, 11.56, 10.94 | unchanged | 4.5 |
| `--muted` on `--page-bg` | 4.34 (fail) | 4.96 | 4.5 |
| `--muted` on `--surface-muted` | 4.50 (fail by rounding) | 5.14 | 4.5 |
| `--muted` on `--accent-soft` | 4.19 (fail) | 4.79 | 4.5 |
| `--muted` on `--surface` | 4.76 | 5.43 | 4.5 |
| `--muted` on rescue checked row `#fbf1ee` | not checked | 5.08 | 4.5 |
| `--accent-hover` on page, surface, accent-soft | 5.71, 6.25, 5.51 | unchanged | 4.5 |
| white on `--accent` (primary button) | 5.26 | unchanged | 4.5 |
| risk badges: danger / warning / safe text on background | 5.48, 4.99, 5.62 | unchanged | 4.5 |
| placeholder text on `--surface-muted` | 3.22 (fail) | 4.67 (`#66706a`) | 4.5 |
| dead footer rule `#758075` on page (a later rule overrides it) | 3.62 | 4.96 (`#5f6a61`) | 4.5 |
| field border on `--surface-muted` | 1.31 (fail) | 3.27 (`--control-border` `#7f8a80`) | 3 |
| field border on `--surface` | 1.32 (fail) | 3.45 | 3 |
| old focus rings (30% and 25% accent) | 1.46 and 1.39 (fail) | `--focus-ring` `#1d4e89`: 7.37 on page, 8.07 on surface | 3 |
| idle `#recordDot` on `--surface-muted` | 2.27 (fail) | 3.95 (`#6f7d70`) | 3 |
| white on rescue button `#a9574d` | 5.05 | unchanged | 4.5 |
| disabled secondary text (opacity 0.65) | about 4.1 | unchanged | exempt |
| disabled primary button, white on accent at 0.65 | 2.66 | unchanged | exempt |

Disabled controls are inactive user-interface components and are exempt from the contrast rule. They are reported here and not changed. Card borders (`--border`) are decorative, because each card is identified by its content, so they are not changed. Form-field borders identify the field and are changed.

## Overview of the change

```
index.html
  skip link  ->  #mainContent (main, tabindex -1)
  #liveAnnouncer (polite, visually hidden) + #newTabHint (visually hidden)
  div.app-shell
    main#mainContent        views, privacy reminder
    footer.site-footer      (moved out of main; footer links are no longer a second nav)
  script: announce(), busy helpers, field-error helpers, showView focus/title
style.css
  :root  --muted, --control-border, --focus-ring
  :focus-visible rules, .visually-hidden, .skip-link, fieldset reset,
  44px targets (max-width 640px), reflow, history h2
tests/a11y.test.js   (text checks on the two HTML files and the CSS)
```

`main.app-shell` becomes `div.app-shell` wrapping `main#mainContent` and `footer`. All layout rules use the class `.app-shell`, and no CSS selects `main` or `footer` by element name, so the layout is unchanged.

## Script design (inside the existing nonce-protected script)

- `announce(message)` clears `#liveAnnouncer`, then sets the text after 60 ms so that repeated messages are spoken again.
- `startBusy(button, label)` and `endBusy(button, label)` set and remove `aria-busy`, set `disabled` and the label, and announce "Analysing, please wait" once. They do not refocus the button after an error, so an alert is not interrupted.
- `showFieldError(errorId, fieldId, message)` and `clearFieldError(errorId)` show or hide a `role="alert"` element and add or remove `aria-describedby` and `aria-invalid` on the field. A map remembers which field an error was attached to. The text is cleared on hide, so a hidden error is never read.
- `showView(viewId)` also sets `aria-current` on the active `.nav-button`, sets `document.title`, focuses the view's `h1` with `preventScroll`, and uses `behavior: 'auto'` when reduced motion is preferred.
- `renderRescueChecklist()` returns the number of steps. The checkbox change handler announces "Checklist updated: N steps" (singular "1 step"). Opening Rescue Mode does not announce it.
- `#incidentSummaryStatus` loses `role="status"`. A helper sets its text and announces the same text through `#liveAnnouncer`, so each message is spoken once. Copy success is announced as "Copied" while the visible text stays "Incident summary copied."
- Recording: `aria-pressed` on `#startRecordingBtn`, "Recording started" and "Recording stopped" announced once, focus moved to the stop button on start and to the transcribe button on stop (only when the focused button was just disabled). `updateRecordingTimer()` never calls `announce`.
- The new-tab link created in `renderRescueChecklist()` gets `aria-describedby="newTabHint"`.

## Decisions

- **Footer links.** The footer's `nav.footer-links` becomes `div.footer-links`, because the requirement is one `nav` landmark. The header navigation is the one `nav`.
- **New-tab hint through `aria-describedby`.** `tests/rescue.test.js` matches the four official-source links as `<a href="URL" ...> LABEL </a>`, so the hidden text cannot go inside those anchors without editing that test, which is not allowed. One shared visually hidden element and `aria-describedby` on every `target="_blank"` link keeps the markup uniform. Some screen readers do not read descriptions in browse mode (see limitations).
- **Image errors.** A new `p#imageError.error-message[role="alert"]` carries screenshot errors. `#imageStatus` stays `role="status"` for "Text extracted. Review it before analysis."
- **Announcements are not duplicated.** Elements that announce through `#liveAnnouncer` are not themselves live regions.
- **Checklist panel.** `aria-live="polite"` is removed from `section.rescue-checklist-panel`. The "Checklist updated: N steps" message replaces re-reading the whole list.
- **Checkbox size.** The checkbox grows to 24 px and its labelled row is at least 44 px tall at narrow widths. The row is the activation area. This is recorded as a deliberate interpretation, not a 44 by 44 px checkbox.
- **Contrast fixes change values only.** `--muted`, the placeholder colour, the idle record dot, a dead footer colour, and two new variables, `--control-border` and `--focus-ring`.
- **No `outline: none`.** The field rule drops `outline: none`, so the browser outline is no longer suppressed, and a strong `:focus-visible` outline is added.
- **`privacy.html`.** Only structure changes: a skip link, `div.app-shell` containing `header`, `main#mainContent` and `footer`, and `aria-describedby` on the new-tab links. No privacy text changes.

## Files changed

| File | Change |
|---|---|
| `public/index.html` | Markup and script described above |
| `public/privacy.html` | Skip link, landmark structure, new-tab description |
| `public/style.css` | Colour values, focus rules, helper classes, narrow-screen rules |
| `tests/a11y.test.js` | New |
| `package.json` | `test` script line only |
| `README.md`, `.kiro/steering/structure.md`, `.kiro/steering/tech-stack.md` | Accessibility section and test counts |
| `.kiro/specs/accessibility/*` | This spec |

## Testing

`tests/a11y.test.js` reads `public/index.html`, `public/privacy.html` and `public/style.css` as text. It checks `lang`, the skip link and its target, landmark counts, headings per view, form-control labels, the counter link, the fieldset, the live region and alerts, the checklist `ol`, the voice-tool attributes, the announcement strings, the absence of inline `style`, `on*` handlers, `innerHTML` and `outline: none`, the `:focus-visible` and reduced-motion rules, the new-tab description, and a deterministic contrast check of colour pairs parsed from `:root`.

## Current state (recorded 2026-11-25)

This section records how the saved files differ from the design above. It changes no design decision, and the page has not been edited to match.

| Item | Design says | Saved files show | Effect |
|---|---|---|---|
| Page footer in `public/index.html` | `footer.site-footer` after `</main>`, inside `div.app-shell`, holding the credit line, the privacy link and the description | No `<footer>` element. `</main>` is followed directly by `</div>`. The privacy reminder (`aside.privacy-banner`) is still the last item in `main`. | REQ-A11Y-2.1 and acceptance criterion 2 are not met. One test fails: "index.html has one header, one nav, one main and one footer, with the footer outside main". The credit line, the "Privacy & Data Use" footer link and the footer description are not on the page. The privacy link inside `aside.privacy-banner` remains. |
| When it changed | — | The footer was removed outside the accessibility task, after a run where all 129 tests passed. `public/index.html` was last written on 2026-11-22 at 13:18:10. | Task 11 (Verify) stays in progress. |
| Later change to `public/index.html` | — | The file was written again on 2026-11-25 at 21:52:43, during the hardening-and-evidence session, but not by that task's edits. No backup exists, so the change cannot be identified. These counts match the design: skip link 1, `#liveAnnouncer` present, 11 `tabindex="-1"`, 6 `aria-describedby="newTabHint"`, 1 `fieldset`, 0 `innerHTML`, 0 inline `style` attributes, 0 `on*` handlers. | The other 26 accessibility tests pass. Whether anything else changed is unknown. |
| `public/privacy.html`, `public/style.css`, `tests/a11y.test.js` | As designed | Unchanged since 2026-11-22 (last written 13:13:52, 13:07:35 and 13:16:07). | None. |

**Open decision for the author:** restore the footer as designed, or record a decision to drop it. If it is dropped, REQ-A11Y-2.1, acceptance criterion 2 and the landmark test must change together. That is a spec change and needs your approval. The footer content must come from you. It is not recreated here.
## Manual verification list (cannot be tested here)

Skip link and focus rings in each browser, reading order and announcements with NVDA, VoiceOver and TalkBack, focus moves after each view change and after results, the voice tool announcements, the fieldset layout, 320 px and 200% zoom reflow, touch-target sizes on a phone, and print output.
