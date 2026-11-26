---
inclusion: always
---

# Scam Lens — Security and Privacy Rules

These rules apply to every change. They summarise what the code already does and must keep doing.

## Secrets

- Secrets live only in environment variables (`GROQ_API_KEY` in the local `.env`, or the host's settings). Never write a key into code, tests, docs, specs, hooks or chat.
- `.env` must stay in `.gitignore`. `.env.example` holds placeholders only.
- Never log, print or return a key. `/api/health` returns booleans only.
- Run `npm run check:secrets` (`scripts/check-secrets.js`) before committing. It reports file and line, never the value. Tests build fake key-like strings at run time; do not store one as a literal.

## Submitted content and logging

- Never log submitted messages, screenshots, audio, transcripts, URLs or AI output. Server logs record error codes, HTTP status and provider error details only.
- Error responses to the user are plain messages. They never contain provider details, stack traces, keys or submitted content.
- There is no server-side storage of submissions: no database and no files. Saved reports live only in the browser's `localStorage` (`scamLensHistoryV3`). Rescue Mode incident summaries never leave the browser.

## Browser safety

- Insert user and AI content with `textContent` (or text nodes), never `innerHTML`, `outerHTML`, `insertAdjacentHTML` or `document.write`.
- Keep the Content Security Policy: per-request nonce on the inline script and `/rescue.js`, `style-src 'self'`, no inline `style` attributes, no inline event handlers, no third-party scripts or CDNs.
- Uploads are checked by magic bytes, not only by MIME type or extension.
- The user's text is placed between `<MESSAGE>` tags in the prompt. Tags inside the text are neutralised first (`neutraliseDelimiters`). Evidence quotes are checked against the original text.
- Links that open a new tab keep `rel="noopener noreferrer"`.

## Truthful claims

- `public/privacy.html` must match the real processing flow. Update it in the same change whenever what is sent, stored or logged changes.
- Never claim detection accuracy, "verified safe", a safety guarantee or WCAG conformance. Results are decision support, not proof. Link inspection is structural only, and voice analysis is transcription only.
- Do not claim that a hook ran unless it was seen running.
