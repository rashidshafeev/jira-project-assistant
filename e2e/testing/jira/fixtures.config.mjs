// ─────────────────────────────────────────────────────────────────────────────
// Fixture roster for the real-Jira seed tooling (DEV-ONLY; not shipped, not imported
// by the app or the mock). Shared by ./seed-users.mjs (creates the accounts) and the
// future data seeder / Target.seed() hook (assigns issues to them).
//
// Each member's email is a PLUS-ALIAS of one base inbox (see seed-users.mjs):
//   base = you@gmail.com  +  alias 'pa-alice'  ->  you+pa-alice@gmail.com
// Gmail (and Fastmail/Proton/iCloud/…) deliver every +alias to the one base inbox,
// while Atlassian treats each as a DISTINCT account — so one mailbox catches all the
// invite emails. The `pa-` prefix marks them as Project-Assistant fixtures so they're
// easy to spot in the user list (users are NEVER auto-deleted — see docs/seeding.md).
// Edit this list to grow/shrink the team; keep it under the site's seat cap (Jira
// free plan = 10 users total, including you).
// ─────────────────────────────────────────────────────────────────────────────

export const TEAM = [
  { alias: 'pa-alice', displayName: 'Alice Fixture' },
  { alias: 'pa-bob', displayName: 'Bob Fixture' },
  { alias: 'pa-carol', displayName: 'Carol Fixture' },
  { alias: 'pa-dave', displayName: 'Dave Fixture' },
]

/** Build a member's plus-alias email from the base inbox address. */
export function aliasEmail(base, alias) {
  const at = base.lastIndexOf('@')
  if (at < 1) throw new Error(`base email looks invalid: ${base}`)
  const local = base.slice(0, at)
  const domain = base.slice(at + 1)
  // If the base already carries a +tag, replace it rather than nest another.
  const root = local.split('+')[0]
  return `${root}+${alias}@${domain}`
}
