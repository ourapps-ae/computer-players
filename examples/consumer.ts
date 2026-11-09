// Computer players for a table without any game: seat them, schedule a move, play it.
import { createComputers } from "../implementation/server/computers.ts";
import { clock, seating, strategy, type FakeSeats } from "../tests/fakes.ts";

export function table() {
  const computers = createComputers({ mode: "fill-empty", names: ["Ann", "Bob", "Cat"] }, { strategy, clock, seating });
  const seated: FakeSeats = { seats: [{ id: "p1", name: "Person", computer: false }], max: 3 };
  const filled = computers.fill(seated);
  const state = computers.create();
  const now = { action: 1000, level: 0, at: 50_000 };
  const deadline = computers.moveDeadline(now, 5000, () => 0.5);
  const choice = computers.choose(state, { legal: ["pass"] }, "computer-ann", Math.random);
  return { added: filled.added, deadline, due: computers.isDue({ ...now, action: deadline }, deadline), move: choice.move };
}
