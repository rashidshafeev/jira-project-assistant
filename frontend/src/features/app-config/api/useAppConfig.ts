import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, type AppConfig } from '@/shared/api'
import { DEFAULT_APP_CONFIG } from '@/shared/config/app-config'

/**
 * Server state for the app-wide config (Forge app storage, via the `getAppConfig`/
 * `setAppConfig` resolvers). Replaces the old per-user settings: the window is now
 * one installation-wide value, READ by every view to drive the at-risk highlight
 * and WRITTEN only from the admin page (`setAppConfig` lives on the admin resolver,
 * so a write from any other surface simply has nowhere to land). Mirrors the
 * table-prefs hook: a read query + an optimistic write mutation.
 */

/** Presets offered for the at-risk window (days). The default (7) sits in the middle. */
export const DEADLINE_WINDOW_OPTIONS = [3, 7, 14, 30] as const

const APP_CONFIG_KEY = ['appConfig'] as const

/** The full app-wide config query. One entry shared by every reader (TanStack
 *  dedupes by key), so the window stays consistent across views. */
export function useAppConfig() {
  return useQuery({
    queryKey: APP_CONFIG_KEY,
    queryFn: () => api.getAppConfig(),
    // Only the admin write below mutates it, and that updates the cache directly —
    // so it never needs to refetch.
    staleTime: Infinity,
    gcTime: Infinity,
  })
}

/**
 * The effective at-risk window in days. Falls back to the app default until the
 * stored config loads, so the first render already uses a sensible threshold and
 * then re-renders with the persisted value when the query resolves.
 */
export function useDeadlineWindow(): number {
  const { data } = useAppConfig()
  return data?.deadlineWarningDays ?? DEFAULT_APP_CONFIG.deadlineWarningDays
}

/**
 * Persist a new config (admin page only). Optimistically writes it into the cache
 * on `onMutate` so every reader re-renders against the new window immediately; on
 * error it rolls back to the snapshot (nothing else would correct a `staleTime:
 * Infinity` query). `onSuccess` adopts the backend's echoed value, which is clamped
 * to the valid range — so an out-of-range entry self-corrects in the UI.
 */
export function useSetAppConfig() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (config: AppConfig) => api.setAppConfig(config),
    onMutate: (config) => {
      const previous = qc.getQueryData<AppConfig>(APP_CONFIG_KEY)
      qc.setQueryData<AppConfig>(APP_CONFIG_KEY, config)
      return { previous }
    },
    onError: (_err, _config, context) => {
      qc.setQueryData<AppConfig>(APP_CONFIG_KEY, context?.previous)
    },
    onSuccess: (saved) => {
      qc.setQueryData<AppConfig>(APP_CONFIG_KEY, saved)
    },
  })
}
