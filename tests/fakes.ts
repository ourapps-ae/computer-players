// Minimal stand-ins for the player-strategy, game-clock and seating components, for tests only.
export type FakeSeats = { seats: { id: string; name: string; computer: boolean }[]; max: number };

export const seating = {
  isFull: (s: FakeSeats) => s.seats.length >= s.max,
  find: (s: FakeSeats, id: string) => s.seats.find((x) => x.id === id),
  findByName: (s: FakeSeats, name: string) => s.seats.find((x) => x.name === name),
  join(s: FakeSeats, id: string, name: string, options: { computer?: boolean } = {}): { ok: true; state: FakeSeats } | { ok: false; code: string } {
    if (s.seats.length >= s.max) return { ok: false, code: "roomFull" };
    return { ok: true, state: { ...s, seats: [...s.seats, { id, name, computer: options.computer === true }] } };
  },
  canAddComputer(s: FakeSeats, byId: string): { ok: true } | { ok: false; code: string } {
    const by = s.seats.find((x) => x.id === byId);
    if (!by || by.computer) return { ok: false, code: "notAllowed" };
    return s.seats.length >= s.max ? { ok: false, code: "roomFull" } : { ok: true };
  },
};

export type FakeClock = { action: number; level: number; at: number };
export const clock = {
  elapsed: (c: FakeClock, which: "action" | "level") => c[which],
  wallAt: (c: FakeClock, which: "action" | "level", target: number) => c.at + Math.max(0, target - c[which]),
};

// Plays "pass" unless told otherwise; remembers how many moves each player made.
export const strategy = {
  newMemory: () => ({} as Record<string, number>),
  choose: (observation: unknown, playerId: string, _rng: () => number, memory: unknown) => ((observation as { legal?: string[] }).legal?.[0] ?? null) && { type: (observation as { legal: string[] }).legal[0], by: playerId, seen: Object.keys(memory as object).length },
  observe(memory: unknown, _observation: unknown, playerId: string) {
    const m = memory as Record<string, number>;
    m[playerId] = (m[playerId] ?? 0) + 1;
  },
};
