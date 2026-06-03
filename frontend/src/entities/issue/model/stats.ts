import type { Issue, StatusCategory } from '@/shared/api'
import { detectProblems, DEADLINE_WARNING_DAYS } from './problem'

/**
 * Project-level rollup shown in the control panel. Pure (no React/Forge) so it's
 * trivially testable and identical on mock or real data. The `unassigned` /
 * `atRisk` counts reuse the SAME `detectProblems` rule the table highlights and
 * the Fix dialog act on, so the headline numbers can never disagree with the rows.
 */
export interface ProjectStats {
  total: number
  /** 🔴 issues with no assignee. */
  unassigned: number
  /** 🟡 low priority with an approaching deadline. */
  atRisk: number
  /** Count by language-stable status category (To do / In progress / Done). */
  byCategory: Record<StatusCategory, number>
}

export function computeStats(
  issues: Issue[],
  now: Date,
  warningDays: number = DEADLINE_WARNING_DAYS,
): ProjectStats {
  const stats: ProjectStats = {
    total: issues.length,
    unassigned: 0,
    atRisk: 0,
    byCategory: { new: 0, indeterminate: 0, done: 0 },
  }
  for (const issue of issues) {
    const problems = detectProblems(issue, now, warningDays)
    if (problems.unassigned) stats.unassigned += 1
    if (problems.lowPriorityNearDeadline) stats.atRisk += 1
    stats.byCategory[issue.status.category] += 1
  }
  return stats
}
