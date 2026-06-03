import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import Badge from '@mui/material/Badge'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogActions from '@mui/material/DialogActions'
import Alert from '@mui/material/Alert'
import Snackbar from '@mui/material/Snackbar'
import CircularProgress from '@mui/material/CircularProgress'
import { errorMessageKey } from '@/shared/api'
import { PrimaryButton } from '@/shared/ui'
import { useAutoAssign } from '../api/useAutoAssign'
import type { AutoAssignSummary } from '../model/plan'

interface AutoAssignButtonProps {
  projectKey: string
  /** How many issues currently have no assignee (drives the label + disabled state). */
  unassignedCount: number
}

/**
 * Bulk action from the control panel. The brief requires a confirmation dialog
 * for bulk actions, so the button only opens a confirm; the mutation runs on
 * confirm. Disabled when there's nothing to assign. Errors surface inside the
 * dialog (so the user can retry); success shows a transient snackbar with the
 * count, and the dialog closes.
 */
export function AutoAssignButton({ projectKey, unassignedCount }: AutoAssignButtonProps) {
  const { t } = useTranslation()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [result, setResult] = useState<AutoAssignSummary | null>(null)
  const autoAssign = useAutoAssign(projectKey)

  const nothingToDo = unassignedCount === 0

  const handleConfirm = () => {
    autoAssign.mutate(undefined, {
      onSuccess: (summary) => {
        setResult(summary)
        setConfirmOpen(false)
      },
    })
  }

  const handleClose = () => {
    if (!autoAssign.isPending) {
      setConfirmOpen(false)
      autoAssign.reset()
    }
  }

  return (
    <>
      <Badge
        badgeContent={unassignedCount}
        color="error"
        sx={{ '& .MuiBadge-badge': { fontWeight: 700 } }}
      >
        <PrimaryButton disabled={nothingToDo} onClick={() => setConfirmOpen(true)}>
          {t('panel.autoAssign')}
        </PrimaryButton>
      </Badge>

      <Dialog open={confirmOpen} onClose={handleClose} maxWidth="xs" fullWidth>
        <DialogTitle>{t('panel.confirm.title')}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {t('panel.confirm.body', { count: unassignedCount })}
          </DialogContentText>
          {autoAssign.isError && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {t(errorMessageKey(autoAssign.error))}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} disabled={autoAssign.isPending}>
            {t('panel.confirm.cancel')}
          </Button>
          <PrimaryButton
            onClick={handleConfirm}
            disabled={autoAssign.isPending}
            startIcon={
              autoAssign.isPending ? <CircularProgress size={16} color="inherit" /> : undefined
            }
          >
            {t('panel.confirm.confirm')}
          </PrimaryButton>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={result !== null}
        autoHideDuration={4000}
        onClose={() => setResult(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity={result && result.failed > 0 ? 'warning' : 'success'}
          onClose={() => setResult(null)}
        >
          {result && result.failed > 0
            ? t('panel.resultPartial', { assigned: result.assigned, failed: result.failed })
            : t('panel.result', { count: result?.assigned ?? 0 })}
        </Alert>
      </Snackbar>
    </>
  )
}
