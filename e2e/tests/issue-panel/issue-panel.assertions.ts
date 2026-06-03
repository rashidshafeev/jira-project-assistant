import { expect } from '../../testing/shared/base'
import type { AppPage } from '../../testing/shared/app-page'
import type { IssuePanelData } from './issue-panel.data'

/** The panel rendered for the right issue, flagged and offering a Fix. */
export async function expectFlaggedPanel(app: AppPage, key: string): Promise<void> {
  await expect(app.text(key)).toBeVisible()
  await expect(app.panelFlagged()).toBeVisible()
  await expect(app.panelFixButton()).toBeVisible()
}

/**
 * After assigning from the panel: the dialog closes, the issue re-reads, its only
 * problem is gone (panel flips to "healthy", Fix button disappears), and the new
 * assignee is shown — so the panel reflects the write, not stale cached state.
 */
export async function expectResolvedPanel(app: AppPage, d: IssuePanelData): Promise<void> {
  await expect(app.dialog()).toBeHidden()
  await expect(app.panelHealthy()).toBeVisible()
  await expect(app.panelFixButton()).toHaveCount(0)
  await expect(app.text(d.assignableMember)).toBeVisible()
}
