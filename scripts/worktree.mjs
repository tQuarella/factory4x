#!/usr/bin/env node
// Worktree tooling for parallel engineers. Each task gets its own worktree
// and branch `task/<id>` next to the repo, in ../Factory4X-wt/<id>.
//
//   npm run worktree -- new <id>      create worktree + branch from main, install deps
//   npm run worktree -- list          list worktrees
//   npm run worktree -- remove <id>   remove worktree (branch is kept until merged)
//
// Engineers launched by the Director with Agent isolation "worktree" get a
// worktree automatically; they must still name their branch task/<id>.
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const [cmd, id] = process.argv.slice(2);
const root = execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).trim();
const dir = (taskId) => resolve(root, '..', 'Factory4X-wt', taskId);
const run = (c, cwd = root) => execSync(c, { cwd, stdio: 'inherit' });

function needId() {
  if (!id || !/^[a-z0-9][a-z0-9-]*$/.test(id)) {
    console.error('Task id required: lowercase letters, digits and dashes (e.g. m1-extractors).');
    process.exit(2);
  }
}

switch (cmd) {
  case 'new': {
    needId();
    if (existsSync(dir(id))) {
      console.error(`Worktree already exists: ${dir(id)}`);
      process.exit(1);
    }
    run(`git worktree add "${dir(id)}" -b task/${id} main`);
    run('npm ci', dir(id));
    console.log(`\nReady: ${dir(id)} on branch task/${id}`);
    break;
  }
  case 'list':
    run('git worktree list');
    break;
  case 'remove':
    needId();
    run(`git worktree remove "${dir(id)}"`);
    break;
  default:
    console.error('Usage: npm run worktree -- <new|list|remove> [id]');
    process.exit(2);
}
