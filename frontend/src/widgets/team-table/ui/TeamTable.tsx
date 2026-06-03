import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { GridColDef } from '@mui/x-data-grid'
import Avatar from '@mui/material/Avatar'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Typography from '@mui/material/Typography'
import { AppDataGrid } from '@/shared/ui'
import type { MemberStats } from '@/entities/member'
import { usePersistedGrid } from '@/features/table-prefs'

interface TeamTableProps {
  stats: MemberStats[]
  loading?: boolean
}

/** Members with their assigned-issue count and activity (in-progress) metric. */
export function TeamTable({ stats, loading = false }: TeamTableProps) {
  const { t } = useTranslation()
  // Persist this table's sort/filter/column layout per user (Forge storage).
  const { gridProps } = usePersistedGrid('team')

  const columns = useMemo<GridColDef<MemberStats>[]>(
    () => [
      {
        field: 'member',
        headerName: t('team.member'),
        flex: 1,
        minWidth: 200,
        valueGetter: (_v, row) => row.member.displayName,
        renderCell: (p) => (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, height: '100%', minWidth: 0 }}>
            <Avatar src={p.row.member.avatarUrl} sx={{ width: 28, height: 28, flexShrink: 0 }}>
              {p.row.member.displayName.charAt(0)}
            </Avatar>
            <Typography variant="body2" noWrap>
              {p.row.member.displayName}
            </Typography>
            {!p.row.member.active && (
              <Chip
                label={t('team.inactive')}
                size="small"
                variant="outlined"
                sx={{ flexShrink: 0 }}
              />
            )}
          </Box>
        ),
      },
      {
        field: 'assigned',
        headerName: t('team.assigned'),
        type: 'number',
        width: 120,
      },
      {
        field: 'inProgress',
        headerName: t('team.activity'),
        type: 'number',
        width: 120,
        renderCell: (p) =>
          p.row.inProgress > 0 ? (
            <Chip label={p.row.inProgress} size="small" color="info" />
          ) : (
            <Typography variant="body2" color="text.secondary">
              —
            </Typography>
          ),
      },
      {
        field: 'done',
        headerName: t('team.done'),
        type: 'number',
        width: 100,
      },
    ],
    [t],
  )

  return (
    <Box sx={{ flex: 1, minHeight: 0 }}>
      <AppDataGrid<MemberStats>
        {...gridProps}
        rows={stats}
        columns={columns}
        loading={loading}
        getRowId={(row) => row.member.accountId}
        getRowClassName={(params) => (params.row.member.active ? '' : 'member-row--inactive')}
        sx={{ '& .member-row--inactive': { opacity: 0.6 } }}
      />
    </Box>
  )
}
