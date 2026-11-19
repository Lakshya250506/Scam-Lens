# Scam Lens detection benchmark

## Dataset

- `dev.json`: 40 synthetic, labelled examples for prompt/rule development.
- `holdout.private.json`: 80 synthetic, labelled examples for one final evaluation after tuning is frozen. Do not commit or publish this file before the final run is complete.
- The 80-example holdout has 40 Safe and 40 scam examples (20 Suspicious and 20 Highly Dangerous), with English, Hindi and Hinglish represented.

These are synthetic examples, not a representative sample of all real scam messages. Performance on this dataset must not be described as real-world accuracy.

## Labels

- **Safe**: the message contains no meaningful scam/manipulation indicator in the provided text. This does not authenticate the sender.
- **Suspicious**: one or more concerns exist, but the message alone does not establish a clear harmful demand or coercive scam.
- **Highly Dangerous**: explicit credential/PIN/OTP theft, coercive money demand, threat-backed payment, or harmful remote-access/app instruction is present.

Gold evidence anchors are short exact spans from non-Safe examples. The evidence metric checks whether the validated analysis returns at least one anchor in its evidence quotations. It is a coarse coverage measure, not a complete semantic evidence-quality score.

## Run

From the project root, after installing dependencies and configuring `.env`:

```bash
npm run benchmark -- --split dev
```

Tune prompts or deterministic rules using only the development set. When tuning is frozen, run the held-out set once:

```bash
npm run benchmark -- --split test --confirm-holdout
```

Optional flags:

```bash
npm run benchmark -- --split dev --limit 5
npm run benchmark -- --split dev --delay-ms 2000
```

The runner calls the same internal `analyzeText` function used by `/api/analyze`, including `validateAnalysis`. It does not start an HTTP server and does not bypass the Groq provider's own usage limits. It saves progress and a final JSON report in `benchmark/results/`.

## Metrics

- Exact risk-level accuracy and within-one-level accuracy.
- Scam recall, precision and false-safe rate (a scam predicted Safe).
- False-alarm rate and Safe specificity.
- Risk confusion matrix.
- Per-language exact accuracy and false-safe rate.
- Coarse evidence-anchor coverage.

Review every false-safe example before making changes. Keep model name, prompt version, dataset version and date with any public results. Report counts alongside percentages. Do not repeatedly tune against the held-out set.

## Limitations

This benchmark does not measure screenshot OCR, audio transcription, URL inspection, real-world prevalence, unseen scam adaptation, or whether a report leads to money recovery. It also does not establish a statistically representative accuracy estimate. Manually review the labels and examples before treating a score as meaningful.
