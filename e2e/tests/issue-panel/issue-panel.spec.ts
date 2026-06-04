import { test, expect } from '../../testing/shared/base'
import { issuePanelData } from './issue-panel.data'
import { expectFlaggedPanel, expectResolvedPanel } from './issue-panel.assertions'

/**
 * The `jira:issueContext` view, mock lane. In the mock the panel is opened by the
 * `?panel=KEY` URL (in Forge it's the host issue from the context). The flow proves
 * the panel reuses the assistant's two pieces in-context: it flags the issue with
 * the same problem rules, and fixes it through the same Fix form — rendered inline
 * here (not a dialog) — then reflects the write.
 */
test('issue panel flags a problem issue and fixes it in context @smoke', async ({
  app,
  target,
}) => {
  const d = issuePanelData[target]
  await app.goto(`?panel=${d.flaggedIssue.key}`)

  await expectFlaggedPanel(app, d.flaggedIssue.key)

  // Reuses the shared Fix form (assign remedy) — expanded inline in the panel here.
  await app.panelFixButton().click()
  await expect(app.panelFix()).toContainText(`Fix ${d.flaggedIssue.key}`)
  await app.chooseAssignee(d.assignableMember)
  await app.assignSubmit().click()

  await expectResolvedPanel(app, d)
})
