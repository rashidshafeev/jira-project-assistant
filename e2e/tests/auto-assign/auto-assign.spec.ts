import { test, expect } from '../../testing/shared/base'
import { expectConfirmPrompt, expectAllAssigned } from './auto-assign.assertions'

// No per-target data file: this flow asserts only on the bulk action's own UI
// (the count-bearing button + confirm + toast), not on specific seeded values.
test('bulk auto-assigns all unassigned issues @smoke', async ({ app }) => {
  await app.goto()

  // The label carries the unassigned count; the action is enabled when > 0.
  const trigger = app.autoAssignButton()
  await expect(trigger).toBeEnabled()
  await trigger.click()

  await expectConfirmPrompt(app)
  await app.confirmAutoAssign().click()

  await expectAllAssigned(app)
})
