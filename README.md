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

## Notes
- The packaged app no longer bundles `data/` CSV files.
- Convex queries are paginated in main process to support full-year datasets.
