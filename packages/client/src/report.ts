import {
  activeBattles,
  combatRates,
  guardianStatus,
  supplyStatus,
  type BattleResult,
  type GuardianParams,
  type World,
} from '@factory4x/sim';
import { fmt10 } from './format.ts';

/** Player-facing name of a guarded node: "Bloom" or "Root". */
export function guardName(world: Readonly<World>, node: number): string {
  return world.nodes[node]!.kind === 'root' ? 'Root' : 'Bloom';
}

/** Game seconds with one decimal: 60 ticks at 30/s -> "2.0". */
function secs(ticks: number, tickRate: number): string {
  return (ticks / tickRate).toFixed(1);
}

/** "12 thorns, regrows 1 / 2.0 s, repairs 2" or, starved, "8 thorns, 1 / 10.0 s, no repair". */
function paramsText(p: GuardianParams, tickRate: number, short: boolean): string {
  const repair = p.repairPerRound > 0 ? `repairs ${p.repairPerRound}` : 'no repair';
  const regrow = `${short ? '' : 'regrows '}1 / ${secs(p.regrowTicks, tickRate)} s`;
  return `${p.cap} thorns, ${regrow}, ${repair}`;
}

/** The Root sheet's "Feeds the Bloom" box, from live tunables. */
export function feedsBloomText(world: Readonly<World>, bloomCaptured: boolean): string {
  const s = supplyStatus(world);
  if (bloomCaptured) return 'The Bloom is already yours. Cutting the Root changes nothing more.';
  const cut = paramsText(s.starvedBloom, world.tickRate, true);
  if (!s.rootAlive) return `The Root is cut, so the Bloom is starved: ${cut}.`;
  return `While the Root lives, the Bloom has ${paramsText(s.fedBloom, world.tickRate, false)}. Cut it: ${cut}.`;
}

/** The line under the Bloom's thorn count on its sheet. */
export function supplyLine(world: Readonly<World>): string {
  const s = supplyStatus(world);
  if (!s.rootAlive) return 'Starved: Root cut';
  const v = s.starvedBloom;
  return `Fed by the Root (cut it: ${v.cap} thorns, 1 / ${secs(v.regrowTicks, world.tickRate)} s)`;
}

/** Battle banner: one line per running battle, prefixed with the node name. */
export function bannerLines(world: Readonly<World>): string[] {
  return activeBattles(world).map(
    (b) => `${guardName(world, b.node).toUpperCase()} · strip ${fmt10(b.killPerSecX10)}/s · regrow ${fmt10(b.regrowPerSecX10)}/s · ${b.shipsLost} lost`,
  );
}

/** How much slower (or faster) the starved Bloom regrows, as "5× slower". */
export function regrowChange(world: Readonly<World>): string {
  const s = supplyStatus(world);
  const fed = Math.max(1, s.fedBloom.regrowTicks);
  const starved = Math.max(1, s.starvedBloom.regrowTicks);
  if (starved === fed) return 'regrows at the same speed';
  return starved > fed
    ? `regrows ${fmt10(Math.round((starved * 10) / fed))}× slower`
    : `regrows ${fmt10(Math.round((fed * 10) / starved))}× faster`;
}

/**
 * Battle report toast text (DESIGN.md "Observable values"), plus a plain
 * reason line so a failed wave reads as a lesson: regrowth outpaced it, or
 * the wave was too small.
 */
export function battleReport(world: Readonly<World>, r: BattleResult): string {
  const sent = r.shipsEngaged;
  const counts = `${sent} sent, ${r.shipsLost} lost`;
  const name = guardName(world, r.node);
  if (r.outcome === 'captured') {
    if (name === 'Bloom') return `Captured: ${counts}`;
    if (!r.wilt) return `Root cut: ${counts}.`;
    const w = r.wilt;
    const change = regrowChange(world);
    return w.from > w.to
      ? `Root cut: ${counts}. The Bloom wilts: ${w.from} → ${w.to} thorns, ${change}.`
      : `Root cut: ${counts}. The Bloom is already at ${w.to} thorns and ${change}.`;
  }
  const rates = combatRates(world, sent, r.node);
  const rate = `${sent} ships strip ${fmt10(rates.killPerSecX10)} thorns/s; the ${name} regrows ${fmt10(rates.regrowPerSecX10)}/s.`;
  if (r.outcome === 'withdrew') return `Wave withdrew: ${counts}, ${r.thornsKilled} thorns stripped\n${rate}`;
  const first = name === 'Root' ? `Root held: ${counts}, ${r.thornsKilled} thorns stripped` : `Wave repelled: ${counts}, ${r.thornsKilled} thorns stripped`;
  const why =
    rates.killPerSecX10 <= rates.regrowPerSecX10
      ? 'Regrowth outpaced the wave.'
      : `Too few ships to strip all ${guardianStatus(world, r.node).cap} thorns before the wave was lost. Send more at once.`;
  return `${first}\n${why} ${rate}`;
}
