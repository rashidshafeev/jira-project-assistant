# Frontend

Vite + React (functional components) + TypeScript (strict) + MUI + Zustand,
organized with **Feature-Sliced Design (FSD)**.

## Stack

- **Vite** — build/dev. `base: './'` so built assets load with relative URLs inside
  the Forge Custom UI iframe; output goes to `frontend/dist`.
- **React + TypeScript** — strict mode on (see below).
- **MUI** (`@mui/material`, `@mui/icons-material`, `@emotion/*`) — UI components.
- **MUI X DataGrid** (`@mui/x-data-grid`, Community/MIT) — the Issues and Team tables.
  Bought us resizable columns (free in Community v7+) plus sorting/filtering/pagination,
  via a shared `shared/ui/AppDataGrid` wrapper that injects the i18n locale + common
  defaults. Styles via Emotion, so the existing `unsafe-inline` CSP allowance covers it.
- **Zustand** — client/UI state (selected project, active tab, dialogs).
- **TanStack Query** (`@tanstack/react-query`) — server state: loading/error per action,
  optimistic updates + rollback, and reload-after-action via cache invalidation.
- **react-i18next** (`i18next`, `react-i18next`) — UI internationalization, `en` + `ru`
  bundled (see [`theming-i18n.md`](./theming-i18n.md)).
- **`@forge/bridge`** — Custom UI ↔ Forge resolver communication, **dynamically imported**
  so the mock preview never loads it (see [Frontend gotchas](#frontend-gotchas) below).

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
`vite.config.ts` resolve.alias). Example: `import { Providers } from '@/app/providers'`.

## State management — two complementary tools

A deliberate split (no overlap):

- **TanStack Query = server state.** Everything fetched through the API layer (issues,
  members, projects). Chosen because the app's data requirements *are* its home
  turf: `isPending`/`isError` cover **loading/error per action**, `onMutate` + rollback
  cover **optimistic updates**, and `invalidateQueries` covers **reload-after-action**.
  `QueryClientProvider` lives in `app/providers`; query/mutation hooks live in the
  relevant `entities`/`features` `api` segments. It is transport-agnostic — `queryFn`
  just calls our API contract, so it works identically against the bridge or the mock.
- **Zustand = client/UI state.** Selected project, active tab, open modals, confirmation
  dialogs, selected rows. The selected project feeds TanStack Query keys.

## Routing

**No URL router.** The Forge Custom UI iframe URL is invisible and uncontrollable, so
URL routing buys nothing (no bookmarking/deep links/back button). `BrowserRouter` is also
unreliable in a sandboxed iframe. We use MUI `Tabs` + in-memory state (Issues / Team).
If views multiply, swap in `MemoryRouter` (routing in memory, never touches the URL).

## API layer + mock

Components depend only on a single typed API contract; the transport is swappable. The
transport seam is the four files below; beside them live `errors.ts` (the `ApiError` type +
`errorMessageKey` + the retry policy) and the per-resource DTO+mapper files (`issue.ts`,
`member.ts`, `project.ts`). The splits are **load-bearing**, not ceremony:

- `frontend/src/shared/api/contract.ts` — **types only**: the `JiraApi` interface (mirrors
  the resolver names: `getProjects`, `getIssues`, `assignIssue`, …) plus DTO re-exports.
  It's the **neutral seam two implementations conform to**, so it can't live inside either
  one. Both `bridgeClient: JiraApi` and `mockClient: JiraApi` are checked against it, which
  is what makes the mock a *guaranteed* drop-in — drift (a missing method, a wrong return
  type) is a compile error, not a runtime surprise.
- `frontend/src/shared/api/bridge-client.ts` — the **real** implementation: `invoke()` over
  the bridge, then `unwrap` + map raw Jira → DTO.
- `frontend/src/shared/api/transport.ts` — the **switch**: picks `bridgeClient` vs
  `mockClient` from `import.meta.env.VITE_USE_MOCKS`, once, at load (top-level `await`).
- `frontend/src/shared/api/index.ts` — a pure **barrel** (the switch lived here once; it
  was moved to `transport.ts` so the barrel stays logic-free).

**Why not collapse them.** Two hard constraints force the shape:

1. *`@forge/bridge` throws on import outside a Forge host.* `transport.ts` reaches the
   bridge client via a conditional **dynamic** `import('./bridge-client')`, so the bridge
   module (and `@forge/bridge`) only loads in non-mock mode — and the mock is
   dead-code-eliminated from prod. This works **only because `bridge-client.ts` is its own
   module.** Merge it into `transport.ts` (or merge all three) and `@forge/bridge` becomes a
   *static* top-level import that loads unconditionally → the mock preview throws on import,
   and the bridge code ships in every bundle. So **merging all three is not a style call —
   it breaks mock mode and defeats DCE.**
2. *No import cycle.* `bridge-client.ts` and `mock-client.ts` both import `JiraApi` from
   `contract.ts`; `transport.ts` imports the type from `contract.ts` *and* dynamically
   imports `bridge-client.ts`. Keep the interface in dependency-free `contract.ts` and the
   graph is a clean DAG (`contract ← {bridge-client, mock-client} ← transport`). Fold the
   interface into `transport.ts` and `bridge-client.ts` would import from `transport.ts`
   while `transport.ts` imports it back — a cycle, on a module that uses top-level `await`.

- **`/mock` (repo root, not under app `src`)** — dev-only, kept out of app code:
  - `fixtures.ts` — fake projects/members/issues, crafted to exercise highlighting
    (some unassigned 🔴, some low-priority-near-deadline 🟡).
  - `mock-db.ts` — in-memory engine: mutations (assign / bump priority / auto-assign)
    plus **simulated latency and optional error injection** so loading/error/optimistic
    paths are demoable.
  - `mock-client.ts` — implements the contract from `mock-db`.

Cross-root plumbing: `@mock` alias (Vite + tsconfig), `server.fs.allow: ['..']`, and a
**dynamic env-gated import** of the mock so it is dead-code-eliminated from production
builds (mock can never ship). The mock imports the contract as `import type` only — no
runtime coupling, but it won't compile if the contract drifts. Problem-detection/stats
logic stays out of the mock (it's domain logic in `entities`/`features` `lib`, run
identically on mock or real data).

### Implemented slices

All layers are built out (not a skeleton). Where things live:

- **`app`** — `providers/` (a token-mapped MUI theme synced to the host color mode + the
  TanStack Query client), `model/` (theme + session Zustand stores), `lib/` (`forge-bootstrap.ts`
  theme/locale bootstrap + `entry-context.ts`, which resolves the Forge module — by `moduleKey`
  + the context's issue — into a `page` | `panel` | `admin` view), `ui/` (`BootstrapGate`,
  mock-only `DevSettings`/`MockHost`), `App.tsx`.
- **`pages`** — `issues`, `team` (each composes the control panel + its table), `issue-panel`
  (the single-issue verdict in the `jira:issueContext` sidebar), `admin` (the app-wide config
  form, shown only on the admin-only `jira:adminPage`).
- **`widgets`** — `issues-table`, `team-table`, `control-panel`.
- **`features`** — `fix-issue` (assign / raise priority + optimistic mutations),
  `auto-assign` (the pure round-robin plan + confirm dialog), `table-prefs` (persisted grid
  layout via Forge storage), `app-config` (the app-wide at-risk window + grace: `useDeadlineWindow`
  read by the views, the admin-only `AppConfigForm` for the write).
- **`entities`** — `issue` (problem detection, stats), `member`, `project`.
- **`shared`** — `api/` (contract + transport + mappers), `ui/` (`AppDataGrid`,
  `StatusLozenge`, `PriorityIcon`), `i18n/` (en + ru), `config/atlassian-tokens.ts`.

## Frontend gotchas

MUI / DataGrid quirks specific to this frontend. (Forge **platform** constraints that surface
in the UI — CSP-blocked inline styles, iframe layout/height, the `@forge/bridge` import — are
in [`forge-gotchas.md`](./forge-gotchas.md).)

### MUI palette needs literal hex, not `var(--ds-*)`
MUI augments semantic palette colors (it computes hover/active shades and contrast text from
each base color), so it needs **real color values** and chokes on `var(--ds-surface)` strings.
We therefore feed the palette **mode-keyed literal hex** from `shared/config/atlassian-tokens.ts`
(the resolved values of the host's design tokens), not the live CSS vars. The host color
*mode* still drives it live — a `MutationObserver` on `data-color-mode` rebuilds the theme;
only the values are static. Full token detail in [`theming-i18n.md`](./theming-i18n.md).

### DataGrid phantom horizontal scrollbar
**Symptom:** the MUI X DataGrid shows a faint horizontal scrollbar even when columns fit.
**Cause:** the Community grid reserves a few px for a vertical scrollbar even when one isn't
shown, so `scrollWidth` exceeds `clientWidth` by ~the scrollbar size.
**Fix (in `shared/ui/AppDataGrid`):** the ordinary `summary` column is `flex: 1`, so it
absorbs the slack and real column widths always sum to **less** than the available width, plus
`overflowX: hidden` on `.MuiDataGrid-virtualScroller`. Because the real columns already fit,
`overflowX: hidden` clips only the empty scrollbar reservation — no actual cell content is
hidden.

### DataGrid cell ellipsis bites localized button labels (the "dots")
**Symptom:** a small mark to the right of each Fix button, **only on problematic rows** (the
only ones that render a button) and **only in Forge** — the mock looked clean. Not a DOM node
and not a `::after`; zooming in resolved the single mark into a trailing ellipsis `…`.
**Cause:** MUI X DataGrid puts `overflow:hidden; text-overflow:ellipsis; white-space:nowrap`
on **every cell**. The actions column had a fixed width sized for the English label, but the
button label is i18n'd and **locale changes its width** — en "Fix" fits, ru **"Исправить"** is
wider and overran the cell, so the grid clipped the button and painted a trailing `…`. The
mock only *looked* fine because it ran in English; Forge runs in Russian (locale from the Jira
context), exposing it.
**Fix (in `widgets/issues-table`):** **autosize** the actions column to its rendered button at
runtime instead of hardcoding a width — `usePersistedGrid('issues', { autosizeFields: ['actions'] })`
plus a `requestAnimationFrame(autosize)` effect that re-runs on `rows.length` / `i18n.language`
change, so the column hugs the label in any language (the fixed `width: 96` is only a
pre-autosize fallback). The autosized width is **excluded from the persisted grid state**, so
it re-measures per locale instead of restoring a stale width. We also drop the ellipsis on the
actions cell (`cellClassName` + `text-overflow: clip`) — a cell holding a control, never
truncatable text, should never ellipsize. General lesson: any fixed-width DataGrid column
holding translated text can overflow into a `…` in some locale; autosize it, or disable the
ellipsis where it's meaningless.
