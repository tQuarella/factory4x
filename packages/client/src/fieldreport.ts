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
  lancer: 'needs crystal: take the crystal pocket',
  flak: 'needs ice: take the ice pocket',
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

/** The probe sheet's money line, "Ore 14 unassigned · +36/min". */
export function incomeText(stockOre: number, incomePerMin: number): string {
  return `${stockOre} ore spare · +${incomePerMin}/min`;
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
