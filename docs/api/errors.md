# Error handling — end to end

One idea runs through the whole stack: **translate Jira/HTTP specifics into a small,
language-stable code exactly once (on the backend), and from then on everyone — bridge,
frontend, mock — speaks only that code.** The raw detail is preserved for debugging but
never shown to users; the UI renders its own i18n message keyed by the code.

## The flow

```
Jira REST  ── non-2xx ──▶  src/endpoints/*        assertOk (client.ts) throws JiraHttpError(status, statusText, body)
                              │                    (carries the raw Jira body)
                              ▼
                           src/index.ts           define() wrapper:  try → { ok:true, data }
                              │                                       catch → { ok:false, error: toApiErrorPayload(e) }
                              │  toApiErrorPayload → { code: errorCodeFromStatus(status), message }   ← Jira/HTTP knowledge STOPS here
                              ▼
              ════════════ Forge bridge ════════════  ResolverResult<T> (plain JSON envelope)
                              ▼
                           bridge-client.ts        invoke(...).then(unwrap)
                              │  unwrap(result) → return data, or throw new ApiError(result.error)
                              ▼
                           TanStack Query          QueryCache/MutationCache onError → console.error("[api:scope] code:", message)   ← raw detail logged
                              ▼
                           component               t(errorMessageKey(error))  →  "errors.<code>"  (i18n in the UI locale)

   mock-client / mock-db  ── throws the SAME ApiError { code } directly (no Jira knowledge, no bridge)
```

## Why an envelope, not a thrown error

Thrown errors don't serialize reliably across the Forge bridge (it's `postMessage`, not
HTTP), so resolvers **return** a discriminated `ResolverResult<T>` instead of throwing.
`bridge-client` turns the `{ ok:false }` branch back into a thrown `ApiError` so the
frontend's normal try/throw + TanStack Query error paths work. The mock skips the envelope
entirely and just throws `ApiError` — same code, no Jira/HTTP round-trip to model.

## The taxonomy (the one translation)

`src/result.ts` is the single place Jira HTTP status → our `ErrorCode`:

| Status | `ErrorCode` | | Status | `ErrorCode` |
|---|---|---|---|---|
| 400, 422 | `validation` | | 404 | `notFound` |
| 401 | `unauthorized` | | 409 | `conflict` |
| 403 | `forbidden` | | 429 | `rateLimited` |
| | | | (other) | `unknown` |

The frontend branches on the **code**, never the status. Per-endpoint, which codes each
Jira call can actually produce is catalogued in [`src/endpoints/`](../../src/endpoints) and
[`endpoints.md`](./endpoints.md); every status is translated through this one table
(`src/result.ts`), so the catalogued codes and the mapping are single-sourced.

## Where each piece lives

| File | Role |
|---|---|
| `src/result.ts` | Both halves of the protocol in one file: the shared **wire types** (`ErrorCode`, `ApiErrorPayload { code, message }`, `ResolverResult<T>`) imported by both sides via `@result`, and the **backend translation** (`JiraHttpError` carrying status + raw body, `errorCodeFromStatus`, `toApiErrorPayload`). Only the types reach the frontend (`import type`); the logic is server-only — which is why `JiraHttpError` avoids parameter-property syntax (the frontend's `erasableSyntaxOnly` forbids it). |
| `src/index.ts` | The `define()` wrapper — the one place a thrown error becomes the `{ ok:false, error }` envelope. |
| `frontend/src/shared/api/errors.ts` | Frontend: `ApiError` (a real `Error` with a typed `.code`), `unwrap()`, `errorMessageKey()`. |
| `frontend/src/app/providers/with-query.tsx` | Global `QueryCache`/`MutationCache` `onError` → logs the raw `error.message`. |
| `frontend/src/shared/i18n/locales/{en,ru}.json` | The user-facing strings under `errors.*`, keyed by code. |
| `mock/mock-db.ts` | Throws `ApiError` in the same taxonomy (e.g. `notFound`) — no Jira knowledge. |

## What the user sees vs. what we log

- **User-facing:** an i18n message keyed by `code` (`errors.forbidden`, `errors.notFound`,
  …), rendered in the **UI** locale via `t(errorMessageKey(error))`. Action errors (Fix,
  auto-assign) show in a dialog/snackbar `Alert`; load failures (issues / projects / team)
  show an **inline** `Alert` in that section with a **Retry** button (`refetch`), so the
  failure is in-context and recoverable without reloading the page. Both branches go through
  `errorMessageKey`, so the whole taxonomy (forbidden / rateLimited / …) reaches the user.
- **Logged (not shown):** the global Query/Mutation `onError` logs `[api:<scope>] <code>:`
  plus `error.message`, which carries the raw Jira detail (status + body, including Jira's
  own localized `errorMessages`). That's the one place the underlying cause surfaces — for
  debugging.

## Why not just show Jira's message?

Jira returns localized `errorMessages` (e.g. a 404 came back in Russian). In our setup the
UI locale and Jira's `asUser()` locale are the *same* user, so they'd usually match — so
locale is **not** the reason. The reasons are:

1. **We need the `code` anyway** to drive behavior (retry? refresh banner? disable the
   action?). Once we have it, our own message is the natural thing to render — the code is
   load-bearing, the message cosmetic.
2. **Not every error is a Jira error.** Network failures, the mock's injected failures, and
   our own validation produce no Jira `errorMessages`. One source (i18n-by-code) handles
   *all* error origins uniformly; "Jira's text when present, ours otherwise" would be
   inconsistent.
3. **Tone / quality / actionability.** Jira's raw strings are written for Jira and can leak
   internals (`customfield_10010`); ours are tailored and actionable.

The raw Jira text isn't lost — it rides along in `ApiErrorPayload.message` and is logged
for debugging. Surfacing it to users (e.g. a dev-only "details" expander gated on
`import.meta.env.DEV`) is a deliberate, optional add-on, not the default.

## Adding / hardening errors

See the **error ratchet** in [`extending.md`](../extending.md): when you hit a real error,
record its evidence in the matching `src/endpoints/` spec's `observed`, normalize data
quirks at the mapper or status→code in `result.ts`, and only teach the mock a specific
error when the UI behaves differently for it (then in our taxonomy, never as a raw status).
