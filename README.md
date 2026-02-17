# FCR Calculator (Electron + Convex)

Electron desktop app for FCR/spot battery revenue analysis.

## Architecture
- UI + simulation logic: Electron renderer (`src/renderer/`)
- Data backend: Convex (`convex/`)
- Seed/import pipeline: `scripts/seed-convex.js`

## Local Setup
1. Install dependencies:

```bash
npm install
```

2. Start Convex locally and seed data in one flow:

```bash
npm run convex:seed:local
```

3. Run Convex dev (keep this terminal open while using the app):

```bash
npm run convex:dev
```

4. Start Electron app in another terminal:

```bash
npm start
```

## Cloud Deployment (recommended)
To see your database in Convex cloud dashboard:

1. Authenticate with a full Convex account (`npx convex login`) or set a valid `CONVEX_DEPLOY_KEY`.
2. Configure cloud deployment:

```bash
npx convex dev --configure new --dev-deployment cloud
```

3. Seed cloud deployment:

```bash
npm run convex:seed
```

## Useful Commands
- `npm run convex:dev` - run Convex dev watcher
- `npm run convex:dev:local` - run local anonymous Convex deployment
- `npm run convex:seed` - parse CSV and upsert into Convex
- `npm run convex:deploy` - deploy Convex functions to prod
- `npm start` - run Electron app
- `npm run publish` - package + publish desktop artifacts (used by CI)

## Desktop Release + Auto Update
- Release workflow: `.github/workflows/release.yml`
- Trigger: push a Git tag like `v1.2.3`
- Guard: workflow validates `tag === v${package.json.version}`
- Build targets:
  - macOS (`.dmg` + `.zip`)
  - Windows (Squirrel packages for auto-update)
  - Linux (`.zip`)
- Publishing target: GitHub Releases via Electron Forge publisher

### Release steps
1. Update version in `package.json` (example: `npm version patch`).
2. Push commit and tag (`git push --follow-tags`).
3. GitHub Actions builds and publishes all platform artifacts to the release tag.

### Auto-update behavior
- App uses `update-electron-app` in `src/main.js` when packaged.
- Update source: GitHub releases through `update.electronjs.org`.
- Requirements:
  - Repository must be public for the default update service.
  - macOS app must be code-signed for production auto-updates.
  - macOS and Windows are supported by this updater path.
  - Linux auto-update is not provided by Electron's built-in updater flow.
- Runtime overrides:
  - `ELECTRON_DISABLE_AUTO_UPDATE=1` to disable checks.
  - `ELECTRON_AUTO_UPDATE_REPOSITORY=owner/repo` to force a repo slug.

## Solar Production Import
- The seed script imports solar production into `solarProduction` as separate time series by `resolutionMinutes`.
- `60` and `15` minute data are stored independently and must never be combined in one series.
- A compact `solarSeries` metadata table is maintained automatically for fast year/resolution lookups.
- Default lookup paths:
  - `~/Downloads/solar_production_hourly_2026.json` (60m)
  - `~/Downloads/solar_production_15min_2026.json` (15m)
- Override hourly file path with: `SOLAR_PRODUCTION_HOURLY_JSON=/path/to/hourly.json npm run convex:seed`
- Override quarter-hour file path with: `SOLAR_PRODUCTION_15MIN_JSON=/path/to/15min.json npm run convex:seed`
- Legacy fallback env var `SOLAR_PRODUCTION_JSON` is treated as hourly (`60m`).
- When querying solar data, always pass `resolutionMinutes` explicitly.

## Notes
- The packaged app no longer bundles `data/` CSV files.
- Convex queries are paginated in main process to support full-year datasets.
