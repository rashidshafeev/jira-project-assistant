// ─────────────────────────────────────────────────────────────────────────────
// Shared Jira REST client for the seed tooling and the (future) Target.seed() hook
// in ./target.ts. DEV-ONLY (real-Jira data lifecycle); not shipped, not collected by
// Playwright (it's not a *.spec file).
//
// AUTH NOTE — two different mechanisms, deliberately:
//   • This file = HTTP Basic with the Atlassian API token (FORGE_EMAIL +
//     FORGE_API_TOKEN), the SAME credential the Forge CLI uses. Correct for REST.
//   • ./auth.setup.ts = a browser cookie *session* (storageState) for driving the
//     app inside Jira's cross-origin Forge iframe. An API token is NOT a web session
//     and a session is clumsy for REST — so they are NOT shared. See auth.setup.ts.
// ─────────────────────────────────────────────────────────────────────────────

/** Read the REST env (no validation). `site` falls back to JIRA_APP_URL's host. */
export function restEnv() {
  const email = process.env.FORGE_EMAIL
  const token = process.env.FORGE_API_TOKEN
  const site =
    process.env.JIRA_SITE ||
    (process.env.JIRA_APP_URL ? new URL(process.env.JIRA_APP_URL).host : '')
  return { email, token, site }
}

/** Like {@link restEnv} but throws a clear message if anything required is missing. */
export function requireRestEnv() {
  const env = restEnv()
  if (!env.email || !env.token)
    throw new Error('FORGE_EMAIL / FORGE_API_TOKEN not set — `set -a; . ./.env; set +a` first.')
  if (!env.site)
    throw new Error('No Jira site — set JIRA_SITE=your-site.atlassian.net (or JIRA_APP_URL) in .env.')
  return env
}

/**
 * A tiny Jira REST v3 client bound to one site. `fetch(path, init)` returns
 * `{ ok, status, body }` with the JSON already parsed (or null for empty bodies).
 */
export function jiraClient(env = requireRestEnv()) {
  const auth = 'Basic ' + Buffer.from(`${env.email}:${env.token}`).toString('base64')
  const base = `https://${env.site}/rest/api/3`
  return {
    site: env.site,
    async fetch(path, init = {}) {
      const res = await fetch(`${base}${path}`, {
        ...init,
        headers: {
          Authorization: auth,
          Accept: 'application/json',
          ...(init.body ? { 'Content-Type': 'application/json' } : {}),
          ...init.headers,
        },
      })
      const text = await res.text()
      return { ok: res.ok, status: res.status, body: text ? JSON.parse(text) : null }
    },
  }
}
