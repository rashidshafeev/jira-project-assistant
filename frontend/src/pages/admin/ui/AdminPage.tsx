import { useTranslation } from 'react-i18next'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { AppConfigForm } from '@/features/app-config'

/**
 * The admin settings view, shown in the `jira:adminPage` module — an item in Jira's
 * admin "Apps" settings, which Jira renders to site admins ONLY. That surface IS the
 * access gate (Forge apps can't call `/mypermissions`): the config write lives on
 * this page's own resolver (`src/admin.ts`), unreachable from the non-admin global
 * page / issue panel. It hosts the app-wide config form — the at-risk window and the
 * unassigned grace period that everyone's views and the notification sweep share.
 * See `app/lib/entry-context.ts` (how this view is routed) and docs/forge-gotchas.md.
 */
export function AdminPage() {
  const { t } = useTranslation()
  return (
    <Box sx={{ px: 3, py: 2, maxWidth: 720 }}>
      <Typography variant="h6" component="h1" sx={{ fontWeight: 600 }}>
        {t('admin.title')}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 3 }}>
        {t('admin.subtitle')}
      </Typography>
      <AppConfigForm />
    </Box>
  )
}
