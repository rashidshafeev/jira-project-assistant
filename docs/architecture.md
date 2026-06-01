# Architecture Considerations

This document captures the key architectural decisions for the Jira Project Assistant,
in particular how the mandatory **Forge** and **Docker** requirements fit together.

## Forge vs. Docker — the core tension

Atlassian Forge is a **serverless** platform. In the standard model nothing is
self-hosted:

- **Frontend** (Custom UI): static React assets served from Atlassian's CDN, running
  inside a sandboxed iframe in the Jira product.
- **Backend** (Forge functions / resolvers): run on Atlassian's own FaaS (AWS Lambda
  under the hood). You write JS/TS and `forge deploy` — there is no container to host.

So "Forge mandatory" and "Docker mandatory" are in mild tension: a pure Forge app has
nowhere to run a Docker container. There are three ways to reconcile them.

### Option 1 — Docker wraps the dev/build toolchain (chosen)

Ship a `Dockerfile` + `docker-compose.yml` that bundle Node + the Forge CLI +
credentials, so the app can be built, tunnelled, and deployed reproducibly from a
container. The Forge app itself stays 100% canonical (Custom UI React+MUI frontend +
Forge resolvers backend, all Atlassian-hosted).

- `forge tunnel` already *requires* Docker locally (it runs backend functions in a
  container for live development), so this is a natural fit.
- Simplest, most defensible, satisfies both requirements without distorting the
  architecture.

### Option 2 — Forge Remote

A Forge Custom UI frontend, but the backend logic runs in **your own Dockerized
service** that Forge invokes over HTTPS via Forge Remote. This is the only model where
Docker is the actual runtime rather than just tooling.

- Trade-off: needs a publicly reachable HTTPS endpoint Atlassian can call, plus hosting
  and roughly double the moving parts. Advanced feature; heavy for a test assignment.

### Option 3 — Hybrid

Forge frontend + Forge functions, plus a separate Dockerized helper/proxy for some
logic. Usually the worst of both worlds; not pursued.

## Decision

**Option 1: standard Forge + Docker toolchain, architected with Remote-ready seams.**

This is the fastest path to a working, reviewable app that ticks both Forge and Docker,
while keeping the door open to Forge Remote.

## Remote-ready seams

We can migrate to Forge Remote later *without a rewrite* if we decouple from day one:

- **Jira business logic** — plain, framework-agnostic TypeScript modules: fetch issues,
  detect unassigned / low-priority-near-deadline issues, assign a user, bump priority,
  compute project stats. These take inputs and return outputs; they know nothing about
  Forge.
- **Glue layer** — thin. Today it is a Forge resolver; under Remote it becomes an HTTP
  handler in the container. Only this layer changes.
- **`JiraClient` interface** — the one genuine difference between the two models is how
  you authenticate to Jira:
  - Standard Forge: `@forge/api` with `asApp()` / `asUser()` — auth is automatic from
    the app's scopes.
  - Forge Remote: the container authenticates with a token passed in the invocation
    context (fetch + bearer token).

  Putting every Jira call behind a small `JiraClient` interface means the Forge
  implementation uses `@forge/api`, and a future Remote implementation uses fetch +
  token. Swapping that one adapter plus the manifest is the entire migration.

**Summary:** designing *for* Remote upfront only pays off if we commit to it (and accept
the public-endpoint + hosting burden). Building standard Forge now with the `JiraClient`
seam keeps the Remote migration a contained, afternoon-sized change rather than a redo.

## Tech stack

- TypeScript
- React (functional components) + Material-UI (MUI) — Custom UI frontend
- Atlassian Forge (Custom UI + resolvers)
- Jira REST API V3
- State manager: TBD (Zustand / Redux Toolkit) — chosen at frontend scaffold time
- Docker (Dockerfile + docker-compose) for a reproducible build/tunnel/deploy toolchain
