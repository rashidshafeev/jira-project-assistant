import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, type TablePrefs } from '@/shared/api'

/**
 * Server state for the per-user table-prefs blob (sort/filter/column layout for
 * all tables, one record). Split into a read query + a write mutation, mirroring
 * the rest of the API layer (`entities/*`, `fix-issue`).
 */

const PREFS_KEY = ['tablePrefs'] as const

/**
 * Load this user's saved prefs. Nothing else mutates the blob, so it never goes
 * stale — `staleTime: Infinity` keeps it from refetching after the save below
 * updates the cache directly.
 */
export function useTablePrefs() {
  return useQuery({
    queryKey: PREFS_KEY,
    queryFn: () => api.getTablePrefs(),
    staleTime: Infinity,
    gcTime: Infinity,
  })
}

/**
 * Persist the full prefs blob. Writes the new blob into the cache on `onMutate`
 * so the in-memory copy the grids read is the single source of truth — successive
 * saves (e.g. from different tables) merge against the latest, not a stale, blob.
 */
export function useSaveTablePrefs() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (prefs: TablePrefs) => api.setTablePrefs(prefs),
    onMutate: (prefs) => {
      qc.setQueryData<TablePrefs>(PREFS_KEY, prefs)
    },
  })
}
