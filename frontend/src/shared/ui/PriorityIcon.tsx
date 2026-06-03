import Tooltip from '@mui/material/Tooltip'
import { useTheme } from '@mui/material/styles'
import type { SvgIconComponent } from '@mui/icons-material'
import KeyboardDoubleArrowUp from '@mui/icons-material/KeyboardDoubleArrowUp'
import KeyboardArrowUp from '@mui/icons-material/KeyboardArrowUp'
import DragHandle from '@mui/icons-material/DragHandle'
import KeyboardArrowDown from '@mui/icons-material/KeyboardArrowDown'
import KeyboardDoubleArrowDown from '@mui/icons-material/KeyboardDoubleArrowDown'
import type { IssuePriority, IssuePriorityOrNone } from '@/shared/api'
import { PRIORITY_COLORS } from '@/shared/config/atlassian-tokens'

/**
 * Jira-style priority severity icon: a single small colored glyph (no text), the
 * way Jira renders priority everywhere outside the issue-detail field. Shapes
 * disambiguate the levels (double/single chevron up · equal bars · single/double
 * chevron down) so it stays readable for color-blind users; colors come from the
 * real Atlassian `color.icon.accent.*` tokens (theme-aware via `PRIORITY_COLORS`).
 *
 * A `null` priority renders NOTHING — Jira treats priority as optional, so an empty
 * cell is the honest treatment (not a fake "—" implying a real severity).
 */
const PRIORITY_ICON: Record<IssuePriority, SvgIconComponent> = {
  Highest: KeyboardDoubleArrowUp,
  High: KeyboardArrowUp,
  Medium: DragHandle,
  Low: KeyboardArrowDown,
  Lowest: KeyboardDoubleArrowDown,
}

/** Severity order for sorting (Highest = 5 … Lowest = 1; none = 0). */
export const PRIORITY_RANK: Record<IssuePriority, number> = {
  Highest: 5,
  High: 4,
  Medium: 3,
  Low: 2,
  Lowest: 1,
}

export function PriorityIcon({ priority }: { priority: IssuePriorityOrNone }) {
  const { palette } = useTheme()
  if (priority === null) return null
  const Icon = PRIORITY_ICON[priority]
  return (
    <Tooltip title={priority}>
      <Icon
        fontSize="small"
        aria-label={priority}
        sx={{ color: PRIORITY_COLORS[palette.mode][priority], display: 'block' }}
      />
    </Tooltip>
  )
}
