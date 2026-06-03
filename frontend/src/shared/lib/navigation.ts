const useMocks = import.meta.env.VITE_USE_MOCKS === 'true'

/**
 * Open a Jira issue in the host product.
 *
 * In Forge this hands a *relative* product URL to the bridge router. `router.open`
 * opens it in a NEW browser tab (it calls the host with `type: 'new-tab'`), so the
 * assistant view the user is triaging from stays put — the right default for a list
 * of issues. A plain `<a href>` can't do this: the Custom UI runs in a sandboxed,
 * cross-origin iframe, so a relative link resolves against the *iframe* origin, not
 * the Jira site. Routing through the bridge lets the host resolve `/browse/KEY`
 * against the real site, so we never need its absolute base URL ourselves.
 *
 * This is *navigation*, not data, so it lives in `shared/lib` rather than the
 * `JiraApi` data contract. `@forge/bridge` is dynamic-imported because it throws on
 * import outside a Forge host (see docs/forge-gotchas.md).
 *
 * In the mock there's no real Jira to land on, so it's a no-op: the link is still
 * rendered (and tooltipped) as a preview affordance — it just doesn't navigate.
 */
export async function openIssue(issueKey: string): Promise<void> {
  if (useMocks) return
  try {
    const { router } = await import('@forge/bridge')
    await router.open(`/browse/${issueKey}`)
  } catch {
    // Best-effort, mirroring the bridge calls in forge-bootstrap: a failed dynamic
    // import or host-rejected navigation shouldn't surface as an unhandled rejection.
  }
}
