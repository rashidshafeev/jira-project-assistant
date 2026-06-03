import { pending, type ByTarget } from '../../testing/shared/target'

export interface DeadlineWindowData {
  /**
   * Frozen "now" (ISO) the test pins the clock to, so the mock's FIXED fixture due
   * dates classify deterministically no matter when the suite runs. Chosen so the
   * `edgeIssue` sits just OUTSIDE the narrow window and INSIDE the wide one.
   */
  now: string
  /** Narrow preset label — `edgeIssue` is not yet at risk here. */
  narrowWindow: string | RegExp
  /** Wide preset label — `edgeIssue` is now at risk here. */
  wideWindow: string | RegExp
  /**
   * An ASSIGNED, low-priority issue whose only possible problem is the deadline —
   * so its Fix button toggles purely with the window (assigned ⇒ no unassigned
   * problem to keep the button alive).
   */
  edgeIssue: { id: string; key: string }
  /** At-risk tally at the narrow vs wide window (whole project). */
  atRiskNarrow: number
  atRiskWide: number
}

export const deadlineWindowData: ByTarget<DeadlineWindowData> = {
  mock: {
    // DEMO-3 (assigned, Low, due 2026-06-03) is +7.5 days out from this instant:
    // outside 7, inside 14. At-risk goes 3 → 7 between the two windows.
    now: '2026-05-26T12:00:00Z',
    narrowWindow: '7 days',
    wideWindow: '14 days',
    edgeIssue: { id: '1003', key: 'DEMO-3' },
    atRiskNarrow: 3,
    atRiskWide: 7,
  },
  jira: pending<DeadlineWindowData>('deadline-window: seed dated issues + per-site counts'),
}
