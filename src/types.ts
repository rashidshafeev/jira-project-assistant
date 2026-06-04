/**
 * Raw Jira REST v3 wire types — the shapes that cross the Forge bridge from the
 * resolvers (`src/index.ts`) to the frontend transport (`shared/api/bridge-client.ts`,
 * via the `@types` alias). The backend is a thin proxy: it returns Jira's responses
 * as-is, and the frontend maps these to its own UI DTOs. One definition → a mismatch
 * is a compile error, not a silent `undefined` over the untyped JSON bridge.
 *
 * Hand-written narrow slice — only the fields we consume. Codegen from the OpenAPI
 * spec is unhelpful here: `IssueBean.fields` is an untyped bag and every sub-schema
 * is optional, so it can't type the fields we read. See docs/forge-gotchas.md.
 *
 * ⚠️ TYPES ONLY. Both bundles import this with `import type`, so it erases at
 * runtime (no bundler/CSP impact). Keep constants/logic elsewhere.
 */

export interface JiraAvatarUrls {
  '48x48': string
  '24x24': string
  '16x16': string
  '32x32': string
}

export interface JiraProject {
  id: string
  key: string
  name: string
  avatarUrls?: JiraAvatarUrls
}

/** Paginated project list — GET /rest/api/3/project/search */
export interface JiraProjectSearchResponse {
  values: JiraProject[]
  total: number
  isLast: boolean
}

export interface JiraUser {
  accountId: string
  displayName: string
  emailAddress?: string
  active: boolean
  avatarUrls?: JiraAvatarUrls
}

/** Priority sub-object on an issue. May be absent entirely (team-managed projects). */
export interface JiraPriority {
  id: string
  name: string
}

export interface JiraStatusCategory {
  /** Language-stable key: `new` | `indeterminate` | `done`. Use this, not `name`. */
  key: string
  name: string
}

export interface JiraStatus {
  id: string
  /** Localized display name (e.g. "К выполнению"). Display only — never branch on it. */
  name: string
  statusCategory: JiraStatusCategory
}

/** The narrow slice of issue `fields` we request (see the `fields=` query param). */
export interface JiraIssueFields {
  summary: string
  status: JiraStatus
  assignee: JiraUser | null
  priority?: JiraPriority | null
  duedate?: string | null
  /** ISO datetime. Only the notification sweep requests it (the fallback
   *  "unassigned since" anchor); the UI's narrow field set omits it. */
  created?: string | null
}

export interface JiraIssue {
  id: string
  key: string
  fields: JiraIssueFields
}

/** Paginated issue search — GET /rest/api/3/search/jql */
export interface JiraIssueSearchResponse {
  issues: JiraIssue[]
  nextPageToken?: string
}
