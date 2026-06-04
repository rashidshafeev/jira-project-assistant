import api, { route } from '@forge/api'
import { JiraHttpError } from '../result'

/**
 * Shared Jira access helpers for the per-endpoint proxy functions in this folder.
 *
 * `asUser()` impersonates the current Jira user, so reads/writes respect that
 * user's permissions and changes are attributed to them. `requestJira` injects
 * the Jira base URL + OAuth from the manifest scopes; the `route` tagged template
 * URL-encodes interpolated values. Non-2xx → `JiraHttpError` (see `result.ts`).
 */

export { route }

/** Authenticated Jira request context for the current user. */
export const asUser = () => api.asUser()

/**
 * Authenticated Jira request context as the APP itself (no user). The notification
 * engines — the hourly issue-health `scheduledTrigger` (`src/sweep.ts`) and the
 * `assignee-watch` product-event `trigger` (`src/events.ts`) — run with **no
 * calling user**, so they can't use `asUser()`; they act as the app, with the
 * manifest scopes (see docs/forge-gotchas.md, "scheduledTrigger … runs as the
 * app"). The response shape is identical to `asUser()`'s, so `jiraJson`/`assertOk`
 * below work for both. See `src/notify/jira.ts` for the `asApp` proxies.
 */
export const asApp = () => api.asApp()

export type JiraResponse = Awaited<
  ReturnType<ReturnType<typeof api.asUser>['requestJira']>
>

/** The narrow issue field set we request (searchIssues + getIssue). */
export const ISSUE_FIELDS = 'summary,status,assignee,priority,duedate'

export async function jiraJson<T>(res: JiraResponse): Promise<T> {
  await assertOk(res)
  return (await res.json()) as T
}

export async function assertOk(res: JiraResponse): Promise<void> {
  if (!res.ok) {
    throw new JiraHttpError(res.status, res.statusText, await res.text())
  }
}
