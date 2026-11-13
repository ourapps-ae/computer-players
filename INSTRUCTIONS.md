# Computer players instructions

## For the agent
Select `ourapps-ae/computer-players` once per recipe, always. Map the recipe's computer players answer to `mode`: `none`, `on-request` (default) or `fill-empty`. Set `names` only when the recipe has its own list. Connect `player-strategy` to the strategy component (poker-strategy for poker), `game-clock` and `seating`, then connect the provided `computer-players` to turn-engine (it needs the port even for mode `none`). Give `names` as words separated by spaces.

- Select package `ourapps-ae/computer-players` version `0.6.0`.
- Settings to configure:
  - `names` (string, label; optional; default `Robin Sam Alex Jordan Casey Morgan Taylor Riley`)
  - `mode` (string, label; optional; default `on-request`; `none`, `on-request` or `fill-empty`)
  - `thinkMinMs` (integer; optional; default `300`)
  - `thinkSpreadMs` (integer; optional; default `1200`)
  - `minimumGapMs` (integer; optional; default `4000`)
  - `rebuyDelayMs` (integer; optional; default `4000`)
- Connect the provided `computer-players` (ae/computer-players 1.0.0) to the consumer that needs it.
- Supply `player-strategy` (ae/player-strategy 1.0.0) from the component that provides it.
- Supply `game-clock` (ae/game-clock 1.0.0) from the component that provides it.
- Supply `seating` (ae/seating 1.0.0) from the component that provides it.
- No accounts or keys are needed.

## For the developer
Nothing to supply: no accounts or keys. Choose names that fit the application (each 1 to 20 plain characters); the shipped list is neutral. To change how quickly computers play, change `thinkMinMs`, `thinkSpreadMs` and `minimumGapMs`. To check it works, run the commands below.

## How to check
From the component directory:

- `node --test tests/web.test.ts` (web, required-local; tools: node 26.5)
- `python3 -m aepm review <digest> --store STORE --policy POLICY --trusted --allow-network` checks an archive fetched with `python3 -m aepm fetch ourapps-ae/computer-players@VERSION --store STORE --from https://ourapps.app` and runs its suites.
