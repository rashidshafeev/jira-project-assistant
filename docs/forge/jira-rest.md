# Jira REST API / real data

## Verify mapping against real Jira without deploying — REST + API token
The same Atlassian API token used for the Forge CLI also works for the **Jira REST API**
via HTTP basic auth (`-u "$FORGE_EMAIL:$FORGE_API_TOKEN"`). Great for checking real field
shapes against our hand-written types before wiring resolvers — no deploy/tunnel needed:
```bash
set -a; . ./.env; set +a
curl -s -u "$FORGE_EMAIL:$FORGE_API_TOKEN" -H "Accept: application/json" \
  "https://rashidshafeev.atlassian.net/rest/api/3/search/jql?jql=project=SAM1&fields=summary,status,assignee,priority,duedate"
```
Reads are safe; POST/PUT create/modify **real** data on the live site — confirm scope first.

## Real-data quirks the mock didn't surface
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

## Jira OpenAPI spec — don't codegen types from it
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
