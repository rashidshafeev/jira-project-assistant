import type { Page } from '@playwright/test'
import type { Target } from '../shared/target'

/**
 * The `jira` target: the real deployed app, which runs inside a cross-origin Forge
 * iframe — so the query root is a `frameLocator`, not the page. Auth is a separate
 * concern handled by the `jira-setup` project (./auth.setup.ts), which mints the
 * `storageState` this lane loads.
 *
 * Best-effort default for the app iframe; override per-site with JIRA_APP_FRAME.
 * Covers the deployed Forge CDN and the live-dev tunnel (localhost) cases. Forge
 * Custom UI can be double-nested (outer container + app iframe); if so, chain a
 * second `frameLocator` here.
 */
const FRAME =
  process.env.JIRA_APP_FRAME ?? 'iframe[src*="atlassian-dev.net"], iframe[src*="localhost"]'

export const jiraTarget: Target = {
  name: 'jira',
  root: (page: Page) => page.frameLocator(FRAME),

  // Seed/teardown for the full @smoke-against-real-Jira lane is future work: create
  // the fixture issues/members via REST before the run, delete them after (this
  // WRITES to the live site). Today only the read-only @jira PoC runs, which needs
  // no seed. See docs/testing.md → "Promoting to the full dual-target lane".
  // async seed() { /* REST seed */ return async () => { /* REST cleanup */ } },
}
