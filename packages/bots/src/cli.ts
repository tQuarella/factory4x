/**
 * Headless bot suite (replaces the "Bot runner" agent).
 * Plays every campaign strategy over several seeds, writes reports/bots-latest.{json,md},
 * and exits non-zero on crash, softlock or tick-budget overrun. Missing a
 * design tuning target is a flag in the report, never a failure.
 *
 * Usage: npm run bots [-- --seeds 3 --ticks 54000]
 *   --ticks is the per-visit cap in game ticks (the 30-minute visit cap); the campaign cap is 120 game minutes of play.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { defaultData, replayHashes } from '@factory4x/sim';
import budgets from '../../../scripts/gates/budgets.json' with { type: 'json' };
import { referenceReplay } from './reference-replay.ts';
import {
  AREA_TIME_TARGETS,
  CAMPAIGN_CAP_MIN,
  computeH4Flags,
  defaultRunOptions,
  meanAreaSeconds,
  mmss,
  reclaimVisit,
  runCampaign,
  runFlag4Probes,
  tickMmss,
  type CampaignResult,
} from './runner.ts';
import { strategies } from './strategies.ts';

function arg(name: string, fallback: number): number {
  const i = process.argv.indexOf(`--${name}`);
  const v = i >= 0 ? Number(process.argv[i + 1]) : NaN;
  return Number.isFinite(v) && v > 0 ? v : fallback;
}

const data = defaultData;
const tr = data.tickRate;
const seeds = arg('seeds', 3);
const visitCap = arg('ticks', budgets.botGameTicks);
const opts = defaultRunOptions(data, visitCap);
const started = performance.now();
const results: CampaignResult[] = [];
for (const s of strategies) for (let seed = 1; seed <= seeds; seed++) results.push(runCampaign(s, seed, data, opts));
const probes = runFlag4Probes(data, visitCap);
const runSec = (performance.now() - started) / 1000;

const failures: string[] = [];
const mins = (ticks: number | null): string => (ticks === null ? 'never' : `${(ticks / tr / 60).toFixed(1)} min`);

// Failures: crash, softlock, tick budget.
for (const s of strategies) {
  const rs = results.filter((r) => r.strategy === s.name);
  for (const r of rs) {
    if (r.outcome === 'crash') failures.push(`${s.name} seed ${r.seed}: crash (${(r.error ?? '').split('\n')[0]})`);
    if (r.outcome === 'softlock') failures.push(`${s.name} seed ${r.seed}: softlock (a second visit timeout or nothing to do, at ${mins(r.playTicks)} of play)`);
  }
  const p95 = Math.max(...rs.map((r) => r.tickMsP95));
  if (p95 > budgets.tickBudgetMsP95) failures.push(`${s.name}: tick p95 ${p95.toFixed(3)}ms exceeds budget ${budgets.tickBudgetMsP95}ms`);
}

// Flag 7: the reference replay hashed twice, and one campaign played twice, must match.
const { determinismTicks, determinismHashEvery } = budgets;
const ha = replayHashes(referenceReplay, data, determinismTicks, determinismHashEvery);
const hb = replayHashes(referenceReplay, data, determinismTicks, determinismHashEvery);
const replayOk = ha.length > 0 && ha.length === hb.length && ha.every((h, i) => h === hb[i]);
const probe = strategies.find((x) => x.name === 'greedy')!;
const g1 = results.find((r) => r.strategy === probe.name && r.seed === 1);
const gameOk = g1 !== undefined && runCampaign(probe, 1, data, opts).finalHash === g1.finalHash;
const flags = computeH4Flags(
  results,
  probes,
  data,
  seeds,
  replayOk && gameOk,
  `reference replay ${replayOk ? 'matches' : 'DIVERGES'} over ${determinismTicks} ticks; greedy seed 1 replayed ${gameOk ? 'to the same hash' : 'to a DIFFERENT hash'}`,
);

mkdirSync('reports', { recursive: true });
const report = {
  generatedAt: new Date().toISOString(),
  dataVersion: data.dataVersion,
  seeds,
  visitCapTicks: visitCap,
  campaignCapMinutes: CAMPAIGN_CAP_MIN,
  tickBudgetMsP95: budgets.tickBudgetMsP95,
  runSeconds: Number(runSec.toFixed(2)),
  failures,
  flags,
  flag4Probes: probes,
  results,
};
writeFileSync('reports/bots-latest.json', JSON.stringify(report, null, 2));

const areaIds = data.map.areas.map((a) => a.id);
const orderText = (r: CampaignResult): string => r.reclaimOrder.join(' > ');
const visitText = (r: CampaignResult): string =>
  r.visits.map((v) => `${v.area} ${tickMmss(v.playTicks, tr)}${v.result === 'withdrawn' ? ' (withdrawn)' : ''}`).join(' > ');
const openingText = (r: CampaignResult): string =>
  r.visits
    .filter((v) => v.result === 'reclaimed' && v.area !== 'landfall')
    .map((v) => `${v.area} ${v.openingTicks === null ? 'never' : tickMmss(v.openingTicks, tr)}`)
    .join(', ');
const researchText = (r: CampaignResult): string => r.research.map((b) => `${b.item}${b.level} ${tickMmss(b.playTicks, tr)}`).join(', ');
const triple = (t: { ore: number; ice: number; crystal: number }): string => `${t.ore}/${t.ice}/${t.crystal}`;

const md = [
  `# Bot suite: ${failures.length ? 'FAIL' : 'PASS'}`,
  '',
  `Data version ${data.dataVersion}, ${seeds} seeds, ${strategies.length} campaign strategies. Visit cap ${mins(visitCap)} (a second timeout in one area is a softlock), campaign cap ${CAMPAIGN_CAP_MIN} game minutes of play, tick budget p95 ≤ ${budgets.tickBudgetMsP95} ms. Bots run time ${runSec.toFixed(1)} s.`,
  'Times are game minutes of play (m:ss); the overworld is paused and costs none. A seed picks The Deep\'s layout (1 Glass Thicket, 2 Twin Seams, 3 Frost Gate). Opening time = ticks from landing until route deliveries reach 40 ore/min.',
  '',
  '## Per run',
  '',
  '| Strategy | Seed | Outcome | Play time | Area order | Visit times | Entries / withdrawals | Opening times | Research (play time) | Lost / built | Hauled vs shipped (o/i/c) | Shipped % | Skipped | Tick p50 / p95 (ms) |',
  '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
  ...results.map((r) => {
    const ent = areaIds.filter((id) => (r.entries[id] ?? 0) > 0).map((id) => `${id} ${r.entries[id]}/${r.withdrawals[id]}`).join(', ');
    return `| ${r.strategy} | ${r.seed} | ${r.outcome} | ${r.outcome === 'won' ? tickMmss(r.playTicks, tr) : `${tickMmss(r.playTicks, tr)} (not won)`} | ${orderText(r)} | ${visitText(r)} | ${ent} | ${openingText(r)} | ${researchText(r)} | ${r.shipsLost} / ${r.shipsBuilt} | ${triple(r.hauled)} vs ${triple(r.shipped)} | ${r.shippedSharePct}% | ${r.skipped.join(', ') || '-'} | ${r.tickMsP50.toFixed(4)} / ${r.tickMsP95.toFixed(4)} |`;
  }),
  '',
  '## Per-seed comparison (time to the core)',
  '',
  `| Seed | ${strategies.map((s) => s.name).join(' | ')} |`,
  `| --- | ${strategies.map(() => '---').join(' | ')} |`,
  ...Array.from({ length: seeds }, (_, i) => {
    const seed = i + 1;
    return `| ${seed} | ${strategies
      .map((s) => {
        const r = results.find((x) => x.strategy === s.name && x.seed === seed);
        return r ? (r.outcome === 'won' ? tickMmss(r.playTicks, tr) : `${r.outcome} ${tickMmss(r.playTicks, tr)}`) : '-';
      })
      .join(' | ')} |`;
  }),
  '',
  '## Area times (reclaiming visit; mean over every strategy and seed that reclaimed it, then per seed)',
  '',
  `| Area | Target | Mean | ${Array.from({ length: seeds }, (_, i) => `Seed ${i + 1}`).join(' | ')} |`,
  `| --- | --- | --- | ${Array.from({ length: seeds }, () => '---').join(' | ')} |`,
  ...areaIds.map((id) => {
    const [lo, hi] = AREA_TIME_TARGETS[id] ?? [0, 0];
    const perSeed = Array.from({ length: seeds }, (_, i) => {
      const m = meanAreaSeconds(results.filter((r) => r.seed === i + 1), id, tr);
      return m === null ? '-' : mmss(m);
    });
    const m = meanAreaSeconds(results, id, tr);
    return `| ${id} | ${mmss(lo)}-${mmss(hi)} | ${m === null ? '-' : mmss(m)} | ${perSeed.join(' | ')} |`;
  }),
  '',
  '## Visit times per run, by area (reclaiming visit)',
  '',
  `| Strategy | Seed | ${areaIds.join(' | ')} |`,
  `| --- | --- | ${areaIds.map(() => '---').join(' | ')} |`,
  ...results.map((r) => `| ${r.strategy} | ${r.seed} | ${areaIds.map((id) => { const v = reclaimVisit(r, id); return v ? tickMmss(v.playTicks, tr) : '-'; }).join(' | ')} |`),
  '',
  '## H4 flags (report lines, not gates)',
  '',
  ...flags.map((f, i) => `${i + 1}. ${f.pass ? 'MET' : 'MISSED'}: ${f.name}\n   - ${f.detail}`),
  '',
  `Flag 4 probe runs (seed 1, from Landfall + Frost Shelf + Glass Shoal reclaimed, opening 1, extraction 1): Veil flak ${tickMmss(probes.veilFlak, tr)}, Veil lancer ${tickMmss(probes.veilLancer, tr)}, Garden lancer ${tickMmss(probes.gardenLancer, tr)}, Garden flak ${tickMmss(probes.gardenFlak, tr)}.`,
  '',
  failures.length ? `## Failures\n\n${failures.map((f) => `- ${f}`).join('\n')}` : '',
].join('\n');
writeFileSync('reports/bots-latest.md', md);

console.log(md);
process.exit(failures.length ? 1 : 0);
