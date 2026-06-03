import { useTranslation } from 'react-i18next'
import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import { errorMessageKey } from '@/shared/api'

interface ErrorStateProps {
  /** The thrown error (an `ApiError` carries a `code`). */
  error: unknown
  /** When provided, renders a Retry button that calls this (typically `query.refetch`). */
  onRetry?: (() => void) | undefined
  /**
   * Whether a retry is in flight (typically `query.isFetching`). Shows a spinner and
   * disables the button so the retry is visibly *happening* — including TanStack
   * Query's silent backoff re-attempts — instead of the button looking dead when a
   * persistently-failing call keeps re-erroring.
   */
  retrying?: boolean | undefined
}

/**
 * Inline surface for a failed read. Shows the i18n message keyed by the error
 * *code* (so the whole taxonomy — `forbidden`, `rateLimited`, … — reaches the
 * user, not a generic "failed to load"), with an optional Retry that refetches.
 * Used by the page/widget read branches; mutation errors render their own Alert
 * inside the Fix dialog.
 */
export function ErrorState({ error, onRetry, retrying = false }: ErrorStateProps) {
  const { t } = useTranslation()
  return (
    <Alert
      severity="error"
      action={
        onRetry ? (
          <Button
            color="inherit"
            size="small"
            onClick={onRetry}
            disabled={retrying}
            startIcon={
              retrying ? <CircularProgress size={14} color="inherit" /> : undefined
            }
          >
            {t('errors.retry')}
          </Button>
        ) : undefined
      }
    >
      {t(errorMessageKey(error))}
    </Alert>
  )
}
