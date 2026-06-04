# Forge CLI / build

## No system keychain → use env vars
This environment has no libsecret/keychain, so `forge login` can't store credentials.
Forge reads `FORGE_EMAIL` + `FORGE_API_TOKEN` from the environment instead — we keep them
in `.env` (gitignored) and `set -a; . ./.env; set +a` before any forge command.
`forge login --non-interactive` also requires explicit `--email`/`--token` flags.

## `forge register` needs a Developer Space (interactive)
Registering an app now requires membership of a Developer Space, and creating/naming one
is interactive — it fails in a non-TTY shell. Run `forge register` on the host in a real
terminal.

## Forge bundler rejects `moduleResolution: "bundler"` and needs emit
The bundler's `ts-loader` uses an older TypeScript. In the **backend** `tsconfig.json`:
- use `module`/`moduleResolution: "NodeNext"` (not `bundler` — bundling fails with TS6046),
- do **not** set `"noEmit": true` (ts-loader then emits nothing → "TypeScript emitted no
  output"). Use the `--noEmit` *CLI flag* for type-checking instead.

## `forge lint --fix` rewrites the manifest in place — and drops comments
**Symptom:** after `forge lint --fix`, `manifest.yml` loses **all its comments** (and key
order can shift), even when it reports "No issues found" and changes nothing semantic.
**Cause:** `--fix` re-serializes the manifest from the parsed YAML AST; comments aren't part
of the AST, so they're not round-tripped. It also won't *add* a missing required field for
you (it didn't add the issuePanel `icon` — see [`surfaces.md`](./surfaces.md)).
**Fix:** don't run `--fix` on a hand-commented manifest. Use plain `forge lint` (no `--fix`)
to validate and apply fixes by hand. If you already ran it, `git restore manifest.yml` and
re-apply the change manually. Our manifest carries load-bearing rationale (the `layout:
blank`, CSP, and `tunnel.port` notes), so this is a real loss, not cosmetic.

## Local Node must match the manifest runtime
Manifest runtime is `nodejs22.x`; keep local Node on v22 (the Docker images pin it too).
This governs the *backend* bundling/tunnel only — the frontend build and tooling have no
`engines` pin and run on any modern Node. `app.runtime.name` is a **required selector** for
Atlassian's hosted FaaS runtime (one exact value from Forge's supported list), not a
minimum-version prerequisite on your machine — it can't be removed or set to a range.
