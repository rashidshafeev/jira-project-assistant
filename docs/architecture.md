# Architecture Considerations

This document captures the key architectural decisions for the Jira Project Assistant.

## Platform: standard Forge (Custom UI + resolvers)

Atlassian Forge is **serverless** — in the standard model nothing is self-hosted:

- **Frontend** (Custom UI): static React assets served from Atlassian's CDN, running
  inside a sandboxed iframe in the Jira product.
- **Backend** (resolvers): run on Atlassian's own FaaS. You write JS/TS and `forge deploy`
  — there is no container to host.

We use exactly this: Custom UI frontend + Forge resolvers, all Atlassian-hosted. Docker is
**not** part of the runtime — it's just a one-command mock **preview** (`docker compose up`);
building and `forge deploy` are host workflows. That rationale lives beside the file it
concerns, in the `docker-compose.yml` comments.

### Forge Remote — considered, not used

Forge Remote keeps the Custom UI frontend but runs the backend in **your own Dockerized
service** that Forge invokes over HTTPS — the one model where Docker is the actual runtime
rather than just tooling. We rejected it: it needs a publicly reachable HTTPS endpoint,
hosting, and roughly double the moving parts, all for a backend that does nothing but proxy
Jira. (It's also why the earlier `JiraClient` seam was removed — see below.)

## Backend shape: a thin authenticated proxy

> **History.** An earlier iteration wrapped every Jira call behind a `JiraClient`
> interface so a future **Forge Remote** backend (fetch + bearer token) could be swapped
> in without a rewrite. We **removed that seam as YAGNI.** It was a speculative
> abstraction anticipating a Forge Remote backend migration we don't need, and it
> added a service/client/adapter layering that obscured how little the backend actually
> does. The lesson kept: build the abstraction when the second implementation is real,
> not before.

What's left is the smallest backend the platform allows. A Custom UI iframe **can't call
Jira REST directly** (auth + CSP), so a server-side resolver running with `asUser()` is
the *only* reason `src/` exists. That single fact drives the whole shape:

- **`src/endpoints/` — a thin authenticated proxy, one file per endpoint.** Each file
  holds both its failure-mode spec *and* its proxy function (one `requestJira` call,
  sharing the helpers in `endpoints/client.ts`), returning Jira's **raw** response — so
  the docs and the logic for an endpoint live side by side. There is no business logic on
  the server. The named functions *are* the value: they're the explicit, auditable
  **allowlist** of operations the UI may perform with the app's Jira scopes (vs. a single
  generic `invoke(method, path)` proxy, which would let a compromised frontend hit *any*
  endpoint the scopes allow).
- **`src/index.ts` — the bridge surface.** Each resolver validates its payload, calls the
  proxy, and returns a typed `ResolverResult` envelope (success data or a normalized
  error code). Reads return raw Jira; writes re-read the issue so the frontend gets fresh
  state.
- **`src/types.ts` + `src/result.ts` — the wire vocabulary.** `types.ts` holds the raw
  Jira shapes that cross the bridge; `result.ts` holds the resolver result envelope +
  normalized error taxonomy. Both are types-only, shared by the backend and (via the
  `@types` / `@result` aliases) the frontend, so drift is a compile error.
- **Mapping lives on the frontend, not the server.** A mapper (raw Jira → UI DTO) is a
  pure function. The Forge FaaS sandbox is a hostile place for logic — slow deploys, you
  must mock `@forge/api` to test it, no fast iteration — so the mapping lives where the
  dev-experience is and beside the DTOs that define it (`frontend/src/shared/api/{issue,
  member,project}.ts`). This is justified by **testability**, not by any transport-swap
  story.
- **Auto-assign is a frontend plan, not a server endpoint.** The round-robin (which member
  takes which unassigned issue) is *pure logic* — it has no Forge dependency, so it's a
  plain pure function (`features/auto-assign/model/plan.ts`) applied via the same
  per-issue `assignIssue` the single Fix action uses. The only thing a server endpoint
  would have bought is batching N writes into one bridge round-trip — but the bridge hop
  isn't a Jira API call and doesn't count against rate limits, and the writes run with
  `Promise.allSettled`, so it's one round-trip's *wall-time* regardless. At this scale
  that batching is a speculative optimization; if it's ever needed, a dumb
  `applyAssignments(pairs)` write-batching endpoint can be added **without moving the
  logic** — the pure planner stays put.

- **Per-user prefs are the one stateful resolver pair.** `src/prefs.ts`
  (`getTablePrefs`/`setTablePrefs`, behind the `storage:app` scope) persists each user's table
  layout as an **opaque blob keyed on `accountId`** — read/write only, no Jira call and no
  domain logic. It's the lone exception to "the backend only proxies Jira", and it keeps the
  same discipline: the server never interprets the blob.

**Net:** the backend is a pure proxy whose resolvers are the operation allowlist (plus the one
opaque-storage pair for prefs); the only real logic (mapping, the auto-assign plan) is pure
and lives on the frontend, where it's trivially testable and exercised end-to-end by the
Playwright mock lane (see [`testing.md`](./testing.md)).

For the step-by-step path of a single call through every layer — frontend component →
bridge → resolver → `requestJira` → Jira and back, and why `src/index.ts` is about as
small as it can be — see [`request-flow.md`](./api/request-flow.md).

## Tech stack

- TypeScript (strict)
- React (functional components) + Material-UI (MUI) + MUI X DataGrid — Custom UI frontend
- **Zustand** (client/UI state) + **TanStack Query** (server state) — the deliberate
  two-tool split (see [`frontend.md`](./frontend.md))
- **react-i18next** (`en` + `ru`) — UI internationalization
- Atlassian Forge (Custom UI + resolvers)
- Jira REST API v3
- Docker (Dockerfile + docker-compose) for a one-command mock preview
