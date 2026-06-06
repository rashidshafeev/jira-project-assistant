import { type ReactNode, useMemo } from 'react'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import { useThemeStore } from '@/app/model/theme.store'
import { ATLASSIAN_TOKENS } from '@/shared/config/atlassian-tokens'

// Jira's product UI doesn't ship a downloadable brand webfont — the Atlassian
// Design System renders text in this *system* font stack (resolved from native
// OS fonts, so no network cost and it matches the host exactly). We point MUI's
// typography at the same stack so our text looks native inside Jira. (In Forge we
// could instead read the host's live `--ds-font-family` CSS var, but this stack
// is what that token resolves to anyway, and it also works in the mock.)
const ATLASSIAN_FONT_FAMILY = [
  '-apple-system',
  'BlinkMacSystemFont',
  '"Segoe UI"',
  'Roboto',
  'Oxygen',
  'Ubuntu',
  '"Fira Sans"',
  '"Droid Sans"',
  '"Helvetica Neue"',
  'sans-serif',
].join(',')

/**
 * App-wide MUI theme + baseline reset. The palette mode follows the theme store
 * (synced to the Jira host theme in Forge, toggleable in the mock), and the
 * colors are mapped to Atlassian design tokens so the app looks native in Jira.
 */
export function AppThemeProvider({ children }: { children: ReactNode }) {
  const mode = useThemeStore((s) => s.mode)
  const resolved = useThemeStore((s) => s.resolved)

  const theme = useMemo(() => {
    const t = ATLASSIAN_TOKENS[mode]
    return createTheme({
      palette: {
        mode,
        primary: { main: t.brand },
        error: { main: t.danger },
        warning: { main: t.warning },
        success: { main: t.success },
        // Until we know the real host theme, keep the page background transparent
        // so the (correctly-themed) Jira surface shows through instead of flashing
        // a guessed, often-inverted color. `setMode` flips `resolved` and the real
        // surface lands. See theme.store.ts.
        background: { default: resolved ? t.surface : 'transparent', paper: t.raised },
        text: { primary: t.text, secondary: t.subtle },
        divider: t.border,
      },
      typography: { fontFamily: ATLASSIAN_FONT_FAMILY },
      shape: { borderRadius: 3 },
      components: {
        // Atlassian UI is sentence-case everywhere; MUI upper-cases buttons/tabs by
        // default, which is the biggest "generic MUI" tell. Turn it off globally.
        MuiButton: { styleOverrides: { root: { textTransform: 'none' } } },
        MuiTab: { styleOverrides: { root: { textTransform: 'none' } } },
      },
    })
  }, [mode, resolved])

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  )
}
