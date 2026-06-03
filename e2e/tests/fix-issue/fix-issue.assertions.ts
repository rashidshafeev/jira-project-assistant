import { expect } from '../../testing/shared/base'
import type { AppPage } from '../../testing/shared/app-page'
import type { FixIssueData } from './fix-issue.data'

/** The Fix dialog opened on the right issue. */
export async function expectFixDialogFor(app: AppPage, key: string): Promise<void> {
  await expect(app.dialog()).toContainText(`Fix ${key}`)
}

/**
 * After assigning: the dialog closes and the row shows the new assignee — so the
 * problem (its Fix button + "Unassigned" marker) is resolved.
 */
export async function expectAssignedAndResolved(app: AppPage, d: FixIssueData): Promise<void> {
  await expect(app.dialog()).toBeHidden()
  await expect(app.row(d.unassignedIssue.id)).toContainText(d.assignableMember)
  await expect(app.fixButton(d.unassignedIssue.id)).toHaveCount(0)
}

/**
 * After raising priority on a near-deadline issue: the dialog closes, the issue is
 * no longer at risk (its Fix button is gone), and the at-risk tally drops by one.
 */
export async function expectPriorityRaisedAndResolved(
  app: AppPage,
  d: FixIssueData,
): Promise<void> {
  await expect(app.dialog()).toBeHidden()
  // Row stays rendered (top of the grid) — so "no button" means resolved, not
  // virtualized away.
  await expect(app.row(d.raiseIssue.id)).toBeVisible()
  await expect(app.fixButton(d.raiseIssue.id)).toHaveCount(0)
  await expect(app.stat('atRisk')).toHaveText(String(d.atRiskAfter))
}
