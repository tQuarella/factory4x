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
    /** Area centre on the overworld, in client (viewport) pixels. */
    areaScreenPos(area: number): { x: number; y: number };
    /** Selected node index, or null. */
    selected(): number | null;
    /** The area whose overworld sheet is open, or null. */
    selectedArea(): number | null;
    /** No area is active: the overworld screen. */
    onOverworld(): boolean;
    /** Index of the area being played, or null. */
    activeArea(): number | null;
    /** campaignStatus(world, data) as JSON text. */
    campaign(): string;
    /** Node index by frame id ("a1", "p1", "heart"), or -1. */
    nodeIndex(id: string): number;
    /** Replaces the session with a constructed campaign (tests and dev only); the start is part of the replay. */
    startCampaign(start: import('@factory4x/sim').CampaignStart, tunables?: Record<string, number>): void;
    /** Queued plus active builds. */
    pendingBuilds(): number;
    stock(): number;
    paused(): boolean;
    inputCount(): number;
    /** Idle ships at a node. */
    shipsAt(node: number): number;
    /** Ships parked at a node, by type. */
    shipsAtByType(node: number): { drone: number; lancer: number; flak: number };
    /** Node index of the first pocket with this prize, or -1. */
    pocketNode(prize: 'ice' | 'crystal'): number;
    /** Has the player captured this node? */
    owned(node: number): boolean;
    /** The last logged input, as JSON text (or "null"). */
    lastInput(): string;
    /** Run stat: attack waves sent at the guarded Bloom. */
    wavesSent(): number;
    /** Writes the autosave now. */
    saveNow(): boolean;
    /** Does the session's replay (seed + input log) reproduce the live world hash at the current tick? */
    replayMatchesLive(): boolean;
    /** Shows the battle banner and a sample toast (or hides them), to check layout. */
    debugShowNotices(on: boolean): void;
    debugShowResult(): void;
    /** The run's system name ("Frost Gate"). */
    systemName(): string;
    /** Node index of the Root. */
    rootNode(): number;
    newSystem(): void;
  };
}
