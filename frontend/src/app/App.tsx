import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import Box from '@mui/material/Box'
import ViewListRoundedIcon from '@mui/icons-material/ViewListRounded'
import GroupRoundedIcon from '@mui/icons-material/GroupRounded'
import { Providers } from '@/app/providers'
import { BootstrapGate } from '@/app/ui/BootstrapGate'
import { MockHost } from '@/app/ui/MockHost'
import { ControlPanel } from '@/widgets/control-panel'
import { DeadlineWindowSelect } from '@/features/deadline-window'
import { IssuesPage } from '@/pages/issues'
import { TeamPage } from '@/pages/team'
import { IssuePanelPage } from '@/pages/issue-panel'
import type { EntryContext } from '@/app/lib/entry-context'

type TabKey = 'issues' | 'team'

// Build-time constant. In a Forge/prod build it folds to `false`, so the mock-only
// host shell (title bar + dev controls + view switcher, all in `MockHost`) is
// tree-shaken out of `dist`. In Forge, Jira draws the surrounding chrome itself.
const useMocks = import.meta.env.VITE_USE_MOCKS === 'true'

// Fill-to-bottom (the shell fills its parent + tables scroll internally) only makes
// sense in the standalone mock, where `MockHost` provides a bounded-height (100vh)
// frame for Shell to fill. The Forge Custom UI iframe AUTO-RESIZES to its content
// (no `viewportSize`), so there is no stable viewport to fill — content flows and the
// grid grows (`autoHeight`, see AppDataGrid). So this is gated on the mock.
const fillHeight = useMocks

function Shell() {
  const { t } = useTranslation()
  // In-memory view state. The Forge iframe URL is invisible/uncontrollable, so
  // URL-based routing buys nothing here; swap in MemoryRouter if views grow.
  const [tab, setTab] = useState<TabKey>('issues')

  return (
    // Mock: fill the host-shell content area (bounded flex column) so the active page
    // reaches the bottom and scrolls *inside* its table. Forge: no fill — the
    // auto-resizing iframe grows with content. The mock-only title bar / dev controls
    // are NOT here; they live in MockHost so the panel view shares them too.
    <Box
      sx={{
        bgcolor: 'background.default',
        ...(fillHeight && {
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
        }),
      }}
    >
      {/* No Container gutters/maxWidth — full-bleed for a native Jira feel (the Forge
          globalPage iframe is itself bare). A little padding keeps the content off the
          very edges. In mock this region flexes to fill the shell; in Forge it just
          flows and the iframe grows around it. */}
      <Box
        sx={{
          // The `layout: blank` globalPage strips ALL of Jira's page chrome (system
          // header/title, breadcrumbs), so content would sit flush against the iframe
          // edges. We add our own symmetric gutter back for breathing room.
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

/** Render the view for a resolved entry context: the single-issue panel or the full
 *  project page. Shared by the Forge path (rendered directly) and the mock path
 *  (rendered inside MockHost's chrome). */
function renderEntry(entry: EntryContext) {
  return entry.mode === 'panel' ? (
    <IssuePanelPage issueKey={entry.issueKey} projectKey={entry.projectKey} />
  ) : (
    <Shell />
  )
}

export function App() {
  return (
    <Providers>
      <BootstrapGate>
        {(entry) =>
          // Mock: wrap the view in the host shell (dev controls + page/panel switcher
          // + faux issue frame). Forge: render the view directly — Jira draws the
          // chrome. `useMocks` is a build constant, so MockHost is tree-shaken from prod.
          useMocks ? (
            <MockHost initialEntry={entry} renderEntry={renderEntry} />
          ) : (
            renderEntry(entry)
          )
        }
      </BootstrapGate>
    </Providers>
  )
}
