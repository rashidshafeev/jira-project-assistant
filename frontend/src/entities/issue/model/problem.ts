/**
 * The problem-detection rules used across the UI (the table highlight, the
 * control-panel stats, the issue-context verdict, the Fix dialog).
 *
 * These are NOT defined here — the canonical source is the framework-free
 * `src/domain/problem.ts` (`@domain/problem`), a single module imported by BOTH
 * this frontend AND the backend notification sweep (`src/sweep.ts`), so the rows,
 * the panel, and the notification email can never disagree. This file just
 * re-exports it under the FSD `entities/issue` slice so callers keep importing from
 * `@/entities/issue`. See docs/forge-gotchas.md ("The rules have to leave the
 * frontend").
 *
 * The frontend `Issue` DTO satisfies the rules' `ProblemInput` shape structurally
 * (`assignee`/`priority`/`dueDate`), so `detectProblems(issue, …)` still typechecks
 * with an `Issue`.
 */
export {
  detectProblems,
  hasProblem,
  dueInDays,
  DEADLINE_WARNING_DAYS,
} from '@domain/problem'
export type { IssueProblems, ProblemInput } from '@domain/problem'
