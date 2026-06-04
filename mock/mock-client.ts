import type { AppConfig, JiraApi, TablePrefs } from '@/shared/api/contract'
import { DEFAULT_APP_CONFIG } from '@/shared/config/app-config'
import { mockDb } from './mock-db'

/**
 * Mock transport — implements the API contract against the in-memory `mockDb`.
 * Selected by `shared/api/index.ts` when `VITE_USE_MOCKS` is set. Dynamically
 * imported there so it is excluded from production builds.
 *
 * Table prefs are the one piece of mock state we keep in `localStorage` rather
 * than in-memory, so the mock preview persists table layout across reloads too —
 * standing in for Forge app storage (which the bridge transport uses for real).
 */
const PREFS_KEY = 'mock:table-prefs'
const APP_CONFIG_KEY = 'mock:app-config'

export const mockClient: JiraApi = {
  getProjects: () => mockDb.getProjects(),
  getMembers: (projectKey) => mockDb.getMembers(projectKey),
  getIssues: (projectKey) => mockDb.getIssues(projectKey),
  getIssue: (issueIdOrKey) => mockDb.getIssue(issueIdOrKey),
  assignIssue: (issueId, accountId) => mockDb.assignIssue(issueId, accountId),
  setPriority: (issueId, priority) => mockDb.setPriority(issueId, priority),

  getTablePrefs: () => {
    const raw = localStorage.getItem(PREFS_KEY)
    let prefs: TablePrefs = {}
    if (raw) {
      try {
        prefs = JSON.parse(raw) as TablePrefs
      } catch {
        // Corrupt blob — start fresh rather than crash the table.
        prefs = {}
      }
    }
    return Promise.resolve(prefs)
  },

  setTablePrefs: (prefs) => {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs))
    return Promise.resolve()
  },

  // App-wide config: persisted to localStorage (one fixed key, no accountId), so
  // the mock preview stands in for Forge app storage. Missing/partial/corrupt blobs
  // fall back to the defaults, mirroring the backend's defaulting (src/config.ts).
  getAppConfig: () => {
    const raw = localStorage.getItem(APP_CONFIG_KEY)
    let config: AppConfig = DEFAULT_APP_CONFIG
    if (raw) {
      try {
        config = { ...DEFAULT_APP_CONFIG, ...(JSON.parse(raw) as Partial<AppConfig>) }
      } catch {
        config = DEFAULT_APP_CONFIG
      }
    }
    return Promise.resolve(config)
  },

  setAppConfig: (config) => {
    const next: AppConfig = { ...DEFAULT_APP_CONFIG, ...config }
    localStorage.setItem(APP_CONFIG_KEY, JSON.stringify(next))
    return Promise.resolve(next)
  },
}
