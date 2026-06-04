import type { AppConfig } from '@/shared/api/contract'

/**
 * Frontend mirror of the backend default (`src/config.ts`'s `DEFAULT_APP_CONFIG`).
 * Used as the optimistic fallback before the stored config loads (so the first
 * render already highlights with a sensible window) and as the mock transport's
 * seed. Kept in `shared/config` — not in the types-only `contract.ts` — so the
 * contract stays a pure type module.
 */
export const DEFAULT_APP_CONFIG: AppConfig = {
  deadlineWarningDays: 7,
}
