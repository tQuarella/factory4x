import {
  areaStatus,
  activeBattles,
  combatRates,
  counterTag,
  fleetCap,
  fleetStatus,
  isReclaimed,
  guardianStatus,
  supplyStatus,
  unlockStatus,
  MIN_BUILD_TICKS,
  RIG_NODES,
  SHIP_TYPES,
  type BattleResult,
  type GuardCounts,
  type GuardType,
  type HeartParams,
  type LandingEffects,
  type NodeStatus,
  type ResearchRow,
  type SimData,
  type RawResource,
  type Resource,
  type ShipType,
  type ShipTypeCounts,
  type World,
} from '@factory4x/sim';
import { fmt10 } from './format.ts';

/** Battle, supply and unlock text (DESIGN.md H3 "Observable values and phone UI"). */

export const SHIP_NAME: Record<ShipType, string> = { drone: 'Drone', lancer: 'Lancer', flak: 'Flak' };
export const SHIP_PLURAL: Record<ShipType, string> = { drone: 'Drones', lancer: 'Lancers', flak: 'Flak' };
export const RES_NAME: Record<Resource, string> = { ore: 'Ore', ice: 'Ice', crystal: 'Crystal', lens: 'Lens', plating: 'Plating' };
export const GUARD_NAME: Record<GuardType, string> = { thorn: 'Thorns', spore: 'Spores' };
/** What a prize unlocks: its component, then the ship that uses it. */
export const UNLOCKS: Record<'ice' | 'crystal', { component: string; ship: ShipType }> = {
  ice: { component: 'Plating', ship: 'flak' },
  crystal: { component: 'Lens', ship: 'lancer' },
};
/** The counter phrase of a ship type, "Strong vs Thorns, Weak vs Spores". Drones have none. */
export const COUNTER_PHRASE: Record<ShipType, string> = {
  drone: 'neutral vs both',
  lancer: 'Strong vs Thorns, Weak vs Spores',
  flak: 'Strong vs Spores, Weak vs Thorns',
};

/** The sheet's Strong/Even/Weak tag text, shared by the sheet and the send panel. */
export const TAG_TEXT: Record<'strong' | 'even' | 'weak', string> = { strong: '✓ Strong', even: 'Even', weak: '✗ Weak' };

/** "1 / 2.0 s": one guard per period, one decimal always. */
export function regrowText(ticks: number, tickRate: number): string {
  return `1 / ${(ticks / tickRate).toFixed(1)} s`;
}

/**
 * The notice for the first delivery of a prize that unlocks a ship type. H4: it says what the yard is doing, because a
 * researched design lands with its yard already on, and an unresearched one cannot build at all.
 */
export function unlockNotice(ship: ShipType, yard: 'off' | 'on' | 'needsDesign' = 'off'): string {
  const prize = ship === 'lancer' ? 'crystal' : 'ice';
  const u = UNLOCKS[prize];
  const head = `${RES_NAME[prize]} delivered: ${u.component} and ${SHIP_PLURAL[ship]} unlocked.`;
  if (yard === 'needsDesign') return `${head} The ${SHIP_NAME[ship]} design is not researched yet (Research, on the overworld). Tap here to open the Probe.`;
  if (yard === 'on') return `${head} The ${SHIP_NAME[ship]} yard is on. Tap here to open the Probe.`;
  return `${head} Turn on the ${SHIP_NAME[ship]} yard at the Probe. Tap here to open it.`;
}

/** "Take a crystal pocket to unlock Lancers": the hint for a locked ship row. */
export function unlockHint(ship: ShipType): string {
  return ship === 'lancer' ? 'Take a crystal pocket to unlock Lancers' : 'Take an ice pocket to unlock Flak';
}

/** Player-facing name of a guarded node: "Root", "Heart", or the pocket id ("P1"). */
export function guardName(world: Readonly<World>, node: number): string {
  const n = world.nodes[node]!;
  return n.kind === 'root' ? 'Root' : n.kind === 'heart' ? 'Heart' : n.id.toUpperCase();
}

/** Game seconds with one decimal: 60 ticks at 30/s -> "2.0". */
function secs(ticks: number, tickRate: number): string {
  return (ticks / tickRate).toFixed(1);
}

/** "6 Thorns 7 Spores". */
export function mixText(c: Readonly<GuardCounts>): string {
  return `${c.thorn} Thorns ${c.spore} Spores`;
}

/** The repelled-toast hint: the dominant guard type, and any ship type sent that is Weak against the mix. */
export function repelHint(world: Readonly<World>, r: BattleResult): string {
  const g = r.guardsAtStart;
  const dominant = g.thorn === g.spore ? 'An even mix of Thorns and Spores' : g.thorn > g.spore ? 'Mostly Thorns' : 'Mostly Spores';
  const weak = SHIP_TYPES.filter((s) => s !== 'drone' && r.engagedByType[s] > 0 && counterTag(world.tun, s, g).tag === 'weak');
  if (weak.length === 0) return `${dominant}.`;
  const names = weak.map((s) => SHIP_PLURAL[s]).join(' and ');
  return `${dominant}; ${names} ${weak.length === 1 && weak[0] === 'flak' ? 'is' : 'are'} weak here.`;
}

/** "Plating and Flak unlocked" on the first delivery of a prize: a capture only names it while it still waits for a route. */
function unlockSentence(world: Readonly<World>, prize: RawResource | null): string {
  if (prize !== 'ice' && prize !== 'crystal') return '';
  if (unlockStatus(world).resources[prize]) return '';
  const u = UNLOCKS[prize];
  return ` Route its ${prize} to the Probe to unlock ${u.component} and ${SHIP_PLURAL[u.ship]}.`;
}

/** "10 Thorns 14 Spores, regrows 1 / 2.0 s and 1 / 0.7 s, repairs 2" or, starved, "…, no repair". */
function paramsText(p: HeartParams, tickRate: number, short: boolean): string {
  const repair = p.repairPerRound.thorn > 0 || p.repairPerRound.spore > 0 ? `repairs ${p.repairPerRound.thorn}` : 'no repair';
  const regrow = `${short ? '' : 'regrows '}1 / ${secs(p.regrowTicks.thorn, tickRate)} s and 1 / ${secs(p.regrowTicks.spore, tickRate)} s`;
  return `${mixText(p.caps)}, ${regrow}, ${repair}`;
}

/** The Root sheet's "Feeds the Heart" box, from live tunables. */
export function feedsBloomText(world: Readonly<World>, heartCaptured: boolean): string {
  const s = supplyStatus(world);
  if (heartCaptured) return 'The Heart is already yours. Cutting the Root changes nothing more.';
  const cut = paramsText(s.starvedHeart, world.tickRate, true);
  if (!s.rootAlive) return `The Root is cut, so the Heart is starved: ${cut}.`;
  return `While the Root lives, the Heart has ${paramsText(s.fedHeart, world.tickRate, false)}. Cut it: ${cut}.`;
}

/** The line under the heart's guard count on its sheet. */
export function supplyLine(world: Readonly<World>): string {
  const s = supplyStatus(world);
  if (!s.hasRoot) return '';
  if (!s.rootAlive) return 'Starved: Root cut';
  const v = s.starvedHeart;
  return `Fed by the Root (cut it: ${mixText(v.caps)}, 1 / ${secs(v.regrowTicks.thorn, world.tickRate)} s)`;
}

/** Battle banner: one line per running battle, "P3 · 6 Thorn 2 Spore · strip 1.3/s · 4 lost". */
export function bannerLines(world: Readonly<World>): string[] {
  return activeBattles(world).map(
    (b) => `${guardName(world, b.node).toUpperCase()} · ${b.guards.thorn} Thorn ${b.guards.spore} Spore · strip ${fmt10(b.killPerSecX10)}/s · ${b.shipsLost} lost`,
  );
}

/** How much slower the starved heart regrows, as "5× slower": bloom.starvedRegrowMul (at least 1, so never faster). */
export function regrowChange(world: Readonly<World>): string {
  const mul = world.tun['bloom.starvedRegrowMul'];
  return mul === 1 ? 'regrows at the same speed' : `regrows ${mul}× slower`;
}

/**
 * Battle report toast text, plus a plain reason line so a failed wave reads
 * as a lesson: regrowth outpaced it, or the wave was too small.
 */
export function battleReport(world: Readonly<World>, r: BattleResult, data?: SimData): string {
  const sent = r.shipsEngaged;
  const counts = `${sent} sent, ${r.shipsLost} lost`;
  const name = guardName(world, r.node);
  const kind = world.nodes[r.node]!.kind;
  if (r.outcome === 'captured') {
    if (kind === 'pocket') return `${RES_NAME[world.nodes[r.node]!.prize ?? 'ore']} pocket taken: ${counts}.${unlockSentence(world, world.nodes[r.node]!.prize)}`;
    if (kind !== 'root') return `${name} taken: ${counts}`;
    if (!r.wilt) return `Root cut: ${counts}.`;
    const w = r.wilt;
    const change = regrowChange(world);
    const from = w.from.thorn + w.from.spore;
    const to = w.to.thorn + w.to.spore;
    return from > to
      ? `Root cut: ${counts}. The Heart wilts: ${mixText(w.from)} → ${mixText(w.to)}, ${change}.`
      : `Root cut: ${counts}. The Heart is already at ${mixText(w.to)} and ${change}.`;
  }
  const rates = combatRates(world, r.node, r.engagedByType);
  const rate = `${sent} ships strip ${fmt10(rates.killPerSecX10)} guards/s; ${name} regrows ${fmt10(rates.regrowPerSecX10)}/s.`;
  if (r.outcome === 'withdrew') return `Wave withdrew: ${counts}, ${r.guardsKilled} guards stripped\n${rate}`;
  const first = `${name} held: ${counts}. ${repelHint(world, r)}${fullFleetHint(world, r, data)}`;
  const why =
    rates.killPerSecX10 <= rates.regrowPerSecX10
      ? 'Regrowth outpaced the wave.'
      : `Too few ships to strip all ${guardianStatus(world, r.node).totalCap} guards before the wave was lost. Send more at once.`;
  return `${first}\n${why} ${rate}`;
}

// ---------------------------------------------------------------------------
// H5: the fleet limit.

/** The fleet chip text, "Fleet 9/12". */
export function fleetChipText(count: number, cap: number): string {
  return `Fleet ${count}/${cap}`;
}

/** The probe sheet's Yards header and the chip's tooltip, "Fleet 9/12". (H6: the limit rises by reclaiming command relays, so no level part.) */
export function fleetLine(f: { count: number; cap: number }): string {
  return fleetChipText(f.count, f.cap);
}

/** The overworld top row's chip, "Fleet limit 20". */
export function fleetLimitText(cap: number): string {
  return `Fleet limit ${cap}`;
}

/** H6 combat amendment: the line under the Strong/Weak tags of a heart or pocket (the guard-damage target order). */
export const GUARD_TARGET_LINE = 'Thorns strike Flak first; Spores strike Lancers first.';

/** The first-time notice when the fleet reaches its limit in a visit. */
export function fleetFullNotice(count: number, cap: number): string {
  return `Fleet full (${count}/${cap}): yards paused. Recycle ships at a node to change your mix.`;
}

const SHIP_LOWER: Record<ShipType, { one: string; many: string }> = {
  drone: { one: 'drone', many: 'drones' },
  lancer: { one: 'lancer', many: 'lancers' },
  flak: { one: 'flak', many: 'flak' },
};

/** "Recycled 3 drones: +27 ore." */
export function recycleNotice(counts: Readonly<ShipTypeCounts>, ore: number): string {
  const parts = SHIP_TYPES.filter((t) => counts[t] > 0).map((t) => `${counts[t]} ${counts[t] === 1 ? SHIP_LOWER[t].one : SHIP_LOWER[t].many}`);
  return `Recycled ${parts.join(', ')}: +${ore} ore.`;
}

/**
 * The repelled hint for a wave sent at the limit (at least capAtSend - 1 ships): " You sent a full fleet. Change the mix, or
 * reclaim a command relay to raise the limit." A fed Heart (the dormant Root path) leads with the Root cut. With no Root to cut (or
 * the Heart not the target) that part is left out, and so is the relay part once every band's relay is reclaimed. Empty when the
 * limit was off or the wave smaller.
 */
export function fullFleetHint(world: Readonly<World>, r: BattleResult, data?: SimData): string {
  const cap = r.capAtSend;
  if (cap === null || r.shipsEngaged < cap - 1) return '';
  const sup = supplyStatus(world);
  const fed = world.nodes[r.node]!.kind === 'heart' && sup.hasRoot && sup.rootAlive;
  let canRaise = true;
  if (data !== undefined) {
    const f = fleetStatus(world, data);
    canRaise = f.commandedBands < f.maxCommandedBands;
  }
  const options = fed ? ['Cut the Root', 'change the mix'] : ['Change the mix'];
  if (canRaise) options.push('reclaim a command relay to raise the limit');
  const last = options[options.length - 1]!;
  const list = options.length === 1 ? last : `${options.slice(0, -1).join(', ')}, or ${last}`;
  return ` You sent a full fleet. ${list}.`;
}

/** The area result and win panels' line, "5 ships (+40 ore)". */
export function recycledText(ships: number, ore: number): string {
  return `${ships} ${ships === 1 ? 'ship' : 'ships'} (+${ore} ore)`;
}

// ---------------------------------------------------------------------------
// H4: overworld, research and campaign text. Every number comes from a selector or a live tunable.

/** Lower-case names for the three raw resources. */
export const RAW_NAME: Record<RawResource, string> = { ore: 'ore', ice: 'ice', crystal: 'crystal' };
const RAW_ORDER: readonly RawResource[] = ['ore', 'ice', 'crystal'];

/** Player-facing tier names (the spec's "Medium"); the tier number itself is data. */
export const TIER_NAME: readonly string[] = ['Landing', 'Light', 'Medium', 'Heavy'];

/** "300 ore · 60 ice · 30 crystal" (zeros left out), or "nothing". */
export function tripleText(t: Readonly<Record<RawResource, number>>, sep = ' · '): string {
  const parts = RAW_ORDER.filter((r) => t[r] > 0).map((r) => `${t[r]} ${RAW_NAME[r]}`);
  return parts.length > 0 ? parts.join(sep) : 'nothing';
}

/** "+300 ore +30 ice +60 crystal" (zeros left out), or "nothing". */
export function plusText(t: Readonly<Record<RawResource, number>>): string {
  const parts = RAW_ORDER.filter((r) => t[r] > 0).map((r) => `+${t[r]} ${RAW_NAME[r]}`);
  return parts.length > 0 ? parts.join(' ') : 'nothing';
}

/** Per-minute rates given in tenths ("…X10"): "+5 ore +2.5 ice/min", or "nothing". */
export function ratesX10Text(t: Readonly<Record<RawResource, number>>): string {
  const parts = RAW_ORDER.filter((r) => t[r] > 0).map((r) => `+${fmt10(t[r])} ${RAW_NAME[r]}`);
  return parts.length > 0 ? `${parts.join(' ')}/min` : 'nothing';
}

/** An area's export per game minute after `shipments.pct`, in tenths (what the reclaimed area ships). */
export function exportX10(exp: Readonly<Record<RawResource, number>>, shipmentsPct: number): Record<RawResource, number> {
  const x10 = (n: number): number => Math.floor((n * shipmentsPct) / 10);
  return { ore: x10(exp.ore), ice: x10(exp.ice), crystal: x10(exp.crystal) };
}

/** The ship component's source resource: "lens" needs crystal, "plating" needs ice. */
export const COMPONENT_SOURCE: Record<'lens' | 'plating', RawResource> = { lens: 'crystal', plating: 'ice' };

/** "A1", "A1 and A2". */
function nodeList(ids: readonly string[]): string {
  return ids.map((i) => i.toUpperCase()).join(' and ');
}

/** The landing notice: names every research effect in play, so the upgrade is noticed where the chore would be. */
export function landingNotice(areaName: string, fx: LandingEffects): string {
  const parts = [`Landed in ${areaName}`, `${fx.openingOre} ore`];
  if (fx.rigNodes.length > 0) parts.push(`${nodeList(fx.rigNodes)} ${fx.rigNodes.length === 1 ? 'rig' : 'rigs'} running`);
  if (fx.extractPct > 100) parts.push(`extraction +${fx.extractPct - 100}%`);
  if (fx.yardTimePct < 100) parts.push(`ships build ${100 - fx.yardTimePct}% faster`);
  const designs = (['lancer', 'flak'] as const).filter((d) => fx.designs[d]).map((d) => SHIP_NAME[d]);
  if (designs.length > 0) parts.push(`${designs.join(' and ')} ${designs.length === 1 ? 'yard' : 'yards'} on`);
  if (fx.fleetCap !== null) parts.push(`fleet limit ${fx.fleetCap}`);
  return parts.join(' · ');
}

/** "Shipped while you were in Spore Veil: +56 ore +12 ice", or '' if nothing shipped. */
export function shippedNotice(areaName: string, shipped: Readonly<Record<RawResource, number>>): string {
  const total = shipped.ore + shipped.ice + shipped.crystal;
  return total > 0 ? `Shipped while you were in ${areaName}: ${plusText(shipped)}` : '';
}

/** "Thorn Garden reclaimed: +300 ore +30 ice +60 crystal. Opened: The Deep." */
export function reclaimNotice(areaName: string, haul: Readonly<Record<RawResource, number>>, opened: readonly string[]): string {
  const head = `${areaName} reclaimed: ${plusText(haul)}.`;
  return opened.length > 0 ? `${head} Opened: ${opened.join(', ')}.` : head;
}

/** What the first relay of a band did, for the step moment: the band it opened (or null with the band lock off) and the limit before and after. */
export interface StepMoment {
  /** The relay's band (1 or 2). */
  band: number;
  /** The band the relay opens (band + 1), or null when `overworld.bandLock` is 0 or the data has no such band. */
  opens: number | null;
  capBefore: number | null;
  capAfter: number | null;
}

/**
 * The step moment of returning to the overworld after leaving `area`: set when it is a relay reclaimed first in its band (no
 * relay of the band was reclaimed before it), and it either raised the limit or opened a band; else null. Numbers come from
 * the sim (`fleetCap`, which counts every reclaimed relay on the overworld) and the live relay step.
 */
export function stepMoment(world: Readonly<World>, data: SimData, area: number): StepMoment | null {
  const def = data.map.areas[area];
  if (def === undefined || !def.relay || !isReclaimed(world, area)) return null;
  for (const b of world.campaign.reclaimOrder) {
    if (b === area) break;
    const other = data.map.areas[b]!;
    if (other.relay && other.tier === def.tier) return null;
  }
  const capAfter = fleetCap(world, data);
  const capBefore = capAfter === null ? null : capAfter - world.tun['fleet.relayStep'];
  const opens = world.tun['overworld.bandLock'] > 0 && data.map.areas.some((a) => a.tier === def.tier + 1) ? def.tier + 1 : null;
  if (capAfter === null && opens === null) return null;
  return { band: def.tier, opens, capBefore, capAfter };
}

/** "Command relay reclaimed: fleet limit 12 → 20. Band 2 is open." (each part only when it applies) */
export function stepNotice(s: StepMoment): string {
  const head = s.capAfter === null ? 'Command relay reclaimed' : `Command relay reclaimed: fleet limit ${s.capBefore} → ${s.capAfter}`;
  return s.opens === null ? `${head}.` : `${head}. Band ${s.opens} is open.`;
}

/** Notice after a withdraw. */
export function withdrawNotice(areaName: string): string {
  return `Withdrew from ${areaName}. The area reset; research and the stockpile are kept.`;
}

/** Short summary of what a purchase just did ("Extraction 2: extractors now yield +50%"). */
export function purchaseNotice(row: Pick<ResearchRow, 'id' | 'name' | 'level' | 'effect'>, rigNodes: readonly string[]): string {
  switch (row.id) {
    case 'opening':
      return `${row.name} ${row.level}: you now land with ${row.effect} ore`;
    case 'extract':
      return `${row.name} ${row.level}: extractors now yield +${row.effect - 100}%`;
    case 'rigs':
      return `${row.name} ${row.level}: you land with ${nodeList(rigNodes)} already mined`;
    case 'yards':
      return `${row.name} ${row.level}: ships build ${100 - row.effect}% faster`;
    case 'fleet':
      return `${row.name} ${row.level}: fleet limit now ${row.effect}.`;
    case 'lancer':
    case 'flak':
      return `${row.name} researched: its yard can run (each ship still needs its component made in the area)`;
    default:
      return `${row.name} ${row.level}`;
  }
}

/** Lower-case tier name for the requirement wording ("medium"). */
function tierWord(tier: number): string {
  return (TIER_NAME[tier] ?? `tier ${tier}`).toLowerCase();
}

/** The tier requirement as the sheet words it, without "Needs": "a light area reclaimed", "both medium areas reclaimed". */
export function tierRequirementText(tier: number, count: number): string {
  if (count <= 1) return `a ${tierWord(tier)} area reclaimed`;
  return `${count === 2 ? 'both' : String(count)} ${tierWord(tier)} areas reclaimed`;
}

/**
 * Why a research button is disabled, from `researchStatus`: the limit being off (tuning), items, areas, tier counts, then the
 * shortest missing resource.
 */
export function researchBlock(row: ResearchRow, itemLabel: (id: string, level: number) => string, areaName: (id: string) => string): string {
  if (row.cost === null) return 'Max';
  if (row.missing.capOff) return 'Fleet limit is off (tuning)';
  const item = row.missing.items[0];
  if (item) return `Needs ${itemLabel(item.id, item.level)}`;
  const area = row.missing.areas[0];
  if (area) return `Needs ${areaName(area)} reclaimed`;
  const tier = row.missing.tiers[0];
  if (tier) return `Needs ${tierRequirementText(tier.tier, tier.count)}`;
  let best: RawResource | null = null;
  for (const r of RAW_ORDER) {
    const short = row.missing.resources[r];
    if (short > 0 && (best === null || short < row.missing.resources[best])) best = r;
  }
  return best === null ? 'Research' : `Needs ${row.missing.resources[best]} ${RAW_NAME[best]}`;
}

/** The areas this reclaim opened: neighbours that are open now and had no other reclaimed neighbour. */
export function openedByReclaim(world: Readonly<World>, data: SimData, area: number): string[] {
  const out: string[] = [];
  for (const n of areaStatus(world, data, area).lanes) {
    const st = areaStatus(world, data, n);
    if (st.state !== 'open') continue;
    const others = st.lanes.filter((l) => l !== area && world.campaign.areas[l]!.reclaimedTick !== null);
    if (others.length === 0) out.push(st.name);
  }
  return out;
}

/** The effect of a grind item as the sheet words it: "Opening ore 80 → 120 per landing". Numbers come from the row and live tunables. */
export function effectText(row: Pick<ResearchRow, 'id' | 'level' | 'maxLevel' | 'effect' | 'nextEffect'>, tun: Readonly<Record<string, number>>, tickRate: number): string {
  const next = row.nextEffect;
  const arrow = (a: string, b: string | null, unit: string): string => (b === null ? `${a}${unit}` : `${a} → ${b}${unit}`);
  switch (row.id) {
    case 'opening':
      return `Opening ore ${arrow(String(row.effect), next === null ? null : String(next), '')} per landing`;
    case 'extract': {
      const base = tun['extractor.orePerMin']!;
      const rate = (pct: number): string => fmt10(Math.floor((base * pct) / 10));
      return `Extractors ${arrow(rate(row.effect), next === null ? null : rate(next), '')} ore/min`;
    }
    case 'yards': {
      const base = tun['ship.drone.buildTicks']!;
      const sec = (pct: number): string => (Math.max(MIN_BUILD_TICKS, Math.floor((base * pct) / 100)) / tickRate).toFixed(1);
      return `Ship build ${arrow(sec(row.effect), next === null ? null : sec(next), '')} s`;
    }
    case 'rigs': {
      const list = (n: number): string => nodeList(RIG_NODES.slice(0, n));
      if (next === null) return `Land with ${list(row.effect)} mined`;
      return row.effect === 0 ? `Land with ${list(next)} mined` : `${list(row.effect)} mined → ${list(next)} mined`;
    }
    case 'fleet':
      if (row.effect === 0) return 'Fleet limit is off (tuning)';
      return `Fleet limit ${arrow(String(row.effect), next === null ? null : String(next), '')}`;
    case 'lancer':
    case 'flak':
      return row.level > 0 ? 'Researched: its yard can run' : 'Unlocks its yard';
    default:
      return '';
  }
}

const backedUpLatch = new WeakMap<object, Map<number, boolean>>();

/**
 * Is this node backed up? A steady answer for the sheet's warning and the map's "!" and dashed route. The sim's `backedUp` is
 * "buffer >= cap", which flips every time a pod leaves a full buffer (h6 bug: the warning showed and hid and moved the buttons).
 * Without a route a full buffer never drains, so the sim's flag is already steady. With one, the node is backed up while its
 * extractors out-produce the route: it turns on when the buffer is full and stays on until the buffer drops below half (a pod
 * takes a level's worth, far less than that) or the route can carry the extraction, so an upgrade clears it at once.
 */
export function isBackedUp(world: Readonly<World>, node: number, st: NodeStatus): boolean {
  let latch = backedUpLatch.get(world);
  if (!latch) backedUpLatch.set(world, (latch = new Map()));
  let on = latch.get(node) ?? false;
  if (st.extractors <= 0) on = false;
  else if (!st.route) on = st.backedUp;
  else if (st.extractPerMinX10 <= st.route.capacityPerMin * 10) on = false;
  else if (st.buffer >= st.bufferCap) on = true;
  else if (st.buffer * 2 < st.bufferCap) on = false;
  latch.set(node, on);
  return on;
}
