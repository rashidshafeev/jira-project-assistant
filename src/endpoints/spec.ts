import type { ErrorCode } from '../result'

/**
 * One failure mode of a Jira endpoint, as WE account for it. The point of the
 * catalog is to write down "what can really go wrong" per endpoint and what we
 * do about it — knowledge that varies per endpoint and isn't expressible in the
 * types. Error *handling* stays centralized (`result.ts` maps status → code for
 * everyone); this is the per-endpoint *knowledge* layer on top.
 *
 * Two grades of truth (see docs/api/endpoints.md → "How accurate is this"):
 *  - `status`/`code`/`when` are BEST-EFFORT — from the documented spec + our
 *    usage, accurate-leaning but not all reproduced live.
 *  - `observed` is GROUND-TRUTH — a real captured envelope. Promote best-effort
 *    rows to `observed` as we trip them against live Jira (the "error ratchet").
 */
export interface EndpointError {
  /** HTTP status Jira returns. */
  status: number
  /** Our normalized taxonomy code (must agree with `errorCodeFromStatus`). */
  code: ErrorCode
  /** Why Jira returns it (the spec's reason, in our words). */
  when: string
  /** What our code does / should do about it. */
  watch?: string
  /**
   * A real message we've actually seen on this status — an EXAMPLE only. Jira's
   * `errorMessages` are localized + dynamic (the spec never lists the strings),
   * so this is for our reference/diagnostics, never shown to the user verbatim.
   */
  observed?: string
}

export interface EndpointSpec {
  /** Matches the proxy function in the same file (e.g. `getProjects`). */
  name: string
  method: 'GET' | 'PUT'
  /** Route template, `{braces}` for interpolation — mirrors the proxy's `route`. */
  path: string
  /** One-line purpose. */
  summary: string
  errors: EndpointError[]
  notes?: string
}

/**
 * Failures that apply to EVERY endpoint, so they're declared once and spread in.
 * 401 (auth) and 429 (cost-based rate limit) are not per-endpoint concerns.
 */
export const COMMON_ERRORS: EndpointError[] = [
  {
    status: 401,
    code: 'unauthorized',
    when: 'The Forge app session / OAuth token is missing or expired.',
    watch: 'Maps to errors.unauthorized — prompt the user to reload the Jira page.',
  },
  {
    status: 429,
    code: 'rateLimited',
    when: 'Jira cost-based rate limit exceeded (applies to every endpoint).',
    watch: 'Maps to errors.rateLimited — back off and retry; do not hammer.',
  },
]
