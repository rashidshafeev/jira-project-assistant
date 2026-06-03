import { expect } from '../../testing/shared/base'
import type { AppPage } from '../../testing/shared/app-page'

/** Brief §3 requires a confirmation step for the bulk action. */
export async function expectConfirmPrompt(app: AppPage): Promise<void> {
  await expect(app.dialog()).toContainText('Auto-assign unassigned issues')
}

/**
 * After confirming: a success toast, and the action empties out — nothing left to
 * assign. NOTE: the toast copy is English-locale (fine for mock; the jira @smoke
 * lane keys these off test-ids — see docs/testing.md).
 */
export async function expectAllAssigned(app: AppPage): Promise<void> {
  await expect(app.text(/Assigned \d+ issue/)).toBeVisible()
  await expect(app.autoAssignButton()).toBeDisabled()
}
