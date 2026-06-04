# Forge KV storage — per-user vs app-wide, and admin gating

Forge gives you one KV API, `storage` from `@forge/api` (`storage.get/set/delete`, plus
`storage.query()` to list and `storage.entity()` for indexed entities — we only use plain
KV). Both kinds of state this app persists sit behind the single `storage:app` scope.

## "Per-user" vs "app-wide" is just the key shape
It is **not** two different APIs. The only difference is whether the caller's `accountId` is
baked into the key:

- **App-wide** = one **fixed** key, same record for everyone (`src/config.ts`, key
  `app-config`).
- **Per-user** = the caller's `accountId` *in* the key, so each user gets their own record
  (`src/prefs.ts`, key `table-prefs:${accountId}`).

```ts
import { storage } from '@forge/api'

// app-wide — one record per installation
const KEY = 'app-config'
export async function getAppConfig(): Promise<AppConfig> {
  const stored = (await storage.get(KEY)) as Partial<AppConfig> | undefined
  return { deadlineWarningDays: stored?.deadlineWarningDays ?? 7 } // fill defaults on read
}
export async function setAppConfig(config: AppConfig) {
  await storage.set(KEY, { deadlineWarningDays: clamp(config.deadlineWarningDays) })
}

// per-user — namespaced by accountId
const keyFor = (accountId: string) => `table-prefs:${accountId}`
export async function getTablePrefs(accountId: string) {
  return (await storage.get(keyFor(accountId))) ?? null
}
export async function setTablePrefs(accountId: string, prefs: Record<string, unknown>) {
  if (!accountId) throw new Error('cannot persist table prefs without an accountId')
  await storage.set(keyFor(accountId), prefs)
}
```

## The `accountId` comes from the resolver context, never the payload
A frontend could lie about who it is, so per-user keys must come from the **authenticated**
caller. Forge puts that in the **resolver context**, not the invoke payload (`src/index.ts`):

```ts
// context.accountId is populated by Forge with the calling Jira user — trusted.
define('getTablePrefs', (_payload, context) => getTablePrefs(context.accountId ?? ''))
define('setTablePrefs', (payload, context) => {
  const { prefs } = payload as { prefs: Record<string, unknown> }
  return setTablePrefs(context.accountId ?? '', prefs)  // key = caller, not payload
})
```

The frontend round-trip is identical for both — `invoke` over the bridge — so the per-user vs
app-wide distinction is invisible to the UI (it never sends an `accountId`):

```ts
const cfg   = unwrap(await invoke('getAppConfig'))                 // app-wide read
await invoke('setAppConfig', { config: { deadlineWarningDays: 14 } })
const prefs = unwrap(await invoke('getTablePrefs'))               // per-user (no id sent!)
await invoke('setTablePrefs', { prefs: gridState })
```

## Practical notes
- **Strongly consistent** within the app — read-after-write is safe (no eventual-consistency
  window to design around).
- **Size cap** ~240 KB per value (check current Forge docs). Both our blobs — a serialized
  DataGrid state and a tiny config record — are well under it. Big/listable data wants
  `storage.entity()` (indexed custom entities) instead of one giant KV value.
- The blob is **opaque to the backend** by design: `prefs.ts` stores the UI's serialized grid
  state without interpreting it, mirroring the "resolvers are a pure proxy" rule.

## Admin-only app-wide config WITHOUT `/mypermissions` — surface + resolver partition
The app-wide config (the "approaching deadline" at-risk window) is a setting only an **admin**
should change. Two non-obvious facts forced the mechanism:
- **Forge/OAuth apps cannot call `/rest/api/3/mypermissions`** — so there is **no runtime
  "is this caller an admin?" check** available to a resolver.
- **The fix is the module surface + a dedicated resolver.** Put the config UI on a
  **`jira:adminPage`** (Jira renders it *only* inside admin settings → admin-only), and give
  that module its **own `function` resolver** (`src/admin.ts`). The bridge dispatches `invoke()`
  to **the calling module's resolver**, so `setAppConfig` — defined *only* in the admin resolver
  — is **unreachable from the non-admin global page / issue panel**. That partition IS the gate;
  the global page gets a read-only `getAppConfig` (on `src/index.ts`).
- **App-wide vs per-user storage is just the key shape** (as above): `storage:app` is app-wide
  by default; per-user blobs put the `accountId` in the key, the app-wide config uses a fixed
  key with no accountId. Same scope.
Refs: <https://developer.atlassian.com/platform/forge/manifest-reference/modules/jira-admin-page/> ;
<https://developer.atlassian.com/cloud/jira/platform/scopes-for-oauth-2-3LO-and-forge-apps/> ;
<https://developer.atlassian.com/platform/forge/runtime-reference/storage-api/>
