# Real-Jira fixtures — seeding & cleanup

How to put **real** test data on the dev Jira site (`rashidshafeev.atlassian.net`) so the
app's two value props — surfacing problematic issues, fixing them — can be demoed and
E2E-tested against the live product, not just the mock. This is **dev-only tooling**, and it
lives with the real-Jira test lane under **`e2e/testing/jira/`** (gitignored output); nothing
here ships in the app. (The lane's `Target.seed()` hook in `e2e/testing/jira/target.ts` is the
home for the per-run issue seed/teardown — see "the easy part" below.)

The work splits cleanly into an **easy part** (issue data) and a **hard part** (users), and
they want different lifecycles.

## The easy part: issue data (automatable, re-runnable, safely cleaned up)

Everything except people is plain REST and fully scriptable:

- **Issues** — `POST /rest/api/3/issue` (or `/issue/bulk`); set summary, issuetype, priority,
  `duedate`, assignee on create. Delete with `DELETE /rest/api/3/issue/{key}`.
- **Statuses** — you can't set status on create; transition after with
  `POST /rest/api/3/issue/{key}/transitions` (to populate the In Progress / Done stats).
- **A project** — `POST /rest/api/3/project`, but projects are heavyweight: make **one
  dedicated seed project once** (e.g. key `SEED`) and only churn issues inside it.

Two rules keep this **safe on a live site**:

1. **Mark everything, delete only what's marked.** Stamp every seeded issue with a label
   (`seed`) inside the dedicated project. Cleanup is then `jql = project = SEED AND
   labels = seed` → delete exactly those. The seeder must **never** touch anything it didn't
   create. Default any cleanup to **dry-run**; require an explicit `--apply`.
2. **Relative dates, computed at seed time.** A low-priority issue is "at risk" only if its
   `duedate` is within the window *now*. Seed due dates as offsets from today (due in 2 → 🟡,
   overdue by 1, due in 30 → healthy) so re-running next month still triggers the highlights.
   This is the one place real fixtures must differ from the static `mock/fixtures.ts`.

Idempotent + label-scoped + dry-run-first ⇒ you can re-run forever without fear.

## The hard part: users

The "team" the app shows = assignable users on the project (`/user/assignable/search`).
Auto-assign round-robin and the team table only look real with ~3–5 distinct members, and
**Jira Cloud identity is not yours to mint freely**:

- **You can't cleanly create+activate accounts via API like you create issues.** There's a
  legacy `POST /rest/api/3/user`, but it only *invites* an unconfirmed account, needs
  site-admin + permissive org settings, and Atlassian steers everyone toward org-level SCIM
  provisioning (needs **Atlassian Guard**, paid, + a verified domain — not available here).
  If your org blocks the legacy endpoint it returns **403**; then invite manually at
  `admin.atlassian.com`.
- Each invited member is a real Atlassian identity tied to a **deliverable inbox**, **counts
  toward billable seats** (free plan caps at **10 users incl. you**), and removal is
  **org-admin** territory — you *deactivate*, you don't `DELETE` a user over the site REST API.

### The "many accounts, one email" trick (plus-addressing)
Gmail **plus-addressing** (and the dot trick) lets one inbox back many identities:
`you+pa-alice@gmail.com`, `+pa-bob`, … all deliver to `you@gmail.com`, but Atlassian treats
each string as a **distinct account**. So one mailbox catches every invite. (Works on
Gmail/Fastmail/Proton/iCloud and most providers; not all.)
`e2e/testing/jira/fixtures.config.mjs` holds the roster; the `pa-` prefix marks them as
Project-Assistant fixtures in the user list.

What it solves / doesn't:
- ✅ One inbox instead of N mailboxes.
- ❌ Not pure-API — each may need a one-time **accept** click (set name/password).
- ❌ Still consumes seats / the 10-user cap.

### Do the fixture users ever log in? (the OTP question)
Almost never:

- **Seeding & assigning data** runs entirely **as you (admin)** via the API token. The fixture
  users are just `accountId`s you assign issues to and that render in the team table — *they
  never authenticate*. **Zero OTP, zero password** for the whole data path.
- **Creating/accepting** the accounts is the only friction: a one-time invite-acceptance per
  alias (all landing in your one inbox). Whether acceptance is required before an account is
  *assignable* depends on the org — verify against the live site.
- **Logging in *as* a fixture user** is only needed if you later want a non-admin **browser
  session** (e.g. to E2E that the admin page is hidden from non-admins). *That's* where
  Atlassian's risk-based **emailed code** appears — but you do it **once**, save the
  `storageState`, and reuse the cookie. The Playwright `jira` lane already automates this
  (`JIRA_STORAGE` + the `JIRA_OTP_FILE` hand-off — see [`testing.md`](./testing.md)). So even
  there it's not every run.
  - **Gotcha:** a fixture user opening the **development** *or* **staging** app hits *"This
    application is in development — only the owner may grant it access."* Both non-production
    environments are owner-gated, so to view the UI as a non-owner you must install the
    **production** environment — see [`forge/deploy-install.md`](./forge/deploy-install.md).
    Pure assignment/team-table fixtures don't need this; only a non-admin *session* does.

### Recommendation: separate "team" from "data"
Don't make users a per-run fixture — make them **stable infrastructure set up once**:

1. **One-time, semi-manual:** invite ~3–4 `+alias` accounts (`npm run seed:users -- --apply`),
   accept the invites, add them to the `SEED` project with assignable roles, and record their
   `accountId`s. Leave them in the site permanently.
2. **Repeatable script:** the data seeder only ever touches **issues** in `SEED`, assigning
   among those existing `accountId`s, all `seed`-labelled. This is the idempotent, scoped,
   re-runnable part; the only destructive op is fenced behind the label + project filter.

## `e2e/testing/jira/seed-users.mjs` — creating the fixture team

Standalone Node (ESM, no deps — Node 22 `fetch`), co-located with the real-Jira lane. It uses
the shared REST client `e2e/testing/jira/rest.mjs` — **HTTP Basic with `FORGE_EMAIL`/
`FORGE_API_TOKEN`** (the same token the Forge CLI uses), the *correct* auth for REST. It does
**not** reuse the lane's browser-session auth (`auth.setup.ts` / `storageState`): that's a
cookie session for driving the Forge iframe, not a REST credential — different mechanism (the
`rest.mjs` header comment spells this out). It runs **as you** and **only creates** accounts —
it never deletes users.

```bash
# .env needs FORGE_EMAIL, FORGE_API_TOKEN, and JIRA_SITE (or JIRA_APP_URL to derive it).
npm run seed:users               # DRY RUN — searches only, creates nothing
npm run seed:users -- --apply    # create the missing accounts (SENDS invite emails)
```

- **Idempotent:** looks each alias up by email first; skips existing accounts, fills gaps.
- **Dry-run by default:** the no-arg run is read-only (`/user/search`), safe to run anytime.
- **Output:** on `--apply` it writes `e2e/.auth/seeded-users.json` (gitignored, beside the
  session file) — the email→accountId map the data seeder consumes.
- **403 on create** ⇒ your org blocks API user creation; invite the `+alias` addresses by
  hand at `admin.atlassian.com`, accept them, then re-run the dry-run to capture their ids.

Roster + the alias-email rule live in `e2e/testing/jira/fixtures.config.mjs`; edit that to
grow/shrink the team (mind the 10-seat free cap). The shared `rest.mjs` client is also what the
future `Target.seed()` issue-seed/teardown hook will use, so both speak REST the same way.

## Status

`seed-users.mjs` exists; the issue **data seeder + label-scoped cleanup** is the next piece
(see "the easy part" rules above). Running `--apply` against the live site sends real invite
emails and is gated on an explicit decision.
