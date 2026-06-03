import type { Issue, Member } from '@/shared/api'

/**
 * Per-member workload, derived purely from the members list + the project's
 * issues (no extra API). `assigned` is the headcount of issues whose assignee is
 * this member; `inProgress`/`done` split that by the issue's status category.
 *
 * The brief says the exact "activity" definition isn't important — we use
 * `inProgress` (issues in an `indeterminate` status category) as the activity
 * proxy: it's the work a member is *currently* moving, language-stable (keyed on
 * `status.category`, not display names), and needs no extra data.
 */
export interface MemberStats {
  member: Member
  assigned: number
  inProgress: number
  done: number
}

export function computeMemberStats(members: Member[], issues: Issue[]): MemberStats[] {
  const buckets = new Map<string, { assigned: number; inProgress: number; done: number }>()
  for (const m of members) buckets.set(m.accountId, { assigned: 0, inProgress: 0, done: 0 })

  for (const issue of issues) {
    const accountId = issue.assignee?.accountId
    if (accountId === undefined) continue
    const bucket = buckets.get(accountId)
    if (bucket === undefined) continue // assignee not in the assignable-members list
    bucket.assigned += 1
    if (issue.status.category === 'indeterminate') bucket.inProgress += 1
    else if (issue.status.category === 'done') bucket.done += 1
  }

  return members
    .map((member) => {
      const bucket = buckets.get(member.accountId)!
      return { member, ...bucket }
    })
    // Active first, then busiest (most assigned) first.
    .sort((a, b) => {
      if (a.member.active !== b.member.active) return a.member.active ? -1 : 1
      return b.assigned - a.assigned
    })
}
