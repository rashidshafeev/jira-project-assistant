# Deploy / install

## Environments & who can open the app (dev is owner-only)
Forge has three environments — `development` (default), `staging`, `production` — and each is
an independent app instance with its own version and install (`forge environments list`). They
can be installed on the **same site** at once and show up as separate apps.

The catch that bites during testing: **both non-production environments — `development` *and*
`staging` — are owner-gated.** Only the app owner's Atlassian account may grant access; any
other user (e.g. a fixture account like Alice — see [`../seeding.md`](../seeding.md)) who opens
it gets:

> "For Project Assistant to display, you need to grant it access… Allow access" → then
> "You don't have access to this app. **This application is in development** — only the owner
> of this application may grant it access to their account."

(The message says "in development" even for a staging install — staging counts as non-production
for this purpose. Verified the hard way: installing staging changed nothing for the non-owner.)

This does **not** block seeding/assigning (that runs as the admin token — the fixtures never
open the app). It only blocks **logging in *as* a non-owner to view the UI** (e.g. to E2E that
the admin page is hidden from non-admins). To let non-owners open the app you must deploy +
install the **`production`** environment — it's the *only* one that isn't owner-gated:

```bash
npm --prefix frontend run build           # deploy needs frontend/dist
set -a; . ./.env; set +a
forge deploy -e production
forge install --product jira --site rashidshafeev.atlassian.net \
  --environment production --confirm-scopes
```

The production app then appears as a *separate* app on the site (no `(DEVELOPMENT)`/`(STAGING)`
title suffix), openable by any licensed site user. It's still your private dev app — "production
environment" just means the non-gated channel, not a Marketplace listing.

**`forge install` needs a TTY.** Its prompts (scope confirm, and for a *non-production app on a
production site* the extra *"You are about to install a development app to a production site…"*
warning) error in a non-TTY with *"Prompts can not be meaningfully rendered in non-TTY
environments,"* even with `--confirm-scopes`. Run it in an interactive terminal (in this
project, type it after `!` in the Claude prompt). The production install doesn't fire the
non-production warning, but still run it interactively for the scope prompt.

### Two orthogonal "dev/prod" axes — app *environment* vs. *site* type
The install warning emphasizes "**production site**" because that's a *second* axis,
independent of the Forge environment:

| Axis | Values | What it is |
|------|--------|-----------|
| Forge app **environment** | `development` / `staging` / `production` | where your *app code* is deployed (`-e …`); shows as a title suffix `(DEVELOPMENT)`/`(STAGING)`/none |
| Atlassian **site** type | *production site* / *sandbox site* | the Jira instance you install *onto* — a property of the site, not the app |

The warning fires on the combination **non-production app (dev/staging) + production site**.
Best practice is to put non-prod app code on a **non-production site** — i.e. a **sandbox**.

A **sandbox** is a separate, isolated replica Jira site (own URL/data) for safe testing. What
it buys you:
- **Trivial cleanup / isolation** — the main win. Experiment freely; reset via "refresh"
  instead of the label-scoped, dry-run-first deletes [`../seeding.md`](../seeding.md) needs
  *because* we seed on a live production site. A sandbox makes most of that scaffolding moot.
- **Copy real data in** — clone specific production projects (issues, optional attachments)
  to test against realistic data instead of inventing fixtures.

What it does **not** buy you — and why it's irrelevant here:
- **It doesn't simplify *user* seeding.** Copying prod→sandbox copies *existing* users/groups/
  teams; it never *mints* identities. Our hard part is having no team in prod to begin with
  (we invent Alice/Bob/…), so the plus-alias/invite/10-seat dance is unchanged.
- **Premium/Enterprise only.** This dev site is free-plan (hence the 10-user cap), so **no
  sandbox is available** — its only site is a production site. Hence staging-on-prod is the
  correct and only path to give non-owners (Alice) access here.
- **One-directional** — you can't push sandbox changes back to production.

## Dev install auto-tracks deploys
An app installed from the **development** environment picks up each `forge deploy`
automatically — no reinstall needed. Exception: when **scopes or content permissions
change**, run `forge install --upgrade`. (After a CSP change, still **hard-refresh** the Jira
page — see [`custom-ui.md`](./custom-ui.md); layout changes are cached the same way, see
[`custom-ui.md`](./custom-ui.md) `layout: blank`.)

## `forge install --upgrade` in a non-TTY needs every prompt pre-answered
`forge install --upgrade` prompts interactively (site, product, environment, scope confirm)
and **fails in a non-TTY** with *"Prompts can not be meaningfully rendered in non-TTY mode."*
Pass them all as flags:
```bash
forge install --upgrade --site rashidshafeev.atlassian.net --product jira \
  --environment development --confirm-scopes --non-interactive
```
(If the site is already current it prints "Site is already at the latest version" and no-ops.)
Also note the **subcommand** form for listing installs: it's `forge install list`, **not**
`forge install --list` (the latter errors "unknown option '--list'").
