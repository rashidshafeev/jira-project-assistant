import { COMMON_ERRORS, type EndpointSpec } from './spec'
import { asUser, ISSUE_FIELDS, jiraJson, route } from './client'
import type { JiraIssue } from '../types'

export const getIssueSpec: EndpointSpec = {
  name: 'getIssue',
  method: 'GET',
  path: '/rest/api/3/issue/{issueIdOrKey}?fields=summary,status,assignee,priority,duedate',
  summary: 'A single fresh issue — used to re-read after a write (assign / setPriority).',
  errors: [
    ...COMMON_ERRORS,
    {
      status: 404,
      code: 'notFound',
      when:
        'Issue does not exist OR the user lacks permission to view it — Jira deliberately ' +
        'conflates the two so callers can\'t probe for hidden issues.',
      watch:
        'Maps to errors.notFound — never report "no permission" vs "deleted"; tell the user to refresh.',
      observed:
        'Captured live, localized (RU): errorMessages: ["Запрашиваемая задача не существует ' +
        'либо у вас нет прав на её просмотр."]. (The recorded tape was not retained — re-capture ' +
        'from the live site to restore a replayable fixture.)',
    },
  ],
}

export async function getIssue(issueIdOrKey: string): Promise<JiraIssue> {
  const res = await asUser().requestJira(
    route`/rest/api/3/issue/${issueIdOrKey}?fields=${ISSUE_FIELDS}`,
  )
  return jiraJson<JiraIssue>(res)
}
