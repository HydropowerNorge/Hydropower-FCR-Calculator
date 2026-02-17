# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Electron desktop app ("Hydropower") for analyzing battery revenue from FCR-N frequency response and spot arbitrage markets in the Nordic electricity grid. Uses Convex as the data backend.

## Development Commands

```bash
npm start                    # Run Electron app with Vite HMR
npm run convex:dev           # Run Convex dev watcher (keep open alongside app)
npm run convex:dev:local     # Run local anonymous Convex deployment
npm run convex:seed          # Parse CSV/JSON and upsert into Convex
npm run convex:seed:local    # Seed local Convex in one shot
npm run convex:deploy        # Deploy Convex functions to production
npm run make                 # Build release artifacts
```

Typical local dev: run `npm run convex:dev` in one terminal, `npm start` in another. The app needs `CONVEX_URL` set in `.env` or `.env.local`.

## Architecture

Three-tier: Electron main process ↔ renderer (IPC via preload bridge) ↔ Convex backend (HTTP).

### Main Process (`src/main.js`)
Single file (~840 lines). Handles window management, auto-update (`update-electron-app` via GitHub Releases), IPC handlers for file I/O (CSV/XLSX/PDF export via ExcelJS), and Convex HTTP queries for loading price/spot data. Loads env from `.env`/`.env.local` with dotenv.

### Preload (`src/preload.js`)
Context-isolated bridge exposing `window.electronAPI` with safe IPC methods. Renderer has no direct Node.js access.

### Renderer (`src/renderer/`)
Vanilla JS + HTML/CSS (no framework). Key modules:
- **`app.js`** — UI orchestrator, tab management, state coordination
- **`calculator.js`** — Battery config, FCR-N activation logic (linear response in 49.9–50.1 Hz band), SOC simulation with NEM restoration
- **`frequency.js`** — Realistic Nordic grid frequency simulation using seeded RNG (LCG), 3 volatility profiles, Poisson/exponential distributions
- **`arbitrage.js`** — Spot price buy-low/sell-high day-by-day simulation with efficiency losses
- **`arbitrage-ui.js`** — UI for arbitrage module
- **`simulation-worker.js`** — Web Worker for offloading heavy FCR computation

Charts rendered with Chart.js; CSV parsing with PapaParse.

### Convex Backend (`convex/`)
TypeScript. Tables: `fcrPrices`, `spotPrices`, `solarProduction`, `solarSeries`. All queries use pagination for full-year datasets. Schema in `convex/schema.ts`, queries in `convex/prices.ts`, `convex/spot.ts`, `convex/solar.ts`, ingestion in `convex/ingest.ts`.

Solar data has strict separation: 60-min and 15-min resolutions are independent series, never combined. Always pass `resolutionMinutes` when querying.

### Data Seeding (`scripts/seed-convex.js`)
Imports FCR price CSVs and solar JSON files into Convex. Default solar file paths: `~/Downloads/solar_production_hourly_2026.json` (60m) and `~/Downloads/solar_production_15min_2026.json` (15m). Override with `SOLAR_PRODUCTION_HOURLY_JSON` and `SOLAR_PRODUCTION_15MIN_JSON` env vars.

## Build & Release

Electron Forge with Vite plugin (3 configs: main, preload, renderer). Makers: ZIP (macOS/Linux), Squirrel (Windows), DMG (macOS). Release triggered by version bump in `package.json` on `main` — CI builds for macOS (arm64), Windows (x64 + arm64), Linux (x64).

## Key Patterns

- All Convex data loading happens in the main process with pagination, then sent to renderer via IPC
- Frequency simulation uses seeded RNG for reproducible results
- Web Worker isolates simulation compute from UI thread
- UI uses a tabbed interface; FCR-N is active, aFRR/Nodes/Kombinert are planned tabs
