import { useCallback, useEffect, useRef } from 'react'
import { useGridApiRef, type GridInitialState } from '@mui/x-data-grid'
import { useSaveTablePrefs, useTablePrefs } from '../api/useTablePrefs'

/**
 * Persist one DataGrid's user layout — sort model, filters, column widths and
 * visibility — to Forge app storage (per user) and restore it on load. Returns
 * `gridProps` to spread onto `<AppDataGrid>`.
 *
 * WHY restore-on-mount via `restoreState`, not the `initialState` prop:
 * `initialState` is only read at the grid's first mount, but the saved prefs
 * arrive asynchronously (a Query) — usually a tick after the grid is already up.
 * So we restore imperatively once both are ready, layering the saved state onto
 * the live grid with no remount/flash.
 *
 * WHY it can't re-save what it just restored: `restoreState` fires the same
 * model-change events a user edit would. The `restoredRef` is flipped *after*
 * the restore call, so those synchronous events run while the saver still bails
 * out — and the byte-equality guard in `scheduleSave` drops any that slip
 * through (and any genuine no-op edit), so a page load costs zero writes.
 */

/** Tables that persist their layout; the key namespaces this table's slice of
 *  the shared prefs blob. */
export type PersistedTableKey = 'issues' | 'team'

interface PersistedGridOptions {
  /**
   * Columns whose width is computed by *autosizing* to the rendered cell content
   * (via the returned `autosize()`), not chosen by the user. Their width is
   * deliberately **never persisted or restored**: the user can't set it, and
   * `autosizeColumns` emits the same `columnWidthChange` we save on — so without
   * this we'd write on every load and persist a width that then fights the next
   * autosize. Stripping these dimensions both ways makes autosize the sole
   * authority and keeps page loads write-free.
   */
  autosizeFields?: readonly string[]
}

/** Wait this long after the last change before writing — coalesces a column
 *  drag-resize or a burst of sort toggles into a single save. */
const SAVE_DEBOUNCE_MS = 600

/** A copy of `state` with the saved width of `fields` removed (see
 *  {@link PersistedGridOptions.autosizeFields}). Returns the input unchanged when
 *  there's nothing to strip, so the byte-equality save guard still short-circuits. */
function withoutDimensions(
  state: GridInitialState | undefined,
  fields: readonly string[],
): GridInitialState | undefined {
  if (!state?.columns?.dimensions || fields.length === 0) return state
  const dimensions = { ...state.columns.dimensions }
  let changed = false
  for (const field of fields) {
    if (field in dimensions) {
      delete dimensions[field]
      changed = true
    }
  }
  if (!changed) return state
  return { ...state, columns: { ...state.columns, dimensions } }
}

export function usePersistedGrid(
  tableKey: PersistedTableKey,
  options: PersistedGridOptions = {},
) {
  const apiRef = useGridApiRef()
  const { data: prefs, isPending } = useTablePrefs()
  const save = useSaveTablePrefs()
  const restoredRef = useRef(false)
  const autosizeFields = options.autosizeFields ?? EMPTY_FIELDS

  useEffect(() => {
    if (isPending || restoredRef.current || !apiRef.current) return
    const saved = withoutDimensions(prefs?.[tableKey] as GridInitialState | undefined, autosizeFields)
    if (saved) apiRef.current.restoreState(saved)
    restoredRef.current = true
  }, [isPending, prefs, tableKey, apiRef, autosizeFields])

  const scheduleSave = useDebouncedCallback(() => {
    if (!restoredRef.current || !apiRef.current) return
    const exported = withoutDimensions(apiRef.current.exportState(), autosizeFields)
    const stored = withoutDimensions(prefs?.[tableKey] as GridInitialState | undefined, autosizeFields)
    if (JSON.stringify(stored) === JSON.stringify(exported)) return
    save.mutate({ ...(prefs ?? {}), [tableKey]: exported })
  }, SAVE_DEBOUNCE_MS)

  /** Fit `autosizeFields` to their rendered content. `includeOutliers` is
   *  essential here: most action cells are empty (only problematic rows render a
   *  button), so the buttons would otherwise be discarded as outliers and the
   *  column sized to the empty cells. Call it once rows are present and again on
   *  locale change (the button label width is language-dependent). */
  const autosize = useCallback(() => {
    if (autosizeFields.length === 0) return
    apiRef.current?.autosizeColumns({
      columns: autosizeFields as string[],
      includeHeaders: true,
      includeOutliers: true,
    })
  }, [apiRef, autosizeFields])

  return {
    gridProps: {
      apiRef,
      onSortModelChange: scheduleSave,
      onFilterModelChange: scheduleSave,
      onColumnVisibilityModelChange: scheduleSave,
      onColumnWidthChange: scheduleSave,
    },
    autosize,
  }
}

/** Stable empty default so the `autosize`/effect deps don't change each render. */
const EMPTY_FIELDS: readonly string[] = []

/**
 * Trailing-edge debounce that always invokes the freshest closure (so `mutate`
 * sees the latest `prefs`) while keeping a stable identity, and clears its timer
 * on unmount.
 */
function useDebouncedCallback(fn: () => void, delay: number) {
  const fnRef = useRef(fn)
  // Track the latest closure in an effect (not during render — a render may be
  // discarded), so the deferred timer below always calls the freshest `fn`.
  useEffect(() => {
    fnRef.current = fn
  })
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    [],
  )

  return useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => fnRef.current(), delay)
  }, [delay])
}
