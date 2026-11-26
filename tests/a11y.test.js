'use strict';

// Static accessibility checks. These tests read the HTML and CSS files as text.
// They need no DOM library, no network and no API key. They check that the
// markup, script and styles contain the accessibility features described in
// .kiro/specs/accessibility/. They do not prove how a browser or a screen
// reader behaves; that needs manual checking.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const readFile = (...parts) =>
    fs.readFileSync(path.join(__dirname, '..', ...parts), 'utf8');

const html = readFile('public', 'index.html');
const privacy = readFile('public', 'privacy.html');
const css = readFile('public', 'style.css').replace(/\r\n/g, '\n');
const readme = readFile('README.md');

// Markup without scripts and comments, and the one inline script on its own.
const markupOf = source => source
    .replace(/<script[\s\S]*?<\/script>/g, '')
    .replace(/<!--[\s\S]*?-->/g, '');
const markup = markupOf(html);
const privacyMarkup = markupOf(privacy);
const script = /<script nonce="CSP_NONCE_PLACEHOLDER">([\s\S]*?)<\/script>/.exec(html)[1];

const count = (text, pattern) => (text.match(pattern) || []).length;
const tagsOf = (text, pattern) => text.match(pattern) || [];
const hasAttr = (tag, name) => new RegExp(`\\s${name}(\\s|=|>)`).test(tag);
const attr = (tag, name) => {
    const found = new RegExp(`\\s${name}="([^"]*)"`).exec(tag);
    return found ? found[1] : null;
};

const VIEWS = [
    'homeView', 'textView', 'imageView', 'voiceView', 'linkView',
    'resultsView', 'rescueView', 'historyView', 'guideView'
];

// Splits the markup of index.html into one segment per view.
function viewSegments() {
    const starts = [...markup.matchAll(/<section id="(\w+View)"/g)]
        .map(m => ({ id: m[1], at: m.index }));
    const mainEnd = markup.indexOf('</main>');
    return Object.fromEntries(starts.map((s, i) => [
        s.id,
        markup.slice(s.at, i + 1 < starts.length ? starts[i + 1].at : mainEnd)
    ]));
}

// WCAG relative luminance and contrast ratio.
const channel = v => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
};
const luminance = hex => {
    const n = hex.replace('#', '');
    const [r, g, b] = [0, 2, 4].map(i => parseInt(n.slice(i, i + 2), 16));
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
};
const contrast = (a, b) => {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
};

const rootBlock = /:root\s*\{([^}]*)\}/.exec(css)[1];
const vars = Object.fromEntries(
    [...rootBlock.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)]
        .map(m => [m[1], m[2]])
);

test('page language is set on both pages', () => {
    assert.match(html, /<html lang="en">/);
    assert.match(privacy, /<html lang="en">/);
});

test('skip link is the first focusable element and targets an existing id', () => {
    for (const [name, page] of [['index.html', markup], ['privacy.html', privacyMarkup]]) {
        const body = page.slice(page.indexOf('<body>'));
        const first = /<(a|button|input|select|textarea)\b[^>]*>/i.exec(body)[0];
        assert.match(first, /class="skip-link"/, `${name}: first focusable element`);
        const target = attr(first, 'href');
        assert.equal(target, '#mainContent', name);
        assert.match(page, /<main\b[^>]*\bid="mainContent"/, `${name}: target id exists on main`);
        assert.match(page, /<main\b[^>]*\btabindex="-1"/, `${name}: main can receive focus`);
        assert.match(body, />\s*Skip to main content\s*<\/a>/, name);
    }
});

test('index.html has one header, one nav, one main and one footer, with the footer outside main', () => {
    for (const tag of ['header', 'nav', 'main', 'footer']) {
        assert.equal(count(markup, new RegExp(`<${tag}\\b`, 'g')), 1, `<${tag}>`);
    }
    assert.ok(markup.indexOf('</main>') < markup.indexOf('<footer'),
        'the footer must come after </main> so it is the page footer landmark');
    assert.match(markup, /<nav class="main-nav" aria-label="Main navigation">/);
});

test('privacy.html has one header, one main and one footer, with the footer outside main', () => {
    for (const tag of ['header', 'main', 'footer']) {
        assert.equal(count(privacyMarkup, new RegExp(`<${tag}\\b`, 'g')), 1, `<${tag}>`);
    }
    assert.ok(privacyMarkup.indexOf('</main>') < privacyMarkup.indexOf('<footer'));
    assert.equal(count(privacyMarkup, /<h1\b/g), 1);
});

test('every view has exactly one h1, and it can receive focus from script', () => {
    const segments = viewSegments();
    assert.deepEqual(Object.keys(segments).sort(), [...VIEWS].sort());
    for (const id of VIEWS) {
        const h1s = tagsOf(segments[id], /<h1\b[^>]*>/g);
        assert.equal(h1s.length, 1, `${id} h1 count`);
        assert.equal(attr(h1s[0], 'tabindex'), '-1', `${id} h1 tabindex`);
    }
});

test('heading levels never skip a level inside a view', () => {
    const segments = viewSegments();
    for (const id of VIEWS) {
        const levels = [...segments[id].matchAll(/<h([1-6])\b/g)].map(m => Number(m[1]));
        assert.equal(levels[0], 1, `${id} starts with h1`);
        levels.forEach((level, i) => {
            if (i > 0) assert.ok(level <= levels[i - 1] + 1, `${id}: h${levels[i - 1]} then h${level}`);
        });
    }
    const privacyLevels = [...privacyMarkup.matchAll(/<h([1-6])\b/g)].map(m => Number(m[1]));
    privacyLevels.forEach((level, i) => {
        if (i > 0) assert.ok(level <= privacyLevels[i - 1] + 1, 'privacy.html heading order');
    });
});

test('headings that script creates keep the heading order (history cards are h2)', () => {
    const start = script.indexOf('function renderHistory()');
    const end = script.indexOf("$('clearHistoryBtn')");
    const body = script.slice(start, end);
    assert.ok(start > 0 && end > start);
    assert.match(body, /createElement\('h2'\)/);
    assert.doesNotMatch(body, /createElement\('h3'\)/);
    // Results cards sit under h2 headings, so h3 is correct there.
    assert.match(script, /createElement\('h3'\)/);
});

test('opening a view moves focus to its h1 and updates the page title, but not on load', () => {
    const showView = script.slice(script.indexOf('function showView('), script.indexOf("const toolViews"));
    assert.match(showView, /focusViewHeading\(viewId\)/);
    const focusFn = script.slice(script.indexOf('function focusViewHeading('), script.indexOf('function startBusy('));
    assert.match(focusFn, /document\.title =/);
    assert.match(focusFn, /\.focus\(\{ preventScroll: true \}\)/);
    assert.match(focusFn, /Scam Lens/);
    assert.doesNotMatch(script, /^showView\(/m, 'no top-level showView call');
    assert.doesNotMatch(script, /^[^\s/].*\.focus\(/m, 'no top-level focus call');
});

test('the active navigation button exposes aria-current', () => {
    assert.match(markup, /data-nav="home" class="nav-button active" aria-current="page"/);
    assert.match(script, /setAriaCurrent\(button, active\)/);
    assert.match(script, /setAriaCurrent\(\$\('rescueNavButton'\)/);
    assert.match(script, /setAttribute\('aria-current', 'page'\)/);
});

test('busy buttons use aria-busy and announce once', () => {
    assert.match(script, /setAttribute\('aria-busy', 'true'\)/);
    assert.match(script, /removeAttribute\('aria-busy'\)/);
    assert.match(script, /announce\('Analysing, please wait'\)/);
    assert.equal(count(script, /button\.disabled = true;/g), 1, 'only startBusy disables a working button');
    // Seven buttons: analyze text, extract, analyze extracted text, transcribe
    // recording, transcribe file, analyze transcript, inspect URL.
    assert.equal(count(script, /startBusy\(button, '/g), 7);
    assert.equal(count(script, /endBusy\(button, '/g), 7);
});

test('every form control has an associated label', () => {
    const controls = tagsOf(markup, /<(?:input|textarea|select)\b[^>]*>/gi)
        .filter(tag => attr(tag, 'type') !== 'hidden');
    assert.ok(controls.length >= 15, `expected at least 15 controls, found ${controls.length}`);
    for (const tag of controls) {
        const id = attr(tag, 'id');
        const at = markup.indexOf(tag);
        const wrapped = markup.lastIndexOf('<label', at) > markup.lastIndexOf('</label>', at);
        const labelled = hasAttr(tag, 'aria-label') || hasAttr(tag, 'aria-labelledby') ||
            (id && new RegExp(`<label[^>]*\\sfor="${id}"`).test(markup)) || wrapped;
        assert.ok(labelled, `control has no label: ${tag.replace(/\s+/g, ' ')}`);
    }
});

test('the character counter is linked to the message field', () => {
    const field = /<textarea[^>]*\bid="messageInput"[^>]*>/.exec(markup)[0];
    const ids = attr(field, 'aria-describedby').split(/\s+/);
    assert.ok(ids.includes('characterCount'));
    for (const id of ids) {
        assert.match(markup, new RegExp(`id="${id}"`), `${id} must exist`);
    }
});

test('Rescue Mode situation checkboxes are in a fieldset with a legend', () => {
    const group = /<fieldset\b[\s\S]*?<\/fieldset>/.exec(markup)[0];
    assert.match(group, /<legend\b/);
    assert.equal(count(group, /name="rescueScenario"/g), 4);
    assert.equal(count(markup, /name="rescueScenario"/g), 4);
});

test('a polite live region and role="alert" regions exist', () => {
    const region = /<div id="liveAnnouncer"[^>]*>/.exec(markup)[0];
    assert.equal(attr(region, 'aria-live'), 'polite');
    assert.match(attr(region, 'class'), /visually-hidden/);
    for (const id of ['textError', 'imageError', 'audioError', 'linkError']) {
        const tag = new RegExp(`<p id="${id}"[^>]*>`).exec(markup)[0];
        assert.equal(attr(tag, 'role'), 'alert', `${id} role`);
        assert.ok(hasAttr(tag, 'hidden'), `${id} starts hidden`);
    }
    // Spoken once: the status line is not itself a live region.
    assert.doesNotMatch(/<p id="incidentSummaryStatus"[^>]*>/.exec(markup)[0], /role=|aria-live/);
});

test('errors are linked to their field only while they are visible', () => {
    for (const [error, field] of [
        ['textError', 'messageInput'], ['linkError', 'urlInput'],
        ['imageError', 'imageInput'], ['audioError', 'audioFileInput']
    ]) {
        assert.match(script, new RegExp(`showFieldError\\('${error}', '${field}'`), `${error} -> ${field}`);
    }
    assert.match(script, /setAttribute\('aria-invalid', 'true'\)/);
    assert.match(script, /removeAttribute\('aria-invalid'\)/);
    assert.match(script, /removeDescribedBy\(/);
    assert.match(script, /error\.textContent = '';/, 'hidden errors are emptied');
    assert.doesNotMatch(script, /\$\('(textError|linkError|audioError)'\)\.hidden = false/);
});

test('the Rescue Mode checklist is an ordered list and is not a live region', () => {
    assert.match(markup, /<ol id="rescueChecklist"/);
    const panel = /<section class="rescue-checklist-panel"[^>]*>/.exec(markup)[0];
    assert.doesNotMatch(panel, /aria-live/);
    assert.match(script, /Checklist updated: \$\{count\}/);
});

test('copy, save, delete, recording and checklist changes are announced', () => {
    for (const text of [
        "announce('Copied')",
        "setIncidentStatus('Incident summary copied.', 'Copied')",
        "announce('Saved locally')",
        "announce('Deleted')",
        "announce('Recording started')",
        "announce('Recording stopped')"
    ]) {
        assert.ok(script.includes(text), `missing ${text}`);
    }
    assert.ok(count(script, /announce\('Deleted'\)/g) >= 2, 'single delete and delete all');
});

test('voice tool exposes its state and never announces the running timer', () => {
    const start = /<button id="startRecordingBtn"[^>]*>/.exec(markup)[0];
    assert.equal(attr(start, 'aria-pressed'), 'false');
    assert.match(script, /startRecordingBtn'\)\.setAttribute\('aria-pressed', 'true'\)/);
    assert.match(script, /startRecordingBtn'\)\.setAttribute\('aria-pressed', 'false'\)/);
    const timer = /<div id="recordTimer"[^>]*>/.exec(markup)[0];
    assert.equal(attr(timer, 'aria-live'), 'off');
    assert.equal(attr(timer, 'role'), 'timer');
    assert.match(/<span id="recordDot"[^>]*>/.exec(markup)[0], /aria-hidden="true"/);
    const timerFn = script.slice(
        script.indexOf('function updateRecordingTimer()'),
        script.indexOf("$('startRecordingBtn').addEventListener")
    );
    assert.ok(timerFn.length > 50);
    assert.doesNotMatch(timerFn, /announce\(/);
    assert.equal(count(script, /announce\('Recording started'\)/g), 1);
    assert.equal(count(script, /announce\('Recording stopped'\)/g), 1);
});

test('no inline style attributes, inline event handlers or HTML injection', () => {
    for (const [name, page] of [['index.html', markup], ['privacy.html', privacyMarkup]]) {
        assert.doesNotMatch(page, /<[a-zA-Z][^>]*\sstyle\s*=/, `${name}: inline style attribute`);
        assert.doesNotMatch(page, /<[a-zA-Z][^>]*\son[a-zA-Z]+\s*=/, `${name}: inline event handler`);
    }
    assert.doesNotMatch(script, /innerHTML|outerHTML|insertAdjacentHTML|document\.write|eval\(/);
    assert.doesNotMatch(script, /setAttribute\('style'/);
    assert.equal(count(html, /<script\b(?![^>]*\bsrc=)(?![^>]*ld\+json)[^>]*>/g), 1, 'one inline script block');
    assert.equal(count(html, /<script\b[^>]*nonce="CSP_NONCE_PLACEHOLDER"/g), 2, 'both scripts keep the nonce');
});

test('styles have a visible :focus-visible rule and no outline: none', () => {
    assert.match(css, /(^|\n):focus-visible\s*\{[^}]*outline:\s*3px solid var\(--focus-ring\)/);
    assert.doesNotMatch(css, /outline:\s*(none|0)\b/);
    assert.doesNotMatch(css, /outline:[^;]*rgb\(88 114 96/);
    assert.match(css, /\.tool-card:focus-visible\s*\{[^}]*var\(--focus-ring\)/);
    assert.match(css, /\.skip-link:focus\s*\{[^}]*translateY\(0\)/);
    assert.match(css, /\.visually-hidden\s*\{[^}]*clip/);
});

test('styles honour prefers-reduced-motion, and script does not force smooth scrolling', () => {
    const block = /@media \(prefers-reduced-motion: reduce\)\s*\{[\s\S]*?\n\}/.exec(css);
    assert.ok(block, 'prefers-reduced-motion rule exists');
    assert.match(block[0], /animation/);
    assert.match(block[0], /transition/);
    assert.match(script, /matchMedia\('\(prefers-reduced-motion: reduce\)'\)/);
    assert.doesNotMatch(script, /behavior:\s*'smooth'/);
});

test('links that open a new tab keep rel and are described as opening a new tab', () => {
    for (const [name, page, source] of [
        ['index.html', markup, html], ['privacy.html', privacyMarkup, privacy]
    ]) {
        const anchors = tagsOf(page, /<a\b[^>]*>/g).filter(tag => /target="_blank"/.test(tag));
        assert.ok(anchors.length >= 3, `${name}: expected external links`);
        for (const tag of anchors) {
            assert.equal(attr(tag, 'rel'), 'noopener noreferrer', `${name}: ${tag}`);
            assert.equal(attr(tag, 'aria-describedby'), 'newTabHint', `${name}: ${tag}`);
        }
        const hint = /<span id="newTabHint"[^>]*>([^<]*)<\/span>/.exec(source);
        assert.ok(hint, `${name}: hint element exists`);
        assert.match(hint[0], /class="visually-hidden"/);
        assert.match(hint[1], /opens in a new tab/i);
    }
    assert.match(script, /link\.setAttribute\('aria-describedby', 'newTabHint'\)/);
});

test('the existing Rescue Mode source link text is unchanged by the new-tab hint', () => {
    // Hidden text is attached by aria-describedby so the link text stays the label only.
    assert.match(markup, /<a href="https:\/\/cybercrime\.gov\.in\/pdf\/Advisories\/ADVISORYTAU-ADV-003DigitalArrest06\.03\.2025\.pdf"[^>]*>\s*I4C \/ NCTAU: Digital Arrest Scam Advisory, 6 March 2025\s*<\/a>/);
});

test('colour pairs in :root meet 4.5:1 for text and 3:1 for borders and the focus ring', () => {
    assert.ok(vars['page-bg'] && vars.surface && vars.muted, 'variables parsed from :root');
    // Sanity checks of the formula.
    assert.ok(Math.abs(contrast('#000000', '#ffffff') - 21) < 0.01);
    assert.ok(Math.abs(contrast('#808080', '#808080') - 1) < 0.001);

    const backgrounds = ['page-bg', 'surface', 'surface-muted'];
    const text = [];
    for (const bg of backgrounds) text.push(['text', bg], ['muted', bg]);
    text.push(['muted', 'accent-soft']);
    for (const bg of ['page-bg', 'surface', 'accent-soft']) text.push(['accent-hover', bg]);
    text.push(['danger-text', 'danger-bg'], ['warning-text', 'warning-bg'], ['safe-text', 'safe-bg']);
    for (const [fg, bg] of text) {
        const ratio = contrast(vars[fg], vars[bg]);
        assert.ok(ratio >= 4.5, `--${fg} on --${bg} is ${ratio.toFixed(2)}:1, needs 4.5:1`);
    }
    for (const bg of ['accent', 'accent-hover']) {
        const ratio = contrast('#ffffff', vars[bg]);
        assert.ok(ratio >= 4.5, `white on --${bg} is ${ratio.toFixed(2)}:1`);
    }
    assert.ok(contrast('#ffffff', vars.text) >= 4.5, 'skip link text on --text');
    for (const bg of ['page-bg', 'surface', 'accent-soft']) {
        const ratio = contrast(vars['focus-ring'], vars[bg]);
        assert.ok(ratio >= 3, `focus ring on --${bg} is ${ratio.toFixed(2)}:1, needs 3:1`);
    }
    for (const bg of ['surface-muted', 'surface']) {
        const ratio = contrast(vars['control-border'], vars[bg]);
        assert.ok(ratio >= 3, `field border on --${bg} is ${ratio.toFixed(2)}:1, needs 3:1`);
    }
});

test('placeholder text and the idle record indicator meet their contrast minimums', () => {
    const placeholder = /::placeholder\s*\{\s*color:\s*(#[0-9a-fA-F]{6})/.exec(css)[1];
    assert.ok(contrast(placeholder, vars['surface-muted']) >= 4.5,
        `placeholder ${placeholder} on --surface-muted`);
    const dot = /#recordDot\s*\{[^}]*background:\s*(#[0-9a-fA-F]{6})/.exec(css)[1];
    assert.ok(contrast(dot, vars['surface-muted']) >= 3, `idle record dot ${dot}`);
    assert.match(css, /border:\s*1px solid var\(--control-border\)/, 'fields use the control border');
});

test('narrow-screen rules give buttons and the situation checkboxes a 44px target', () => {
    const narrow = css.split('@media (max-width: 640px)').slice(1).join('\n');
    assert.match(narrow, /\.primary-button,[\s\S]*?\.rescue-call-link\s*\{\s*min-height:\s*44px/);
    assert.match(narrow, /\.rescue-option\s*\{\s*min-height:\s*44px/);
    assert.match(narrow, /\.rescue-option input\[type="checkbox"\]\s*\{[^}]*width:\s*24px/);
    assert.match(css, /fieldset\.rescue-scenario-grid\s*\{[^}]*border:\s*0/);
    assert.match(css, /@media \(max-width: 400px\)[\s\S]*?white-space:\s*normal/);
});

test('README describes the accessibility work without claiming conformance', () => {
    assert.match(readme, /^## Accessibility/m);
    const start = readme.indexOf('\n## Accessibility');
    const next = readme.indexOf('\n## ', start + 5);
    const section = readme.slice(start, next === -1 ? undefined : next);
    assert.ok(section.length > 200, 'the section has content');
    assert.match(section, /not been (formally )?audited|no formal audit/i);
    assert.match(section, /not (been )?tested with every screen reader/i);
    assert.doesNotMatch(readme, /(WCAG[^\n]*\b(compliant|conformant|conforms|certified)\b)|fully accessible|accessible to everyone/i);
});

test('every view and the privacy reminder are direct children of main (no view is nested in another)', () => {
    // A missing </section> once nested History and the Safety guide inside
    // Rescue Mode, so hiding Rescue Mode hid them too.
    const stack = [];
    const parents = {};
    for (const m of markup.matchAll(/<(\/?)(section|main|div|aside|footer|article)\b([^>]*)>/g)) {
        if (m[1] === '/') {
            const top = stack.pop();
            assert.ok(top && top.tag === m[2], `</${m[2]}> closes <${top ? top.tag : 'nothing'}>`);
            continue;
        }
        const id = (/\bid="([^"]+)"/.exec(m[3]) || [])[1] || '';
        const cls = (/\bclass="([^"]+)"/.exec(m[3]) || [])[1] || '';
        const key = /View$/.test(id) ? id : cls.split(/\s+/).includes('privacy-banner') ? 'privacy-banner' : null;
        if (key) parents[key] = stack.length ? stack[stack.length - 1].id : '';
        stack.push({ tag: m[2], id });
    }
    assert.equal(stack.length, 0, 'every opened element is closed');
    for (const id of [...VIEWS, 'privacy-banner']) {
        assert.equal(parents[id], 'mainContent', `${id} parent`);
    }
});

test('the home information box below "Stay informed" has no negative margin', () => {
    const rules = [...css.matchAll(/\.seo-intro\s*\{([^}]*)\}/g)].map(m => m[1]);
    assert.ok(rules.length >= 1, '.seo-intro rules found');
    for (const body of rules) {
        assert.doesNotMatch(body, /margin(-top)?\s*:\s*-/, body.trim());
    }
});