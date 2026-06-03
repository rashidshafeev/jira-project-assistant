import { useTranslation } from 'react-i18next'
import { useTheme } from '@mui/material/styles'
import {
  DataGrid,
  type DataGridProps,
  type GridValidRowModel,
} from '@mui/x-data-grid'
import { enUS, ruRU } from '@mui/x-data-grid/locales'
import { ATLASSIAN_TOKENS } from '@/shared/config/atlassian-tokens'

/**
 * Shared DataGrid wrapper — the one place our tables (issues, team) get their
 * common behavior, so the widgets only declare columns + rows.
 *
 * - **Column resizing** is on by default in the Community grid (drag the header
 *   separators) — the reason we moved off hand-rolled MUI tables.
 * - **i18n:** the grid's own chrome (column menu, "no rows") is localized from the
 *   active i18n language via the bundled `@mui/x-data-grid/locales` packs, matching
 *   the rest of the UI. Jira *data* values stay untranslated, as everywhere else.
 * - **Two height modes, gated on `VITE_USE_MOCKS`:**
 *   - *Mock* (standalone page): no `autoHeight` — the grid takes its parent's height
 *     (the call site puts it in a `flex: 1; minHeight: 0` box that fills the 100vh
 *     shell) and row virtualization scrolls *inside* the grid.
 *   - *Forge* (auto-resizing iframe): `autoHeight` — the grid grows to its rows and
 *     the host Jira page scrolls. There is no stable viewport to fill in the iframe
 *     (it resizes to content), so a fixed/`100vh` height would misbehave.
 * - Footer hidden (continuous scroll, nothing to page through).
 * - **No horizontal scrollbar (both modes):** the Community grid otherwise reserves a
 *   few px for a vertical scrollbar even when none is shown, leaving a phantom h-scroll
 *   (and a stray separator mark at the right edge after the last column). With a `flex`
 *   summary column the real widths always sum to ≤ the available space, so pinning
 *   `overflowX: hidden` on the virtual scroller drops only that residual reservation
 *   (no real column content is clipped). Applied in Forge too, not just the mock.
 * - **Atlassian chrome:** native-feeling table — subtle sentence-case header, a
 *   single faint row divider (no vertical rules, no outer frame), soft row hover,
 *   no focus outline, column separators only on hover. Colors come from our real
 *   Atlassian tokens (`ATLASSIAN_TOKENS[mode]`), mode read from the MUI theme.
 * - **Loading:** shows the grid's skeleton overlay (Atlassian's load pattern) when
 *   the call site passes `loading`.
 *
 * Note: DataGrid styles via Emotion (like MUI), so it's covered by the existing
 * `unsafe-inline` CSP allowance in the Forge manifest — no extra setup.
 */
const LOCALE_TEXT = {
  en: enUS.components.MuiDataGrid.defaultProps.localeText,
  ru: ruRU.components.MuiDataGrid.defaultProps.localeText,
}

// See the height-modes note above: only the standalone mock fills a fixed-height
// shell; the Forge iframe auto-resizes, so there the grid grows (`autoHeight`).
const fillHeight = import.meta.env.VITE_USE_MOCKS === 'true'

export function AppDataGrid<R extends GridValidRowModel>({
  sx,
  slotProps,
  ...props
}: DataGridProps<R>) {
  const { i18n } = useTranslation()
  const { palette } = useTheme()
  const lang = i18n.language.startsWith('ru') ? 'ru' : 'en'
  const t = ATLASSIAN_TOKENS[palette.mode]

  // Atlassian-native table styling, keyed off our tokens (see header comment).
  const chromeSx = {
    border: 'none',
    // v7+ CSS var drives the per-row divider color in one place.
    '--DataGrid-rowBorderColor': t.border,
    '& .MuiDataGrid-columnHeaders': { borderBottom: `2px solid ${t.border}` },
    '& .MuiDataGrid-columnHeaderTitle': {
      fontSize: 12,
      fontWeight: 600,
      letterSpacing: 0,
      color: t.subtle,
    },
    '& .MuiDataGrid-cell': { borderColor: t.border },
    '& .MuiDataGrid-cell:focus, & .MuiDataGrid-cell:focus-within': { outline: 'none' },
    '& .MuiDataGrid-columnHeader:focus, & .MuiDataGrid-columnHeader:focus-within': {
      outline: 'none',
    },
    '& .MuiDataGrid-columnSeparator': {
      opacity: 0,
      color: t.border,
      transition: 'opacity 120ms ease',
    },
    '& .MuiDataGrid-columnHeader:hover .MuiDataGrid-columnSeparator': { opacity: 1 },
    '& .MuiDataGrid-row:hover': { backgroundColor: t.rowHover },
  }

  return (
    <DataGrid
      density="compact"
      disableRowSelectionOnClick
      hideFooter
      autoHeight={!fillHeight}
      localeText={LOCALE_TEXT[lang]}
      slotProps={{
        ...slotProps,
        // Skeleton is our standard load pattern; deep-merge so a caller passing
        // other slotProps (or its own loadingOverlay keys) can't silently drop it.
        loadingOverlay: {
          variant: 'skeleton',
          noRowsVariant: 'skeleton',
          ...slotProps?.loadingOverlay,
        },
      }}
      {...props}
      // Merged last so call sites can still add row-class accents etc. via their `sx`.
      sx={[
        chromeSx,
        // Drop the phantom horizontal scrollbar/edge mark in BOTH modes (safe: the
        // flex summary column keeps real widths ≤ the viewport — see header note).
        { '& .MuiDataGrid-virtualScroller': { overflowX: 'hidden' } },
        fillHeight ? { height: '100%' } : {},
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    />
  )
}
