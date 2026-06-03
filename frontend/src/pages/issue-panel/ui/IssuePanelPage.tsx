import { type ReactNode, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Alert from '@mui/material/Alert'
import AlertTitle from '@mui/material/AlertTitle'
import Avatar from '@mui/material/Avatar'
import Typography from '@mui/material/Typography'
import CircularProgress from '@mui/material/CircularProgress'
import { useIssue, detectProblems, hasProblem, dueInDays } from '@/entities/issue'
import { useDeadlineWindow } from '@/features/deadline-window'
import { FixIssueDialog } from '@/features/fix-issue'
import { ErrorState, StatusLozenge, PriorityIcon, PrimaryButton } from '@/shared/ui'

/**
 * The `jira:issuePanel` view: a single issue, shown in Jira's right-hand panel on
 * the issue-detail screen. It answers "is this issue problematic, and why?" using
 * the SAME pure `detectProblems` rules as the table, then offers the SAME
 * `FixIssueDialog` remedies — so the panel is a focused, in-context entry point to
 * the assistant's two value props without re-implementing either.
 *
 * Which issue this is comes from the Forge context (the host issue), resolved at
 * bootstrap into the entry route; in the mock it's the `?panel=KEY` URL param. See
 * `app/lib/entry-context.ts`.
 */
export function IssuePanelPage({
  issueKey,
  projectKey,
}: {
  issueKey: string
  projectKey: string
}) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const issueQuery = useIssue(issueKey)
  // Same at-risk window the table/dialog use, so this view's flag agrees with them.
  const warningDays = useDeadlineWindow()
  // One `now` per loaded issue, shared with the dialog so both classify identically.
  const now = useMemo(() => new Date(), [issueQuery.data])
  const [fixing, setFixing] = useState(false)

  if (issueQuery.isError) {
    return (
      <Box sx={{ p: 2 }}>
        <ErrorState
          error={issueQuery.error}
          onRetry={() => issueQuery.refetch()}
          retrying={issueQuery.isFetching}
        />
      </Box>
    )
  }

  if (issueQuery.isPending) {
    return (
      <Box sx={{ p: 2, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    )
  }

  const issue = issueQuery.data
  const problems = detectProblems(issue, now, warningDays)
  const flagged = hasProblem(problems)

  // Deadline-framed label for the near-deadline reason — same phrasing as the table.
  const days = problems.lowPriorityNearDeadline ? dueInDays(issue.dueDate, now) : null
  const dueLabel =
    days === null
      ? null
      : days > 0
        ? t('issue.deadlineIn', { count: days })
        : days < 0
          ? t('issue.overdueBy', { count: -days })
          : t('issue.deadlineToday')

  const reasons: string[] = [
    problems.unassigned && t('issue.noAssignee'),
    problems.lowPriorityNearDeadline &&
      (dueLabel
        ? `${t('issue.lowPriorityDeadline')} · ${dueLabel}`
        : t('issue.lowPriorityDeadline')),
  ].filter((r): r is string => Boolean(r))

  // The Fix mutations patch the issues-LIST cache, not this single-issue query —
  // so refetch the issue when the dialog closes to reflect the new assignee/priority.
  const closeFix = () => {
    setFixing(false)
    void queryClient.invalidateQueries({ queryKey: ['issue', issueKey] })
  }

  return (
    <Box sx={{ p: 2, maxWidth: 480 }}>
      <Stack spacing={2}>
        <Box>
          <Typography variant="overline" color="text.secondary">
            {issue.key}
          </Typography>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, lineHeight: 1.3 }}>
            {issue.summary}
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
          <Meta label={t('table.status')}>
            <StatusLozenge label={issue.status.name} category={issue.status.category} />
          </Meta>
          <Meta label={t('table.priority')}>
            {issue.priority ? (
              <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
                <PriorityIcon priority={issue.priority} />
                <Typography variant="body2">{issue.priority}</Typography>
              </Stack>
            ) : (
              <Typography variant="body2" color="text.secondary">
                —
              </Typography>
            )}
          </Meta>
          <Meta label={t('table.assignee')}>
            {issue.assignee ? (
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                <Avatar
                  src={issue.assignee.avatarUrl}
                  sx={{ width: 24, height: 24, fontSize: 12 }}
                >
                  {issue.assignee.displayName.charAt(0)}
                </Avatar>
                <Typography variant="body2">{issue.assignee.displayName}</Typography>
              </Stack>
            ) : (
              <Typography variant="body2" color="text.secondary">
                {t('issue.unassigned')}
              </Typography>
            )}
          </Meta>
        </Box>

        {flagged ? (
          <Alert severity="warning" data-testid="panel-flagged">
            <AlertTitle>{t('issuePanel.flagged')}</AlertTitle>
            <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
              {reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </Box>
          </Alert>
        ) : (
          <Alert severity="success" data-testid="panel-healthy">
            {t('issuePanel.healthy')}
          </Alert>
        )}

        {flagged && (
          <Box>
            <PrimaryButton onClick={() => setFixing(true)}>{t('issue.fix')}</PrimaryButton>
          </Box>
        )}
      </Stack>

      {fixing && (
        <FixIssueDialog
          issue={issue}
          projectKey={projectKey}
          now={now}
          warningDays={warningDays}
          onClose={closeFix}
        />
      )}
    </Box>
  )
}

/** A labelled meta field (status / priority / assignee) in the panel header. */
function Meta({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
        {label}
      </Typography>
      <Box sx={{ mt: 0.5 }}>{children}</Box>
    </Box>
  )
}
