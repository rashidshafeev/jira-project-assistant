import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import Typography from '@mui/material/Typography'
import { useSessionStore } from '@/app/model/session.store'
import { useMembers, computeMemberStats } from '@/entities/member'
import { useIssues } from '@/entities/issue'
import { TeamTable } from '@/widgets/team-table'
import { ErrorState } from '@/shared/ui'

/**
 * Team page (brief §4): project members with their assigned-issue counts and an
 * activity metric. Counts are derived purely from the members + issues queries
 * (same cached entries the Issues tab/control panel read — no extra fetch).
 */
export function TeamPage() {
  const { t } = useTranslation()
  const selectedProjectKey = useSessionStore((s) => s.selectedProjectKey)

  const membersQuery = useMembers(selectedProjectKey)
  const issuesQuery = useIssues(selectedProjectKey)

  const stats = useMemo(
    () =>
      membersQuery.data && issuesQuery.data
        ? computeMemberStats(membersQuery.data, issuesQuery.data)
        : null,
    [membersQuery.data, issuesQuery.data],
  )

  if (membersQuery.isError || issuesQuery.isError) {
    return (
      <ErrorState
        error={membersQuery.error ?? issuesQuery.error}
        onRetry={() => {
          if (membersQuery.isError) void membersQuery.refetch()
          if (issuesQuery.isError) void issuesQuery.refetch()
        }}
        retrying={membersQuery.isFetching || issuesQuery.isFetching}
      />
    )
  }

  const loading =
    selectedProjectKey === null || membersQuery.isPending || issuesQuery.isPending
  const rows = stats ?? []

  if (!loading && rows.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        {t('team.empty')}
      </Typography>
    )
  }

  return <TeamTable stats={rows} loading={loading} />
}
