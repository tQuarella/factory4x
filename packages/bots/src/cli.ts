/**
 * Headless bot suite (replaces the "Bot runner" agent).
 * Plays every strategy over several seeds, writes reports/bots-latest.{json,md},
 * and exits non-zero on crash, softlock or tick-budget overrun.
 *
 * Usage: npm run bots [-- --seeds 3 --ticks 54000]
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { defaultData } from '@factory4x/sim';
import budgets from '../../../scripts/gates/budgets.json' with { type: 'json' };
import { runGame, type GameResult } from './runner.ts';
import { strategies } from './strategies.ts';

function arg(name: string, fallback: number): number {
  const i = process.argv.indexOf(`--${name}`);
  const v = i >= 0 ? Number(process.argv[i + 1]) : NaN;
  return Number.isFinite(v) && v > 0 ? v : fallback;
}

const seeds = arg('seeds', 3);
const ticks = arg('ticks', budgets.botGameTicks);
const results: GameResult[] = [];

for (const s of strategies) {
  for (let seed = 1; seed <= seeds; seed++) {
    results.push(runGame(s, seed, defaultData, ticks));
  }
}

const failures: string[] = [];
const rows = strategies.map((s) => {
  const rs = results.filter((r) => r.strategy === s.name);
  const wins = rs.filter((r) => r.outcome === 'won');
  const winRate = wins.length / rs.length;
  const ttw = wins.length ? wins.reduce((a, r) => a + (r.timeToWinSec ?? 0), 0) / wins.length : null;
  const p95 = Math.max(...rs.map((r) => r.tickMsP95));
  for (const r of rs) {
    if (r.outcome === 'crash' || r.outcome === 'softlock') failures.push(`${s.name} seed ${r.seed}: ${r.outcome}${r.error ? ` (${r.error.split('\n')[0]})` : ''}`);
  }
  if (p95 > budgets.tickBudgetMsP95) failures.push(`${s.name}: tick p95 ${p95.toFixed(3)}ms exceeds budget ${budgets.tickBudgetMsP95}ms`);
  return { strategy: s.name, games: rs.length, winRate, avgTimeToWinSec: ttw, tickMsP95: p95, outcomes: rs.map((r) => r.outcome) };
});

mkdirSync('reports', { recursive: true });
const report = {
  generatedAt: new Date().toISOString(),
  dataVersion: defaultData.dataVersion,
  seeds,
  ticks,
  tickBudgetMsP95: budgets.tickBudgetMsP95,
  summary: rows,
  failures,
  results,
};
writeFileSync('reports/bots-latest.json', JSON.stringify(report, null, 2));

const md = [
  `# Bot suite: ${failures.length ? 'FAIL' : 'PASS'}`,
  '',
  `Data version ${defaultData.dataVersion}, ${seeds} seeds × ${ticks} ticks, tick budget p95 ≤ ${budgets.tickBudgetMsP95} ms.`,
  '',
  '| Strategy | Games | Win rate | Avg time to win | Tick p95 (ms) | Outcomes |',
  '| --- | --- | --- | --- | --- | --- |',
  ...rows.map((r) => `| ${r.strategy} | ${r.games} | ${(r.winRate * 100).toFixed(0)}% | ${r.avgTimeToWinSec === null ? '—' : `${r.avgTimeToWinSec.toFixed(0)} s`} | ${r.tickMsP95.toFixed(4)} | ${r.outcomes.join(', ')} |`),
  '',
  failures.length ? `## Failures\n\n${failures.map((f) => `- ${f}`).join('\n')}` : '',
].join('\n');
writeFileSync('reports/bots-latest.md', md);

console.log(md);
process.exit(failures.length ? 1 : 0);
