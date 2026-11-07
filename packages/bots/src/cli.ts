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
import { defaultData } from '@factory4x/sim';
import budgets from '../../../scripts/gates/budgets.json' with { type: 'json' };
import { SAMPLE_MINUTES, SOFTLOCK_SEC, VARIANT_IDS, computeDepthFlags, runSeeds, type GameResult } from './runner.ts';
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

// Flags: capture, the H1 targets that still apply, and the H2 depth flags (report lines, never gates).
const first = (name: string): GameResult | undefined => results.find((r) => r.strategy === name && r.seed === 1);
for (const s of strategies) {
  if (s.stub) continue;
  for (const r of results.filter((x) => x.strategy === s.name)) {
    if (r.captureSec === null) flags.push(`${s.name} seed ${r.seed} (${r.variantId}) never captured the rich node within ${fmtMin(ticks / defaultData.tickRate)}`);
  }
}
const turtle = first('turtle');
const rush = first('rush');
if (turtle) {
  if (turtle.wavesSent < 1 || turtle.wavesSent > 2) flags.push(`turtle sent ${turtle.wavesSent} waves (target 1-2)`);
  // "Still rising at minute 10" is measured as throughput at 12 min above throughput at 10 min (not plateaued).
  const t10 = turtle.throughputAtMin['10'];
  const t12 = turtle.throughputAtMin['12'];
  if (t10 == null || t12 == null || t12 <= t10) flags.push(`turtle throughput is not still rising at minute 10 (${t10 ?? 'n/a'}/min at 10 min, ${t12 ?? 'n/a'}/min at 12 min)`);
}
if (rush) {
  if (rush.firstWaveOutcome !== 'repelled') flags.push(`rush's first wave did not fail (outcome ${rush.firstWaveOutcome ?? 'no battle'})`);
  if (turtle && rush.captureSec !== null && turtle.captureSec !== null) {
    const later = rush.captureSec > turtle.captureSec;
    const lossy = rush.shipsLost >= 3 * turtle.shipsLost;
    if (!later && !lossy) flags.push(`rush neither captures later than turtle nor loses 3x the ships (${rush.shipsLost} vs ${turtle.shipsLost})`);
  }
}
const depthFlags = computeDepthFlags(results);
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
  'Every seed runs its own game (seeds 1, 2 and 3 are knotted, deep and thin). Ships built/lost and waves are as of capture; the whole-run totals (to the tick cap) are in the JSON under `wholeRun`.',
  '',
  '| Strategy | Seed | Variant | Captured | Capture time | Root cut | Lost (at capture) | Lost at Root | Thorns withered | Waves (Root / Bloom) | First ship | Built (at capture) | Repelled | Peak ore/min | Tick p50 / p95 (ms) |',
  '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
  ...real.flatMap((s) =>
    results
      .filter((r) => r.strategy === s.name)
      .map(
        (r) =>
          `| ${s.name} | ${r.seed} | ${r.variantId} | ${r.outcome === 'won' ? 'yes' : r.outcome} | ${fmtMin(r.captureSec)} | ${r.rootCutSec === null ? 'never' : fmtMin(r.rootCutSec)} | ${r.shipsLost} | ${r.rootShipsLost} | ${r.thornsWithered} | ${r.rootWavesSent} / ${r.bloomWavesSent} | ${r.firstShipSec === null ? 'never' : `${r.firstShipSec} s`} | ${r.shipsBuilt} | ${r.wavesRepelled} | ${r.peakPerMin} | ${r.tickMsP50.toFixed(4)} / ${r.tickMsP95.toFixed(4)} |`,
      ),
  ),
  '',
  '### Per variant: turtle vs raid-supply (first seed of each variant; ships lost as of capture)',
  '',
  '| Variant | turtle capture | turtle lost | raid-supply capture | raid-supply lost | raid-supply Root cut | Faster |',
  '| --- | --- | --- | --- | --- | --- | --- |',
  ...VARIANT_IDS.map((id) => {
    const t = results.find((r) => r.strategy === 'turtle' && r.variantId === id);
    const r = results.find((x) => x.strategy === 'raid-supply' && x.variantId === id);
    const faster = !t || !r || t.captureSec === null || r.captureSec === null ? '-' : t.captureSec === r.captureSec ? 'tie' : t.captureSec < r.captureSec ? `turtle by ${r.captureSec - t.captureSec} s` : `raid-supply by ${t.captureSec - r.captureSec} s`;
    return `| ${id} | ${t ? fmtMin(t.captureSec) : '-'} | ${t?.shipsLost ?? '-'} | ${r ? fmtMin(r.captureSec) : '-'} | ${r?.shipsLost ?? '-'} | ${r?.rootCutSec == null ? '-' : fmtMin(r.rootCutSec)} | ${faster} |`;
  }),
  '',
  '### H2 depth flags (report lines, not gates)',
  '',
  ...depthFlags.map((f) => `- ${f.pass ? 'MET' : 'MISSED'}: ${f.name} (${f.detail})`),
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
  `Stubs (no behavior, not reported): ${strategies.filter((s) => s.stub).map((s) => s.name).join(', ')}.`,
  '',
  `## Flags (tuning targets and captures, not gate failures)\n\n${flags.length ? flags.map((f) => `- ${f}`).join('\n') : 'None: every target is met.'}`,
  '',
  failures.length ? `## Failures\n\n${failures.map((f) => `- ${f}`).join('\n')}` : '',
].join('\n');
writeFileSync('reports/bots-latest.md', md);

console.log(md);
process.exit(failures.length ? 1 : 0);
