'use strict';

// Tests for scripts/check-secrets.js. Fake key-like strings are built at run
// time from pieces, so no key-like literal is stored anywhere in the repository.
// Offline: temporary folders only. No network, no API key.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const scanner = require('../scripts/check-secrets.js');
const SCRIPT = path.join(__dirname, '..', 'scripts', 'check-secrets.js');
const ROOT = path.join(__dirname, '..');

// Built at run time: "g" + "sk" + "_" ... and "s" + "k-" ...
const fakeGroqKey = () => ['g', 'sk', '_'].join('') + 'Ab3Xy9Qw'.repeat(3);
const fakeSkKey = () => ['s', 'k', '-'].join('') + 'Zz81Kp4M'.repeat(3);
const fakeEnvLine = () => ['GROQ', 'API', 'KEY'].join('_') + '=' + 'q7Rt2Lm9Vx4Np8Ws';

const created = [];
test.after(() => {
    for (const dir of created) fs.rmSync(dir, { recursive: true, force: true });
});

function makeProject(files) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scamlens-secrets-'));
    created.push(dir);
    for (const [name, content] of Object.entries(files)) {
        const full = path.join(dir, name);
        fs.mkdirSync(path.dirname(full), { recursive: true });
        fs.writeFileSync(full, content);
    }
    return dir;
}

const runCli = dir => spawnSync(process.execPath, [SCRIPT, dir], { encoding: 'utf8' });

test('SC-T1: key-like strings and real-looking GROQ_API_KEY values are detected, with line numbers', () => {
    const text = ['first line', `const k = "${fakeGroqKey()}";`, `other ${fakeSkKey()}`, fakeEnvLine()].join('\n');
    assert.deepEqual(scanner.scanText(text).map(f => [f.line, f.kind]), [
        [2, 'possible Groq API key'],
        [3, 'possible sk- style API key'],
        [4, 'non-empty GROQ_API_KEY value outside .env']
    ]);
});

test('SC-T2: short prefixes, placeholders and variable references are not reported', () => {
    for (const text of [
        'Keys start with gsk_ and are secret.',
        'sk-short',
        'GROQ_API_KEY=',
        'GROQ_API_KEY=your-groq-api-key-here',
        'GROQ_API_KEY="<your key>"',
        'GROQ_API_KEY=${GROQ_API_KEY}',
        '# GROQ_API_KEY=xxxxxxxx',
        'process.env.GROQ_API_KEY = value',
        'disk-space-is-not-a-key-at-all-really'
    ]) {
        assert.deepEqual(scanner.scanText(text), [], text);
    }
});

test('SC-T3: the real .env.example gives no finding', () => {
    const text = fs.readFileSync(path.join(ROOT, '.env.example'), 'utf8');
    assert.match(text, /GROQ_API_KEY=/);
    assert.deepEqual(scanner.scanText(text), []);
});

test('SC-T4: the CLI exits non-zero, names the file and line, and never prints the secret', () => {
    const key = fakeGroqKey();
    const dir = makeProject({
        '.gitignore': 'node_modules/\n.env\n',
        'src/app.js': `// config\nconst token = '${key}';\n`
    });
    const result = runCli(dir);
    assert.equal(result.status, 1);
    assert.match(result.stdout, /src\/app\.js:2: possible Groq API key \(value not shown\)/);
    assert.ok(!result.stdout.includes(key), 'the secret must not be printed');
    assert.ok(!result.stderr.includes(key));
    assert.ok(!result.stdout.includes(key.slice(4, 14)), 'no part of the secret is printed');
});

test('SC-T5: .env, node_modules, .git and benchmark/results are skipped', () => {
    const dir = makeProject({
        '.gitignore': '.env\n',
        '.env': `${fakeEnvLine()}\n${fakeGroqKey()}\n`,
        'node_modules/pkg/index.js': fakeGroqKey(),
        '.git/config': fakeSkKey(),
        'benchmark/results/run.json': fakeGroqKey(),
        'benchmark/dev.json': '{"ok":true}',
        '.env.example': 'GROQ_API_KEY=your-groq-api-key-here\n'
    });
    const result = runCli(dir);
    assert.equal(result.status, 0, result.stdout);
    assert.deepEqual(scanner.scanProject(dir).findings, []);
});

test('SC-T6: a .gitignore without .env is reported', () => {
    const missing = makeProject({ '.gitignore': 'node_modules/\n.env.local\n', 'a.txt': 'hello' });
    const result = runCli(missing);
    assert.equal(result.status, 1);
    assert.match(result.stdout, /\.gitignore: does not contain a "\.env" line/);
    assert.equal(scanner.gitignoreListsEnv(missing), false);
    assert.equal(scanner.gitignoreListsEnv(makeProject({ '.gitignore': '/.env\n' })), true);
    assert.equal(scanner.gitignoreListsEnv(makeProject({ 'a.txt': 'x' })), false);
});

test('SC-T7: binary files are skipped and other .env-like files are scanned', () => {
    const dir = makeProject({
        '.gitignore': '.env\n',
        'image.bin': Buffer.concat([Buffer.from([0, 1, 2]), Buffer.from(fakeGroqKey())]),
        '.env.local': fakeEnvLine()
    });
    const files = scanner.scanProject(dir).findings.map(f => f.file);
    assert.deepEqual(files, ['.env.local']);
});

test('SC-T8: this repository has no key-like strings outside .env and lists .env in .gitignore', () => {
    const { findings, gitignoreOk } = scanner.scanProject(ROOT);
    assert.deepEqual(findings, [], findings.map(f => `${f.file}:${f.line}`).join(', '));
    assert.equal(gitignoreOk, true);
});
