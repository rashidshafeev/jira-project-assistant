import type { ReactNode } from 'react'
import {
  MutationCache,
  QueryCache,
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query'
import { ApiError, isRetryable } from '@/shared/api'

/**
 * Log the underlying cause of every failed query/mutation. The UI only ever
 * shows an i18n message keyed by `error.code` (localized to the UI locale), so
 * `error.message` — which carries the raw backend/Jira detail (status + body) —
 * is otherwise unused. This console line is the one place that detail surfaces,
 * for debugging. Covers both transports: bridge errors (via `unwrap`) and the
 * mock's injected failures both throw `ApiError`.
 */
function logApiError(scope: string, error: unknown): void {
  if (error instanceof ApiError) {
    console.error(`[api:${scope}] ${error.code}:`, error.message)
  } else {
    console.error(`[api:${scope}]`, error)
  }
}

const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError: (error) => logApiError('query', error) }),
  mutationCache: new MutationCache({
    onError: (error) => logApiError('mutation', error),
  }),
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      // Code-aware retry: don't waste attempts on settled "no"s
      // (auth/permission/shape/existence) — only retry the transient codes
      // (`rateLimited`, network/`unknown`). See `isRetryable`. Cap at 2 tries,
      // with exponential backoff so a rate-limit gets a beat to clear.
      retry: (failureCount, error) => failureCount < 2 && isRetryable(error),
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 15_000),
      staleTime: 30_000,
    },
  },
})

/** App-wide TanStack Query client (server-state cache). */
export function AppQueryProvider({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}
