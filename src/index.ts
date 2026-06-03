import Resolver from '@forge/resolver'
import {
  getProjects,
  getAssignableUsers,
  searchIssues,
  getIssue,
  assignIssue,
  setPriority,
} from './endpoints'
import { getTablePrefs, setTablePrefs } from './prefs'
import { getUserSettings, setUserSettings } from './settings'
import { toApiErrorPayload, type ResolverResult } from './result'

/** Resolver names invoked over the Forge bridge — the operation allowlist. */
type ResolverName =
  | 'getProjects'
  | 'getMembers'
  | 'getIssues'
  | 'getIssue'
  | 'assignIssue'
  | 'setPriority'
  | 'getTablePrefs'
  | 'setTablePrefs'
  | 'getSettings'
  | 'setSettings'

/**
 * The slice of Forge's resolver context we read. Forge populates `accountId` with
 * the calling Jira user's id; we use it to scope per-user table prefs.
 */
interface ResolverContext {
  accountId?: string
}

/**
 * Resolver definitions — the glue the Custom UI frontend reaches via
 * `@forge/bridge`'s `invoke(name, payload)`. Kept thin: validate the payload,
 * call the matching Jira proxy (`./endpoints`), return a typed result envelope. Reads return
 * Jira's raw response; the frontend maps it to UI DTOs. Writes re-read the issue
 * so the frontend gets its fresh state.
 */
const resolver = new Resolver()

/**
 * Register a resolver that always returns a {@link ResolverResult}: success data
 * or a normalized error. This is the single place Jira/HTTP errors become our
 * `ErrorCode` taxonomy — thrown errors don't carry structured data reliably
 * across the bridge (see `docs/extending.md`).
 *
 * The handler also receives the Forge resolver context (`accountId` etc.) — most
 * proxies ignore it, but the per-user prefs resolvers key their storage on it.
 */
function define<T>(
  name: ResolverName,
  handler: (payload: unknown, context: ResolverContext) => Promise<T>,
): void {
  resolver.define(name, async (req): Promise<ResolverResult<T>> => {
    try {
      const { payload, context } = req as {
        payload: unknown
        context: ResolverContext
      }
      return { ok: true, data: await handler(payload, context) }
    } catch (e) {
      return { ok: false, error: toApiErrorPayload(e) }
    }
  })
}

define('getProjects', () => getProjects())

define('getMembers', (payload) => {
  const { projectKey } = payload as { projectKey: string }
  return getAssignableUsers(projectKey)
})

define('getIssues', (payload) => {
  const { projectKey } = payload as { projectKey: string }
  return searchIssues(projectKey)
})

// A single fresh issue — backs the issue-panel view (which loads one issue by its
// key from the Forge context) and shares the same raw→DTO mapping as the list.
define('getIssue', (payload) => {
  const { issueIdOrKey } = payload as { issueIdOrKey: string }
  return getIssue(issueIdOrKey)
})

define('assignIssue', async (payload) => {
  const { issueId, accountId } = payload as { issueId: string; accountId: string }
  await assignIssue(issueId, accountId)
  return getIssue(issueId)
})

define('setPriority', async (payload) => {
  const { issueId, priorityId } = payload as { issueId: string; priorityId: string }
  await setPriority(issueId, priorityId)
  return getIssue(issueId)
})

// Per-user UI prefs (table sort/filter/column layout) — keyed on the caller's
// accountId from the resolver context, never trusted from the payload. The blob
// is opaque to the backend (see prefs.ts).
define('getTablePrefs', (_payload, context) => getTablePrefs(context.accountId ?? ''))

define('setTablePrefs', (payload, context) => {
  const { prefs } = payload as { prefs: Record<string, unknown> }
  return setTablePrefs(context.accountId ?? '', prefs)
})

// Per-user app settings (currently the at-risk deadline window) — same pattern as
// the table prefs but a separate storage blob, so the two features never clobber
// each other's writes. Opaque to the backend (see settings.ts).
define('getSettings', (_payload, context) => getUserSettings(context.accountId ?? ''))

define('setSettings', (payload, context) => {
  const { settings } = payload as { settings: Record<string, unknown> }
  return setUserSettings(context.accountId ?? '', settings)
})

export const handler = resolver.getDefinitions()
