import { createWorld, type ShipType, type SimData, type World } from '@factory4x/sim';
import { fieldMix, fieldSingle, fullRaidAwayCounts, hiveNode } from './field-estimate.ts';
import type { FieldResult } from './field-runner.ts';
import { openSlots } from './field-strategies.ts';

/**
 * The seven H7 capability flags (DESIGN.md "Bots (H7): strategies"). Each measures what can or can't be done,
 * never minutes, and is reported, never gated. Flags 1-3 read the runs; flags 4-7 read the min-wave estimate on a
 * fresh field (the shipped tunables) and, for flag 6, the haulers `adaptive` ran at its peak.
 */
export interface FieldFlag {
  name: string;
  pass: boolean;
  detail: string;
}

const ALL: readonly ShipType[] = ['drone', 'lancer', 'flak'];

const rowsOf = (results: readonly FieldResult[], name: string): FieldResult[] => results.filter((r) => r.strategy === name);
const lostTotal = (r: FieldResult): number => r.econLost.extractor + r.econLost.hauler;
const builtTotal = (r: FieldResult): number => r.econBuilt.extractor + r.econBuilt.hauler;

/** The flags from the runs (all seeds) and the shipped data. */
export function computeFieldFlags(results: readonly FieldResult[], data: SimData): FieldFlag[] {
  const flags: FieldFlag[] = [];
  const fresh: World = createWorld(1, data);
  const hive = hiveNode(fresh);
  const cap = fresh.tun['field.fleetCap'];
  const upTo = cap > 0 ? cap + 10 : 60;
  const NO_RUNS = 'no runs';

  // 1. Splitting matters.
  {
    const st = rowsOf(results, 'static');
    const ad = rowsOf(results, 'adaptive');
    const staticOk = (r: FieldResult): boolean => r.outcome !== 'won' || lostTotal(r) * 2 >= builtTotal(r);
    const pass = st.length > 0 && ad.length > 0 && st.every(staticOk) && ad.every((r) => r.outcome === 'won');
    flags.push({
      name: 'Splitting matters: static either loses at least half the economy ships it built to raids or fails to take the hive within the cap, and adaptive takes the hive',
      pass,
      detail:
        st.length === 0 || ad.length === 0
          ? NO_RUNS
          : `${st.map((r) => `static/${r.seed}${r.variant === null ? '' : ` (${r.variant})`} ${r.outcome === 'won' ? 'won' : r.outcome}, lost ${lostTotal(r)} of ${builtTotal(r)} economy ships ${staticOk(r) ? 'ok' : 'MISS'}`).join('; ')}; ${ad.map((r) => `adaptive/${r.seed} ${r.outcome}`).join(', ')}`,
    });
  }

  // 2. Greed is answered by raids.
  {
    const gr = rowsOf(results, 'greedy');
    const firstHit = (r: FieldResult): number | null => r.raidLog.find((x) => x.outcome === 'hit')?.econLost ?? null;
    const ok = (r: FieldResult): boolean => (firstHit(r) ?? 0) >= 2 && r.outcome === 'won';
    flags.push({
      name: "Greed is answered by raids: greedy's first hitting raid kills at least 2 economy ships, and greedy still wins after responding",
      pass: gr.length > 0 && gr.every(ok),
      detail: gr.length === 0 ? NO_RUNS : gr.map((r) => `greedy/${r.seed} first hit killed ${firstHit(r) ?? 'no hit'}, ${r.outcome} ${ok(r) ? 'ok' : 'MISS'}`).join('; '),
    });
  }

  // 3. Waiting is safe.
  {
    const id = rowsOf(results, 'idle');
    const ok = (r: FieldResult): boolean => r.raids.mustered <= 1;
    flags.push({
      name: 'Waiting is safe: idle is raided at most once',
      pass: id.length > 0 && id.every(ok),
      detail: id.length === 0 ? NO_RUNS : id.map((r) => `idle/${r.seed} raids mustered ${r.raids.mustered} (hit ${r.raids.hit}, beaten ${r.raids.beaten}, turned back ${r.raids.turnedBack}) ${ok(r) ? 'ok' : 'MISS'}`).join('; '),
    });
  }

  // 4. The counter-attack window is real.
  {
    const full = fieldMix(fresh, data, hive, ALL, upTo);
    const away = fullRaidAwayCounts(fresh, hive);
    const small = fieldMix(fresh, data, hive, ALL, upTo, away.home);
    // At least 30% smaller: away <= 70% of full (integer test). A hive no mix within the search takes counts as bigger than any.
    const pass = small !== null && (full === null || small.total * 100 <= full.total * 70);
    flags.push({
      name: "The counter-attack window is real: the hive's smallest winning wave with a full-size raid out is at least 30% smaller than at full strength",
      pass,
      detail: `best mix at full strength ${full === null ? `none within ${upTo}` : full.total}; with a raid of ${away.raid.thorn} Thorns and ${away.raid.spore} Spores out ${small === null ? `none within ${upTo}` : small.total}`,
    });
  }

  // 5. Counters matter.
  {
    const single = fieldSingle(fresh, data, hive, 'drone', cap > 0 ? cap : 60);
    const room = cap - 10;
    flags.push({
      name: `Counters matter: drones-only can't take the hive within field.fleetCap minus 10 economy ships (its best drone wave doesn't fit)`,
      pass: single === null || single > room,
      detail: `smallest drone wave ${single === null ? `none within ${cap}` : single} against ${room} warship slots (field.fleetCap ${cap} minus 10)`,
    });
  }

  // 6. Economy against offence is a trade in slots.
  {
    const best = fieldMix(fresh, data, hive, ALL, upTo);
    const haulers = Math.max(0, ...rowsOf(results, 'adaptive').map((r) => r.peakHaulers));
    const slots = openSlots(fresh);
    const fullEcon = slots + haulers;
    const pass = best !== null && best.total + fullEcon > cap && best.total + 10 <= cap;
    flags.push({
      name: "Economy against offence is a trade in slots: the hive's best mix plus a full economy is more than field.fleetCap, and the best mix plus 10 economy ships fits",
      pass,
      detail: `best mix ${best === null ? `none within ${upTo}` : best.total}; full economy ${fullEcon} (${slots} Mine slots plus ${haulers} haulers at adaptive's peak); field.fleetCap ${cap}; best mix + full economy = ${best === null ? '-' : best.total + fullEcon}, best mix + 10 = ${best === null ? '-' : best.total + 10}`,
    });
  }

  // 7. No free first win (F13), reported per guarded node.
  {
    const free = Math.floor(fresh.tun['economy.startStock'] / fresh.tun['ship.drone.cost']);
    const rows: string[] = [];
    let pass = true;
    for (const g of fresh.guardians) {
      const need = fieldSingle(fresh, data, g.node, 'drone', free + 1);
      const ok = need === null || need > free;
      if (!ok) pass = false;
      rows.push(`${fresh.nodes[g.node]!.id} needs ${need === null ? `more than ${free + 1}` : need} drones (${free} buyable from the opening stock) ${ok ? 'ok' : 'MISS'}`);
    }
    flags.push({
      name: 'No free first win: every guarded node needs more drones than the opening stock buys',
      pass,
      detail: rows.join('; '),
    });
  }
  return flags;
}
