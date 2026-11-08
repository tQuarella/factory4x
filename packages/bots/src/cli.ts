/**
 * Headless bot suite (replaces the "Bot runner" agent).
 * Plays every strategy over several seeds, writes reports/bots-latest.{json,md},
 * and exits non-zero on crash, softlock or tick-budget overrun. Missing a
 * design tuning target is a flag in the report, never a failure.
 *
 * Usage: npm run bots [-- --seeds 3 --ticks 54000]
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { defaultData, replayHashes } from '@factory4x/sim';
import budgets from '../../../scripts/gates/budgets.json' with { type: 'json' };
import { referenceReplay } from './reference-replay.ts';
import { H3_STRATEGIES, SAMPLE_MINUTES, SOFTLOCK_SEC, computeDepthFlags, layoutRows, mmss, runGame, runSeeds, type GameResult } from './runner.ts';
import { strategies } from './strategies.ts';

function arg(name: string, fallback: number): number {
  const i = process.argv.indexOf(`--${name}`);
  const v = i >= 0 ? Number(process.argv[i + 1]) : NaN;
  return Number.isFinite(v) && v > 0 ? v : fallback;
}

const seeds = arg('seeds', 3);
const ticks = arg('ticks', budgets.botGameTicks);
const started = performance.now();
const results: GameResult[] = [];
for (const s of strategies) results.push(...runSeeds(s, seeds, defaultData, ticks));
const runSec = (performance.now() - started) / 1000;

const failures: string[] = [];
const flags: string[] = [];
const fmtMin = (sec: number | null): string => (sec === null ? 'never' : `${(sec / 60).toFixed(1)} min`);

// Failures: crash, softlock, tick budget.
for (const s of strategies) {
  const rs = results.filter((r) => r.strategy === s.name);
  for (const r of rs) {
    if (r.outcome === 'crash') failures.push(`${s.name} seed ${r.seed}: crash (${(r.error ?? '').split('\n')[0]})`);
    if (r.outcome === 'softlock') failures.push(`${s.name} seed ${r.seed}: softlock (no delivery and no ship built for ${SOFTLOCK_SEC / 60} game minutes before capture, at ${fmtMin(r.ticks / defaultData.tickRate)})`);
  }
  const p95 = Math.max(...rs.map((r) => r.tickMsP95));
  if (p95 > budgets.tickBudgetMsP95) failures.push(`${s.name}: tick p95 ${p95.toFixed(3)}ms exceeds budget ${budgets.tickBudgetMsP95}ms`);
}

// Flags: heart captures, and the depth flags (report lines, never gates; the H3 flags land with h3-bots).
const first = (name: string): GameResult | undefined => results.find((r) => r.strategy === name && r.seed === 1);
for (const s of strategies) {
  if (s.stub) continue;
  for (const r of results.filter((x) => x.strategy === s.name)) {
    if (r.captureSec === null) flags.push(`${s.name} seed ${r.seed} (${r.variantId}) never captured the heart within ${fmtMin(ticks / defaultData.tickRate)}`);
  }
}
// Flag 6: the reference replay hashed twice, and one bot game played twice, must match.
const { determinismTicks, determinismHashEvery } = budgets;
const ha = replayHashes(referenceReplay, defaultData, determinismTicks, determinismHashEvery);
const hb = replayHashes(referenceReplay, defaultData, determinismTicks, determinismHashEvery);
const replayOk = ha.length > 0 && ha.length === hb.length && ha.every((h, i) => h === hb[i]);
const probe = strategies.find((x) => x.name === 'greedy')!;
const g1 = results.find((r) => r.strategy === probe.name && r.seed === 1);
const gameOk = g1 !== undefined && runGame(probe, 1, defaultData, ticks).finalHash === g1.finalHash;
const depthFlags = computeDepthFlags(results, replayOk && gameOk, `reference replay ${replayOk ? 'matches' : 'DIVERGES'} over ${determinismTicks} ticks; greedy seed 1 replayed ${gameOk ? 'to the same hash' : 'to a DIFFERENT hash'}`);
for (const f of depthFlags) if (!f.pass) flags.push(`depth flag missed: ${f.name} (${f.detail})`);

const rows = strategies.map((s) => {
  const rs = results.filter((r) => r.strategy === s.name);
  return {
    strategy: s.name,
    stub: s.stub === true,
    games: rs.length,
    captured: rs.filter((r) => r.outcome === 'won').length,
    captureSec: rs[0]?.captureSec ?? null,
    variants: rs.map((r) => r.variantId),
    tickMsP95: Math.max(...rs.map((r) => r.tickMsP95)),
    outcomes: rs.map((r) => r.outcome),
  };
});

mkdirSync('reports', { recursive: true });
const report = {
  generatedAt: new Date().toISOString(),
  dataVersion: defaultData.dataVersion,
  seeds,
  ticks,
  tickBudgetMsP95: budgets.tickBudgetMsP95,
  runSeconds: Number(runSec.toFixed(2)),
  summary: rows,
  failures,
  flags,
  depthFlags,
  results,
};
writeFileSync('reports/bots-latest.json', JSON.stringify(report, null, 2));

const n = (v: number | null): string => (v === null ? '-' : String(v));
const real = strategies.filter((s) => !s.stub);
const md = [
  `# Bot suite: ${failures.length ? 'FAIL' : 'PASS'}`,
  '',
  `Data version ${defaultData.dataVersion}, ${seeds} seeds × ${ticks} ticks (${fmtMin(ticks / defaultData.tickRate)}), tick budget p95 ≤ ${budgets.tickBudgetMsP95} ms. Bots run time ${runSec.toFixed(1)} s.`,
  'Every seed runs its own game (seeds 1, 2 and 3 are Glass Thicket, Twin Seams and Frost Gate). Ships built/lost and waves are as of the heart capture; the whole-run totals (to the tick cap) are in the JSON under `wholeRun`.',
  '',
  '| Strategy | Seed | Layout | Captured | Capture time | Capture order | Lost d / l / f (at capture) | Waves sent / repelled | Root cut | First ice / crystal | Built | Peak ore/min | Tick p50 / p95 (ms) |',
  '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
  ...real.flatMap((s) =>
    results
      .filter((r) => r.strategy === s.name)
      .map((r) => {
        const l = r.shipsLostByType;
        const order = r.captureOrder.map((c) => `${c.id} ${mmss(c.sec)}`).join(' > ');
        return `| ${s.name} | ${r.seed} | ${r.variantId} | ${r.outcome === 'won' ? 'yes' : r.outcome} | ${mmss(r.captureSec)} | ${order} | ${l.drone} / ${l.lancer} / ${l.flak} (${r.shipsLost}) | ${r.wavesSent} / ${r.wavesRepelled} | ${mmss(r.rootCutSec)} | ${mmss(r.firstDeliveredSec.ice)} / ${mmss(r.firstDeliveredSec.crystal)} | ${r.shipsBuilt} | ${r.peakPerMin} | ${r.tickMsP50.toFixed(4)} / ${r.tickMsP95.toFixed(4)} |`;
      }),
  ),
  '',
  '### Heart capture time per layout (lowest seed per layout; ships lost at capture in brackets)',
  '',
  `| Layout | Seed | ${H3_STRATEGIES.join(' | ')} |`,
  `| --- | --- | ${H3_STRATEGIES.map(() => '---').join(' | ')} |`,
  ...layoutRows(results).map((row) => `| ${row.variantName} | ${row.seed} | ${H3_STRATEGIES.map((s) => { const r = row.byStrategy[s]; return r ? `${mmss(r.captureSec)} (lost ${r.shipsLost})` : '-'; }).join(' | ')} |`),
  '',
  '### Depth flags (report lines, not gates)',
  '',
  ...depthFlags.map((f, i) => `${i + 1}. ${f.pass ? 'MET' : 'MISSED'}: ${f.name} (${f.detail})`),
  '',
  `Throughput (ore/min delivered by routes) at game minutes ${SAMPLE_MINUTES.join(', ')}:`,
  '',
  `| Strategy | ${SAMPLE_MINUTES.map((m) => `${m} min`).join(' | ')} |`,
  `| --- | ${SAMPLE_MINUTES.map(() => '---').join(' | ')} |`,
  ...real.flatMap((s) => {
    const r = first(s.name);
    return r ? [`| ${s.name} | ${SAMPLE_MINUTES.map((m) => n(r.throughputAtMin[String(m)] ?? null)).join(' | ')} |`] : [];
  }),
  '',
  strategies.some((s) => s.stub) ? `Stubs (no behavior, not reported): ${strategies.filter((s) => s.stub).map((s) => s.name).join(', ')}.` : '',
  '',
  `## Flags (tuning targets and captures, not gate failures)\n\n${flags.length ? flags.map((f) => `- ${f}`).join('\n') : 'None: every target is met.'}`,
  '',
  failures.length ? `## Failures\n\n${failures.map((f) => `- ${f}`).join('\n')}` : '',
].join('\n');
writeFileSync('reports/bots-latest.md', md);

console.log(md);
process.exit(failures.length ? 1 : 0);
