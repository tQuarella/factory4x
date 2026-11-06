#!/usr/bin/env node
// Merges task/<id> into main only if:
//   1. reviews/<id>.md exists and its last verdict line is "VERDICT: APPROVE" (Critic approval)
//   2. main is clean
//   3. all gates pass on the merged result
// Otherwise it aborts the merge and leaves main untouched.
//
//   npm run merge-task -- <id>
import { execSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

const id = process.argv[2];
if (!id) {
  console.error('Usage: npm run merge-task -- <id>');
  process.exit(2);
}
const sh = (c) => execSync(c, { encoding: 'utf8' }).trim();
const fail = (msg) => {
  console.error(`merge-task: ${msg}`);
  process.exit(1);
};

const reviewPath = `reviews/${id}.md`;
// The review is written on the task branch; read it from there.
let review = '';
try {
  review = sh(`git show task/${id}:${reviewPath}`);
} catch {
  if (existsSync(reviewPath)) review = readFileSync(reviewPath, 'utf8');
}
const verdicts = [...review.matchAll(/^VERDICT:\s*(APPROVE|REJECT)\b/gm)].map((m) => m[1]);
if (verdicts.at(-1) !== 'APPROVE') fail(`no Critic approval in ${reviewPath} (latest verdict: ${verdicts.at(-1) ?? 'none'}).`);

if (sh('git rev-parse --abbrev-ref HEAD') !== 'main') fail('run this from main.');
if (sh('git status --porcelain')) fail('main has uncommitted changes.');

const merge = spawnSync(`git merge --no-ff --no-commit task/${id}`, { shell: true, stdio: 'inherit' });
if (merge.status !== 0) {
  spawnSync('git merge --abort', { shell: true });
  fail('merge conflict; resolve on the task branch (merge main into it) and re-review.');
}

const gates = spawnSync('npm run gates -- --base main', { shell: true, stdio: 'inherit' });
if (gates.status !== 0) {
  spawnSync('git merge --abort', { shell: true });
  fail('gates failed on the merged result; merge aborted, main unchanged.');
}

execSync(`git commit -m "Merge task/${id} (Critic approved, gates passed)"`, { stdio: 'inherit' });
console.log(`merge-task: merged task/${id}. Remove its worktree with: npm run worktree -- remove ${id}`);
