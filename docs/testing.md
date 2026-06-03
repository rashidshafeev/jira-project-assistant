# Testing Strategy

The automated suite is **end-to-end (Playwright) driven against the in-memory mock**.
That single layer is a deliberate fit for an app this shape (see "Why E2E-first" below),
and it runs deterministically in CI with no Jira site, account, or network.

## How tests run

`npm test` (alias `npm run e2e`) runs Playwright. `playwright.config.ts` boots the
standalone frontend with the mock transport (`npm run dev:mock`, `VITE_USE_MOCKS=true`) on
`:5173` via its `webServer` block — reusing an already-running dev server if present, else
starting and later tearing one down — and drives it in headless Chromium. The browser binary
is fetched automatically on the first run by the `pretest` hook (`playwright install
chromium`, idempotent), so `npm test` is self-contained from a fresh checkout.

Specs live in `e2e/tests/<flow>/` — one folder per flow, each a shared `*.spec.ts` (the
journey) + `*.data.ts` (per-target values) + `*.assertions.ts`. **Error cases live with the flow
they belong to** as `*.errors.spec.ts` (tagged `@mock-only`), not in a separate bucket — an
error is the failure mode of a specific flow (issues-load forbidden, assign conflict, members
429), so it's co-located with that flow's happy path. A genuinely cross-cutting error (e.g. the
app shell / project picker failing) would instead get its own flow folder.

| Spec | Tag | Flow it pins |
|---|---|---|
| `issues/issues.spec.ts` | `@smoke` | default project loads; unassigned issue shows its marker + Fix button; problem **pips** (one vs two) + the time-left tooltip |
| `issues/issues.errors.spec.ts` | `@mock-only` | an injected read failure shows the **localized** message; Retry recovers |
| `fix-issue/fix-issue.spec.ts` | `@smoke` | Fix dialog → assign a member, **or** raise a near-deadline issue's priority → the row updates and the problem clears |
| `deadline-window/deadline-window.spec.ts` | `@smoke` | widening/narrowing the at-risk window flags/unflags an issue + moves the tally; the choice persists across reload |
| `team/team.spec.ts` | `@smoke` | Team tab lists members; the inactive member is flagged |
| `auto-assign/auto-assign.spec.ts` | `@smoke` | bulk auto-assign → confirm dialog → success toast → nothing left to assign |
| `jira-smoke.spec.ts` | `@jira` | read-only PoC: the real app's grid renders inside the Forge iframe |

Specs that assert deadline-driven classification (`deadline-window`, the `fix-issue` raise
case, the `issues` markers case) **pin the clock** with `page.clock.setFixedTime` — the mock
fixtures use fixed due dates, so a frozen "now" keeps the at-risk counts deterministic instead
of drifting as real time passes.

The dual-target foundation (frame-aware page object, the `{ app, target }` base fixture, each
target's connect/auth/seed) lives in `e2e/testing/{shared,mock,jira}` — see "One suite, two
targets".

## Why E2E-first (and where the seam is)

The decisive fact is **where this app's seam is**:

```
 React UI ──invoke(name,payload)──▶ Forge bridge ──▶ resolver ──requestJira()──▶ Jira REST
          └─────── seam A ────────┘ (postMessage, NOT http)  └──── seam B (real HTTP) ────┘
```

- **Seam A — frontend ↔ bridge** is a `postMessage`, **not** an HTTP call, so
  MSW / WireMock / Prism don't apply — there is no request to intercept. The right double
  is a double *at the contract*: exactly our `/mock` engine, swapped in behind
  `VITE_USE_MOCKS`. Driving the real UI over that double is what the Playwright lane does.
- **Seam B — resolver ↔ Jira REST** is where real-world failures live (429, 401/403, 404,
  localized/absent fields). `requestJira` needs Forge runtime context, so there's no raw
  HTTP for `nock`/MSW to catch off-platform.

The backend is a **thin proxy with no business logic**, and the only real logic — the
mappers (`shared/api/{issue,member,project}.ts`) and the auto-assign plan
(`features/auto-assign/model/plan.ts`) — is **pure**. Pure code is trivially unit-testable
in isolation; here we exercise it **through the real UI** via the mock lane, which also
covers the wiring a unit test wouldn't: TanStack Query loading/error/optimistic states, the
problem highlighting, and the error surfacing.

## Deterministic error injection

Errors are injected **deterministically**, never via a random failure rate — a flaky knob
would make the suite non-reproducible for zero benefit, since arming a specific code on cue
already covers every error-UX branch. The `@mock-only` specs arm a specific `ErrorCode` for
an action via the `?fault=getIssues:forbidden` URL param or the `window.__mock.fail/pass/clear`
handle (see [`/mock/mock-db.ts`](../mock/mock-db.ts)). A test arms the fault, asserts the
localized message + Retry button, clears it, then asserts recovery. A *non-retryable* code
(`forbidden`) is used so the error surfaces immediately, before TanStack Query's
auto-retry/backoff would kick in.

Faults aren't read-only: every operation goes through the same gate, so **mutations** can
fail too — `?fault=assignIssue:conflict` exercises the Fix dialog's mutation error path.
Multiple faults chain: `?fault=getIssues:forbidden,assignIssue:conflict`. The one other knob
is `VITE_MOCK_LATENCY_MS` (default 400ms), which delays every mock call so loading states are
observable.

**Trigger faults by hand** in the standalone preview — no test required: append `?fault=…`
to the `localhost:5173` URL, or use the runtime handle in the browser console —
`window.__mock.fail('getMembers', 'rateLimited')` to arm, `window.__mock.faults()` to inspect,
`window.__mock.clear()` to recover. (The UI never calls `pass()` itself, which is why pressing
Retry can't clear an *armed* deterministic fault — only disarming it can; a real transient,
by contrast, clears on the next request.)

## One suite, two targets

The specs are authored to run against **either** the mock or a real site, and the layout makes
the split explicit:

- **`e2e/tests/<flow>/`** — one folder per user journey: a target-agnostic `*.spec.ts` flow, its
  per-target values (`*.data.ts` — a `{ mock, jira }` table), and reusable `*.assertions.ts`.
- **`e2e/testing/{shared,mock,jira}/`** — the dual-target foundation: a frame-aware page object
  (`shared/app-page.ts`; selectors by ARIA role + accessible name + the grid's stable `data-id`,
  never CSS classes or mock internals), the `{ app, target }` base fixture (`shared/base.ts`),
  and each target's connect/auth/seed (`mock`/`jira` `target.ts` + `jira/auth.setup.ts`).

So the flow logic + assertions are shared verbatim; only the `*.data.ts` values and the target
foundation differ. `playwright.config.ts` gates the **`jira`** project behind `JIRA_APP_URL`, so
the default `npm test` stays mock-only. Driving a real site needs **things the mock lane
doesn't** — what makes a full real-Jira lane real work, not a flag flip:

1. **`baseURL` = the Project-Assistant *page* URL** (the Jira route that embeds the app), not
   the bare Custom UI URL — `@forge/bridge` only works inside the embedding Jira page (loaded
   standalone, its `invoke()` calls have no Forge host to answer and hang).
2. **`storageState`** — a saved Atlassian login (`e2e/.auth/jira.json`, gitignored): the
   `jira-setup` project reuses it while valid and logs in from `JIRA_LOGIN`/`JIRA_PASSWORD`
   only when it's missing/expired — clearing Atlassian's post-password interstitials, incl. an
   interactive 2-step-code hand-off. SSO/CAPTCHA still need a manual capture. See the PoC below.
3. **Portable selectors** — two sub-problems the PoC surfaced live. *(a) Frame — **done:*** the
   page object now queries through an injected root (the `Page` for mock, a `frameLocator` for
   jira, wired by the base fixture), so the same selectors reach into the cross-origin Forge
   iframe. *(b) Locale — **remaining:*** the real account renders in **`ru`**, which breaks every
   selector keyed on an English accessible name (project picker, tabs, dialog buttons); only the
   structural anchors survive — the grid's `data-id` rows and the "lone button in the row" Fix.
   The fix is stable `data-testid`s in the app — see "Promoting to the full dual-target lane".
4. **Real data — fill the `jira` `*.data.ts` + REST seed/teardown.** Each flow's `*.data.ts` has
   a `jira` branch that currently uses a `pending()` sentinel (type-checks as the data shape but
   throws if read); wiring it means seeding the fixture issues/members before the run and cleaning
   up after (this **writes real data** to the live site).

The `@mock-only` fault specs can't run against a real site (you can't tell Jira to fail on
cue). Building the *full* lane stays deliberately deferred — high-maintenance to keep green,
and the mock lane already gives deterministic UI confidence — but the proof-of-concept below
de-risks the novel piece (#3 framing) and, as it turned out, surfaced the locale snag too.

**What runs where.** Same suite, but each lane runs a different slice — and "shared" describes
the *code*, not that both lanes execute it today:

| | runs on **mock** | runs on **jira** |
|---|---|---|
| happy-path flows (`@smoke`) | ✅ green | ⛔ not yet — code is shared & ready, but jira `*.data.ts` is `pending()` and some chrome assertions are still English-bound (the `data-testid` work) |
| error cases (`*.errors.spec.ts`, `@mock-only`) | ✅ green | ✖ never — can't provoke a live 403/429 on cue |
| read-only PoC (`@jira`) | — excluded | ✅ green |

So today the **mock** lane runs everything except the PoC; the **jira** lane runs **only** the
read-only PoC. The happy-path flows are written once to run on both — flipping jira green is the
work in "Promoting to the full dual-target lane" below. The error cases are mock-only
*permanently*: the deterministic fault injection (`?fault=` / `window.__mock`) has no live-Jira
equivalent.

### Real-Jira smoke: proof of concept

`e2e/jira-smoke.spec.ts` (tagged `@jira`, **read-only**) is a minimal, runnable PoC of the
genuinely novel piece: driving the real app inside the cross-origin Forge iframe against live
data. It skips seeding — it asserts only that the app's grid renders, and never writes Jira data.

**Authenticate the lane.** The embedded iframe needs a real Atlassian *web session* — an API
token only does REST Basic auth, not the browser session the app runs in. The `jira-setup`
project ([`e2e/testing/jira/auth.setup.ts`](../e2e/testing/jira/auth.setup.ts)) is **session-first**: it reuses
`e2e/.auth/jira.json` (gitignored; override with `JIRA_STORAGE`) while that session still
authenticates, and only logs in when it's missing or expired — so the login (and any 2-step
code) is a once-every-few-weeks event, not a per-run cost.

When it *does* log in, it drives `id.atlassian.com` from `JIRA_LOGIN` + `JIRA_PASSWORD` (read
from env only, never logged — use a **dedicated test account**) and clears the interstitials
Atlassian interleaves after the password: the **"Security review"** enrol-2SV promo is
auto-declined, and an **emailed 2-step code** is handled by an *interactive hand-off* — set
`JIRA_OTP_FILE` and, when the run pauses, drop the 6-character code into that file (it polls
for 5 min):

    # in a second terminal, once the email arrives:
    echo WQPTVF > e2e/.auth/otp.txt

A CAPTCHA / "verify it's you" / SSO or passkey redirect can't (and shouldn't) be scripted — the
run **fails fast** naming where it stalled. Do a **manual capture** then: a browser opens, *you*
log in (the script never sees your password), and the session is saved —

    npx playwright codegen https://<site>.atlassian.net --save-storage=e2e/.auth/jira.json

(on a headless box, run that where there's a display, then copy the JSON into `e2e/.auth/`).

Then point the lane at the app page and run it:

```bash
# Open the Project Assistant page in Jira, copy its WHOLE URL from the address bar — it
# looks like .../projects/<KEY>/apps/<app-id>/<route-id> (two UUIDs, no friendly suffix):
export JIRA_APP_URL="https://<site>.atlassian.net/jira/software/projects/<KEY>/apps/<app-id>/<route-id>"

# Already have a valid e2e/.auth/jira.json? Just run it — setup reuses the session, no creds:
npx playwright test --project=jira

# First login (or after expiry): creds for a DEDICATED test account; JIRA_OTP_FILE enables
# the 2-step-code hand-off if the account is challenged. The saved session is then reused.
export JIRA_LOGIN="you@example.com" JIRA_PASSWORD="…" JIRA_OTP_FILE="e2e/.auth/otp.txt"
npx playwright test --project=jira   # runs jira-setup (login) first, then the @jira PoC
```

The first run logs every frame URL. If the grid assertion times out, the iframe selector
needs tuning for your site: pick the app's iframe from that list and pass it as
`JIRA_APP_FRAME` (Forge Custom UI can be double-nested — chain `frameLocator` if so).

**Serve the iframe from local code (optional).** With the
[live-dev tunnel](../README.md#live-frontend-dev-against-real-jira-no-docker) running
(`npx forge tunnel` + `npm --prefix frontend run dev`), the iframe loads your *un-deployed*
frontend, so this PoC tests local changes against **real Jira data without a deploy** — the
automated analog of the manual live-dev loop. (Needs the Chrome Local Network Access
allowance, same as manual tunnelling.)

### Promoting to the full dual-target lane (future refinement)

The guiding principle is **share everything that can be shared** — a flow asserted once should
read against either target — and the suite is structured to make that real:

- **Per-flow folders** (`e2e/tests/<flow>/`): a target-agnostic `*.spec.ts` (the journey, shared
  verbatim), a `*.data.ts` holding a `{ mock, jira }` value table, and reusable `*.assertions.ts`.
- **A shared foundation** (`e2e/testing/`): the frame-aware page object (`shared/app-page.ts`),
  the `{ app, target }` base fixture (`shared/base.ts`) that roots the page object per target, and
  each target's connect/auth/seed (`mock/target.ts`, `jira/target.ts`, `jira/auth.setup.ts`).
- **One config, one page object, one set of specs.** The `mock` and `jira` projects differ only
  in `baseURL` / `storageState` / grep.

So a spec body never branches on target — it reads `myData[target]` and drives `app`. What's left
to turn the read-only PoC into the *full* `@smoke`-against-real-Jira lane:

1. **Frame-root the page object — done.** `AppPage` takes an injected query root; the base fixture
   hands it the `Page` for mock and `page.frameLocator(FRAME)` for jira (page-level actions like
   `goto`/`keyboard` stay on the `Page`, which a `FrameLocator` lacks). This was the one piece the
   PoC de-risked, and it now lives in `e2e/testing/`.
2. **Reference chrome by stable ids, not localized names — remaining.** The live account is `ru`,
   so `getByRole('combobox', { name: 'Project' })`, the `Issues`/`Team` tabs, and the dialog's
   `Assign` / `Auto-assign` / `Retry` buttons all miss. The row grid already does it right — it
   selects by `data-id` and matches the Fix action as "the lone button in the row" (both
   locale-proof). **Extend that pattern to the chrome**: add a small set of `data-testid`s in the
   app — e.g. `project-picker`, `tab-issues`, `tab-team`, `assign-submit` — and select by those.
   It decouples the tests from copy *and* locale in one move; an i18n app shouldn't pin its tests
   to one language's labels. `app-page.ts` is the single place those selectors live (its header
   flags exactly which are locale-bound). The alternative — forcing the account/app to `en` — is
   cheaper today but brittle (anyone on a non-English account re-breaks it).
3. **Seed + fill the real data — remaining.** Replace each flow's `pending()` `jira` data with the
   seeded project's real keys/members, and implement `jiraTarget.seed()` (REST seed-before /
   cleanup-after) — this **writes** to the live site (the existing `[Seed]` issues on SAM1 show the
   convention). Assertions stay shared; only the values and the create/clean lifecycle are
   per-target.

Then the `jira` project's grep widens from `/@jira/` to `/@smoke/` and the whole headline suite
runs against real Jira.

**Stays unshared, by nature:** the auth/setup step
([`e2e/testing/jira/auth.setup.ts`](../e2e/testing/jira/auth.setup.ts) — the mock needs none) and
the `@mock-only` error specs (`*.errors.spec.ts`, e.g. `tests/issues/issues.errors.spec.ts`; you
can't make real Jira return 429/403 on cue).

One honest caveat the PoC exposed: a *visible grid* (all `jira-smoke.spec.ts` asserts) proves
the iframe + bridge + mount, **not** that data arrived — an empty project renders a grid too.
The data assertions (row counts, known issue keys) belong to the full lane above; the smoke PoC
stays deliberately minimal.

## Not covered (and why that's acceptable here)

- **Component tests (React Testing Library)** — focused, faster-feedback coverage of single
  components, mocking `invoke` at seam A (the documented community pattern: a tiny
  register/reset stub — see the Atlassian
  [dev community thread](https://community.developer.atlassian.com/t/testing-forge-custom-ui-components-using-jest/50320)).
  The E2E lane already covers the headline flows; this would be the next increment as the UI grows.
- **Backend unit tests** — the backend is a deliberately thin proxy with nothing to assert
  beyond "request shaped right / error mapped right". `npx tsc --noEmit` covers its types
  (the wire vocabulary is shared with the frontend via `@types`/`@result`, so drift is a
  compile error), and the E2E lane covers the behavior the user actually sees.

## On the error matrix without triggering it

You can't provoke every Jira status (you never hit a real 429), but you don't need to:
Jira's error envelope is standardized (`{ errorMessages, errors }`) and the OpenAPI spec
documents which statuses each endpoint can return. The `src/endpoints/` registry
**enumerates that matrix as data**, and the central `status → ErrorCode` translation lives
in one place (`src/result.ts`) — so the codes the UI must handle are catalogued and
single-sourced. See [`docs/api/endpoints.md`](./api/endpoints.md) for the provenance
(best-effort spec-derived vs. ground-truth observed) and how the catalog grows.
