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
 *   - 3500 (h7-design-data, data v13): sendShips from p1 to p2 again, so the warships built since 2400 leave p1 and
 *     raid 2 finds it undefended (with the v13 field guards, one would otherwise still be there).
 *   - 7000 (h7-raids): the fleet limit rises to 40, the rally goes back to the probe and drones get all the ore, so the
 *     new warships wait at the probe. 7750: sendShips from the probe to the hive. It falls at tick 8010.
 *
 * The raids (DESIGN.md H7 R1-R9) run on their own from tick 95, when the economy reaches 6 ships, and the script
 * leaves them alone: raid 1 musters at a1 and, a1 being stopped at 600, retargets to the captured p1, where the rally
 * defenders beat it (tick 900). Raid 2 (muster 3600) hits p1 after the ships went to p2: undefended, it kills a docked
 * extractor and comes home. Raid 3 (muster 7265) is at p1 when the hive falls at 8010, and withers.
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
    ...at(3500, { type: 'sendShips', from: 8, to: 9, counts: SEND_ALL }),
    ...at(7000, tun('field.fleetCap', 40), { type: 'setRally', node: 0 }, alloc('drone', 5)),
    ...at(7750, { type: 'sendShips', from: 0, to: 10, counts: SEND_ALL }),
  ],
};
