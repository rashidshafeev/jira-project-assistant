import { existsSync, readFileSync, rmSync } from 'node:fs'
import { test as setup, type Browser, type Page } from '@playwright/test'

/**
 * @jira auth setup — OPT-IN. Produces an authenticated Atlassian browser session
 * (cookies + storage) at JIRA_STORAGE so the read-only `@jira` PoC can drive the real
 * app inside Jira's Forge iframe. Wired as the `jira-setup` project the `jira` lane
 * lists in `dependencies`, added ONLY when JIRA_LOGIN + JIRA_PASSWORD are set
 * (playwright.config.ts).
 *
 * It is SESSION-FIRST:
 *  1. If JIRA_STORAGE already holds a session that still authenticates, REUSE it and
 *     skip login entirely — so the (interactive) OTP is a once-every-few-weeks event,
 *     not every run.
 *  2. Otherwise log in from env creds and save a fresh session.
 *
 * The login drives Atlassian's centralized id.atlassian.com flow and handles the
 * interstitials it interleaves after the password, in any order, until we land back on
 * the site: an emailed 2-step code, and the "Security review" enrol-2SV/passkey promo.
 *
 * SECURITY / LIMITS — read before relying on this:
 *  - Credentials come from JIRA_LOGIN + JIRA_PASSWORD env vars ONLY — never hardcoded,
 *    and the password is never logged. Use a dedicated TEST account.
 *  - An Atlassian *API token* is NOT a web session (it only does REST Basic auth); the
 *    Forge iframe needs a real logged-in browser session, which is what this mints.
 *  - The 2-step EMAIL code can't be read unattended, so it's an interactive hand-off,
 *    enabled ONLY when JIRA_OTP_FILE is set: the run pauses on the OTP screen and reads
 *    the code you drop into that file. A CAPTCHA / "verify it's you" / SSO/passkey
 *    redirect can NOT (and must not) be automated — the run fails fast naming where it
 *    stalled; capture the session manually then (docs/testing.md → "Real-Jira smoke").
 *  - Saved session → e2e/.auth/jira.json (gitignored, override with JIRA_STORAGE). It
 *    expires; the next run detects that and logs in again.
 *
 * Selectors are role/label/placeholder based (Atlassian's old stable ids are gone) and
 * can still drift; if so, the thrown error names the step that broke.
 */

const LOGIN = process.env.JIRA_LOGIN
const PASSWORD = process.env.JIRA_PASSWORD
const APP_URL = process.env.JIRA_APP_URL ?? ''
const AUTH_FILE = process.env.JIRA_STORAGE ?? 'e2e/.auth/jira.json'
const OTP_FILE = process.env.JIRA_OTP_FILE

setup('authenticate against Atlassian', async ({ browser }) => {
  if (!APP_URL) {
    throw new Error('[jira-setup] JIRA_APP_URL (the Project Assistant page URL) must be set.')
  }
  // Visiting the embedding site unauthenticated bounces to id.atlassian.com; a valid
  // session (or a completed login) lands back here.
  const site = new URL(APP_URL).origin
  const siteHost = new URL(APP_URL).host

  // 1. Reuse an existing saved session if it still authenticates — skips login (+ OTP).
  if (existsSync(AUTH_FILE) && (await sessionStillValid(browser, site, siteHost))) {
    // eslint-disable-next-line no-console
    console.log(`[jira-setup] Reusing the saved session at ${AUTH_FILE} (still valid).`)
    return
  }

  // 2. No usable session → we must log in, which now requires creds.
  if (!LOGIN || !PASSWORD) {
    throw new Error(
      `[jira-setup] No valid saved session at ${AUTH_FILE}, and JIRA_LOGIN / JIRA_PASSWORD ` +
        `aren't set to log in. Set them (a dedicated test account) or capture a session ` +
        `manually (docs/testing.md → "Real-Jira smoke").`,
    )
  }
  if (existsSync(AUTH_FILE)) {
    // eslint-disable-next-line no-console
    console.log(`[jira-setup] Saved session at ${AUTH_FILE} is stale — logging in again.`)
  }

  const page = await browser.newPage() // fresh context, no storageState
  // Bound every action so a stuck step fails fast (and names itself) instead of silently
  // eating the whole test timeout — project-level timeouts don't apply to a manual page.
  page.setDefaultTimeout(20_000)
  page.setDefaultNavigationTimeout(40_000)
  await page.goto(site, { waitUntil: 'domcontentloaded' })

  // --- Step 1: email / identifier, then Continue ---
  // Atlassian's login is role/label-based now (the old #username / #login-submit ids are
  // gone), so target the accessible name + placeholder — they survive markup churn.
  const emailField = page
    .getByRole('textbox', { name: /email/i })
    .or(page.getByPlaceholder(/enter your email/i))
    .first()
  await emailField.fill(LOGIN)
  await page.getByRole('button', { name: 'Continue', exact: true }).click()

  // --- Step 2: password (a password <input> has no "textbox" ARIA role) ---
  // If it never appears, the account is SSO/passkey or hit a challenge — surface that
  // immediately rather than hanging out the navigation timeout.
  const passwordField = page
    .getByLabel(/password/i)
    .or(page.locator('input[type="password"]'))
    .first()
  try {
    await passwordField.waitFor({ state: 'visible', timeout: 15_000 })
  } catch {
    throw new Error(
      `[jira-setup] Password field never appeared after the email step — the account is ` +
        `likely SSO/passkey or hit a challenge (auto-login supports only a password account). ` +
        `${await detectBlocker(page)} URL: ${page.url()}. Capture the session manually ` +
        `instead (docs/testing.md → "Real-Jira smoke").`,
    )
  }
  await passwordField.fill(PASSWORD)
  // The submit is "Log in" (older) or "Continue" (current); anchor with ^…$ so we never
  // grab an "Or continue with: <provider>" SSO/passkey button.
  await page.getByRole('button', { name: /^(log ?in|continue)$/i }).click()

  // --- Step 3: clear whatever interstitials appear, then land on the site ---
  await resolvePostPassword(page, siteHost)

  await page.context().storageState({ path: AUTH_FILE })
  await page.close()
})

/**
 * Probe the saved session: load it into a throwaway context, hit the site, and see
 * whether we stay authenticated (on the site host) or get bounced to id.atlassian.com
 * (expired). Returns false on any error (e.g. unreadable storageState).
 */
async function sessionStillValid(browser: Browser, site: string, siteHost: string): Promise<boolean> {
  let ctx
  try {
    ctx = await browser.newContext({ storageState: AUTH_FILE })
    const probe = await ctx.newPage()
    await probe.goto(site, { waitUntil: 'domcontentloaded' }).catch(() => {})
    const deadline = Date.now() + 8_000
    while (Date.now() < deadline) {
      const host = hostOf(probe)
      if (host.endsWith(siteHost)) return true // still authenticated on the site
      if (host.includes('id.atlassian.com')) return false // bounced to login → expired
      await probe.waitForTimeout(500)
    }
    return hostOf(probe).endsWith(siteHost)
  } catch {
    return false
  } finally {
    await ctx?.close()
  }
}

/**
 * After the password, Atlassian may interleave (in either order) an emailed 2-step code
 * and a "Security review" enrol-2SV/passkey promo before redirecting to the site. Loop,
 * handling whatever screen is up, until we reach the site host (or time out).
 */
async function resolvePostPassword(page: Page, siteHost: string): Promise<void> {
  const otpBoxes = page.getByRole('textbox', { name: /OTP character/i })
  const declineMfa = page.getByRole('button', { name: /continue without two-step verification/i })
  const passwordField = page.getByLabel(/password/i).or(page.locator('input[type="password"]')).first()

  const deadline = Date.now() + 90_000
  let passwordStreak = 0
  let lastHost = ''
  while (Date.now() < deadline) {
    const host = hostOf(page)
    if (host !== lastHost) {
      // eslint-disable-next-line no-console
      console.log(`[jira-setup] now at: ${page.url()}`)
      lastHost = host
    }
    if (host.endsWith(siteHost)) return // ✓ landed on the embedding site

    // a) emailed 2-step code (six single-character boxes)
    if (await otpBoxes.first().isVisible().catch(() => false)) {
      if (!OTP_FILE) {
        throw new Error(
          `[jira-setup] This account requires a 2-step email code, which can't be read ` +
            `unattended. Re-run with JIRA_OTP_FILE pointing at a file and write the ` +
            `6-character code into it when the email arrives (docs/testing.md → ` +
            `"Real-Jira smoke"), or capture the session manually. URL: ${page.url()}.`,
        )
      }
      const code = await waitForOtpCode(OTP_FILE)
      for (let i = 0; i < 6; i++) await otpBoxes.nth(i).fill(code[i] ?? '')
      // The 6-box code AUTO-SUBMITS on the final character; clicking Verify is only a
      // fallback and must tolerate the button already being gone (page is navigating).
      await page.getByRole('button', { name: 'Verify', exact: true }).click({ timeout: 5_000 }).catch(() => {})
      passwordStreak = 0
      await page.waitForTimeout(1_500)
      continue
    }

    // b) "Security review" promo (enrol in 2SV / create a passkey) → decline to proceed
    if (await declineMfa.isVisible().catch(() => false)) {
      await declineMfa.click({ timeout: 10_000 }).catch(() => {})
      passwordStreak = 0
      await page.waitForTimeout(1_500)
      continue
    }

    // c) stuck on the password screen for several cycles → almost certainly bad creds
    if (await passwordField.isVisible().catch(() => false)) {
      if (++passwordStreak >= 4) {
        throw new Error(
          `[jira-setup] Still on the password screen — JIRA_LOGIN / JIRA_PASSWORD may be ` +
            `wrong. ${await detectBlocker(page)} URL: ${page.url()}.`,
        )
      }
    } else {
      passwordStreak = 0
    }

    await page.waitForTimeout(1_000)
  }

  // We may have navigated to the site during the final action — check before giving up.
  if (hostOf(page).endsWith(siteHost)) return
  throw new Error(
    `[jira-setup] Login didn't reach ${siteHost} within 90s. ${await detectBlocker(page)} ` +
      `URL: ${page.url()}. A CAPTCHA / SSO / unexpected challenge can't be automated — ` +
      `capture the session manually (docs/testing.md → "Real-Jira smoke").`,
  )
}

/**
 * Pause for an interactively-supplied 2-step code. Polls JIRA_OTP_FILE until it holds a
 * 6-character alphanumeric code (you write it when Atlassian's email arrives), then
 * consumes the file. The code is never logged. Date.now()/setTimeout are fine here —
 * this is a normal Playwright test, not a constrained workflow script.
 */
async function waitForOtpCode(file: string): Promise<string> {
  // Drop any stale code so we only accept one written AFTER we start waiting.
  if (existsSync(file)) {
    try {
      rmSync(file)
    } catch {
      /* best effort */
    }
  }
  // eslint-disable-next-line no-console
  console.log(
    `\n[jira-setup] ⏳ Atlassian emailed a 6-character code. Write it to "${file}" to continue,\n` +
      `             e.g.  echo ABC123 > ${file}\n`,
  )
  const deadline = Date.now() + 300_000 // 5 min to fetch the code from your inbox
  while (Date.now() < deadline) {
    if (existsSync(file)) {
      // Atlassian's email code is 6 alphanumeric chars (e.g. "WQPTVF"), not just digits.
      const code = readFileSync(file, 'utf8').trim().toUpperCase()
      if (/^[A-Z0-9]{6}$/.test(code)) {
        try {
          rmSync(file)
        } catch {
          /* best effort */
        }
        return code
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 2_000))
  }
  throw new Error(`[jira-setup] Timed out (5 min) waiting for a 6-character OTP in ${file}.`)
}

/** Current page host, or '' if the URL isn't parseable (e.g. about:blank mid-navigation). */
function hostOf(page: Page): string {
  try {
    return new URL(page.url()).host
  } catch {
    return ''
  }
}

/** Best-effort hint about why login stalled. Inspects URL + visible text only — never logs secrets. */
async function detectBlocker(page: Page): Promise<string> {
  const url = page.url()
  if (/two[-_]?step|mfa|\botp\b|verification/i.test(url))
    return 'Looks like a 2-step verification (OTP) screen.'
  if (/okta|microsoftonline|accounts\.google|saml|auth0/i.test(url))
    return 'Looks like an external SSO / IdP redirect.'
  const body = (await page.locator('body').textContent({ timeout: 1_000 }).catch(() => '')) ?? ''
  if (/one-time passcode|enter the code|verify (your|it'?s) you/i.test(body))
    return 'A "verify it\'s you" / one-time-passcode challenge is shown.'
  if (/captcha|recaptcha|are you a (robot|human)/i.test(body)) return 'A CAPTCHA / bot check is shown.'
  if (/incorrect|couldn'?t (log|sign) you in|wrong password/i.test(body))
    return 'The credentials may be wrong.'
  return 'Reason unknown (could be MFA, a challenge, or a slow network).'
}
