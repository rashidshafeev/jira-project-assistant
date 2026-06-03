import { useThemeStore } from '@/app/model/theme.store'
import i18n, { resolveLanguage } from '@/shared/i18n'
import {
  resolveForgeEntry,
  resolveMockEntry,
  type EntryContext,
} from '@/app/lib/entry-context'

const useMocks = import.meta.env.VITE_USE_MOCKS === 'true'

function syncThemeFromDom(): void {
  const mode = document.documentElement.getAttribute('data-color-mode')
  useThemeStore.getState().setMode(mode === 'dark' ? 'dark' : 'light')
}

/**
 * One-time bridge bootstrap, run before/at app start. Outside a Forge host (mock
 * preview) it's a no-op — the app keeps its defaults and dev toggles. Inside
 * Forge it:
 *  - enables host theme syncing and mirrors `data-color-mode` into the theme store
 *    (reactively, via a MutationObserver), and
 *  - sets the i18n language from the user's Jira locale, and
 *  - resolves which view to render (full page vs. single-issue panel) from the
 *    Forge module context — see {@link EntryContext}.
 *
 * `@forge/bridge` is dynamically imported because it throws on import outside a
 * Forge host (see docs/forge-gotchas.md).
 */
let bootstrapPromise: Promise<EntryContext> | null = null

/**
 * Idempotent entry point: runs the bootstrap once and returns the same promise
 * thereafter (React StrictMode double-invokes effects in dev — this keeps the
 * bridge work, theme observer, and locale fetch to a single run). Resolves to the
 * {@link EntryContext} so the gate can branch the first paint between the page and
 * the issue panel — after the theme/language are settled, so there's no flash.
 */
export function bootstrapForge(): Promise<EntryContext> {
  bootstrapPromise ??= runBootstrap()
  return bootstrapPromise
}

async function runBootstrap(): Promise<EntryContext> {
  if (useMocks) return resolveMockEntry()

  const { view } = await import('@forge/bridge')

  try {
    await view.theme.enable()
    syncThemeFromDom()
    new MutationObserver(syncThemeFromDom).observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-color-mode'],
    })
  } catch {
    // Theming is best-effort; fall back to the default mode.
  }

  try {
    // One context fetch feeds both the locale and the page/panel routing.
    const context = await view.getContext()
    await i18n.changeLanguage(resolveLanguage(context.locale))
    // The global page is not project-scoped (no project in context), so there's nothing
    // to seed here — the picker defaults to the first project (see ControlPanel).
    return resolveForgeEntry(context)
  } catch {
    // Locale + routing are best-effort; fall back to the default language + page.
    return { mode: 'page' }
  }
}
