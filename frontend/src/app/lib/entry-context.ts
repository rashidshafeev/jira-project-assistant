/**
 * Which view the bundle renders. The SAME `frontend/dist` is served for ALL THREE
 * Forge modules — the `jira:globalPage` (the full assistant shell, in Jira's global
 * nav), the `jira:issueContext` (the single-issue verdict, in the issue's context
 * sidebar), and the `jira:adminPage` (the app-wide settings, in Jira admin) — so we
 * branch on the Forge context at bootstrap instead of shipping three HTML entries
 * (Forge resources serve `index.html` from a directory, and `base: './'` + a nested
 * multi-page build breaks the iframe asset paths). The branch happens before `App`
 * renders, so the providers/theme/i18n shell stays unconditional.
 *
 * `page` = the global page (no issue in context). `panel` = the issue context view
 * (the host issue in context). `admin` = the admin settings page. The global page is
 * not project-scoped — its context carries no project — so `page` holds no
 * `projectKey`; the in-app picker chooses the project (defaulting to the first one).
 */
export type EntryContext =
  | { mode: 'page' }
  | { mode: 'panel'; issueKey: string; projectKey: string }
  | { mode: 'admin' }

/**
 * Manifest `key` of the `jira:adminPage` module. The admin page and the global page
 * both render with no issue/project in context, so they can't be told apart
 * structurally — only by the module identity Forge reports. `moduleKey` (the
 * documented `view.getContext()` field, equal to the manifest key) is that signal.
 */
const ADMIN_MODULE_KEY = 'project-assistant-admin'

/**
 * The slice of Forge's `view.getContext()` we read for routing. Typed structurally
 * (not imported from `@forge/bridge`) so this module never pulls the bridge in — it
 * runs in the mock too. The `issueContext` extension carries the host issue + project;
 * the `globalPage` extension has no `issue`, which is how we tell those two apart, and
 * `moduleKey` (the manifest module key) is how we pick out the admin page.
 */
interface ForgeContextish {
  moduleKey?: string
  extension?: {
    issue?: { key?: string }
    project?: { key?: string }
  }
}

/**
 * Forge routing: the admin page first (by `moduleKey` — it shares the issue-less
 * shape with the global page, so nothing else distinguishes it); then a panel iff
 * the context carries an issue (the issueContext module does, the globalPage
 * doesn't); otherwise the global page.
 */
export function resolveForgeEntry(context: ForgeContextish): EntryContext {
  if (context.moduleKey === ADMIN_MODULE_KEY) return { mode: 'admin' }
  const issueKey = context.extension?.issue?.key
  const projectKey = context.extension?.project?.key
  if (issueKey && projectKey) return { mode: 'panel', issueKey, projectKey }
  return { mode: 'page' }
}

/**
 * Mock preview: there is no Forge context, so the view is opened by URL — `?admin`
 * for the settings page, `?panel=DEMO-4` for the issue panel (its project key is the
 * issue key's prefix, all the fixtures need; in Forge it comes from the context).
 * Anything else is the global page. The MockHost switcher drives the same routes.
 */
export function resolveMockEntry(): EntryContext {
  if (typeof window === 'undefined') return { mode: 'page' }
  const params = new URLSearchParams(window.location.search)
  if (params.has('admin')) return { mode: 'admin' }
  const issueKey = params.get('panel')
  if (issueKey) {
    const projectKey = issueKey.split('-')[0] ?? ''
    return { mode: 'panel', issueKey, projectKey }
  }
  return { mode: 'page' }
}
