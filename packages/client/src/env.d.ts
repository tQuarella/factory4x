declare const __BUILD_VERSION__: string;

interface Window {
  /** Test hooks used by the release smoke test. Not part of gameplay. */
  __factory4x?: {
    /** Full build version. */
    version: string;
    tick(): number;
    replayHashes(ticks: number, every: number, replay: import('@factory4x/sim').Replay & { mode?: 'campaign' }): string[];
    /** Node center in client (viewport) pixels. */
    nodeScreenPos(node: number): { x: number; y: number };
    /** Area centre on the overworld, in client (viewport) pixels. */
    areaScreenPos(area: number): { x: number; y: number };
    /** Area node radius on the overworld, px. */
    areaRadius(): number;
    /** The band labels' boxes in viewport pixels. */
    bandRects(): Array<{ band: number; x: number; y: number; w: number; h: number }>;
    /** The area name labels as last drawn (viewport pixels, measured text), by area; null where not drawn. */
    areaLabelRects(): Array<{ x: number; y: number; w: number; h: number } | null>;
    /** The overworld pan now and the furthest it reaches now (it reaches further under an open sheet), px. */
    overworldScroll(): { x: number; y: number; max: { x: number; y: number } };
    /** Centres the overworld on an area at once (tests; a drag does the same for a player). */
    centerOnArea(area: number): void;
    /** The step moment is playing. */
    stepActive(): boolean;
    skipStep(): void;
    /** How many step moments this page has started. */
    stepsStarted(): number;
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
    /** Shows the in-area HUD from a copy of the world with these counts (tests only; stays until the page reloads). */
    debugHudFrame(f: {
      stock: Record<'ore' | 'ice' | 'crystal' | 'lens' | 'plating', number>;
      ore: number;
      ice: number;
      crystal: number;
      ships: Record<'drone' | 'lancer' | 'flak', number>;
      cap: number;
    }): void;
    /** What the last map frame drew for a node: the "!" badge, and the dashed backed-up route from it. */
    mapBackedUp(node: number): { badge: boolean; route: boolean };
    /** H7: what the last map frame drew for the economy, as JSON text: {mine: node[], haul: [node, level][], econ: {docked, idle, waiting, moving}}. */
    mapField(): string;
    /** Shows the battle banner and a sample toast (or hides them), to check layout. */
    debugShowNotices(on: boolean): void;
    debugShowResult(): void;
    /** The run's system name ("Frost Gate"). */
    systemName(): string;
    /** Node index of the Root. */
    rootNode(): number;
    newSystem(): void;
    /** H7: the same as newSystem (a field run's New run). */
    newRun(): void;
    /** The session is a field run (H7). */
    isField(): boolean;
    /** allocStatus, rockStatus(node) and fieldSummary as JSON text (field mode). */
    allocStatus(): string;
    rockStatus(node: number): string;
    fieldSummary(): string;
    /** The economy ships, as JSON text: [{id, type, at, target, moving}]. */
    econShips(): string;
    /** raidStatus as JSON text (field mode). */
    raidStatus(): string;
    /** Pauses and steps exactly n ticks, then refreshes the screen (tests). */
    advanceTicks(n: number): void;
    /** The session's input log (inputs only), as JSON text. */
    log(): string;
    setSpeed(speed: 1 | 2 | 4): void;
  };
}
