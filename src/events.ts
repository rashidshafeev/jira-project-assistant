import { fetchIssue } from './notify/jira'
import {
  clearIssueState,
  clearNotified,
  clearUnassignedSince,
  getUnassignedSince,
  setUnassignedSince,
} from './notify/state'

/**
 * Real-time anchor maintenance for the unassigned-grace clock — handler behind the
 * `assignee-watch` `trigger` module (events: assigned / created / deleted issue).
 * It NEVER sends a notification; it only ARMS or CLEARS the clock. All emails go
 * through the hourly sweep (`src/sweep.ts`), so there's no double-notify. Runs
 * `asApp` (no user). See docs/forge-gotchas.md ("two engines, one state store").
 *
 * `avi:jira:assigned:issue` fires on assign AND unassign; the created event covers
 * issues born unassigned; delete wipes state. Event payload shapes vary across
 * instances and delivery isn't guaranteed, so for assign/create we RE-FETCH the
 * issue to read the authoritative assignee instead of trusting the body — the
 * hourly sweep is the safety net (created-date fallback) for anything missed.
 */
interface IssueEvent {
  eventType?: string
  issue?: { id?: string; key?: string }
}

async function run(event: IssueEvent): Promise<void> {
  const id = event.issue?.id
  if (!id) return

  if (event.eventType === 'avi:jira:deleted:issue') {
    await clearIssueState(id)
    return
  }

  const key = event.issue?.key
  if (!key) return

  let assignee: unknown
  try {
    assignee = (await fetchIssue(key)).fields.assignee
  } catch (e) {
    console.error(`[events] ${key}: re-fetch failed (sweep will reconcile):`, e)
    return
  }

  if (assignee == null) {
    // Became (or born) unassigned → arm the clock once (don't reset an existing one).
    if ((await getUnassignedSince(id)) === null) {
      await setUnassignedSince(id, Date.now())
    }
  } else {
    // (Re)assigned → disarm the clock and clear any pending flag.
    await clearUnassignedSince(id)
    await clearNotified(id, 'unassigned')
  }
}

/** Forge invokes this with `(event, context)`; we read only the event. */
export const handler = run
