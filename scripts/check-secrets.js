#!/usr/bin/env node
'use strict';

// Scans project text files for strings that look like API keys, and checks
// that .gitignore lists .env. No dependencies. It prints the file and line
// number of each finding and NEVER the matched text.
//
// Usage: node scripts/check-secrets.js [projectRoot]
// Exit code: 0 when nothing is found, 1 when anything is found.

const fs = require('node:fs');
const path = require('node:path');

const SKIP_DIRS = new Set(['node_modules', '.git']);
const SKIP_RELATIVE_DIRS = ['benchmark/results'];
const SKIP_FILES = new Set(['.env']);
const MAX_BYTES = 2 * 1024 * 1024;

// Key-like patterns. The pattern text itself does not match these patterns.
const KEY_PATTERNS = [
    { kind: 'possible Groq API key', pattern: /\bgsk_[A-Za-z0-9]{16,}/ },
    { kind: 'possible sk- style API key', pattern: /\bsk-[A-Za-z0-9_-]{20,}/ }
];

// A GROQ_API_KEY= line with a real-looking value. Empty values, placeholders
// and variable references are allowed (for example in .env.example).
const ENV_ASSIGNMENT = /^\s*(?:export\s+)?GROQ_API_KEY\s*=\s*(.*)$/;
const PLACEHOLDER = /^(?:|your\b.*|your[-_].*|.*\bhere\b.*|.*example.*|.*placeholder.*|changeme|x{3,}.*|<[^>]*>|\$.*|\*+|\.\.\.)$/i;

function envValue(raw) {
    return raw
        .replace(/\s+#.*$/, '')
        .trim()
        .replace(/^(['"`])(.*)\1$/, '$2')
        .trim();
}

// Returns findings for one file's text: [{ line, kind }]. No matched text.
function scanText(text) {
    const findings = [];
    const lines = String(text).split(/\r?\n/);

    lines.forEach((line, index) => {
        for (const { kind, pattern } of KEY_PATTERNS) {
            if (pattern.test(line)) findings.push({ line: index + 1, kind });
        }

        const assignment = ENV_ASSIGNMENT.exec(line);
        if (assignment && !PLACEHOLDER.test(envValue(assignment[1]))) {
            findings.push({ line: index + 1, kind: 'non-empty GROQ_API_KEY value outside .env' });
        }
    });

    return findings;
}

function isSkippedDir(relativePath, name) {
    if (SKIP_DIRS.has(name)) return true;
    const normal = relativePath.split(path.sep).join('/');
    return SKIP_RELATIVE_DIRS.includes(normal);
}

function listFiles(root) {
    const files = [];
    const walk = dir => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, entry.name);
            const relative = path.relative(root, full);

            if (entry.isDirectory()) {
                if (!isSkippedDir(relative, entry.name)) walk(full);
            } else if (entry.isFile() && !SKIP_FILES.has(entry.name)) {
                files.push(full);
            }
        }
    };
    walk(root);
    return files;
}

// Returns true when .gitignore has a line that ignores .env.
function gitignoreListsEnv(root) {
    try {
        return fs.readFileSync(path.join(root, '.gitignore'), 'utf8')
            .split(/\r?\n/)
            .map(line => line.trim())
            .some(line => line === '.env' || line === '/.env');
    } catch {
        return false;
    }
}

// Scans a project folder. Returns { findings: [{ file, line, kind }], gitignoreOk }.
function scanProject(root = path.resolve(__dirname, '..')) {
    const findings = [];

    for (const file of listFiles(root)) {
        let buffer;
        try {
            const size = fs.statSync(file).size;
            if (size > MAX_BYTES) continue;
            buffer = fs.readFileSync(file);
        } catch {
            continue;
        }
        if (buffer.includes(0)) continue; // binary file

        for (const finding of scanText(buffer.toString('utf8'))) {
            findings.push({
                file: path.relative(root, file).split(path.sep).join('/'),
                ...finding
            });
        }
    }

    return { findings, gitignoreOk: gitignoreListsEnv(root) };
}

function main(argv) {
    const root = path.resolve(argv[2] || path.resolve(__dirname, '..'));
    const { findings, gitignoreOk } = scanProject(root);

    for (const { file, line, kind } of findings) {
        console.log(`${file}:${line}: ${kind} (value not shown)`);
    }
    if (!gitignoreOk) {
        console.log('.gitignore: does not contain a ".env" line');
    }

    const problems = findings.length + (gitignoreOk ? 0 : 1);
    if (problems) {
        console.log(`check-secrets: ${problems} problem(s) found.`);
        return 1;
    }
    console.log('check-secrets: no key-like strings found; .gitignore lists .env.');
    return 0;
}

if (require.main === module) {
    process.exitCode = main(process.argv);
}

module.exports = { scanText, scanProject, gitignoreListsEnv, listFiles, main };
