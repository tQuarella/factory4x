#!/usr/bin/env node
// Prints commits since the last build tag (build-*) as raw material for the
// player-facing CHANGELOG.md entry. The Director rewrites them into three
// plain lines; this script never edits CHANGELOG.md itself.
//
//   npm run changelog
import { execSync } from 'node:child_process';

const sh = (c) => execSync(c, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
let last = '';
try {
  last = sh('git describe --tags --match "build-*" --abbrev=0');
} catch {
  /* no previous build */
}
const range = last ? `${last}..HEAD` : 'HEAD';
const log = sh(`git log ${range} --no-merges --pretty=format:"- %s (%h)"`);
console.log(`Commits since ${last || 'the beginning'}:\n\n${log || '(none)'}`);
console.log('\nNext build tag: build-' + new Date().toISOString().slice(0, 10).replaceAll('-', '') + '-<n>');
