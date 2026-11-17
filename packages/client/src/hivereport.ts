/** H10 texts: the hive's guard count and rebuild, the roll segment of the banner, "Hive −N". Every number comes from a sim selector. */
import { raidFightLineProngs, secsText } from './fieldreport.ts';

/** A no-break space, so "Hive −12" never wraps between the word and the number. */
const NBSP = String.fromCharCode(160);
const TYPE_WORD = { thorn: 'Thorn', spore: 'Spore' } as const;

/**
 * The hive sheet's line: "Guards 18 / 30 · +1 Thorn in 14 s" while the rebuild queue has something to add, "Guards 30 / 30" when full.
 * Null without a rebuild queue (`rebuild` null: `hive.rebuildTicks` 0), where the per-type rows keep their regrow text.
 */
export function hiveGuardsLine(total: number, cap: number, rebuild: Readonly<{ ticks: number; progress: number; nextType: 'thorn' | 'spore' | null }> | null, tickRate: number): string | null {
  if (rebuild === null) return null;
  const base = `Guards ${total} / ${cap}`;
  if (total >= cap || rebuild.nextType === null) return base;
  return `${base} · +1 ${TYPE_WORD[rebuild.nextType]} in ${secsText(Math.max(0, rebuild.ticks - rebuild.progress), tickRate)}`;
}

/** The hive's map label count, "18/30", while it is below its caps; null when full. */
export function hiveLabelCount(total: number, cap: number): string | null {
  return total < cap ? `${total}/${cap}` : null;
}

/** " · Hive −N" for a raid's raiders killed away from the hive (the sum of `hiveLost`); empty at 0. */
export function hiveLostText(n: number): string {
  return n > 0 ? ` · Hive${NBSP}−${n}` : '';
}


/** One prong of the live banner line (see `raidLiveLine`). */
export interface LiveProng {
  target: string;
  phase: string;
  left: number;
  /** The rock a rolling prong left (its name), or null. */
  rolledFrom: string | null;
}

/**
 * The banner line after the launch. A prong that rolled and is flying on reads "A5 hit → A6"; the others read as in H9
 * ("Raid at A5: 3 left"). With no rolling prong the text is H9's, unchanged.
 */
export function raidLiveLine(prongs: ReadonlyArray<LiveProng>): string {
  const fighting = prongs.filter((p) => p.phase === 'fight');
  const rolling = prongs.filter((p) => p.phase === 'out' && p.rolledFrom !== null);
  if (rolling.length === 0 && fighting.length === 0) return '';
  if (rolling.length === 0) return raidFightLineProngs(fighting.map((p) => ({ target: p.target, left: p.left })));
  const segs = [...fighting.map((p) => `${p.target}: ${p.left} left`), ...rolling.map((p) => `${p.rolledFrom} hit → ${p.target}`)];
  return `${fighting.length > 0 ? 'Raid at' : 'Raid'} ${segs.join(' · ')}`;
}
