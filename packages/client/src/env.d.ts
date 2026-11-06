declare const __BUILD_VERSION__: string;

interface Window {
  /** Test hooks used by the release smoke test. Not part of gameplay. */
  __factory4x?: {
    /** Full build version. */
    version: string;
    tick(): number;
    replayHashes(ticks: number, every: number, replay: import('@factory4x/sim').Replay): string[];
    /** Node center in client (viewport) pixels. */
    nodeScreenPos(node: number): { x: number; y: number };
    /** Selected node index, or null. */
    selected(): number | null;
    /** Queued plus active builds. */
    pendingBuilds(): number;
    stock(): number;
    paused(): boolean;
    inputCount(): number;
    /** Idle ships at a node. */
    shipsAt(node: number): number;
    /** Run stat: attack waves sent at the guarded Bloom. */
    wavesSent(): number;
    /** Writes the autosave now. */
    saveNow(): boolean;
    /** Does the session's replay (seed + input log) reproduce the live world hash at the current tick? */
    replayMatchesLive(): boolean;
    /** Shows the battle banner and a sample toast (or hides them), to check layout. */
    debugShowNotices(on: boolean): void;
    debugShowResult(): void;
    newRun(): void;
  };
}
