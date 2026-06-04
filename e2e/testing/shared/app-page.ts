import type { Locator, Page } from '@playwright/test'
import type { QueryRoot } from './target'

/**
 * Page object for the app shell (one screen, two tabs). It is **target-agnostic**:
 * element lookups go through an injected `root` (the `Page` for the mock, a
 * `FrameLocator` for the real app inside Jira's Forge iframe), while page-level
 * actions (navigation, keyboard) use the `Page`. The base fixture builds the right
 * root per target — see ../shared/base.ts and ../{mock,jira}/target.ts.
 *
 * Selectors are **behavioral** — ARIA roles + accessible names, plus the
 * DataGrid's stable `data-id` — never CSS classes or mock internals, so they
 * survive restyling.
 *
 * LOCALE CAVEAT (single point of future change): the `data-id` row selectors and
 * the "lone button in the row" Fix match are locale-proof; the *name*-based ones
 * (Project, Assignee, Assign, Auto-assign, Retry, the tabs) are English-bound and
 * miss on a non-English Jira account (the live account renders in `ru`). Promoting
 * the full `@smoke` lane to real Jira means swapping those for stable `data-testid`
 * selectors — and this class is the one place to do it. See docs/testing.md →
 * "Promoting to the full dual-target lane".
 */
export class AppPage {
  constructor(
    readonly page: Page,
    private readonly root: QueryRoot,
  ) {}

  /**
   * Load the app. `query` lets a test arm a deterministic mock fault via the URL,
   * e.g. `goto('?fault=getIssues:forbidden')` (mock-only — ignored by Forge).
   */
  async goto(query = ''): Promise<void> {
    await this.page.goto(`/${query}`)
  }

  /**
   * Load the admin settings view (the app-wide config form). In the mock it's the
   * `?admin` route; in Forge it's a separate `jira:adminPage` module (admin-only),
   * so on the jira target this would instead navigate to that page. The at-risk
   * window + grace controls live here now, not on the main shell.
   */
  async gotoAdmin(): Promise<void> {
    await this.page.goto('/?admin')
  }

  // ── Global chrome (control panel) ───────────────────────────────────────────
  projectPicker(): Locator {
    return this.root.getByRole('combobox', { name: 'Project' })
  }

  async selectProject(option: string | RegExp): Promise<void> {
    await this.projectPicker().click()
    await this.root.getByRole('option', { name: option }).click()
  }

  autoAssignButton(): Locator {
    return this.root.getByRole('button', { name: /Assign all/ })
  }

  /** A control-panel headline stat's number, by key (e.g. `'atRisk'`, `'unassigned'`). */
  stat(key: string): Locator {
    return this.root.getByTestId(`stat-${key}`)
  }

  // ── At-risk (deadline) window — lives on the admin page (see gotoAdmin) ─────────
  deadlineWindow(): Locator {
    return this.root.getByRole('combobox', { name: 'At-risk window' })
  }

  async setDeadlineWindow(option: string | RegExp): Promise<void> {
    await this.deadlineWindow().click()
    await this.root.getByRole('option', { name: option }).click()
  }

  // ── Tabs ─────────────────────────────────────────────────────────────────────
  async openTab(name: 'Issues' | 'Team'): Promise<void> {
    await this.root.getByRole('tab', { name }).click()
  }

  // ── The (single) data grid on screen ──────────────────────────────────────────
  grid(): Locator {
    return this.root.getByRole('grid')
  }

  /** A grid row by its stable DataGrid id (issue id, or member accountId on Team). */
  row(id: string): Locator {
    return this.root.locator(`[role="row"][data-id="${id}"]`)
  }

  /**
   * The Fix action for a row. A problematic row holds exactly one button (the
   * others are lozenges/avatars/icons), so we match the lone button by role —
   * unambiguous and locale-independent (the visible label "Fix" is localized, and
   * the "Resolve: …" tooltip labels the button's wrapper, not the button itself).
   */
  fixButton(issueId: string): Locator {
    return this.row(issueId).getByRole('button')
  }

  /**
   * A problem pip on a row's Fix button: `'error'` (unassigned) or `'warning'`
   * (near deadline). A both-problems row shows both; a single-problem row one.
   */
  pip(issueId: string, kind: 'error' | 'warning'): Locator {
    return this.row(issueId).getByTestId(`pip-${kind}`)
  }

  /** The visible MUI tooltip popper (e.g. the Fix button's "Resolve: …" hint). */
  tooltip(): Locator {
    return this.root.getByRole('tooltip')
  }

  // ── Dialogs (Fix issue, auto-assign confirm) ───────────────────────────────────
  dialog(): Locator {
    return this.root.getByRole('dialog')
  }

  async chooseAssignee(name: string): Promise<void> {
    await this.dialog().getByRole('combobox', { name: 'Assignee' }).click()
    await this.root.getByRole('option', { name }).click()
  }

  assignSubmit(): Locator {
    return this.dialog().getByRole('button', { name: 'Assign', exact: true })
  }

  /** A "Raise to <priority>" button in the Fix dialog (the raise-priority remedy). */
  raisePriority(priority: string): Locator {
    return this.dialog().getByRole('button', { name: `Raise to ${priority}`, exact: true })
  }

  confirmAutoAssign(): Locator {
    return this.dialog().getByRole('button', { name: 'Auto-assign' })
  }

  // ── Issue panel (jira:issuePanel view) ─────────────────────────────────────────
  /** The "needs attention" alert that lists why an issue is flagged. */
  panelFlagged(): Locator {
    return this.root.getByTestId('panel-flagged')
  }

  /** The "looks healthy" alert shown when an issue has no problems left. */
  panelHealthy(): Locator {
    return this.root.getByTestId('panel-healthy')
  }

  /**
   * The panel's standalone Fix button (opens the SAME Fix dialog as a grid row).
   * Matched by its exact accessible name so it doesn't collide with the dialog
   * title's "Fix <KEY>". English-bound, like the other name-based selectors.
   */
  panelFixButton(): Locator {
    return this.root.getByRole('button', { name: 'Fix', exact: true })
  }

  // ── Error surface ────────────────────────────────────────────────────────────
  alert(): Locator {
    return this.root.getByRole('alert')
  }

  retryButton(): Locator {
    return this.alert().getByRole('button', { name: 'Retry' })
  }

  /**
   * Free-text match, scoped to the app root so it's frame-aware (specs must not
   * reach `app.page.getByText` directly — that bypasses the iframe on jira).
   */
  text(value: string | RegExp, options?: { exact?: boolean }): Locator {
    return this.root.getByText(value, options)
  }

  /** Disarm a mock fault at runtime (mock-only `window.__mock` handle). */
  async clearMockFault(action: string): Promise<void> {
    await this.page.evaluate((a) => {
      ;(window as unknown as { __mock?: { pass(action: string): void } }).__mock?.pass(a)
    }, action)
  }
}
