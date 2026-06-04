import { type ReactNode, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Alert from '@mui/material/Alert'
import AlertTitle from '@mui/material/AlertTitle'
import Avatar from '@mui/material/Avatar'
import Button from '@mui/material/Button'
import Collapse from '@mui/material/Collapse'
import Typography from '@mui/material/Typography'
import CircularProgress from '@mui/material/CircularProgress'
import { useIssue, detectProblems, hasProblem, dueInDays } from '@/entities/issue'
import { useDeadlineWindow } from '@/features/app-config'
import { FixIssueForm } from '@/features/fix-issue'
import { ErrorState, PriorityIcon, PrimaryButton } from '@/shared/ui'

/**
 * The single-issue view, shown in the `jira:issueContext` panel — the collapsible item
 * in Jira's right-hand issue context sidebar, present on every issue. It answers "is
 * this issue problematic, and why?" using the SAME pure `detectProblems` rules as the
 * table, then offers the SAME `FixIssueForm` remedies — rendered **inline** here (not in
 * a dialog): the `jira:issueContext` iframe is a tiny auto-resizing sidebar where a modal
 * looks cramped, so the panel expands the form in place while the table opens it in a
 * `FixIssueDialog`. One shared form, two chromes. See docs/forge/modals.md.
 *
 * Which issue this is comes from the Forge context (the host issue), resolved at
 * bootstrap into the entry route; in the mock it's the `?panel=KEY` URL param. The
 * `maxWidth` is just a readability upper bound — the context sidebar is narrower, so
 * the cap doesn't bind there. See `app/lib/entry-context.ts`.
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
  // One `now` per loaded issue, shared with the form so both classify identically.
  const now = useMemo(() => new Date(), [issueQuery.data])
  const [fixing, setFixing] = useState(false)
  // Mirrors the dialog: lock the Close control while a fix is being applied.
  const [busy, setBusy] = useState(false)

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
  // so refetch the issue when the form closes to reflect the new assignee/priority.
  const closeFix = () => {
    setFixing(false)
    void queryClient.invalidateQueries({ queryKey: ['issue', issueKey] })
  }

  return (
    <Box sx={{ p: 2, maxWidth: 480 }}>
      <Stack spacing={2}>
        {/* Compact issue key, for identity only. We deliberately DON'T reprint the
            summary or status: in Forge this panel is docked on the issue screen, which
            already shows all of that — the panel's value is the verdict + remedy below,
            not an echo of the host fields. The key stays as a small in-panel anchor. */}
        <Typography variant="overline" color="text.secondary" sx={{ lineHeight: 1 }}>
          {issue.key}
        </Typography>

        {/* Lead with the verdict — the one thing the host issue screen doesn't surface. */}
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

        {/* Just the two fields the rules reason about (priority, assignee) — so the
            verdict's "why" reads at a glance and the healthy state isn't bare. Status
            is dropped: it feeds no rule and only duplicates the host screen. */}
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
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

        {/* Card-footer action: right-aligned primary that expands the SAME Fix form the
            issues table opens in a dialog — inline here (no modal in the tiny iframe). */}
        {flagged && !fixing && (
          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <PrimaryButton onClick={() => setFixing(true)}>{t('issue.fix')}</PrimaryButton>
          </Box>
        )}
      </Stack>

      {/* The Fix remedies, expanded in place. Same `FixIssueForm` the dialog wraps, so
          the panel and the table offer identical content — just different chrome. */}
      {flagged && (
        <Collapse in={fixing} unmountOnExit>
          <Box
            sx={{ mt: 2, p: 2, border: 1, borderColor: 'divider', borderRadius: 1 }}
            data-testid="panel-fix"
          >
            <Typography variant="subtitle2">{t('fix.title', { key: issue.key })}</Typography>
            <FixIssueForm
              issue={issue}
              projectKey={projectKey}
              now={now}
              warningDays={warningDays}
              onResolved={closeFix}
              onBusyChange={setBusy}
            />
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
              <Button onClick={closeFix} disabled={busy}>
                {t('fix.close')}
              </Button>
            </Box>
          </Box>
        </Collapse>
      )}
    </Box>
  )
}

/** A labelled meta field (priority / assignee) in the panel. */
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
