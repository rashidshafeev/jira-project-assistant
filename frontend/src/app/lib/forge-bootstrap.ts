import { useThemeStore } from '@/app/model/theme.store'
import i18n, { resolveLanguage } from '@/shared/i18n'

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
 *  - sets the i18n language from the user's Jira locale.
 *
 * `@forge/bridge` is dynamically imported because it throws on import outside a
 * Forge host (see docs/forge-gotchas.md).
 */
let bootstrapPromise: Promise<void> | null = null

/**
 * Idempotent entry point: runs the bootstrap once and returns the same promise
 * thereafter (React StrictMode double-invokes effects in dev — this keeps the
 * bridge work, theme observer, and locale fetch to a single run). The gate
 * awaits this before the first paint so there's no theme/language flash.
 */
export function bootstrapForge(): Promise<void> {
  bootstrapPromise ??= runBootstrap()
  return bootstrapPromise
}

async function runBootstrap(): Promise<void> {
  if (useMocks) return

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
    const context = await view.getContext()
    await i18n.changeLanguage(resolveLanguage(context.locale))
  } catch {
    // Locale is best-effort; fall back to the default language.
  }
}
