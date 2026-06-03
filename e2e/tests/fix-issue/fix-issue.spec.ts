import { test, expect } from '../../testing/shared/base'
import { fixIssueData } from './fix-issue.data'
import {
  expectFixDialogFor,
  expectAssignedAndResolved,
  expectPriorityRaisedAndResolved,
} from './fix-issue.assertions'

test('assigns an unassigned issue from the Fix dialog @smoke', async ({ app, target }) => {
  const d = fixIssueData[target]
  await app.goto()

  await app.fixButton(d.unassignedIssue.id).click()
  await expectFixDialogFor(app, d.unassignedIssue.key)

  await app.chooseAssignee(d.assignableMember)
  await app.assignSubmit().click()

  await expectAssignedAndResolved(app, d)
})

test('raising priority on a near-deadline issue resolves it @smoke', async ({ app, target }) => {
  const d = fixIssueData[target]
  // Pin the clock so the near-deadline classification is deterministic.
  await app.page.clock.setFixedTime(new Date(d.now))
  await app.goto()
  await expect(app.grid()).toBeVisible()
  await expect(app.stat('atRisk')).toHaveText(String(d.atRiskBefore))

  await app.fixButton(d.raiseIssue.id).click()
  await expectFixDialogFor(app, d.raiseIssue.key)

  await app.raisePriority(d.raiseTo).click()

  await expectPriorityRaisedAndResolved(app, d)
})
