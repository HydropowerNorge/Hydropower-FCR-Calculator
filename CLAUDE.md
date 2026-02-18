# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Electron desktop app ("Hydropower") for analyzing battery revenue from FCR-N frequency response and aFRR reserve markets in the Nordic electricity grid. Uses Convex as the data backend.

## Development Commands

```bash
npm start                    # Run Electron app with Vite HMR
npm run convex:dev           # Run Convex dev watcher (keep open alongside app)
npm run convex:dev:local     # Run local anonymous Convex deployment
npm run convex:seed          # Parse CSV/JSON and upsert into Convex
npm run convex:seed:local    # Seed local Convex in one shot
npm run convex:deploy        # Deploy Convex functions to production
npm run make                 # Build release artifacts
npm run typecheck            # Run TypeScript type checking (tsc -b)
npm run lint                 # Run ESLint on src/
npm run lint:fix             # Run ESLint with auto-fix
```

Typical local dev: run `npm run convex:dev` in one terminal, `npm start` in another. The app needs `CONVEX_URL` set in `.env` or `.env.local`.

## Architecture

Three-tier: Electron main process ↔ renderer (IPC via preload bridge) ↔ Convex backend (HTTP).

### Main Process (`src/main.ts`)
Single file (~1170 lines). Handles window management, auto-update (`update-electron-app` via GitHub Releases), IPC handlers for file I/O (CSV/XLSX/PDF export), app metadata IPC (`app:getVersion`), and Convex HTTP queries for loading price/spot data. Loads env from `.env`/`.env.local` with dotenv.

### Preload (`src/preload.ts`)
Context-isolated bridge exposing `window.electronAPI` with safe IPC methods. Renderer has no direct Node.js access. The `ElectronAPI` interface is defined in `src/shared/electron-api.d.ts`.

### Renderer (`src/renderer/`)
Vanilla TypeScript + HTML/CSS (no framework). Key modules:
- **`app.ts`** — UI orchestrator, tab management, state coordination
- **`calculator.ts`** — Battery config, FCR-N activation logic (linear response in 49.9–50.1 Hz band), SOC simulation with NEM restoration
- **`frequency.ts`** — Realistic Nordic grid frequency simulation using seeded RNG (LCG), 3 volatility profiles, Poisson/exponential distributions
- **`afrr.ts`** — aFRR yearly revenue calculation engine (solar curtailment, capacity bidding)
- **`afrr-ui.ts`** — UI for aFRR module (charts, CSV export, summary table)
- **`simulation-worker.ts`** — Web Worker for offloading heavy FCR computation

Charts rendered with Chart.js; CSV parsing with PapaParse; Excel exports built with `xlsx` (`excel-export.ts`).

### Shared Types (`src/shared/`)
- **`electron-api.d.ts`** — Central type definitions for the IPC bridge: `ElectronAPI` interface, data row types (`FcrPriceRow`, `SpotPriceRow`, `AfrrMarketRow`, `SolarProductionRow`, `NodeTenderRow`), PDF export type (`PdfExportData`), and the `Window` augmentation so renderer code can use `window.electronAPI` without casts.

### Convex Backend (`convex/`)
TypeScript. Tables: `fcrPrices`, `spotPrices`, `afrrMarket`, `afrrSeries`, `solarProduction`, `solarSeries`, `nodeTenders`. All queries use pagination for full-year datasets. Schema in `convex/schema.ts`, queries in `convex/prices.ts`, `convex/spot.ts`, `convex/solar.ts`, `convex/afrr.ts`, `convex/nodes.ts`, ingestion in `convex/ingest.ts`.

Solar data has strict separation: 60-min and 15-min resolutions are independent series, never combined. Always pass `resolutionMinutes` when querying.

### Data Seeding (`scripts/seed-convex.js`)
Imports FCR price CSVs and solar JSON files into Convex. Default solar file paths: `~/Downloads/solar_production_hourly_2026.json` (60m) and `~/Downloads/solar_production_15min_2026.json` (15m). Override with `SOLAR_PRODUCTION_HOURLY_JSON` and `SOLAR_PRODUCTION_15MIN_JSON` env vars.

## TypeScript & Linting

All `src/` code is TypeScript with strict mode. Two tsconfig project references split the codebase:
- **`tsconfig.main.json`** — Main process + preload: `target: ES2022`, `module: CommonJS`, `types: ["node"]`, no DOM.
- **`tsconfig.renderer.json`** — Renderer: `target: ES2022`, `module: ESNext`, `moduleResolution: Bundler`, `lib: ["DOM", "WebWorker"]`.

ESLint 9 flat config (`eslint.config.mjs`) uses `typescript-eslint` recommended rules. `@typescript-eslint/no-require-imports` is off (main process needs `require()` for dynamic imports like `update-electron-app`).

The Convex backend (`convex/`) has its own TypeScript toolchain and is not covered by the root tsconfigs or ESLint.

## Build & Release

Electron Forge with Vite plugin (3 configs: main, preload, renderer). Vite transpiles `.ts` via esbuild — no separate compile step needed. Makers: ZIP (macOS/Linux), Squirrel (Windows), DMG (macOS). Release triggered by version bump in `package.json` on `main` — CI builds for macOS (arm64), Windows (x64 + arm64), Linux (x64).

## Key Patterns

- All Convex data loading happens in the main process with pagination, then sent to renderer via IPC
- Frequency simulation uses seeded RNG for reproducible results
- Web Worker isolates simulation compute from UI thread
- UI uses a tabbed interface: Årskalkyle, FCR-N, aFRR, Nodes, Forklaring
- IPC types are centralized in `src/shared/electron-api.d.ts` — update this file when adding/changing IPC channels
- When adding new IPC methods: update `electron-api.d.ts` interface, `preload.ts` bridge, and `main.ts` handler
