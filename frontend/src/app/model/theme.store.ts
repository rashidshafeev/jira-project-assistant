import { create } from 'zustand'

export type ColorMode = 'light' | 'dark'

const useMocks = import.meta.env.VITE_USE_MOCKS === 'true'

/**
 * Current color mode. In Forge it's driven by the host (see `forge-bootstrap.ts`
 * syncing from `data-color-mode`); in the mock preview it starts light and can be
 * toggled manually for previewing both themes.
 *
 * `resolved` is false until we actually KNOW the real mode. In Forge the host
 * theme isn't available synchronously (it's applied only after the async
 * `view.theme.enable()`), and the OS preference is a bad guess — it's often the
 * inverse of the user's Jira theme, which produced a jarring inverted-color flash
 * on first paint. So instead of guessing, we paint the loading surface
 * **transparent** until `setMode` lands the real theme (see `with-theme.tsx`).
 */
interface ThemeState {
  mode: ColorMode
  resolved: boolean
  setMode: (mode: ColorMode) => void
  toggle: () => void
}

/**
 * Synchronous starting mode. We only trust the host's `data-color-mode` if it's
 * already on the document (it usually isn't at first paint in Forge); otherwise
 * we start `light` but keep `resolved: false` so nothing colored is painted until
 * the real theme arrives. We deliberately do NOT fall back to the OS preference —
 * it's frequently the opposite of the Jira theme and caused the flash.
 */
function initialMode(): ColorMode {
  if (typeof document !== 'undefined') {
    const attr = document.documentElement.getAttribute('data-color-mode')
    if (attr === 'dark' || attr === 'light') return attr
  }
  return 'light'
}

function knowsModeSynchronously(): boolean {
  if (useMocks) return true // the mock owns its theme; no async host to wait for
  if (typeof document !== 'undefined') {
    const attr = document.documentElement.getAttribute('data-color-mode')
    if (attr === 'dark' || attr === 'light') return true
  }
  return false
}

export const useThemeStore = create<ThemeState>((set) => ({
  mode: initialMode(),
  resolved: knowsModeSynchronously(),
  setMode: (mode) => set({ mode, resolved: true }),
  toggle: () => set((s) => ({ mode: s.mode === 'light' ? 'dark' : 'light' })),
}))
