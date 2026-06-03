import { COMMON_ERRORS, type EndpointSpec } from './spec'
import { asUser, ISSUE_FIELDS, jiraJson, route } from './client'
import type { JiraIssue, JiraIssueSearchResponse } from '../types'

export const searchIssuesSpec: EndpointSpec = {
  name: 'searchIssues',
  method: 'GET',
  path: '/rest/api/3/search/jql?jql={jql}&maxResults=100&fields=summary,status,assignee,priority,duedate',
  summary:
    'Issues for a project (the main table). Uses the current /search/jql — not the deprecated /search.',
  errors: [
    ...COMMON_ERRORS,
    {
      status: 400,
      code: 'validation',
      when: 'Invalid JQL — an unknown project key, or a field that does not exist on the site.',
      watch:
        'We build the JQL from the selected project key, so a 400 here usually means the ' +
        'selected key is stale (project deleted/renamed) — refetch projects.',
    },
  ],
  notes:
    'We request a NARROW `fields` set to keep payloads small; widening it is where new ' +
    'columns get added. The endpoint paginates — we cap at maxResults=100 (no cursor loop yet).',
}

export async function searchIssues(projectKey: string): Promise<JiraIssue[]> {
  const jql = `project = ${projectKey} ORDER BY created DESC`
  const res = await asUser().requestJira(
    route`/rest/api/3/search/jql?jql=${jql}&maxResults=100&fields=${ISSUE_FIELDS}`,
  )
  const data = await jiraJson<JiraIssueSearchResponse>(res)
  return data.issues
}
