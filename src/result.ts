/**
 * The bridge result protocol — the success-or-error envelope every resolver
 * returns, the normalized error taxonomy it carries, and the backend logic that
 * turns a raw Jira/HTTP failure into that taxonomy.
 *
 * Two halves with different audiences (kept honest by `import type`):
 *  - **Wire types** (`ErrorCode`, `ApiErrorPayload`, `ResolverResult`) are the
 *    shared vocabulary that crosses the bridge. The backend produces them; the
 *    frontend (via the `@result` alias, `import type`) and the mock consume them.
 *    Zero dependencies, runtime-erased.
 *  - **Backend translation** (`JiraHttpError`, `errorCodeFromStatus`,
 *    `toApiErrorPayload`) is the ONE place Jira/HTTP specifics become an
 *    `ErrorCode`. Server-only — the frontend imports only the types above (it has
 *    its own `ApiError` in `shared/api/errors.ts`), so this code never bundles
 *    into the UI.
 */

// ── Wire types (shared across the bridge) ──────────────────────────────────

/**
 * Normalized error taxonomy. The frontend branches on these codes for UX without
 * knowing Jira/HTTP; the backend translates Jira status → code (below); the mock
 * throws the same codes. The frontend maps code → i18n message + behavior.
 */
export type ErrorCode =
  | 'forbidden'
  | 'notFound'
  | 'conflict'
  | 'rateLimited'
  | 'validation'
  | 'unauthorized'
  | 'unknown'

/** The wire shape of an error carried across the bridge (plain JSON). */
export interface ApiErrorPayload {
  code: ErrorCode
  /** Fallback/diagnostic string; the UI prefers an i18n message keyed by `code`. */
  message: string
}

/**
 * Resolver return envelope. Thrown errors don't reliably carry structured data
 * across the Forge bridge, so resolvers return a discriminated result instead;
 * `bridge-client` unwraps it into a thrown `ApiError`. See `docs/extending.md`.
 */
export type ResolverResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: ApiErrorPayload }

// ── Backend translation (server-only — never reaches the frontend bundle) ───

/**
 * Raised by the Jira adapter on a non-2xx response; carries the status.
 *
 * Written with explicit fields (not constructor parameter properties) because
 * this module is on the frontend's type-check path via `@result`, and the
 * frontend enforces `erasableSyntaxOnly` — parameter properties emit runtime
 * code and aren't allowed there. The instance never reaches the UI bundle, but
 * the syntax still has to satisfy the stricter side.
 */
export class JiraHttpError extends Error {
  readonly status: number
  readonly statusText: string
  readonly body: string

  constructor(status: number, statusText: string, body: string) {
    super(`Jira API ${status} ${statusText}: ${body}`)
    this.name = 'JiraHttpError'
    this.status = status
    this.statusText = statusText
    this.body = body
  }
}

/** Map a Jira HTTP status to our taxonomy. Documented per-endpoint in the spec. */
export function errorCodeFromStatus(status: number): ErrorCode {
  switch (status) {
    case 400:
    case 422:
      return 'validation'
    case 401:
      return 'unauthorized'
    case 403:
      return 'forbidden'
    case 404:
      return 'notFound'
    // Reserved/forward-looking: no current write provokes a 409 (assign/setPriority
    // are last-writer-wins), but the code + its localized "someone else changed
    // this — refresh" message are wired end-to-end so an optimistic-concurrency
    // write (If-Match/version) can adopt it without touching the UI.
    case 409:
      return 'conflict'
    case 429:
      return 'rateLimited'
    default:
      return 'unknown'
  }
}

/** Normalize any thrown value into the wire error payload. */
export function toApiErrorPayload(e: unknown): ApiErrorPayload {
  if (e instanceof JiraHttpError) {
    return { code: errorCodeFromStatus(e.status), message: e.message }
  }
  return { code: 'unknown', message: e instanceof Error ? e.message : String(e) }
}
