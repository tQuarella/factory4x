import type { FieldFlag } from './field-flags.ts';
import type { FieldResult } from './field-runner.ts';

/**
 * The H10 hive columns and calibration targets 1-6 (DESIGN.md "Calibration targets (H10)"), as report lines. They are
 * REPORTED until h10-design-data says they hold (h10-bots acceptance 5): never gates, and never a failure.
 */

const rowsOf = (results: readonly FieldResult[], name: string): FieldResult[] => results.filter((r) => r.strategy === name);
const at = (rs: readonly FieldResult[], name: string, seed: number): FieldResult | undefined => rs.find((r) => r.strategy === name && r.seed === seed);
/** The hive time of a won run, in ticks, else null. */
const winTick = (r: FieldResult | undefined): number | null => (r !== undefined && r.outcome === 'won' ? r.hiveTick : null);

/** The hive's guards at home when the winning wave landed, against its caps; null for a run that did not win (or a won run with no battle at the hive). */
export function winLanding(r: FieldResult): { home: number; cap: number } | null {
  const last = r.hive.pushes[r.hive.pushes.length - 1];
  return r.outcome === 'won' && last !== undefined && last.won ? { home: last.home, cap: last.cap } : null;
}

/** The landing as a whole percent of the caps (rounded to the nearest), or null. */
export function landingPct(r: FieldResult): number | null {
  const l = winLanding(r);
  return l === null || l.cap === 0 ? null : Math.round((l.home * 100) / l.cap);
}

/** Hive-damaging events before the win (target 2): every event of a run that did not win. */
export function eventsBeforeWin(r: FieldResult): number {
  return r.hive.events.filter((e) => r.hiveTick === null || e.tick < r.hiveTick).length;
}

/** True when `t` won at least `pct` percent later than `a` (exact integers; both must have won). */
export function atLeastSlower(a: FieldResult | undefined, t: FieldResult | undefined, pct: number): boolean {
  const x = winTick(a);
  const y = winTick(t);
  return x !== null && y !== null && y * 100 >= x * (100 + pct);
}

/** Target 1 on one seed: `undefended` finishes at least 10% slower than `adaptive`, or doesn't win (adaptive must win). */
export function target1(a: FieldResult | undefined, u: FieldResult | undefined): boolean {
  return a !== undefined && u !== undefined && winTick(a) !== null && (u.outcome !== 'won' || atLeastSlower(a, u, 10));
}

/** Target 3 on one seed: `one-push` finishes at least 10% slower than `adaptive`, or doesn't win (adaptive must win). */
export function target3(a: FieldResult | undefined, o: FieldResult | undefined): boolean {
  return a !== undefined && o !== undefined && winTick(a) !== null && (o.outcome !== 'won' || atLeastSlower(a, o, 10));
}

/** Target 4 on one seed: `two-push` finishes no more than 10% behind `one-push`, or wins where one-push doesn't. */
export function target4(o: FieldResult | undefined, w: FieldResult | undefined): boolean {
  if (o === undefined || w === undefined || w.outcome !== 'won') return false;
  const x = winTick(o);
  return x === null || (w.hiveTick ?? 0) * 100 <= x * 110;
}

/** The period the sweep is centred on while the shipped `hive.rebuildTicks` is 0 (DESIGN.md: 600 unless calibration says otherwise). */
export const SWEEP_CENTRE = 600;

/** The runs of one rebuild period in the sweep section: one seed (every seed is the same run), by strategy. */
export interface SweepRun {
  rebuildTicks: number;
  results: FieldResult[];
}

/** A strategy's win time against a base run, as "+12%" (12% slower), or its outcome when it did not win. */
export function pctText(a: FieldResult | undefined, t: FieldResult | undefined): string {
  if (a === undefined || t === undefined) return 'no run';
  if (t.outcome !== 'won') return t.outcome;
  const x = winTick(a);
  const y = winTick(t);
  return x === null || y === null ? 'n/a' : `${y >= x ? '+' : ''}${Math.round(((y - x) * 100) / x)}%`;
}

/** Game ticks as minutes with one decimal, or "no win". */
const minutes = (t: number | null): string => (t === null ? 'no win' : (t / 1800).toFixed(1));

/**
 * The six H10 calibration targets as report lines, all `reported`. 1-4 and 6 read `results` (every seed of the suite, at the
 * shipped `hive.rebuildTicks`); 5 reads the sweep's runs at 0.75 and 1.25 times the shipped value (450 and 750 around 600) and
 * says so when the sweep was not run.
 */
export function computeH10Lines(results: readonly FieldResult[], sweep: readonly SweepRun[] | null, shipped: number): FieldFlag[] {
  const seeds = rowsOf(results, 'adaptive').map((r) => r.seed);
  const out: FieldFlag[] = [];
  const line = (name: string, pass: boolean, detail: string): void => {
    out.push({ name, pass, detail: seeds.length === 0 ? 'no runs' : detail, reported: true });
  };
  const per = (f: (seed: number) => { ok: boolean; text: string }): { pass: boolean; detail: string } => {
    const rs = seeds.map((s) => ({ s, ...f(s) }));
    return { pass: rs.every((x) => x.ok), detail: rs.map((x) => `seed ${x.s}: ${x.text} ${x.ok ? 'ok' : 'MISS'}`).join('; ') };
  };
  {
    const r = per((s) => ({ ok: target1(at(results, 'adaptive', s), at(results, 'undefended', s)), text: `undefended ${pctText(at(results, 'adaptive', s), at(results, 'undefended', s))} against adaptive` }));
    line('H10 target 1, defending pays: undefended finishes at least 10% slower than adaptive, or does not win', r.pass, r.detail);
  }
  {
    const r = per((s) => {
      const a = at(results, 'adaptive', s)!;
      const l = winLanding(a);
      const ev = eventsBeforeWin(a);
      const home = l !== null && l.home * 100 <= 75 * l.cap;
      const landed = l === null ? 'no winning push' : `${l.home}/${l.cap} guards at home when the winning wave landed (${landingPct(a)}%, at most 75%: ${home ? 'yes' : 'no'})`;
      return { ok: home && ev >= 2, text: `${landed}, ${ev} hive-damaging events before the win (at least 2: ${ev >= 2 ? 'yes' : 'no'})` };
    });
    line('H10 target 2, attrition shows: the hive is at most 75% of its caps when the winning wave lands in adaptive\'s run, after at least 2 hive-damaging events (a prong beaten with 3 or more raiders killed, or a push that kills 5 or more guards)', r.pass, r.detail);
  }
  {
    const r = per((s) => ({ ok: target3(at(results, 'adaptive', s), at(results, 'one-push', s)), text: `one-push ${pctText(at(results, 'adaptive', s), at(results, 'one-push', s))} against adaptive` }));
    line('H10 target 3, one push is slower: one-push finishes at least 10% slower than adaptive, or does not win', r.pass, r.detail);
  }
  {
    const r = per((s) => {
      const o = at(results, 'one-push', s);
      const w = at(results, 'two-push', s);
      return { ok: target4(o, w), text: `two-push ${pctText(o, w)} against one-push${o !== undefined && o.outcome !== 'won' ? ' (one-push did not win)' : ''}` };
    });
    line('H10 target 4, a lost push is not wasted: two-push finishes no more than 10% behind one-push, or wins where one-push does not', r.pass, r.detail);
  }
  {
    const name = 'H10 target 5, robust: targets 1 and 3 still hold at 0.75 and 1.25 times the shipped hive.rebuildTicks';
    if (sweep === null) line(name, false, `not run (the sweep section needs \`npm run bots -- --sweep\`; shipped hive.rebuildTicks is ${shipped})`);
    else {
      // h10-bots ships hive.rebuildTicks 0 (H9's rule), so the sweep is centred on 600, the value h10-design-data starts from.
      const centre = shipped > 0 ? shipped : SWEEP_CENTRE;
      const rows = [75, 125].map((p) => {
        const ticks = Math.floor((centre * p) / 100);
        const run = sweep.find((s) => s.rebuildTicks === ticks);
        if (run === undefined) return { ok: false, text: `hive.rebuildTicks ${ticks}: not in the sweep` };
        const a = at(run.results, 'adaptive', 1);
        const t1 = target1(a, at(run.results, 'undefended', 1));
        const t3 = target3(a, at(run.results, 'one-push', 1));
        return { ok: t1 && t3, text: `hive.rebuildTicks ${ticks}: target 1 ${t1 ? 'holds' : 'MISS'}, target 3 ${t3 ? 'holds' : 'MISS'}` };
      });
      line(name, rows.every((x) => x.ok), `${rows.map((x) => x.text).join('; ')} (${shipped > 0 ? `shipped ${shipped}` : `shipped is 0 here, so centred on ${centre}`}, sweep on seed 1)`);
    }
  }
  {
    const r = per((s) => {
      const a = at(results, 'adaptive', s)!;
      const g = at(results, 'greedy', s);
      const aMin = winTick(a);
      const gMin = winTick(g);
      const aOk = aMin !== null && aMin >= 15 * 1800 && aMin <= 30 * 1800;
      const gOk = gMin !== null && gMin <= 40 * 1800;
      const first = a.raidLog[0]?.startTick ?? null;
      const fOk = first !== null && first >= 2 * 1800 && first <= 6 * 1800;
      return { ok: aOk && gOk && fOk, text: `adaptive ${minutes(aMin)} min (15 to 30: ${aOk ? 'yes' : 'no'}), greedy ${minutes(gMin)} min (at most 40: ${gOk ? 'yes' : 'no'}), first raid at ${first === null ? 'none' : (first / 1800).toFixed(1)} min (2 to 6: ${fOk ? 'yes' : 'no'})` };
    });
    line('H10 target 6, pace: adaptive takes 15 to 30 game minutes, greedy at most 40, and the first raid comes at 2 to 6 minutes', r.pass, r.detail);
  }
  return out;
}
