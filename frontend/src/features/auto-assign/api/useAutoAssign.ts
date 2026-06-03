import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/shared/api'
import { planAutoAssign, type AutoAssignSummary } from '../model/plan'

/**
 * Bulk "auto-assign unassigned" — orchestrated client-side. The round-robin is a
 * pure plan (`planAutoAssign`) applied via the same `assignIssue` the single Fix
 * action uses, so there's no bespoke backend endpoint: just N writes, fired in
 * parallel. It reads issues + members from the query cache (already loaded for
 * the tables/stats; fetched once if missing), so it adds no redundant reads.
 *
 * Deliberately NOT optimistic — the assignment targets aren't visible until the
 * plan runs — so we invalidate issues + members on settle and let the lists
 * reload with the real state (the brief's "after the action — reloads the list").
 */
export function useAutoAssign(projectKey: string) {
  const qc = useQueryClient()
  return useMutation<AutoAssignSummary, unknown, void>({
    mutationFn: async () => {
      const [issues, members] = await Promise.all([
        qc.ensureQueryData({
          queryKey: ['issues', projectKey],
          queryFn: () => api.getIssues(projectKey),
        }),
        qc.ensureQueryData({
          queryKey: ['members', projectKey],
          queryFn: () => api.getMembers(projectKey),
        }),
      ])

      const plan = planAutoAssign(issues, members)
      const results = await Promise.allSettled(
        plan.map((p) => api.assignIssue(p.issue.id, p.member.accountId)),
      )

      const assigned = results.filter((r) => r.status === 'fulfilled').length
      const failed = results.length - assigned

      // Every write failed → surface it as an error (the dialog shows it & lets
      // the user retry). Partial success resolves with the counts instead.
      if (plan.length > 0 && assigned === 0) {
        throw (results.find((r) => r.status === 'rejected') as PromiseRejectedResult).reason
      }
      return { assigned, failed }
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ['issues', projectKey] })
      void qc.invalidateQueries({ queryKey: ['members', projectKey] })
    },
  })
}
