'use strict';

// Run from the project root:
// npm run benchmark -- --split dev
//
// The held-out set requires an explicit confirmation flag.

const fs = require('node:fs');
const path = require('node:path');

require('dotenv').config();

const args = process.argv.slice(2);

function getArg(name, fallback) {
    const index = args.indexOf(name);
    return index >= 0 && args[index + 1]
        ? args[index + 1]
        : fallback;
}

const split = getArg('--split', 'dev');
const limit = Number(getArg('--limit', '0')) || 0;
const delayMs = Math.max(
    0,
    Number(getArg('--delay-ms', '1200')) || 0
);

const confirmHoldout = args.includes('--confirm-holdout');

if (!['dev', 'test'].includes(split)) {
    console.error('Invalid split. Use --split dev or --split test.');
    process.exit(1);
}

if (split === 'test' && !confirmHoldout) {
    console.error(
        'The held-out test set is for final evaluation. ' +
        'Add --confirm-holdout only when prompt/rule tuning is frozen.'
    );
    process.exit(1);
}

if (!process.env.GROQ_API_KEY?.trim()) {
    console.error(
        'GROQ_API_KEY is missing. Add it to your local .env first.'
    );
    process.exit(1);
}

// Avoid starting an HTTP server.
// Import the production analysis function for local evaluation.
process.env.NODE_ENV = 'test';

const { analyzeText } = require('../server.js');

if (typeof analyzeText !== 'function') {
    console.error(
        'Could not import analyzeText. Check the test-only exports in server.js.'
    );
    process.exit(1);
}

const root = path.resolve(__dirname, '..');

const datasetPath = path.join(
    __dirname,
    split === 'dev' ? 'dev.json' : 'holdout.private.json'
);

if (!fs.existsSync(datasetPath)) {
    console.error(`Dataset not found: ${datasetPath}`);
    process.exit(1);
}

const dataset = JSON.parse(
    fs.readFileSync(datasetPath, 'utf8')
);

if (!Array.isArray(dataset) || dataset.length === 0) {
    console.error('Dataset must be a non-empty JSON array.');
    process.exit(1);
}

const samples = limit > 0
    ? dataset.slice(0, limit)
    : dataset;

const resultsDir = path.join(__dirname, 'results');

fs.mkdirSync(resultsDir, { recursive: true });

const stamp = new Date()
    .toISOString()
    .replace(/[:.]/g, '-');

const outputPath = path.join(
    resultsDir,
    `${split}-${stamp}.json`
);

const progressPath = path.join(
    resultsDir,
    `${split}-latest-progress.json`
);

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

function riskNumber(level) {
    return {
        Safe: 0,
        Suspicious: 1,
        'Highly Dangerous': 2
    }[level];
}

function rate(numerator, denominator) {
    return denominator
        ? Number((numerator / denominator).toFixed(4))
        : null;
}

function summarize(rows) {
    const total = rows.length;
    const valid = rows.filter(row => row.predicted_risk);
    const errors = total - valid.length;

    // expected_scam=true currently means expected risk is
    // Suspicious or Highly Dangerous, not necessarily confirmed fraud.
    const nonSafeRows = rows.filter(row => row.expected_scam);
    const safeRows = rows.filter(row => !row.expected_scam);

    const falseSafe = nonSafeRows.filter(
        row => row.predicted_risk === 'Safe'
    );

    const detectedNonSafe = nonSafeRows.filter(
        row => row.predicted_risk &&
            row.predicted_risk !== 'Safe'
    );

    const unresolvedNonSafe = nonSafeRows.filter(
        row => !row.predicted_risk
    );

    const falseAlarm = safeRows.filter(
        row => row.predicted_risk &&
            row.predicted_risk !== 'Safe'
    );

    const trueSafe = safeRows.filter(
        row => row.predicted_risk === 'Safe'
    );

    const unresolvedSafe = safeRows.filter(
        row => !row.predicted_risk
    );

    const predictedNonSafe = valid.filter(
        row => row.predicted_risk !== 'Safe'
    );

    const exact = valid.filter(
        row => row.predicted_risk === row.expected_risk
    );

    const withinOne = valid.filter(row =>
        Math.abs(
            riskNumber(row.predicted_risk) -
            riskNumber(row.expected_risk)
        ) <= 1
    );

    const allEvidenceAnchors = rows.reduce(
        (sum, row) => sum + (row.evidence_quotes?.length || 0),
        0
    );

    const matchedEvidenceAnchors = rows.reduce(
        (sum, row) => sum + (row.evidence_anchor_matches || 0),
        0
    );

    const byLanguage = {};

    for (const language of ['english', 'hindi', 'hinglish']) {
        const group = rows.filter(
            row => row.language === language
        );

        const groupNonSafe = group.filter(
            row => row.expected_scam
        );

        const groupValid = group.filter(
            row => row.predicted_risk
        );

        const groupCorrect = groupValid.filter(
            row => row.predicted_risk === row.expected_risk
        );

        const groupFalseSafe = groupNonSafe.filter(
            row => row.predicted_risk === 'Safe'
        );

        const groupDetected = groupNonSafe.filter(
            row => row.predicted_risk &&
                row.predicted_risk !== 'Safe'
        );

        byLanguage[language] = {
            samples: group.length,
            errors: group.length - groupValid.length,

            exact_risk_accuracy: rate(
                groupCorrect.length,
                group.length
            ),

            non_safe_detection_recall: rate(
                groupDetected.length,
                groupNonSafe.length
            ),

            false_safe_count: groupFalseSafe.length,

            false_safe_rate: rate(
                groupFalseSafe.length,
                groupNonSafe.length
            )
        };
    }

    const riskConfusion = {};

    for (const expected of [
        'Safe',
        'Suspicious',
        'Highly Dangerous'
    ]) {
        riskConfusion[expected] = {};

        for (const predicted of [
            'Safe',
            'Suspicious',
            'Highly Dangerous',
            'Error'
        ]) {
            riskConfusion[expected][predicted] = rows.filter(
                row =>
                    row.expected_risk === expected &&
                    (row.predicted_risk || 'Error') === predicted
            ).length;
        }
    }

    return {
        total_examples: total,
        completed: valid.length,
        errors,

        // Failed API calls count as incorrect for overall accuracy.
        exact_risk_accuracy: rate(
            exact.length,
            total
        ),

        within_one_risk_level: rate(
            withinOne.length,
            total
        ),

        non_safe_detection_recall: rate(
            detectedNonSafe.length,
            nonSafeRows.length
        ),

        false_safe_count: falseSafe.length,

        false_safe_rate: rate(
            falseSafe.length,
            nonSafeRows.length
        ),

        unresolved_non_safe_count: unresolvedNonSafe.length,

        unresolved_non_safe_rate: rate(
            unresolvedNonSafe.length,
            nonSafeRows.length
        ),

        false_alarm_count: falseAlarm.length,

        false_alarm_rate: rate(
            falseAlarm.length,
            safeRows.length
        ),

        unresolved_safe_count: unresolvedSafe.length,

        unresolved_safe_rate: rate(
            unresolvedSafe.length,
            safeRows.length
        ),

        non_safe_precision: rate(
            detectedNonSafe.length,
            predictedNonSafe.length
        ),

        safe_specificity: rate(
            trueSafe.length,
            safeRows.length
        ),

        evidence_anchor_recall: rate(
            matchedEvidenceAnchors,
            allEvidenceAnchors
        ),

        evidence_anchors_matched: matchedEvidenceAnchors,
        evidence_anchors_total: allEvidenceAnchors,

        risk_confusion_matrix: riskConfusion,
        by_language: byLanguage
    };
}

function normalizeEvidencePhrase(value) {
    return String(value || '')
        .toLocaleLowerCase()
        .replace(/\s+/g, ' ')
        .trim();
}

function countEvidenceMatches(sample, result) {
    const actual = (result.scam_breakdown || [])
        .map(item =>
            normalizeEvidencePhrase(item?.suspicious_phrase)
        )
        .filter(Boolean);

    return (sample.evidence_quotes || []).filter(anchor => {
        const expected = normalizeEvidencePhrase(anchor);

        return expected && actual.some(
            quote => quote.includes(expected)
        );
    }).length;
}

async function analyseOne(sample) {
    const maxAttempts = 3;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        try {
            const result = await analyzeText(
                sample.message,
                sample.language
            );

            return {
                id: sample.id,
                language: sample.language,

                expected_risk: sample.expected_risk,
                expected_scam: sample.expected_scam,

                evidence_quotes: sample.evidence_quotes,

                predicted_risk: result.risk_level,
                predicted_category: result.scam_category,

                evidence_anchor_matches: countEvidenceMatches(sample, result),

                returned_evidence: result.scam_breakdown,

                explanation_summary: result.explanation_summary,

                error: null
                
            };

        } catch (error) {
            const status = Number(
                error?.status || error?.statusCode || 0
                
            );

            const retryAfter = Number(
                error?.headers?.get?.('retry-after') || 0
            ) * 1000;

            const retryable =
                status === 429 ||
                status >= 500 ||
                !status;

            if (attempt === maxAttempts || !retryable) {
                return {
                    id: sample.id,
                    language: sample.language,

                    expected_risk: sample.expected_risk,
                    expected_scam: sample.expected_scam,

                    // Evidence anchors are unmatched when analysis fails.
                    evidence_quotes: sample.evidence_quotes || [],
                    evidence_anchor_matches: 0,

                    predicted_risk: null,

                    error: String(
                        error?.message || error
                    ).slice(0, 500)
                };
            }

            const waitMs = Math.max(
                retryAfter,
                delayMs * attempt,
                5000
            );

            console.warn(
                `Retrying ${sample.id} after API error ` +
                `(${status || 'network'}); ` +
                `waiting ${Math.ceil(waitMs / 1000)}s.`
            );

            await wait(waitMs);
        }
    }
}

(async () => {
    console.log(`Scam Lens benchmark: ${split} set`);

    console.log(
        `Model: ${process.env.GROQ_MODEL || 'openai/gpt-oss-120b'}`
    );

    console.log(
        `Examples: ${samples.length}; delay: ${delayMs}ms`
    );

    console.log(
        'Dataset consists of synthetic examples; ' +
        'results are not a real-world detection guarantee.\n'
    );

    const rows = [];

    for (let index = 0; index < samples.length; index += 1) {
        const sample = samples[index];

        const row = await analyseOne(sample);

        rows.push(row);

        const label = row.predicted_risk ||
            `ERROR: ${row.error}`;

        console.log(
            `[${index + 1}/${samples.length}] ` +
            `${sample.id}: expected=${sample.expected_risk}; ` +
            `predicted=${label}`
        );

        const progress = {
            split,
            model: process.env.GROQ_MODEL || 'openai/gpt-oss-120b',
            started_or_updated_at: new Date().toISOString(),
            results: rows,
            summary: summarize(rows)
        };

        fs.writeFileSync(
            progressPath,
            JSON.stringify(progress, null, 2) + '\n'
        );

        if (index < samples.length - 1 && delayMs) {
            await wait(delayMs);
        }
    }

    const report = {
        project: 'Scam Lens',
        benchmark_version: '1.0',
        dataset_split: split,

        dataset_source:
            'Synthetic, manually authored evaluation examples',

        model: process.env.GROQ_MODEL || 'openai/gpt-oss-120b',

        vision_model_not_used: true,

        generated_at: new Date().toISOString(),

        metrics: summarize(rows),

        results: rows
    };

    fs.writeFileSync(
        outputPath,
        JSON.stringify(report, null, 2) + '\n'
    );

    fs.writeFileSync(
        progressPath,
        JSON.stringify(report, null, 2) + '\n'
    );

    console.log('\n=== SUMMARY ===');

    console.log(
        JSON.stringify(report.metrics, null, 2)
    );

    console.log(
        `\nFull report: ${path.relative(root, outputPath)}`
    );

    const missed = rows.filter(
        row =>
            row.expected_scam &&
            row.predicted_risk === 'Safe'
    );

    if (missed.length) {
        console.log(
            '\n=== FALSE-SAFE CASES — REVIEW THESE FIRST ==='
        );

        for (const row of missed) {
            console.log(
                `${row.id} (${row.language}): ` +
                `expected ${row.expected_risk}, predicted Safe`
            );
        }
    }

    if (report.metrics.errors) {
        process.exitCode = 1;
    }

})().catch(error => {
    console.error('Benchmark failed:', error);
    process.exitCode = 1;
});