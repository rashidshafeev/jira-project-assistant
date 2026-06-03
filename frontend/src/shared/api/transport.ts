import type { JiraApi } from './contract'

/**
 * Transport switch — picks the live `JiraApi` implementation, once, at load.
 *
 * Both transports are loaded via dynamic import on purpose:
 *  - the mock (`@mock/mock-client`) is dead-code-eliminated from the shipped
 *    bundle, and
 *  - `@forge/bridge` throws on import outside a Forge host, so `bridge-client`
 *    must NOT load in mock mode — the conditional import keeps it out entirely.
 *
 * `VITE_USE_MOCKS` is a build-time constant, so the bundler constant-folds this
 * ternary and prunes the branch it doesn't take.
 *
 * This is why the switch can't merge with the other two api files: `bridge-client`
 * must stay a SEPARATE module so its `@forge/bridge` import only loads in the
 * non-mock branch (merging it here would make `@forge/bridge` a static top-level
 * import → it loads unconditionally → throws in the mock preview, and the bridge
 * code ships in every bundle). And the `JiraApi` type stays in dependency-free
 * `contract.ts` to keep this top-level-`await` module out of an import cycle.
 */
const useMocks = import.meta.env.VITE_USE_MOCKS === 'true'

/** The API the whole frontend talks to. */
export const api: JiraApi = useMocks
  ? (await import('@mock/mock-client')).mockClient
  : (await import('./bridge-client')).bridgeClient
