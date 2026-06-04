import Resolver from '@forge/resolver'
import { getAppConfig, setAppConfig, type AppConfig } from './config'
import { toApiErrorPayload, type ResolverResult } from './result'

/**
 * Resolver for the `jira:adminPage` module — and ONLY that module. This is the
 * admin gate (Forge apps can't call `/mypermissions`, so there's no runtime admin
 * check):
 *  - Jira renders the admin page solely inside admin settings, so only Jira admins
 *    can load the iframe that talks to this resolver; and
 *  - the bridge dispatches `invoke()` to the resolver of the CALLING module, so
 *    `setAppConfig` (defined here, not in `index.ts`) is unreachable from the
 *    non-admin global page / issue panel.
 * See docs/forge-gotchas.md ("Admin-only app-wide config WITHOUT /mypermissions").
 *
 * Mirrors `index.ts`'s thin envelope: validate payload, call the proxy, return a
 * typed result. No business logic — config is opaque persistence (`src/config.ts`).
 */
const resolver = new Resolver()

function define<T>(name: string, handler: (payload: unknown) => Promise<T>): void {
  resolver.define(name, async (req): Promise<ResolverResult<T>> => {
    try {
      return { ok: true, data: await handler((req as { payload: unknown }).payload) }
    } catch (e) {
      return { ok: false, error: toApiErrorPayload(e) }
    }
  })
}

define('getAppConfig', () => getAppConfig())

define('setAppConfig', (payload) => {
  const { config } = payload as { config: AppConfig }
  return setAppConfig(config)
})

export const handler = resolver.getDefinitions()
