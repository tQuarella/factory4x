/**
 * H7 text: the probe sheet's state lines, the rock sheet's lines and the field result panel. Every number comes from a sim selector
 * (`allocStatus`, `rockStatus`, `fieldSummary`) or a live tunable; nothing here reads world internals.
 */
import { BUILD_TYPES, type AllocRow, type BuildType, type BuildTypeCounts, type FieldSummary, type RockStatus } from '@factory4x/sim';
import { mmss } from './format.ts';
import { SHIP_NAME } from './report.ts';

/** Player-facing names of the five build types, in BUILD_TYPES order. */
export const BUILD_NAME: Record<BuildType, string> = {
  extractor: 'Extractor',
  hauler: 'Hauler',
  drone: SHIP_NAME.drone,
  lancer: SHIP_NAME.lancer,
  flak: SHIP_NAME.flak,
};
export const BUILD_PLURAL: Record<BuildType, string> = {
  extractor: 'Extractors',
  hauler: 'Haulers',
  drone: 'Drones',
  lancer: 'Lancers',
  flak: 'Flak',
};

/** What a locked type needs, as the state line says it. */
const LOCK_TEXT: Partial<Record<BuildType, string>> = {
  lancer: 'needs crystal pocket',
  flak: 'needs ice pocket',
};

/** One row's state line on the probe sheet ("building 40%", "saving 12/20", "fleet full", "off"). */
export function allocStateText(row: Readonly<AllocRow>): string {
  switch (row.state) {
    case 'building':
      return `building ${row.building}%`;
    case 'off':
      return 'off';
    case 'locked':
      return LOCK_TEXT[row.type] ?? 'locked';
    case 'waitingResource':
      return row.cost.resource ? `needs ${row.cost.resource.amount} ${row.cost.resource.res}` : 'waiting';
    case 'fleetFull':
      return 'fleet full';
    case 'filling':
      return `saving ${row.share}/${row.cost.ore}`;
  }
}

/** A row's cost line, "20 ore" or "30 ore + 4 crystal". */
export function allocCostText(row: Readonly<AllocRow>): string {
  const r = row.cost.resource;
  return r ? `${row.cost.ore} ore + ${r.amount} ${r.res}` : `${row.cost.ore} ore`;
}

/** The radar's accessible label: "Allocation: Extractor 3, Hauler 2, Drone 0, Lancer 0, Flak 0". */
export function radarLabel(rows: readonly Pick<AllocRow, 'type' | 'weight'>[]): string {
  return `Allocation: ${rows.map((r) => `${BUILD_NAME[r.type]} ${r.weight}`).join(', ')}`;
}

/** The rock sheet's extractor line, "2/3 extractors (1 on the way)". */
export function pipText(r: Readonly<RockStatus>): string {
  const docked = r.docked + r.freeExtractors;
  return `${docked}/${r.slots}${r.inFlight > 0 ? ` (+${r.inFlight} on the way)` : ''}`;
}

/** "Backed up: add haulers": the buffer is full and extractors are idling. */
export const BACKED_UP_TEXT = 'Backed up: add haulers';
/** The longest rock-sheet note, which sizes the room reserved for it. */
export const RAID_RANK_TEXT = 'Nearest mined rock to the hive: raids hit here first.';

/** "Delivered +24/min". */
export function deliveredText(r: Readonly<RockStatus>): string {
  return `+${r.deliveredPerMin}/min`;
}

/** The field result panel's built/lost line, "6 Extractor · 4 Hauler · 3 Drone", only the types that appear (or "0"). */
export function typesText(c: Readonly<BuildTypeCounts>): string {
  const parts = BUILD_TYPES.filter((t) => c[t] > 0).map((t) => `${c[t]} ${BUILD_NAME[t]}`);
  return parts.length > 0 ? parts.join(' · ') : '0';
}

/** "Raids 4: 2 beaten · 1 hit · 1 turned back", or "none". */
export function raidsText(r: Readonly<FieldSummary['raids']>): string {
  if (r.mustered === 0) return 'none';
  return `${r.mustered}: ${r.beaten} beaten · ${r.hit} hit · ${r.turnedBack} turned back`;
}

/** The result panel's headline time, "12:40" (or "-"). */
export function hiveTimeText(s: Readonly<FieldSummary>): string {
  return s.timeToHiveSec === null ? '-' : mmss(s.timeToHiveSec);
}

/** The first-run hint of a field run. It teaches the one thing the map doesn't show; mining and hauling need no teaching. */
export const FIELD_HINT = 'Ships mine and haul on their own. Tap the probe to change what it builds.';

/** The unlock notice of a field run: a pocket's first delivery opens a warship type, and the weight is the only switch. */
export function fieldUnlockNotice(ship: 'lancer' | 'flak'): string {
  const prize = ship === 'lancer' ? 'Crystal' : 'Ice';
  return `${prize} delivered: ${BUILD_PLURAL[ship]} unlocked. Raise their weight at the Probe. Tap here to open it.`;
}

/** The first-time notice when the fleet reaches its limit (economy ships count when `countsEconomy`). */
export function fieldFleetFullNotice(count: number, cap: number, countsEconomy: boolean): string {
  const who = countsEconomy ? 'Every ship counts.' : 'Warships count.';
  return `Fleet full (${count}/${cap}): the probe stops starting ships. ${who} Recycle ships to change your mix.`;
}

// ---------------------------------------------------------------------------
// H7 raids: the muster banner, the battle line, the chip and the end toasts. Numbers come from `raidStatus`.

/** "4 Spores, 1 Thorn" (the larger type first), or "nothing". */
export function raidMixText(c: Readonly<{ thorn: number; spore: number }>): string {
  const parts: Array<[number, string]> = [
    [c.spore, c.spore === 1 ? 'Spore' : 'Spores'],
    [c.thorn, c.thorn === 1 ? 'Thorn' : 'Thorns'],
  ];
  parts.sort((a, b) => b[0] - a[0]);
  const text = parts.filter((p) => p[0] > 0).map((p) => `${p[0]} ${p[1]}`);
  return text.length > 0 ? text.join(', ') : 'nothing';
}

/** Game ticks as whole seconds, rounded up ("15 s"). */
export function secsText(ticks: number, tickRate: number): string {
  return `${Math.ceil(ticks / tickRate)} s`;
}

/** m:ss of ticks, rounded up, for the chip ("0:12"). */
export function clockText(ticks: number, tickRate: number): string {
  const s = Math.max(0, Math.ceil(ticks / tickRate));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** The muster banner: "Raid gathering: 4 Spores, 1 Thorn → A5 in 15 s". */
export function raidMusterLine(planned: Readonly<{ thorn: number; spore: number }>, target: string, ticksToLaunch: number, tickRate: number): string {
  return `Raid gathering: ${raidMixText(planned)} → ${target} in ${secsText(ticksToLaunch, tickRate)}`;
}

/** The battle line at the target: "Raid at A5: 3 left". */
export function raidFightLine(target: string, left: number): string {
  return `Raid at ${target}: ${left} left`;
}

interface RaidChipInput {
  enabled: boolean;
  phase: 'none' | 'muster' | 'out' | 'fight' | 'home';
  econ: number;
  nextRaidAtEcon: number;
  ticksToLaunch: number;
  ticksToArrival: number;
  ticksToNextAllowed: number;
}

/** The top bar's raid chip text, or null when raids are off. */
export function raidChipText(r: Readonly<RaidChipInput>, tickRate: number): string | null {
  if (!r.enabled) return null;
  if (r.phase === 'muster') return `Raid ${clockText(r.ticksToLaunch, tickRate)}`;
  if (r.phase === 'out') return `Raid ${clockText(r.ticksToArrival, tickRate)}`;
  if (r.phase === 'fight') return 'Raid on';
  if (r.phase === 'home') return 'Raid leaving';
  if (r.econ < r.nextRaidAtEcon) return `Raids at ${r.nextRaidAtEcon} ships`;
  return r.ticksToNextAllowed > 0 ? `Next raid ${clockText(r.ticksToNextAllowed, tickRate)}` : 'Raids ready';
}

interface RaidLastInput {
  outcome: 'beaten' | 'hit' | 'turnedBack' | 'withered';
  lostEcon: { extractor: number; hauler: number };
  lostShips: { drone: number; lancer: number; flak: number };
  killed: { thorn: number; spore: number };
}

/** The end toast: "Raid beaten at A5: 5 killed, 0 lost", "Raid hit A5: lost 2 extractors, 1 hauler", "Raid turned back". */
export function raidEndText(r: Readonly<RaidLastInput>, target: string): string {
  const killed = r.killed.thorn + r.killed.spore;
  const ships = r.lostShips.drone + r.lostShips.lancer + r.lostShips.flak;
  const lostN = r.lostEcon.extractor + r.lostEcon.hauler + ships;
  if (r.outcome === 'beaten') return `Raid beaten at ${target}: ${killed} killed, ${lostN} lost`;
  if (r.outcome === 'turnedBack') return 'Raid turned back';
  if (r.outcome === 'withered') return 'The raid withers with the hive.';
  const parts: string[] = [];
  const add = (n: number, one: string, many: string): void => void (n > 0 && parts.push(`${n} ${n === 1 ? one : many}`));
  add(r.lostEcon.extractor, 'extractor', 'extractors');
  add(r.lostEcon.hauler, 'hauler', 'haulers');
  add(r.lostShips.drone, 'drone', 'drones');
  add(r.lostShips.lancer, 'lancer', 'lancers');
  add(r.lostShips.flak, 'flak', 'flak');
  return `Raid hit ${target}: lost ${parts.length > 0 ? parts.join(', ') : 'nothing'}`;
}
