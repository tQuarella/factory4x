import {
  activeBattles,
  combatRates,
  guardianStatus,
  supplyStatus,
  type BattleResult,
  type GuardCounts,
  type HeartParams,
  type World,
} from '@factory4x/sim';
import { fmt10 } from './format.ts';

/**
 * Battle and supply text. Interim H3 wording (h3-sim kept the client
 * compiling); h3-client owns the final H3 strings (DESIGN.md H3 "Toasts").
 */

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
  const first = `${name} held: ${counts}, ${r.guardsKilled} guards stripped`;
  const why =
    rates.killPerSecX10 <= rates.regrowPerSecX10
      ? 'Regrowth outpaced the wave.'
      : `Too few ships to strip all ${guardianStatus(world, r.node).totalCap} guards before the wave was lost. Send more at once.`;
  return `${first}\n${why} ${rate}`;
}
