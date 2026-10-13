# BESS Twin

An interactive digital twin of a renewable energy park, built with React, Vite, TypeScript and Three.js. Explore how solar, wind, battery storage, the utility grid and consumers work together throughout a simulated day.

**[Live demo](https://bokaihe.github.io/BESS-Twin/)** · **[Source](https://github.com/BokaiHe/BESS-Twin)**

![BESS Twin energy park](docs/screenshots/overview-en.png)

> This is an illustrative simulation, not a connection to operating equipment or a remote-control system.

## Features

- **Interactive 3D site:** procedural solar panels, wind turbines, battery containers, substations, industrial buildings and homes, with animated power flows and camera controls.
- **Three full-day scenarios:** sunny, cloudy with low wind, and a battery over-temperature fault.
- **Deterministic playback:** 1,440 immutable minute snapshots per scenario. Seeking reads a snapshot; it never integrates energy or costs again.
- **Shared electrical topology:** cards, connected-line highlights, particle directions and charts read the same node and edge data.
- **Equipment-specific details:** power, SOC, temperature, available discharge capability, ratings and alarms.
- **Tariff-aware operation:** peak shaving takes priority; renewable surplus is stored before grid charging is considered.
- **Transparent bill comparison:** full-day and up-to-now breakdowns, with explicit treatment of baseline supply shortages and fault-day energy inventory.
- **13-step guided walkthrough:** module explanations, highlights, camera focus, Back/Next and early exit. Playback pauses during the tour.
- **English by default**, with a Chinese language toggle and persistence of explicit language choices.
- **Responsive layout** for desktop and mobile.

## Run locally

Use Node.js 22.12 or newer. Node.js 24 is used for deployment and has been verified locally.

```bash
git clone https://github.com/BokaiHe/BESS-Twin.git
cd BESS-Twin
npm ci
npm run dev
```

Open the local URL printed by Vite, normally `http://127.0.0.1:5173/`.

On Windows PowerShell, use `npm.cmd` if execution policy blocks `npm.ps1`.

No backend, API keys, external 3D assets or paid services are required to run the demo. A WebGL-capable browser is recommended for the 3D view.

## Explore the demo

1. Open **Guided tour** for a step-by-step introduction to the modules.
2. Select a full-day scenario at the top of the screen.
3. Use the timeline, chart or time bookmarks to inspect midday and the evening peak.
4. Select a 3D object, label or device row to inspect its measurements and connected lines.
5. Open the bill card to compare costs, or the alarm bell to locate affected equipment.

The fault scenario jumps to 17:30, when BESS-04 trips. Dashed grid and SOC curves show the sunny-day reference. Power curves use minute-by-minute steps so the fault impact is not drawn before it occurs.

## Reference system

| Component                     | Configuration                                                       |
| ----------------------------- | ------------------------------------------------------------------- |
| Solar PV                      | 20 MWp DC / 16 MW AC                                                |
| Wind                          | 3 × 4 MW                                                            |
| BESS                          | 4 × 2.5 MW / 5 MWh; 10 MW / 20 MWh total                            |
| Battery operating range       | 10–90% SOC                                                          |
| Charge / discharge efficiency | 95% / 95%                                                           |
| Grid exchange                 | Import and export each limited to 15 MW                             |
| Grid connection               | External 110 kV grid → 110/35 kV transformer → 35 kV collection bus |
| Consumers                     | Industrial load and residential / EV load with staggered peaks      |

Generation, storage and loads connect in parallel through the collection bus. Storage is bidirectional; it is not a mandatory series link between generation and consumers.

### Dispatch and fault behavior

The model prioritizes the grid limit, stores renewable surplus, and plans tariff-based charging and discharge while retaining energy for peak shaving. It assumes perfect weather and load forecasts; equipment faults are not anticipated.

Sunny and cloudy days use periodic initial conditions: day-end stored energy equals day-start stored energy, at approximately 15% initial SOC. The fault day starts from the sunny state but is **not periodic**. At 17:30, BESS-04 goes offline and its energy is frozen; the remaining units provide up to 7.5 MW of rated power, subject to SOC constraints.

### Time and financial semantics

Each snapshot describes a one-minute interval. Power applies to that interval; SOC and accumulated costs describe its start. Full-day totals include the final interval and live in `day.summary`.

Bill difference is the no-storage baseline's net energy bill minus the storage case's bill, with identical weather, demand, tariffs and grid limits. If the baseline leaves demand unserved, a like-for-like savings claim is unavailable: the UI labels the raw bill difference, hides the savings percentage, and the report sets `daySavingsCny` to `null`.

Fault-day inventory changes and frozen offline energy are reported separately. Bills do not assign a monetary value to inventory changes. Example tariffs exclude demand charges, depreciation, maintenance and investment costs. English currency values use a disclosed illustrative CNY-to-USD conversion.

The fixed simulation date is `2026-06-18`, UTC+08:00; it is independent of the computer's current date.

## Development commands

| Command                | Purpose                                               |
| ---------------------- | ----------------------------------------------------- |
| `npm run dev`          | Start the local Vite server                           |
| `npm test`             | Run the simulation and data-contract tests            |
| `npm run build`        | Type-check and build for a site served at `/`         |
| `npm run build:pages`  | Build for the GitHub Pages `/BESS-Twin/` path         |
| `npm run preview`      | Preview a local production build                      |
| `npm run test:e2e`     | Run Playwright desktop, mobile and walkthrough checks |
| `npm run report`       | Regenerate `docs/simulation-report.json`              |
| `npm run format:check` | Check formatting                                      |

The browser tests currently use the installed Microsoft Edge channel and start a test server on port 5178. On a machine without Edge, install that browser or change `channel` in `playwright.config.ts` to a browser available in your environment.

Verified baseline: **46 unit tests**, **5 browser flows**, and a production build. Browser coverage includes scenario changes, deterministic seeking, the exact fault boundary on the rendered chart, bill comparability, language persistence and all 13 walkthrough steps.

## Project structure

```text
src/
  domain/       Types, capacities and electrical topology
  simulation/   Deterministic profiles, dispatch, energy and bill calculations
  data/         Snapshot data-source adapter
  components/   Three.js scene, geometry and equipment models
  ui/           Dashboard cards, charts, dialogs and guided walkthrough
  i18n.tsx      English and Chinese interface copy
  App.tsx       Application state and coordination
e2e/            Browser regression tests
scripts/        Simulation report generator
docs/           Model specifications, data contract, verification and screenshots
.github/        Automated GitHub Pages deployment
```

Simulation code has no React or render-loop dependencies. The interface reads `Snapshot` objects through `TwinDataSource`; a future live adapter will need validation, device mapping, timestamp alignment and explicit handling of stale or missing measurements.

Additional engineering documents are currently in Chinese: [simulation specification](docs/simulation.md), [data contract](docs/data-contract.md), and [verification record](docs/verification.md).

## Deployment

The GitHub Actions workflow runs unit tests, builds with `npm run build:pages`, and deploys `dist/` to GitHub Pages on pushes to `main`. It can also be triggered manually. The deployment uses GitHub's built-in token; no repository secret or third-party hosting account is required.

For a fork, enable **Settings → Pages → GitHub Actions**. If the repository name changes, update the Pages base path in `vite.config.ts` and the demo link above.

Local build products, dependencies, test traces, logs, environment files and editor-specific settings are ignored by Git.

## Model boundaries

This is an active-power balance demonstration, not an AC power-flow or protection study. Reactive power, detailed network losses, battery ageing and physical thermal dynamics are not modeled; temperature and SOH are illustrative. Real telemetry and remote equipment control are not implemented.

The 3D and chart bundles are comparatively large; the 3D scene is lazy-loaded. Rendering quality and speed depend on the browser and GPU.
