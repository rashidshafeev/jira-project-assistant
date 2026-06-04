/**
 * The problem-detection rules used across the UI (the table highlight, the
 * control-panel stats, the issue-context verdict, the Fix dialog).
 *
 * These are NOT defined here — the canonical source is the framework-free
 * `src/domain/problem.ts` (`@domain/problem`), a single module so that any
 * server-side job that must classify issues can import the *same* rules instead
 * of duplicating them, and the rows, the panel, and the verdict can never
 * disagree. This file just re-exports it under the FSD `entities/issue` slice so
 * callers keep importing from `@/entities/issue`. See docs/architecture.md
 * ("shared domain rules").
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
