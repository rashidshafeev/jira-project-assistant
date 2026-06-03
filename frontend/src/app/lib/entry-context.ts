/**
 * Which view the bundle renders. The SAME `frontend/dist` is served for both Forge
 * modules — the `jira:globalPage` (the full assistant shell, in Jira's global nav) and
 * the `jira:issueContext` (the single-issue verdict, in the issue's context sidebar) —
 * so we branch on the Forge context at bootstrap instead of shipping a second HTML
 * entry (Forge resources serve `index.html` from a directory, and `base: './'` + a
 * nested multi-page build breaks the iframe asset paths). The branch happens before
 * `App` renders, so the providers/theme/i18n shell stays unconditional.
 *
 * `page` = the global page (no issue in context). `panel` = the issue context view
 * (the host issue in context). The global page is not project-scoped — its context
 * carries no project — so `page` holds no `projectKey`; the in-app picker chooses the
 * project (defaulting to the first one).
 */
export type EntryContext =
  | { mode: 'page' }
  | { mode: 'panel'; issueKey: string; projectKey: string }

/**
 * The slice of Forge's `view.getContext()` we read for routing. Typed structurally
 * (not imported from `@forge/bridge`) so this module never pulls the bridge in — it
 * runs in the mock too. The `issueContext` extension carries the host issue + project;
 * the `globalPage` extension has no `issue`, which is exactly how we tell them apart.
 */
interface ForgeContextish {
  extension?: {
    issue?: { key?: string }
    project?: { key?: string }
  }
}

/** Forge: a panel iff the context carries an issue (the issueContext module does;
 *  the globalPage doesn't). Otherwise it's the global page. */
export function resolveForgeEntry(context: ForgeContextish): EntryContext {
  const issueKey = context.extension?.issue?.key
  const projectKey = context.extension?.project?.key
  if (issueKey && projectKey) return { mode: 'panel', issueKey, projectKey }
  return { mode: 'page' }
}

/**
 * Mock preview: there is no Forge context, so the panel is opened by URL —
 * `?panel=DEMO-4`. The project key is the issue key's prefix (Jira keys are
 * `PROJECT-N`), which is all the fixtures need; in Forge it comes from the context.
 */
export function resolveMockEntry(): EntryContext {
  if (typeof window === 'undefined') return { mode: 'page' }
  const issueKey = new URLSearchParams(window.location.search).get('panel')
  if (issueKey) {
    const projectKey = issueKey.split('-')[0] ?? ''
    return { mode: 'panel', issueKey, projectKey }
  }
  return { mode: 'page' }
}
