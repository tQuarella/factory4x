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
 * defenders beat it (tick 900). Raid 2 (muster 3600) hits p1 after the ships went to p2. Raid 3 (muster 7265) is at p1
 * when the hive falls at 8010, and withers.
 *
 * h8-raids (DESIGN.md H8 H9 and H10; raid.shieldEcon and raid.haulersHold are 1 in the shipped data, so every raid above
 * runs under both):
 *   - 4100: one Drone goes from p2 to p1 (arrives 4169), a lone defender for raid 2. 4250: the raiders' damage is raised
 *     to 6 each (back to 1 at 4330), so their first round (4290) kills the Drone with overflow to spare. The shield
 *     (H9) loses the overflow: p1's docked extractor survives round 1 and dies in round 2 (4320), when no warship stands.
 *   - Raid 2's haulers are held (H10) from its launch (4049) to its end (4565): the ones assigned to p1 wait at the probe
 *     and leave the tick after it ends. Raid 1 held them at p1 too.
 *   - 8440: recycleShips of one Flak at p1. The Drone's fall at 4290 freed a place in the fleet limit that the Flak weight
 *     filled, so p1 held two Flak by 8450 and the 1-ship fallback below would not have been exercised.
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
      tun('hauler.autoNeed', 0),
      mine(3, false),
      mine(4, false),
      mine(5, false),
      mine(6, false),
      mine(7, false),
      { type: 'setRally', node: 8 },
    ),
    ...at(280, alloc('extractor', 0), alloc('hauler', 0)),
    ...at(400, mine(3, true)),
    ...at(450, alloc('drone', 3), alloc('flak', 2)),
    ...at(600, mine(1, false)),
    ...at(850, alloc('drone', 0)),
    ...at(900, { type: 'recycleShips', node: 2, counts: { drone: 0, lancer: 0, flak: 0, extractor: 1 } }),
    ...at(2400, { type: 'sendShips', from: 8, to: 9, counts: SEND_ALL }),
    ...at(4100, { type: 'sendShips', from: 9, to: 8, counts: { drone: 1, lancer: 0, flak: 0 } }),
    ...at(4250, tun('guard.thorn.damage', 6), tun('guard.spore.damage', 6)),
    ...at(4330, tun('guard.thorn.damage', 1), tun('guard.spore.damage', 1)),
    ...at(7000, tun('field.fleetCap', 40), { type: 'setRally', node: 0 }, alloc('drone', 5)),
    ...at(7750, { type: 'sendShips', from: 0, to: 10, counts: SEND_ALL }),
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
  ],
};
