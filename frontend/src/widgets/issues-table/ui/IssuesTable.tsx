import { useEffect, useMemo, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { GridColDef } from '@mui/x-data-grid'
import Avatar from '@mui/material/Avatar'
import Box from '@mui/material/Box'
import Link from '@mui/material/Link'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutlineRounded'
import WarningAmberIcon from '@mui/icons-material/WarningAmberRounded'
import PersonIcon from '@mui/icons-material/PersonRounded'
import { AppDataGrid, StatusLozenge, PriorityIcon, PRIORITY_RANK, PrimaryButton } from '@/shared/ui'
import type { Issue } from '@/shared/api'
import { detectProblems, hasProblem, dueInDays, type IssueProblems } from '@/entities/issue'
import { usePersistedGrid } from '@/features/table-prefs'
import { openIssue } from '@/shared/lib'

interface IssuesTableProps {
  issues: Issue[]
  now: Date
  /** At-risk window in days — drives which issues are flagged near their deadline. */
  warningDays: number
  loading?: boolean
  onFix?: (issue: Issue) => void
}

/** Row = the issue plus its precomputed problems (so cells don't recompute per render). */
interface IssueRow extends Issue {
  problems: IssueProblems
  problematic: boolean
  /** Localized deadline label ("Deadline in 2 days" / "1 day overdue" / "Deadline
   *  today"), shown on hover; null unless the near-deadline problem is present. */
  dueLabel: string | null
}

/** Columns the grid autosizes to content (so the localized Fix button always
 *  fits) instead of a fixed width. Module-level so the hook's deps are stable. */
const AUTOSIZE_FIELDS = ['actions']

/**
 * A small problem marker that rides on the Fix button's top edge: a solid circle
 * in the problem's colour (red = unassigned, amber = near-deadline) with a black
 * glyph. No border — the colour carries it. Two sit side by side when an issue has
 * both problems. Decorative (the button's tooltip names the problems).
 *
 * The fills are BOLD colours meant to sit behind a dark glyph. Red uses
 * `error.main` (the danger bold token, fine under black). Amber uses the Atlassian
 * bold-warning fill `#FBC828` directly, NOT `warning.main` — that palette entry is
 * the warning *foreground* token (`#9E4C00` in light), which a black icon reads as
 * muddy. (The amber foreground is still correct for the row accent + at-risk stat.)
 */
const PIP_AMBER = '#FBC828'

function ProblemPip({ kind, icon }: { kind: 'error' | 'warning'; icon: ReactNode }) {
  return (
    <Box
      aria-hidden
      data-testid={`pip-${kind}`}
      sx={(theme) => ({
        width: 16,
        height: 16,
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: theme.palette.common.black,
        bgcolor: kind === 'warning' ? PIP_AMBER : theme.palette.error.main,
        boxShadow: theme.shadows[2],
      })}
    >
      {icon}
    </Box>
  )
}

export function IssuesTable({
  issues,
  now,
  warningDays,
  loading = false,
  onFix,
}: IssuesTableProps) {
  const { t, i18n } = useTranslation()
  // Persist this table's sort/filter/column layout per user (Forge storage). The
  // actions column is autosized to its button (see below), not persisted.
  const { gridProps, autosize } = usePersistedGrid('issues', { autosizeFields: AUTOSIZE_FIELDS })

  const rows = useMemo<IssueRow[]>(() => {
    return issues.map((issue) => {
      const problems = detectProblems(issue, now, warningDays)
      // Deadline-framed, localized time-left for the near-deadline problem:
      // "Deadline in N days" (future) / "N days overdue" (past) / "Deadline today".
      // i18next handles the plurals (en: one/other; ru: one/few/many) via `count`.
      const days = problems.lowPriorityNearDeadline ? dueInDays(issue.dueDate, now) : null
      const dueLabel =
        days === null
          ? null
          : days > 0
            ? t('issue.deadlineIn', { count: days })
            : days < 0
              ? t('issue.overdueBy', { count: -days })
              : t('issue.deadlineToday')
      return { ...issue, problems, problematic: hasProblem(problems), dueLabel }
    })
  }, [issues, now, warningDays, t])

  // Fit the actions column to its rendered button once rows exist, and again
  // when the language changes — the "Fix" label width is locale-dependent, so no
  // hardcoded per-locale width. rAF lets the (re)render commit before measuring.
  useEffect(() => {
    if (rows.length === 0) return
    const id = requestAnimationFrame(autosize)
    return () => cancelAnimationFrame(id)
  }, [rows.length, i18n.language, autosize])

  const columns = useMemo<GridColDef<IssueRow>[]>(
    () => [
      {
        field: 'key',
        headerName: t('table.key'),
        width: 130,
        renderCell: (p) => (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, height: '100%' }}>
            {p.row.problems.unassigned && (
              <Tooltip title={t('issue.noAssignee')}>
                <ErrorOutlineIcon sx={{ fontSize: 16, color: 'error.main' }} />
              </Tooltip>
            )}
            {p.row.problems.lowPriorityNearDeadline && (
              <Tooltip title={p.row.dueLabel ?? t('issue.lowPriorityDeadline')}>
                <WarningAmberIcon sx={{ fontSize: 16, color: 'warning.main' }} />
              </Tooltip>
            )}
            {/* The key opens the issue in Jira (a new tab, via router.open). A raw <a>
                can't reach the real Jira site from inside the sandboxed Custom UI
                iframe — a relative link resolves against the iframe origin — so we
                route through the bridge (openIssue). The href stays for affordance
                (pointer cursor, right-click "copy link") but we preventDefault and let
                the bridge navigate; in the mock openIssue is a no-op (the tooltip says
                it opens in Jira). It's a link (role=link), NOT a button, so the row's
                lone-button Fix selector stays unambiguous. */}
            {/* `describeChild`: attach the tooltip as a DESCRIPTION (aria-describedby),
                not the accessible NAME. Without it, MUI sets aria-label="Open in Jira"
                on the <a>, masking the key text — every key would read identically to a
                screen reader. With it, the link's name stays the key. */}
            <Tooltip title={t('issue.openInJira')} describeChild>
              <Link
                href={`/browse/${p.row.key}`}
                onClick={(e) => {
                  e.preventDefault()
                  void openIssue(p.row.key)
                }}
                underline="hover"
                variant="body2"
                sx={{ fontWeight: 600 }}
              >
                {p.row.key}
              </Link>
            </Tooltip>
          </Box>
        ),
      },
      { field: 'summary', headerName: t('table.summary'), flex: 1, minWidth: 200 },
      {
        field: 'status',
        headerName: t('table.status'),
        width: 150,
        valueGetter: (_v, row) => row.status.name,
        renderCell: (p) => (
          <Box sx={{ display: 'flex', alignItems: 'center', height: '100%', minWidth: 0 }}>
            <StatusLozenge label={p.row.status.name} category={p.row.status.category} />
          </Box>
        ),
      },
      {
        field: 'assignee',
        headerName: t('table.assignee'),
        width: 180,
        valueGetter: (_v, row) => row.assignee?.displayName ?? '',
        renderCell: (p) =>
          p.row.assignee ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, height: '100%', minWidth: 0 }}>
              <Avatar
                src={p.row.assignee.avatarUrl}
                sx={{ width: 24, height: 24, fontSize: 12, flexShrink: 0 }}
              >
                {p.row.assignee.displayName.charAt(0)}
              </Avatar>
              <Typography variant="body2" noWrap>
                {p.row.assignee.displayName}
              </Typography>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, height: '100%' }}>
              {/* Native-Jira "unassigned" avatar: a neutral gray circle with a
                  generic person glyph (theme-aware via the grey palette), so the
                  assignee column keeps a consistent avatar shape across rows. */}
              <Avatar
                sx={{
                  width: 24,
                  height: 24,
                  bgcolor: (theme) =>
                    theme.palette.mode === 'dark' ? theme.palette.grey[700] : theme.palette.grey[300],
                  color: 'text.secondary',
                }}
              >
                <PersonIcon sx={{ fontSize: 16 }} />
              </Avatar>
              <Typography variant="body2" color="text.secondary">
                {t('issue.unassigned')}
              </Typography>
            </Box>
          ),
      },
      {
        field: 'priority',
        headerName: t('table.priority'),
        width: 110,
        // Semantically a numeric rank; `type: 'number'` gives numeric sort/filter
        // operators (consistent with the team-table counts). It right-aligns by
        // default, so we re-assert center for the icon.
        type: 'number',
        align: 'center',
        headerAlign: 'center',
        // Sort by severity *rank*, not the localized name: none = 0 sits at the
        // bottom extreme (first ascending / last descending), never interleaved
        // with real priorities (Highest = 5 … Lowest = 1, see PRIORITY_RANK).
        valueGetter: (_v, row) => (row.priority ? PRIORITY_RANK[row.priority] : 0),
        renderCell: (p) => (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <PriorityIcon priority={p.row.priority} />
          </Box>
        ),
      },
      {
        field: 'actions',
        headerName: t('table.actions'),
        // Width is *autosized* to the rendered button so the column hugs the
        // localized label in any language (en "Fix" ~64px, ru "Исправить" ~87px,
        // future locales whatever they need) — see the autosize effect above. This
        // `width` is only the pre-autosize fallback. Without it the grid's default
        // `text-overflow: ellipsis` would paint a stray "…" when a button overran a
        // too-narrow column; `actions-cell` (below) suppresses that ellipsis so
        // nothing flashes before autosize runs or if no button is rendered.
        width: 96,
        cellClassName: 'actions-cell',
        align: 'right',
        headerAlign: 'right',
        sortable: false,
        filterable: false,
        resizable: false,
        disableColumnMenu: true,
        renderCell: (p) => {
          if (!p.row.problematic) return null
          const { unassigned, lowPriorityNearDeadline } = p.row.problems
          // Native-blue primary action button (see PrimaryButton); the PROBLEMS ride
          // along as small icon pips sitting side by side on its TOP edge — red "no
          // assignee" and amber "near deadline", so a both-problems issue shows two
          // next to each other. Top placement keeps them from poking into the row
          // below (the earlier bottom-anchored badge overlapped the next row's pips).
          // The tooltip still spells out each problem.
          const deadlineReason = p.row.dueLabel ?? t('issue.lowPriorityDeadline')
          const reasons = [
            unassigned && t('issue.noAssignee'),
            lowPriorityNearDeadline && deadlineReason,
          ]
            .filter(Boolean)
            .join(' · ')
          return (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                px: 1.25,
              }}
            >
              <Tooltip title={t('issue.fixHint', { reasons })}>
                <Box sx={{ position: 'relative', display: 'inline-flex' }}>
                  {/* Pips anchored at the button's top-RIGHT corner, growing
                      leftward (row-reverse → the red "unassigned" pip sits in the
                      corner, amber to its left). `pointerEvents: none` so hover/click
                      still land on the button below them. */}
                  <Box
                    sx={{
                      position: 'absolute',
                      top: -7,
                      right: -6,
                      display: 'flex',
                      flexDirection: 'row-reverse',
                      gap: '3px',
                      pointerEvents: 'none',
                      zIndex: 1,
                    }}
                  >
                    {unassigned && (
                      <ProblemPip kind="error" icon={<ErrorOutlineIcon sx={{ fontSize: 11 }} />} />
                    )}
                    {lowPriorityNearDeadline && (
                      <ProblemPip kind="warning" icon={<WarningAmberIcon sx={{ fontSize: 11 }} />} />
                    )}
                  </Box>
                  <PrimaryButton size="small" onClick={() => onFix?.(p.row)}>
                    {t('issue.fix')}
                  </PrimaryButton>
                </Box>
              </Tooltip>
            </Box>
          )
        },
      },
    ],
    [t, onFix],
  )

  return (
    <Box sx={{ flex: 1, minHeight: 0 }}>
      <AppDataGrid<IssueRow>
        {...gridProps}
        rows={rows}
        columns={columns}
        loading={loading}
        // Unassigned (red) takes visual precedence over near-deadline (amber). A
        // subtle left accent bar marks the row instead of a full-row tint.
        getRowClassName={(params) =>
          params.row.problems.unassigned
            ? 'issue-row--unassigned'
            : params.row.problems.lowPriorityNearDeadline
              ? 'issue-row--deadline'
              : ''
        }
        sx={{
          '& .issue-row--unassigned': {
            boxShadow: (theme) => `inset 3px 0 0 ${theme.palette.error.main}`,
          },
          '& .issue-row--deadline': {
            boxShadow: (theme) => `inset 3px 0 0 ${theme.palette.warning.main}`,
          },
          // The actions cell holds a button + problem pips, never truncatable text —
          // drop the grid's default ellipsis (no stray "…") and let the pips paint
          // past the cell box (they sit above the button) instead of being clipped.
          '& .actions-cell': { overflow: 'visible', textOverflow: 'clip' },
        }}
      />
    </Box>
  )
}
