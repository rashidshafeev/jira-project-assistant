# Deploy / install

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
