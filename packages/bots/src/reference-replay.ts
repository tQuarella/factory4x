import { SEND_ALL, defaultData, type Input, type Replay } from '@factory4x/sim';

/**
 * Fixed replay used by the determinism gate (Node, 9000 ticks) and the smoke
 * test (browser, 3000 ticks). Grow it as mechanics land so it exercises every
 * system. H4 (DESIGN.md "Save, data version and replay"): a campaign from
 * createWorld. It uses every Input type, and live tuning (setTunable,
 * including guard.capPct 50, research.costPct 25 and shipments.pct 300)
 * speeds it up so that, before tick 6000:
 *
 *   - Landfall (area 0): land, one drone takes the empty heart (reclaim, haul), leave.
 *   - Overworld: buy Opening ore 1 and Extraction 1. Land in Frost Shelf (area 1), queue
 *     extractors, then withdraw (the area resets); land again (the opening includes the research),
 *     drones take the ice pocket and then the heart, leave. Shipments run while each held area is played.
 *   - Buy the Flak design; Spore Veil (area 3): the lancer yard is switched on but has no design
 *     (the design gate), a lone drone is repelled at the heart, drones take p1 (ice) and p2 (crystal),
 *     plating and flak are made, a mixed wave cuts the Root (the heart wilts and starves) and takes the heart.
 *   - Buy the Lancer design; Thorn Garden (area 4): both component yards take turns (rule 5b
 *     round-robin), lancers and flak cut the Root and take the heart.
 *   - Buy Seed rigs 1 and Fast yards 1; land in The Deep (area 5): A1 lands rigged, ships build faster.
 *
 * One input is invalid on purpose (buyResearch inside an area) and must be ignored. Node indices are per
 * area (the area's nodes in frame order): Landfall 0 probe, 1-5 a1-a5, 6 heart; Frost Shelf 0 probe,
 * 1 a1, 2 a2, 3 a3, 4 a5, 5 p1, 6 heart; Spore Veil and Thorn Garden 0 probe, 1-7 a1-a7, 8 p1, 9 p2,
 * 10 root, 11 heart; The Deep the H3 indices (seed 20261106 gives Frost Gate). Research items:
 * 0 lancer, 1 flak, 2 opening, 3 extract, 4 rigs, 5 yards, 6 core.
 *
 * It runs on the shipped data, so a calibration that changes areas, research costs or guards can break
 * the script (packages/sim/test/reference-replay.test.ts says so). The tunables it depends on are set at
 * tick 0 to keep that rare. It was recorded from a reactive script and frozen as a plain input log.
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
      // Half caps; weak, slow-regrowing guards.
      { type: 'setTunable', key: 'guard.capPct', value: 50 },
      { type: 'setTunable', key: 'guard.thorn.damage', value: 1 },
      { type: 'setTunable', key: 'guard.spore.damage', value: 1 },
      { type: 'setTunable', key: 'guard.thorn.regrowTicks', value: 300 },
      { type: 'setTunable', key: 'guard.spore.regrowTicks', value: 300 },
      // Cheap research, generous shipments.
      { type: 'setTunable', key: 'research.costPct', value: 25 },
      { type: 'setTunable', key: 'shipments.pct', value: 300 },
      // Landfall, and in the same tick its first extractor and route.
      { type: 'enterArea', area: 0 },
      { type: 'buildExtractor', node: 1 },
      { type: 'buildRoute', from: 1, to: 0 },
      // Invalid on purpose (no research inside an area): must be ignored.
      { type: 'buyResearch', item: 2 },
    ),
    // The first drone takes Landfall's empty heart.
    ...at(31, { type: 'sendShips', from: 0, to: 6, counts: SEND_ALL }),
    ...at(271, { type: 'leaveArea' }),
    // Overworld: Opening ore 1, Extraction 1, then Frost Shelf.
    ...at(272, { type: 'buyResearch', item: 2 }, { type: 'buyResearch', item: 3 }, { type: 'enterArea', area: 1 }),
    ...at(273, { type: 'buildExtractor', node: 1 }, { type: 'buildExtractor', node: 2 }, { type: 'setRally', node: 4 }),
    // Withdraw: everything built here is lost; then land again.
    ...at(513, { type: 'leaveArea' }),
    ...at(514, { type: 'enterArea', area: 1 }),
    ...at(515, { type: 'buildExtractor', node: 1 }, { type: 'buildRoute', from: 1, to: 0 }, { type: 'buildExtractor', node: 2 }, { type: 'setRally', node: 4 }),
    // Cancels the a2 extractor (queue: route a1, extractor a2).
    ...at(516, { type: 'cancelBuild', index: 1 }),
    // Drones take the ice pocket p1; route it and upgrade the a1 route.
    ...at(767, { type: 'sendShips', from: 4, to: 5, counts: SEND_ALL }),
    ...at(841, { type: 'buildRoute', from: 5, to: 0 }, { type: 'upgradeRoute', from: 1 }),
    // Everything at a5 and p1 takes the heart (no Root here: it is fed for good).
    ...at(947, { type: 'sendShips', from: 4, to: 6, counts: SEND_ALL }, { type: 'sendShips', from: 5, to: 6, counts: SEND_ALL }),
    ...at(1081, { type: 'leaveArea' }),
    // Flak design (paid with the Shelf's ice), then Spore Veil.
    ...at(1082, { type: 'buyResearch', item: 1 }, { type: 'enterArea', area: 3 }),
    // The lancer yard goes on, but the Lancer design isn't researched: it never starts a build here.
    ...at(1083, { type: 'buildExtractor', node: 1 }, { type: 'buildRoute', from: 1, to: 0 }, { type: 'setRally', node: 5 }, { type: 'setShipyard', shipType: 'lancer', on: true }),
    // One drone meets the heart and is repelled.
    ...at(1245, { type: 'sendShips', from: 5, to: 11, counts: counts(1, 0, 0) }),
    // Drones take p1 (ice), then p2 (crystal); both are routed.
    ...at(1425, { type: 'sendShips', from: 5, to: 8, counts: SEND_ALL }),
    ...at(1501, { type: 'buildRoute', from: 8, to: 0 }),
    ...at(1605, { type: 'sendShips', from: 5, to: 9, counts: SEND_ALL }, { type: 'sendShips', from: 8, to: 9, counts: SEND_ALL }),
    ...at(1681, { type: 'buildRoute', from: 9, to: 0 }),
    // Drones and flak cut the Root: the heart wilts and starves. Then they take the heart.
    ...at(2444, { type: 'sendShips', from: 5, to: 10, counts: SEND_ALL }, { type: 'sendShips', from: 9, to: 10, counts: SEND_ALL }),
    ...at(2939, { type: 'sendShips', from: 5, to: 11, counts: SEND_ALL }, { type: 'sendShips', from: 10, to: 11, counts: SEND_ALL }),
    ...at(3001, { type: 'leaveArea' }),
    // Lancer design (paid with the Veil's crystal), then Thorn Garden: both component yards run.
    ...at(3002, { type: 'buyResearch', item: 0 }, { type: 'enterArea', area: 4 }),
    ...at(3003, { type: 'buildExtractor', node: 1 }, { type: 'buildRoute', from: 1, to: 0 }, { type: 'setRally', node: 5 }),
    ...at(3375, { type: 'sendShips', from: 5, to: 9, counts: SEND_ALL }),
    ...at(3451, { type: 'buildRoute', from: 9, to: 0 }),
    ...at(3944, { type: 'sendShips', from: 5, to: 8, counts: SEND_ALL }, { type: 'sendShips', from: 9, to: 8, counts: SEND_ALL }),
    ...at(4021, { type: 'buildRoute', from: 8, to: 0 }),
    ...at(4949, { type: 'sendShips', from: 5, to: 10, counts: SEND_ALL }, { type: 'sendShips', from: 8, to: 10, counts: SEND_ALL }),
    ...at(5759, { type: 'sendShips', from: 5, to: 11, counts: SEND_ALL }, { type: 'sendShips', from: 10, to: 11, counts: SEND_ALL }),
    ...at(5821, { type: 'leaveArea' }),
    // Seed rigs 1 and Fast yards 1, then The Deep: A1 lands mined and routed, so its route can be upgraded at once.
    ...at(5822, { type: 'buyResearch', item: 4 }, { type: 'buyResearch', item: 5 }, { type: 'enterArea', area: 5 }),
    ...at(5823, { type: 'upgradeRoute', from: 1 }, { type: 'buildExtractor', node: 2 }, { type: 'setRally', node: 5 }),
  ],
};
