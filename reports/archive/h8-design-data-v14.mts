// h8-design-data probe and order check (the shipped v14 result). Run from the repo root: npx tsx reports/archive/h8-design-data-v14.mts [key=value | guards.<node>=T/S ...]
// It reads data/sim.json, applies the overrides, and prints the Designer probe section of the h8 reports.
// Prints a markdown section; bounded (each fight is capped, each run uses the runner's 45-minute cap).
import { readFileSync } from 'node:fs';
const ROOT = process.cwd().replace(/\\/g, '/');
const sim = await import(`file:///${ROOT}/packages/sim/src/index.ts`);
const fac = await import(`file:///${ROOT}/packages/sim/src/factions/index.ts`);
const fieldMod = await import(`file:///${ROOT}/packages/sim/src/field.ts`);
const runner = await import(`file:///${ROOT}/packages/bots/src/field-runner.ts`);
const strats = await import(`file:///${ROOT}/packages/bots/src/field-strategies.ts`);
const est = await import(`file:///${ROOT}/packages/bots/src/field-estimate.ts`);

const raw = JSON.parse(readFileSync(`${ROOT}/data/sim.json`, 'utf8'));
for (const arg of process.argv.slice(2)) {
  const [k, v] = arg.split('=');
  if (k!.startsWith('guards.')) {
    // guards.heart=12/18 or guards.p1=0/4
    const [t, s] = v!.split('/').map(Number);
    const node = k!.slice(7);
    const lay = raw.map.field.layout;
    const tgt = node === 'heart' ? lay.heart : lay.pockets[node];
    tgt.thorns = t; tgt.spores = s;
  } else raw.tunables[k!].default = Number(v);
}
const data = sim.parseSimData(raw);
const out: string[] = [];
const log = (s: string) => { out.push(s); console.error(s); };
const T = data.tickRate * 60;
const mmss = (t: number) => `${Math.floor(t / T)}:${String(Math.floor((t % T) / data.tickRate)).padStart(2, '0')}`;
const F = { probe: 0, a1: 1, a2: 2, a3: 3, a4: 4, a5: 5, a6: 6, a7: 7, p1: 8, p2: 9, heart: 10 };

log(`### Probe (dataVersion ${data.dataVersion}; overrides: ${process.argv.slice(2).join(' ') || 'none'})`);

// 1. The winners: time to the hive and the first raid.
for (const name of (process.env.QUICK ? [] : ['adaptive', 'greedy'])) {
  const s = strats.fieldStrategies.find((x: { name: string }) => x.name === name);
  const r = runner.runField(s, 1, data);
  const first = r.raidLog[0];
  log(`- ${name}: ${r.outcome} at ${mmss(r.ticks)}; first raid musters at ${first ? mmss(first.startTick) + ` (tick ${first.startTick}, ${first.planned.thorn}T ${first.planned.spore}S)` : 'never'}; raids ${r.raids.mustered} (${r.raids.beaten} beaten / ${r.raids.hit} hit / ${r.raids.turnedBack} turned back); economy lost ${r.econLost.extractor}e ${r.econLost.hauler}h; peak haulers ${r.peakHaulers}`);
}

// 2. Need table on a full field (every asteroid slot docked).
function quiet() {
  const w = sim.createWorld(1, data);
  const f = w.field;
  w.stock.ore = 0;
  w.tun['economy.probeOrePerMin'] = 0;
  for (const t of sim.BUILD_TYPES) { f.alloc[t] = 0; f.share[t] = 0; }
  f.mine = f.mine.map(() => false);
  f.econ = [];
  return w;
}
function addEcon(w: any, type: string, at: number, target: number | null) {
  const s = { id: w.nextId++, type, hp: w.tun[`ship.${type}.hp`], at, transit: null, target, cargo: 0, cargoRes: null };
  w.field.econ.push(s);
  return s;
}
{
  const w = quiet();
  let slots = 0;
  for (const n of w.nodes) if (n.kind === 'asteroid' && w.field.mine !== undefined && data.map.field.mine.includes(n.id)) {
    w.field.mine[n.index] = true;
    for (let i = 0; i < n.slots; i++) addEcon(w, 'extractor', n.index, n.index);
    slots += n.slots;
  }
  fieldMod.syncExtractors(w);
  const needs = w.nodes.filter((n: any) => w.field.mine[n.index]).map((n: any) => `${n.id} ${sim.rockStatus(w, n.index).haulerNeed}`);
  const sum = w.nodes.filter((n: any) => w.field.mine[n.index]).reduce((a: number, n: any) => a + sim.rockStatus(w, n.index).haulerNeed, 0);
  log(`- Hauler need on a full field (${slots} extractors): ${needs.join(', ')}; total ${sum}. Full economy ${slots + sum}, so its raid is ${fac.raidSize(w, slots + sum, sim.guardianAt(w, F.heart))}.`);
}

let RAID: { thorn: number; spore: number } = { thorn: 0, spore: 0 };
const FIGHTS: [string, { drone: number; lancer: number; flak: number }][] = [];
// 3. Raid fights at a5 with a full a5 (3 extractors docked, 3 haulers there), raid launched from the hive.
function fight(raidC: { thorn: number; spore: number }, def: { drone: number; lancer: number; flak: number }, haulersAt: 'node' | 'probe', rev = false) {
  const w = quiet();
  w.tun['raid.enabled'] = 1;
  w.field.mine[F.a5] = true;
  for (let i = 0; i < 3; i++) addEcon(w, 'extractor', F.a5, F.a5);
  for (let i = 0; i < 3; i++) addEcon(w, 'hauler', haulersAt === 'node' ? F.a5 : F.probe, F.a5);
  fieldMod.syncExtractors(w);
  for (const type of (rev ? [...sim.SHIP_TYPES].reverse() : sim.SHIP_TYPES)) for (let i = 0; i < (def as any)[type]; i++) w.ships.push({ id: w.nextId++, type, hp: w.tun[`ship.${type}.hp`], at: F.a5, transit: null, engagedIn: -1 });
  const h = sim.guardianAt(w, F.heart);
  const need = { ...raidC };
  const taken: any[] = [];
  for (const g of (rev ? [...h.guards].reverse() : h.guards)) if ((need as any)[g.type] > 0) { (need as any)[g.type]--; taken.push(g); }
  h.guards = h.guards.filter((g: any) => !taken.includes(g));
  if (rev) taken.reverse();
  const flight = Math.ceil(sim.nodeDistance(w, F.heart, F.a5) / w.tun['raid.speedSu']);
  w.raid = { id: 1, phase: 'out', target: F.a5, guards: taken, ticksLeft: flight, planned: { ...raidC }, flightTicks: flight, from: F.heart, retargeted: false, lostEcon: { extractor: 0, hauler: 0 }, lostShips: { drone: 0, lancer: 0, flak: 0 }, killed: { thorn: 0, spore: 0 } };
  w.nextRaidTick = 1e9;
  const shipsBefore = w.ships.length;
  let guard = 0;
  while (w.raid !== null && guard++ < 20000) sim.step(w, data, []);
  const r = w.stats;
  return { lostShips: shipsBefore - w.ships.length, lostE: r.econLost.extractor, lostH: r.econLost.hauler, beaten: r.raids.beaten, hit: r.raids.hit, ended: w.raid === null };
}
{
  const w0 = quiet();
  const hv = sim.guardianAt(w0, F.heart);
  const fullEcon = 13 + Number(process.env.HAULERS ?? 11);
  const raidC = fac.raidMix(fac.raidSize(w0, fullEcon, hv), sim.countGuards(hv));
  const size = raidC.thorn + raidC.spore;
  log(`- The full-economy raid (econ ${fullEcon}): ${raidC.thorn}T ${raidC.spore}S (${size}). Fights at a5 (3 extractors docked, 3 haulers there at launch):`);
  const u = fight(raidC, { drone: 0, lancer: 0, flak: 0 }, 'node');
  RAID = raidC;
  FIGHTS.push(['undefended', { drone: 0, lancer: 0, flak: 0 }]);
  log(`  - undefended: ${u.beaten ? 'beaten' : u.hit ? 'hit' : 'turned back'}, killed ${u.lostE} extractors and ${u.lostH} haulers`);
  // Smallest matched defence (lancers + flak) that beats it losing <= 2.
  let best: string | null = null;
  const rows: string[] = [];
  for (let n = 1; n <= size && best === null; n++) {
    for (let l = 0; l <= n; l++) {
      const f = n - l;
      const r = fight(raidC, { drone: 0, lancer: l, flak: f }, 'node');
      if (r.beaten && r.lostShips <= 2) { FIGHTS.push([`${l}L+${f}F`, { drone: 0, lancer: l, flak: f }]); best = `${l} lancers + ${f} flak (${n}) beat it losing ${r.lostShips} warships, economy lost ${r.lostE}e ${r.lostH}h`; }
    }
  }
  log(`  - smallest defence that wins losing ≤ 2: ${best ?? 'none within the raid size'}`);
  const hl = Math.floor(size / 2);
  const ml = Math.floor((hl * raidC.thorn) / size);
  const half = { drone: 0, lancer: ml, flak: hl - ml };
  const hr = fight(raidC, half, 'node');
  FIGHTS.push([`half ${half.lancer}L+${half.flak}F`, half]);
  log(`  - half-size matched defence ${half.lancer} lancers + ${half.flak} flak (${hl}): ${hr.beaten ? 'BEATS the raid' : hr.hit ? 'beaten, raid hits' : 'turned back'}; warships lost ${hr.lostShips}, economy lost ${hr.lostE}e ${hr.lostH}h`);
  for (const [l, f] of [[ml, hl - ml - 1], [ml + 1, hl - ml]] as const) {
    if (f < 0) continue;
    const r = fight(raidC, { drone: 0, lancer: l, flak: f }, 'node');
    FIGHTS.push([`${l}L+${f}F`, { drone: 0, lancer: l, flak: f }]);
    rows.push(`${l}L+${f}F: ${r.beaten ? 'beaten' : r.hit ? 'hit' : 'turned back'} (warships lost ${r.lostShips}, econ ${r.lostE}e ${r.lostH}h)`);
  }
  log(`  - neighbours: ${rows.join('; ')}`);
}

// 4. Hive and pockets (min-wave; first order is the estimate's).
{
  const w = quiet();
  const all = ['drone', 'lancer', 'flak'];
  const full = est.fieldMix(w, data, F.heart, all, 40);
  const away = est.fullRaidAwayCounts(w, F.heart);
  const small = est.fieldMix(w, data, F.heart, all, 40, away.home);
  const p1 = est.fieldSingle(w, data, F.p1, 'drone', 20);
  const p2 = est.fieldSingle(w, data, F.p2, 'drone', 20);
  log(`- Hive best mix ${full?.total} (${JSON.stringify(full?.fleet)}); with a full raid out ${small?.total} (${JSON.stringify(small?.fleet)}); pockets: p1 ${p1} drones, p2 ${p2} drones.`);
}

// 5. Order check (designer.md "Check what the spec inherits"): every min-wave answer and the a5 defence fights rerun
// in a second arbitrary order. Min-wave: ships placed flak, lancer, drone (the estimate places drone, lancer, flak),
// and guards cut to the highest ids of each type (the estimate keeps the lowest), searched exhaustively over every
// mix up to the answer. Fights: defenders placed flak first, and raiders taken highest ids first.
if (!process.env.QUICK) {
  const REV = ['flak', 'lancer', 'drone'];
  function winsRev(node: number, fleet: any, home: any | null): boolean {
    const w = quiet();
    w.tun['raid.enabled'] = 0;
    const g = sim.guardianAt(w, node);
    if (home !== null) {
      const left = { ...home };
      const keep: any[] = [];
      for (const x of [...g.guards].reverse()) if (left[x.type]-- > 0) keep.push(x);
      g.guards = g.guards.filter((x: any) => keep.includes(x));
    }
    for (const type of REV) for (let i = 0; i < fleet[type]; i++) w.ships.push({ id: w.nextId++, type, hp: w.tun[`ship.${type}.hp`], at: node, transit: null, engagedIn: -1 });
    for (let i = 0; i < 100000; i++) {
      sim.step(w, data, []);
      if (!g.alive) return true;
      if (!w.ships.some((s: any) => s.at === node)) return false;
    }
    throw new Error('battle did not end');
  }
  function minRev(node: number, types: string[], upTo: number, home: any | null): number | null {
    for (let n = 1; n <= upTo; n++) {
      for (let d = 0; d <= (types.includes('drone') ? n : 0); d++)
        for (let l = 0; l <= (types.includes('lancer') ? n - d : 0); l++) {
          const f = n - d - l;
          if (f > 0 && !types.includes('flak')) continue;
          if (winsRev(node, { drone: d, lancer: l, flak: f }, home)) return n;
        }
    }
    return null;
  }
  const w = quiet();
  const all = ['drone', 'lancer', 'flak'];
  const away = est.fullRaidAwayCounts(w, F.heart);
  const rows: string[] = [];
  const cmp = (label: string, a: number | null, b: number | null) => rows.push(`${label} ${a} / ${b}${a === b ? '' : ' MOVED'}`);
  const hf = est.fieldMix(w, data, F.heart, all, 40)?.total ?? null;
  cmp('hive', hf, minRev(F.heart, all, (hf ?? 30) + 1, null));
  const ha = est.fieldMix(w, data, F.heart, all, 40, away.home)?.total ?? null;
  cmp('hive with the full raid out', ha, minRev(F.heart, all, (ha ?? 30) + 1, away.home));
  for (const [id, node] of [['p1', F.p1], ['p2', F.p2]] as const) cmp(`${id} drones`, est.fieldSingle(w, data, node, 'drone', 20), minRev(node, ['drone'], 20, null));
  log(`- Order check, min-wave (estimate order / second order): ${rows.join('; ')}.`);
  const fr: string[] = [];
  const show = (r: any) => `${r.beaten ? 'beaten' : r.hit ? 'hit' : 'turned back'} (warships lost ${r.lostShips}, econ ${r.lostE}e ${r.lostH}h)`;
  for (const [label, def] of FIGHTS) {
    const a = show(fight(RAID, def, 'node', false));
    const b = show(fight(RAID, def, 'node', true));
    fr.push(`${label}: ${a} / ${b}${a === b ? '' : ' MOVED'}`);
  }
  log(`- Order check, a5 fights against ${RAID.thorn}T ${RAID.spore}S (estimate order / second order): ${fr.join('; ')}.`);
}
console.log(out.join('\n'));
