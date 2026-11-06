import { defaultData, type Replay } from '@factory4x/sim';

/**
 * Fixed replay used by the determinism gate (Node) and the smoke test
 * (browser). Grow it as mechanics land so it exercises every system.
 */
export const referenceReplay: Replay = {
  seed: 20261106,
  dataVersion: defaultData.dataVersion,
  inputs: [
    { tick: 1, input: { type: 'boost', amount: 10 } },
    { tick: 450, input: { type: 'boost', amount: 3 } },
    { tick: 4500, input: { type: 'noop' } },
  ],
};
