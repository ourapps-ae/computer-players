# Source mapping

Reference revision: `19905b75dbea89fbfd424d67fe26c81aaed0e018`. Extraction source: the `recipe/` folder of `ourapps-ae/OurPoker`; paths below are relative to it.

- `implementation/server/computers.ts` <- `server/src/engine.ts`, `server/src/adapter.ts` and `server/src/bot.ts`:
  - `BOT_NAMES` 411 and `addBot` 413-419 (first unused name, lobby action by a person, id `bot-<name>`): `nextName`, `add`, `idFor` (id now `computer-<name>`); names are a setting. The recipe's eight poker-player names are left out of the component; the shipped default list is neutral first names.
  - Filling empty seats: new (mode `fill-empty`).
  - `botDue` 574-579 and the bot branch of `dueStep` 549: `isDue`; the turn engine decides who the due player is.
  - `setActor` 833-839 (`Math.max(settleUntil, actionClock + BOT_MIN_MS) + BOT_THINK_MIN_MS + floor(rng * BOT_THINK_SPREAD_MS)`): `moveDeadline`; `BOT_MIN_MS` 30 is `minimumGapMs`, `BOT_THINK_MIN_MS` 36 is `thinkMinMs`, `BOT_THINK_SPREAD_MS` 37 is `thinkSpreadMs`.
  - `nextWake` 582-608 (wall time from clock time): `wakeAt`, through the injected game-clock.
  - `BOT_REBUY_MS` 28 and `finishHand` 931: `rebuyAt`, `rebuyDelayMs`.
  - `adapter.ts` `advance` 91-102 (strategy move, falling back to check or fold) and `observe` calls 62, 99: `choose`, `observe`; the memory (`BotMemory`) is carried opaquely in `ComputersState`. The fallback move belongs to the game and is applied by turn-engine.
  - Taking over for absent people: new (on unless mode is `none`); the recipe plays them with check-or-fold rules in `dueStep` 551-557, which stays the default.
  - Left behind: the decision-making itself (`bot.ts`, Chen score, equity, personalities by name; they belong to poker-strategy), `PERSONALITIES` keyed by the poker names.
- `generated-platform`: `parseNames` splits on spaces and `names` may be given as text, because the installer's `label` grammar allows no comma; the clock state type is named `ClockState` as in game-clock.
- `examples/consumer.ts`, `tests/fakes.ts`, tests: new.
- No Swift or Kotlin: the recipe's clients have no computer-player logic beyond the robot icon, which is a screen detail.
- `generated-platform`: `mode` (`none | on-request | fill-empty`); `computers.ts` derives `enabled`, `fillEmptySeats` and `takeOverAbsent` from it (`checkSettings`). `takeOverAbsent` is true unless mode is `none`.
