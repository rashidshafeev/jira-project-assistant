import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Button from '@mui/material/Button'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import Alert from '@mui/material/Alert'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import CircularProgress from '@mui/material/CircularProgress'
import { detectProblems } from '@/entities/issue'
import { useMembers } from '@/entities/member'
import { errorMessageKey, type Issue, type IssuePriority } from '@/shared/api'
import { PrimaryButton } from '@/shared/ui'
import { useAssignIssue, useSetPriority } from '../api/useFixMutations'

interface FixIssueFormProps {
  issue: Issue
  projectKey: string
  now: Date
  /** At-risk window in days — must match the view that opened the form, so the same
   *  problems (and thus the same fix sections) show. */
  warningDays: number
  /** Called after a successful assign/raise (the opener closes / collapses + refetches). */
  onResolved: () => void
  /** Reports the in-flight mutation state so the wrapper (dialog/panel) can disable its
   *  own dismiss control while a fix is being applied. */
  onBusyChange?: (busy: boolean) => void
}

/** Priorities offered as "raise to" targets for a low-priority near-deadline issue. */
const RAISE_TARGETS: IssuePriority[] = ['Medium', 'High']

/**
 * The Fix remedies (assign an owner / raise priority) for a problematic issue — the
 * single source of truth for the content, rendered two ways:
 *  - wrapped in a MUI `<Dialog>` on the global-page table (`FixIssueDialog`), where a
 *    modal overlays the big iframe fine;
 *  - inline in the `jira:issueContext` panel (`IssuePanelPage`), where the tiny
 *    auto-resizing iframe can't host a modal — see docs/forge/modals.md.
 * Which sections show is driven by the SAME pure `detectProblems` rules as the table.
 */
export function FixIssueForm({
  issue,
  projectKey,
  now,
  warningDays,
  onResolved,
  onBusyChange,
}: FixIssueFormProps) {
  const { t } = useTranslation()
  const problems = detectProblems(issue, now, warningDays)

  const membersQuery = useMembers(projectKey)
  const assign = useAssignIssue(projectKey)
  const setPriority = useSetPriority(projectKey)

  const [accountId, setAccountId] = useState('')

  const busy = assign.isPending || setPriority.isPending
  const error = assign.error ?? setPriority.error

  // Surface the busy flag to the wrapper so it can lock its dismiss control.
  useEffect(() => {
    onBusyChange?.(busy)
  }, [busy, onBusyChange])

  const handleAssign = () => {
    const member = membersQuery.data?.find((m) => m.accountId === accountId)
    if (!member) return
    assign.mutate({ issue, member }, { onSuccess: onResolved })
  }

  const handleRaise = (priority: IssuePriority) => {
    setPriority.mutate({ issue, priority }, { onSuccess: onResolved })
  }

  return (
    <Stack spacing={3} sx={{ mt: 1 }}>
      {error && <Alert severity="error">{t(errorMessageKey(error))}</Alert>}

      {problems.unassigned && (
        <Stack spacing={1.5}>
          <Typography variant="subtitle2">{t('fix.assignHeading')}</Typography>
          {membersQuery.isPending ? (
            <CircularProgress size={20} />
          ) : membersQuery.isError ? (
            <Alert
              severity="error"
              action={
                <Button
                  color="inherit"
                  size="small"
                  onClick={() => membersQuery.refetch()}
                  disabled={membersQuery.isFetching}
                  startIcon={
                    membersQuery.isFetching ? (
                      <CircularProgress size={14} color="inherit" />
                    ) : undefined
                  }
                >
                  {t('errors.retry')}
                </Button>
              }
            >
              {t(errorMessageKey(membersQuery.error))}
            </Alert>
          ) : (
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
              <FormControl size="small" fullWidth>
                <InputLabel id="assignee-label">{t('fix.assignee')}</InputLabel>
                <Select
                  labelId="assignee-label"
                  label={t('fix.assignee')}
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                >
                  {membersQuery.data
                    .filter((m) => m.active)
                    .map((m) => (
                      <MenuItem key={m.accountId} value={m.accountId}>
                        {m.displayName}
                      </MenuItem>
                    ))}
                </Select>
              </FormControl>
              <PrimaryButton disabled={accountId === '' || busy} onClick={handleAssign}>
                {t('fix.assign')}
              </PrimaryButton>
            </Stack>
          )}
        </Stack>
      )}

      {problems.lowPriorityNearDeadline && (
        <Stack spacing={1.5}>
          <Typography variant="subtitle2">{t('fix.raiseHeading')}</Typography>
          <Typography variant="body2" color="text.secondary">
            {t('fix.currentPriority', { priority: issue.priority ?? '—' })}
          </Typography>
          <Stack direction="row" spacing={1}>
            {RAISE_TARGETS.map((p) => (
              <Button
                key={p}
                variant="outlined"
                disabled={busy || issue.priority === p}
                onClick={() => handleRaise(p)}
              >
                {t('fix.raiseTo', { priority: p })}
              </Button>
            ))}
          </Stack>
        </Stack>
      )}
    </Stack>
  )
}
