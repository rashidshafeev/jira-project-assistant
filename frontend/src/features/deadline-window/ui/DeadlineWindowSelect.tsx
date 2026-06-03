import { useTranslation } from 'react-i18next'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import {
  DEADLINE_WINDOW_OPTIONS,
  useDeadlineWindow,
  useSetDeadlineWindow,
} from '../api/useDeadlineWindow'

/**
 * Compact dropdown for the per-user at-risk window, shown to the right of the
 * tabs. Changing it re-flags the issues table, the at-risk stat and the Fix
 * dialog at once (they all read `useDeadlineWindow`), and the choice is persisted.
 */
export function DeadlineWindowSelect() {
  const { t } = useTranslation()
  const days = useDeadlineWindow()
  const setDays = useSetDeadlineWindow()

  // Always include the current value, even if a previously-saved one isn't a preset.
  const options = Array.from(new Set<number>([...DEADLINE_WINDOW_OPTIONS, days])).sort(
    (a, b) => a - b,
  )

  return (
    <FormControl size="small" sx={{ minWidth: 150, flexShrink: 0 }}>
      <InputLabel id="deadline-window-label">{t('deadline.label')}</InputLabel>
      <Select
        labelId="deadline-window-label"
        label={t('deadline.label')}
        value={days}
        onChange={(e) => setDays.mutate(Number(e.target.value))}
      >
        {options.map((d) => (
          <MenuItem key={d} value={d}>
            {t('deadline.days', { days: d })}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  )
}
