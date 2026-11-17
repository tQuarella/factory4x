// Scratch sweep for h9-design-data. Run from the worktree root:
//   npx tsx <this> "label:key=v,key=v" "label2:..."   (one seed; every seed is the same run)
// Prints one line per strategy per variant, with progress on stderr. Each run is capped by the runner (45 game min).
import { readFileSync } from 'node:fs';
const ROOT = process.cwd().replace(/\\/g, '/');
const sim = await import(`file:///${ROOT}/packages/sim/src/index.ts`);
const runner = await import(`file:///${ROOT}/packages/bots/src/field-runner.ts`);
const strats = await import(`file:///${ROOT}/packages/bots/src/field-strategies.ts`);
const NAMES = (process.env.STRATS ?? 'adaptive,adaptive-concentrate,greedy,undefended').split(',');
const T0 = Date.now();
for (const variant of process.argv.slice(2)) {
  const [label, kv] = variant.includes(':') ? variant.split(':') : [variant, ''];
  const raw = JSON.parse(readFileSync(`${ROOT}/data/sim.json`, 'utf8'));
  for (const pair of (kv ?? '').split(',').filter(Boolean)) {
    const [k, v] = pair.split('=');
    if (raw.tunables[k!] === undefined) throw new Error(`no key ${k}`);
    raw.tunables[k!].default = Number(v);
  }
  const data = sim.parseSimData(raw);
  const T = data.tickRate * 60;
  const mmss = (t: number) => `${Math.floor(t / T)}:${String(Math.floor((t % T) / data.tickRate)).padStart(2, '0')}`;
  let base = 0;
  for (const name of NAMES) {
    const s = strats.fieldStrategies.find((x: { name: string }) => x.name === name);
    const r = runner.runField(s, 1, data);
    if (name === 'adaptive') base = r.ticks;
    const byP: Record<number, number> = {};
    let firstSplit = '';
    for (const rr of r.raidLog) {
      byP[rr.prongs.length] = (byP[rr.prongs.length] ?? 0) + 1;
      if (rr.prongs.length > 1 && firstSplit === '') firstSplit = mmss(rr.startTick);
    }
    const pct = base > 0 && r.outcome === 'won' ? `${Math.round(((r.ticks - base) * 100) / base)}%` : '-';
    console.log(`${label.padEnd(14)} ${name.padEnd(21)} ${r.outcome.padEnd(7)} ${mmss(r.ticks).padStart(5)} ${pct.padStart(5)} | raids ${r.raids.mustered} byProng ${JSON.stringify(byP)} firstSplit ${firstSplit || '-'} | econLost ${r.econLost.extractor + r.econLost.hauler} peakEcon ${r.peakEcon} first ${r.raidLog[0] ? mmss(r.raidLog[0].startTick) : '-'} idleH ${r.idleHaulers.peak}/${r.idleHaulers.minutesOver1} guardedLoss ${r.econLostGuarded}`);
    console.error(`  [${((Date.now() - T0) / 1000).toFixed(0)} s] ${label} ${name} done`);
  }
}
