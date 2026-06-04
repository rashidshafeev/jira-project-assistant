import { useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Divider from '@mui/material/Divider'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Alert from '@mui/material/Alert'
import CircularProgress from '@mui/material/CircularProgress'
import { useSessionStore } from '@/app/model/session.store'
import { useProjects } from '@/entities/project'
import { useIssues, computeStats } from '@/entities/issue'
import { useDeadlineWindow } from '@/features/app-config'
import { AutoAssignButton } from '@/features/auto-assign'
import { errorMessageKey } from '@/shared/api'

/**
 * Top control panel (brief §3): the project picker, overall project statistics,
 * and the bulk "auto-assign unassigned" action. It's global chrome — project
 * selection is shared by both the Issues and Team tabs (via the session store),
 * so it lives above the tabs rather than inside a page.
 *
 * It owns the "default to the first project" behavior (it owns the picker). Both
 * this widget and the issues page call `useIssues`/`useProjects`; TanStack Query
 * dedupes by key, so they read the same cache entry — no prop drilling, no
 * double fetch.
 */
export function ControlPanel() {
  const { t } = useTranslation()
  const selectedProjectKey = useSessionStore((s) => s.selectedProjectKey)
  const setSelectedProjectKey = useSessionStore((s) => s.setSelectedProjectKey)

  const projectsQuery = useProjects()
  const issuesQuery = useIssues(selectedProjectKey)

  // Default to the first project once they load.
  const firstProjectKey = projectsQuery.data?.[0]?.key ?? null
  useEffect(() => {
    if (selectedProjectKey === null && firstProjectKey !== null) {
      setSelectedProjectKey(firstProjectKey)
    }
  }, [selectedProjectKey, firstProjectKey, setSelectedProjectKey])

  // The at-risk stat must count by the same window the table flags by.
  const warningDays = useDeadlineWindow()
  const now = useMemo(() => new Date(), [issuesQuery.data])
  const stats = issuesQuery.data ? computeStats(issuesQuery.data, now, warningDays) : null

  return (
    <Box sx={{ mb: 2, pb: 2, borderBottom: 1, borderColor: 'divider' }}>
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={2}
        sx={{ alignItems: { md: 'center' } }}
        divider={<Divider orientation="vertical" flexItem sx={{ display: { xs: 'none', md: 'block' } }} />}
      >
        <FormControl
          size="small"
          sx={{ width: { xs: '100%', md: 260 }, flexShrink: 0 }}
          disabled={projectsQuery.isError}
        >
          <InputLabel id="project-select-label">{t('issues.project')}</InputLabel>
          <Select
            labelId="project-select-label"
            label={t('issues.project')}
            value={selectedProjectKey ?? ''}
            onChange={(e) => setSelectedProjectKey(e.target.value)}
            sx={{ '& .MuiSelect-select': { overflow: 'hidden', textOverflow: 'ellipsis' } }}
          >
            {(projectsQuery.data ?? []).map((p) => (
              <MenuItem key={p.key} value={p.key}>
                {p.name} ({p.key})
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {projectsQuery.isError ? (
          <Alert
            severity="error"
            sx={{ flexGrow: 1, py: 0 }}
            action={
              <Button
                color="inherit"
                size="small"
                onClick={() => projectsQuery.refetch()}
                disabled={projectsQuery.isFetching}
                startIcon={
                  projectsQuery.isFetching ? (
                    <CircularProgress size={14} color="inherit" />
                  ) : undefined
                }
              >
                {t('errors.retry')}
              </Button>
            }
          >
            {t(errorMessageKey(projectsQuery.error))}
          </Alert>
        ) : (
          <>
            <Stack
              direction="row"
              spacing={3}
              sx={{ flexGrow: 1, flexWrap: 'wrap', rowGap: 1 }}
            >
              <Stat testId="stat-total" label={t('panel.stats.total')} value={stats?.total} />
              <Stat
                testId="stat-unassigned"
                label={t('panel.stats.unassigned')}
                value={stats?.unassigned}
                color={stats && stats.unassigned > 0 ? 'error.main' : undefined}
              />
              <Stat
                testId="stat-atRisk"
                label={t('panel.stats.atRisk')}
                value={stats?.atRisk}
                color={stats && stats.atRisk > 0 ? 'warning.main' : undefined}
              />
              <Stat
                testId="stat-inProgress"
                label={t('panel.stats.inProgress')}
                value={stats?.byCategory.indeterminate}
              />
              <Stat testId="stat-done" label={t('panel.stats.done')} value={stats?.byCategory.done} />
            </Stack>

            {selectedProjectKey && (
              // flexShrink: 0 so the button keeps its full localized label rather
              // than being squeezed by the flex row (which clipped "Назначить
              // автоматически" → "Назначить автома…"). When the row is tight the
              // stats wrap instead; below `md` the whole panel stacks vertically.
              <Box sx={{ flexShrink: 0 }}>
                <AutoAssignButton
                  projectKey={selectedProjectKey}
                  unassignedCount={stats?.unassigned ?? 0}
                />
              </Box>
            )}
          </>
        )}
      </Stack>
    </Box>
  )
}

/** One headline number with its label; renders a dash while stats are loading.
 *  `testId` lands on the number so E2E can read a specific stat (e.g. at-risk). */
function Stat({
  label,
  value,
  color,
  testId,
}: {
  label: string
  value: number | undefined
  color?: string | undefined
  testId?: string | undefined
}) {
  return (
    <Box sx={{ textAlign: 'center', minWidth: 46 }}>
      <Typography
        variant="h6"
        component="div"
        data-testid={testId}
        sx={{ lineHeight: 1.1, fontWeight: 600, color }}
      >
        {value ?? '—'}
      </Typography>
      <Typography
        component="div"
        sx={{
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: '0.3px',
          textTransform: 'uppercase',
          color: 'text.secondary',
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </Typography>
    </Box>
  )
}
