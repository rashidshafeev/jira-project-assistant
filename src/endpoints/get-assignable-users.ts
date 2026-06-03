import { COMMON_ERRORS, type EndpointSpec } from './spec'
import { asUser, jiraJson, route } from './client'
import type { JiraUser } from '../types'

export const getAssignableUsersSpec: EndpointSpec = {
  name: 'getAssignableUsers',
  method: 'GET',
  path: '/rest/api/3/user/assignable/search?project={projectKey}&maxResults=100',
  summary: 'Members assignable to issues in a project (Fix dialog + auto-assign pool).',
  errors: [
    ...COMMON_ERRORS,
    {
      status: 400,
      code: 'validation',
      when: 'Invalid query (e.g. a malformed project / user filter).',
    },
    {
      status: 404,
      code: 'notFound',
      when: 'The project does not exist or is not visible to the user.',
      watch:
        'Maps to errors.notFound — the selected project may have been deleted; refetch projects.',
    },
  ],
  notes:
    'Returns each user\'s `active` flag; we filter to active members before assigning ' +
    '(auto-assign round-robins only over active ones).',
}

export async function getAssignableUsers(projectKey: string): Promise<JiraUser[]> {
  const res = await asUser().requestJira(
    route`/rest/api/3/user/assignable/search?project=${projectKey}&maxResults=100`,
  )
  return jiraJson<JiraUser[]>(res)
}
