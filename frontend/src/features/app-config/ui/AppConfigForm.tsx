import { useTranslation } from 'react-i18next'
import Stack from '@mui/material/Stack'
import FormControl from '@mui/material/FormControl'
import FormHelperText from '@mui/material/FormHelperText'
import InputLabel from '@mui/material/InputLabel'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import type { AppConfig } from '@/shared/api'
import { DEFAULT_APP_CONFIG } from '@/shared/config/app-config'
import {
  DEADLINE_WINDOW_OPTIONS,
  GRACE_DAYS_OPTIONS,
  useAppConfig,
  useSetAppConfig,
} from '../api/useAppConfig'

/**
 * The app-wide settings form, rendered on the admin page (`pages/admin`). Two
 * selects over the one {@link AppConfig} record: the at-risk window (drives the
 * issues view + stats for everyone) and the unassigned grace period (drives the
 * notification sweep's "no assignee for over N days" alert). Each change persists
 * immediately and optimistically (see `useSetAppConfig`) — there's no separate
 * Save button, matching the rest of the app's instant-apply controls.
 */
export function AppConfigForm() {
  const { t } = useTranslation()
  const { data } = useAppConfig()
  const setConfig = useSetAppConfig()
  const config = data ?? DEFAULT_APP_CONFIG

  // Patch one field, keeping the other — the mutation persists the whole record.
  const update = (patch: Partial<AppConfig>) => setConfig.mutate({ ...config, ...patch })

  // Always include the saved value, even if it isn't one of the presets.
  const windowOptions = withCurrent(DEADLINE_WINDOW_OPTIONS, config.deadlineWarningDays)
  const graceOptions = withCurrent(GRACE_DAYS_OPTIONS, config.unassignedGraceDays)

  return (
    <Stack spacing={3} sx={{ maxWidth: 420 }}>
      <FormControl size="small" fullWidth>
        <InputLabel id="deadline-window-label">{t('deadline.label')}</InputLabel>
        <Select
          labelId="deadline-window-label"
          label={t('deadline.label')}
          value={config.deadlineWarningDays}
          onChange={(e) => update({ deadlineWarningDays: Number(e.target.value) })}
        >
          {windowOptions.map((d) => (
            <MenuItem key={d} value={d}>
              {t('deadline.days', { days: d })}
            </MenuItem>
          ))}
        </Select>
        <FormHelperText>{t('admin.deadline.help')}</FormHelperText>
      </FormControl>

      <FormControl size="small" fullWidth>
        <InputLabel id="grace-days-label">{t('admin.grace.label')}</InputLabel>
        <Select
          labelId="grace-days-label"
          label={t('admin.grace.label')}
          value={config.unassignedGraceDays}
          onChange={(e) => update({ unassignedGraceDays: Number(e.target.value) })}
        >
          {graceOptions.map((d) => (
            <MenuItem key={d} value={d}>
              {d === 0 ? t('admin.grace.immediate') : t('admin.grace.days', { count: d })}
            </MenuItem>
          ))}
        </Select>
        <FormHelperText>{t('admin.grace.help')}</FormHelperText>
      </FormControl>
    </Stack>
  )
}

/** Presets plus the current value (deduped, sorted) so a saved non-preset still shows. */
function withCurrent(presets: readonly number[], current: number): number[] {
  return Array.from(new Set<number>([...presets, current])).sort((a, b) => a - b)
}
