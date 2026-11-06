import { combatRates, type BattleResult, type World } from '@factory4x/sim';
import { fmt10 } from './format.ts';

/**
 * Battle report toast text (DESIGN.md "Observable values"), plus a plain
 * reason line so a failed wave reads as a lesson: regrowth outpaced it, or
 * the wave was too small.
 */
export function battleReport(world: Readonly<World>, r: BattleResult): string {
  const sent = r.shipsEngaged;
  const counts = `${sent} sent, ${r.shipsLost} lost`;
  if (r.outcome === 'captured') return `Captured: ${counts}`;
  const head = r.outcome === 'repelled' ? 'Wave repelled' : 'Wave withdrew';
  const first = `${head}: ${counts}, ${r.thornsKilled} thorns stripped`;
  const rates = combatRates(world, sent);
  const rate = `${sent} ships strip ${fmt10(rates.killPerSecX10)} thorns/s; the Bloom regrows ${fmt10(rates.regrowPerSecX10)}/s.`;
  if (r.outcome === 'withdrew') return `${first}\n${rate}`;
  const why =
    rates.killPerSecX10 <= rates.regrowPerSecX10
      ? 'Regrowth outpaced the wave.'
      : `Too few ships to strip all ${world.tun['guardian.cap']} thorns before the wave was lost. Send more at once.`;
  return `${first}\n${why} ${rate}`;
}
