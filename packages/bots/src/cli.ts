/**
 * Headless bot suite for H7 (DESIGN.md "Bots (H7): strategies"): plays the six field strategies over several seeds,
 * computes the seven capability flags, writes reports/bots-latest.{json,md}, and exits non-zero on exactly: a crash
 * of any strategy, a tick p95 over budget, or a softlock or timeout of `adaptive` or `greedy` on any seed. Flags
 * are report lines and never fail the gate. The H6 campaign suite is retired from the gate (campaign-cli.ts).
 *
 * Usage: npm run bots [-- --seeds 3 --out reports/bots-latest]
 *   --out is the report path without extension (default reports/bots-latest).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { performance } from 'node:perf_hooks';
import { BUILD_TYPES, defaultData } from '@factory4x/sim';
import budgets from '../../../scripts/gates/budgets.json' with { type: 'json' };
import { computeFieldFlags, computeH9Lines, prongSummary, slowerPct } from './field-flags.ts';
import { FIELD_CAP_MIN, SOFTLOCK_MIN, fieldGateFailures, gateRuns, runField, tickMmss, type FieldResult } from './field-runner.ts';
import { FIELD_WINNERS, STATIC_SHAPES, fieldStrategies, staticStrategy } from './field-strategies.ts';

function arg(name: string, fallback: number): number {
  const i = process.argv.indexOf(`--${name}`);
  const v = i >= 0 ? Number(process.argv[i + 1]) : NaN;
  return Number.isFinite(v) && v > 0 ? v : fallback;
}
function argStr(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1]! : fallback;
}

const data = defaultData;
const tr = data.tickRate;
const seeds = arg('seeds', 3);
const outBase = argStr('out', 'reports/bots-latest');
const started = performance.now();
const log = (r: FieldResult): void => console.error(`run ${r.strategy}${r.variant === null ? '' : ` [${r.variant}]`} seed ${r.seed}: ${r.outcome} at ${tickMmss(r.ticks, tr)} (${((performance.now() - started) / 1000).toFixed(1)} s)`);

/** `static` is the best of its sweep per seed: a win beats no win, then the earlier hive, then the fewer economy ships lost. */
function bestOf(runs: FieldResult[]): FieldResult {
  const lost = (r: FieldResult): number => r.econLost.extractor + r.econLost.hauler;
  return [...runs].sort((a, b) => {
    if ((a.outcome === 'won') !== (b.outcome === 'won')) return a.outcome === 'won' ? -1 : 1;
    if (a.outcome === 'won') return (a.hiveTick ?? 0) - (b.hiveTick ?? 0);
    return lost(a) - lost(b);
  })[0]!;
}

const results: FieldResult[] = [];
const sweep: FieldResult[] = [];
for (const s of fieldStrategies) {
  for (let seed = 1; seed <= seeds; seed++) {
    const r = runField(s, seed, data);
    results.push(r);
    log(r);
  }
}
for (let seed = 1; seed <= seeds; seed++) {
  const runs = STATIC_SHAPES.map((shape) => runField(staticStrategy(shape), seed, data, undefined, shape.name));
  for (const r of runs) log(r);
  sweep.push(...runs);
  results.push(bestOf(runs));
}
const runSec = (performance.now() - started) / 1000;
const flags = computeFieldFlags(results, data);
const h9Lines = computeH9Lines(results);
const names = ['adaptive', 'greedy', 'static', 'idle', 'drones-only', 'adaptive-no-raids', 'adaptive-concentrate', 'undefended'];
const failures = fieldGateFailures(gateRuns(results, sweep), FIELD_WINNERS, names, budgets.tickBudgetMsP95, tr);

mkdirSync(dirname(outBase), { recursive: true });
writeFileSync(
  `${outBase}.json`,
  JSON.stringify({ generatedAt: new Date().toISOString(), dataVersion: data.dataVersion, seeds, capMinutes: FIELD_CAP_MIN, softlockMinutes: SOFTLOCK_MIN, tickBudgetMsP95: budgets.tickBudgetMsP95, runSeconds: Number(runSec.toFixed(2)), failures, flags, h9Lines, staticSweep: STATIC_SHAPES, results, sweep }, null, 2),
);

const t = (r: FieldResult): string => (r.outcome === 'won' ? tickMmss(r.hiveTick, tr) : `${r.outcome} ${tickMmss(r.ticks, tr)}`);
const raidsText = (r: FieldResult): string => `${r.raids.mustered} mustered: ${r.raids.beaten} beaten / ${r.raids.hit} hit / ${r.raids.turnedBack} turned back`;
const builtText = (r: FieldResult): string => `${r.built.extractor}e ${r.built.hauler}h ${r.built.drone}d ${r.built.lancer}l ${r.built.flak}f`;
const row = (r: FieldResult): string =>
  `| ${r.strategy}${r.variant === null ? '' : ` (${r.variant})`} | ${r.seed} | ${t(r)} | ${raidsText(r)} | ${r.econLost.extractor + r.econLost.hauler} (${r.econLost.extractor}e ${r.econLost.hauler}h) | ${r.peakEcon} | ${r.allocChanges} | ${builtText(r)} | ${r.tickMsP50.toFixed(4)} / ${r.tickMsP95.toFixed(4)} |`;
const head = ['| Strategy | Seed | Time to the hive | Raids by outcome | Economy ships lost | Peak economy | Allocation changes | Ships built (e/h/d/l/f) | Tick p50 / p95 (ms) |', '| --- | --- | --- | --- | --- | --- | --- | --- | --- |'];

const md = [
  `# Bot suite: ${failures.length ? 'FAIL' : 'PASS'}`,
  '',
  `Data version ${data.dataVersion}, ${seeds} seeds, field mode, ${names.length} strategies (${names.join(', ')}). Cap ${FIELD_CAP_MIN} game minutes, softlock after ${SOFTLOCK_MIN} minutes with no ship start and no delivery, tick budget p95 ≤ ${budgets.tickBudgetMsP95} ms. Runs ${runSec.toFixed(1)} s. Times are game minutes (m:ss). Gated for softlock and timeout: ${FIELD_WINNERS.join(', ')}; the others are controls and are reported only.`,
  '',
  '## Failures',
  '',
  failures.length ? failures.map((f) => `- ${f}`).join('\n') : 'None.',
  '',
  '## Per run',
  '',
  ...head,
  ...results.map(row),
  '',
  '## The static sweep (the best shape per seed is the `static` row above: a win, then the earlier hive, then the fewer economy ships lost)',
  '',
  `Shapes (extractor / hauler / drone / lancer / flak weights): ${STATIC_SHAPES.map((s) => s.name).join('; ')}.`,
  '',
  ...head,
  ...sweep.map(row),
  '',
  '## Staffing and the shield (H8)',
  '',
  'Per run: idle haulers at the probe (peak, and game minutes with more than 1 idle outside raids); backed-up seconds per rock while its hauler target was met (total, with the longest run in brackets); economy ships lost in a tick that began with a warship at the raid target (must be 0: raid.shieldEcon is 1 and h8-raids is merged); the longest run with ore for the dearest unlocked warship in stock, room under the fleet limit and no bay running (the no-idle measure).',
  '',
  '| Strategy | Seed | Idle haulers peak | Minutes with more than 1 idle | Backed up with target met (s, longest) | Economy lost under a guard | Longest idle with ore (min) |',
  '| --- | --- | --- | --- | --- | --- | --- |',
  ...results.map((r) => {
    const bu = Object.entries(r.backedUp).map(([id, b]) => `${id} ${b.seconds.toFixed(0)} (${b.longest.toFixed(0)})`).join(', ');
    return `| ${r.strategy}${r.variant === null ? '' : ` (${r.variant})`} | ${r.seed} | ${r.idleHaulers.peak} | ${r.idleHaulers.minutesOver1} | ${bu === '' ? 'none' : bu} | ${r.econLostGuarded} | ${r.idleWithOreMin} |`;
  }),
  '',
  '## Trace at 15, 30 and 45 game minutes (seed 1)',
  '',
  'Economy alive (extractors / haulers), warships alive (drones / lancers / flak), ore in stock, the weights (e/h/d/l/f) and the bays running. A run that ended earlier has fewer rows.',
  '',
  '| Strategy | Minute | Extractors / haulers | Warships d/l/f | Stock ore | Weights e/h/d/l/f | Bays running |',
  '| --- | --- | --- | --- | --- | --- | --- |',
  ...results
    .filter((r) => r.seed === 1)
    .flatMap((r) => r.trace.map((x) => `| ${r.strategy}${r.variant === null ? '' : ` (${r.variant})`} | ${x.minute} | ${x.extractors} / ${x.haulers} | ${x.warships.drone}/${x.warships.lancer}/${x.warships.flak} | ${x.stockOre} | ${BUILD_TYPES.map((t) => x.weights[t]).join('/')} | ${x.bayRunning.join(', ') || 'none'} |`)),
  '',
  '## Prongs (H9)',
  '',
  'Per run: raids by prong count (a raid that did not split is 1 prong), prongs by outcome (`stats.raidProngs`: beaten / hit / turned back), economy ships lost per prong target (the rock the prong went to, from `lastRaid.prongs`), and the win time against `adaptive` on the same seed (+12% is 12% slower; "-" when either did not win).',
  '',
  '| Strategy | Seed | Raids by prong count | Prongs beaten / hit / turned back | Economy ships lost per prong target | Win time against adaptive |',
  '| --- | --- | --- | --- | --- | --- |',
  ...results.map((r) => {
    const ps = prongSummary(r);
    const counts = Object.keys(ps.byCount).map(Number).sort((a, b) => a - b).map((k) => `${k}: ${ps.byCount[k]}`).join(', ');
    const lost = Object.keys(ps.lostByTarget).sort().map((k) => `${k} ${ps.lostByTarget[k]}`).join(', ');
    const pct = r.strategy === 'adaptive' ? 'base' : slowerPct(results, r.strategy, r.seed);
    return `| ${r.strategy}${r.variant === null ? '' : ` (${r.variant})`} | ${r.seed} | ${counts || 'none'} | ${r.raidProngs.beaten} / ${r.raidProngs.hit} / ${r.raidProngs.turnedBack} | ${lost || 'none'} | ${pct === null ? '-' : typeof pct === 'string' ? pct : `${pct >= 0 ? '+' : ''}${pct}%`} |`;
  }),
  '',
  '## What no bot exercises',
  '',
  'Bots stay on Auto haulers and use only `sendShips` and `recycleShips` (and the weights and the rally). No bot uses: `setExtractors` (they stay on All), the drag gesture (a client gesture), `setHaulers`, `moveShips`, `recycleFleet`, or Mine mode (a client mode; the bots never send `setMine` and play with the marks the map starts with). Sim tests and the reference replay cover `setExtractors`, `setHaulers`, `moveShips` and `recycleFleet`; h8-client smoke tests cover the drag and Mine mode.',
  '',
  '## H7 capability flags (report lines, not gates)',
  '',
  ...flags.map((f, i) => `${i + 1}. ${f.pass ? 'MET' : 'MISSED'}: ${f.name}\n   - ${f.detail}`),
  '',
  '## H9 report lines (not gate flags until h9-design-data says they hold)',
  '',
  'Calibration targets 4 and 5. Greedy plays adaptive after its first hit, so its half of target 5 may move to `undefended` (Director ruling, DECISIONS.md).',
  '',
  ...h9Lines.map((f, i) => `${i + 1}. ${f.pass ? 'MET' : 'MISSED'}: ${f.name}\n   - ${f.detail}`),
  '',
].join('\n');
writeFileSync(`${outBase}.md`, md);

console.log(md);
process.exit(failures.length ? 1 : 0);
