/**
 * Headless bot suite (replaces the "Bot runner" agent).
 * Plays every H5 campaign strategy over several seeds, runs the minimum-wave probe, writes
 * reports/bots-latest.{json,md}, and exits non-zero on a crash, a tick-budget overrun, or a softlock of a
 * strategy meant to win (composer, ice-first, crystal-first). `drones-only` and `no-command` are expected to
 * stall and are reported, not gated. Missing an H5 flag is a report line, never a failure.
 *
 * Usage: npm run bots [-- --seeds 3 --ticks 54000 --out reports/bots-latest]
 *   --ticks is the per-visit cap in game ticks (the 30-minute visit cap); the campaign cap is 120 game minutes of play.
 *   --out is the report path without extension (default reports/bots-latest).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { performance } from 'node:perf_hooks';
import { defaultData, replayHashes } from '@factory4x/sim';
import budgets from '../../../scripts/gates/budgets.json' with { type: 'json' };
import { referenceReplay } from './reference-replay.ts';
import { CAMPAIGN_CAP_MIN, computeH5Flags, defaultRunOptions, lancerSharePct, reclaimVisit, runCampaign, tickMmss, type CampaignResult } from './runner.ts';
import { WINNING_STRATEGIES, strategies } from './strategies.ts';
import { closedAt, fitsAt, probeAll, probeLimits, windowChecks, type HeartProbe } from './waves.ts';

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
const visitCap = arg('ticks', budgets.botGameTicks);
const outBase = argStr('out', 'reports/bots-latest');
const opts = defaultRunOptions(data, visitCap);
const limits = probeLimits(data);
const started = performance.now();
const results: CampaignResult[] = [];
for (const s of strategies) {
  for (let seed = 1; seed <= seeds; seed++) {
    const r = runCampaign(s, seed, data, opts);
    results.push(r);
    console.error(`run ${s.name} seed ${seed}: ${r.outcome} at ${tickMmss(r.playTicks, tr)} (${((performance.now() - started) / 1000).toFixed(1)} s)`);
  }
}
const runSec = (performance.now() - started) / 1000;
const probeStarted = performance.now();
const probe: HeartProbe[] = probeAll(data, seeds, (row) =>
  console.error(`probe ${row.area}${row.layout ? `/${row.layout}` : ''} ${row.state}: d/l/f ${row.drones ?? '>80'}/${row.lancers ?? '>80'}/${row.flak ?? '>80'}, mix ${row.mix ?? 'none'} (${((performance.now() - probeStarted) / 1000).toFixed(1)} s)`),
);
const probeSec = (performance.now() - probeStarted) / 1000;

const failures: string[] = [];
const mins = (ticks: number | null): string => (ticks === null ? 'never' : `${(ticks / tr / 60).toFixed(1)} min`);

// Failures: crash and tick budget for every strategy; softlock only for the strategies meant to win.
for (const s of strategies) {
  const rs = results.filter((r) => r.strategy === s.name);
  for (const r of rs) {
    if (r.outcome === 'crash') failures.push(`${s.name} seed ${r.seed}: crash (${(r.error ?? '').split('\n')[0]})`);
    if (r.outcome === 'softlock' && WINNING_STRATEGIES.includes(s.name)) {
      failures.push(`${s.name} seed ${r.seed}: softlock (a second visit timeout or nothing to do, at ${mins(r.playTicks)} of play)`);
    }
  }
  const p95 = Math.max(...rs.map((r) => r.tickMsP95));
  if (p95 > budgets.tickBudgetMsP95) failures.push(`${s.name}: tick p95 ${p95.toFixed(3)}ms exceeds budget ${budgets.tickBudgetMsP95}ms`);
}

// Flag 7: the reference replay hashed twice, and one campaign played twice, must match.
const { determinismTicks, determinismHashEvery } = budgets;
const ha = replayHashes(referenceReplay, data, determinismTicks, determinismHashEvery);
const hb = replayHashes(referenceReplay, data, determinismTicks, determinismHashEvery);
const replayOk = ha.length > 0 && ha.length === hb.length && ha.every((h, i) => h === hb[i]);
const probeStrategy = strategies.find((x) => x.name === 'composer')!;
const c1 = results.find((r) => r.strategy === probeStrategy.name && r.seed === 1);
const gameOk = c1 !== undefined && runCampaign(probeStrategy, 1, data, opts).finalHash === c1.finalHash;
const tiers = Object.fromEntries(data.map.areas.map((a) => [a.id, a.tier]));
const flags = computeH5Flags(
  results,
  probe,
  { tickRate: tr, tiers, limits, seeds },
  replayOk && gameOk,
  `reference replay ${replayOk ? 'matches' : 'DIVERGES'} over ${determinismTicks} ticks; composer seed 1 replayed ${gameOk ? 'to the same hash' : 'to a DIFFERENT hash'}`,
);

mkdirSync(dirname(outBase), { recursive: true });
const report = {
  generatedAt: new Date().toISOString(),
  dataVersion: data.dataVersion,
  seeds,
  visitCapTicks: visitCap,
  campaignCapMinutes: CAMPAIGN_CAP_MIN,
  tickBudgetMsP95: budgets.tickBudgetMsP95,
  runSeconds: Number(runSec.toFixed(2)),
  probeSeconds: Number(probeSec.toFixed(2)),
  limits,
  failures,
  flags,
  probe,
  results,
};
writeFileSync(`${outBase}.json`, JSON.stringify(report, null, 2));

const areaIds = data.map.areas.map((a) => a.id);
const orderText = (r: CampaignResult): string => r.reclaimOrder.join(' > ') || '-';
const visitText = (r: CampaignResult): string =>
  r.visits.map((v) => `${v.area} ${tickMmss(v.playTicks, tr)}${v.result === 'withdrawn' ? (v.closed ? ' (closed)' : ' (timeout)') : ''}${v.forced ? ' (forced)' : ''}`).join(' > ') || '-';
const commandText = (r: CampaignResult): string => r.research.filter((b) => b.item === 'fleet').map((b) => `${b.level} ${tickMmss(b.playTicks, tr)}`).join(', ') || 'none';
const researchText = (r: CampaignResult): string => r.research.map((b) => `${b.item}${b.level} ${tickMmss(b.playTicks, tr)}`).join(', ') || '-';
const rootText = (r: CampaignResult): string =>
  r.visits.filter((v) => v.rootCutBeforeHeart !== null).map((v) => `${v.area} ${v.rootCutBeforeHeart ? 'yes' : 'no'}`).join(', ') || '-';
const waveText = (r: CampaignResult): string =>
  r.visits.filter((v) => v.wave !== null && v.area !== 'landfall').map((v) => `${v.area} ${v.wave!.drone}d/${v.wave!.lancer}l/${v.wave!.flak}f`).join(', ') || '-';
const triple = (t: { ore: number; ice: number; crystal: number }): string => `${t.ore}/${t.ice}/${t.crystal}`;
const n = (v: number | null): string => (v === null ? '>80' : String(v));

const probeLabel = (r: HeartProbe): string => `${r.area}${r.layout ? ` (${r.layout})` : ''}`;
const md = [
  `# Bot suite: ${failures.length ? 'FAIL' : 'PASS'}`,
  '',
  `Data version ${data.dataVersion}, ${seeds} seeds, ${strategies.length} strategies (${strategies.map((s) => s.name).join(', ')}). Visit cap ${mins(visitCap)} (a second timeout in one area is a softlock), campaign cap ${CAMPAIGN_CAP_MIN} game minutes of play, tick budget p95 ≤ ${budgets.tickBudgetMsP95} ms. Campaigns ${runSec.toFixed(1)} s, probe ${probeSec.toFixed(1)} s.`,
  "Times are game minutes of play (m:ss); the overworld is paused and costs none. A seed picks The Deep's layout (1 Glass Thicket, 2 Twin Seams, 3 Frost Gate). `greedy` is the cap-off reference (fleet.cap 0, the H3 engine). Gated for softlock: " + WINNING_STRATEGIES.join(', ') + '; `drones-only` and `no-command` are expected to stall and are reported only.',
  '',
  '## Per run',
  '',
  '| Strategy | Seed | Outcome | Play time | Area order | Visits (closed = withdrawn when nothing passes the attack test, timeout = visit cap) | Command limit bought | Root cut before heart | Capturing wave per heart (d/l/f) | Built / lost / recycled | Research (play time) | Hauled vs shipped (o/i/c) | Skipped | Tick p50 / p95 (ms) |',
  '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
  ...results.map(
    (r) =>
      `| ${r.strategy} | ${r.seed} | ${r.outcome} | ${r.outcome === 'won' ? tickMmss(r.playTicks, tr) : `${tickMmss(r.playTicks, tr)} (not won)`} | ${orderText(r)} | ${visitText(r)} | ${commandText(r)} | ${rootText(r)} | ${waveText(r)} | ${r.shipsBuilt} / ${r.shipsLost} / ${r.shipsRecycled} | ${researchText(r)} | ${triple(r.hauled)} vs ${triple(r.shipped)} | ${r.skipped.join(', ') || '-'} | ${r.tickMsP50.toFixed(4)} / ${r.tickMsP95.toFixed(4)} |`,
  ),
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
        return r ? (r.outcome === 'won' ? tickMmss(r.playTicks, tr) : `${r.outcome} ${tickMmss(r.playTicks, tr)} (${r.reclaimOrder.length} areas)`) : '-';
      })
      .join(' | ')} |`;
  }),
  '',
  '## Visit times per run, by area (reclaiming visit)',
  '',
  `| Strategy | Seed | ${areaIds.join(' | ')} |`,
  `| --- | --- | ${areaIds.map(() => '---').join(' | ')} |`,
  ...results.map(
    (r) =>
      `| ${r.strategy} | ${r.seed} | ${areaIds
        .map((id) => {
          const v = reclaimVisit(r, id);
          return v ? tickMmss(v.playTicks, tr) : '-';
        })
        .join(' | ')} |`,
  ),
  '',
  '## Probe: minimum winning waves per heart',
  '',
  `Limits at the shipped tunables: L0 ${limits.l0}, L1 ${limits.l1}, L2 ${limits.l2}. d / l / f are the smallest single-type waves that capture the heart from full strength (">80" = none within 80 ships). Mix is the smallest winning total over the locally buildable types (search cap L2 + 6 = ${limits.l2 + 6}), with one such fleet (fewest drones, then fewest lancers). "Fits at L" means mix ≤ L − 2; "closed at L" means mix > L; "tight" is between (L − 2 < mix ≤ L). Starved = Root cut; areas without a Root have only a fed row. The Deep is probed per seed (its layout).`,
  '',
  '| Heart | State | Tier | Buildable | d | l | f | Mix | Mix fleet (d/l/f) | Lancer share | Best mix at L0 / L1 / L2 | Windows (met / missed) |',
  '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
  ...probe.map((r) => {
    const w = windowChecks(r, limits).map((c) => `${c.met ? 'MET' : 'MISSED'}: ${c.name}`).join('; ');
    const fleet = r.mixFleet ? `${r.mixFleet.drone}/${r.mixFleet.lancer}/${r.mixFleet.flak}` : '-';
    const share = lancerSharePct(r);
    return `| ${probeLabel(r)} | ${r.state} | ${r.tier} | ${r.buildable.join(', ')} | ${n(r.drones)} | ${n(r.lancers)} | ${n(r.flak)} | ${r.mix ?? 'none'} | ${fleet} | ${share === null ? '-' : `${share}%`} | ${[limits.l0, limits.l1, limits.l2].map((l) => (fitsAt(r.mix, l) ? 'fits' : closedAt(r.mix, l) ? 'closed' : 'tight')).join(' / ')} | ${w} |`;
  }),
  '',
  '## H5 flags (report lines, not gates)',
  '',
  'Flags 2 and 5 include strategy halves (drones-only, no-command) that pass vacuously when a strategy never leaves tier 1; the details print the area orders.',
  '',
  ...flags.map((f, i) => `${i + 1}. ${f.pass ? 'MET' : 'MISSED'}: ${f.name}\n   - ${f.detail}`),
  '',
  failures.length ? `## Failures\n\n${failures.map((f) => `- ${f}`).join('\n')}` : '',
].join('\n');
writeFileSync(`${outBase}.md`, md);

console.log(md);
process.exit(failures.length ? 1 : 0);
