# Hydropower (Electron + Convex)

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
  - Windows (`x64` and `arm64` Squirrel packages for auto-update)
  - Linux (`.zip`)
- Publishing targets:
  - S3-compatible storage (MEGA S4 bucket)
  - GitHub Releases (same version tag)
- S4 cleanup behavior:
  - After a successful release, workflow prunes old files under `updates/`.
  - It keeps only current-version artifacts plus update manifests (`RELEASES`, `RELEASES.json`).
- Note: GitHub Releases includes auto-generated source-code archives in addition to uploaded binaries.

### Required GitHub secrets
- `S4_ACCESS_KEY_ID`
- `S4_SECRET_KEY`
- `S4_ENDPOINT` (example: `https://s3.eu-central-1.s4.mega.io`)
- `S4_BUCKET` (example: `app`)
- `S4_REGION` (example: `eu-central-1`)
- `S4_UPDATES_PREFIX` (example: `updates`)
- `CONVEX_URL` (production Convex URL used by packaged desktop app runtime)
- Optional: `S4_PUBLIC_UPDATES_BASE_URL` (public HTTPS base URL for S4 links/metadata; in-app auto-update now uses GitHub Releases).
- `MACOS_SIGNING_CERT_P12` (base64-encoded `.p12` containing **Developer ID Application** certificate + private key)
- `MACOS_SIGNING_CERT_PASSWORD` (password used when exporting the `.p12`)
- `MACOS_CODESIGN_IDENTITY` (example: `Developer ID Application: DrivstoffAppen AS (3AC7D55KP8)`)
- Optional: `S4_OMIT_ACL=1` if your endpoint rejects ACL operations.
- Optional: `S4_ENABLE_WINDOWS_REMOTE_RELEASES=1` after first Windows release exists remotely (enables delta package sync).
- Optional: `MACOS_APP_BUNDLE_ID` (default: `no.hydropower.desktop`)
- Optional notarization with Apple ID:
  - `APPLE_ID`
  - `APPLE_APP_SPECIFIC_PASSWORD`
  - `APPLE_TEAM_ID`
- Optional notarization with App Store Connect API key:
  - `APPLE_API_KEY_P8` (contents of `AuthKey_*.p8`)
  - `APPLE_API_KEY_ID`
  - `APPLE_API_ISSUER`
- Optional notarization with keychain profile:
  - `APPLE_NOTARY_KEYCHAIN_PROFILE`
- No extra secret is required for GitHub uploads; workflow uses built-in `GITHUB_TOKEN`.

### Release steps
1. Update version in `package.json` (example: `npm version patch`).
2. Push commit and tag (`git push --follow-tags`).
3. GitHub Actions builds and publishes all platform artifacts to S4.

### macOS release verification
After a macOS build, verify the artifact before sharing:

```bash
codesign --verify --deep --strict --verbose=2 "/path/to/Hydropower.app"
spctl -a -vv "/path/to/Hydropower.app"
xcrun stapler validate "/path/to/Hydropower.app"
```

### Auto-update behavior
- App uses `update-electron-app` in `src/main.js` when packaged.
- Update source: GitHub public releases via `update.electronjs.org` (`UpdateSourceType.ElectronPublicUpdateService`).
- Manual checks are available from menu bar: `Help -> Check for updates...`
- Requirements:
  - Repository must be public (`HydropowerNorge/Hydropower-FCR-Calculator` by default).
  - New versions must be published as GitHub Releases with the expected Electron artifacts.
  - macOS app must be code-signed for production auto-updates.
  - macOS and Windows are supported by this updater path.
  - Linux auto-update is not provided by Electron's built-in updater flow.
- Runtime overrides:
  - `ELECTRON_DISABLE_AUTO_UPDATE=1` to disable checks.
  - `ELECTRON_AUTO_UPDATE_REPO=owner/repo` to override repository.
  - `ELECTRON_AUTO_UPDATE_HOST=https://update.electronjs.org` to override update service host.

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
