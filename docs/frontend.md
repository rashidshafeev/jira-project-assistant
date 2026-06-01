# Frontend

Vite + React (functional components) + TypeScript (strict) + MUI + Zustand,
organized with **Feature-Sliced Design (FSD)**.

## Stack

- **Vite** — build/dev. `base: './'` so built assets load with relative URLs inside
  the Forge Custom UI iframe; output goes to `frontend/dist`.
- **React + TypeScript** — strict mode on (see below).
- **MUI** (`@mui/material`, `@mui/icons-material`, `@emotion/*`) — UI components.
- **Zustand** — state management.
- **`@forge/bridge`** — Custom UI ↔ Forge resolver communication (used as features land).

## Strict TypeScript

Enabled in `tsconfig.app.json`:

- `strict: true`
- `noUncheckedIndexedAccess` — indexed access yields `T | undefined`
- `noImplicitOverride`
- `exactOptionalPropertyTypes`
- plus the template's `noUnusedLocals` / `noUnusedParameters` / `noFallthroughCasesInSwitch`

## Feature-Sliced Design

Layers, highest to lowest. A layer may only import from layers **below** it.

| Layer       | Purpose                                                            |
|-------------|--------------------------------------------------------------------|
| `app`       | App-wide setup: providers (theme), root composition, session store |
| `pages`     | Route/screen compositions (e.g. Issues page, Team page)            |
| `widgets`   | Composite UI blocks (issue table, control panel, team list)        |
| `features`  | User interactions / use-cases (assign issue, bump priority, auto-assign) |
| `entities`  | Business entities (issue, member, project) + their UI/model/api    |
| `shared`    | Reusable infra with no business logic (ui kit, api client, lib, config) |

Each slice is split into **segments**: `ui`, `model` (state/logic), `api`, `lib`,
`config`. Slices expose a public API via an `index.ts` barrel; import across slices
through that barrel, not deep paths.

### Imports

Absolute imports via the `@` alias → `src` (configured in `tsconfig.app.json` paths and
`vite.config.ts` resolve.alias). Example: `import { withTheme } from '@/app/providers'`.

### Current state

Skeleton scaffolded; empty layers hold `.gitkeep`. Implemented so far:

- `app/providers/with-theme.tsx` — MUI `ThemeProvider` + `CssBaseline`
- `app/model/session.store.ts` — selected-project session state (Zustand)
- `app/App.tsx` — root composition (placeholder stack-check UI)
