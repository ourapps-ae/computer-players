import assert from "node:assert/strict";
import test from "node:test";
import { checkSettings, createComputers, DEFAULT_NAMES, MODES, parseNames, type ComputerMode, type ComputerSettings } from "../implementation/server/computers.ts";
import { clock, seating, strategy, type FakeSeats } from "./fakes.ts";
import { table } from "../examples/consumer.ts";

const make = (s: Partial<ComputerSettings> = {}) => createComputers(s, { strategy, clock, seating });
const seats = (max = 4, ...entries: [string, string, boolean?][]): FakeSeats => ({ max, seats: entries.map(([id, name, computer]) => ({ id, name, computer: computer === true })) });
const rngOf = (value: number) => () => value;

test("default names are neutral and settings are checked", () => {
  assert.equal(DEFAULT_NAMES.length, 8);
  for (const poker of ["Doyle", "Stu", "Jennifer", "Amarillo", "Vanessa", "Chip", "Johnny", "Annette"]) assert.ok(!DEFAULT_NAMES.includes(poker));
  assert.equal(checkSettings({}).thinkMinMs, 300);
  assert.throws(() => checkSettings({ names: [] }));
  assert.throws(() => checkSettings({ names: ["A", "A"] }));
  assert.throws(() => checkSettings({ names: ["This name is much too long for a seat"] }));
  assert.throws(() => checkSettings({ names: [" A"] }));
  assert.throws(() => checkSettings({ thinkSpreadMs: -1 }));
  assert.throws(() => checkSettings({ thinkMinMs: 1.5 }));
});

test("mode derives enabled, fillEmptySeats and takeOverAbsent; the default is on-request", () => {
  const derived = (mode?: ComputerMode) => { const s = checkSettings(mode ? { mode } : {}); return [s.mode, s.enabled, s.fillEmptySeats, s.takeOverAbsent]; };
  assert.deepEqual(derived(), ["on-request", true, false, true]);
  assert.deepEqual(derived("on-request"), ["on-request", true, false, true]);
  assert.deepEqual(derived("fill-empty"), ["fill-empty", true, true, true]);
  assert.deepEqual(derived("none"), ["none", false, false, false]);
  assert.deepEqual(MODES, ["none", "on-request", "fill-empty"]);
  for (const mode of MODES) assert.ok(/^[A-Za-z][A-Za-z0-9 -]{0,63}$/.test(mode), "each mode fits aepm's label grammar");
  assert.throws(() => checkSettings({ mode: "always" as ComputerMode }), /mode must be one of/);
  assert.throws(() => checkSettings({ mode: true as unknown as ComputerMode }));
});

test("name lists parse from the installer's space separated text", () => {
  assert.deepEqual(parseNames("Ann  Bob Cat Ann"), ["Ann", "Bob", "Cat"]);
  assert.deepEqual(parseNames("Ann, Bob"), ["Ann,", "Bob"], "a comma is part of a name");
  assert.deepEqual(parseNames(""), []);
});

test("names may be one space separated text that fits the installer's label grammar", () => {
  const LABEL = /^[A-Za-z][A-Za-z0-9 -]{0,63}$/;
  const installerDefault = DEFAULT_NAMES.join(" ");
  assert.ok(LABEL.test(installerDefault), "the default setting text matches aepm's label grammar");
  assert.deepEqual(parseNames(installerDefault), DEFAULT_NAMES);
  assert.deepEqual(checkSettings({ names: installerDefault }).names, DEFAULT_NAMES);
  assert.deepEqual(checkSettings({ names: "Ann Bob" }).names, ["Ann", "Bob"]);
  assert.throws(() => checkSettings({ names: "  " }));
  const c = make({ names: "Ann Bob", mode: "fill-empty" });
  assert.deepEqual(c.fill(seats(3, ["p", "Pia"])).added, ["Ann", "Bob"]);
});

test("mode none seats no computer, refuses the add action and plays for nobody", () => {
  const off = make({ mode: "none" });
  const start = seats(4, ["p", "Pia"]);
  assert.deepEqual(off.add(start, "p"), { ok: false, code: "notAllowed" });
  assert.deepEqual(off.fill(start), { state: start, added: [] });
  assert.equal(off.actsFor(start, { id: "p", connected: false, sittingOut: true }), false, "takeOverAbsent is off with mode none");
  assert.equal(checkSettings({}).enabled, true);
});

test("adding seats the next unused name as a computer, stable ids, until names or seats run out", () => {
  const c = make({ names: ["Ann", "Bob"] });
  let s = seats(5, ["p", "Person"]);
  for (const expected of ["Ann", "Bob"]) {
    const r = c.add(s, "p");
    assert.ok(r.ok);
    assert.equal(r.name, expected);
    s = r.state;
  }
  assert.deepEqual(s.seats.map((x) => [x.id, x.computer]), [["p", false], ["computer-ann", true], ["computer-bob", true]]);
  assert.deepEqual(c.add(s, "p"), { ok: false, code: "roomFull" }, "names used up");
  assert.deepEqual(c.add(seats(2, ["p", "Person"], ["x", "X"]), "p"), { ok: false, code: "roomFull" });
  assert.deepEqual(c.add(s, "computer-ann"), { ok: false, code: "notAllowed" });
  assert.equal(c.nextName(seats(5, ["q", "Ann"])), "Bob");
  assert.equal(c.idFor("Mary Jane"), "computer-mary-jane");
});

test("fill seats computers only when asked, up to the table size", () => {
  const start = seats(4, ["p", "Person"]);
  assert.deepEqual(make().fill(start), { state: start, added: [] });
  const c = make({ mode: "fill-empty", names: ["Ann", "Bob", "Cat", "Dee"] });
  const f = c.fill(start);
  assert.deepEqual(f.added, ["Ann", "Bob", "Cat"]);
  assert.equal(f.state.seats.length, 4);
  const short = make({ mode: "fill-empty", names: ["Ann"] }).fill(start);
  assert.deepEqual(short.added, ["Ann"]);
});

test("a computer moves for itself; for a person who is away unless mode is none", () => {
  const s = seats(4, ["p", "Person"], ["computer-ann", "Ann", true]);
  const here = { id: "p", connected: true, sittingOut: false };
  for (const c of [make(), make({ mode: "fill-empty" })]) {
    assert.equal(c.actsFor(s, { id: "computer-ann", connected: true, sittingOut: false }), true);
    assert.equal(c.actsFor(s, here), false);
    assert.equal(c.actsFor(s, { ...here, connected: false }), true);
    assert.equal(c.actsFor(s, { ...here, sittingOut: true }), true);
  }
  assert.equal(make({ mode: "none" }).actsFor(s, { ...here, connected: false }), false);
});

test("move deadlines wait out the settle and the minimum gap, then think", () => {
  const c = make({ minimumGapMs: 4000, thinkMinMs: 300, thinkSpreadMs: 1200 });
  const at = (action: number) => ({ action, level: 0, at: 0 });
  assert.equal(c.moveDeadline(at(10_000), 14_000, rngOf(0)), 14_300);
  assert.equal(c.moveDeadline(at(10_000), 11_000, rngOf(0)), 14_300, "the gap beats a short settle");
  assert.equal(c.moveDeadline(at(10_000), 20_000, rngOf(0.999)), 20_000 + 300 + 1198);
  for (let i = 0; i < 50; i++) {
    const d = c.moveDeadline(at(0), 4000, Math.random);
    assert.ok(d >= 4300 && d < 5500);
  }
  assert.equal(c.isDue(at(14_300), 14_300), true);
  assert.equal(c.isDue(at(14_299), 14_300), false);
  assert.equal(c.wakeAt({ action: 100, level: 0, at: 9000 }, 600), 9500);
  assert.equal(c.wakeAt({ action: 700, level: 0, at: 9000 }, 600), 9000);
  assert.equal(c.rebuyAt(at(2500)), 6500);
});

test("the strategy is asked without letting it change the stored memory; observations accumulate", () => {
  const c = make();
  let state = c.create();
  assert.deepEqual(state, { memory: {} });
  const chosen = c.choose(state, { legal: ["fold"] }, "computer-ann", Math.random);
  assert.deepEqual(chosen.move, { type: "fold", by: "computer-ann", seen: 0 });
  assert.equal(c.choose(state, { legal: [] }, "computer-ann", Math.random).move, null);
  state = c.observe(state, {}, "p", { type: "fold" });
  state = c.observe(state, {}, "p", { type: "fold" });
  const before = structuredClone(state);
  c.choose(state, { legal: ["x"] }, "p", Math.random);
  assert.deepEqual(state, before);
  assert.deepEqual(state.memory, { p: 2 });
  assert.deepEqual(c.forget(), { memory: {} });
  const returning = createComputers({}, { strategy: { ...strategy, observe: (m: unknown) => ({ replaced: true, was: m }) }, clock, seating });
  assert.deepEqual(returning.observe(returning.create(), {}, "p", {}), { memory: { replaced: true, was: {} } });
});

test("the example fills seats and schedules a move without a game", () => {
  const r = table();
  assert.deepEqual(r.added, ["Ann", "Bob"]);
  assert.equal(r.deadline, 5000 + 300 + 600);
  assert.equal(r.due, true);
  assert.deepEqual(r.move, { type: "pass", by: "computer-ann", seen: 0 });
});
