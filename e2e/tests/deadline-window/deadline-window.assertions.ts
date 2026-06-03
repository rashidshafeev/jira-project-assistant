import { expect } from '../../testing/shared/base'
import type { AppPage } from '../../testing/shared/app-page'
import type { DeadlineWindowData } from './deadline-window.data'

/** At the narrow window the edge issue is healthy: no Fix button, the lower tally. */
export async function expectEdgeNotAtRisk(app: AppPage, d: DeadlineWindowData): Promise<void> {
  await expect(app.stat('atRisk')).toHaveText(String(d.atRiskNarrow))
  // Assert the row IS rendered before asserting it has no button — otherwise a
  // virtualized-out row would make `toHaveCount(0)` a false pass.
  await expect(app.row(d.edgeIssue.id)).toBeVisible()
  await expect(app.fixButton(d.edgeIssue.id)).toHaveCount(0)
}

/** At the wide window the edge issue is at risk: its Fix button shows, tally rises. */
export async function expectEdgeAtRisk(app: AppPage, d: DeadlineWindowData): Promise<void> {
  await expect(app.stat('atRisk')).toHaveText(String(d.atRiskWide))
  await expect(app.fixButton(d.edgeIssue.id)).toBeVisible()
}
