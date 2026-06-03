import { pending, type ByTarget } from '../../testing/shared/target'

export interface IssuesData {
  /** Picker option label the first project defaults to. */
  firstProject: string | RegExp
  /** An issue guaranteed present in that project (grid `data-id` + visible key). */
  knownIssue: { id: string; key: string }
  /** A known *unassigned* issue — surfaces the marker + a Fix button. */
  unassignedIssue: { id: string; key: string }
  /**
   * Frozen "now" (ISO) for the problem-markers test — pins the clock so the FIXED
   * fixture due dates classify deterministically.
   */
  now: string
  /** An issue with BOTH problems (unassigned + near deadline) → two pips. */
  bothProblemsIssue: { id: string; key: string }
  /** An ASSIGNED near-deadline issue → one (amber) pip + a time-left tooltip. */
  deadlineIssue: { id: string; key: string }
  /** The relative time-left the deadline issue's Fix tooltip should contain. */
  dueLabel: string | RegExp
}

export const issuesData: ByTarget<IssuesData> = {
  mock: {
    firstProject: /Demo Product/,
    knownIssue: { id: '1001', key: 'DEMO-1' },
    unassignedIssue: { id: '1002', key: 'DEMO-2' }, // unassigned only (no due date) → one pip
    // At this instant: DEMO-4 (unassigned + Lowest, overdue) has both problems;
    // DEMO-3 (assigned, Low, due 2026-06-03) is +2 calendar days → "Deadline in 2 days".
    now: '2026-06-01T12:00:00Z',
    bothProblemsIssue: { id: '1004', key: 'DEMO-4' },
    deadlineIssue: { id: '1003', key: 'DEMO-3' },
    dueLabel: 'Deadline in 2 days',
  },
  jira: pending<IssuesData>('issues: wire SAM1 seed values'),
}
