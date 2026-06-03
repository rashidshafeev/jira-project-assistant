import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api, type Issue, type IssuePriority, type Member } from '@/shared/api'

/**
 * Mutations behind the Fix actions. Both update the cached issues list
 * **optimistically** (instant UI), and **roll back** on error — TanStack Query's
 * `onMutate`/`onError`/`onSettled` lifecycle. Keyed by project so they target the
 * same cache entry `useIssues` reads.
 */

function issuesKey(projectKey: string) {
  return ['issues', projectKey] as const
}

/** Optimistically patch one issue in the cached list; returns a rollback snapshot. */
function useOptimisticIssuePatch(projectKey: string) {
  const qc = useQueryClient()
  return {
    async apply(issueId: string, patch: Partial<Issue>) {
      await qc.cancelQueries({ queryKey: issuesKey(projectKey) })
      const previous = qc.getQueryData<Issue[]>(issuesKey(projectKey))
      qc.setQueryData<Issue[]>(issuesKey(projectKey), (old) =>
        old?.map((i) => (i.id === issueId ? { ...i, ...patch } : i)),
      )
      return previous
    },
    rollback(previous: Issue[] | undefined) {
      if (previous) qc.setQueryData(issuesKey(projectKey), previous)
    },
    invalidate() {
      void qc.invalidateQueries({ queryKey: issuesKey(projectKey) })
    },
  }
}

export interface AssignVars {
  issue: Issue
  member: Member
}

export function useAssignIssue(projectKey: string) {
  const patch = useOptimisticIssuePatch(projectKey)
  return useMutation({
    mutationFn: ({ issue, member }: AssignVars) =>
      api.assignIssue(issue.id, member.accountId),
    onMutate: ({ issue, member }) => patch.apply(issue.id, { assignee: member }),
    onError: (_e, _vars, previous) => patch.rollback(previous),
    onSettled: () => patch.invalidate(),
  })
}

export interface SetPriorityVars {
  issue: Issue
  priority: IssuePriority
}

export function useSetPriority(projectKey: string) {
  const patch = useOptimisticIssuePatch(projectKey)
  return useMutation({
    mutationFn: ({ issue, priority }: SetPriorityVars) =>
      api.setPriority(issue.id, priority),
    onMutate: ({ issue, priority }) => patch.apply(issue.id, { priority }),
    onError: (_e, _vars, previous) => patch.rollback(previous),
    onSettled: () => patch.invalidate(),
  })
}
