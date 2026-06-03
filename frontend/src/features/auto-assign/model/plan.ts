import type { Issue, Member } from '@/shared/api'

/** One planned assignment: pair an unassigned issue with the member to take it. */
export interface Assignment {
  issue: Issue
  member: Member
}

/** Outcome of applying a plan — how many writes succeeded vs failed. */
export interface AutoAssignSummary {
  assigned: number
  failed: number
}

/**
 * The auto-assign rule, as a pure function: pair every unassigned issue with an
 * active member, round-robin so the load spreads evenly. Deterministic (member
 * order in → assignment order out), so it's unit-tested without any network —
 * the bulk action is just this plan applied via `assignIssue`. Empty when there
 * are no active members or nothing is unassigned.
 */
export function planAutoAssign(issues: Issue[], members: Member[]): Assignment[] {
  const active = members.filter((m) => m.active)
  if (active.length === 0) return []
  return issues
    .filter((issue) => issue.assignee === null)
    .map((issue, i) => ({ issue, member: active[i % active.length]! }))
}
