import { getProjects, getProjectsSpec } from './get-projects'
import { getAssignableUsers, getAssignableUsersSpec } from './get-assignable-users'
import { searchIssues, searchIssuesSpec } from './search-issues'
import { getIssue, getIssueSpec } from './get-issue'
import { assignIssue, assignIssueSpec } from './assign-issue'
import { setPriority, setPrioritySpec } from './set-priority'
import type { EndpointSpec } from './spec'

export type { EndpointError, EndpointSpec } from './spec'

/** The Jira proxy functions the resolver entry (`src/index.ts`) calls. */
export {
  getProjects,
  getAssignableUsers,
  searchIssues,
  getIssue,
  assignIssue,
  setPriority,
}

/**
 * Catalog of the Jira REST v3 endpoints this app consumes, each with the failure
 * modes we account for — documented status codes + ones we've observed live. It
 * lives beside the proxy function it describes (one file per endpoint = spec +
 * logic), and is the single source for "what can really go wrong here, and what
 * we do about it". It stays honest three ways:
 *
 *  - `endpoints.test.ts` asserts every declared error matches the central
 *    `errorCodeFromStatus` taxonomy (per-endpoint knowledge ↔ one mapping),
 *  - `docs/api/endpoints.md` mirrors it as a human-readable failure-mode table,
 *  - new live errors get appended here (the "error ratchet", see docs/extending.md),
 *    so the catalog grows from reality rather than rotting.
 */
export const ENDPOINTS: EndpointSpec[] = [
  getProjectsSpec,
  getAssignableUsersSpec,
  searchIssuesSpec,
  getIssueSpec,
  assignIssueSpec,
  setPrioritySpec,
]
