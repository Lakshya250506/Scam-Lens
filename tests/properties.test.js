'use strict';

// Property-based tests (fast-check). Offline, no API key. Every property uses
// the same fixed seed so a failure can be reproduced exactly: run the failing
// test again and fast-check prints the seed, the path and the shrunk input.

process.env.NODE_ENV = 'test';

const test = require('node:test');
const assert = require('node:assert/strict');
const fc = require('fast-check');

const {
    validateAnalysis,
    inspectLink,
    INDIAN_BRANDS,
    LOOKALIKE_KEYWORDS,
    LOOKALIKE_SUSPICIOUS_TLDS
} = require('../server.js');

const SEED = 20261122;
const run = (property, numRuns) =>
    fc.assert(property, { seed: SEED, numRuns, verbose: 1 });

const RISK_LEVELS = new Set(['High caution', 'Review carefully', 'No obvious structural warning']);
const REPUTATION = 'Not performed. This prototype checks URL structure only and does not query a live malicious-domain database.';
const DISCLAIMER = 'A link without obvious structural red flags can still be malicious. Do not treat this result as proof that a website is safe.';
const RULE_A = /does not appear to be/;

const KEYWORDS = [...LOOKALIKE_KEYWORDS];
const TLDS = [...LOOKALIKE_SUSPICIOUS_TLDS];
const BRAND_TOKENS = Object.values(INDIAN_BRANDS).flatMap(brand => brand.tokens);
const VOCABULARY = [...new Set([...BRAND_TOKENS, ...KEYWORDS, 'www', 'bank', 'mail', 'm', 'net'])];

// ---------------------------------------------------------------------------
// Generators for validateAnalysis
// ---------------------------------------------------------------------------

const WORDS = [
    'urgent', 'your', 'account', 'will', 'be', 'blocked', 'pay', 'now', 'OTP', 'share',
    'paise', 'bhej', 'do', 'khata', 'band', 'ho', 'jayega', 'KYC', 'update', 'link',
    '\u092a\u0948\u0938\u0947', '\u0916\u093e\u0924\u093e', '\u20b9500', 'https://x.example/a?b=1'
];

const messageArb = fc.oneof(
    fc.string({ unit: 'binary', maxLength: 160 }),
    fc.string({ unit: 'grapheme', maxLength: 160 }),
    fc.array(fc.constantFrom(...WORDS), { maxLength: 30 })
        .chain(words => fc.array(fc.constantFrom(' ', '  ', '\n', '\t', ', '), {
            minLength: words.length, maxLength: words.length
        }).map(seps => words.map((w, i) => w + (seps[i] || '')).join('')))
);

// A phrase taken from the message, a case or whitespace variant of one, or noise.
const phraseArb = message => {
    const slice = fc.tuple(fc.nat(message.length), fc.nat(message.length))
        .map(([a, b]) => message.slice(Math.min(a, b), Math.max(a, b)));
    return fc.oneof(
        slice,
        slice.map(s => s.toUpperCase()),
        slice.map(s => s.toLowerCase()),
        slice.map(s => `  ${s.replace(/ /g, '   ')} `),
        fc.string({ unit: 'binary', maxLength: 40 }),
        fc.constantFrom('none', 'NONE', '', '   ', '*', '(', '[a-z]+', '\\d{3}')
    );
};

const analysisArb = messageArb.chain(message =>
    fc.record({
        message: fc.constant(message),
        risk: fc.constantFrom('Safe', 'Suspicious', 'Highly Dangerous'),
        phrases: fc.array(phraseArb(message), { maxLength: 8 }),
        quotes: fc.array(phraseArb(message), { maxLength: 6 }),
        steps: fc.array(fc.string({ maxLength: 60 }), { maxLength: 10 })
    })
).map(({ message, risk, phrases, quotes, steps }) => ({
    message,
    value: {
        risk_level: risk,
        scam_category: 'Banking or UPI fraud',
        explanation_summary: 'Generated.',
        scam_breakdown: phrases.map(p => ({
            suspicious_phrase: p, detected_tactics: ['Urgency'], why_it_matters: 'Generated.'
        })),
        manipulation_sequence: quotes.map((q, i) => ({
            step: i + 1, title: 'Step', description: 'Generated.', evidence_quote: q
        })),
        safe_next_steps: steps,
        safe_response_template: null
    }
}));

test(`P1 (seed ${SEED}): every kept evidence quote is a substring of the original message`, () => {
    run(fc.property(analysisArb, ({ message, value }) => {
        const result = validateAnalysis(value, message);
        for (const item of result.scam_breakdown) {
            assert.equal(typeof item.suspicious_phrase, 'string');
            assert.ok(item.suspicious_phrase.length > 0);
            assert.ok(message.includes(item.suspicious_phrase),
                `kept phrase ${JSON.stringify(item.suspicious_phrase)} not in message`);
        }
        for (const item of result.manipulation_sequence) {
            assert.ok(message.includes(item.evidence_quote),
                `kept quote ${JSON.stringify(item.evidence_quote)} not in message`);
        }
    }), 400);
});

test(`P2 (seed ${SEED}): "Highly Dangerous" is never returned when no evidence quote survived`, () => {
    run(fc.property(analysisArb, ({ message, value }) => {
        const result = validateAnalysis(value, message);
        if (result.scam_breakdown.length === 0) {
            assert.notEqual(result.risk_level, 'Highly Dangerous');
        }
        if (result.risk_level === 'Highly Dangerous') {
            assert.ok(result.scam_breakdown.length > 0);
        }
    }), 400);
});

// ---------------------------------------------------------------------------
// Generators for inspectLink
// ---------------------------------------------------------------------------

const labelArb = fc.oneof(
    fc.stringMatching(/^[a-z0-9]{1,12}$/),
    fc.constantFrom(...VOCABULARY)
);

const vocabularyUrlArb = fc.record({
    scheme: fc.constantFrom('https://', 'http://', '', 'HTTPS://'),
    credentials: fc.constantFrom('', '', '', 'user:pass@'),
    labels: fc.array(fc.oneof(labelArb, fc.array(labelArb, { minLength: 2, maxLength: 3 }).map(p => p.join('-'))), { minLength: 1, maxLength: 4 }),
    tld: fc.constantFrom(...TLDS, 'com', 'in', 'co.in', 'gov.in', 'bank.in', 'fin.in', 'sbi', 'org', 'xn--p1ai'),
    path: fc.constantFrom('', '/', '/login', '/kyc?x=1', '/%41'),
    trailingDot: fc.boolean()
}).map(u => `${u.scheme}${u.credentials}${u.labels.join('.')}.${u.tld}${u.trailingDot ? '.' : ''}${u.path}`);

const linkInputArb = fc.oneof(
    fc.string({ maxLength: 120 }),
    fc.string({ unit: 'binary', maxLength: 120 }),
    fc.webUrl(),
    fc.domain(),
    fc.ipV4().map(ip => `https://${ip}/sbi-login`),
    vocabularyUrlArb
);

test(`P3 (seed ${SEED}): inspectLink results are well-formed, unchanged in wording and deterministic`, () => {
    run(fc.property(linkInputArb, input => {
        let first;
        try {
            first = inspectLink(input);
        } catch {
            return true; // only inputs that do not throw are in scope
        }
        const second = inspectLink(input);
        assert.ok(RISK_LEVELS.has(first.risk_level), first.risk_level);
        assert.equal(first.reputation_check, REPUTATION);
        assert.equal(first.disclaimer, DISCLAIMER);
        assert.deepEqual(second, first);
        if (first.findings.length > 0) {
            assert.notEqual(first.risk_level, 'No obvious structural warning');
        }
        return true;
    }), 800);
});

// ---------------------------------------------------------------------------
// Brand lookalike properties
// ---------------------------------------------------------------------------

const brandsExceptAxis = Object.entries(INDIAN_BRANDS).filter(([key]) => key !== 'axis');

const officialHostArb = fc.constantFrom(...brandsExceptAxis).chain(([key, brand]) =>
    fc.record({
        key: fc.constant(key),
        domain: fc.constantFrom(...brand.officialDomains),
        labels: fc.array(labelArb, { minLength: 1, maxLength: 3 })
    })
);

test(`P4a (seed ${SEED}): an official domain with any alphanumeric subdomains never gets a Rule A finding`, () => {
    run(fc.property(officialHostArb, ({ domain, labels }) => {
        const host = `${labels.join('.')}.${domain}`;
        const result = inspectLink(`https://${host}`);
        const ruleA = result.findings.filter(f => RULE_A.test(f));
        assert.deepEqual(ruleA, [], `${host}: ${ruleA.join(' | ')}`);
    }), 600);
});

const lookalikeHostArb = fc.constantFrom(...brandsExceptAxis).chain(([key, brand]) =>
    fc.record({
        key: fc.constant(key),
        token: fc.constantFrom(...brand.tokens),
        keyword: fc.constantFrom(...KEYWORDS),
        tld: fc.constantFrom(...TLDS)
    })
);

test(`P4b (seed ${SEED}): <brand>-<keyword>.<suspicious TLD> always gets Rule A and High caution`, () => {
    run(fc.property(lookalikeHostArb, ({ token, keyword, tld }) => {
        const host = `${token}-${keyword}.${tld}`;
        const result = inspectLink(`https://${host}`);
        assert.ok(result.findings.some(f => RULE_A.test(f)), `${host} has no Rule A finding`);
        assert.equal(result.risk_level, 'High caution', host);
    }), 600);
});
