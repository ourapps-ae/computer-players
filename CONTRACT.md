# Computer players component

## Purpose and facilities
`computer-players` seats and paces computer players. It takes the next unused name from a configurable list and seats it as a computer player, can fill every empty seat when the game starts, decides whether the computer side moves for a given player (always for a computer, and optionally for a person who is away or sitting out), works out when the move falls due (never sooner than a minimum gap after now, never before the table has settled, then a thinking time of a minimum plus a random share of a spread), and the delay before a computer accepts a rebuy. The moves themselves come from the injected player strategy; the component carries the strategy's memory of opponents between moves.

Facilities: `fill-seats` (Add one computer player on request, or fill every empty seat when the game starts); `names` (A configurable list of names with a neutral default); `pacing` (Settle, minimum gap and thinking time before a computer moves; delay before it accepts a rebuy); `take-over` (Optionally play for a person who is away or sitting out); `memory` (Carries the strategy's memory of how each opponent has played).

## User inputs
Settings (all optional): `names` (a space separated list, default eight neutral first names; the installer's label grammar allows no comma, so a name from the setting cannot hold a space; `parseNames` splits on spaces, and the API takes a list; the recipe's poker names stay in the recipe), `mode` (`none`, `on-request` or `fill-empty`; default `on-request`; label grammar), `thinkMinMs` (300), `thinkSpreadMs` (1200), `minimumGapMs` (4000) and `rebuyDelayMs` (4000). `mode`: `none` seats no computer (`add` is refused, `fill` adds none, nobody plays for an absent person), which is how a recipe without computer players uses this component; `on-request` lets a person add a computer and has a computer play for a person who is away or sitting out; `fill-empty` does the same and also fills every empty seat when the game starts. `createComputers(...).settings` carries the derived values `enabled` (mode is not none), `fillEmptySeats` (mode is fill-empty) and `takeOverAbsent` (same as enabled). Names must be 1 to 20 plain characters and distinct.

- `names` (string, label; optional; default `Robin Sam Alex Jordan Casey Morgan Taylor Riley`)
- `mode` (string, label; optional; default `on-request`; `none`, `on-request` or `fill-empty`)
- `thinkMinMs` (integer; optional; default `300`)
- `thinkSpreadMs` (integer; optional; default `1200`)
- `minimumGapMs` (integer; optional; default `4000`)
- `rebuyDelayMs` (integer; optional; default `4000`)

## Artefacts and dependencies
`component.json` maps every `implementation/` source into `components/computer-players/`:

- `implementation/server/computers.ts` -> `components/computer-players/server/computers.ts`

Dependencies: none.
`tools.lock.json` pins verification tools: node 26.5.0. Licence: `Apache-2.0` (`LICENCE`, `NOTICE`).

## Provided interfaces
- `interfaces/computer-players.json` defines `computer-players` (ae/computer-players) version 1.0.0: an OpenRPC 1.3.2 document, one method per function (a member of a created object is `<Type>.<member>`), with parameter, result and data types as JSON Schema 2020-12 (`components.schemas`) and thrown errors under `errors`.

## Required interfaces
- `player-strategy` (ae/player-strategy) version 1.0.0, supplied by the recipe or application.
- `game-clock` (ae/game-clock) version 1.0.0, supplied by the recipe or application.
- `seating` (ae/seating) version 1.0.0, supplied by the recipe or application.

Each `interfaces/required-<id>.json` is a byte copy of the providing component's document.

## Integration
Build it once with `createComputers(settings, {strategy, clock, seating})` from `implementation/server/computers.ts`. The turn engine keeps the state (`create`) in the game state, calls `add` for the add-computer action, `fill` when the game starts, `actsFor` and `moveDeadline` when it sets a player's turn, `isDue` when the room asks for due moves, `choose` and `observe` for the strategy, and `rebuyDelayMs` for the tournament. The strategy's `observation` is whatever the game rules give a player as what they know. The clock is game-clock's `elapsed(clock, 'action')` and `wallAt(clock, 'action', ms)`; its state type is `ClockState`. The strategy is poker-strategy's `newMemory`, `choose(observation, playerId, rng, memory)` and `observe(memory, observation, playerId, move)`; `observe` may return the new memory or change it in place.

## Visual definition and connected examples
`visual/definition.json` maps its ports to the provided and required interfaces. `visual/examples/connected.json` connects the component to an illustrative application consumer. Both image formats and a text description are retained under `visual/output/`.

## Infrastructure
No service is deployed. The only state is the strategy's memory, part of the game state the room stores. No accounts or keys.

## Verification
`node --test tests/web.test.ts` checks settings, neutral default names (none of the recipe's poker names), name list parsing (space separated, the default fitting aepm's label grammar), `mode` (the default, the three derived values for each mode, refusal of an unknown mode), mode `none`, adding until names or seats run out, filling, take-over of absent players, deadline arithmetic (settle, gap, thinking time, bounds), wake time, rebuy time, strategy calls that cannot change the stored memory, and the runnable consumer. The tests use small stand-ins for the strategy, clock and seating (`tests/fakes.ts`). No Swift or Kotlin: the recipe's clients have no computer-player code.

- `node --test tests/web.test.ts` (web, required-local; tools: node 26.5.0)

## Scenarios and presentation
A person sits alone, taps add computer and a computer named Robin sits. With mode `fill-empty` the host starts with two people at a nine-seat room and seven computers join. A computer is next to act at action-clock 10000 with the table settled at 14000: it moves at 14000 plus 300 plus up to 1200 more. With mode `on-request` or `fill-empty` the computer side plays for a person whose connection has gone.

## Updates and removal
Patch updates replace files; no stored data of its own beyond the strategy memory in the game state. Removal deletes the owned sources and the application's imports. A computer plays for a person who is away unless mode is `none`.
