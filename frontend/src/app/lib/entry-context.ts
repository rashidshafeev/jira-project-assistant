/**
 * Which view the bundle renders. The SAME `frontend/dist` is served for every Forge
 * module — the `jira:projectPage` (the full assistant shell) and the two issue-view
 * modules, `jira:issuePanel` and `jira:issueContext` (both render the single-issue
 * view) — so we branch on the Forge context at bootstrap instead of shipping a second
 * HTML entry (Forge resources serve `index.html` from a directory, and `base: './'` +
 * a nested multi-page build breaks the iframe asset paths). The branch happens before
 * `App` renders, so the providers/theme/i18n shell stays unconditional.
 *
 * The `panel` mode covers BOTH issue-view modules: they expose the identical context
 * shape (an `issue` + `project`), so we don't distinguish them — `issueContext` (the
 * always-visible right-sidebar item) and `issuePanel` (the click-to-add main-column
 * panel) render the same `IssuePanelPage`.
 */
export type EntryContext =
  | { mode: 'page'; projectKey?: string }
  | { mode: 'panel'; issueKey: string; projectKey: string }

/**
 * The slice of Forge's `view.getContext()` we read for routing. Typed structurally
 * (not imported from `@forge/bridge`) so this module never pulls the bridge in — it
 * runs in the mock too. The `issuePanel` extension carries the host issue + project;
 * the `projectPage` extension has no `issue`, which is exactly how we tell them apart.
 */
interface ForgeContextish {
  extension?: {
    issue?: { key?: string }
    project?: { key?: string }
  }
}

/** Forge: a panel iff the context carries an issue (the issue-view modules —
 *  issuePanel / issueContext — do; the projectPage doesn't). */
export function resolveForgeEntry(context: ForgeContextish): EntryContext {
  const issueKey = context.extension?.issue?.key
  const projectKey = context.extension?.project?.key
  if (issueKey && projectKey) return { mode: 'panel', issueKey, projectKey }
  // projectPage: carry the host project so the picker can default to the project the
  // app was opened from (see forge-bootstrap), not just the first one in the list.
  // Omit when absent rather than set undefined (exactOptionalPropertyTypes).
  return projectKey ? { mode: 'page', projectKey } : { mode: 'page' }
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
