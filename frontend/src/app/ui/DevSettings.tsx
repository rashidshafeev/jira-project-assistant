import { useTranslation } from 'react-i18next'
import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import DarkModeIcon from '@mui/icons-material/DarkMode'
import LightModeIcon from '@mui/icons-material/LightMode'
import { useThemeStore } from '@/app/model/theme.store'
import { SUPPORTED_LANGUAGES } from '@/shared/i18n'

const useMocks = import.meta.env.VITE_USE_MOCKS === 'true'

/**
 * Dev-only controls shown in the mock preview to exercise theme + language
 * without a Forge host. In Forge these follow the user's Jira settings, so the
 * controls are hidden.
 */
export function DevSettings() {
  const { t, i18n } = useTranslation()
  const mode = useThemeStore((s) => s.mode)
  const toggle = useThemeStore((s) => s.toggle)

  // Mock preview only. `useMocks` is a build-time constant, so in a Forge/prod
  // build this folds to `return null` and the bundler tree-shakes the dev UI
  // below out entirely (verified: the theme-toggle icons are absent from `dist`).
  if (!useMocks) return null

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <Tooltip title={t('settings.toggleTheme')}>
        <IconButton onClick={toggle} size="small" color="inherit">
          {mode === 'dark' ? <LightModeIcon /> : <DarkModeIcon />}
        </IconButton>
      </Tooltip>
      <Select
        size="small"
        value={i18n.language.slice(0, 2)}
        onChange={(e) => void i18n.changeLanguage(e.target.value)}
        aria-label={t('settings.language')}
        sx={{ '& .MuiSelect-select': { py: 0.5 } }}
      >
        {SUPPORTED_LANGUAGES.map((lang) => (
          <MenuItem key={lang} value={lang}>
            {lang.toUpperCase()}
          </MenuItem>
        ))}
      </Select>
    </Box>
  )
}
