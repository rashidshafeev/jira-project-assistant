/**
 * Pure, framework-free issue-health rules — the SINGLE source of truth shared by
 * BOTH bundles:
 *  - the frontend re-exports it (`entities/issue/model/problem.ts` →
 *    `@domain/problem`), so the table, the issue-context panel, and the Fix dialog
 *    all classify identically;
 *  - the backend notification engines (`src/sweep.ts` + `src/events.ts`) import it,
 *    so the email's "why" is computed by the exact same code the UI shows.
 *
 * Lives beside the other shared backend contracts (`types.ts` wire shapes,
 * `result.ts` error envelope) that the frontend already pulls in via the
 * `@types`/`@result` aliases. UNLIKE those two, this ships *runtime code* (not
 * type-only), so it's bundled into both outputs — it must stay dependency-free and
 * valid under both tsconfigs (backend NodeNext + frontend bundler/verbatim). It
 * deliberately imports nothing: it defines the minimal {@link ProblemInput} shape
 * it reasons over, which both the UI `Issue` DTO and the backend's raw-issue
 * projection satisfy structurally. See docs/forge-gotchas.md
 * ("The rules have to leave the frontend").
 *
 * The two problem classes from the brief:
 *  - `unassigned`              → issue has no assignee (🔴)
 *  - `lowPriorityNearDeadline` → low priority AND the due date is within the
 *                                warning window (or already overdue) (🟡)
 */

/**
 * The minimal issue projection the rules read. Kept structural (not the full UI
 * DTO) so both the frontend `Issue` (`assignee: Member | null`, `priority:
 * IssuePriority | null`, `dueDate: string | null`) and the backend's raw-issue
 * projection (`assignee: JiraUser | null`, `priority: <name> | null`,
 * `dueDate: <duedate> | null`) are assignable to it without importing either.
 */
export interface ProblemInput {
  /** Any object = assigned; `null` = unassigned. */
  assignee: object | null
  /** Priority *name* (`'Low'`/`'Lowest'`/…), or `null` when the issue has none. */
  priority: string | null
  /** ISO date `yyyy-mm-dd`, or `null` when no due date is set. */
  dueDate: string | null
}

export interface IssueProblems {
  unassigned: boolean
  lowPriorityNearDeadline: boolean
}

/** Priority names that count as "low" for the near-deadline rule. */
const LOW_PRIORITIES: ReadonlySet<string> = new Set(['Low', 'Lowest'])

/**
 * Default "approaching deadline" window in days. A due date this many days out
 * (or sooner, incl. overdue) counts as "approaching". The effective window is the
 * app-wide config value an admin sets (`src/config.ts` / the frontend `app-config`
 * feature); this is the fallback when none is stored.
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
  issue: ProblemInput,
  now: Date,
  warningDays: number = DEADLINE_WARNING_DAYS,
): IssueProblems {
  const unassigned = issue.assignee === null

  // A null priority is "not low", so it never qualifies.
  const isLow = issue.priority !== null && LOW_PRIORITIES.has(issue.priority)
  const days = dueInDays(issue.dueDate, now)
  const lowPriorityNearDeadline = isLow && days !== null && days <= warningDays

  return { unassigned, lowPriorityNearDeadline }
}

export function hasProblem(problems: IssueProblems): boolean {
  return problems.unassigned || problems.lowPriorityNearDeadline
}
