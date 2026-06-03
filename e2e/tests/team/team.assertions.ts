import { expect } from '../../testing/shared/base'
import type { AppPage } from '../../testing/shared/app-page'
import type { TeamData } from './team.data'

/**
 * The team grid lists the expected member, and the inactive member shows the
 * localized "Inactive" chip. NOTE: "Inactive" is English-locale (fine for mock; the
 * jira @smoke lane keys this off a test-id / localized value — see docs/testing.md).
 */
export async function expectTeamListed(app: AppPage, d: TeamData): Promise<void> {
  await expect(app.grid()).toBeVisible()
  await expect(app.text(d.teamMember, { exact: true })).toBeVisible()
  await expect(app.text('Inactive', { exact: true }).first()).toBeVisible()
}
