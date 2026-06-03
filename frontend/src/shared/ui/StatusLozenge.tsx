import Box from '@mui/material/Box'
import { useTheme } from '@mui/material/styles'
import type { StatusCategory } from '@/shared/api'
import { LOZENGE_TOKENS } from '@/shared/config/atlassian-tokens'

/**
 * Atlassian-style status lozenge: a small, uppercase, bold pill colored by the
 * issue's status *category* (the language-stable key), mirroring @atlaskit/lozenge
 * appearances — `new`→grey, `indeterminate`→blue, `done`→green. Colors are the
 * real Atlassian accent tokens (see `LOZENGE_TOKENS`); the mode comes from the MUI
 * theme, so this stays in `shared` without importing the app-layer theme store.
 */
const CATEGORY_KEY: Record<StatusCategory, 'todo' | 'inProgress' | 'done'> = {
  new: 'todo',
  indeterminate: 'inProgress',
  done: 'done',
}

export function StatusLozenge({
  label,
  category,
}: {
  label: string
  category: StatusCategory
}) {
  const { palette } = useTheme()
  const c = LOZENGE_TOKENS[palette.mode][CATEGORY_KEY[category]]
  return (
    <Box
      component="span"
      title={label}
      sx={{
        display: 'inline-block',
        maxWidth: '100%',
        bgcolor: c.bg,
        color: c.text,
        fontSize: 11,
        fontWeight: 700,
        lineHeight: '16px',
        letterSpacing: '0.5px',
        textTransform: 'uppercase',
        px: 0.75,
        py: '2px',
        borderRadius: '3px',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </Box>
  )
}
