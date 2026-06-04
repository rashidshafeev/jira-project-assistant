# Render surfaces & entry modes

Which Jira UI surface a module renders in, and how this one app routes all of them from a
single bundle. The bootstrap inspects `view.getContext()` (module key + the host issue) and
resolves a `page` | `panel` | `admin` view — see `frontend/src/app/lib/entry-context.ts`.

## Where the app's pages appear — global vs project nav
A `jira:globalPage` shows up as a top-level entry in Jira's **global left navigation**
(under "Apps" → "Your apps"), reachable from anywhere. A `jira:projectPage` instead shows up
**inside a single project's left sidebar** (under that project's "Apps" section) and is
per-project (the site needs at least one project to view it). We ship the **globalPage** —
this app is a cross-project, picker-driven tool, so the global entry is its natural home; we
dropped an earlier `projectPage` as redundant once the global page covered the same shell.

## `jira:issuePanel` requires an `icon`; `jira:projectPage` / `jira:globalPage` do not
A `jira:issuePanel` module **fails `forge deploy`** without an `icon` property — the
projectPage module has no such requirement, so it's easy to miss when adding a second module
to a working manifest. The icon accepts an absolute URL **or** a path resolved against a
declared resource. We self-host it from the `main` resource (`frontend/dist`), bundled from
`frontend/public/panel-icon.svg` by Vite (publicDir → copied to `dist/`), so there's no
external CDN dependency. See `manifest.yml`. (`forge lint --fix` will *not* add the missing
field for you — it only reformats; see [`cli-build.md`](./cli-build.md).)

## Module `icon` needs the `resource:<key>;<path>` form — a bare path 404s silently
**Symptom:** a module's `icon` shows as a **broken-image glyph** in Jira (the browser's
"no image" placeholder), even though the SVG is bundled in `dist` and the app otherwise
works. `forge lint` and `forge deploy` both pass — it **only breaks at render time**.
**Cause:** a **bare relative path** (`icon: panel-icon.svg`) is handed to Jira's chrome and
resolved **against the current page URL**, not the app's resource. On an issue page that
becomes `https://<site>/browse/panel-icon.svg` → 404. (Confirmed live: the `<img>` `src` was
literally `…/browse/panel-icon.svg`, `naturalWidth: 0`.)
**Fix:** use one of the three forms the manifest actually supports (per the module docs):
```yaml
icon: resource:main;panel-icon.svg   # bundled asset, key=resource key, ;-separated path
# or an absolute URL (https://…) — but that's subject to an egress permission check
# or a data:image/…;base64,… URI
```
With `resource:main;panel-icon.svg`, Jira rewrites it to the Forge resource CDN
(`https://icon.cdn.prod.atlassian-dev.net/<appId>/<env>/<version>/main/panel-icon.svg`) and it
loads. The icon is a flat `<img>` (no design-token theming), so it won't auto-adapt to
light/dark — pick a hue that reads on both.
Ref: <https://developer.atlassian.com/platform/forge/manifest-reference/modules/jira-issue-context/>

## Where apps render in Jira — and the issuePanel "click-to-add" trap
Forge offers several Jira UI surfaces; which one to pick depends on whether the content
should be **always visible** or **opt-in**. The ones relevant to surfacing a per-issue
verdict (what this app wants), plus what we actually ship:

| Module | Surface | Always visible once installed? |
| --- | --- | --- |
| `jira:globalPage` | Top-level entry in Jira's **global left nav** (under "Apps"), app-wide | **Yes — we ship this** (the full shell; the in-app picker chooses the project) |
| `jira:issueContext` | Collapsible item in the issue's **right-hand context** sidebar | **Yes — we ship this** (present on every issue; the always-visible verdict) |
| `jira:projectPage` | Full page under a **project's** "Apps" sidebar section | Yes, but per-project — *tried, then dropped as redundant with globalPage* |
| `jira:issuePanel` | Collapsible panel on the issue view, content above Activity | **No — click-to-add** (issue's app/"+" menu, new issue view only) — *tried, then dropped* |
| `jira:issueGlance` | Badge in the issue context that opens a flyout panel | Yes (the badge); content on click — **deprecated** |
| `jira:issueActivity` | A tab inside the issue **Activity** section | Yes (the tab) |
| `jira:dashboardGadget` | A gadget on a Jira dashboard | n/a (not issue-scoped) |

We ship **two modules, one bundle** (routed at bootstrap by the context shape — see
`entry-context.ts`):
- `jira:globalPage` — the full shell as a **global** left-nav entry (app-wide; the picker
  defaults to the first project, since a global context has no project). Renders `mode: 'page'`.
- `jira:issueContext` — the always-visible single-issue verdict in the issue's **context
  sidebar** (the host issue in context). Renders `mode: 'panel'`.

We earlier also shipped `jira:projectPage` (a per-project shell) and `jira:issuePanel` (an
opt-in main-column verdict) and **dropped both**: the globalPage covers the same shell (the
picker switches projects either way), and `issueContext` covers the per-issue verdict while
being always-visible where the issuePanel isn't (see the trap below).

**The trap that drove this — `issuePanel` is opt-in, `issueContext` is not.** After deploying
the `issuePanel` module and running `forge install --upgrade`, the panel did **not** surface
on Jira's modern issue view — not in the ••• **Actions** menu (only standard ops:
Clone/Move/Archive/Delete/Print/Export…), not in the **"+" Add** menu (searching the panel
title returned no matches), and nowhere in the page's accessibility tree (verified live on
`rashidshafeev.atlassian.net`). That's by design: a `jira:issuePanel` is **click-to-add and
never auto-shown** (Atlassian FRGE-734), so it can't meet "the verdict is always visible".
**Fix (shipped):** we added `jira:issueContext`, which renders **inline in the right context
sidebar on every issue with no add action**. Verified live — the "Project Assistant" item
appears next to Details/Development/Automation, and expanding it shows the verdict (the same
`IssuePanelPage`). Two gotchas seen during that check:
- The collapsed header carried a **"DEVELOPMENT" lozenge** (`СРЕДА РАЗРАБОТКИ` in the RU
  locale) — that's **Jira's own badge for a development-environment app**, not our manifest
  `status`. It disappears for a production install.
- `issueContext` **lazy-loads the iframe on first expand** (not on page load), so there's a
  brief blank → spinner → content the first time it's opened. Expected; nothing to fix.
The collapsed-header **status lozenge** (an at-a-glance OK/Problem without expanding) is left
as a follow-up: a manifest-literal `status` is static, and a per-issue verdict needs a
`dynamicProperties` function or a resolver that writes the issue-property lozenge — i.e.
running the problem rules server-side, which cuts against this app's "frontend owns the rules"
design. `jira:issueGlance` (the click-to-add flyout) is **deprecated** — don't reach for it.
