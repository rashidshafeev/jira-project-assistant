# Jira Project Assistant

An Atlassian Forge app that lists a Jira project's issues, highlights the ones that need attention (unassigned, or low-priority with an approaching deadline), and offers one-click and bulk fixes.

---

## Prerequisites

- **Node 22 + npm** — matches the Forge `nodejs22.x` runtime. This is **all you need** for
  the mock preview and the test suite: no Jira account, no `.env`, no credentials.
- **Docker** *(optional)* — only for the one-command preview below.
- **An Atlassian account** *(optional)* — only for the
  [Running against real Jira](#running-against-real-jira-forge) path. The Forge CLI ships as a
  root dev dependency (a plain `npm install` provides it — no global install needed).

This is a two-package repo: the **root** project holds the Forge backend + the Playwright
suite; **`frontend/`** is its own npm project (the Vite UI). The commands below say which one
they install into.

## Quick start

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

`dev:mock` loads the committed `frontend/.env.mock` (just `VITE_USE_MOCKS=true` plus mock
latency/failure knobs — no secrets), which swaps the Forge bridge for the in-memory mock. Docker
is a preview convenience, not a Forge runtime (Forge is serverless); see
[`architecture`](docs/architecture.md).

In the mock preview a top bar exposes **theme** (light/dark) and **language** (EN/RU)
toggles so you can exercise both without a Forge host. Try the 🔴/🟡 highlighted rows, the
**Fix** buttons, and the control panel's **Auto-assign unassigned**.

For the live app against a real site, see
[Running against real Jira](#running-against-real-jira-forge) below — it's optional; the mock
covers everything else.

---

## Architecture at a glance

The **backend** (`src/`) is a pure authenticated proxy: resolvers return Jira's *raw* REST v3
responses with no server-side business logic — they're an auditable allowlist of the operations
the UI may perform with the app's scopes (the lone exception is `src/prefs.ts`, which persists
per-user table layout to `storage:app`). The **frontend** (`frontend/`) is a Feature-Sliced
React app (Vite + TS strict + MUI + Zustand + TanStack Query) that owns the DTOs, the Jira→DTO
mappers, and the pure rules (problem detection, stats, auto-assign). Raw Jira shapes
(`src/types.ts`) and the resolver result envelope (`src/result.ts`) are types-only and shared by
both sides, so drift is a compile error. The **mock** (`mock/`) is dynamic-imported behind
`VITE_USE_MOCKS`, so it is dead-code-eliminated from production builds.

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
  Copy [`.env.example`](.env.example) → `.env` and fill in `FORGE_EMAIL` + `FORGE_API_TOKEN`
  ([create a token](https://id.atlassian.com/manage-profile/security/api-tokens)); the
  `JIRA_*` vars in `.env.example` enable the opt-in real-Jira test lane. Forge has no keychain
  here, so the `tunnel` / `deploy` / `test:jira` scripts **source `.env` for you**.

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

Optional — only for deploying/developing the live app; the mock above covers everything else.
Requires Atlassian credentials in `.env` and the app already registered (id in `manifest.yml`).
First-time setup, from the repo root:

```bash
npm install                  # root deps incl. the bundled Forge CLI (first time only)
cp .env.example .env         # then fill FORGE_EMAIL + FORGE_API_TOKEN

npm run deploy               # build frontend/dist + forge deploy (sources .env)

# One-time install onto your site + ad-hoc forge commands — source .env yourself first:
set -a; . ./.env; set +a
npx forge install --product jira --site <your-site>.atlassian.net --confirm-scopes   # first time only
npx forge lint                                                                       # validate manifest/code
```

The CLI is the bundled dev dependency, so raw commands use **`npx forge …`** (drop the `npx`
if you have a global `forge`); the `npm run *` scripts resolve it for you.

`forge deploy` publishes a *built copy* to Atlassian's cloud — the installed app runs whatever
you last deployed. `forge tunnel` instead points the installed app at the code on **your
machine** for the inner dev loop. For the tight UI loop, run two terminals (the dev server must
be up before the tunnel proxies to it):

```bash
npm run dev      # terminal 1 — Vite, real Forge bridge, pinned to :5173 (NOT dev:mock)
npm run tunnel   # terminal 2 — forge tunnel routes the installed app to your machine
```

Open the **Project Assistant** page from a Jira project's left sidebar; edits need a page
reload, not HMR. A few one-time gotchas (Chrome's Local Network Access prompt, redeploy once
after any `manifest.yml` change, `--strictPort`) are in
[`forge gotchas`](docs/forge-gotchas.md).

---

## Tests

```bash
npm install                      # root project: Playwright + tooling — first run only
npm --prefix frontend install    # the UI the suite drives — first run only
npm test                         # E2E vs the MOCK (alias: npm run e2e) — no Jira, no .env
npm run test:jira                # E2E vs REAL Jira (opt-in; sources .env, needs JIRA_APP_URL)
```

`npm test` is self-contained: it boots the mock UI itself and fetches the headless browser on
first run, then drives the real app in headless Chromium — no separate server, no Jira site or
account, fully deterministic. It covers the headline flows (list issues, Fix → assign, team,
bulk auto-assign) plus error handling via the mock's fault injection. `npm run test:jira` runs
the read-only `@jira` PoC against the live app inside the Forge iframe. See
[`docs/testing.md`](docs/testing.md).

