---
inclusion: always
---

# Scam Lens — Product

## What it is

Scam Lens is an AI-assisted scam and phishing awareness checker for Indian users. It helps people spot possible social-engineering tactics in messages, screenshots, audio, and URLs, and gives actionable safety guidance.

## Target problem

India has a high and growing rate of digital fraud: digital arrest scams, UPI/banking fraud, OTP theft, phishing, fake job offers, and investment scams. Most victims have no fast, accessible way to sanity-check a suspicious message before acting. Scam Lens provides that check.

## Intended users

The Indian general public, especially people with moderate digital literacy who want a second opinion before acting. The app must be usable without cybersecurity knowledge.

- Write user-facing copy in plain, short, non-technical language.
- Keep guidance India-specific (e.g. UPI, 1930 cyber helpline, cybercrime.gov.in, bank/NPCI channels). Do not suggest non-Indian resources.
- Text input may be English, Hindi, or Hinglish. Do not assume English-only input.

## Core features

1. **Text analysis**: LLM classification into Safe / Suspicious / Highly Dangerous, with evidence phrase extraction and a manipulation-sequence explanation.
2. **Screenshot OCR**: A vision model extracts text from screenshots. The user reviews the text before analysis.
3. **Voice analysis**: Whisper transcribes audio (English, Hindi, Hinglish). The user reviews the transcript before analysis.
4. **Link inspection**: Deterministic structural URL analysis. No live network requests.
5. **Local history**: Browser localStorage only. No server-side storage.
6. **Rescue Mode**: Deterministic, AI-free checklist of immediate actions for people who have already been scammed, prioritised by urgency.

## Product rules

- Keep the three-level verdict scale (Safe / Suspicious / Highly Dangerous). Do not add, rename, or reorder levels without being asked.
- OCR and voice flows must keep the human review step between extraction and analysis. Do not auto-submit extracted text.
- Link inspection and Rescue Mode must stay deterministic. Do not add AI calls, network lookups, or randomness to them.
- Do not word "Safe" as a guarantee. Use hedged phrasing such as "no clear scam signs found".
- Only the four AI-backed routes (text, OCR, voice, and their supporting analysis) may call the AI provider.
- Do not add features that collect accounts, analytics, tracking, or third-party scripts without being asked.

## Privacy principles

- Submitted content is processed but not persisted on the server. Do not add server-side storage, or logging of submitted content, AI output, or secrets.
- History lives only in the user's browser.
- The app never requests OTPs, PINs, or passwords, including in UI copy, placeholders, and examples.
- Rescue Mode incident summaries stay in the browser and are never sent to the server.

## Limitations (never overstate these)

- Classification is probabilistic, not deterministic.
- Link inspection is structural only. There is no live reputation check.
- Voice analysis transcribes speech. It does not detect voice cloning or verify caller identity.
- Results are decision support, not proof of fraud or authenticity.
- Benchmark examples are synthetic. Accuracy on synthetic data does not guarantee real-world performance.

Apply these limits to UI text, README or docs, code comments, and test or benchmark descriptions. Do not write claims like "detects all scams", "100% accurate", or "verified safe".
