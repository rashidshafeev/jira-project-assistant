import { test } from '../../testing/shared/base'
import { teamData } from './team.data'
import { expectTeamListed } from './team.assertions'

test('shows the project team with member rows @smoke', async ({ app, target }) => {
  await app.goto()
  await app.openTab('Team')

  await expectTeamListed(app, teamData[target])
})
