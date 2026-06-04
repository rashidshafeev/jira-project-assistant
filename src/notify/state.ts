import { storage } from '@forge/api'

/**
 * Notification STATE for the issue-health engines — Forge app storage
 * (`storage:app`), pure bookkeeping (no business logic), so an alert fires exactly
 * ONCE per problem acquisition and never nags:
 *  - `unassigned-since:{id}` — epoch ms the issue became unassigned (the grace
 *    clock; armed by the event handler, reconciled from `created` by the sweep).
 *  - `notified:{kind}:{id}`  — a flag that we already emailed for this problem, so
 *    the hourly sweep won't re-send.
 *
 * Keys are DELETED when the condition clears (re-arming exactly one future alert)
 * and when the issue is deleted. The single hourly sweep is the only writer of the
 * `notified:*` flags, so there's no concurrent-claim race — legacy `storage` (no
 * TTL / atomic ops) is sufficient. See docs/forge-gotchas.md.
 */
export type ProblemKind = 'unassigned' | 'deadline'

const sinceKey = (id: string) => `unassigned-since:${id}`
const notifiedKey = (kind: ProblemKind, id: string) => `notified:${kind}:${id}`

/** Epoch ms the issue became unassigned, or `null` if no anchor is stored. */
export async function getUnassignedSince(id: string): Promise<number | null> {
  const v = (await storage.get(sinceKey(id))) as { since: number } | undefined
  return v?.since ?? null
}

export async function setUnassignedSince(id: string, since: number): Promise<void> {
  await storage.set(sinceKey(id), { since })
}

export async function clearUnassignedSince(id: string): Promise<void> {
  await storage.delete(sinceKey(id))
}

export async function isNotified(id: string, kind: ProblemKind): Promise<boolean> {
  return (await storage.get(notifiedKey(kind, id))) != null
}

export async function markNotified(id: string, kind: ProblemKind): Promise<void> {
  await storage.set(notifiedKey(kind, id), { at: Date.now() })
}

export async function clearNotified(id: string, kind: ProblemKind): Promise<void> {
  await storage.delete(notifiedKey(kind, id))
}

/** Remove all notification state for an issue (on delete). */
export async function clearIssueState(id: string): Promise<void> {
  await Promise.all([
    clearUnassignedSince(id),
    clearNotified(id, 'unassigned'),
    clearNotified(id, 'deadline'),
  ])
}
