# Jira endpoints we consume — and what can go wrong

This is the **failure-mode catalog** for the Jira REST v3 endpoints this app calls. It
answers "what can really go wrong on each endpoint, and what do we do about it?" — knowledge
that varies per endpoint and isn't expressible in the types.

It mirrors the typed registry in [`src/endpoints/`](../../src/endpoints), which is the
source of truth. Keep them in step (the registry is data; this table is its readable face).

## How errors are handled (the part that's NOT per-endpoint)

Error *handling* is centralized on purpose — there is **one** mapping from HTTP status to our
normalized [`ErrorCode`](../../src/result.ts), in [`src/result.ts`](../../src/result.ts):

| Status | `ErrorCode` | Status | `ErrorCode` |
|---|---|---|---|
| 400, 422 | `validation` | 404 | `notFound` |
| 401 | `unauthorized` | 409 | `conflict` |
| 403 | `forbidden` | 429 | `rateLimited` |
| | | (other) | `unknown` |

The frontend branches on the **code** (never the status) and renders an i18n message
(`errors.*`); the mock throws the same codes. This `status → ErrorCode` table is
single-sourced in [`src/result.ts`](../../src/result.ts), and each endpoint's spec below
just lists the statuses it can return — so every code the UI handles is catalogued through
this one mapping.

> **On messages:** the Jira OpenAPI spec documents *which* status codes an endpoint can
> return and the `ErrorCollection` envelope shape — but **not** the runtime `errorMessages`
> strings, which are localized and dynamic (our recorded 404 came back in Russian). So we
> never surface Jira's text to the user; the `Observed` notes below are reference examples
> only.

## How accurate is this, and how it grows

Be honest about provenance — the rows below are **two different grades of truth**:

- **Best-effort** — most `Status / Code / When` entries are derived from the documented spec
  (which codes an endpoint *can* return) plus reasoning about our usage. They're
  accurate-leaning but **not** all individually reproduced on the live API.
- **Ground-truth** — only the **`Observed`** notes are real: an actual envelope we captured
  from live Jira (e.g. the localized 404 on `getIssue`). Those are the rows you can fully
  trust.

This is **by design**. The catalog is meant to *grow from reality* (the "error ratchet" in
[`extending.md`](../extending.md)): when we hit a real error against live Jira, we append it to
that endpoint's spec in [`src/endpoints/`](../../src/endpoints) — ideally promoting a
best-effort row to an `Observed` one with the real (localized) message. The central
`status → ErrorCode` mapping in [`src/result.ts`](../../src/result.ts) then translates it
consistently — no per-endpoint code to touch.

To deliberately harden the high-value rows (rather than wait to stumble into them), trip them
on purpose while tunnelling (`forge tunnel`) against the dev site and record the envelopes:

- **`assignIssue` / `setPriority` 403** — temporarily remove the acting user's *Assign issues*
  / *Edit issues* permission on the KAN project, then invoke the Fix action.
- **`setPriority` 400** — POST a bad `priority.id`, or aim it at a team-managed issue whose
  Priority field isn't on the edit screen (the null-priority case).
- **`getAssignableUsers` / `searchIssues` 4xx** — request a deleted/renamed project key.

Capture each real `{ errorMessages, errors }` body and record the string in the matching
spec's `observed`. Until then, treat un-`Observed` rows as "expected, not proven".

## Common to every endpoint

| Status | Code | When | What we do |
|---|---|---|---|
| 401 | `unauthorized` | Forge app session / OAuth token missing or expired. | `errors.unauthorized` — prompt a page reload. |
| 429 | `rateLimited` | Jira cost-based rate limit exceeded. | `errors.rateLimited` — back off and retry. |

---

## `getProjects` · `GET /rest/api/3/project/search`

List projects visible to the current user (for the project picker).

| Status | Code | When | What we do |
|---|---|---|---|
| 400 | `validation` | Invalid query params (maxResults/startAt range, bad expand). | Surface `errors.validation`. |

**Note:** permission-limited users get a *smaller* list, not a 403 — an empty result means
"no visible projects" (empty state), not an error.

## `getAssignableUsers` · `GET /rest/api/3/user/assignable/search`

Members assignable to issues in a project (Fix dialog + auto-assign pool).

| Status | Code | When | What we do |
|---|---|---|---|
| 400 | `validation` | Malformed project / user filter. | Surface `errors.validation`. |
| 404 | `notFound` | Project doesn't exist or isn't visible. | `errors.notFound` — selected project may be deleted; refetch projects. |

**Note:** returns each user's `active` flag; we filter to active members before assigning
(auto-assign round-robins only over active ones).

## `searchIssues` · `GET /rest/api/3/search/jql`

Issues for a project (the main table). Uses the current `/search/jql`, not the deprecated
`/search`. Requests a narrow `fields` set (`summary,status,assignee,priority,duedate`).

| Status | Code | When | What we do |
|---|---|---|---|
| 400 | `validation` | Invalid JQL — unknown project key or a field absent on the site. | We build the JQL from the selected key, so a 400 usually means the key is stale; refetch projects. |

**Note:** the endpoint paginates; we cap at `maxResults=100` with no cursor loop yet.
Widening `fields` is where new columns get added.

## `getIssue` · `GET /rest/api/3/issue/{issueIdOrKey}`

A single fresh issue — used to re-read after a write (assign / setPriority).

| Status | Code | When | What we do |
|---|---|---|---|
| 404 | `notFound` | Issue doesn't exist **or** the user can't view it — Jira conflates the two (privacy). | `errors.notFound` — never report "no permission" vs "deleted"; tell the user to refresh. |

**Observed (live, RU):** `errorMessages: ["Запрашиваемая задача не существует либо у вас нет
прав на её просмотр."]` — captured from the live site; the recorded tape was not retained
(re-capture to restore a replayable fixture).

## `assignIssue` · `PUT /rest/api/3/issue/{issueIdOrKey}/assignee`

Set (or clear, with `accountId: null`) an issue assignee. Body: `{ accountId }`. Success is
204 No Content; the resolver re-reads via `getIssue` so the frontend gets the fresh issue.

| Status | Code | When | What we do |
|---|---|---|---|
| 400 | `validation` | Invalid body or unknown accountId. | Surface `errors.validation`. |
| 403 | `forbidden` | User lacks the "Assign issues" permission. | `errors.forbidden` — don't retry; roll the optimistic update back. |
| 404 | `notFound` | Issue not found or not visible. | `errors.notFound`. |

## `setPriority` · `PUT /rest/api/3/issue/{issueIdOrKey}`

Edit issue fields — we set only `priority.id` (the "raise priority" fix). Body:
`{ fields: { priority: { id } } }`. Success is 204 No Content.

| Status | Code | When | What we do |
|---|---|---|---|
| 400 | `validation` | Invalid priority id, **or** Priority isn't on the issue's edit screen. | See note. |
| 403 | `forbidden` | User lacks the "Edit issues" permission. | `errors.forbidden`. |
| 404 | `notFound` | Issue not found or not visible. | `errors.notFound`. |

**Note (the important one):** ties directly to the null-priority finding — team-managed
projects may not expose Priority at all, so a raise could 400 even though a button was shown.
A null priority counts as **not low** (`entities/issue/model/problem.ts`), so it never
triggers the `lowPriorityNearDeadline` finding; the raise UI renders only for
low-priority-near-deadline issues (`features/fix-issue/ui/FixIssueDialog.tsx`), so we never
offer a raise on a priority-less issue that would 400.
