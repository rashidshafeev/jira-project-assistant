import { storage } from '@forge/api'

/**
 * App-wide configuration — ONE record per installation (not per-user). Read by the
 * UI and by the notification sweep (which runs `asApp` with no user, so it cannot
 * read a per-user setting); written ONLY from the admin page (see `src/admin.ts`
 * and the admin-gating note in docs/forge-gotchas.md).
 *
 * Persisted as an opaque blob under a FIXED key (no `accountId`, unlike the
 * per-user `prefs.ts`) — that single difference is what makes it app-wide. Needs
 * the `storage:app` scope (see manifest.yml).
 */
export interface AppConfig {
  /** "Approaching deadline" window in days: a low-priority issue due within this
   *  many days (or overdue) is at risk. Shared with the UI's view highlight. */
  deadlineWarningDays: number
  /** Grace days an issue may sit unassigned before the sweep alerts on it. */
  unassignedGraceDays: number
}

export const DEFAULT_APP_CONFIG: AppConfig = {
  deadlineWarningDays: 7,
  unassignedGraceDays: 1,
}

const KEY = 'app-config'

/** The app-wide config, with defaults filled in for any missing/unset field. */
export async function getAppConfig(): Promise<AppConfig> {
  const stored = (await storage.get(KEY)) as Partial<AppConfig> | undefined
  return {
    deadlineWarningDays: pickDays(stored?.deadlineWarningDays, DEFAULT_APP_CONFIG.deadlineWarningDays),
    unassignedGraceDays: pickDays(stored?.unassignedGraceDays, DEFAULT_APP_CONFIG.unassignedGraceDays),
  }
}

/** Replace the app-wide config. Values are clamped defensively (the admin UI
 *  sends a bounded number, but the backend never trusts the payload). */
export async function setAppConfig(config: AppConfig): Promise<AppConfig> {
  const next: AppConfig = {
    deadlineWarningDays: pickDays(config.deadlineWarningDays, DEFAULT_APP_CONFIG.deadlineWarningDays),
    unassignedGraceDays: pickDays(config.unassignedGraceDays, DEFAULT_APP_CONFIG.unassignedGraceDays),
  }
  await storage.set(KEY, next)
  return next
}

/** Coerce to a whole number of days in [0, 365], falling back when not a number. */
function pickDays(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.min(365, Math.max(0, Math.round(value)))
}
