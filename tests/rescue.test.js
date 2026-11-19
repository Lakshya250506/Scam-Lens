'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('../public/rescue.js');

const SCENARIOS = Object.keys(R.SCENARIO_STEPS);
const ids = (...s) => R.getRescueSteps(s);
const text = id => R.STEPS[id].join(' ');

// every non-empty subset of scenarios
const subsets = SCENARIOS.reduce(
    (all, s) => all.concat(all.map(set => [...set, s])), [[]]
).filter(set => set.length);

const permutations = a => a.length <= 1 ? [a] :
    a.flatMap((x, i) => permutations([...a.slice(0, i), ...a.slice(i + 1)])
        .map(p => [x, ...p]));

test('single scenarios return the expected ordered steps', () => {
    assert.deepEqual(ids('money'),
        ['bank', 'helpline', 'portal', 'monitor', 'preserve']);
    assert.deepEqual(ids('credentials'),
        ['bank', 'secure', 'monitor', 'preserve']);
    assert.deepEqual(ids('app'),
        ['disconnect', 'bank', 'secure', 'device', 'monitor', 'preserve']);
    assert.deepEqual(ids('arrest'),
        ['endCall', 'emergency112', 'verify', 'report', 'preserve']);
});

test('no selection or unknown scenarios give no steps', () => {
    assert.deepEqual(R.getRescueSteps([]), []);
    assert.deepEqual(R.getRescueSteps(undefined), []);
    assert.deepEqual(ids('nonsense'), []);
});

test('result is independent of the order scenarios were selected', () => {
    for (const set of subsets) {
        const expected = R.getRescueSteps(set);
        for (const p of permutations(set)) {
            assert.deepEqual(R.getRescueSteps(p), expected, p.join('+'));
        }
    }
});

test('no duplicate steps, and portal/report never both appear', () => {
    for (const set of subsets) {
        const steps = R.getRescueSteps(set);
        assert.equal(new Set(steps).size, steps.length, set.join('+'));
        assert.ok(!(steps.includes('portal') && steps.includes('report')));
    }
});

test('containment and money steps always precede informational steps', () => {
    const idx = (steps, id) => steps.indexOf(id);
    for (const set of subsets) {
        const s = R.getRescueSteps(set);
        for (const urgent of ['endCall', 'emergency112', 'disconnect', 'bank', 'helpline']) {
            for (const later of ['portal', 'verify', 'report', 'monitor', 'preserve']) {
                if (s.includes(urgent) && s.includes(later)) {
                    assert.ok(idx(s, urgent) < idx(s, later),
                        `${urgent} before ${later} for ${set.join('+')}`);
                }
            }
        }
        if (s.includes('disconnect') && s.includes('bank')) {
            assert.ok(idx(s, 'disconnect') < idx(s, 'bank'), set.join('+'));
        }
    }
});

test('money selections always include the 1930 helpline and a bank step', () => {
    for (const set of subsets.filter(s => s.includes('money'))) {
        const s = R.getRescueSteps(set);
        assert.ok(s.includes('helpline') && s.includes('bank'));
        assert.match(text('helpline'), /1930/);
    }
});

test('credentials or money selections always include contacting the bank', () => {
    for (const set of subsets.filter(s =>
        s.includes('money') || s.includes('credentials'))) {
        assert.ok(R.getRescueSteps(set).includes('bank'), set.join('+'));
    }
});

test('arrest selections include the 112 physical-danger step', () => {
    for (const set of subsets.filter(s => s.includes('arrest'))) {
        assert.ok(R.getRescueSteps(set).includes('emergency112'));
    }
    assert.match(text('emergency112'), /112/);
    assert.match(text('emergency112'), /1930/);
});

test('every referenced step exists and has a title and detail', () => {
    for (const [scenario, list] of Object.entries(R.SCENARIO_STEPS)) {
        for (const id of list) {
            assert.ok(R.STEPS[id], `${scenario}: missing step ${id}`);
            assert.ok(R.RESCUE_ORDER.includes(id), `${id} missing from order`);
        }
    }
    for (const [id, [title, detail]] of Object.entries(R.STEPS)) {
        assert.ok(title.trim() && detail.trim(), id);
    }
    assert.equal(new Set(R.RESCUE_ORDER).size, R.RESCUE_ORDER.length);
});

test('only allowlisted helpline numbers and domains appear in step text', () => {
    const allowedNumbers = new Set(['1930', '112']);
    const allowedDomains = new Set(['cybercrime.gov.in']);
    for (const [id, [title, detail]] of Object.entries(R.STEPS)) {
        const body = `${title} ${detail}`;
        for (const n of body.match(/\b\d{3,5}\b/g) || []) {
            assert.ok(allowedNumbers.has(n), `${id}: unexpected number ${n}`);
        }
        for (const d of body.match(/\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:gov\.in|com|org|net|in)\b/gi) || []) {
            assert.ok(allowedDomains.has(d.toLowerCase()), `${id}: unexpected domain ${d}`);
        }
    }
});

test('claim-bearing steps carry a visible source label', () => {
    assert.ok(R.SOURCES.verify.label.length > 10);
    for (const s of Object.values(R.SOURCES)) {
        // Every source entry must have a non-null URL starting with https://
        assert.ok(typeof s.url === 'string' && s.url.startsWith('https://'),
            `SOURCES entry has missing or non-https url: ${JSON.stringify(s)}`);
    }
});

test('dynamic and static Rescue Mode sources agree and links are safe', () => {
    const fs = require('node:fs');
    const path = require('node:path');
    const html = fs.readFileSync(
        path.join(__dirname, '..', 'public', 'index.html'), 'utf8');

    // The static "Official guidance used" list must contain the same URL
    // and the same label as the dynamic checklist source.
    assert.ok(html.includes('href="' + R.SOURCES.verify.url + '"'),
        'static list is missing the SOURCES.verify URL');
    assert.ok(html.includes(R.SOURCES.verify.label),
        'static list is missing the SOURCES.verify label');
    assert.match(R.SOURCES.verify.label, /6 March 2025/);

    // Exact labels and URLs of all four sources, in the static list.
    const expected = {
        i4c: [
            'I4C / NCTAU: Digital Arrest Scam Advisory, 6 March 2025',
            'https://cybercrime.gov.in/pdf/Advisories/ADVISORYTAU-ADV-003DigitalArrest06.03.2025.pdf'
        ],
        rbi: [
            'RBI: Reporting unauthorised transactions',
            'https://www.rbi.org.in/commonman/english/Scripts/SMSLimitedliability.aspx'
        ],
        certin: [
            'CERT-In: Sophisticated RTO/eChallan-themed Android Malware Advisory, 17 March 2026',
            'https://www.cert-in.org.in/s2cMainServlet?CACODE=CICA-2026-3492&pageid=PUBADV01'
        ],
        pib: [
            'PIB (Ministry of Home Affairs): Digital Arrest warning, 27 October 2024',
            'https://www.pib.gov.in/PressReleasePage.aspx?PRID=2068698&lang=2&reg=48'
        ]
    };
    assert.deepEqual(Object.keys(R.SOURCE_LIST).sort(), Object.keys(expected).sort());
    for (const [key, [label, url]] of Object.entries(expected)) {
        assert.equal(R.SOURCE_LIST[key].label, label);
        assert.equal(R.SOURCE_LIST[key].url, url);
        const anchor = new RegExp('<a href="' +
            url.replace(/&/g, '&amp;').replace(/[.*+?^${}()|[\]\\]/g, '\\$&') +
            '"[^>]*>\\s*' + label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') +
            '\\s*</a>');
        assert.match(html, anchor, `static list entry for ${key}`);
    }

    // Every step source matches one of the four listed sources exactly.
    for (const [id, s] of Object.entries(R.SOURCES)) {
        const match = Object.values(R.SOURCE_LIST)
            .find(x => x.url === s.url && x.label === s.label);
        assert.ok(match, `${id}: source is not in SOURCE_LIST`);
    }

    // Review date.
    assert.equal(R.RESCUE_REVIEWED_DATE, '18 November 2026');
    assert.match(html, /reviewed against these official sources on 18 November 2026\./);
    assert.doesNotMatch(html, /15 November 2026/);

    // Every external link opened in a new tab must be noopener noreferrer.
    for (const tag of html.match(/<a\b[^>]*>/g) || []) {
        if (/target="_blank"/.test(tag)) {
            assert.match(tag, /rel="noopener noreferrer"/, tag);
        }
    }
});

test('source attribution: each step cites the right source with a scope note', () => {
    assert.equal(R.SOURCES.verify.url, R.SOURCE_LIST.i4c.url);
    assert.equal(R.SOURCES.endCall.url, R.SOURCE_LIST.pib.url);
    assert.equal(R.SOURCES.bank.url, R.SOURCE_LIST.rbi.url);
    for (const id of ['disconnect', 'device']) {
        assert.equal(R.SOURCES[id].url, R.SOURCE_LIST.certin.url);
    }
    for (const s of Object.values(R.SOURCES)) {
        assert.ok(s.note && s.note.length > 20, 'source note missing');
    }
});

test('CERT-In note states its scope and its supported precautions', () => {
    const note = R.SOURCES.device.note;
    assert.match(note, /specific Android e-Challan malware campaign/);
    assert.match(note, /does not cover every remote-access or screen-sharing incident/);
    for (const p of [/Wi-Fi and mobile data/, /uninstall suspicious applications/,
        /antivirus/, /passwords and UPI PIN/, /bank statements/, /general safety advice/]) {
        assert.match(note, p);
    }
    assert.match(text('disconnect'), /General safety advice/);
    assert.match(text('device'), /General safety advice/);
    assert.match(text('device'), /Uninstall suspicious applications/);
    assert.match(text('device'), /antivirus/);
});

test('Digital Arrest guidance does not attribute Customs, ED or judge claims', () => {
    assert.match(text('verify'), /no concept of “Digital Arrest” under Indian law/);
    assert.match(text('verify'), /impersonate government and law-enforcement officials/);
    assert.match(text('verify'), /nearest police station/);
    assert.match(text('verify'), /personal or financial information/);
    for (const id of ['verify', 'endCall']) {
        assert.doesNotMatch(text(id), /customs|\bED\b|enforcement directorate|judge/i, id);
    }
    for (const id of Object.keys(R.SOURCES)) {
        assert.doesNotMatch(R.SOURCES[id].note, /customs|\bED\b|judge/i, id);
    }
    // PIB claims are limited to what the release says.
    assert.match(text('endCall'), /police, CBI, anti-narcotics or RBI officers/);
    assert.match(text('endCall'), /do not conduct investigations over phone or video calls/);
    assert.match(text('endCall'), /1930/);
    assert.match(text('endCall'), /cybercrime\.gov\.in/);
});

test('bank step follows RBI wording and promises no recovery or refund', () => {
    const bank = text('bank');
    assert.match(bank, /notify your bank immediately/);
    assert.match(bank, /acknowledgement/);
    assert.match(bank, /Delays in reporting may increase your loss/);
    assert.match(bank, /General safety advice \(not from RBI\)/);
    assert.doesNotMatch(bank, /recover|refund|reimburs|money back|compensat|guaranteed? to/i);
    assert.doesNotMatch(R.SOURCES.bank.note, /recover|refund|reimburs|money back/i);
});

test('112 guidance is unchanged', () => {
    assert.deepEqual(R.STEPS.emergency112, [
        'If you feel physically unsafe, call 112',
        'If someone is threatening to harm you or you are in immediate physical danger, move to a safe place and call 112, India’s emergency number. 112 is for immediate danger; for money lost to fraud, use 1930.'
    ]);
});