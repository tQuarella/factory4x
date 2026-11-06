#!/usr/bin/env node
// Runs every merge gate except Critic approval, in order, and writes
// reports/gates-latest.json. Exit code is non-zero if any gate fails.
// Usage: npm run gates [-- --base <git-ref>]   (base is passed to the protected-files check)
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

const baseIdx = process.argv.indexOf('--base');
const base = baseIdx >= 0 ? process.argv[baseIdx + 1] : undefined;

const gates = [
  ['typecheck', 'npm run typecheck'],
  ['lint', 'npm run lint'],
  ['test', 'npm test'],
  ['determinism', 'npm run determinism'],
  ['bots', 'npm run bots'],
  ['protected-files', `npm run protected${base ? ` -- --base ${base}` : ''}`],
];

const results = [];
for (const [name, cmd] of gates) {
  const t0 = Date.now();
  process.stdout.write(`\n=== gate: ${name} ===\n`);
  const r = spawnSync(cmd, { shell: true, stdio: 'inherit' });
  results.push({ gate: name, ok: r.status === 0, seconds: (Date.now() - t0) / 1000 });
}

mkdirSync('reports', { recursive: true });
const ok = results.every((r) => r.ok);
writeFileSync('reports/gates-latest.json', JSON.stringify({ ok, at: new Date().toISOString(), results }, null, 2));

console.log('\n=== gate summary ===');
for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.gate.padEnd(16)} ${r.seconds.toFixed(1)}s`);
console.log(ok ? '\nAll gates passed (Critic approval still required to merge).' : '\nGates FAILED.');
process.exit(ok ? 0 : 1);
