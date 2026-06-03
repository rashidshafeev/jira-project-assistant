import { type ReactNode, useState } from 'react'
import { useTranslation } from 'react-i18next'
import AppBar from '@mui/material/AppBar'
import Toolbar from '@mui/material/Toolbar'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Skeleton from '@mui/material/Skeleton'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import { DevSettings } from '@/app/ui/DevSettings'
import type { EntryContext } from '@/app/lib/entry-context'

/**
 * Mock preview targets for the view switcher. Keys are real fixture issues chosen
 * to show each panel state; the labels deliberately avoid the raw issue key and any
 * member name, so the switcher's visible text never collides with the panel's own
 * content (the E2E lane matches issue keys / assignee names by free text).
 */
const PREVIEWS: { id: string; issueKey: string | null; label: string }[] = [
  { id: 'page', issueKey: null, label: 'Page' },
  { id: 'unassigned', issueKey: 'DEMO-2', label: 'Panel: unassigned' },
  { id: 'overdue', issueKey: 'DEMO-4', label: 'Panel: overdue + low' },
  { id: 'healthy', issueKey: 'DEMO-1', label: 'Panel: healthy' },
]

function entryFor(issueKey: string | null): EntryContext {
  if (!issueKey) return { mode: 'page' }
  return { mode: 'panel', issueKey, projectKey: issueKey.split('-')[0] ?? '' }
}

function currentId(entry: EntryContext): string {
  if (entry.mode === 'page') return 'page'
  return PREVIEWS.find((p) => p.issueKey === entry.issueKey)?.id ?? 'unassigned'
}

interface MockHostProps {
  initialEntry: EntryContext
  renderEntry: (entry: EntryContext) => ReactNode
}

/**
 * Mock-ONLY host shell. It stands in for the Jira chrome that wraps our app in real
 * Forge: the dev controls (theme/language) and a page/panel view switcher live
 * OUTSIDE the app's own views, so BOTH the globalPage shell and the issueContext panel
 * can be previewed — and toggled — from one place (the panel view itself renders no
 * chrome, exactly as in Forge, so the switcher can't live inside it). For a panel
 * preview it frames the panel inside a faux issue-detail layout so it shows at its real
 * ~360px right-rail width.
 *
 * Tree-shaken from prod: App mounts this only behind the `useMocks` build constant,
 * so none of it reaches a Forge build.
 */
export function MockHost({ initialEntry, renderEntry }: MockHostProps) {
  const { t } = useTranslation()
  const [entry, setEntry] = useState<EntryContext>(initialEntry)

  return (
    <Box
      sx={{ height: '100vh', display: 'flex', flexDirection: 'column', bgcolor: 'background.default' }}
    >
      <AppBar position="static" color="default" elevation={1}>
        <Toolbar variant="dense" sx={{ gap: 2 }}>
          <Typography variant="h6" component="h1" sx={{ flexGrow: 1 }}>
            {t('app.title')}
          </Typography>
          <ToggleButtonGroup
            size="small"
            exclusive
            value={currentId(entry)}
            onChange={(_, id: string | null) => {
              // Ignore a click on the already-active button (exclusive → null).
              if (id) setEntry(entryFor(PREVIEWS.find((p) => p.id === id)?.issueKey ?? null))
            }}
            aria-label="Mock preview"
          >
            {PREVIEWS.map((p) => (
              <ToggleButton key={p.id} value={p.id} sx={{ textTransform: 'none' }}>
                {p.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
          <DevSettings />
        </Toolbar>
      </AppBar>

      {entry.mode === 'panel' ? (
        // Panel preview: flow + scroll, framed in a faux issue-detail screen.
        <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto', p: 3 }}>
          <FauxIssueView>{renderEntry(entry)}</FauxIssueView>
        </Box>
      ) : (
        // Page preview: a bounded flex column so the globalPage's tables fill and
        // scroll internally (the grid uses a definite height in mock, not autoHeight).
        <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          {renderEntry(entry)}
        </Box>
      )}
    </Box>
  )
}

/**
 * A faux Jira issue-detail screen (mock-only): skeleton placeholders for the issue
 * body on the left, the real issue panel docked in a ~360px right rail. Skeletons
 * carry NO text, so the frame adds nothing that could clash with the panel's content
 * or the E2E selectors.
 */
function FauxIssueView({ children }: { children: ReactNode }) {
  return (
    <Box sx={{ display: 'flex', gap: 3, maxWidth: 1100, mx: 'auto', width: '100%' }}>
      <Box sx={{ flex: 1, minWidth: 0 }} aria-hidden>
        <Skeleton variant="text" width="55%" height={40} />
        <Skeleton variant="rounded" width={180} height={28} sx={{ my: 1.5 }} />
        <Skeleton variant="text" />
        <Skeleton variant="text" />
        <Skeleton variant="text" width="80%" />
        <Skeleton variant="rounded" height={140} sx={{ mt: 2 }} />
      </Box>
      <Box sx={{ width: 360, flexShrink: 0 }}>
        <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
          {children}
        </Paper>
      </Box>
    </Box>
  )
}
