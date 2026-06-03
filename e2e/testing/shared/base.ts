import { test as base, expect } from '@playwright/test'
import { AppPage } from './app-page'
import type { TargetName } from './target'
import { mockTarget } from '../mock/target'
import { jiraTarget } from '../jira/target'

/**
 * The shared test base every spec imports (instead of `@playwright/test`). It wires
 * two fixtures so the spec bodies stay target-agnostic:
 *
 *  - `target` — which run target this is (`mock` | `jira`), derived from the
 *    Playwright project name. Specs read their own per-target data with it:
 *    `const d = myData[target]` (or `forTarget(target, myData)`).
 *  - `app` — the page object, already rooted for the active target (the `Page` for
 *    mock, the Forge `frameLocator` for jira). Specs never construct it themselves.
 *
 * Per-target *values* live next to each test (`*.data.ts`); the *foundation* (how a
 * target connects + auth/seed) lives under ../{mock,jira}. See docs/testing.md.
 */
const TARGETS = { mock: mockTarget, jira: jiraTarget } as const

export const test = base.extend<{ app: AppPage; target: TargetName }>({
  // The `jira` project drives the real site; everything else is the mock lane.
  // eslint-disable-next-line no-empty-pattern
  target: async ({}, use, testInfo) => {
    await use(testInfo.project.name === 'jira' ? 'jira' : 'mock')
  },
  app: async ({ page, target }, use) => {
    const root = TARGETS[target].root(page)
    await use(new AppPage(page, root))
  },
})

export { expect }
