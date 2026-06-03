import type { JiraApi, TablePrefs, UserSettings } from '@/shared/api/contract'
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
const SETTINGS_KEY = 'mock:user-settings'

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

  getSettings: () => {
    const raw = localStorage.getItem(SETTINGS_KEY)
    let settings: UserSettings = {}
    if (raw) {
      try {
        settings = JSON.parse(raw) as UserSettings
      } catch {
        // Corrupt blob — fall back to defaults rather than crash the app.
        settings = {}
      }
    }
    return Promise.resolve(settings)
  },

  setSettings: (settings) => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
    return Promise.resolve()
  },
}
