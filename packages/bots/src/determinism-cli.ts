/**
 * Determinism gate. Runs the reference replay twice in fresh worlds and
 * compares state hashes every N ticks. Also writes the hashes to
 * reports/determinism-latest.json so the browser smoke test can check that a
 * different JS engine produces the same sequence.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { defaultData, replayHashes } from '@factory4x/sim';
import budgets from '../../../scripts/gates/budgets.json' with { type: 'json' };
import { referenceReplay } from './reference-replay.ts';

const { determinismTicks: ticks, determinismHashEvery: every } = budgets;
const a = replayHashes(referenceReplay, defaultData, ticks, every);
const b = replayHashes(referenceReplay, defaultData, ticks, every);

const firstDiff = a.findIndex((h, i) => h !== b[i]);
const ok = firstDiff === -1 && a.length === b.length && a.length > 0;

mkdirSync('reports', { recursive: true });
writeFileSync('reports/determinism-latest.json', JSON.stringify({ ok, ticks, every, hashes: a }, null, 2));

if (!ok) {
  console.error(`Determinism FAIL: first divergence at tick ${(firstDiff + 1) * every} (${a[firstDiff]} vs ${b[firstDiff]})`);
  process.exit(1);
}
console.log(`Determinism PASS: ${a.length} checkpoints over ${ticks} ticks, final ${a[a.length - 1]}`);
