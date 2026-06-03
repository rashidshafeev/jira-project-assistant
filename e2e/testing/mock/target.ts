import type { Page } from '@playwright/test'
import type { Target } from '../shared/target'

/**
 * The `mock` target: the standalone UI over the in-memory mock transport. The app
 * *is* the page, so the query root is the `Page` itself. Data is deterministic
 * fixtures (each test's `*.data.ts` `mock` branch), so there's nothing to seed.
 * No authentication — the mock has no login.
 */
export const mockTarget: Target = {
  name: 'mock',
  root: (page: Page) => page,
}
