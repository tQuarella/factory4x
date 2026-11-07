import { defaultData, type Input, type Replay } from '@factory4x/sim';

/**
 * Fixed replay used by the determinism gate (Node, 9000 ticks) and the smoke
 * test (browser, 3000 ticks). Grow it as mechanics land so it exercises every
 * system. It uses every Input type, and live tuning (setTunable) speeds the
 * game up so that, before tick 3000, a wave is repelled by the fed Bloom, the
 * Root is cut (the Bloom wilts and starves), and the starved Bloom is
 * captured; after capture it builds out the rich node.
 *
 * The seed picks Thin Root (20261106 mod 3 = 0). Node indices: 0 probe, 1 a1,
 * 2 a2, 3 a3, 4 a4, 5 a5, 6 rich (the Bloom), 7 root.
 */
const at = (tick: number, ...inputs: Input[]) => inputs.map((input) => ({ tick, input }));

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
      { type: 'setTunable', key: 'ship.cost', value: 5 },
      { type: 'setTunable', key: 'ship.buildTicks', value: 30 },
      { type: 'buildExtractor', node: 1 },
      { type: 'buildRoute', from: 1, to: 0 },
      { type: 'buildExtractor', node: 2 },
      // Invalid on purpose (the rich node is guarded): must be ignored.
      { type: 'buildExtractor', node: 6 },
      { type: 'setRally', node: 5 },
    ),
    // Cancels the a2 extractor (queue after tick 0: route a1, extractor a2).
    ...at(5, { type: 'cancelBuild', index: 1 }),
    // a1 extracts 40/min into a 20/min route: upgrade it.
    ...at(200, { type: 'upgradeRoute', from: 1 }),
    // The Root grows two thorns past its variant cap (live root.capBonus, Root regrowth).
    ...at(300, { type: 'setTunable', key: 'root.capBonus', value: 2 }),
    // A small wave meets the full Bloom and is repelled.
    ...at(1000, { type: 'sendShips', from: 5, to: 6, count: 4 }),
    ...at(1100, { type: 'setShipyard', on: false }),
    ...at(1200, { type: 'setShipyard', on: true }, { type: 'setTunable', key: 'ship.damage', value: 20 }, { type: 'setTunable', key: 'ship.hp', value: 100 }),
    // Ships built before the hp change (hp 10) go home; the tougher ones attack.
    ...at(1250, { type: 'sendShips', from: 5, to: 0, count: 0 }),
    // Cut the Root first: the Bloom wilts from 12 to 8 thorns.
    ...at(1900, { type: 'sendShips', from: 5, to: 7, count: 8 }),
    // Starved values are live tunables: faster starved regrowth and some repair, so both act during the Bloom fight.
    ...at(2100, { type: 'setTunable', key: 'bloom.starvedRegrowTicks', value: 30 }, { type: 'setTunable', key: 'bloom.starvedRepairPerRound', value: 1 }),
    // Then take the starved Bloom with everything at a5.
    ...at(2150, { type: 'sendShips', from: 5, to: 6, count: 0 }),
    // After capture: build out the rich node and pull two ships back (an order from rich).
    ...at(2700, { type: 'buildExtractor', node: 6 }, { type: 'buildRoute', from: 6, to: 0 }, { type: 'sendShips', from: 6, to: 5, count: 2 }),
    ...at(3600, { type: 'upgradeRoute', from: 6 }, { type: 'setRally', node: 0 }),
  ],
};
