import type { ApiErrorPayload, ErrorCode, ResolverResult } from '@result'

/**
 * Frontend-side error type. Constructed from the bridge's `ApiErrorPayload`, so
 * the UI (and TanStack Query) get a real `Error` with a typed `code` to branch
 * on — without ever touching Jira/HTTP specifics.
 */
export class ApiError extends Error {
  readonly code: ErrorCode

  constructor(payload: ApiErrorPayload) {
    super(payload.message)
    this.name = 'ApiError'
    this.code = payload.code
  }
}

/** Unwrap a resolver envelope: return data, or throw a typed `ApiError`. */
export function unwrap<T>(result: ResolverResult<T>): T {
  if (result.ok) return result.data
  throw new ApiError(result.error)
}

/** i18n key for an error code (`errors.<code>`); falls back to `errors.unknown`. */
export function errorMessageKey(error: unknown): string {
  const code: ErrorCode = error instanceof ApiError ? error.code : 'unknown'
  return `errors.${code}`
}

/**
 * Codes a retry can never fix: the request was well-formed and reached Jira, but
 * the answer is a settled "no" (auth/permission/shape/existence). Retrying just
 * burns the same call again. `rateLimited` and `unknown`/network are the opposite
 * — transient by nature — so they're *not* listed and stay retryable.
 */
const NON_RETRYABLE: ReadonlySet<ErrorCode> = new Set<ErrorCode>([
  'unauthorized',
  'forbidden',
  'validation',
  'notFound',
  'conflict',
])

/** Whether a failed request is worth retrying. Non-`ApiError` (network) → yes. */
export function isRetryable(error: unknown): boolean {
  if (error instanceof ApiError) return !NON_RETRYABLE.has(error.code)
  return true
}
