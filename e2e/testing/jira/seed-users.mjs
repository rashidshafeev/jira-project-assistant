#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// seed-users.mjs — create the fixture TEAM as real Atlassian accounts on the dev
// Jira site, so the app's team table / assignee picker / auto-assign have real users
// to work with. DEV-ONLY tooling (not shipped). See docs/seeding.md.
//
//   npm run seed:users            # DRY RUN — only reads (search), creates nothing
//   npm run seed:users -- --apply # actually create the missing accounts (SENDS
//                                   # invite emails to the +alias addresses)
//
// Auth is the shared REST client (./rest.mjs) — HTTP Basic with the API token, the
// same creds the Forge CLI uses. It runs entirely AS YOU (admin) and never logs in as
// the fixture users: they're just accounts you assign issues to. (That's why it does
// NOT touch the browser-session auth the Playwright `jira` lane uses — see rest.mjs.)
//
// Idempotent: looks each alias up by email first and skips ones that exist, so
// re-running only fills gaps. On --apply it writes the email→accountId map to
// e2e/.auth/seeded-users.json (gitignored) for the data seeder to consume.
//
// SAFETY: only CREATES accounts. It never deletes users — removing Atlassian
// identities is an org-admin action, deliberately out of scope here.
// ─────────────────────────────────────────────────────────────────────────────

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { jiraClient, requireRestEnv } from './rest.mjs'
import { TEAM, aliasEmail } from './fixtures.config.mjs'

const apply = process.argv.includes('--apply')

/** Read `--flag value` or `--flag=value` from argv. */
function argValue(name) {
  const i = process.argv.indexOf(name)
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1]
  const eq = process.argv.find((a) => a.startsWith(`${name}=`))
  return eq ? eq.slice(name.length + 1) : undefined
}
// Process only the first N roster members (e.g. `--limit 1` to create one at a time).
const limitRaw = argValue('--limit')
const limit = limitRaw ? Math.max(1, Number.parseInt(limitRaw, 10)) : Infinity
const roster = TEAM.slice(0, limit)

const here = dirname(fileURLToPath(import.meta.url))
// e2e/testing/jira -> e2e/.auth (already gitignored alongside the session file).
const OUT = join(here, '..', '..', '.auth', 'seeded-users.json')

function die(msg) {
  console.error(`✗ ${msg}`)
  process.exit(1)
}

let env
try {
  env = requireRestEnv()
} catch (e) {
  die(e.message)
}
const base = process.env.SEED_EMAIL_BASE || env.email
if (!base || !base.includes('@')) die(`Base email looks invalid: ${base}`)

const jira = jiraClient(env)

/**
 * Find an existing account for `addr`, or null. Cloud HIDES emailAddress in search
 * results (GDPR — it comes back ""), so we CAN'T email-match the hits. Instead we
 * trust two signals: (1) a prior run recorded this email→accountId in seeded-users.json
 * (authoritative — re-querying confirms it's still live), and (2) `query=<full-email>`
 * is an exact lookup, so a single hit IS this account. We only fall back to a blanked
 * email-equality check for the rare case the field isn't redacted.
 */
async function findByEmail(addr, knownId) {
  const { ok, status, body } = await jira.fetch(`/user/search?query=${encodeURIComponent(addr)}`)
  if (!ok) {
    if (status === 401 || status === 403)
      die(`auth/permission error (${status}) calling /user/search — check the token and that the account is a site admin.`)
    die(`/user/search failed (${status}): ${JSON.stringify(body)}`)
  }
  const hits = body || []
  // 1. Prior-run id still present in the results → confirmed.
  if (knownId) {
    const byId = hits.find((u) => u.accountId === knownId)
    if (byId) return { accountId: byId.accountId, displayName: byId.displayName }
  }
  // 2. Exact-email query returning exactly one account → that's it (email is blanked).
  if (hits.length === 1) return { accountId: hits[0].accountId, displayName: hits[0].displayName }
  // 3. Fallback: an un-redacted exact email match among several hits.
  const byEmail = hits.find((u) => (u.emailAddress || '').toLowerCase() === addr.toLowerCase())
  return byEmail ? { accountId: byEmail.accountId, displayName: byEmail.displayName } : null
}

/** Create an invited account with Jira access. Returns { accountId }. */
async function createUser(addr) {
  const { ok, status, body } = await jira.fetch('/user', {
    method: 'POST',
    body: JSON.stringify({ emailAddress: addr, products: ['jira-software'] }),
  })
  if (!ok) {
    const hint =
      status === 403
        ? ' — your org likely blocks API user creation. Invite these addresses manually at admin.atlassian.com (see docs/seeding.md).'
        : ''
    die(`create failed for ${addr} (${status})${hint}: ${JSON.stringify(body)}`)
  }
  return { accountId: body.accountId }
}

// ── Run ──────────────────────────────────────────────────────────────────────
console.log(`Site:   ${jira.site}`)
console.log(`Base:   ${base}  (invites land in this inbox)`)
console.log(`Mode:   ${apply ? 'APPLY (will create + email)' : 'DRY RUN (reads only)'}`)
console.log(`Roster: ${roster.length}/${TEAM.length}${Number.isFinite(limit) ? `  (--limit ${limit})` : ''}`)
console.log('')

// Prior run's recorded ids (authoritative idempotency source — Cloud blanks the
// emailAddress in search, so a recorded id is the only reliable re-match anchor).
let recorded = []
try {
  recorded = JSON.parse(await readFile(OUT, 'utf8'))
} catch {
  /* no prior file yet */
}
const recordedByEmail = new Map(recorded.map((r) => [r.email, r]))

const results = []
for (const member of roster) {
  const addr = aliasEmail(base, member.alias)
  const existing = await findByEmail(addr, recordedByEmail.get(addr)?.accountId)
  if (existing) {
    console.log(`= exists   ${addr}  → ${existing.accountId}`)
    // Carry forward anything a prior run recorded (e.g. password) so we never clobber it.
    const prior = recordedByEmail.get(addr) || {}
    results.push({ ...prior, ...member, email: addr, accountId: existing.accountId, created: false })
  } else if (!apply) {
    console.log(`+ would create  ${addr}  (${member.displayName})`)
    results.push({ ...member, email: addr, accountId: null, created: false })
  } else {
    const { accountId } = await createUser(addr)
    console.log(`+ created  ${addr}  → ${accountId}  (invite sent)`)
    results.push({ ...member, email: addr, accountId, created: true })
  }
}

console.log('')
if (apply) {
  // Merge with any prior run (by email) so creating the team one-at-a-time accumulates.
  let prior = []
  try {
    prior = JSON.parse(await readFile(OUT, 'utf8'))
  } catch {
    /* no prior file yet */
  }
  const byEmail = new Map(prior.map((r) => [r.email, r]))
  for (const r of results) byEmail.set(r.email, r)
  const merged = [...byEmail.values()]
  await mkdir(dirname(OUT), { recursive: true })
  await writeFile(OUT, JSON.stringify(merged, null, 2) + '\n', 'utf8')
  console.log(`Wrote ${merged.length} entries (${results.length} this run) → ${OUT}`)
  const pending = results.filter((r) => r.created)
  if (pending.length) {
    console.log(
      `\nNEXT: ${pending.length} invite(s) sent to ${base}. Accept each (one click per` +
        ` alias) so the accounts activate and become assignable. See docs/seeding.md.`,
    )
  }
} else {
  const missing = results.filter((r) => !r.accountId).length
  console.log(`Dry run complete. ${results.length - missing} exist, ${missing} would be created. Re-run with -- --apply to create them.`)
}
