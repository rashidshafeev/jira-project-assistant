# Forge / Jira platform gotchas

A running log of non-obvious **platform** quirks hit while building this app, with the fix
for each — split by topic. These are Forge/Jira *platform* constraints; our own backend API
lives in [`../api/`](../api/), and frontend/MUI quirks (DataGrid, the Emotion/theme palette)
live in [`../frontend.md`](../frontend.md).

| Topic | What's in it |
| --- | --- |
| [`custom-ui.md`](./custom-ui.md) | Custom UI iframe constraints: CSP-blocked inline styles, `layout: blank`, iframe height auto-resize, `@forge/bridge` throws on import |
| [`surfaces.md`](./surfaces.md) | Render surfaces & entry modes: global page vs project nav, `issueContext` vs the `issuePanel` click-to-add trap, module `icon` resolution |
| [`storage.md`](./storage.md) | Forge KV storage: app-wide vs per-user (key shape), `accountId` from resolver context, consistency/limits, and admin-only config gating without `/mypermissions` |
| [`modals.md`](./modals.md) | MUI `<Dialog>` vs the native Forge `Modal` — what each costs and which to use where |
| [`cli-build.md`](./cli-build.md) | Forge CLI / build: no keychain → env vars, `forge register` TTY, the backend `tsconfig` bundler rules, `lint --fix` drops comments, local Node ⇄ runtime |
| [`deploy-install.md`](./deploy-install.md) | Deploy / install: dev install auto-tracks deploys, `install --upgrade` in non-TTY |
| [`tunnel.md`](./tunnel.md) | `forge tunnel`: no Docker, `tunnel.port` live frontend dev, the clean-Ctrl+C-or-pin-to-localhost trap |
| [`jira-rest.md`](./jira-rest.md) | Jira REST API / real data: verify mapping without deploying, real-data quirks, why not to codegen from the OpenAPI spec |

**Theming** has its own home: the token rationale + reference is in
[`../theming-i18n.md`](../theming-i18n.md) (resolved hexes in
`frontend/src/shared/config/atlassian-tokens.ts`); the MUI-palette trap — needs literal hex,
not `var(--ds-*)` — is in [`../frontend.md`](../frontend.md). Use the **refreshed** token
generation (modern dark surface `#1F1F21`, not the legacy `#1D2125`).
