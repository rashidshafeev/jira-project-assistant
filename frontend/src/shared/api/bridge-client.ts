import { invoke } from '@forge/bridge'
import type { JiraIssue, JiraProject, JiraUser } from '@types'
import type { ResolverResult } from '@result'
import type { AppConfig, IssuePriority, JiraApi, TablePrefs } from './contract'
import { mapIssue, PRIORITY_ID_BY_NAME } from './issue'
import { mapUser } from './member'
import { mapProject } from './project'
import { unwrap } from './errors'

/**
 * Real transport — calls Forge resolvers (see `src/index.ts`) over the bridge.
 * Resolvers return Jira's RAW responses wrapped in a `ResolverResult` envelope;
 * here we `unwrap` (failure → thrown `ApiError`) and MAP raw Jira → the UI DTOs,
 * so the rest of the frontend (and the mock) sees one clean shape. `invoke` is
 * the seam that would become an HTTP call under a future Forge Remote backend.
 */
export const bridgeClient: JiraApi = {
  getProjects: () =>
    invoke<ResolverResult<JiraProject[]>>('getProjects')
      .then(unwrap)
      .then((raw) => raw.map(mapProject)),

  getMembers: (projectKey) =>
    invoke<ResolverResult<JiraUser[]>>('getMembers', { projectKey })
      .then(unwrap)
      .then((raw) => raw.map(mapUser)),

  getIssues: (projectKey) =>
    invoke<ResolverResult<JiraIssue[]>>('getIssues', { projectKey })
      .then(unwrap)
      .then((raw) => raw.map(mapIssue)),

  getIssue: (issueIdOrKey) =>
    invoke<ResolverResult<JiraIssue>>('getIssue', { issueIdOrKey })
      .then(unwrap)
      .then(mapIssue),

  assignIssue: (issueId, accountId) =>
    invoke<ResolverResult<JiraIssue>>('assignIssue', { issueId, accountId })
      .then(unwrap)
      .then(mapIssue),

  setPriority: (issueId, priority: IssuePriority) =>
    invoke<ResolverResult<JiraIssue>>('setPriority', {
      issueId,
      priorityId: PRIORITY_ID_BY_NAME[priority],
    })
      .then(unwrap)
      .then(mapIssue),

  // Prefs are stored as an opaque blob; the backend returns null when the user
  // has none yet, which we normalize to an empty blob so callers always get an object.
  getTablePrefs: () =>
    invoke<ResolverResult<TablePrefs | null>>('getTablePrefs')
      .then(unwrap)
      .then((prefs) => prefs ?? {}),

  setTablePrefs: (prefs) =>
    invoke<ResolverResult<void>>('setTablePrefs', { prefs }).then(unwrap),

  // The backend always returns a full, defaulted config (never null), so there's
  // nothing to normalize. `setAppConfig` only resolves from the admin page — the
  // global page / issue panel never call it (its resolver isn't on those modules).
  getAppConfig: () =>
    invoke<ResolverResult<AppConfig>>('getAppConfig').then(unwrap),

  setAppConfig: (config) =>
    invoke<ResolverResult<AppConfig>>('setAppConfig', { config }).then(unwrap),
}
