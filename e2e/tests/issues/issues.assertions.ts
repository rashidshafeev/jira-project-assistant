import { expect } from '../../testing/shared/base'
import type { AppPage } from '../../testing/shared/app-page'
import type { IssuesData } from './issues.data'

/** The picker defaulted to the first project and its grid populated with a known issue. */
export async function expectDefaultProjectLoaded(app: AppPage, d: IssuesData): Promise<void> {
  await expect(app.projectPicker()).toContainText(d.firstProject)
  await expect(app.grid()).toBeVisible()
  await expect(app.row(d.knownIssue.id)).toContainText(d.knownIssue.key)
}

/**
 * A problematic (unassigned) issue surfaces its marker + a Fix action. NOTE: the
 * "Unassigned" marker text is English-locale (fine for mock; the jira @smoke lane
 * keys this off a test-id / localized value — see docs/testing.md).
 */
export async function expectUnassignedSurfaced(app: AppPage, d: IssuesData): Promise<void> {
  await expect(app.row(d.unassignedIssue.id)).toContainText('Unassigned')
  await expect(app.fixButton(d.unassignedIssue.id)).toBeVisible()
}

/**
 * Problem markers: a both-problems row shows two pips (red unassigned + amber
 * near-deadline); an unassigned-only row shows just the red one; and a near-
 * deadline issue's Fix tooltip spells out the real time-left.
 */
export async function expectProblemMarkers(app: AppPage, d: IssuesData): Promise<void> {
  // Unassigned only → red pip, no amber pip.
  await expect(app.pip(d.unassignedIssue.id, 'error')).toHaveCount(1)
  await expect(app.pip(d.unassignedIssue.id, 'warning')).toHaveCount(0)

  // Both problems → both pips side by side.
  await expect(app.pip(d.bothProblemsIssue.id, 'error')).toHaveCount(1)
  await expect(app.pip(d.bothProblemsIssue.id, 'warning')).toHaveCount(1)

  // Near-deadline issue → the Fix tooltip shows the relative time-left.
  await app.fixButton(d.deadlineIssue.id).hover()
  await expect(app.tooltip()).toContainText(d.dueLabel)
}

// ── Error path (used by issues.errors.spec.ts, @mock-only) ──────────────────────

/**
 * A forbidden read surfaces as a localized permission message + a Retry. The alert
 * surface is generic (any flow's read error looks like this), so if other flows grow
 * their own `*.errors.spec.ts` this helper is the candidate to lift to testing/shared.
 */
export async function expectForbiddenAlert(app: AppPage): Promise<void> {
  await expect(app.alert()).toContainText("You don't have permission to do that.")
  await expect(app.retryButton()).toBeVisible()
}

/** After the fault clears + Retry: the grid reloads with the known issue. */
export async function expectIssuesRecovered(app: AppPage, d: IssuesData): Promise<void> {
  await expect(app.grid()).toBeVisible()
  await expect(app.row(d.knownIssue.id)).toContainText(d.knownIssue.key)
}
