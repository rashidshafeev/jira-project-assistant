# Extending the app — playbook

How to grow the app without the mock, types, and contract drifting apart. Two recurring
tasks: **adding a capability** (endpoint) and **hardening error handling**.

## Adding a capability (new endpoint / action)

The data flows one direction — raw Jira → DTO → UI — and the backend stays a thin proxy
(no mapping, no logic). Touch the files in this order:

| # | File | What you add |
|---|---|---|
| 1 | `src/types.ts` | Raw **Jira wire types** for any new fields (narrow — only what we read). If it's a new resolver, also add its name to the local `ResolverName` union in `src/index.ts`. |
| 2 | `src/endpoints/<name>.ts` (+ re-export in `endpoints/index.ts`) | One file = the endpoint's failure-mode spec (`<name>Spec`) **and** its proxy function — one `requestJira` call (via the `endpoints/client.ts` helpers) returning Jira's **raw** response. No mapping, no logic. Adding the spec keeps the failure-mode catalog complete. |
| 3 | `src/index.ts` | A thin resolver that reads its typed payload (an unchecked `as` cast today — a `zod` parse is the upgrade if payloads grow) and delegates to the proxy fn (writes re-read via `getIssue`). |
| 4 | `frontend/src/shared/api/{issue,member,project}.ts` | The **DTO** + its pure mapper (normalize nulls / localized fields here). Pick the resource file it belongs to. |
| 5 | `frontend/src/shared/api/contract.ts` | The method on `JiraApi`, expressed in the DTO. |
| 6 | `frontend/src/shared/api/bridge-client.ts` | The `invoke(name, payload)` call + `.then(map…)`. |
| 7 | `mock/{fixtures,mock-db,mock-client}.ts` | Mock data + behavior so the frontend works offline. |
| 8 | `e2e/` | Cover the new flow in the Playwright mock lane — extend a page object + add/grow a spec (and the `data` fixture if it needs a new known value). Keep any new rule a **pure function** in the owning `model/` so it stays trivially testable. |

> This 8-step recipe is for **Jira-proxy** resolvers. The other resolver class —
> **app-storage** (`getTablePrefs`/`setTablePrefs` in `src/prefs.ts`, behind the `storage:app`
> scope) — has no endpoint spec, DTO, or mapper: it just reads/writes an opaque blob keyed on
> the caller's `accountId`. Add those two directly in `src/prefs.ts` + `src/index.ts`.

Rules of thumb:
- **Raw wire types are defined once** in `src/types.ts` (shared across the bridge via
  the `@types` alias).
- **The DTO is defined once** beside its mapper on the frontend. If you're typing the same
  shape twice, stop — re-export instead.
- **If the new action has a decision/rule, make it a pure function** in the owning
  feature/entity `model/` — never on the server. Pure functions test instantly; the Forge
  sandbox doesn't.
- **A new Jira capability usually needs a scope.** If the endpoint touches a Jira permission
  not already granted, add/confirm it in `manifest.yml` (`permissions.scopes`) and re-run
  `forge install --upgrade` (scope changes don't auto-track).

## The error ratchet (keep this tight, not sprawling)

When you encounter a real error or data quirk (in dev, prod, or by reading the spec):

1. **Record it** — add the real `{ errorMessages, errors }` evidence to the matching
   endpoint spec's `observed` in `src/endpoints/` (promoting a best-effort row to
   ground-truth). For the error *matrix* you haven't tripped, the spec's documented codes
   plus the central `status → ErrorCode` mapping (`src/result.ts`) already cover it — it's
   the single place a status becomes a code, so the catalog and the mapping stay consistent.
2. **Normalize it** — at the mapping boundary (the resource mapper) for data quirks, or in
   the central `src/result.ts` for status→code.
3. **Cover it** — if the UI reacts to the error (e.g. a new code branch), add a `@mock-only`
   E2E case using the mock's fault injection (`?fault=` / `window.__mock`).
4. **Only touch the mock if the frontend reacts to it.** See the fidelity policy below.

### Mock fidelity policy — what the mock should and shouldn't know

The `/mock` engine is for **frontend dev + exercising UI states**, not for simulating Jira.

- ✅ Realistic data, latency, and *injectable* generic failure (already built in).
- ✅ A specific error **only when the UI behaves differently for it** (e.g. a "conflict →
  refresh" banner). Then the mock produces that error **in our normalized taxonomy**
  (`ApiError.code`), never as a raw Jira status — so the mock stays ignorant of Jira.
- ❌ Faithfully reproducing every Jira status code per endpoint. That knowledge lives in
  the `src/endpoints/` catalog + the central `src/result.ts` mapping, not in the dev mock.

## Error handling

The full end-to-end approach — the taxonomy, the bridge envelope, who knows what, what the
user sees vs. what we log — is documented in **[`errors.md`](./errors.md)**. The one rule
relevant when extending: **translate to an `ErrorCode` once on the backend
(`src/result.ts`); everyone downstream speaks the code, not the status.**
