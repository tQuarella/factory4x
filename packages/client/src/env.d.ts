declare const __BUILD_VERSION__: string;

interface Window {
  /** Test hooks used by the release smoke test. Not part of gameplay. */
  __factory4x?: {
    version: string;
    tick(): number;
    replayHashes(ticks: number, every: number, replay: import('@factory4x/sim').Replay): string[];
  };
}
