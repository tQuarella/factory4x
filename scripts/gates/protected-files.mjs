#!/usr/bin/env node
// Protected-files tripwire. Fails if a protected path changed between <base>
// and HEAD without a matching owner approval line in QUESTIONS.md:
//
//   APPROVED-PROTECTED: <path>
//
// This is a tripwire, not a security boundary: an agent could forge the line.
// The real enforcement is the deny rules in .claude/settings.json plus the
// owner reviewing the protected-files section of each handoff.
//
// Usage: node scripts/gates/protected-files.mjs [--base <git-ref>]
// Without --base it checks against origin/main, then main; if neither exists
// (first commit) it passes.
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';

export const PROTECTED = [
  'VISION.md',
  '.claude/agents/critic.md',
  '.claude/settings.json',
  'scripts/gates/',
  '.github/workflows/',
  'eslint.config.js',
];

// No shell: cmd.exe on Windows treats ^ as an escape and would mangle "<ref>^{commit}".
function git(...args) {
  return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
}

function refExists(ref) {
  try {
    git('rev-parse', '--verify', '--quiet', `${ref}^{commit}`);
    return true;
  } catch {
    return false;
  }
}

const i = process.argv.indexOf('--base');
let base = i >= 0 ? process.argv[i + 1] : undefined;
if (!base) base = ['origin/main', 'main'].find(refExists);

if (!base || !refExists(base)) {
  console.log('protected-files: no base ref to compare against; skipping.');
  process.exit(0);
}

// Committed changes since base, plus anything staged (e.g. an in-progress merge in merge-task).
const changed = [
  ...new Set([
    ...git('diff', '--name-only', `${base}...HEAD`).split('\n'),
    ...git('diff', '--name-only', '--cached', 'HEAD').split('\n'),
  ]),
].filter(Boolean);
const hits = changed.filter((f) => PROTECTED.some((p) => (p.endsWith('/') ? f.startsWith(p) : f === p)));

if (hits.length === 0) {
  console.log(`protected-files: PASS (${changed.length} changed files vs ${base}, none protected)`);
  process.exit(0);
}

const questions = existsSync('QUESTIONS.md') ? readFileSync('QUESTIONS.md', 'utf8') : '';
const unapproved = hits.filter((f) => !questions.includes(`APPROVED-PROTECTED: ${f}`));

if (unapproved.length) {
  console.error('protected-files: FAIL. Protected paths changed without owner approval:');
  for (const f of unapproved) console.error(`  - ${f}`);
  console.error('Ask the owner in QUESTIONS.md; the owner adds "APPROVED-PROTECTED: <path>" to approve.');
  process.exit(1);
}
console.log(`protected-files: PASS (owner-approved: ${hits.join(', ')})`);
