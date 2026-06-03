/**
 * The frontend's API contract — the transport interface (`JiraApi`), expressed
 * in the UI DTOs. **Types only**, so it's dependency-free and safe to import from
 * anywhere.
 *
 * WHY THIS IS ITS OWN FILE (not folded into `bridge-client` or `transport`).
 * `JiraApi` has TWO implementations — `bridgeClient` (real) and `mockClient`
 * (`/mock`) — and `transport.ts` swaps between them. The interface is the neutral
 * seam both conform to, so it can't live inside either one:
 *  - put it in `bridge-client` and the mock would import its interface from the
 *    real client — but `bridge-client` pulls in `@forge/bridge`, which throws on
 *    import outside a Forge host, so the mock must never depend on it;
 *  - put it in `transport` and you get an import cycle (`bridge-client` →
 *    `transport` → dynamic `import('./bridge-client')`) on a top-level-`await`
 *    module.
 * Declaring it explicitly is what makes the mock a *guaranteed* drop-in: both
 * clients are checked against this one shape, so any drift is a compile error.
 *
 * The DTOs and their mappers are colocated per resource (`./issue`, `./member`,
 * `./project`) — each file owns one entity's clean shape plus how to build it
 * from the raw Jira types that cross the bridge (`@types` = `src/types.ts`).
 * This module re-exports those DTO types and defines the transport over them;
 * `bridge-client` maps raw Jira → DTO so the mock, hooks and components all speak
 * one clean language.
 */

import type { Issue, IssuePriority } from './issue'
import type { Member } from './member'
import type { ProjectSummary } from './project'

export type {
  Issue,
  IssueStatus,
  IssuePriority,
  IssuePriorityOrNone,
  StatusCategory,
} from './issue'
export type { Member } from './member'
export type { ProjectSummary } from './project'

/**
 * Per-user UI table preferences — an OPAQUE blob, intentionally not typed here.
 * Keys namespace each table (`'issues'`, `'team'`); each value is a serialized
 * MUI DataGrid state (sort/filter/column layout). The transport stays MUI-free —
 * the `table-prefs` feature owns the real `GridInitialState` shape and casts at
 * its edge; the backend just stores the blob (see `src/prefs.ts`).
 */
export type TablePrefs = Record<string, unknown>

/**
 * Per-user app settings — a small TYPED blob (unlike the opaque table prefs).
 * Currently just the "approaching deadline" window. Persisted separately from the
 * table prefs so the two features don't fight over one storage blob (see
 * `src/settings.ts`). Every field is optional → an absent/empty blob means "use
 * the app defaults", which is what a brand-new user gets.
 */
export interface UserSettings {
  /** "Approaching deadline" window in days; absent → the app default applies. */
  deadlineWarningDays?: number
}

/** Everything the UI can ask the backend to do — expressed in clean DTOs. */
export interface JiraApi {
  getProjects(): Promise<ProjectSummary[]>
  getMembers(projectKey: string): Promise<Member[]>
  getIssues(projectKey: string): Promise<Issue[]>
  /** A single issue by id or key — used by the issue-panel view. */
  getIssue(issueIdOrKey: string): Promise<Issue>

  assignIssue(issueId: string, accountId: string): Promise<Issue>
  setPriority(issueId: string, priority: IssuePriority): Promise<Issue>

  /**
   * App-storage ops (not Jira): load/save this user's table prefs. They share
   * the one transport so the prefs feature reaches them through the same `api`
   * seam — the mock persists them to localStorage, the bridge to Forge storage.
   */
  getTablePrefs(): Promise<TablePrefs>
  setTablePrefs(prefs: TablePrefs): Promise<void>

  /** App-storage ops (not Jira): load/save this user's typed settings blob. */
  getSettings(): Promise<UserSettings>
  setSettings(settings: UserSettings): Promise<void>
}
