import { useTranslation } from 'react-i18next'
import Stack from '@mui/material/Stack'
import FormControl from '@mui/material/FormControl'
import FormHelperText from '@mui/material/FormHelperText'
import InputLabel from '@mui/material/InputLabel'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import { DEFAULT_APP_CONFIG } from '@/shared/config/app-config'
import { DEADLINE_WINDOW_OPTIONS, useAppConfig, useSetAppConfig } from '../api/useAppConfig'

/**
 * The app-wide settings form, rendered on the admin page (`pages/admin`). One
 * select over the {@link import('@/shared/api').AppConfig} record: the at-risk
 * window, which drives the issues view, the stats and the issue panel for everyone.
 * The change persists immediately and optimistically (see `useSetAppConfig`) —
 * there's no separate Save button, matching the app's instant-apply controls.
 */
export function AppConfigForm() {
  const { t } = useTranslation()
  const { data } = useAppConfig()
  const setConfig = useSetAppConfig()
  const days = data?.deadlineWarningDays ?? DEFAULT_APP_CONFIG.deadlineWarningDays

  // Always include the saved value, even if it isn't one of the presets.
  const options = Array.from(new Set<number>([...DEADLINE_WINDOW_OPTIONS, days])).sort(
    (a, b) => a - b,
  )

  return (
    <Stack spacing={3} sx={{ maxWidth: 420 }}>
      <FormControl size="small" fullWidth>
        <InputLabel id="deadline-window-label">{t('deadline.label')}</InputLabel>
        <Select
          labelId="deadline-window-label"
          label={t('deadline.label')}
          value={days}
          onChange={(e) => setConfig.mutate({ deadlineWarningDays: Number(e.target.value) })}
        >
          {options.map((d) => (
            <MenuItem key={d} value={d}>
              {t('deadline.days', { days: d })}
            </MenuItem>
          ))}
        </Select>
        <FormHelperText>{t('admin.deadline.help')}</FormHelperText>
      </FormControl>
    </Stack>
  )
}
