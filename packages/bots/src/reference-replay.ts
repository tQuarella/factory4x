import { SEND_ALL, defaultData, type Input, type Replay } from '@factory4x/sim';

/**
 * Fixed replay used by the determinism gate (Node, 9000 ticks) and the smoke test (browser, 3000 ticks). Grow it
 * as mechanics land so it exercises every system.
 *
 * h7-sim (DESIGN.md H7 "Save, data version and replay"): regenerated in field mode. It starts from createWorld on
 * the shipped data (run.mode "field"), so the landing is the run start (F13). The H6 campaign replay lives on as a
 * campaign-mode test (packages/sim/test/campaign-replay.ts). Live tuning at tick 0 makes it fast: cheap, quick
 * ships, rich rocks, half guard caps and slow regrowth, and a fleet limit of 12 that the economy reaches. In order
 * (ticks from a run of the final script; reference-replay.test.ts checks each):
 *
 *   - 0: the landing, economy weights 3 / 2 and warships 0. Five setMine off leave a1 and a2 marked (4 slots), so
 *     the fifth extractor (tick 271) finds no slot and parks idle at the probe. The rally is the ice pocket p1.
 *   - 280: setAlloc extractor 0 and hauler 0; the part-filled extractor share goes back to stock.
 *   - 400: setMine a3 on: a slot opens and the idle extractor is re-dispatched there the same tick.
 *   - 450: setAlloc drone 3 and flak 2 (the Flak is locked until ice is delivered). Two drones fill the limit of 12;
 *     the first takes p1 at tick 600 (Mine-marked at capture, with its free extractor). The drone share waits
 *     at the limit (fleetFull).
 *   - 600: setMine a1 off: its two extractors unbind; one re-dispatches to p1's free slot, one idles. a1's haulers
 *     reassign, ice is delivered (tick 827) and the Flak unlocks; its full share waits at the limit too.
 *   - 850: setAlloc drone 0 returns the drone share. 900: recycleShips of a docked extractor at a2 frees its slot
 *     (the idle extractor takes it) and a place in the fleet, which the Flak bay takes, paying its ice.
 *   - 2400: the drones and the Flak take the crystal pocket p2 (sendShips).
 *   - 7000 (h7-raids): the fleet limit rises to 40, the rally goes back to the probe and drones get all the ore, so the
 *     new warships wait at the probe. 7750: sendShips from the probe to the hive. It falls at tick 8010.
 *
 * h8-sim (DESIGN.md H8 "Save, data version and replay"): everything above runs with hauler.autoNeed 0 (set at tick
 * 0), H7's haulers exactly, so the H7 items and their timings stay as they were. The H8 items follow the hive's fall,
 * once raids have ended, with hauler.autoNeed back to 1 (the shipped default):
 *   - 8100: hauler.autoNeed 1, the hauler weight 2, drone and flak 0. a2 has 3 haulers for a target of 2: the first
 *     to reach the probe leaves it (8167) and takes the heart's shortfall (a rebalance and a need-based pick).
 *   - 8150: recycleFleet of 3 drones frees 3 places under the limit of 40; the probe builds exactly the 3 haulers the
 *     rocks are short of (p2, a3, the heart, each the largest shortfall when it spawns), then the Hauler is `enough`.
 *   - 8400: setHaulers a2 1. Its next hauler home (8437) is over the target, leaves a2 and, with no rock short,
 *     parks idle at the probe.
 *   - 8450: moveShips split from the heart to p2 (per type, half of 13 drones and 14 Flak), and moveShips split from
 *     p1, where one Flak stands (half is 0, so the 1-ship fallback sends it).
 *   - 8488: recycleFleet of 1 extractor and 4 haulers: the docked extractor at a2 (no extractor idles), and the
 *     haulers in order: the idle one, those parked at a3 and at the heart, then the lowest id in transit.
 *   - 8650: moveShips all from p2 to a3 (the split group, arrived, plus the Flak there).
 *   - 8660 (round 2): p2 and the hive unmarked, the Extractor weight 3: the bay builds for a2's free slot and the share
 *     refills (p1 has a slot). 8670: p1 unmarked; every marked slot is taken, so the Extractor is `enough` from 8690
 *     with its full share kept. 8720: a4 marked (the fleet limit to 45, hauler cargo to 2): the bay restarts, haulers
 *     are picked for a4 while it is staffed but not haulable, wait there empty, and load after the extractor docks.
 *
 * The raids (DESIGN.md H7 R1-R9) run on their own from tick 95, when the economy reaches 6 ships, and the script
 * leaves them alone: raid 1 musters at a1 and, a1 being stopped at 600, retargets to the captured p1, where the rally
 * defenders beat it (tick 900). Raid 2 (muster 3600) hits p1 after the ships went to p2. Under h7 and h8 raid 3 (muster 7265)
 * was at p1 when the hive fell at 8010, and withered; under h9-raids that is raid 4 (see below), and raid 3 is a prong raid.
 *
 * h8-raids (DESIGN.md H8 H9 and H10; raid.shieldEcon and raid.haulersHold are 1 in the shipped data, so every raid above
 * runs under both):
 *   - 4100: one Drone goes from p2 to p1 (arrives 4169), a lone defender for raid 2. 4250: the raiders' damage is raised
 *     to 6 each (back to 1 at 4330), so their first round (4290) kills the Drone with overflow to spare. The shield
 *     (H9) loses the overflow: p1's docked extractor survives round 1 and dies in round 2 (4320), when no warship stands.
 *   - Raid 2's haulers are held (H10) from its launch (4049) to the tick its outcome is decided (4350, when it leaves p1 for home;
 *     it lands at 4565): the ones assigned to p1 wait at the probe and leave the tick after. Raid 1 held them at p1 too.
 *   - 8440: recycleShips of one Flak at p1. The Drone's fall at 4290 freed a place in the fleet limit that the Flak weight
 *     filled, so p1 held two Flak by 8450 and the 1-ship fallback below would not have been exercised.
 *
 * h9-sim (DESIGN.md H9 "Save, data version and replay", the extractor dial, items (a)-(f)); reference-replay.test.ts
 * checks each:
 *   - 1 (f): setExtractors on the guarded pocket p2 and the guarded hive: invalid, ignored, nothing changes.
 *   - 8760: ship.speedSu 20 (after a4's extractor launched at 8750, so the H8 a4 item keeps its timing; it makes the dial's
 *     extractor flights short). (e) setExtractors a1 1 while a1 is unmarked: kept. (f) setExtractors a2 0 and a2 3 (above
 *     its 2 slots): invalid, ignored, nothing changes.
 *   - 8761: a1 marked again with setExtractors a2 1. (a) a2's highest-id docked extractor is unbound and re-dispatches
 *     to a1, the marked rock with room; (e) a1 takes one (its kept count), not its two slots; (b) the Extractor stays
 *     enough, its share held and its bay idle, with a1 and a2 each one under their slots. a2 keeps its hauler (set 1).
 *   - 8800: (d) setExtractors a1 null (All): the bay starts that tick, and the extractor docks at a1 (need 3 haulers).
 *   - 8880: (a) setExtractors a1 1: the new extractor finds no marked rock with room, flies home and parks idle;
 *     (b) the Extractor is enough again; (c) a1's target drops from 3 to 2 and the first of its haulers home leaves it
 *     at that delivery and parks idle.
 *
 * h9-raids (DESIGN.md H9 "Save, data version and replay", items (g)-(n); reference-replay.test.ts checks each). From tick 4400
 * (raid 2 is over at 4565 and the items above it are untouched) raids may split from 4 raiders: raid.prongMinSize 2,
 * raid.econPerRaider 2, a muster of 150 and a gap of 900 (1400 from tick 5000, so that the last raid is out when the hive falls).
 * One sacrificial extractor is built to be hit: ship.extractor.hp 24 for its build (4410-4500), with the fleet limit 13 and the
 * Flak weight 0 for that window, so the free place goes to the Extractor, which docks at p1 (the only rock with room).
 *   - (n) Raids 1 and 2 (3 raiders or fewer, under the split size 2 x raid.prongMinSize 4 of the data) stay one prong, although
 *     raid 2 has three raidable rocks.
 *   - (g) Raid 3 musters at 5465 with 2 prongs, at p1 and a3 (hive order): its 2 Thorns and 3 Spores are dealt 1T 2S and 1T 1S (W2).
 *   - 5550: the two Flak at p1 go to a2, so p1 is undefended. 5690: p2 is capped at one extractor (its free one fills it), so a3's
 *     extractor, which the next input unbinds, has nowhere to go but the probe. 5700: a3 is unmarked.
 *   - (h) Both prongs launch at 5614 and arrive on different ticks: p1 at 5829, a3 at 5859.
 *   - (l) a3 is no longer raidable on arrival (5859): prong 1 retargets once, to p2, skipping p1, the nearest rock but prong 0's live
 *     target (W5). p2 is raidable because the unmark sent hauler 41 there; the Drone and the Flak at p2 defend it.
 *   - 5870: a3 is marked again and its extractor goes back to it. 6000: the p2 cap is lifted and the Flak return to p1.
 *   - (j) Prong 0 strikes the 24 hp extractor at p1 (no warship there) every round from 5850, three damage a round, while prong 1,
 *     at p2, has warships at its target and so strikes warships only (the shield).
 *   - (i) Prong 1 is beaten at p2 in its first round (6060), where prong 0 kills the extractor: the raid is a hit (one prong
 *     beaten, one hit; raidProngs {beaten 2, hit 2} with raids 1 and 2), and the gap runs from the last prong, which lands at 6305
 *     (6384 since h10-sim: prong 0 rolls on to a5 first, item (g) below).
 *   - (k) The hold at p2 ends at prong 1's outcome (6060) while prong 0 still fights at p1; p1's ends at its own (6090).
 *   - 6070: p2 is unmarked until 6600, so that hauler 41, which the a3 unmark sent to p2, goes back to a3 at its next delivery.
 *   - (m) Raid 4 musters at 7705 with 2 prongs (p1 and a3). At 7800 guard.capPct 85 and raid.hiveKeepPct 90 leave the hive 2 spare
 *     guards (both back to 50 at 7860), so at its launch (7854) it drops to one prong, at p1. It is out when the hive falls at 8010,
 *     and withers (raid 4, the old raid 3).
 *
 * h10-sim (DESIGN.md H10 "Save, data version and replay", items (a)-(h); reference-replay.test.ts checks each). hive.rebuildTicks is
 * 300 from tick 0, so the hive rebuilds by D2's queue throughout; it starts above its caps (it is built at guard.capPct 100,
 * which tick 0 halves), so nothing rebuilds until 650, when guard.capPct 88 makes its caps 10 Thorns and 15 Spores: the count
 * the H9 items had left it at by raid 4 (10T 15S at 7705), so every raid and fight above keeps its sizes and timing. Below those
 * caps the queue refills it, one guard per 300 ticks, never above them.
 *   - (c) 1900-1995: with the fleet limit at 17 and the rally at the probe, 3 Drones and 2 Flak are built and sent to the hive.
 *     They land at 2234 and lose (2250-2310): 5 Thorns and 5 Spores die, and the queue counts through the battle.
 *   - (b) The queue's picks from 7T 11S: a Thorn (3T 4S missing), a Spore (2T 4S: Spores further below), a Thorn on the tie at
 *     2T 3S (3359), a Spore (1T 3S), and so on until full at 4859.
 *   - (f) 2700: hive.rebuildTicks 0 mid-rebuild (R9's timers run from 0), and back to 300 at 2760 (the queue starts from 0).
 *   - (d) 3600: raid 2 musters mid-rebuild after the beaten raid 1. raid.econPerRaider 2 and raid.hiveKeepPct 72 for that tick
 *     (3 and 50 again at 3601) make its want 5 and its size alive − keep = 21 − 18 = 3, the size it had.
 *   - (e) Raid 2 lands at 4565 while the queue counts (its Thorn died at 4290): the rejoin leaves the progress as it was.
 *   - (a) Raid 3's prong 1 is beaten at p2 at 6060 with the hive at its caps: the deficit's 300th tick (6359) adds a Thorn.
 *   - (g) 5870: raid.rollMax 1 (0 again at 6250), with a5 marked and one sacrificial extractor built for it (the fleet limit at
 *     14 for a tick, docked at 6033, after prong 1's retarget at 5859). At 6090 prong 0, which killed p1's extractor, rolls on
 *     to a5 (the hold moves), kills the sacrificial extractor (6210) and goes home (6240), landing at 6384. raid.gapTicks is
 *     1321 from 5000 (it was 1400), so raid 4 still musters at 7705.
 *   - (h) 7990: guard.capPct 100 puts the hive below its caps while the push lands, so the queue is counting when it falls at
 *     8010; the count drops to 0 and nothing rebuilds after.
 *
 * Node indices are the field's nodes in frame order: 0 probe, 1-7 a1-a7, 8 p1 (ice), 9 p2 (crystal), 10 heart.
 * It runs on the shipped data, so a calibration that changes the field's guards can break the script
 * (packages/sim/test/reference-replay.test.ts says so); the tunables it depends on are set at tick 0 to keep that
 * rare. h7-design-data (data v13) added the four raid knobs it calibrated (raid.econPerRaider 3, raid.maxSize 10,
 * raid.gapTicks 2700, hive.regrowPct 100: the values the raid timings below were written for).
 */
const at = (tick: number, ...inputs: Input[]) => inputs.map((input) => ({ tick, input }));
const tun = (key: Extract<Input, { type: 'setTunable' }>['key'], value: number): Input => ({ type: 'setTunable', key, value });
const mine = (node: number, on: boolean): Input => ({ type: 'setMine', node, on });
const ext = (node: number, count: number | null): Input => ({ type: 'setExtractors', node, count });
const alloc = (shipType: Extract<Input, { type: 'setAlloc' }>['shipType'], weight: number): Input => ({ type: 'setAlloc', shipType, weight });

export const referenceReplay: Replay = {
  seed: 20261114,
  dataVersion: defaultData.dataVersion,
  inputs: [
    ...at(
      0,
      tun('economy.probeOrePerMin', 60),
      tun('extractor.orePerMin', 40),
      tun('pocket.resourcePerMin', 40),
      tun('ship.extractor.cost', 5),
      tun('ship.extractor.buildTicks', 30),
      tun('ship.hauler.cost', 5),
      tun('ship.hauler.buildTicks', 30),
      tun('ship.hauler.speedSu', 6),
      tun('ship.drone.cost', 5),
      tun('ship.drone.buildTicks', 30),
      tun('ship.drone.damage', 20),
      tun('ship.flak.cost', 5),
      tun('ship.flak.buildTicks', 30),
      tun('guard.capPct', 50),
      tun('guard.thorn.damage', 1),
      tun('guard.spore.damage', 1),
      tun('guard.thorn.regrowTicks', 600),
      tun('guard.spore.regrowTicks', 600),
      tun('field.fleetCap', 12),
      tun('raid.econPerRaider', 3),
      tun('raid.maxSize', 10),
      tun('raid.gapTicks', 2700),
      tun('hive.regrowPct', 100),
      // h10-sim: the rebuild queue, inert until 650 (see above).
      tun('hive.rebuildTicks', 300),
      tun('hauler.autoNeed', 0),
      mine(3, false),
      mine(4, false),
      mine(5, false),
      mine(6, false),
      mine(7, false),
      { type: 'setRally', node: 8 },
    ),
    ...at(1, ext(9, 1), ext(10, 1)), // h9-sim (f): guarded, so invalid
    ...at(280, alloc('extractor', 0), alloc('hauler', 0)),
    ...at(400, mine(3, true)),
    ...at(450, alloc('drone', 3), alloc('flak', 2)),
    ...at(600, mine(1, false)),
    // h10-sim: the hive's caps become 10T 15S (pockets: p1 is captured; p2's caps are 0T 1S at 50 and 88 alike).
    ...at(650, tun('guard.capPct', 88)),
    ...at(850, alloc('drone', 0)),
    ...at(900, { type: 'recycleShips', node: 2, counts: { drone: 0, lancer: 0, flak: 0, extractor: 1 } }),
    // h10-sim (c): a push at the hive that loses.
    ...at(1900, tun('field.fleetCap', 17), { type: 'setRally', node: 0 }, alloc('drone', 2)),
    ...at(1991, tun('field.fleetCap', 12), { type: 'setRally', node: 8 }, alloc('drone', 0)),
    ...at(1995, { type: 'sendShips', from: 0, to: 10, counts: SEND_ALL }),
    ...at(2400, { type: 'sendShips', from: 8, to: 9, counts: SEND_ALL }),
    // h10-sim (f) and (d).
    ...at(2700, tun('hive.rebuildTicks', 0)),
    ...at(2760, tun('hive.rebuildTicks', 300)),
    ...at(3600, tun('raid.econPerRaider', 2), tun('raid.hiveKeepPct', 72)),
    ...at(3601, tun('raid.econPerRaider', 3), tun('raid.hiveKeepPct', 50)),
    ...at(4100, { type: 'sendShips', from: 9, to: 8, counts: { drone: 1, lancer: 0, flak: 0 } }),
    ...at(4250, tun('guard.thorn.damage', 6), tun('guard.spore.damage', 6)),
    ...at(4330, tun('guard.thorn.damage', 1), tun('guard.spore.damage', 1)),
    // h9-raids: the prong raids (see above). Raids may now split from 4 raiders, come every 900 ticks and muster in 150.
    ...at(4400, tun('raid.prongMinSize', 2), tun('raid.econPerRaider', 2), tun('raid.musterTicks', 150), tun('raid.gapTicks', 900)),
    // A sacrificial extractor with 24 hp (a limit of 13 lets it be built; it docks at p1, the only rock with room).
    ...at(4410, tun('ship.extractor.hp', 24), tun('field.fleetCap', 13), alloc('flak', 0), alloc('extractor', 1)),
    ...at(4500, tun('ship.extractor.hp', 6), alloc('extractor', 0), tun('field.fleetCap', 12), alloc('flak', 2)),
    // The gap after the next raid ends is 1321 (1400 before h10-sim's roll kept raid 3 out longer), so the last raid musters at
    // 7705 and is out when the hive falls.
    ...at(5000, tun('raid.gapTicks', 1321)),
    // Raid 3 (muster 5465, launch 5614, prongs at p1 and a3): p1 is left undefended, a3 is unmarked while the prongs fly.
    ...at(5550, { type: 'sendShips', from: 8, to: 2, counts: SEND_ALL }),
    ...at(5690, ext(9, 1)),
    ...at(5700, mine(3, false)),
    // h10-sim (g): a5 marked, its sacrificial extractor, and the roll-on.
    ...at(5870, mine(3, true), mine(5, true), tun('field.fleetCap', 14), alloc('extractor', 1), tun('raid.rollMax', 1)),
    ...at(5871, tun('field.fleetCap', 12), alloc('extractor', 0)),
    ...at(6000, ext(9, null), { type: 'sendShips', from: 2, to: 8, counts: SEND_ALL }),
    ...at(6070, mine(9, false)),
    ...at(6250, mine(5, false), tun('raid.rollMax', 0)),
    ...at(6600, mine(9, true)),
    // Raid 4 (muster 7705, launch 7854): the hive can spare only 2 when it launches, so it drops to one prong.
    ...at(7000, tun('field.fleetCap', 40), { type: 'setRally', node: 0 }, alloc('drone', 5)),
    ...at(7750, { type: 'sendShips', from: 0, to: 10, counts: SEND_ALL }),
    ...at(7800, tun('guard.capPct', 85), tun('raid.hiveKeepPct', 90)),
    ...at(7860, tun('guard.capPct', 50), tun('raid.hiveKeepPct', 50)),
    // h10-sim (h).
    ...at(7990, tun('guard.capPct', 100)),
    ...at(8100, tun('hauler.autoNeed', 1), alloc('hauler', 2), alloc('drone', 0), alloc('flak', 0)),
    ...at(8150, { type: 'recycleFleet', counts: { extractor: 0, hauler: 0, drone: 3, lancer: 0, flak: 0 } }),
    ...at(8400, { type: 'setHaulers', node: 2, count: 1 }),
    ...at(8440, { type: 'recycleShips', node: 8, counts: { drone: 0, lancer: 0, flak: 1 } }),
    ...at(8450, { type: 'moveShips', from: 10, to: 9, part: 'split' }, { type: 'moveShips', from: 8, to: 2, part: 'split' }),
    ...at(8488, { type: 'recycleFleet', counts: { extractor: 1, hauler: 4, drone: 0, lancer: 0, flak: 0 } }),
    ...at(8650, { type: 'moveShips', from: 9, to: 3, part: 'all' }),
    ...at(8660, mine(9, false), mine(10, false), alloc('extractor', 3)),
    ...at(8670, mine(8, false)),
    ...at(8720, mine(4, true), tun('field.fleetCap', 45), tun('ship.hauler.cargo', 2)),
    // h9-sim: the extractor dial (see above).
    ...at(8760, tun('ship.speedSu', 20), ext(1, 1), ext(2, 0), ext(2, 3)),
    ...at(8761, mine(1, true), ext(2, 1)),
    ...at(8800, ext(1, null)),
    ...at(8880, ext(1, 1)),
  ],
};
