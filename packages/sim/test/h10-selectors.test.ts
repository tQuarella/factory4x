import { describe, expect, it } from 'vitest';
import {
  campaignWorld,
  fieldSummary,
  guardianAt,
  guardianStatus,
  step,
  withRunMode,
  type Input,
  type World,
} from '../src/index.ts';
import { hiveRegrowPeriod } from '../src/factions/index.ts';
import { syncExtractors } from '../src/field.ts';
import { fixtureV16 } from './fixture.ts';
import { F, addEcon, quietField } from './field-helpers.ts';
import { addShips } from './helpers.ts';

/**
 * h10-sim acceptance 6: the H10 selectors (DESIGN.md H10 "Selectors"): `guardianStatus(hive).rebuild`, the hive's regrow rows
 * (the R9 readout fix and the D2 values) and `fieldSummary.hive`. (`hiveAfter` is in h10-rebuild.test.ts, the roll fields of
 * `raidStatus` and `RaidResult` in h10-roll.test.ts.) On the frozen v16 fixture: the hive holds 12 Thorns and 18 Spores, and
 * guard.thorn.regrowTicks 60, guard.spore.regrowTicks 20, hive.regrowPct 200.
 */
const D = fixtureV16;
const tick = (w: World, ...inputs: Input[]) => step(w, D, inputs);
const run = (w: World, n: number) => {
  for (let i = 0; i < n; i++) step(w, D, []);
};
const hive = (w: World) => guardianAt(w, F.heart)!;
const sheet = (w: World) => guardianStatus(w, F.heart);
const rows = (w: World) => ({ thorn: [sheet(w).guards.thorn.regrowProgress, sheet(w).guards.thorn.regrowTicks], spore: [sheet(w).guards.spore.regrowProgress, sheet(w).guards.spore.regrowTicks] });

function dropNewest(w: World, type: 'thorn' | 'spore', n: number): void {
  const h = hive(w);
  for (let k = 0; k < n; k++) {
    let i = h.guards.length - 1;
    while (h.guards[i]!.type !== type) i--;
    h.guards.splice(i, 1);
  }
}

describe('guardianStatus(hive).rebuild', () => {
  it('null at hive.rebuildTicks 0; above 0 { ticks, progress, nextType }, nextType being D3\'s pick now or null when nothing is missing', () => {
    const w = quietField(D);
    expect(sheet(w).rebuild).toBeNull();
    w.tun['hive.rebuildTicks'] = 600;
    expect(sheet(w).rebuild).toEqual({ ticks: 600, progress: 0, nextType: null });
    dropNewest(w, 'thorn', 2);
    dropNewest(w, 'spore', 3);
    run(w, 100);
    // 2 × 18 = 3 × 12: the tie goes to Thorn.
    expect(sheet(w).rebuild).toEqual({ ticks: 600, progress: 100, nextType: 'thorn' });
    dropNewest(w, 'spore', 1); // 2 × 18 < 4 × 12
    expect(sheet(w).rebuild).toEqual({ ticks: 600, progress: 100, nextType: 'spore' });
    // `total` and `totalCap` give "24 / 30".
    expect([sheet(w).total, sheet(w).totalCap]).toEqual([24, 30]);
  });

  it('null for a pocket, for the dead hive, and for a campaign area\'s heart', () => {
    const w = quietField(D);
    w.tun['hive.rebuildTicks'] = 600;
    expect(guardianStatus(w, F.p1).rebuild).toBeNull();
    hive(w).guards = [];
    addShips(w, F.heart, 1);
    tick(w);
    expect(hive(w).alive).toBe(false);
    expect(sheet(w).rebuild).toBeNull();
    const d = withRunMode(D, 'campaign');
    const c = campaignWorld(1, d, { reclaimed: ['landfall'], land: 'shelf' });
    c.tun['hive.rebuildTicks'] = 600;
    const heart = c.guardians.find((g) => c.nodes[g.node]!.kind === 'heart')!;
    expect(guardianStatus(c, heart.node).rebuild).toBeNull();
  });
});

describe('the hive\'s GuardRow regrow readout (the R9 fix, and D2)', () => {
  it('under R9 the period is guard.<type>.regrowTicks × hive.regrowPct ÷ 100: 120 and 40 at v16, and the hive regrows on exactly that tick', () => {
    const w = quietField(D);
    expect(rows(w)).toEqual({ thorn: [0, 120], spore: [0, 40] });
    dropNewest(w, 'thorn', 1);
    run(w, 119);
    expect(rows(w).thorn).toEqual([119, 120]);
    expect(hive(w).guards.filter((g) => g.type === 'thorn')).toHaveLength(11);
    tick(w);
    expect(hive(w).guards.filter((g) => g.type === 'thorn')).toHaveLength(12);
  });

  it('non-default values: floored when the product doesn\'t divide (61 × 150 ÷ 100 = 91.5 → 91), the base itself at 100%, and matching the sim', () => {
    const w = quietField(D);
    w.tun['guard.thorn.regrowTicks'] = 61;
    w.tun['hive.regrowPct'] = 150;
    w.tun['guard.spore.regrowTicks'] = 5;
    expect(rows(w)).toEqual({ thorn: [0, 91], spore: [0, 7] }); // 5 × 1.5 = 7.5 → 7
    dropNewest(w, 'thorn', 1);
    run(w, 90);
    expect(hive(w).guards.filter((g) => g.type === 'thorn')).toHaveLength(11);
    tick(w);
    expect(hive(w).guards.filter((g) => g.type === 'thorn')).toHaveLength(12);
    w.tun['hive.regrowPct'] = 100;
    expect(rows(w)).toEqual({ thorn: [0, 61], spore: [0, 5] });
    w.tun['hive.regrowPct'] = 1000;
    expect(rows(w)).toEqual({ thorn: [0, 610], spore: [0, 50] });
  });

  it('the period is at least 1 tick (unreachable in the tuning ranges, whose smallest product is 5 × 100%: shown with a constructed 0)', () => {
    const w = quietField(D);
    w.tun['guard.spore.regrowTicks'] = 0;
    expect(hiveRegrowPeriod(w, hive(w), 'spore')).toBe(1);
    expect(rows(w).spore).toEqual([0, 1]);
  });

  it('a pocket\'s rows and a campaign heart\'s stay rule 9\'s period (no hive.regrowPct)', () => {
    const w = quietField(D);
    expect([guardianStatus(w, F.p2).guards.thorn.regrowTicks, guardianStatus(w, F.p2).guards.spore.regrowTicks]).toEqual([60, 20]);
    const d = withRunMode(D, 'campaign');
    const c = campaignWorld(1, d, { reclaimed: ['landfall'], land: 'shelf' });
    const heart = c.guardians.find((g) => c.nodes[g.node]!.kind === 'heart')!;
    expect(guardianStatus(c, heart.node).guards.spore.regrowTicks).toBe(c.tun['guard.spore.regrowTicks']);
  });

  it('under D2 the rows show progress 0 and the queue\'s period (hive.rebuildTicks), whatever the queue\'s count', () => {
    const w = quietField(D);
    w.tun['hive.rebuildTicks'] = 450;
    dropNewest(w, 'spore', 2);
    run(w, 200);
    expect(rows(w)).toEqual({ thorn: [0, 450], spore: [0, 450] });
    expect(sheet(w).rebuild).toEqual({ ticks: 450, progress: 200, nextType: 'spore' });
  });
});

describe('fieldSummary.hive', () => {
  it('{ alive, cap, lostToRaids, lostToPushes }: raiders killed at rocks, guards killed in battles at the hive; a pocket\'s losses count in neither', () => {
    const w = quietField(D);
    w.tun['raid.firstAtEcon'] = 2;
    w.tun['raid.econPerRaider'] = 2;
    w.tun['hive.rebuildTicks'] = 3600; // slow enough that nothing is rebuilt in this test, so the counts read plainly
    expect(fieldSummary(w).hive).toEqual({ alive: 30, cap: 30, lostToRaids: 0, lostToPushes: 0 });
    // A raid of 3 (6 economy ships at a5) beaten by Flak at a5.
    w.field!.mine[F.a5] = true;
    addEcon(w, 'extractor', F.a5, F.a5);
    for (let i = 0; i < 5; i++) addEcon(w, 'hauler', F.a5, F.a5);
    syncExtractors(w);
    addShips(w, F.a5, 6, 'flak');
    for (let i = 0; i < 3000 && w.lastRaid === null; i++) tick(w);
    expect(w.lastRaid).toMatchObject({ outcome: 'beaten', killed: { thorn: 1, spore: 2 } });
    w.tun['raid.enabled'] = 0;
    expect(fieldSummary(w).hive).toEqual({ alive: 27, cap: 30, lostToRaids: 3, lostToPushes: 0 });
    // A battle at the pocket p2 (1 Thorn, 2 Spores): eight Drones take it; no hive loss.
    addShips(w, F.p2, 8);
    for (let i = 0; i < 900 && guardianAt(w, F.p2)!.alive; i++) tick(w);
    expect(guardianAt(w, F.p2)!.alive).toBe(false);
    expect(guardianAt(w, F.p2)!.guardsKilled).toBe(4); // its 3, and a Spore that regrew mid-battle (rule 9)
    expect(fieldSummary(w).hive).toEqual({ alive: 27, cap: 30, lostToRaids: 3, lostToPushes: 0 });
    // A push at the hive that kills some guards and loses.
    w.tun['ship.drone.damage'] = 20;
    addShips(w, F.heart, 2);
    for (let i = 0; i < 300 && w.ships.some((s) => s.at === F.heart); i++) tick(w);
    const pushed = hive(w).guardsKilled;
    expect(pushed).toBeGreaterThan(0);
    expect(fieldSummary(w).hive).toEqual({ alive: hive(w).guards.length, cap: 30, lostToRaids: 3, lostToPushes: pushed });
    expect(hive(w).guards.length).toBe(27 - pushed);
  });
});
