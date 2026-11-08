import { SEND_ALL, defaultData, type Input, type Replay } from '@factory4x/sim';

/**
 * Fixed replay used by the determinism gate (Node, 9000 ticks) and the smoke
 * test (browser, 3000 ticks). Grow it as mechanics land so it exercises every
 * system. It uses every Input type, and live tuning (setTunable, including
 * guard.capPct 50) speeds the game up so that, before tick 3000: a drone wave
 * is repelled at a pocket, the ice pocket p1 and the crystal pocket p2 are
 * captured and routed, plating and lenses are assembled, the flak and lancer
 * yards take turns (rule 5b round-robin), a mixed wave cuts the Root (the
 * heart wilts and starves), and a mixed wave captures the heart; after
 * capture it builds out the heart.
 *
 * It runs on the shipped data, so a calibration that changes the layouts can
 * break the script (packages/sim/test/reference-replay.test.ts says so). The
 * tunables it depends on are set at tick 0 to keep that rare; the guard
 * counts come from the layout and can't be.
 *
 * The seed picks Frost Gate (20261106 mod 3 = 0). Node indices: 0 probe,
 * 1-9 a1-a9, 10-13 p1-p4, 14 root, 15 heart.
 */
const at = (tick: number, ...inputs: Input[]) => inputs.map((input) => ({ tick, input }));
const counts = (drone: number, lancer: number, flak: number) => ({ drone, lancer, flak });

export const referenceReplay: Replay = {
  seed: 20261106,
  dataVersion: defaultData.dataVersion,
  inputs: [
    ...at(
      0,
      { type: 'setTunable', key: 'extractor.buildTicks', value: 60 },
      { type: 'setTunable', key: 'route.buildTicks', value: 60 },
      { type: 'setTunable', key: 'economy.probeOrePerMin', value: 60 },
      { type: 'setTunable', key: 'extractor.orePerMin', value: 40 },
      { type: 'setTunable', key: 'route.podOrePerLevel', value: 3 },
      { type: 'setTunable', key: 'ship.drone.cost', value: 5 },
      { type: 'setTunable', key: 'ship.drone.buildTicks', value: 30 },
      { type: 'setTunable', key: 'ship.drone.damage', value: 20 },
      { type: 'setTunable', key: 'ship.flak.cost', value: 5 },
      { type: 'setTunable', key: 'ship.flak.buildTicks', value: 30 },
      { type: 'setTunable', key: 'ship.flak.damage', value: 20 },
      { type: 'setTunable', key: 'ship.lancer.cost', value: 5 },
      { type: 'setTunable', key: 'ship.lancer.buildTicks', value: 30 },
      { type: 'setTunable', key: 'ship.lancer.damage', value: 20 },
      { type: 'setTunable', key: 'counter.strongPct', value: 400 },
      { type: 'setTunable', key: 'pocket.resourcePerMin', value: 40 },
      { type: 'setTunable', key: 'component.buildTicks', value: 30 },
      { type: 'setTunable', key: 'component.lens.ore', value: 0 },
      { type: 'setTunable', key: 'component.plating.ore', value: 0 },
      // Half caps: lowering a cap removes nothing, so the guardians keep their full layout counts
      // until they lose guards; the heart then wilts to half its starved counts.
      { type: 'setTunable', key: 'guard.capPct', value: 50 },
      { type: 'setTunable', key: 'guard.thorn.damage', value: 1 },
      { type: 'setTunable', key: 'guard.spore.damage', value: 1 },
      { type: 'setTunable', key: 'guard.thorn.regrowTicks', value: 300 },
      { type: 'setTunable', key: 'guard.spore.regrowTicks', value: 300 },
      { type: 'buildExtractor', node: 1 },
      { type: 'buildRoute', from: 1, to: 0 },
      { type: 'buildExtractor', node: 2 },
      { type: 'buildExtractor', node: 1 },
      // Invalid on purpose (p1 is guarded): must be ignored.
      { type: 'buildExtractor', node: 10 },
      { type: 'setRally', node: 5 },
    ),
    // Cancels the a2 extractor (queue after tick 0: route a1, extractor a2, extractor a1).
    ...at(5, { type: 'cancelBuild', index: 1 }),
    // a1 extracts 80/min into a 60/min route: upgrade it.
    ...at(200, { type: 'upgradeRoute', from: 1 }),
    // One drone meets p2 (Thorns and Spores) and is repelled.
    ...at(1000, { type: 'sendShips', from: 5, to: 11, counts: counts(1, 0, 0) }),
    // Drones take the ice pocket p1.
    ...at(1300, { type: 'sendShips', from: 5, to: 10, counts: SEND_ALL }),
    // Route p1's ice (its free extractor runs from capture); turn the flak yard on and the drone yard off for a while.
    ...at(1500, { type: 'buildRoute', from: 10, to: 0 }, { type: 'setShipyard', shipType: 'flak', on: true }),
    // Drones take the crystal pocket p2.
    ...at(1550, { type: 'sendShips', from: 5, to: 11, counts: SEND_ALL }),
    ...at(1600, { type: 'setShipyard', shipType: 'drone', on: false }),
    ...at(1700, { type: 'setShipyard', shipType: 'drone', on: true }),
    // Route p2's crystal and turn the lancer yard on: from here lancer and flak take turns for ore.
    ...at(1750, { type: 'buildRoute', from: 11, to: 0 }, { type: 'setShipyard', shipType: 'lancer', on: true }),
    // A mixed wave from a5 cuts the Root: the heart wilts to its starved caps and starves.
    ...at(2400, { type: 'sendShips', from: 5, to: 14, counts: counts(2, 0, 3) }),
    // Starved values are live tunables: faster starved regrowth and some repair, so both act during the heart fight.
    ...at(
      2500,
      { type: 'setTunable', key: 'bloom.starvedRegrowMul', value: 1 },
      { type: 'setTunable', key: 'bloom.starvedRepairPerRound', value: 1 },
      { type: 'setTunable', key: 'guard.thorn.regrowTicks', value: 30 },
    ),
    // Everything at a5 and the Root takes the starved heart.
    ...at(2600, { type: 'sendShips', from: 5, to: 15, counts: SEND_ALL }, { type: 'sendShips', from: 14, to: 15, counts: SEND_ALL }),
    // After capture: build out p1 and the heart, and pull two drones back (an order from the heart).
    ...at(
      2900,
      { type: 'buildExtractor', node: 10 },
      { type: 'buildExtractor', node: 15 },
      { type: 'buildRoute', from: 15, to: 0 },
      { type: 'sendShips', from: 15, to: 5, counts: counts(2, 0, 0) },
    ),
    ...at(4200, { type: 'upgradeRoute', from: 15 }, { type: 'setRally', node: 0 }),
  ],
};
