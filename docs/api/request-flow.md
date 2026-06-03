# Request flow — frontend component → real Jira call → back

How one user action travels the whole stack. The example is **clicking "Assign" in
the Fix dialog** (a write, so it also shows read-after-write); reads are the same path
minus the optimistic patch.

Two boundaries dominate the whole story, and they're different in kind:

- **The bridge** (`@forge/bridge` `invoke`) — RPC *by resolver name*, in-browser
  `postMessage` from the Custom-UI iframe to the Forge host. **Not HTTP, not a URL.**
- **The real network call** (`@forge/api` `requestJira`) — the actual HTTPS request to
  Jira REST v3, made **server-side inside Atlassian's FaaS**. The frontend never makes
  this call and never holds Jira credentials.

That second fact is the entire reason `src/` exists: a Custom-UI iframe can't call Jira
REST directly (auth + CSP), so a resolver running with `asUser()` is the only proxy. See
[`architecture.md`](../architecture.md).

## ▼ Request going down

| # | Where | What happens |
|---|---|---|
| 1 | `features/fix-issue/ui/FixIssueDialog.tsx` | User confirms; fires the mutation from `useAssignIssue`. |
| 2 | `features/fix-issue/api/useFixMutations.ts` | `mutationFn` runs `api.assignIssue(issue.id, member.accountId)`. `onMutate` **optimistically** patches the cached issue *before* the call resolves. |
| 3 | `shared/api/transport.ts` | `api` was resolved **once at load** to `bridgeClient` (prod) or `mockClient` (`VITE_USE_MOCKS`). In mock mode the path stops here — the mock answers locally, no bridge, no Jira. |
| 4 | `shared/api/bridge-client.ts` | `assignIssue` calls `invoke('assignIssue', { issueId, accountId })`. |
| 5 | `@forge/bridge` `invoke` | **Bridge boundary.** `postMessage` out of the iframe to the Forge host — RPC by resolver *name*, not a URL. |
| 6 | Atlassian Forge platform | Authenticates app + user, dispatches to the FaaS function `index.handler` (wired in `manifest.yml`: `jira:projectPage → resolver.function`, `function[resolver].handler = index.handler`). |
| 7 | `@forge/resolver` (`src/index.ts`) | Matches the name `'assignIssue'` to the registered handler. |
| 8 | `define()` wrapper (`src/index.ts`) | `try` → cast the `unknown` payload, call the handler body. |
| 9 | handler body (`src/index.ts`) | `await assignIssue(issueId, accountId)` then `return getIssue(issueId)` (read-after-write). |
| 10 | `src/endpoints/assign-issue.ts` | `asUser().requestJira(route\`/rest/api/3/issue/${id}/assignee\`, { PUT, body:{accountId} })`. |
| 11 | `@forge/api` `requestJira` | **Real network boundary.** The actual HTTPS call to Jira REST v3 — from Atlassian's egress, signed with the app's OAuth scopes, attributed to the current user via `asUser()`. |
| 12 | Jira | Performs the assignment, returns **204 No Content**. |

## ▲ Response coming back up

| # | Where | What happens |
|---|---|---|
| 13 | `src/endpoints/client.ts` | `assertOk` sees 204 → ok, no throw. (Non-2xx → `throw new JiraHttpError`.) |
| 14 | handler (`src/index.ts`) | Calls `getIssue(id)` → another `requestJira` GET → returns the **raw** `JiraIssue`. |
| 15 | `define()` wrapper (`src/index.ts`) | Wraps it: `{ ok:true, data: rawIssue }`. On any throw → `{ ok:false, error: toApiErrorPayload(e) }` — **the status→code flip**, the one place HTTP becomes an `ErrorCode` (see [`errors.md`](./errors.md)). |
| 16 | bridge | Serializes the `ResolverResult` as JSON, `postMessage` back into the iframe. |
| 17 | `bridge-client.ts` `.then(unwrap)` | `unwrap` returns `data`, or **throws `ApiError`** — the envelope→exception flip on the frontend. |
| 18 | `bridge-client.ts` `.then(mapIssue)` | Raw `JiraIssue` → UI `Issue` DTO. **The raw Jira shape exists only between steps 14 and here.** |
| 19 | `useFixMutations.ts` | `onSettled` → invalidate the `['issues', projectKey]` query → refetch reconciles the optimistic patch with truth. On error, `onError` rolls the patch back. |
| 20a | `app/providers/with-query.tsx` | If it threw, the global `MutationCache.onError` logs `[api:<scope>] <code>: <message>` (debug only). |
| 20b | `features/fix-issue/ui/FixIssueDialog.tsx` | The component reads `assign.error` and renders an inline `Alert` with `t(errorMessageKey(error))` → `errors.<code>`. (Auto-assign's success/partial result shows in a `Snackbar`.) |
| 21 | Component | Re-renders with the fresh `Issue` in cache; dialog closes / shows the result. |

## The three things that flip exactly once per direction

- **Transport:** step 5 is *not* a network call (`postMessage` to Forge); step 11 is the
  *only* real Jira call (server-side `requestJira`).
- **Shape:** raw Jira wire shape lives only inside `bridge-client`'s `.then` chain — it's
  produced at 14 and mapped to a DTO at 18. Nothing else in the frontend sees it.
- **Error:** HTTP status → `ErrorCode` at step 15 (backend, `toApiErrorPayload`); that
  payload → a thrown `ApiError` at step 17 (frontend, `unwrap`). Everything downstream
  speaks DTOs and codes, never wire shapes or statuses.

## Why `src/index.ts` is about as small as it can be

The Forge skeleton is **irreducible/idiomatic**: `new Resolver()`, `.define(name, fn)`,
`export const handler = resolver.getDefinitions()` is the canonical Custom-UI resolver
shape, wired by name in `manifest.yml`. What sits on top is deliberate, not boilerplate:

- **The `define()` wrapper is ours, not Forge-required.** You could inline
  `resolver.define('getProjects', () => getProjects())` and let errors throw — but thrown
  errors don't cross the bridge with structured data, so the frontend would get an opaque
  string instead of a typed `error.code`. The wrapper is the single place a failure
  becomes `{ ok:false, error }`. Removing it would *lose* the typed-error guarantee, so it
  stays.
- **The payload casts (`payload as { … }`)** reflect the Forge reality that `invoke`
  payloads arrive as `unknown` on the backend — the minimal honest thing for a thin proxy
  (a `zod` parse would be the upgrade if payloads grew complex).
- **`await write; return getIssue(id)`** in the write resolvers is a *product* choice
  (read-after-write so the UI gets fresh state), not Forge ceremony.
- **The `ResolverName` union** is a typo-guard on the operation allowlist — a nicety.

So the only way to make the file smaller is to drop the error envelope, which is the one
thing you don't want to drop.

## See also

- [`architecture.md`](../architecture.md) — why the backend is a thin proxy at all.
- [`errors.md`](./errors.md) — the error half of this flow in full (taxonomy, who knows what).
- [`endpoints.md`](./endpoints.md) — what each `requestJira` call (step 10/14) can return.
- [`extending.md`](../extending.md) — the file-by-file checklist to add a new operation.
