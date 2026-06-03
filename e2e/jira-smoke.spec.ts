import { test, expect } from '@playwright/test'

/**
 * @jira — Real-Jira proof of concept. OPT-IN and read-only.
 *
 * It runs ONLY in the `jira` project (added when `JIRA_APP_URL` is set) and is
 * excluded from the mock lane (the `mock` project uses `grepInvert: /@jira/`), so
 * `npm test` is unaffected. It proves the one genuinely novel piece of a real-Jira
 * lane: that Playwright can drive the REAL app — inside Jira's cross-origin Forge
 * iframe — against live data. It deliberately skips seeding; it only asserts the app
 * rendered, and never creates or modifies Jira data.
 *
 * One-time setup + run (full detail in docs/testing.md → "Real-Jira smoke: proof of concept"):
 *
 *   # 1. Authenticate the lane (the iframe needs a real web session, not an API token).
 *   #    The jira-setup project is session-first: it reuses e2e/.auth/jira.json while valid
 *   #    and only logs in when it's missing/expired (see e2e/testing/jira/auth.setup.ts). To log in:
 *   #    a) set JIRA_LOGIN + JIRA_PASSWORD (dedicated test account); it clears the
 *   #       "Security review" promo and, if challenged, takes an emailed 2-step code via an
 *   #       interactive hand-off — set JIRA_OTP_FILE, then `echo CODE > e2e/.auth/otp.txt`. OR
 *   #    b) manual capture (CAPTCHA/SSO) — the script never sees the password:
 *   #       npx playwright codegen https://<site>.atlassian.net --save-storage=e2e/.auth/jira.json
 *
 *   # 2. Open the Project Assistant page in Jira, copy its WHOLE URL from the address
 *   #    bar (.../projects/<KEY>/apps/<app-id>/<route-id> — two UUIDs), point the lane at it:
 *   JIRA_APP_URL="https://<site>.atlassian.net/jira/software/projects/<KEY>/apps/<app-id>/<route-id>" \
 *     npx playwright test --project=jira
 *
 * The app lives in a cross-origin Forge iframe. The first run logs every frame URL
 * (see console). If the grid assertion times out, identify the app's iframe from
 * that list and pass its selector as JIRA_APP_FRAME — e.g.
 *   JIRA_APP_FRAME='iframe[title="Project Assistant"]' ...
 * Forge Custom UI can be double-nested (an outer container iframe + the app iframe);
 * if so, chain frameLocator: page.frameLocator(outer).frameLocator(inner).
 */

// `jira` runs only when JIRA_APP_URL is set, so this is defined at run time.
const APP_URL = process.env.JIRA_APP_URL ?? ''

// Best-effort default for the app iframe; override per-site with JIRA_APP_FRAME.
// Covers the deployed Forge CDN and the tunnel (localhost) cases.
const FRAME = process.env.JIRA_APP_FRAME ?? 'iframe[src*="atlassian-dev.net"], iframe[src*="localhost"]'

test('@jira app renders its issues grid inside the Forge iframe', async ({ page }) => {
  await page.goto(APP_URL)
  // Real Jira holds long-lived connections open, so 'networkidle' may never settle —
  // wait for the DOM and let the grid locator below auto-wait for the async render.
  await page.waitForLoadState('domcontentloaded')

  // Diagnostic: list the page's frames so the app iframe is easy to identify on a
  // first run (then set JIRA_APP_FRAME if the default selector didn't match).
  // eslint-disable-next-line no-console
  console.log('[jira-poc] frames on page:\n' + page.frames().map((f) => '  ' + f.url()).join('\n'))

  // The app shell = the control-panel project picker + the issues data grid.
  // Asserting the grid is visible proves: iframe reached, real bridge → resolver →
  // real Jira round-trip succeeded, and the UI rendered the live data.
  const app = page.frameLocator(FRAME)
  await expect(app.getByRole('grid')).toBeVisible({ timeout: 30_000 })
})
