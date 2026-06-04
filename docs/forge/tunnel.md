# Tunnel

## `forge tunnel` no longer requires Docker
Current CLI (12.x) runs tunnel **natively**. Older versions ran it inside a Docker
container (source of the symlink and Apple-Silicon bundling bugs). So Docker is justified
by the toolchain/preview story, not tunnel. The host-vs-container tunnel choice is covered
in the `docker-compose.yml` comments.
Ref: <https://developer.atlassian.com/platform/forge/tunneling/>

## Live frontend dev: `tunnel.port` proxies the iframe to Vite
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

## Stop the tunnel with ONE clean Ctrl+C — an interrupted shutdown pins the iframe to localhost
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
