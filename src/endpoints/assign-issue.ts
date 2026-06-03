import { COMMON_ERRORS, type EndpointSpec } from './spec'
import { asUser, assertOk, route } from './client'

export const assignIssueSpec: EndpointSpec = {
  name: 'assignIssue',
  method: 'PUT',
  path: '/rest/api/3/issue/{issueIdOrKey}/assignee',
  summary: 'Set (or clear, with accountId: null) an issue assignee. Body: { accountId }.',
  errors: [
    ...COMMON_ERRORS,
    {
      status: 400,
      code: 'validation',
      when: 'Invalid body or an unknown accountId.',
    },
    {
      status: 403,
      code: 'forbidden',
      when: 'The acting user lacks the "Assign issues" project permission.',
      watch: 'Maps to errors.forbidden — genuinely not allowed; do NOT retry. Roll the optimistic update back.',
    },
    {
      status: 404,
      code: 'notFound',
      when: 'Issue not found or not visible.',
    },
  ],
  notes:
    'Success is 204 No Content (no body). The resolver re-reads via getIssue to return the fresh issue.',
}

export async function assignIssue(
  issueIdOrKey: string,
  accountId: string | null,
): Promise<void> {
  const res = await asUser().requestJira(
    route`/rest/api/3/issue/${issueIdOrKey}/assignee`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId }),
    },
  )
  await assertOk(res)
}
