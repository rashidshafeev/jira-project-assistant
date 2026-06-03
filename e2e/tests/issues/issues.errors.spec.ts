import { test, expect } from '../../testing/shared/base'
import { issuesData } from './issues.data'
import { expectForbiddenAlert, expectIssuesRecovered } from './issues.assertions'

/**
 * Error cases for the issues-load flow — co-located with its happy-path spec because
 * the error IS part of that flow. They drive the mock's deterministic fault injection
 * (`?fault=` / `window.__mock`), which has no real-Jira equivalent — hence @mock-only
 * (the `jira` lane greps @smoke and skips these). They prove the error code reaches the
 * user as a localized message and that Retry recovers. A non-retryable code
 * (`forbidden`) is used so the error surfaces immediately, before TanStack Query's
 * auto-retry/backoff. Reuses the flow's mock data (no separate data file). See
 * docs/testing.md → "Error cases live with their flow".
 */
test.describe('Issues load errors @mock-only', () => {
  test('surfaces the localized permission message when issues fail to load', async ({ app }) => {
    await app.goto('?fault=getIssues:forbidden')

    await expectForbiddenAlert(app)
  })

  test('Retry refetches and recovers once the fault clears', async ({ app }) => {
    await app.goto('?fault=getIssues:forbidden')
    await expect(app.alert()).toBeVisible()

    await app.clearMockFault('getIssues')
    await app.retryButton().click()

    await expectIssuesRecovered(app, issuesData.mock)
  })
})
