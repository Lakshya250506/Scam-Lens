---
inclusion: always
---

# Scam Lens — Project Structure

```
scam-lens/
├── server.js                  Main Express application and all API routes
│                              Also exports pure functions when NODE_ENV=test
├── package.json               npm scripts: start, test, benchmark
├── .env                       Local secrets — NEVER commit this file
├── .env.example               Template for environment variables — commit this
├── .gitignore                 Excludes .env, node_modules/, benchmark results
├── LICENSE                    MIT licence
├── README.md                  Public documentation
├── README.txt                 Internal developer handoff note — gitignored, kept locally only
│
├── public/                    Static files served by Express
│   ├── index.html             Single-page application shell (1800 lines)
│   │                          Contains all tool UIs, Rescue Mode UI, History
│   │                          Inline <script> protected by CSP nonce
│   ├── rescue.js              Rescue Mode logic — UMD module, no AI calls
│   │                          Used by both browser (window.ScamLensRescue)
│   │                          and Node tests (require('../public/rescue.js'))
│   ├── style.css              Main stylesheet
│   ├── privacy.css            Styles for the privacy page
│   ├── privacy.html           Privacy & Data Use page
│   └── robots.txt             Search engine directives
│
├── tests/
│   ├── server.test.js         60 unit tests: server.js pure functions and
│   │                          analyzeText with an injected mock client
│   └── rescue.test.js         17 tests for rescue.js: scenario combinations and source labels
│                              (77 tests total via npm test)
│
├── benchmark/
│   ├── dev.json               40 synthetic labelled examples (committed)
│   ├── holdout.private.json   80-example holdout set (gitignored)
│   ├── run.js                 Benchmark runner (uses analyzeText from server.js)
│   └── README.md              Benchmark methodology and metric definitions
│
└── .kiro/
    ├── steering/
    │   ├── product.md            Product description and limitations
    │   ├── tech-stack.md         Runtime, dependencies, testing
    │   └── structure.md          This file
    ├── hooks/
    │   └── run-tests-on-save.json  PostFileSave hook that runs npm test
    └── specs/
        └── stability-security/
            ├── requirements.md   Formal requirements for the improvement sprint
            ├── design.md         Architecture decisions and component design
            ├── tasks.md          Implementation task list with completion status
            └── tasks.meta.json   Kiro session execution history (do not edit)
```

## Key conventions

- **No `innerHTML`** for user-supplied or AI-supplied content — always use `textContent`.
- **Pure functions** (`validateAnalysis`, `inspectLink`, `hasImageSignature`, `hasAudioSignature`, `recoverExactQuote`) are exported from `server.js` only under `NODE_ENV === 'test'`.
- **`rescue.js` is a UMD module** — do not convert it to ES modules; it must run in both Node.js and the browser without a bundler.
- **Line-number references in tasks.md** are approximate — always locate blocks by their content, not their line numbers.
- **The `.kiro/` directory must not be gitignored** — it is part of the hackathon submission evidence.
