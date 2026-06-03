import { create } from 'zustand'

export type ColorMode = 'light' | 'dark'

/**
 * Current color mode. In Forge it's driven by the host (see `forge-bootstrap.ts`
 * syncing from `data-color-mode`); in the mock preview it starts light and can be
 * toggled manually for previewing both themes.
 */
interface ThemeState {
  mode: ColorMode
  setMode: (mode: ColorMode) => void
  toggle: () => void
}

/**
 * Best synchronous guess at the color mode, used as the initial store value so
 * the FIRST paint is already correctly themed (no light→dark flash before the
 * async Forge context resolves). Prefers the host's `data-color-mode` if it's
 * already on the document, else the OS preference, else light. The Forge
 * bootstrap later corrects/locks this to the real host theme.
 */
function initialMode(): ColorMode {
  if (typeof document !== 'undefined') {
    const attr = document.documentElement.getAttribute('data-color-mode')
    if (attr === 'dark' || attr === 'light') return attr
  }
  if (
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-color-scheme: dark)').matches
  ) {
    return 'dark'
  }
  return 'light'
}

export const useThemeStore = create<ThemeState>((set) => ({
  mode: initialMode(),
  setMode: (mode) => set({ mode }),
  toggle: () => set((s) => ({ mode: s.mode === 'light' ? 'dark' : 'light' })),
}))
