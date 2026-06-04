# Atlassian / Forge / Jira Platform Gotchas

A running log of non-obvious **platform** quirks hit while building this app, with the fix for
each — Forge Custom UI constraints, the Forge CLI/build, deploy/install, tunnelling, and the
Jira REST API. Frontend/MUI gotchas (the DataGrid quirks, the Emotion/theme palette) live in
[`frontend.md`](./frontend.md).

## Custom UI (Forge platform constraints)

These are constraints the Forge host imposes on a Custom UI iframe. They surface in the
frontend, but the *cause* is the platform — so they live here; the MUI/DataGrid fixes they
motivate are described in [`frontend.md`](./frontend.md).

### MUI/Emotion render unstyled — CSP blocks inline styles
**Symptom:** the page renders as generic, unstyled HTML in Jira even though React clearly
mounted (text/structure are there).
**Cause:** MUI styles via Emotion are injected as inline `<style>` tags at runtime. Forge
Custom UI's default CSP is `style-src 'self'`, which **blocks inline styles**, so none of
the CSS applies.
**Fix:** allow inline styles in `manifest.yml`, then `forge deploy`:
```yaml
permissions:
  content:
    styles:
      - unsafe-inline
```
**Note:** CSP headers are cached by the browser — **hard-refresh** (Ctrl/Cmd+Shift+R) the
Jira page after deploying, or the old policy lingers.
Refs: <https://developer.atlassian.com/platform/forge/add-content-security-and-egress-controls/>,
<https://mui.com/material-ui/guides/content-security-policy/>

### projectPage `layout`: use `blank`, not `basic` (full-bleed, no left gutter)
`jira:projectPage` chrome is controlled by the **`layout`** property:
- `native` (default) — full Jira project-page chrome: system header/title + navigation.
- `basic` — **deprecated for Custom UI.** "Simplified layout with **left margin** and
  breadcrumbs." That left margin is a **~40px left-only gutter** (an ancestor of our iframe,
  class `_18u01jfw _4t3i1jj4`, `margin-left: 40px; margin-right: 0`) — invisible to our CSS
  because it lives *outside* the iframe, in Jira's page shell. It's also asymmetric (left
  only), which reads as a layout bug.
- `blank` — "a completely empty canvas for full viewport customization." No header, no
  breadcrumbs, **no left gutter** → true full-bleed. We render our own controls, so this is
  what we want.

We switched `basic → blank`. **Caveat:** `layout` is rendered by Jira's page shell
server-side and cached hard — after deploying a layout change you must **hard-refresh**
(Ctrl/Cmd+Shift+R); a soft reload re-runs the cached shell and the old gutter persists.
Ref: <https://developer.atlassian.com/platform/forge/manifest-reference/modules/jira-project-page/>

### Height: projectPage auto-resizes — no fixed viewport, so no "fill-to-bottom"
`jira:projectPage` has **no `viewportSize`** property, so height is always **automatic
resizing**: the Forge iframe-resizer grows the iframe to its content's height, and the host
Jira page scrolls — there is no stable viewport inside the iframe to fill.

Consequences we hit and how we handle them:
- **`100vh` / `min-height: 100vh` is unreliable in Forge.** With an auto-resizing iframe
  there's no fixed viewport: `100vh` forces content ≥ the iframe's initial slot, the resizer
  grows the iframe to match, and the leftover shows up as a **stray vertical scroll** on the
  Jira page. Symptom we saw: page `documentElement` overflow was 0 but Jira's inner scroll
  container (`overflow-y: auto`) scrolled.
- **Avoid absolute positioning** — it breaks the resizer's content-height measurement
  (documented limitation), which can collapse the iframe toward 0px.
- **Two height modes, gated on `VITE_USE_MOCKS`** (the frontend side of this is in
  [`frontend.md`](./frontend.md) / `AppDataGrid`):
  - *Mock* (standalone page) — a real viewport exists, so we use a `100vh` flex-column shell;
    the table fills to the bottom and scrolls **internally** (DataGrid virtualization).
  - *Forge* (auto-resizing iframe) — **no fixed height**; the DataGrid uses `autoHeight`
    (grows to its rows) and the Jira page scrolls. Fill-to-bottom is impossible here by
    design; the page growing is the native, recommended model.
- This means a large project renders a tall page in Forge. The scale-up fix is real
  `searchIssues` pagination (server-side), not a fixed-height scroller. Tracked as pending.
Refs: <https://community.developer.atlassian.com/t/17-aug-2021-automatic-resizing-for-custom-ui-apps/51096>

### `@forge/bridge` throws on import outside a Forge host
**Symptom:** running the frontend standalone (e.g. the mock preview / `npm run dev:mock`)
shows a blank white page; console has `BridgeAPIError: Unable to establish a connection
with the Custom UI bridge`.
**Cause:** `@forge/bridge` runs connection setup **at import time**, which throws when
there's no Atlassian host. A static `import ... from '@forge/bridge'` anywhere in the
module graph crashes the app before React mounts — even in mock mode.
**Fix:** **dynamically import** the bridge transport so it only loads when actually used.
The transport switch in `shared/api/transport.ts` loads each transport via `import()` — the
mock when `VITE_USE_MOCKS=true`, the bridge otherwise (the `shared/api/index.ts` barrel stays
logic-free). This keeps `@forge/bridge` out of the mock preview entirely (and the mock out of
the production bundle).

## Forge CLI / build

### No system keychain → use env vars
This environment has no libsecret/keychain, so `forge login` can't store credentials.
Forge reads `FORGE_EMAIL` + `FORGE_API_TOKEN` from the environment instead — we keep them
in `.env` (gitignored) and `set -a; . ./.env; set +a` before any forge command.
`forge login --non-interactive` also requires explicit `--email`/`--token` flags.

### `forge register` needs a Developer Space (interactive)
Registering an app now requires membership of a Developer Space, and creating/naming one
is interactive — it fails in a non-TTY shell. Run `forge register` on the host in a real
terminal.

### Forge bundler rejects `moduleResolution: "bundler"` and needs emit
The bundler's `ts-loader` uses an older TypeScript. In the **backend** `tsconfig.json`:
- use `module`/`moduleResolution: "NodeNext"` (not `bundler` — bundling fails with TS6046),
- do **not** set `"noEmit": true` (ts-loader then emits nothing → "TypeScript emitted no
  output"). Use the `--noEmit` *CLI flag* for type-checking instead.

### `forge lint --fix` rewrites the manifest in place — and drops comments
**Symptom:** after `forge lint --fix`, `manifest.yml` loses **all its comments** (and key
order can shift), even when it reports "No issues found" and changes nothing semantic.
**Cause:** `--fix` re-serializes the manifest from the parsed YAML AST; comments aren't part
of the AST, so they're not round-tripped. It also won't *add* a missing required field for
you (it didn't add the issuePanel `icon` — see below).
**Fix:** don't run `--fix` on a hand-commented manifest. Use plain `forge lint` (no `--fix`)
to validate and apply fixes by hand. If you already ran it, `git restore manifest.yml` and
re-apply the change manually. Our manifest carries load-bearing rationale (the `layout:
blank`, CSP, and `tunnel.port` notes), so this is a real loss, not cosmetic.

### Local Node must match the manifest runtime
Manifest runtime is `nodejs22.x`; keep local Node on v22 (the Docker images pin it too).

## Deploy / install

### Dev install auto-tracks deploys
An app installed from the **development** environment picks up each `forge deploy`
automatically — no reinstall needed. Exception: when **scopes or content permissions
change**, run `forge install --upgrade`. (After a CSP change, still hard-refresh — see
above.)

### Where the app's pages appear — global vs project nav
A `jira:globalPage` shows up as a top-level entry in Jira's **global left navigation**
(under "Apps" → "Your apps"), reachable from anywhere. A `jira:projectPage` instead shows up
**inside a single project's left sidebar** (under that project's "Apps" section) and is
per-project (the site needs at least one project to view it). We ship the **globalPage** —
this app is a cross-project, picker-driven tool, so the global entry is its natural home; we
dropped an earlier `projectPage` as redundant once the global page covered the same shell.

### `jira:issuePanel` requires an `icon`; `jira:projectPage` / `jira:globalPage` do not
A `jira:issuePanel` module **fails `forge deploy`** without an `icon` property — the
projectPage module has no such requirement, so it's easy to miss when adding a second module
to a working manifest. The icon accepts an absolute URL **or** a path resolved against a
declared resource. We self-host it from the `main` resource (`frontend/dist`), bundled from
`frontend/public/panel-icon.svg` by Vite (publicDir → copied to `dist/`), so there's no
external CDN dependency. See `manifest.yml`. (`forge lint --fix` will *not* add the missing
field for you — it only reformats; see the CLI section.)

### Module `icon` needs the `resource:<key>;<path>` form — a bare path 404s silently
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

### `forge install --upgrade` in a non-TTY needs every prompt pre-answered
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

### Where apps render in Jira — and the issuePanel "click-to-add" trap
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

## Admin-only app-wide config WITHOUT `/mypermissions` — surface + resolver partition
The "approaching deadline" at-risk window is an **app-wide** setting only an **admin** should
change. Two non-obvious facts forced the mechanism:
- **Forge/OAuth apps cannot call `/rest/api/3/mypermissions`** — so there is **no runtime
  "is this caller an admin?" check** available to a resolver.
- **The fix is the module surface + a dedicated resolver.** Put the config UI on a
  **`jira:adminPage`** (Jira renders it *only* inside admin settings -> admin-only), and give
  that module its **own `function` resolver** (`src/admin.ts`). The bridge dispatches `invoke()`
  to **the calling module's resolver**, so `setAppConfig` — defined *only* in the admin resolver
  — is **unreachable from the non-admin global page / issue panel**. That partition IS the gate;
  the global page gets a read-only `getAppConfig`.
- **App-wide vs per-user storage is just the key shape.** `storage:app` is app-wide by default
  (one record per installation). Per-user blobs (`prefs.ts`, the old per-user settings) put the
  `accountId` *in* the key; the app-wide config uses a **fixed key with no accountId**. Same scope.
Refs: <https://developer.atlassian.com/platform/forge/manifest-reference/modules/jira-admin-page/> ;
<https://developer.atlassian.com/cloud/jira/platform/scopes-for-oauth-2-3LO-and-forge-apps/>

## Tunnel

### `forge tunnel` no longer requires Docker
Current CLI (12.x) runs tunnel **natively**. Older versions ran it inside a Docker
container (source of the symlink and Apple-Silicon bundling bugs). So Docker is justified
by the toolchain/preview story, not tunnel. The host-vs-container tunnel choice is covered
in the `docker-compose.yml` comments.
Ref: <https://developer.atlassian.com/platform/forge/tunneling/>

### Live frontend dev: `tunnel.port` proxies the iframe to Vite
A Custom UI resource accepts `tunnel: { port }` (schema:
`@forge/manifest/.../manifest-schema.json` → `HostedResourcesSchema`). With it set, `forge
tunnel` serves the iframe from a local dev server on that port instead of the static `path`,
so frontend edits are live without a `dist` rebuild. Pair it with `npm --prefix frontend run
dev` (real bridge, **not** `dev:mock`) pinned to 5173. Four facts that bite (the first two
cost me an afternoon — the iframe loads blank/broken and *looks* like the flow is broken):
- **The tunnel reads the *deployed* manifest, so you must `forge deploy` once after adding
  `tunnel.port`.** `forge lint` passing is not enough — the *installed* app has to carry the
  field or `forge tunnel` keeps serving the static `path` and the localhost proxy never
  engages. It is dev-only in that prod still serves the built `path`, but the field has to
  be *deployed* to take effect at tunnel time. Use `npm run deploy` (build + deploy).
- **Chrome 142+ Local Network Access blocks the localhost iframe.** A public origin
  (`*.atlassian.net`) loading a `localhost` iframe trips LNA; Chrome shows a permission
  prompt (looks like a site-notifications ask) on first load — **allow it**, or the iframe
  is a broken-frame icon. If dismissed, re-allow in site settings or set
  `chrome://flags/#local-network-access-check` to Disabled. Tunnelling Custom UI is
  **Chrome/Firefox only**.
- **HMR is dead through the tunnel** — the Custom UI CSP blocks Vite's HMR websocket, so
  it's edit → **reload the Jira page**, not hot-reload.
- Once `tunnel.port` is set, every `forge tunnel` *requires* the dev server running on 5173
  or the iframe is blank — `--strictPort` keeps the port honest.

### Stop the tunnel with ONE clean Ctrl+C — an interrupted shutdown pins the iframe to localhost
**Symptom:** with **no tunnel running** and the app freshly `forge deploy`-ed, the Jira page
shows the app area as a **broken-content glyph** (and opening the frame directly reads
"localhost refused to connect"). A hard-refresh doesn't fix it. The iframe is being routed
to a dead local tunnel port instead of the deployed build.
**Diagnose it from the parent page** — the iframe is cross-origin (console / `src` query
string are walled off), but the *host* of `iframe.src` is readable and tells you everything:
```js
[...document.querySelectorAll('iframe')].map(f => new URL(f.src).host)
// stuck:   ["localhost:8000"]   → tunnel routing (broken when no tunnel is up)
// healthy: ["…fc.atlassian-dev.net"] / a CDN host → deployed build
```
`localhost:8000` is Forge's **frontend** tunnel port (default 8000, increments to 8001, …;
*distinct* from the manifest `tunnel.port: 5173`, the Vite server that 8000 proxies to, and
distinct again from the **backend** resolver port cloudflared tunnels — a random port like
`19977`). Each fresh `forge tunnel` re-registers a frontend port, so the stuck host rolls
8001→8000 across sessions.
**Cause:** the docs say tunnel mode is purely command-driven — no cookie / browser / server
session, and a clean `Ctrl+C` reverts to the deployed app (verified: no `localStorage`/cookie
holds the port; the `localhost` host is re-served by Jira's backend on every hard reload, so
it's *server-side* routing state). But an **interrupted shutdown** — multiple Ctrl+C, a hard
`kill`/SIGKILL, or **killing the child `cloudflared` before `forge tunnel` finishes exiting**
— leaves that routing pinned to localhost. Community-confirmed; the documented recovery is
"run the tunnel again, press Ctrl+C **once**, and let it shut down completely."
**Fix / discipline:**
- Always stop with a **single SIGINT** (`kill -INT <forge-tunnel-pid>` or one Ctrl+C) and
  **wait for the process to exit on its own** (exit code 130). Do **not** send a second
  signal, SIGKILL it, or kill `cloudflared`/`sandbox-runner` out from under it.
- `forge tunnel` spawns a **`cloudflared`** child (the public tunnel for the resolver port)
  and a **`sandbox-runner`** (runs resolvers locally). On SIGINT in this environment
  `cloudflared` frequently **orphans** — reap it *after* `forge tunnel` has fully exited:
  `pgrep -x cloudflared` then `kill <pid>` (kill by PID; a `pkill -f "forge tunnel"` pattern
  self-matches the issuing shell). Leaving `cloudflared` alive holds the tunnel connection
  open, which can keep the platform thinking the tunnel is live.
- **If it's *already* stuck** (what happened here — documented so the next person doesn't
  repeat the whole dead-end tree): the *documented* recovery is a clean cycle — run the
  tunnel, **let the app fully initialize** through it (dev server up on 5173 so the frontend
  actually loads), then one Ctrl+C and let it fully exit. **But even that didn't clear it.**
  The `localhost:8000` binding survived, in order: a clean single-SIGINT cycle → reaping
  `cloudflared` → `forge deploy` → `forge deploy` with `tunnel.port` **removed** →
  `forge install --upgrade` → a **full `forge uninstall` + `forge install`** → and a by-the-book
  full-init clean stop. The browser is **provably clean** (no service worker, no
  cookie / `localStorage` / IndexedDB holds the port — checked). So it is **not** install-,
  manifest-, deploy-, or browser-state: it's an **Atlassian-side, developer-account tunnel
  session** for the (app, *development* environment) — the staff quote *"our systems still
  believe there is a tunnel running."* It's keyed to the developer **account**, which is why a
  *site*-level uninstall/reinstall doesn't touch it. **Only Atlassian clears it:** wait for the
  session lease to expire (time), or file developer support quoting that line.
- **Meanwhile the app is fully usable** by bringing the tunnel **+** dev server back up — then
  `localhost:8000` actually serves (frontend ← Vite on 5173, resolvers ← cloudflared). The
  *clean stop* is what's broken, **not** the build: the deployed bundle was verified fine (it
  renders the moment the tunnel serves that port).
Refs: <https://community.developer.atlassian.com/t/disable-forge-tunnel/96807>,
<https://community.developer.atlassian.com/t/forge-app-only-works-on-tunnel/85466>,
<https://developer.atlassian.com/platform/forge/tunneling/>

## Theming

Atlassian ships **two token generations — use the *refreshed* one** (modern dark page
surface `#1F1F21`, not the legacy `#1D2125`). The full rationale, the token reference table,
and the source files live in [`theming-i18n.md`](./theming-i18n.md); the resolved hexes the
app actually uses are in `frontend/src/shared/config/atlassian-tokens.ts`. The one
MUI-specific trap (the palette needs literal hex, not `var(--ds-*)`) is in
[`frontend.md`](./frontend.md).

## Jira REST API / real data

### Verify mapping against real Jira without deploying — REST + API token
The same Atlassian API token used for the Forge CLI also works for the **Jira REST API**
via HTTP basic auth (`-u "$FORGE_EMAIL:$FORGE_API_TOKEN"`). Great for checking real field
shapes against our hand-written types before wiring resolvers — no deploy/tunnel needed:
```bash
set -a; . ./.env; set +a
curl -s -u "$FORGE_EMAIL:$FORGE_API_TOKEN" -H "Accept: application/json" \
  "https://rashidshafeev.atlassian.net/rest/api/3/search/jql?jql=project=SAM1&fields=summary,status,assignee,priority,duedate"
```
Reads are safe; POST/PUT create/modify **real** data on the live site — confirm scope first.

### Real-data quirks the mock didn't surface
Found by inspecting the live `rashidshafeev.atlassian.net` projects (KAN, SAM1):
- **`priority` can be `null`** — KAN issues carry no priority. Our `IssuePriority` union
  must tolerate null (a null priority is simply "not low", so it never triggers the 🟡
  highlight). Don't assume every issue has a priority.
- **Status names are localized** (e.g. `К выполнению`, `В работе`). Drive logic off the
  stable `status.statusCategory.key` (`new`/`indeterminate`/`done`), never the display
  name; render the localized `name` as-is (Jira data values stay untranslated per i18n).
- **`/rest/api/3/search/jql`** is the current search endpoint (the old `/search` is
  deprecated); it returns `nextPageToken` for paging and omits `total` by default — don't
  rely on `total` for "are there issues" checks.

### Jira OpenAPI spec — don't codegen types from it
We checked the published spec (`swagger-v3.v3.json`, 2.4 MB, 420 paths, 966 schemas) to
see if `openapi-typescript` would beat hand-written types. It won't, for two structural
reasons:
- **`IssueBean.fields` is `{ additionalProperties: {}, type: object }`** — an untyped bag.
  Issue fields are *dynamic* (per-project custom fields), so the spec can't type them and
  neither can any generator. The exact fields we read (priority/assignee/status/duedate)
  come out as `unknown`.
- **Every sub-schema has `required: []`** — `Priority.name`, `User.accountId`, etc. are all
  optional, so codegen marks always-present fields as maybe-`undefined`: noisy and wrong.

The spec is auto-generated from internal annotations and historically hard to codegen from
(Atlassian ships a transformer just to make it generator-compatible; see JRACLOUD-68034).
The community answer at scale is a **hand-maintained typed client** (`jira.js`, ~100%
coverage), not codegen. Our narrow hand-written types are the scoped-down version of that;
scale-up path is adopting `jira.js`, not `openapi-typescript`. Real safety lives at the
**mapping boundary** (normalize null priority, read `statusCategory.key`), which is the one
layer codegen can't help with anyway.
