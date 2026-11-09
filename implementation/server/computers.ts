// Computer players: which names they sit under, how long they wait before moving, and when one
// plays for a person who is away. Pure over a small state (the strategy's memory). The moves
// themselves come from an injected player strategy.

export type ComputersState = { memory: unknown };
// none: no computer is ever seated. on-request: a person adds one, and a computer plays for a person who is away.
// fill-empty: as on-request, and every empty seat gets a computer when the game starts.
export type ComputerMode = "none" | "on-request" | "fill-empty";
export const MODES: readonly ComputerMode[] = ["none", "on-request", "fill-empty"];

export type ComputerSettings = {
  // A list, or one text of names separated by spaces (see parseNames).
  names: string[] | string;
  mode: ComputerMode;
  thinkMinMs: number;
  thinkSpreadMs: number;
  minimumGapMs: number;
  rebuyDelayMs: number;
};

// What the component needs from the player-strategy, game-clock and seating components.
export type Strategy = {
  newMemory(): unknown;
  choose(observation: unknown, playerId: string, rng: () => number, memory: unknown): unknown | null;
  observe(memory: unknown, observation: unknown, playerId: string, move: unknown): unknown;
};
export type Clock = { elapsed(clock: any, which: "action" | "level"): number; wallAt(clock: any, which: "action" | "level", targetMs: number): number };
export type SeatsApi = {
  isFull(state: any): boolean;
  find(state: any, id: string): { id: string; name: string; computer: boolean } | undefined;
  findByName(state: any, name: string): unknown;
  join(state: any, id: string, name: string, options?: { computer?: boolean }): { ok: true; state: any } | { ok: false; code: string };
  canAddComputer(state: any, byId: string): { ok: true } | { ok: false; code: string };
};
export type Outcome = { ok: true; state: any; name: string } | { ok: false; code: string };

export const DEFAULT_NAMES = ["Robin", "Sam", "Alex", "Jordan", "Casey", "Morgan", "Taylor", "Riley"];
export const DEFAULT_SETTINGS: ComputerSettings = {
  names: DEFAULT_NAMES,
  mode: "on-request",
  thinkMinMs: 300,
  thinkSpreadMs: 1200,
  minimumGapMs: 4000,
  rebuyDelayMs: 4000,
};

const NAME = /^[\x20-\x7E]{1,20}$/;

// "Robin Sam Alex" -> ["Robin", "Sam", "Alex"]; repeated entries are dropped. The installer setting
// is space separated, so a name from the setting cannot hold a space; pass a list for such names.
export function parseNames(text: string): string[] {
  const names: string[] = [];
  for (const part of text.split(/\s+/)) {
    const name = part.trim();
    if (name && !names.includes(name)) names.push(name);
  }
  return names;
}

// What the component works from: `mode` and the three values derived from it (enabled: mode is not none;
// fillEmptySeats: mode is fill-empty; takeOverAbsent: enabled).
export type CheckedSettings = Omit<ComputerSettings, "names"> & { names: string[]; enabled: boolean; fillEmptySeats: boolean; takeOverAbsent: boolean };

export function checkSettings(input: Partial<ComputerSettings> = {}): CheckedSettings {
  const merged = { ...DEFAULT_SETTINGS, ...input };
  if (!MODES.includes(merged.mode)) throw new Error(`computer-players: mode must be one of ${MODES.join(", ")}`);
  const enabled = merged.mode !== "none";
  const s = { ...merged, names: typeof merged.names === "string" ? parseNames(merged.names) : merged.names, enabled, fillEmptySeats: merged.mode === "fill-empty", takeOverAbsent: enabled };
  if (!Array.isArray(s.names) || s.names.length === 0 || new Set(s.names).size !== s.names.length || !s.names.every((n) => typeof n === "string" && NAME.test(n) && n.trim() === n)) {
    throw new Error("computer-players: names must be a nonempty list of distinct names of 1 to 20 plain characters");
  }
  for (const key of ["thinkMinMs", "thinkSpreadMs", "minimumGapMs", "rebuyDelayMs"] as const) {
    if (!Number.isInteger(s[key]) || s[key] < 0) throw new Error(`computer-players: ${key} must be a whole number of milliseconds, 0 or more`);
  }
  return s;
}

export function createComputers(input: Partial<ComputerSettings>, parts: { strategy: Strategy; clock: Clock; seating: SeatsApi }) {
  const settings = checkSettings(input);
  const { strategy, clock, seating } = parts;

  const api = {
    settings,
    create(): ComputersState {
      return { memory: strategy.newMemory() };
    },
    // A new game starts with no memory of the last one's opponents.
    forget(): ComputersState {
      return api.create();
    },
    idFor(name: string): string {
      return "computer-" + name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    },
    // The first configured name not yet sitting, or null when all are taken.
    nextName(seats: unknown): string | null {
      return settings.names.find((n) => !seating.findByName(seats, n)) ?? null;
    },
    isComputer(seats: unknown, id: string): boolean {
      return seating.find(seats, id)?.computer === true;
    },
    // Seat one computer player on behalf of a person (the add-computer action).
    add(seats: unknown, byId: string): Outcome {
      if (!settings.enabled) return { ok: false, code: "notAllowed" };
      const allowed = seating.canAddComputer(seats, byId);
      if (!allowed.ok) return allowed;
      const name = api.nextName(seats);
      if (!name) return { ok: false, code: "roomFull" };
      const r = seating.join(seats, api.idFor(name), name, { computer: true });
      return r.ok ? { ok: true, state: r.state, name } : r;
    },
    // With mode fill-empty, seat computers until the table is full; otherwise nothing changes.
    fill(seats: unknown): { state: any; added: string[] } {
      const added: string[] = [];
      let state = seats;
      while (settings.enabled && settings.fillEmptySeats && !seating.isFull(state)) {
        const name = api.nextName(state);
        if (!name) break;
        const r = seating.join(state, api.idFor(name), name, { computer: true });
        if (!r.ok) break;
        state = r.state;
        added.push(name);
      }
      return { state, added };
    },
    // Does the computer side move for this player: a computer, or (unless mode is none) a person away.
    actsFor(seats: unknown, player: { id: string; connected: boolean; sittingOut: boolean }): boolean {
      if (api.isComputer(seats, player.id)) return true;
      return settings.takeOverAbsent && (!player.connected || player.sittingOut);
    },
    // Action-clock deadline for a move: never within minimumGapMs of now, never before the table
    // has settled, then a human-like thinking time.
    moveDeadline(clockState: unknown, settleUntilMs: number, rng: () => number): number {
      const now = clock.elapsed(clockState, "action");
      return Math.max(settleUntilMs, now + settings.minimumGapMs) + settings.thinkMinMs + Math.floor(rng() * settings.thinkSpreadMs);
    },
    isDue(clockState: unknown, deadlineMs: number): boolean {
      return clock.elapsed(clockState, "action") >= deadlineMs;
    },
    // Wall-clock time at which a move with this deadline falls due.
    wakeAt(clockState: unknown, deadlineMs: number): number {
      return clock.wallAt(clockState, "action", deadlineMs);
    },
    rebuyDelayMs(): number {
      return settings.rebuyDelayMs;
    },
    // Action-clock time at which a computer accepts a rebuy it is offered now.
    rebuyAt(clockState: unknown): number {
      return clock.elapsed(clockState, "action") + settings.rebuyDelayMs;
    },
    // Ask the strategy; null means it has nothing to play (the caller falls back to a default).
    choose(state: ComputersState, observation: unknown, playerId: string, rng: () => number): { move: unknown | null; state: ComputersState } {
      return { move: strategy.choose(observation, playerId, rng, structuredClone(state.memory)) ?? null, state };
    },
    // Record what a player did, for the strategy's read on them. The strategy may change the
    // memory it is given or return a new one.
    observe(state: ComputersState, observation: unknown, playerId: string, move: unknown): ComputersState {
      const memory = structuredClone(state.memory);
      const next = strategy.observe(memory, observation, playerId, move);
      return { memory: next === undefined ? memory : next };
    },
  };
  return api;
}

export type Computers = ReturnType<typeof createComputers>;
