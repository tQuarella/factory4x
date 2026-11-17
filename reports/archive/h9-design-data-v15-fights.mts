// Scratch: per-prong fights at a full economy, run through the sim's own muster and launch (W1-W6).
// a5 has 3 extractors and 3 haulers, a6 has 2 and 2; idle haulers at the probe pad econ to ECON (default 24).
// Usage (worktree root): npx tsx <this> [key=value ...]
import { readFileSync } from 'node:fs';
const ROOT = process.cwd().replace(/\\/g, '/');
const sim = await import(`file:///${ROOT}/packages/sim/src/index.ts`);
const fieldMod = await import(`file:///${ROOT}/packages/sim/src/field.ts`);
const raw = JSON.parse(readFileSync(`${ROOT}/data/sim.json`, 'utf8'));
for (const a of process.argv.slice(2)) { const [k, v] = a.split('='); raw.tunables[k!].default = Number(v); }
const data = sim.parseSimData(raw);
const F = { probe: 0, a5: 5, a6: 6, heart: 10 };
const ECON = Number(process.env.ECON ?? 24);
type Def = { lancer: number; flak: number; drone?: number };
function run(defA5: Def, defA6: Def, rev = false) {
  const w = sim.createWorld(1, data);
  const f = w.field;
  w.stock.ore = 0;
  w.tun['economy.probeOrePerMin'] = 0;
  for (const t of sim.BUILD_TYPES) { f.alloc[t] = 0; f.share[t] = 0; }
  f.mine = f.mine.map(() => false);
  f.econ = [];
  f.mine[F.a5] = true; f.mine[F.a6] = true;
  const add = (type: string, at: number, target: number | null) => f.econ.push({ id: w.nextId++, type, hp: w.tun[`ship.${type}.hp`], at, transit: null, target, cargo: 0, cargoRes: null });
  for (let i = 0; i < 3; i++) { add('extractor', F.a5, F.a5); add('hauler', F.a5, F.a5); }
  for (let i = 0; i < 2; i++) { add('extractor', F.a6, F.a6); add('hauler', F.a6, F.a6); }
  while (f.econ.length < ECON) add('hauler', F.probe, null);
  fieldMod.syncExtractors(w);
  const types = rev ? ['flak', 'lancer', 'drone'] : ['drone', 'lancer', 'flak'];
  for (const [node, d] of [[F.a5, defA5], [F.a6, defA6]] as const)
    for (const type of types) for (let i = 0; i < ((d as any)[type] ?? 0); i++) w.ships.push({ id: w.nextId++, type, hp: w.tun[`ship.${type}.hp`], at: node, transit: null, engagedIn: -1 });
  w.tun['raid.musterTicks'] = 0;
  w.nextRaidTick = 0;
  const before = w.ships.length;
  let n = 0;
  while (w.lastRaid === null && n++ < 20000) sim.step(w, data, []);
  const r = w.lastRaid;
  if (r === null) return 'no raid ended';
  const p = r.prongs.map((x: any) => `${w.nodes[x.target].id} ${x.outcome} (econ lost ${x.lostEcon.extractor + x.lostEcon.hauler}, warships lost ${x.lostShips.drone + x.lostShips.lancer + x.lostShips.flak}, raiders killed ${x.killed.thorn + x.killed.spore})`);
  return `overall ${r.outcome}; ${p.join(' | ')}; warships lost total ${before - w.ships.length}`;
}
const cases: [string, Def, Def][] = [
  ['undefended', { lancer: 0, flak: 0 }, { lancer: 0, flak: 0 }],
  ['a5 2 (1L1F), a6 none', { lancer: 1, flak: 1 }, { lancer: 0, flak: 0 }],
  ['a5 2 (0L2F)', { lancer: 0, flak: 2 }, { lancer: 0, flak: 0 }],
  ['a5 3 (1L2F) half', { lancer: 1, flak: 2 }, { lancer: 0, flak: 0 }],
  ['a5 4 (1L3F)', { lancer: 1, flak: 3 }, { lancer: 0, flak: 0 }],
  ['a5 6 (2L4F) matched', { lancer: 2, flak: 4 }, { lancer: 0, flak: 0 }],
  ['both 3 (1L2F)', { lancer: 1, flak: 2 }, { lancer: 1, flak: 2 }],
  ['both 6 (2L4F)', { lancer: 2, flak: 4 }, { lancer: 2, flak: 4 }],
  ['a5 12 (4L8F) concentrated', { lancer: 4, flak: 8 }, { lancer: 0, flak: 0 }],
];
console.log(`econ ${ECON}; overrides: ${process.argv.slice(2).join(' ') || 'none'}`);
for (const [label, a, b] of cases) {
  console.log(`- ${label}: ${run(a, b)}`);
  console.log(`  second order: ${run(a, b, true)}`);
}
