# Jira Project Assistant

An Atlassian Forge app that surfaces **problematic Jira issues** and **auto-fixes** some of
them. It lists a project's issues, highlights the ones that need attention (unassigned, or
low-priority with an approaching deadline), and offers one-click and bulk fixes.

> Full brief: [`docs/assignment.md`](docs/assignment.md).

---

## Prerequisites

- **Node 22 + npm** — matches the Forge `nodejs22.x` runtime. This is **all you need** for
  the mock preview and the test suite: no Jira account, no `.env`, no credentials.
- **Docker** *(optional)* — only for the one-command preview below, or running Forge ops in
  a container.
- **An Atlassian account** *(optional)* — only for the
  [Running against real Jira](#running-against-real-jira-forge) path. The Forge CLI itself
  ships as a root dev dependency (a plain `npm install` provides it — no global install
  needed), so the account is the only extra. **It's entirely optional — the mock needs none of it.**

This is a two-package repo: the **root** project holds the Forge backend + the Playwright
suite; **`frontend/`** is its own npm project (the Vite UI). The commands below say which one
they install into.

## Quick start

Two lanes — pick one. The **mock** needs nothing but Node (no Jira account, no `.env`); **real
Jira** needs an Atlassian account and credentials in `.env`. To just try the app, the mock is enough.

### See it instantly — the mock (no Jira account needed)

The app ships with an in-memory **mock** (realistic fixtures + injectable latency/errors), so
you can run the whole UI with zero setup — no Jira site, no install, no credentials.

**With Docker (one command):**

```bash
docker compose up
# open http://localhost:5173
```

**Or with Node directly:**

```bash
npm --prefix frontend install
npm --prefix frontend run dev:mock
# open http://localhost:5173
```

No `.env` needed: `dev:mock` loads the committed `frontend/.env.mock` (just `VITE_USE_MOCKS=true`
plus mock latency/failure knobs — no secrets), which swaps the Forge bridge for the in-memory mock.

In the mock preview a top bar exposes **theme** (light/dark) and **language** (EN/RU)
toggles so you can exercise both without a Forge host. Try the 🔴/🟡 highlighted rows, the
**Fix** buttons, and the control panel's **Auto-assign unassigned**.

### Against real Jira (Forge)

> Only for deploying/developing the live app — **optional; the mock covers everything else.**
> Needs an Atlassian account; the *why* behind each step is in
> [Running against real Jira](#running-against-real-jira-forge) below.

First-time setup (run from the repo root):

```bash
npm install                  # root deps incl. the bundled Forge CLI (first time only)
cp .env.example .env         # then fill FORGE_EMAIL + FORGE_API_TOKEN — see the var table below

npm run deploy               # build frontend/dist + forge deploy (sources .env for you)

# Install the deployed app onto your site (one time). Raw forge needs .env loaded first:
set -a; . ./.env; set +a
npx forge install --product jira --site <your-site>.atlassian.net --confirm-scopes
```

Then the live-dev loop — **two terminals** (the dev server must be up before the tunnel
proxies to it):

```bash
npm run dev      # terminal 1 — Vite, real Forge bridge, pinned to :5173
npm run tunnel   # terminal 2 — forge tunnel routes the installed app to your machine
```

Open the **Project Assistant** page from a Jira project's left sidebar; edit → reload the
page to see changes. First run only: allow Chrome's Local Network Access prompt, and
re-run `npm run deploy` after any `manifest.yml` change (details in
[Live frontend dev](#live-frontend-dev-against-real-jira-no-docker)).

---

## What it does — mapped to the brief

| Brief | Where |
|---|---|
| **Issue list** — Key / Summary / Status / Assignee / Priority / Actions | `widgets/issues-table` |
| **Highlight** 🔴 unassigned · 🟡 low priority + approaching deadline | `entities/issue/model/problem.ts` (pure) |
| **Fix actions** — unassigned → pick a member · low-priority → raise to Medium/High | `features/fix-issue` |
| **Control panel** — project stats, project picker, bulk **Auto-assign** (+ confirm dialog) | `widgets/control-panel`, `features/auto-assign` |
| **Team tab** — members, assigned-issue counts, activity (in-progress) | `pages/team`, `widgets/team-table` |
| Typed API requests/responses | single-source wire types `src/types.ts` + `src/result.ts` |
| Loading / error states per action | TanStack Query + typed `ApiError` taxonomy |
| Optimistic UI | `features/fix-issue/api/useFixMutations.ts` |
| Confirmation dialog for bulk actions | `features/auto-assign/ui/AutoAssignButton.tsx` |

---

## Architecture at a glance

- **Backend** (`src/`) — a **pure authenticated proxy**: `index.ts` (resolvers) →
  `endpoints/` (one file per Jira REST v3 endpoint = its failure-mode spec + its proxy
  fn, one `requestJira` call each) → `result.ts` (the result envelope + Jira status → normalized error code). Resolvers return Jira's *raw* responses; the frontend
  maps them. There's **no server-side business logic** — the named resolvers are simply
  the auditable allowlist of operations the UI may perform with the app's scopes.
- **Frontend** (`frontend/`) — Vite + React (TS strict) + MUI + **Zustand** (UI state) +
  **TanStack Query** (server state). **Feature-Sliced Design**
  (`app / pages / widgets / features / entities / shared`). Owns the **DTOs + Jira→DTO
  mappers** (colocated per resource in `shared/api/{issue,member,project}.ts`) and the
  pure rules — problem detection, stats, and the auto-assign round-robin
  (`features/auto-assign/model/plan.ts`) — all kept pure and off the Forge runtime
  (exercised end-to-end by the Playwright mock lane).
- **Shared wire types** (`src/types.ts` = raw Jira shapes; `src/result.ts` = the resolver
  result/error envelope) — **types-only**, imported by both sides via the `@types` /
  `@result` aliases. Drift is a compile error; they erase at runtime.
- **Mock** (`mock/`) — dev-only fixtures + in-memory engine; dynamic-imported behind
  `VITE_USE_MOCKS`, so it is dead-code-eliminated from production builds.
- **Per-user prefs** (`src/prefs.ts`, `storage:app`) — the only non-proxy resolvers: they
  persist each user's table layout (sort / filter / columns) as an opaque blob keyed on
  `accountId` (`features/table-prefs`). Still no domain logic — just storage.
- **Theme + i18n** — MUI palette synced to the Jira host theme (Atlassian design tokens);
  EN/RU from the Forge user locale.

Deeper docs: [`architecture`](docs/architecture.md) ·
[`frontend`](docs/frontend.md) · [`testing`](docs/testing.md) ·
[`theming & i18n`](docs/theming-i18n.md) ·
[`extending`](docs/extending.md) · [`forge gotchas`](docs/forge-gotchas.md).
API/backend deep-dive in [`docs/api/`](docs/api):
[`request flow` (component → Jira → back)](docs/api/request-flow.md) ·
[`endpoints` (Jira calls + failure modes)](docs/api/endpoints.md) ·
[`errors` (end-to-end)](docs/api/errors.md).

---

## Environment & commands

**Two env files, different jobs** — this is why the mock path needs zero setup:

- **`frontend/.env.mock`** — *committed, no secrets.* Just `VITE_USE_MOCKS=true` + mock
  latency/fault knobs; loaded by Vite for `dev:mock` and by the test `webServer`. The mock
  preview and `npm test` work straight from a clean checkout.
- **`.env`** (root) — *gitignored secrets*, for the Forge CLI and the real-Jira test lane.
  Copy [`.env.example`](.env.example) → `.env` and fill it in. Forge has no keychain here, so
  the `tunnel` / `deploy` / `test:jira` scripts **source `.env` for you**; for a raw `forge`
  command of your own, load it first: `set -a; . ./.env; set +a`.

| Var | Needed for | Notes |
|---|---|---|
| `FORGE_EMAIL`, `FORGE_API_TOKEN` | `deploy`, `tunnel`, raw `forge *` | [create a token](https://id.atlassian.com/manage-profile/security/api-tokens) |
| `JIRA_APP_URL` | `test:jira` | the Project Assistant *page* URL; **its presence enables** the opt-in jira lane |
| `JIRA_LOGIN`, `JIRA_PASSWORD` | `test:jira` first login | a **dedicated test account**; a reused session makes these rarely needed |
| `JIRA_OTP_FILE` | `test:jira`, 2-step accounts | enables the interactive 6-char code hand-off |
| `JIRA_STORAGE`, `JIRA_APP_FRAME` | optional | session path / iframe selector — sane defaults in code |

**Root scripts** (run from the repo root):

| Command | What it does |
|---|---|
| `npm run dev:mock` | mock UI at :5173 (no env) — the standalone preview |
| `npm test` | Playwright E2E vs the **mock** (alias `npm run e2e`) — deterministic, no Jira, no `.env` |
| `npm run test:jira` | Playwright E2E vs **real Jira** (sources `.env`; needs `JIRA_APP_URL`) |
| `npm run dev` | Vite with the **real** Forge bridge — for the tunnel loop, not standalone |
| `npm run tunnel` | `forge tunnel` (sources `.env`) — routes the installed app to your machine |
| `npm run build` | build the Custom UI into `frontend/dist` |
| `npm run deploy` | `build` **then** `forge deploy` (sources `.env`) — so you can't ship a stale `dist` |
| `npm run typecheck` | `tsc --noEmit` on the backend |

---

## Running against real Jira (Forge)

> Requires Atlassian credentials in `.env` and the app already registered (id in
> `manifest.yml`). **This whole section is optional — use the mock above instead.**

Set up credentials once (see [Environment & commands](#environment--commands) for the vars);
the `deploy` / `tunnel` scripts then source `.env` for you:

```bash
npm install                  # root deps incl. the bundled Forge CLI (first time)
cp .env.example .env         # then fill FORGE_EMAIL + FORGE_API_TOKEN

npm run deploy               # build frontend/dist + forge deploy (sources .env)
npm run tunnel               # live dev against the installed app (sources .env)

# One-time install onto your site + ad-hoc forge commands — source .env yourself first:
set -a; . ./.env; set +a
npx forge install --product jira --site <your-site>.atlassian.net --confirm-scopes   # first time only
npx forge lint                                                                       # validate manifest/code
```

> The CLI is the bundled dev dependency, so raw commands use **`npx forge …`** (drop the
> `npx` if you have a global `forge`); the `npm run *` scripts resolve it for you.

**`deploy` vs `tunnel`** — two different loops:

- **`forge deploy`** uploads a *built copy* of the app to Atlassian's cloud. That's how you
  **publish** a version; the installed app runs whatever you last deployed.
- **`forge tunnel`** points the installed app at the code on **your machine** instead, so
  edits show up live inside Jira with no redeploy — the **inner dev loop**. Stop the tunnel
  and the installed app falls back to the last deploy.

Use `tunnel` while developing, `deploy` to publish. Shortcut: **`npm run deploy`** runs the
frontend build *then* `forge deploy` (in the `.env`-sourced shell), so you can't ship a
stale `dist`.

The app is a `jira:projectPage` module — open it from a Jira project's left sidebar
("Project Assistant").

### Live frontend dev against real Jira (no Docker)

For the tight inner loop — edit the UI, see it inside Jira without rebuilding — pair the
**Vite dev server** with the tunnel. The manifest's `main` resource has a `tunnel.port`, so
`forge tunnel` proxies the Custom UI iframe to your local dev server instead of the static
`dist`. Two terminals on the host (no Docker, no build step):

```bash
# terminal 1 — Vite dev server, pinned to :5173, using the REAL Forge bridge
npm run dev            # NOT dev:mock — that's the in-memory fake

# terminal 2 — tunnel: routes the installed app to your machine (sources .env)
npm run tunnel
```

Open the **Project Assistant** page in Jira (logged in). Edits recompile instantly; the
backend resolver is tunnelled live too.

**Two one-time prerequisites** (both bit me — the iframe loads blank/broken until they're done):

1. **Deploy the manifest once after `tunnel.port` was added.** `forge tunnel` proxies to
   `:5173` only if the *deployed* manifest carries `tunnel.port` — the tunnel reads the
   installed manifest, it does **not** apply local manifest edits on its own. `forge lint`
   passing is **not** enough; run `forge deploy` (or **`npm run deploy`**) once after any
   `manifest.yml` change, then tunnel.
2. **Allow Chrome's Local Network Access prompt.** Chrome 142+ blocks a public origin
   (`*.atlassian.net`) from loading a `localhost` iframe unless you allow the LNA permission
   prompt that pops up on first load (looks like a site-notifications ask). If you dismissed
   it, re-allow via the page's site settings, or set
   `chrome://flags/#local-network-access-check` to **Disabled**. Tunnelling Custom UI is
   **Chrome/Firefox only**.

Then, day to day:

- **Refresh, don't expect hot-reload.** Vite's HMR websocket is blocked by the Custom UI
  iframe CSP, so save → **reload the Jira page** to see changes (still far better than
  rebuilding `dist`).
- **The dev server must be up first** — with `tunnel.port` set, `forge tunnel` always proxies
  to `:5173`; if nothing's there the iframe loads blank. `--strictPort` makes the dev server
  fail loudly rather than drift to another port.
- `dev` uses the real bridge, so it only works *through the tunnel inside Jira* — opening
  `localhost:5173` directly will error (no Forge host). Use `dev:mock` for the standalone
  preview.

### Docker (preview only)

```bash
docker compose up        # mock UI at http://localhost:5173 — no Jira, no .env
```

That's the whole Docker story: the zero-setup mock preview. Forge ops (`deploy` / `lint` /
`install`) and the live-dev tunnel are **host** workflows — `npm run deploy`, and `npm run
dev` + `npm run tunnel` above — not compose services (a tunnel is one-per-app/env and finicky
to wrap; the Forge CLI runs fine on the host). Why Docker is a preview convenience and not a
runtime (Forge is serverless) is in the `docker-compose.yml` comments and
[`architecture`](docs/architecture.md).

---

## Tests

```bash
npm install                      # root project: Playwright + tooling — first run only
npm --prefix frontend install    # the UI the suite drives — first run only
npm test                         # E2E vs the MOCK (alias: npm run e2e) — no Jira, no .env
npm run test:jira                # E2E vs REAL Jira (opt-in; sources .env, needs JIRA_APP_URL)
```

Once both installs are done, `npm test` is self-contained: Playwright **boots the mock UI itself** (the
`webServer` in `playwright.config.ts` runs `dev:mock` with `VITE_USE_MOCKS=true`, reusing an
already-running dev server if you have one, then tearing it down) and **fetches the headless
browser on first run** (the `pretest` hook) — no separate server to start, no manual
`playwright install`, no Jira site or account. It drives the real app in headless Chromium
and is fully deterministic. It covers the headline flows (list issues, Fix → assign, team,
bulk auto-assign) plus error handling via the mock's deterministic fault injection. The specs
are authored **dual-target** — shared flows in `e2e/tests/<flow>/` (each = a `*.spec.ts` +
per-target `*.data.ts` + `*.assertions.ts`, error cases as `*.errors.spec.ts`) over a
frame-aware foundation in `e2e/testing/`. `npm run test:jira` runs the read-only `@jira` PoC
against the live app inside the Forge iframe today; turning the full `@smoke` suite green on
real Jira (stable test-ids + REST seed) is the documented next step. See
[`docs/testing.md`](docs/testing.md).

---

## Requirements covered

TypeScript · React (functional) · MUI · Atlassian Forge · Jira REST v3 · Docker
(Dockerfile + docker-compose) · a state manager (Zustand + TanStack Query) · typed
requests/responses · loading & error handling · optimistic updates · bulk-action
confirmation · usage docs.
