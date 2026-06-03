import { test, expect } from '../../testing/shared/base'
import { issuesData } from './issues.data'
import {
  expectDefaultProjectLoaded,
  expectUnassignedSurfaced,
  expectProblemMarkers,
} from './issues.assertions'

test.describe('Issues table', () => {
  test('lists the default project issues @smoke', async ({ app, target }) => {
    const d = issuesData[target]
    await app.goto()

    await expectDefaultProjectLoaded(app, d)
    await expectUnassignedSurfaced(app, d)
  })

  test('surfaces problem markers — pips and time-left @smoke', async ({ app, target }) => {
    const d = issuesData[target]
    // Pin the clock so the FIXED fixture due dates classify deterministically.
    await app.page.clock.setFixedTime(new Date(d.now))
    await app.goto()
    await expect(app.grid()).toBeVisible()

    await expectProblemMarkers(app, d)
  })
})
