# Corporate Climb V3 update

V3 continues the existing game. Five full-size slots fit on every floor; pan horizontally for the outer suites, or use Home to recenter and zoom out. Ideas labs now accommodate four researchers. Room hiring controls stay above the dynamic roster and disable at capacity; profiles provide relocation/swap and individual needs. Research is grouped by Personnel, Facilities and Transport, with prerequisites and point progress.

Toilet need and hunger rise while working; energy falls. Staff physically walk and ride the lift to WC, cafeteria, break-room or gym positions, queue when full and stop earning/researching while absent. Without an appropriate facility, they leave through the ground-floor exit for a 28-second off-site visit. On-site service takes four seconds plus actual travel/queue time. Gym and break visits restore energy. Needs are staggered and bounded. Unmet needs apply a capped morale penalty.

Supervisors reserve a worker, travel beside them, perform a stylised stick swing and grant a non-stacking 15% productivity boost for 40 seconds. Special offices and research improve duration or strength. HR travels to unhappy workers and gives a cooldown-limited morale boost. Working accountants provide a linear bonus capped at 16%, itemised in Finances. New specialist rooms improve their corresponding role. Plants, wall art and water coolers add purchased, persistent morale benefits.

V2 room slots retain their original indices; V1/V2 saves migrate to version 3 with identities, cash, faults, waste, technology and progress intact. Original legacy JSON is retained under the existing save key plus `.v1-backup` or `.v2-backup`; a deliberately replaced company is retained at `.previous`. There is no migration cash refill. All new companies still start with $30,000.

Validation: `npm test` (26 tests), `npm run build`, and with production preview running on port 4173, `npm run test:browser:v3`. Tests cover actual fixed hiring-button coordinates, all five plot positions, four-seat labs, facility queues, off-site visits, cross-floor WC use, social roles, relocation, save migration, twenty-day financial fixtures and a sixty-worker/five-day simulation. Base V2 contact-pixel, cleaning, repairs and speed consistency tests are retained. Real iPhone Safari has not been tested.

Twenty-day mature-company fixtures are pre-funded and fully researched to isolate operating performance (not initial affordability): eight workers without WC/food averaged about $1,971/day operating profit, versus $2,303 with WC/food. Upgraded sixteen-worker and twenty-four-worker teams with support averaged $7,598 and $9,924. The separate unmodified $30,000-start eight-worker regression averaged $1,401/day. No new income multiplier or starting grant was added. Sixty-worker five-day simulation ran in about 0.31 seconds on the cloud CPU; this is a simulation benchmark, not an iPhone frame-rate claim.

Limitations: one shared elevator, simple queues and support targeting, category/prerequisite research lists rather than a graphical research map, preset decoration positions, research-based facility upgrades, simple character interactions and no audio. Longer player calibration is still useful. Original reference sites were inaccessible from the development network; original artwork and the detailed brief guide this implementation.

---

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

Start a new V2 company with $30,000. Build a Button studio by choosing Build and tapping an empty plot. Hire 2–4 button pushers through People. They earn per individual button press between 08:00 and 18:00. Salaries are paid throughout each 240-second day. Pause, 1×, 2×, 4×, 8× and 16× use the same fixed simulation steps.

Build horizontally, or add a floor and extend the elevator before placing rooms upstairs. Each floor has five full-size room plots, with a separate elevator shaft. Drag to pan; pinch or scroll to zoom; ↑ focuses upper floors. Tap an occupied room, then an employee profile, for upgrades, promotions or dismissal. Demolition requires an empty room and confirmation, with a 35% refund.

Thirteen room types, seven staff roles, twenty-four research unlocks and twenty-eight automatic objectives are implemented. IT visits faults, janitors clean at night, and amenities improve morale. Researchers generate points; specialist bonuses, promotions and studio tiers affect real outcomes. Saves are versioned and local to your browser; use the same browser/origin to continue. No offline income.

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

Hosting uses GitHub Pages and is already enabled. Pushes to `main` run the test/build/deployment workflow. The existing public game is at https://charliegghaccount.github.io/corporation-inc-test/ .

## V2 update

See [ECONOMY.md](ECONOMY.md) for the audit, editable balance figures and 20-day strategy results. The finance screen separates wages and real button revenue from rewards and investment spending.

Paper is generated by actual contacts and stored per desk. Night janitors reserve individual bins, walk to them and empty them after eight seconds. IT technicians reserve specific broken computers and repair them after ten seconds. Jobs and progress persist, including pauses across shifts. Staff use stable desk assignments; pressing artwork uses the same contact point and phase as revenue. Walking uses frame-independent smoothing and directional articulated legs. High-speed popups aggregate earned income to avoid visual spam.

V1 saves migrate without a money refill. Their original JSON is retained at `corporate-climb-v1.v1-backup` when continued; starting a new company requires confirmation and retains the prior save at `corporate-climb-v1.previous`. Current saves retain the existing storage key for a smooth update. Legacy financial reports cannot separate historical rewards from revenue; the panel labels that limitation.

For the extended production-browser acceptance run (about 80 seconds), start `npm run preview -- --port 4173`, then run `TEST_URL=http://localhost:4173/corporation-inc-test/ npm run test:browser:v2`. The normal shorter smoke test is still available. These tests use a local Chromium executable, default `/usr/bin/chromium`.

## Structure and remaining limitations

- `src/config.ts`: editable room, staff, research and economy figures.
- `src/sim.ts`: seeded, renderer-independent simulation and save validation.
- `src/art.ts`: original Canvas 2D tower, room interiors, characters and camera input.
- `src/main.ts` / `src/style.css`: responsive HTML management UI and local persistence.

Canvas 2D replaces Phaser to keep this small static game lightweight and dependency-free at runtime. UI and simulation remain separate for later native packaging.

Transport is a simplified single car (3 passengers, 6 after research); off-shift staff disappear at the entrance. Employees physically visit capacity-limited facilities, including cross-floor trips and off-site fallback. Supervisors and HR patrol to individual workers; accountants must work to contribute. Facility upgrades are currently research-based rather than individual room tiers. Staff profiles are accessed through rooms or People rather than individual sprite hit targets. Rooms are constructed immediately. There is no audio, decorative purchasing, or advanced pathfinding. Economy is deterministically calibrated; longer player testing is still valuable. There are no normal-game cheats or offline grants.

The external reference sites were inaccessible during implementation due to network policy; the supplied detailed brief was used. Original Flash gameplay was not run.
