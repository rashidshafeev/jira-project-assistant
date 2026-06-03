import { COMMON_ERRORS, type EndpointSpec } from './spec'
import { asUser, assertOk, route } from './client'

export const setPrioritySpec: EndpointSpec = {
  name: 'setPriority',
  method: 'PUT',
  path: '/rest/api/3/issue/{issueIdOrKey}',
  summary:
    'Edit issue fields — we set only priority.id (the "raise priority" fix). Body: { fields: { priority: { id } } }.',
  errors: [
    ...COMMON_ERRORS,
    {
      status: 400,
      code: 'validation',
      when:
        'Invalid priority id, OR the Priority field is not on the issue\'s edit screen.',
      watch:
        'Ties directly to the null-priority finding: team-managed projects may not expose ' +
        'Priority at all, so a raise can 400 even though a button was shown. We detect null ' +
        'priority up front (problem.ts) and only offer the raise on issues that already have one.',
    },
    {
      status: 403,
      code: 'forbidden',
      when: 'The acting user lacks the "Edit issues" permission.',
    },
    {
      status: 404,
      code: 'notFound',
      when: 'Issue not found or not visible.',
    },
  ],
  notes: 'Success is 204 No Content. The resolver re-reads via getIssue to return the fresh DTO.',
}

export async function setPriority(
  issueIdOrKey: string,
  priorityId: string,
): Promise<void> {
  const res = await asUser().requestJira(route`/rest/api/3/issue/${issueIdOrKey}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: { priority: { id: priorityId } } }),
  })
  await assertOk(res)
}
