import { storage } from '@forge/api'

/**
 * Per-user app settings — persistence only, no business logic. A small opaque
 * JSON blob the frontend owns (currently just the "approaching deadline" window
 * in days). Mirrors `prefs.ts`: the backend never interprets it, only namespaces
 * it by the caller's Jira `accountId` and reads/writes Forge app storage, so each
 * user gets their own settings. Kept separate from the table-prefs blob so the
 * two features never clobber each other's writes.
 *
 * Needs the `storage:app` scope (see manifest.yml).
 */

const keyFor = (accountId: string) => `user-settings:${accountId}`

/** This user's saved settings blob, or `null` if they have none yet. */
export async function getUserSettings(accountId: string): Promise<unknown> {
  if (!accountId) return null
  return (await storage.get(keyFor(accountId))) ?? null
}

/** Replace this user's settings blob (the frontend always sends the full object). */
export async function setUserSettings(
  accountId: string,
  settings: Record<string, unknown>,
): Promise<void> {
  if (!accountId) throw new Error('cannot persist user settings without an accountId')
  await storage.set(keyFor(accountId), settings)
}
