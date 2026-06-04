import { asApp, assertOk, jiraJson, route } from '../endpoints/client'
import type {
  JiraIssue,
  JiraIssueSearchResponse,
  JiraProject,
  JiraProjectSearchResponse,
} from '../types'

/**
 * `asApp` Jira calls for the notification engines (sweep + event handler). These
 * run with NO user, so they can't reuse the `asUser` proxies in `endpoints/` —
 * see docs/forge-gotchas.md.
 *
 * Field set is wider than the UI's narrow `ISSUE_FIELDS`: it adds `created`, the
 * fallback anchor for "unassigned since" when no event-seeded anchor exists.
 */
const SWEEP_FIELDS = 'summary,status,assignee,priority,duedate,created'

/** Projects visible to the app. */
export async function fetchProjects(): Promise<JiraProject[]> {
  const res = await asApp().requestJira(route`/rest/api/3/project/search?maxResults=50`)
  return (await jiraJson<JiraProjectSearchResponse>(res)).values
}

/** Issues for a project (mirrors `endpoints/search-issues`, but `asApp` + `created`). */
export async function fetchProjectIssues(projectKey: string): Promise<JiraIssue[]> {
  const jql = `project = ${projectKey} ORDER BY created DESC`
  const res = await asApp().requestJira(
    route`/rest/api/3/search/jql?jql=${jql}&maxResults=100&fields=${SWEEP_FIELDS}`,
  )
  return (await jiraJson<JiraIssueSearchResponse>(res)).issues
}

/** One issue by id/key — the event handler re-fetches to read the authoritative
 *  assignee rather than trust the (instance-varying) event payload. */
export async function fetchIssue(issueIdOrKey: string): Promise<JiraIssue> {
  const res = await asApp().requestJira(
    route`/rest/api/3/issue/${issueIdOrKey}?fields=${SWEEP_FIELDS}`,
  )
  return jiraJson<JiraIssue>(res)
}

/**
 * Email an issue's reporter + assignee via Jira's native `/notify` (204 on
 * success; no egress). `assignee: true` is a no-op on an unassigned issue, so the
 * reporter still receives it.
 */
export async function notifyIssue(
  issueKey: string,
  subject: string,
  textBody: string,
): Promise<void> {
  const res = await asApp().requestJira(route`/rest/api/3/issue/${issueKey}/notify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subject, textBody, to: { reporter: true, assignee: true } }),
  })
  await assertOk(res)
}
