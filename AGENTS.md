# AGENTS.md

## Scope
These instructions apply to the whole repository.

## Project Context
- Electron desktop app: **Hydropower**
- Core modules: **Årskalkyle**, **FCR-N**, **aFRR**, **Nodes**, **Forklaring**
- Data backend: **Convex** (all market data is fetched in main process via IPC)

## Implementation Rules
- Preserve existing financial logic and assumptions unless explicitly requested.
- Keep UI copy in Norwegian where UI text already uses Norwegian.
- Keep CSV/Excel exports month-by-month, human-readable, and aligned with on-screen calculations.
- Include year in export filenames where relevant.
- When adding/changing IPC:
  1. Update `src/shared/electron-api.d.ts`
  2. Update `src/preload.ts`
  3. Update `src/main.ts`

## Quality Gate
- Run `npm run lint` and `npm run typecheck` after changes.
- Avoid behavior changes when performing refactors/simplifications.
