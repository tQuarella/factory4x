import { SEND_ALL, type Input, type Replay } from '../../src/index.ts';

/**
 * h10-sim: main's reference replay as it stood at bd702b9 (packages/bots/src/reference-replay.ts, data v16), frozen here for
 * the "identical at 0" check (h10-identical.test.ts): played on fixtures/sim-v16.json (v16 plus the H10 keys at 0, 0 and 1),
 * its checkpoint hashes, without the H10 state, are main's. Never edited; see the original file for what each input does.
 */
const at = (tick: number, ...inputs: Input[]) => inputs.map((input) => ({ tick, input }));
const tun = (key: Extract<Input, { type: 'setTunable' }>['key'], value: number): Input => ({ type: 'setTunable', key, value });
const mine = (node: number, on: boolean): Input => ({ type: 'setMine', node, on });
const ext = (node: number, count: number | null): Input => ({ type: 'setExtractors', node, count });
const alloc = (shipType: Extract<Input, { type: 'setAlloc' }>['shipType'], weight: number): Input => ({ type: 'setAlloc', shipType, weight });

export const replayV16: Replay = {
  seed: 20261114,
  dataVersion: 16,
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
    ...at(1, ext(9, 1), ext(10, 1)), // h9-sim (f): guarded, so invalid
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
    // h9-raids: the prong raids (see above). Raids may now split from 4 raiders, come every 900 ticks and muster in 150.
    ...at(4400, tun('raid.prongMinSize', 2), tun('raid.econPerRaider', 2), tun('raid.musterTicks', 150), tun('raid.gapTicks', 900)),
    // A sacrificial extractor with 24 hp (a limit of 13 lets it be built; it docks at p1, the only rock with room).
    ...at(4410, tun('ship.extractor.hp', 24), tun('field.fleetCap', 13), alloc('flak', 0), alloc('extractor', 1)),
    ...at(4500, tun('ship.extractor.hp', 6), alloc('extractor', 0), tun('field.fleetCap', 12), alloc('flak', 2)),
    // The gap after the next raid ends is 1400, so the last raid is out when the hive falls.
    ...at(5000, tun('raid.gapTicks', 1400)),
    // Raid 3 (muster 5465, launch 5614, prongs at p1 and a3): p1 is left undefended, a3 is unmarked while the prongs fly.
    ...at(5550, { type: 'sendShips', from: 8, to: 2, counts: SEND_ALL }),
    ...at(5690, ext(9, 1)),
    ...at(5700, mine(3, false)),
    ...at(5870, mine(3, true)),
    ...at(6000, ext(9, null), { type: 'sendShips', from: 2, to: 8, counts: SEND_ALL }),
    ...at(6070, mine(9, false)),
    ...at(6600, mine(9, true)),
    // Raid 4 (muster 7705, launch 7854): the hive can spare only 2 when it launches, so it drops to one prong.
    ...at(7000, tun('field.fleetCap', 40), { type: 'setRally', node: 0 }, alloc('drone', 5)),
    ...at(7750, { type: 'sendShips', from: 0, to: 10, counts: SEND_ALL }),
    ...at(7800, tun('guard.capPct', 85), tun('raid.hiveKeepPct', 90)),
    ...at(7860, tun('guard.capPct', 50), tun('raid.hiveKeepPct', 50)),
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
