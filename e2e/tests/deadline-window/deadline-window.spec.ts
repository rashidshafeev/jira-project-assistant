import { test, expect } from '../../testing/shared/base'
import { deadlineWindowData } from './deadline-window.data'
import { expectEdgeAtRisk, expectEdgeNotAtRisk } from './deadline-window.assertions'

test.describe('At-risk window', () => {
  test('widening the window surfaces a near-deadline issue, narrowing hides it @smoke', async ({
    app,
    target,
  }) => {
    const d = deadlineWindowData[target]
    // Pin the clock so the FIXED fixture due dates classify deterministically.
    await app.page.clock.setFixedTime(new Date(d.now))
    await app.goto()
    await expect(app.grid()).toBeVisible()

    // Default (narrow) window: the edge issue is just outside it → healthy.
    await expect(app.deadlineWindow()).toContainText(d.narrowWindow)
    await expectEdgeNotAtRisk(app, d)

    // Widen → the edge issue falls inside the window: Fix button appears, tally rises.
    await app.setDeadlineWindow(d.wideWindow)
    await expectEdgeAtRisk(app, d)

    // Narrow again → the button disappears and the tally returns.
    await app.setDeadlineWindow(d.narrowWindow)
    await expectEdgeNotAtRisk(app, d)
  })

  test('the chosen window persists across a reload @smoke', async ({ app, target }) => {
    const d = deadlineWindowData[target]
    await app.goto()
    await expect(app.grid()).toBeVisible()

    await app.setDeadlineWindow(d.wideWindow)
    await expect(app.deadlineWindow()).toContainText(d.wideWindow)

    await app.goto() // reload — the per-user choice is persisted (mock localStorage)
    await expect(app.grid()).toBeVisible()
    await expect(app.deadlineWindow()).toContainText(d.wideWindow)
  })
})
