# Custom UI iframe constraints

Constraints the Forge host imposes on a Custom UI iframe. They surface in the frontend, but
the *cause* is the platform — so they live here; the MUI/DataGrid fixes they motivate are in
[`../frontend.md`](../frontend.md).

## MUI/Emotion render unstyled — CSP blocks inline styles
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

## projectPage `layout`: use `blank`, not `basic` (full-bleed, no left gutter)
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

## Height: projectPage auto-resizes — no fixed viewport, so no "fill-to-bottom"
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
  [`../frontend.md`](../frontend.md) / `AppDataGrid`):
  - *Mock* (standalone page) — a real viewport exists, so we use a `100vh` flex-column shell;
    the table fills to the bottom and scrolls **internally** (DataGrid virtualization).
  - *Forge* (auto-resizing iframe) — **no fixed height**; the DataGrid uses `autoHeight`
    (grows to its rows) and the Jira page scrolls. Fill-to-bottom is impossible here by
    design; the page growing is the native, recommended model.
- This means a large project renders a tall page in Forge. The scale-up fix is real
  `searchIssues` pagination (server-side), not a fixed-height scroller. Tracked as pending.
Refs: <https://community.developer.atlassian.com/t/17-aug-2021-automatic-resizing-for-custom-ui-apps/51096>

## `@forge/bridge` throws on import outside a Forge host
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
