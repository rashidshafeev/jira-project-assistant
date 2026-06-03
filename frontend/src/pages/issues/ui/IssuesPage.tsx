import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { useSessionStore } from '@/app/model/session.store'
import { useProjects } from '@/entities/project'
import { useIssues } from '@/entities/issue'
import { useDeadlineWindow } from '@/features/deadline-window'
import { IssuesTable } from '@/widgets/issues-table'
import { FixIssueDialog } from '@/features/fix-issue'
import { ErrorState } from '@/shared/ui'
import type { Issue } from '@/shared/api'

export function IssuesPage() {
  const { t } = useTranslation()
  const selectedProjectKey = useSessionStore((s) => s.selectedProjectKey)

  // The project picker + defaulting live in the ControlPanel now; this page just
  // reads the selection. We still observe `useProjects` (cached — same entry the
  // panel reads) to distinguish "projects still loading / failed" from "selected".
  const projectsQuery = useProjects()
  const issuesQuery = useIssues(selectedProjectKey)
  // Per-user at-risk window — the table highlighting and the dialog's problem
  // detection must use the same threshold, so the page owns it and passes it down.
  const warningDays = useDeadlineWindow()

  // One `now` for the whole render so the table's highlighting and the dialog's
  // problem detection agree. Recomputed only when the issue set changes.
  const now = useMemo(() => new Date(), [issuesQuery.data])
  const [fixIssue, setFixIssue] = useState<Issue | null>(null)

  if (projectsQuery.isError) {
    return (
      <ErrorState
        error={projectsQuery.error}
        onRetry={() => projectsQuery.refetch()}
        retrying={projectsQuery.isFetching}
      />
    )
  }
  if (issuesQuery.isError) {
    return (
      <ErrorState
        error={issuesQuery.error}
        onRetry={() => issuesQuery.refetch()}
        retrying={issuesQuery.isFetching}
      />
    )
  }

  // Loading covers "projects still loading / none selected yet / issues loading" —
  // the table shows its skeleton overlay instead of a separate spinner screen.
  const loading =
    projectsQuery.isPending || selectedProjectKey === null || issuesQuery.isPending
  const issues = issuesQuery.data ?? []

  if (!loading && issues.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        {t('issues.empty')}
      </Typography>
    )
  }

  return (
    <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <IssuesTable
        issues={issues}
        now={now}
        warningDays={warningDays}
        loading={loading}
        onFix={setFixIssue}
      />

      {fixIssue && selectedProjectKey && (
        <FixIssueDialog
          issue={fixIssue}
          projectKey={selectedProjectKey}
          now={now}
          warningDays={warningDays}
          onClose={() => setFixIssue(null)}
        />
      )}
    </Box>
  )
}
