/**
 * h10-sim: the state H10 added, by name (DESIGN.md H10 "Save, data version and replay", "Identical at 0", and DECISIONS.md
 * "2026-11-17 · Director · H10 spec rulings" item 1). Hashing a world without exactly these lets a v17 run at
 * `hive.rebuildTicks` 0 and `raid.rollMax` 0 be compared with the v16 code's hashes. Nothing else is stripped:
 *   - the two new sim tunables, `tun['hive.rebuildTicks']` and `tun['raid.rollMax']` (`client.raidSlowdown` is a client key and
 *     never in `world.tun`);
 *   - `dataVersion` (17 against 16) — only when `dataVersion` is true, for comparisons across data versions;
 *   - `field.hiveRebuildProgress`;
 *   - per prong (the raid itself and each of `raid.others`), `rolls` and `hitRocks`;
 *   - per prong of the last result, `lastRaid.prongs[i].hitRocks`;
 *   - `stats.raidRolls`.
 */
export const H10_SIM_KEYS = ['hive.rebuildTicks', 'raid.rollMax'] as const;

type Loose = Record<string, unknown>;

/** A deep copy of `world` without the H10 state listed above (the copy is plain JSON; the world is untouched). */
export function withoutH10(world: unknown, opts: { dataVersion?: boolean } = {}): Loose {
  const c = JSON.parse(JSON.stringify(world)) as Loose & {
    tun: Loose;
    stats: Loose;
    field: Loose | null;
    raid: (Loose & { others?: Loose[] }) | null;
    lastRaid: (Loose & { prongs: Loose[] }) | null;
  };
  if (opts.dataVersion === true) delete c.dataVersion;
  for (const k of H10_SIM_KEYS) delete c.tun[k];
  if (c.field !== null && c.field !== undefined) delete c.field.hiveRebuildProgress;
  if (c.raid !== null && c.raid !== undefined) {
    for (const p of [c.raid, ...(c.raid.others ?? [])]) {
      delete p.rolls;
      delete p.hitRocks;
    }
  }
  if (c.lastRaid !== null && c.lastRaid !== undefined) for (const p of c.lastRaid.prongs) delete p.hitRocks;
  delete c.stats.raidRolls;
  return c;
}
