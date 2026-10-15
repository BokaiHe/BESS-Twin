# BESS Twin engineering instructions

- Stack: React, Vite, strict TypeScript; package-lock.json and exact dependency versions are authoritative.
- Keep physics and dispatch inside src/simulation; no React or render-loop dependencies there.
- The time slider only reads immutable precomputed snapshots. Never integrate energy or costs on seek.
- NODES/EDGES define electrical connectivity. Every line animation and equipment card reads the shared Snapshot.
- Preserve separate DC potential, AC clipping, network curtailment, demand and unserved load.
- Peak shaving takes priority over tariff arbitrage. Retain per-unit SOC and energy when a unit goes offline; re-plan the peak import level after a fault.
- Run npm.cmd test and npm.cmd run build after simulation changes. For UI changes, run the applicable Playwright smoke tests.
- Keep demo/estimated labels explicit. Do not add nonfunctional remote-control buttons.
- The simulation emits language-neutral codes (strategy, alarms). All user-facing text lives in src/i18n.tsx (explorer Chinese copy in src/explorerCopyZh.ts); add both zh and en.
- After changing explorer geometry, run npm run explorers:previews to refresh the overview hub images.
- Scenarios are periodic steady states: keep day-end stored energy equal to day-start for sunny and cloudy.
- Read docs/simulation.md and docs/data-contract.md before changing capacities, units, signs or time semantics.
