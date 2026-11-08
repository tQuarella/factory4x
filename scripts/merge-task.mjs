#!/usr/bin/env node
// Merges task/<id> into main only if:
//   1. reviews/<id>.md exists and its last verdict line is "VERDICT: APPROVE" (Critic approval)
//   2. main is clean
//   3. all gates pass on the merged result
// Otherwise it aborts the merge and leaves main untouched.
//
// The branch merged is the newer of the local task/<id> and origin/task/<id>
// (after a fetch). An agent working on an alias branch pushes with
// `git push origin HEAD:task/<id>` because the local task/<id> is checked out in
// another worktree, so origin is often ahead of the local ref (H4: h4-bots,
// h4-client, h4-design-data). If the two have diverged, nothing is merged.
//
//   npm run merge-task -- <id>             merge
//   npm run merge-task -- <id> --dry-run   print the ref and verdict it would use, change nothing
import { execFileSync, execSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const id = args.find((a) => !a.startsWith('--'));
if (!id) {
  console.error('Usage: npm run merge-task -- <id> [--dry-run]');
  process.exit(2);
}
const sh = (c) => execSync(c, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const tryRev = (ref) => {
  try {
    // execFileSync, not a shell: cmd.exe would eat the ^ in ^{commit}.
    return execFileSync('git', ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
};
const isAncestor = (a, b) => spawnSync(`git merge-base --is-ancestor ${a} ${b}`, { shell: true }).status === 0;
const fail = (msg) => {
  console.error(`merge-task: ${msg}`);
  process.exit(1);
};

// Pick the branch to merge.
const branch = `task/${id}`;
if (spawnSync(`git fetch --quiet origin`, { shell: true, stdio: 'inherit' }).status !== 0) {
  console.warn('merge-task: git fetch failed; using refs as they are.');
}
const local = tryRev(branch);
const remote = tryRev(`origin/${branch}`);
let ref;
if (!local && !remote) fail(`neither ${branch} nor origin/${branch} exists.`);
else if (!remote || local === remote) ref = branch;
else if (!local) ref = `origin/${branch}`;
else if (isAncestor(local, remote)) {
  ref = `origin/${branch}`;
  console.log(`merge-task: local ${branch} (${local.slice(0, 7)}) is behind origin; using origin/${branch}.`);
} else if (isAncestor(remote, local)) {
  ref = branch;
  console.warn(`merge-task: local ${branch} has commits not on origin; push them so the record and CI match what is merged.`);
} else {
  fail(`${branch} (${local.slice(0, 7)}) and origin/${branch} (${remote.slice(0, 7)}) have diverged; reconcile them on the task branch first.`);
}
const sha = tryRev(ref);

const reviewPath = `reviews/${id}.md`;
// The review is written on the task branch; read it from the ref being merged.
let review = '';
try {
  review = sh(`git show ${sha}:${reviewPath}`);
} catch {
  if (existsSync(reviewPath)) review = readFileSync(reviewPath, 'utf8');
}
const verdicts = [...review.matchAll(/^VERDICT:\s*(APPROVE|REJECT)\b/gm)].map((m) => m[1]);
console.log(`merge-task: ${ref} at ${sha.slice(0, 7)}; latest verdict: ${verdicts.at(-1) ?? 'none'}.`);
if (verdicts.at(-1) !== 'APPROVE') fail(`no Critic approval in ${reviewPath} (latest verdict: ${verdicts.at(-1) ?? 'none'}).`);
if (dryRun) {
  console.log('merge-task: dry run, nothing merged.');
  process.exit(0);
}

if (sh('git rev-parse --abbrev-ref HEAD') !== 'main') fail('run this from main.');
if (sh('git status --porcelain')) fail('main has uncommitted changes.');

const merge = spawnSync(`git merge --no-ff --no-commit ${sha}`, { shell: true, stdio: 'inherit' });
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
console.log(`merge-task: merged task/${id} at ${sha.slice(0, 7)}. Remove its worktree with: npm run worktree -- remove ${id}`);
