import { test, expect } from '../../testing/shared/base'
import { deadlineWindowData } from './deadline-window.data'
import { expectEdgeAtRisk, expectEdgeNotAtRisk } from './deadline-window.assertions'

test.describe('At-risk window', () => {
  test('widening the window surfaces a near-deadline issue, narrowing hides it @smoke', async ({
    app,
    target,
  }) => {
    const d = deadlineWindowData[target]
    // Pin the clock so the FIXED fixture due dates classify deterministically. It
    // stays installed across the goto/gotoAdmin navigations below.
    await app.page.clock.setFixedTime(new Date(d.now))

    // Default (narrow) app-wide window: the edge issue is just outside it → healthy.
    await app.goto()
    await expect(app.grid()).toBeVisible()
    await expectEdgeNotAtRisk(app, d)

    // Widen the app-wide window on the admin page; the default is shown there first.
    await app.gotoAdmin()
    await expect(app.deadlineWindow()).toContainText(d.narrowWindow)
    await app.setDeadlineWindow(d.wideWindow)

    // Back on the issues view the edge issue now falls inside the window: Fix button
    // appears, tally rises (the window is shared app-wide, no per-user state).
    await app.goto()
    await expect(app.grid()).toBeVisible()
    await expectEdgeAtRisk(app, d)

    // Narrow again on the admin page → on the issues view the button/tally return.
    await app.gotoAdmin()
    await app.setDeadlineWindow(d.narrowWindow)
    await app.goto()
    await expect(app.grid()).toBeVisible()
    await expectEdgeNotAtRisk(app, d)
  })

  test('the chosen window persists across a reload @smoke', async ({ app, target }) => {
    const d = deadlineWindowData[target]
    await app.gotoAdmin()

    await app.setDeadlineWindow(d.wideWindow)
    await expect(app.deadlineWindow()).toContainText(d.wideWindow)

    await app.gotoAdmin() // reload — the app-wide choice is persisted (mock localStorage)
    await expect(app.deadlineWindow()).toContainText(d.wideWindow)
  })
})
