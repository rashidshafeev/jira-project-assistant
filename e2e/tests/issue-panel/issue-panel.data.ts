import { pending, type ByTarget } from '../../testing/shared/target'

export interface IssuePanelData {
  /**
   * A flagged issue to open the panel on. Chosen so its ONLY problem is being
   * unassigned (priority Medium, no due date) — clock-independent, so assigning a
   * member fully resolves it and the panel flips to "healthy" deterministically.
   */
  flaggedIssue: { key: string }
  /** An active member the Fix dialog can assign to. */
  assignableMember: string
}

export const issuePanelData: ByTarget<IssuePanelData> = {
  mock: {
    flaggedIssue: { key: 'DEMO-2' },
    assignableMember: 'Anna Ivanova',
  },
  jira: pending<IssuePanelData>(
    'issue-panel: wire panel-iframe selectors + a seeded issue key + REST seed/teardown',
  ),
}
