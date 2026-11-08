import {
  activeBattles,
  combatRates,
  counterTag,
  guardianStatus,
  supplyStatus,
  unlockStatus,
  SHIP_TYPES,
  type BattleResult,
  type GuardCounts,
  type GuardType,
  type HeartParams,
  type RawResource,
  type Resource,
  type ShipType,
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

/** The notice for the first delivery of a prize that unlocks a ship type (the yard starts off, so say so). */
export function unlockNotice(ship: ShipType): string {
  const prize = ship === 'lancer' ? 'crystal' : 'ice';
  const u = UNLOCKS[prize];
  return `${RES_NAME[prize]} delivered: ${u.component} and ${SHIP_PLURAL[ship]} unlocked. Turn on the ${SHIP_NAME[ship]} yard at the Probe. Tap here to open it.`;
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
export function battleReport(world: Readonly<World>, r: BattleResult): string {
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
  const first = `${name} held: ${counts}. ${repelHint(world, r)}`;
  const why =
    rates.killPerSecX10 <= rates.regrowPerSecX10
      ? 'Regrowth outpaced the wave.'
      : `Too few ships to strip all ${guardianStatus(world, r.node).totalCap} guards before the wave was lost. Send more at once.`;
  return `${first}\n${why} ${rate}`;
}
