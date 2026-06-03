import { COMMON_ERRORS, type EndpointSpec } from './spec'
import { asUser, jiraJson, route } from './client'
import type { JiraProject, JiraProjectSearchResponse } from '../types'

export const getProjectsSpec: EndpointSpec = {
  name: 'getProjects',
  method: 'GET',
  path: '/rest/api/3/project/search?maxResults=50',
  summary: 'List projects visible to the current user (for the project picker).',
  errors: [
    ...COMMON_ERRORS,
    {
      status: 400,
      code: 'validation',
      when: 'Invalid query params (maxResults/startAt out of range, bad expand).',
    },
  ],
  notes:
    'Permission-limited users just get a SMALLER list, not a 403 — so an empty ' +
    'result means "no visible projects", which the UI renders as an empty state, not an error.',
}

export async function getProjects(): Promise<JiraProject[]> {
  const res = await asUser().requestJira(
    route`/rest/api/3/project/search?maxResults=50`,
  )
  const data = await jiraJson<JiraProjectSearchResponse>(res)
  return data.values
}
