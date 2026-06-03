import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import AppBar from '@mui/material/AppBar'
import Toolbar from '@mui/material/Toolbar'
import Typography from '@mui/material/Typography'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import Box from '@mui/material/Box'
import ViewListRoundedIcon from '@mui/icons-material/ViewListRounded'
import GroupRoundedIcon from '@mui/icons-material/GroupRounded'
import { Providers } from '@/app/providers'
import { BootstrapGate } from '@/app/ui/BootstrapGate'
import { DevSettings } from '@/app/ui/DevSettings'
import { ControlPanel } from '@/widgets/control-panel'
import { DeadlineWindowSelect } from '@/features/deadline-window'
import { IssuesPage } from '@/pages/issues'
import { TeamPage } from '@/pages/team'

type TabKey = 'issues' | 'team'

// In Forge, Jira renders its own system header with the app title, so our own
// title bar would be redundant — we only show it in the standalone mock preview
// (which has no product chrome), where it also hosts the dev theme/lang controls.
// Build-time constant: in a Forge/prod build it folds to `false`, so the mock-only
// title bar + dev controls below are tree-shaken out (no `MuiAppBar` in `dist`).
const useMocks = import.meta.env.VITE_USE_MOCKS === 'true'

// Fill-to-bottom (100vh shell + internally-scrolling tables) only makes sense in
// the standalone mock page. The Forge Custom UI iframe AUTO-RESIZES to its content
// (no `viewportSize` in the manifest), so there is no stable viewport to fill:
// `100vh` collapses or pushes scrollbars onto the host Jira page. In Forge we let
// content flow and the grid grow (`autoHeight`, see AppDataGrid) — the native model.
const fillHeight = useMocks

function Shell() {
  const { t } = useTranslation()
  // In-memory view state. The Forge iframe URL is invisible/uncontrollable, so
  // URL-based routing buys nothing here; swap in MemoryRouter if views grow.
  const [tab, setTab] = useState<TabKey>('issues')

  return (
    // Mock: full-height flex column so the active page fills to the bottom and
    // scrolls *inside* its table. Forge: no fixed height — the auto-resizing iframe
    // grows with content (using 100vh here causes a stray vertical scroll in Jira).
    <Box
      sx={{
        bgcolor: 'background.default',
        ...(fillHeight && {
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
        }),
      }}
    >
      {useMocks && (
        <AppBar position="static" color="default" elevation={1}>
          <Toolbar variant="dense" sx={{ gap: 2 }}>
            <Typography variant="h6" component="h1" sx={{ flexGrow: 1 }}>
              {t('app.title')}
            </Typography>
            <DevSettings />
          </Toolbar>
        </AppBar>
      )}

      {/* No Container gutters/maxWidth — full-bleed for a native Jira-panel feel
          (the Forge projectPage iframe is itself bare). A little padding keeps the
          content off the very edges. In mock this region flexes to fill the 100vh
          shell; in Forge it just flows and the iframe grows around it. */}
      <Box
        sx={{
          // `blank` strips ALL of Jira's projectPage chrome (incl. its asymmetric
          // ~40px left-only gutter), so the content would sit flush against the
          // iframe edges. We add our own *symmetric* gutter back for breathing room.
          px: 3,
          pt: 2,
          display: 'flex',
          flexDirection: 'column',
          ...(fillHeight && { flex: 1, minHeight: 0 }),
        }}
      >
        {/* Global chrome: project selector, stats, bulk auto-assign. Above the
            tabs because project selection is shared by Issues and Team. */}
        <ControlPanel />

        {/* Tabs on the left, the at-risk window control on the right. The shared
            bottom border (the tabs' baseline) lives on this row, not the Tabs. */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 2,
            mb: 2,
            borderBottom: 1,
            borderColor: 'divider',
          }}
        >
          <Tabs value={tab} onChange={(_, value: TabKey) => setTab(value)}>
            <Tab
              label={t('tabs.issues')}
              value="issues"
              icon={<ViewListRoundedIcon fontSize="small" />}
              iconPosition="start"
              sx={{ minHeight: 48 }}
            />
            <Tab
              label={t('tabs.team')}
              value="team"
              icon={<GroupRoundedIcon fontSize="small" />}
              iconPosition="start"
              sx={{ minHeight: 48 }}
            />
          </Tabs>
          <DeadlineWindowSelect />
        </Box>

        {tab === 'issues' ? <IssuesPage /> : <TeamPage />}
      </Box>
    </Box>
  )
}

export function App() {
  return (
    <Providers>
      <BootstrapGate>
        <Shell />
      </BootstrapGate>
    </Providers>
  )
}
