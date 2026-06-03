import { storage } from '@forge/api'

/**
 * Per-user UI table preferences — persistence only, no business logic.
 *
 * The value is an OPAQUE JSON blob the frontend owns (a serialized MUI DataGrid
 * state: sort model, filters, column widths/visibility, keyed by table). The
 * backend deliberately never interprets it — there is no UI knowledge on the
 * server (mirrors the "resolvers are a pure proxy" rule). It only namespaces the
 * blob by the caller's Jira `accountId` and reads/writes it to Forge app storage,
 * so each user gets their own layout. The blob is tiny (a few small model
 * objects), well under Forge storage's per-value limit.
 *
 * Needs the `storage:app` scope (see manifest.yml).
 */

const keyFor = (accountId: string) => `table-prefs:${accountId}`

/** This user's saved prefs blob, or `null` if they have none yet. */
export async function getTablePrefs(accountId: string): Promise<unknown> {
  if (!accountId) return null
  return (await storage.get(keyFor(accountId))) ?? null
}

/**
 * Replace this user's prefs blob (the frontend always sends the full blob). Typed
 * as an object — the only shape the frontend sends and the shape Forge storage
 * accepts — though the backend still treats its contents as opaque.
 */
export async function setTablePrefs(
  accountId: string,
  prefs: Record<string, unknown>,
): Promise<void> {
  if (!accountId) throw new Error('cannot persist table prefs without an accountId')
  await storage.set(keyFor(accountId), prefs)
}
