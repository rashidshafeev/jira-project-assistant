import { defineConfig, devices } from '@playwright/test'

/**
 * E2E config. The default (and only CI) target is **`mock`**: it boots the
 * standalone frontend with the in-memory mock transport (`npm run dev:mock`,
 * `VITE_USE_MOCKS=true`), so the whole suite is deterministic and needs no Jira
 * site, account, or network.
 *
 * The **`jira`** target is opt-in: it appears only when `JIRA_APP_URL` is set, so
 * the default `npm test` stays mock-only. Today it runs the read-only `@jira`
 * proof-of-concept spec (drives the real app inside the cross-origin Forge iframe);
 * the full `@smoke`-against-real-Jira lane additionally needs the page objects
 * parametrized by a frame root + a REST seed/teardown. See docs/testing.md
 * → "Real-Jira smoke: proof of concept". The suite is authored to support it: page
 * objects assert behavior (not mock internals) and expected values come from the
 * per-target `data` fixture keyed on `testInfo.project.name`.
 *
 * The `jira` lane needs an authenticated Atlassian session (`storageState`). Set
 * `JIRA_LOGIN` + `JIRA_PASSWORD` and the `jira-setup` project logs in once and writes
 * it (e2e/testing/jira/auth.setup.ts); otherwise drop a manually-captured session at
 * JIRA_STORAGE.
 *
 * Layout: specs live in e2e/tests/<flow>/ (each = a shared `.spec.ts` flow + co-located
 * `.data.ts` per-target values + `.assertions.ts`); the dual-target foundation (the
 * frame-aware page object, the `{app, target}` base fixture, and each target's
 * connect/auth/seed) lives in e2e/testing/{shared,mock,jira}. See docs/testing.md.
 */
const PORT = 5173

// Real-Jira PoC lane (opt-in): set JIRA_APP_URL to the Project Assistant *page* URL
// (copy it from the browser while that page is open). When set, the `jira` project
// is added and the local mock dev-server is NOT started — we drive the live site.
const JIRA_APP_URL = process.env.JIRA_APP_URL

// Where the authenticated Atlassian session lives (cookies/storage). The `jira` lane
// reads it; the auto-login setup (below) writes it. Gitignored.
const JIRA_STORAGE = process.env.JIRA_STORAGE ?? 'e2e/.auth/jira.json'

// Opt-in auto-login: when BOTH are set, a `jira-setup` project logs in from these env
// creds and writes JIRA_STORAGE before the `jira` lane runs (see e2e/testing/jira/auth.setup.ts).
// Without them, the `jira` lane reuses a pre-captured JIRA_STORAGE file instead.
const JIRA_CREDS = !!(process.env.JIRA_LOGIN && process.env.JIRA_PASSWORD)

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['html', { open: 'never' }], ['list']] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'mock',
      // The @jira PoC drives a cross-origin Forge iframe — never run it in the mock lane.
      grepInvert: /@jira/,
      use: { ...devices['Desktop Chrome'] },
    },
    // Real-Jira PoC lane — added only when JIRA_APP_URL is set, so `npm test` stays
    // mock-only. See docs/testing.md → "Real-Jira smoke: proof of concept".
    ...(JIRA_APP_URL
      ? [
          // Auto-login (opt-in): runs only when JIRA_LOGIN + JIRA_PASSWORD are set.
          // Logs in once and writes JIRA_STORAGE; the `jira` lane depends on it.
          // 90s timeout > the login's internal waits (email→password 15s + success
          // 30s) so a real stall (MFA/SSO/CAPTCHA) reports its diagnostic instead of
          // tripping the 30s default with a generic message.
          ...(JIRA_CREDS
            ? [{ name: 'jira-setup', testMatch: /testing\/jira\/auth\.setup\.ts/, timeout: 90_000 }]
            : []),
          {
            name: 'jira',
            grep: /@jira/, // PoC only; the full @smoke lane needs the page-object frame refactor (see docs)
            timeout: 60_000, // real Jira: networkidle + a 30s grid wait can exceed the 30s default
            // When creds are present, the setup project mints the session first;
            // otherwise JIRA_STORAGE must already hold a manually-captured session.
            ...(JIRA_CREDS ? { dependencies: ['jira-setup'] } : {}),
            use: {
              ...devices['Desktop Chrome'],
              baseURL: JIRA_APP_URL,
              storageState: JIRA_STORAGE,
            },
          },
        ]
      : []),
  ],
  // The mock lane boots the in-memory UI; the jira lane drives the live site, so
  // don't start a local dev-server there.
  webServer: JIRA_APP_URL
    ? undefined
    : {
        command: 'npm --prefix frontend run dev:mock -- --port 5173 --strictPort',
        url: `http://localhost:${PORT}`,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
})
