import type { Issue, IssuePriority } from '@/shared/api'

/**
 * Pure, framework-agnostic problem detection. The two problem classes from the
 * brief:
 *  - `unassigned`            → issue has no assignee (🔴)
 *  - `lowPriorityNearDeadline` → low priority AND the due date is within the
 *                               warning window (or already overdue) (🟡)
 *
 * Kept free of React/Forge so it is trivially unit-testable and runs identically
 * on mock or real data.
 */

export interface IssueProblems {
  unassigned: boolean
  lowPriorityNearDeadline: boolean
}

const LOW_PRIORITIES: ReadonlySet<IssuePriority> = new Set<IssuePriority>([
  'Low',
  'Lowest',
])

/**
 * Default "approaching deadline" window in days. A due date this many days out
 * (or sooner, incl. overdue) counts as "approaching". Used when the user hasn't
 * picked a custom window (see the `deadline-window` feature).
 */
export const DEADLINE_WARNING_DAYS = 7

const MS_PER_DAY = 24 * 60 * 60 * 1000

/**
 * Whole CALENDAR days until `dueDate` relative to `now` — negative when overdue,
 * 0 today. Both sides are reduced to their UTC date (the due date is date-only),
 * so the result is a clean integer: the detection threshold below and the UI's
 * deadline label ("Deadline in 2 days" / "Deadline today" / "1 day overdue")
 * share ONE basis, so the flag and the label can never disagree, and the
 * classification is insensitive to the time of day `now` happens to fall on. Null
 * when there is no due date.
 */
export function dueInDays(dueDate: string | null, now: Date): number | null {
  if (dueDate === null) return null
  const due = new Date(`${dueDate}T00:00:00Z`).getTime()
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  return Math.round((due - today) / MS_PER_DAY)
}

export function detectProblems(
  issue: Issue,
  now: Date,
  warningDays: number = DEADLINE_WARNING_DAYS,
): IssueProblems {
  const unassigned = issue.assignee === null

  // A null priority is "not low", so it never qualifies (see IssuePriorityOrNone).
  const isLow = issue.priority !== null && LOW_PRIORITIES.has(issue.priority)
  const days = dueInDays(issue.dueDate, now)
  const lowPriorityNearDeadline = isLow && days !== null && days <= warningDays

  return { unassigned, lowPriorityNearDeadline }
}

export function hasProblem(problems: IssueProblems): boolean {
  return problems.unassigned || problems.lowPriorityNearDeadline
}
