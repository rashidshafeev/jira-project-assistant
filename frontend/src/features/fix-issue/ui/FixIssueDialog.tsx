import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import type { Issue } from '@/shared/api'
import { FixIssueForm } from './FixIssueForm'

interface FixIssueDialogProps {
  issue: Issue
  projectKey: string
  now: Date
  /** At-risk window in days — must match the table that opened the dialog, so the
   *  same problems (and thus the same fix sections) show. */
  warningDays: number
  onClose: () => void
}

/**
 * The Fix remedies in a modal — used on the global-page table, where the big iframe
 * hosts a modal cleanly. The content is the shared {@link FixIssueForm}; the issue
 * panel renders that SAME form inline instead (a modal looks cramped in the tiny
 * `jira:issueContext` iframe — see docs/forge/modals.md).
 */
export function FixIssueDialog({
  issue,
  projectKey,
  now,
  warningDays,
  onClose,
}: FixIssueDialogProps) {
  const { t } = useTranslation()
  // Lifted from the form so the dialog can lock its dismiss controls mid-mutation.
  const [busy, setBusy] = useState(false)

  return (
    <Dialog open onClose={busy ? undefined : onClose} fullWidth maxWidth="xs">
      <DialogTitle>{t('fix.title', { key: issue.key })}</DialogTitle>
      <DialogContent>
        <FixIssueForm
          issue={issue}
          projectKey={projectKey}
          now={now}
          warningDays={warningDays}
          onResolved={onClose}
          onBusyChange={setBusy}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>
          {t('fix.close')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
