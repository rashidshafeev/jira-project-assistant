import type { FrameLocator, Page } from '@playwright/test'

/**
 * The two run targets. `mock` drives the standalone UI over the in-memory mock
 * transport; `jira` drives the real deployed app inside Jira's Forge iframe. The
 * Playwright project name maps 1:1 to these (see playwright.config.ts).
 */
export type TargetName = 'mock' | 'jira'

/**
 * The element-query surface a page object needs. Both `Page` (mock: the app *is*
 * the page) and `FrameLocator` (jira: the app is inside a cross-origin iframe)
 * implement these locator builders — so the SAME page object reads against either
 * target once handed the right root. Page-level actions (goto, keyboard, evaluate)
 * stay on the `Page`, which a `FrameLocator` doesn't have.
 */
export type QueryRoot = Pick<
  Page,
  'getByRole' | 'getByText' | 'getByLabel' | 'getByTestId' | 'locator'
>

/**
 * How a target connects: it turns the `Page` into the query root the page object
 * uses. (jira wraps it in `frameLocator`; mock returns the page itself.) `seed`
 * sets up the data a flow asserts on and returns a teardown — a no-op for the
 * deterministic mock; for jira it's where REST seed/cleanup will live.
 */
export interface Target {
  readonly name: TargetName
  root(page: Page): QueryRoot
  seed?(): Promise<() => Promise<void>>
}

/** A per-test data table: the same shape, one value filled per target. */
export type ByTarget<T> = Record<TargetName, T>

/**
 * Placeholder for a target whose expected values aren't wired yet (the `jira`
 * branch, pending the REST seed — see docs/testing.md → "Promoting to the full
 * dual-target lane"). It type-checks as `T` but throws a pointed message if a test
 * actually reads it, so an unwired target can't pass on stale/empty data by
 * accident. Today no `@smoke` flow runs on jira, so it's never accessed.
 */
export function pending<T extends object>(why: string): T {
  return new Proxy({} as T, {
    get(_t, prop) {
      throw new Error(
        `[data] This target isn't wired yet — ${why} (tried to read "${String(prop)}"). ` +
          `See docs/testing.md → "Promoting to the full dual-target lane".`,
      )
    },
  })
}

/** Pick a value for the active target from a per-target table. */
export function forTarget<T>(target: TargetName, table: ByTarget<T>): T {
  return table[target]
}

// Re-exported so call sites can annotate roots without importing playwright directly.
export type { FrameLocator, Page }
