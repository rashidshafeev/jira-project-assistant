import { pending, type ByTarget } from '../../testing/shared/target'

export interface FixIssueData {
  /** A known *unassigned* issue — has a Fix button that opens the assign flow. */
  unassignedIssue: { id: string; key: string }
  /** An active member the Fix dialog can assign to. */
  assignableMember: string
  /**
   * Frozen "now" (ISO) for the raise-priority case — pins the clock so the FIXED
   * fixture due dates classify deterministically (the raise issue must be at risk
   * at the default window for this instant).
   */
  now: string
  /**
   * An ASSIGNED, low-priority, near-deadline issue — its only problem is the
   * deadline, so raising its priority fully resolves it (button disappears).
   */
  raiseIssue: { id: string; key: string }
  /** Priority to raise it to (a "Raise to <priority>" button in the dialog). */
  raiseTo: string
  /** At-risk tally before/after the raise (the resolved issue drops out). */
  atRiskBefore: number
  atRiskAfter: number
}

export const fixIssueData: ByTarget<FixIssueData> = {
  mock: {
    unassignedIssue: { id: '1002', key: 'DEMO-2' },
    assignableMember: 'Anna Ivanova',
    // DEMO-3 (assigned, Low, due 2026-06-03) is +1.5 days out from this instant →
    // at risk at the default 7-day window; raising it drops at-risk 7 → 6.
    now: '2026-06-01T12:00:00Z',
    raiseIssue: { id: '1003', key: 'DEMO-3' },
    raiseTo: 'High',
    atRiskBefore: 7,
    atRiskAfter: 6,
  },
  jira: pending<FixIssueData>('fix-issue: wire SAM1 seed values + REST seed/teardown'),
}
