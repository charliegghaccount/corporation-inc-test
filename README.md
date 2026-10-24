# Corporate Climb

An original, playable landscape office tycoon inspired by the 2010 Corporation Inc. All game artwork is drawn in code; no original game assets are used.

## Run locally

Requires Node.js 24 and npm.

```sh
npm ci
npm run dev
```

Open the Vite address with `/corporation-inc-test/`. Build with `npm run build`; serve the production build with `npm run preview`. This is a static application with no backend or credentials. Fonts are bundled locally with their package licenses.

## Play

Start a named company. Build a Button studio by choosing Build and tapping an empty plot. Hire 2–4 button pushers through People. They earn per individual button press between 08:00 and 18:00. Salaries are paid throughout each 240-second day. Pause, 1×, 2× and 4× use the same fixed simulation steps.

Build horizontally, or add a floor and extend the elevator before placing rooms upstairs. Each floor has three room plots. Drag to pan; pinch or scroll to zoom; ↑ focuses upper floors. Tap an occupied room, then an employee profile, for upgrades, promotions or dismissal. Demolition requires an empty room and confirmation, with a 35% refund.

Six room types, seven staff roles, nine research unlocks and fifteen automatic objectives are implemented. IT visits faults, janitors clean at night, and amenities improve morale. Researchers generate points; specialist bonuses, promotions and studio tiers affect real outcomes. Saves are versioned and local to your browser; use the same browser/origin to continue. No offline income.

## Validation

```sh
npm test
npm run build
# With the dev server running and a local Chromium available:
CHROMIUM_PATH=/usr/bin/chromium npm run test:browser
```

Simulation tests exercise placement/capacity, real work revenue, salary reconciliation, lift access and capacity, repairs, cleaning, research, promotions, objective idempotence, save restoration, twelve-day opening economics and speed consistency. Browser checks cover the opening gameplay, revenue, refresh/continue, 844×390 landscape, camera drag, touch events, portrait hint, invalid saves, and runtime errors. Real iOS Safari has not been tested.

## Deploy on GitHub Pages

The Vite base is `/corporation-inc-test/`. `.github/workflows/deploy.yml` tests and builds pushes to `main`, then deploys the build artifact using GitHub Pages Actions.

In repository **Settings → Pages → Build and deployment → Source**, select **GitHub Actions**. If required, run **Test and deploy Corporate Climb** from the Actions tab after enabling Pages. The expected Pages address is `https://charliegghaccount.github.io/corporation-inc-test/`; this is an expected address, not a verified deployment.

## Structure and V1 limitations

- `src/config.ts`: editable room, staff, research and economy figures.
- `src/sim.ts`: seeded, renderer-independent simulation and save validation.
- `src/art.ts`: original Canvas 2D tower, room interiors, characters and camera input.
- `src/main.ts` / `src/style.css`: responsive HTML management UI and local persistence.

Canvas 2D replaces Phaser to keep this small static game lightweight and dependency-free at runtime. UI and simulation remain separate for later native packaging.

Transport is a simplified single car (3 passengers, 6 after research); off-shift staff disappear at the entrance. Amenities and support bonuses are deliberately simplified: breaks visit same-floor common rooms; restroom and management bonuses are proximity/presence effects. Staff profiles are accessed through rooms or People rather than individual sprite hit targets. Rooms are constructed immediately. There is no audio, decorative purchasing, or advanced pathfinding. Economy is an initial calibration, not long-term player-tested balance. There are no normal-game cheats or offline grants.

The external reference sites were inaccessible during implementation due to network policy; the supplied detailed brief was used. Original Flash gameplay was not run.
