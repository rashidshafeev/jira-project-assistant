import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, type UserSettings } from '@/shared/api'
import { DEADLINE_WARNING_DAYS } from '@/entities/issue'

/**
 * Server state for the per-user "approaching deadline" window (Forge app storage,
 * via the `getSettings`/`setSettings` resolvers). Mirrors the table-prefs hook: a
 * read query + an optimistic write mutation. The window drives what the table
 * flags, the at-risk stat, and the Fix dialog — so persisting it per user lets
 * each person tune how far ahead they want to be warned.
 */

/** Presets offered in the dropdown (days). The app default (7) sits in the middle. */
export const DEADLINE_WINDOW_OPTIONS = [3, 7, 14, 30] as const

const SETTINGS_KEY = ['userSettings'] as const

function useUserSettings() {
  return useQuery({
    queryKey: SETTINGS_KEY,
    queryFn: () => api.getSettings(),
    // Only this app mutates the blob, and the write below updates the cache
    // directly — so it never needs to refetch.
    staleTime: Infinity,
    gcTime: Infinity,
  })
}

/**
 * The effective at-risk window in days. Falls back to the app default until the
 * user's saved value loads, so the first render already uses a sensible threshold
 * and then re-renders with the persisted value when the query resolves.
 */
export function useDeadlineWindow(): number {
  const { data } = useUserSettings()
  return data?.deadlineWarningDays ?? DEADLINE_WARNING_DAYS
}

/**
 * Persist a new window. Optimistically writes it into the settings cache on
 * `onMutate`, so every reader (table, stats, dialog) re-renders against the new
 * threshold immediately — no wait for the round-trip. If the save fails, `onError`
 * rolls the cache back to the snapshot so the UI can't get stuck showing a window
 * that was never persisted (the query is `staleTime: Infinity`, so nothing else
 * would correct it).
 */
export function useSetDeadlineWindow() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (days: number) => {
      const next: UserSettings = {
        ...(qc.getQueryData<UserSettings>(SETTINGS_KEY) ?? {}),
        deadlineWarningDays: days,
      }
      await api.setSettings(next)
    },
    onMutate: (days) => {
      const previous = qc.getQueryData<UserSettings>(SETTINGS_KEY)
      qc.setQueryData<UserSettings>(SETTINGS_KEY, (prev) => ({
        ...(prev ?? {}),
        deadlineWarningDays: days,
      }))
      return { previous }
    },
    onError: (_err, _days, context) => {
      qc.setQueryData<UserSettings>(SETTINGS_KEY, context?.previous)
    },
  })
}
