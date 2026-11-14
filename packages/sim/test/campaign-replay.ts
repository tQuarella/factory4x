import { SEND_ALL, type Input, type Replay } from '../src/index.ts';
import { shippedCampaign } from './fixture.ts';

/**
 * h7-sim: the H6 reference replay, kept as a campaign test on the shipped data played with run.mode "campaign"
 * (`shippedCampaign`). The determinism gate now runs the field replay (packages/bots/src/reference-replay.ts).
 * Until h7-sim it was the replay used by the determinism gate (Node, 9000 ticks) and the smoke
 * test (browser, 3000 ticks). Grow it as mechanics land so it exercises every
 * system. It uses every Input type, and live tuning (setTunable, including
 * guard.capPct 50, research.costPct 25 and shipments.pct 300) speeds it up.
 *
 * H6 (DESIGN.md "Save, data version and replay"): it starts from a
 * campaignWorld start (`start`) with both designs bought and Thorn Garden held
 * as if reclaimed. On the shipped lanes band 2 is lane-joined only to relays
 * and band 2 areas, so a band-lock refusal can only come from a constructed
 * start. fleet.cap is 4 from tick 0, so the limits are 4, 12 and 20.
 *
 *   - Landfall (area 0): land, one drone takes the empty heart (reclaim, haul), leave.
 *   - Overworld: buy Opening ore 1 and Extraction 1. enterArea Spore Veil (area 5) is refused by the band lock
 *     (lane-joined through Thorn Garden, but no band 1 relay is reclaimed). Land in Glass Shoal (area 2), queue
 *     extractors, withdraw (the area resets); land again, drones take the crystal pocket and the heart, leave.
 *   - Glint Relay (area 4): a repeat of Glass Shoal (band 1, crystal), so it pays half its haul. Drones take p2
 *     (crystal) and the heart; the relay commands band 1. The yards hold at the limit 4 (fleetFull).
 *   - Buy Seed rigs 1 and Fast yards 1; Spore Veil now opens and lands with the limit 4 + 8 = 12. A1 lands
 *     rigged. Drones take p1 (ice); with the fleet full (12/12) the drone yard is switched off and the drones
 *     take p2 (crystal). Once lenses and plating are in stock, three drones are recycled at p2 (ore refunded) and
 *     lancers and flak fill the freed slots (rule 5b round-robin). The mixed wave takes the heart: full haul
 *     (band 2 ice is new).
 *   - Spire Relay (area 8): a repeat of Thorn Garden (band 2, crystal), half its haul; the relay commands
 *     band 2. Every capture there is sent with the limit 12.
 *   - The Deep (area 9): lands with the limit 4 + 2 × 8 = 20, and no Root (H6: fed for good). Drones take p2
 *     (crystal) and p1 (ice); the drone yard goes off and the drones are recycled, so lancers and flak fill the limit.
 *     Then, with their damage set to 1, they attack the heart's Thorns and Spores together: a fight from tick 5340
 *     to 5550, across the 5400 checkpoint, where each guard pool strikes the ship type it counters first (H6
 *     "Combat amendment"), so the hashes depend on that rule.
 *
 * One input is invalid on purpose (buyResearch inside an area) and one is refused by the band lock; both must
 * be ignored. Node indices are per area (its nodes in frame order): Landfall 0 probe, 1-5 a1-a5, 6 heart;
 * Glass Shoal 0 probe, 1 a1, 2 a2, 3 a4, 4 a5, 5 p1, 6 heart; Glint Relay 0 probe, 1 a1, 2 a2, 3 a4, 4 a5,
 * 5 a7, 6 p2, 7 heart; Spore Veil 0 probe, 1-7 a1-a7, 8 p1, 9 p2, 10 heart; Spire Relay 0 probe, 1 a1, 2 a2,
 * 3 a4, 4 a5, 5 a7, 6 a9, 7 p2, 8 p4, 9 heart; The Deep 0 probe, 1-9 a1-a9, 10-13 p1-p4, 14 heart (seed 20261106
 * gives Frost Gate). Research items: 0 lancer, 1 flak, 2 opening, 3 extract, 4 rigs, 5 yards, 6 core.
 *
 * It runs on the shipped data, so a calibration that changes areas, research costs or guards can break
 * the script (packages/sim/test/campaign-replay.test.ts says so). The tunables it depends on are set at
 * tick 0 to keep that rare. It was recorded from a reactive script and frozen as a plain input log.
 */
const at = (tick: number, ...inputs: Input[]) => inputs.map((input) => ({ tick, input }));
const counts = (drone: number, lancer: number, flak: number) => ({ drone, lancer, flak });

export const campaignReplay: Replay = {
  seed: 20261106,
  dataVersion: shippedCampaign.dataVersion,
  start: { reclaimed: ['garden'], research: { lancer: 1, flak: 1 } },
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
      // A small fleet limit, so every area meets it: 4, then 12 and 20 as the relays command bands 1 and 2.
      { type: 'setTunable', key: 'fleet.cap', value: 4 },
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
    // Overworld: Opening ore 1, Extraction 1. Spore Veil is refused (band 2 is locked); then Glass Shoal.
    ...at(272, { type: 'buyResearch', item: 2 }, { type: 'buyResearch', item: 3 }, { type: 'enterArea', area: 5 }, { type: 'enterArea', area: 2 }),
    ...at(273, { type: 'buildExtractor', node: 1 }, { type: 'buildExtractor', node: 2 }, { type: 'setRally', node: 4 }),
    // Withdraw: everything built here is lost; then land again.
    ...at(512, { type: 'leaveArea' }),
    ...at(513, { type: 'enterArea', area: 2 }),
    ...at(514, { type: 'buildExtractor', node: 1 }, { type: 'buildRoute', from: 1, to: 0 }, { type: 'buildExtractor', node: 2 }, { type: 'setRally', node: 4 }),
    // Cancels the a2 extractor (queue: route a1, extractor a2).
    ...at(515, { type: 'cancelBuild', index: 1 }),
    // Drones take the crystal pocket p1; then route it, upgrade the a1 route, and everything takes the heart.
    ...at(736, { type: 'sendShips', from: 4, to: 5, counts: SEND_ALL }),
    ...at(
      811,
      { type: 'buildRoute', from: 5, to: 0 },
      { type: 'upgradeRoute', from: 1 },
      { type: 'sendShips', from: 4, to: 6, counts: SEND_ALL },
      { type: 'sendShips', from: 5, to: 6, counts: SEND_ALL },
    ),
    ...at(931, { type: 'leaveArea' }),
    // Glint Relay (lane-joined to Glass Shoal): a relay, and a repeat of Glass Shoal.
    ...at(932, { type: 'enterArea', area: 4 }),
    ...at(933, { type: 'buildExtractor', node: 1 }, { type: 'buildRoute', from: 1, to: 0 }, { type: 'setRally', node: 4 }),
    ...at(1185, { type: 'sendShips', from: 4, to: 6, counts: SEND_ALL }),
    ...at(1261, { type: 'buildRoute', from: 6, to: 0 }),
    ...at(1320, { type: 'sendShips', from: 6, to: 7, counts: SEND_ALL }),
    ...at(1501, { type: 'leaveArea' }),
    // Band 1 is commanded: Seed rigs 1, Fast yards 1, then Spore Veil with the limit 12.
    ...at(1502, { type: 'buyResearch', item: 4 }, { type: 'buyResearch', item: 5 }, { type: 'enterArea', area: 5 }),
    ...at(1503, { type: 'upgradeRoute', from: 1 }, { type: 'buildExtractor', node: 2 }, { type: 'setRally', node: 5 }),
    ...at(1779, { type: 'sendShips', from: 5, to: 8, counts: SEND_ALL }),
    ...at(1861, { type: 'buildRoute', from: 8, to: 0 }),
    // The fleet is full (12/12): the drone yard goes off, and everything takes p2 (crystal).
    ...at(2072, { type: 'setShipyard', shipType: 'drone', on: false }, { type: 'sendShips', from: 5, to: 9, counts: SEND_ALL }, { type: 'sendShips', from: 8, to: 9, counts: SEND_ALL }),
    ...at(2161, { type: 'buildRoute', from: 9, to: 0 }),
    // Lenses and plating in stock and the fleet still full of drones: recycle three; lancers and flak fill the slots.
    ...at(2522, { type: 'recycleShips', node: 9, counts: counts(3, 0, 0) }),
    ...at(2703, { type: 'sendShips', from: 5, to: 10, counts: SEND_ALL }, { type: 'sendShips', from: 9, to: 10, counts: SEND_ALL }),
    ...at(2821, { type: 'leaveArea' }),
    // Spire Relay: band 2's relay, and a repeat of Thorn Garden.
    ...at(2822, { type: 'enterArea', area: 8 }),
    ...at(2823, { type: 'upgradeRoute', from: 1 }, { type: 'setRally', node: 4 }),
    ...at(3147, { type: 'sendShips', from: 4, to: 7, counts: SEND_ALL }),
    ...at(3211, { type: 'buildRoute', from: 7, to: 0 }),
    ...at(3243, { type: 'sendShips', from: 4, to: 9, counts: SEND_ALL }, { type: 'sendShips', from: 7, to: 9, counts: SEND_ALL }),
    ...at(3421, { type: 'leaveArea' }),
    // Both bands commanded: The Deep, with the limit 20 and no Root.
    ...at(3422, { type: 'enterArea', area: 9 }),
    ...at(3423, { type: 'upgradeRoute', from: 1 }, { type: 'buildExtractor', node: 2 }, { type: 'setRally', node: 5 }),
    // h6-combat-target: a mixed fight that spans a checkpoint. Drones take p2 (crystal) and p1 (ice); both are routed,
    // the drone yard goes off and the drones are recycled, so lancers and flak fill the limit of 20.
    ...at(3699, { type: 'sendShips', from: 5, to: 11, counts: SEND_ALL }),
    ...at(3781, { type: 'buildRoute', from: 11, to: 0 }, { type: 'sendShips', from: 11, to: 10, counts: SEND_ALL }),
    ...at(3871, { type: 'buildRoute', from: 10, to: 0 }, { type: 'setShipyard', shipType: 'drone', on: false }),
    ...at(3872, { type: 'recycleShips', node: 10, counts: SEND_ALL }),
    // Weak lancers and flak (damage 1) against the heart's Thorns and Spores: the battle runs from tick 5340 to 5550,
    // across the 5400 checkpoint, and each guard pool strikes its own counter-weak type first.
    ...at(
      5220,
      { type: 'setTunable', key: 'ship.lancer.damage', value: 1 },
      { type: 'setTunable', key: 'ship.flak.damage', value: 1 },
      { type: 'sendShips', from: 5, to: 14, counts: counts(0, 1_000_000, 1_000_000) },
    ),
  ],
};
