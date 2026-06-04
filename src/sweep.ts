import { getAppConfig } from './config'
import { detectProblems, type ProblemInput } from './domain/problem'
import { fetchProjects, fetchProjectIssues, notifyIssue } from './notify/jira'
import { deadlineMessage, unassignedMessage } from './notify/messages'
import {
  clearNotified,
  clearUnassignedSince,
  getUnassignedSince,
  isNotified,
  markNotified,
  setUnassignedSince,
} from './notify/state'
import type { JiraIssue } from './types'

/**
 * The HOURLY issue-health sweep — handler behind the `issue-health-sweep`
 * `jira:scheduledTrigger` (see manifest.yml). It owns ALL the time math and ALL
 * the `/notify` sends; the event handler (`src/events.ts`) only maintains the
 * unassigned anchor. Because every alert flows through here, "event + sweep both
 * fire" can't double-notify. Runs `asApp` (no user). See docs/forge-gotchas.md
 * ("The design: two engines, one state store").
 *
 * For each issue it classifies with the SAME shared `detectProblems` rules the UI
 * uses (the single source of truth — no drift), then for each problem KIND:
 *  - fire once on acquisition (problem present AND no `notified` flag → email + set
 *    the flag);
 *  - clear the flag when the problem resolves, so a genuine re-acquisition later
 *    re-alerts exactly once.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000

function toProblemInput(issue: JiraIssue): ProblemInput {
  const f = issue.fields
  return {
    assignee: f.assignee,
    priority: f.priority?.name ?? null,
    dueDate: f.duedate ?? null,
  }
}

/** Epoch ms the issue was created — the fallback "unassigned since" anchor. */
function createdAt(issue: JiraIssue): number {
  const created = issue.fields.created
  const t = created ? new Date(created).getTime() : Number.NaN
  return Number.isNaN(t) ? Date.now() : t
}

/** Returns true if it sent an email. Edge-triggered via the `deadline` flag. */
async function handleDeadline(issue: JiraIssue, flagged: boolean, now: Date): Promise<boolean> {
  const id = issue.id
  if (!flagged) {
    if (await isNotified(id, 'deadline')) await clearNotified(id, 'deadline')
    return false
  }
  if (await isNotified(id, 'deadline')) return false
  const { subject, textBody } = deadlineMessage(issue, now)
  await notifyIssue(issue.key, subject, textBody)
  await markNotified(id, 'deadline')
  return true
}

/** Returns true if it sent an email. Uses the stored/created anchor for the clock. */
async function handleUnassigned(
  issue: JiraIssue,
  unassigned: boolean,
  graceDays: number,
  nowMs: number,
): Promise<boolean> {
  const id = issue.id
  if (!unassigned) {
    // Assigned now → disarm the clock and clear any pending flag (re-arm).
    await clearUnassignedSince(id)
    await clearNotified(id, 'unassigned')
    return false
  }
  let since = await getUnassignedSince(id)
  if (since === null) {
    // No anchor (issue predates install, or the event was missed) → created proxy.
    since = createdAt(issue)
    await setUnassignedSince(id, since)
  }
  const ageDays = (nowMs - since) / MS_PER_DAY
  if (ageDays < graceDays) return false
  if (await isNotified(id, 'unassigned')) return false
  const { subject, textBody } = unassignedMessage(issue, graceDays)
  await notifyIssue(issue.key, subject, textBody)
  await markNotified(id, 'unassigned')
  return true
}

async function run(): Promise<void> {
  const nowMs = Date.now()
  const now = new Date(nowMs)
  const config = await getAppConfig()

  let projects
  try {
    projects = await fetchProjects()
  } catch (e) {
    console.error('[sweep] failed to list projects:', e)
    return
  }

  let scanned = 0
  let sent = 0
  for (const project of projects) {
    let issues: JiraIssue[]
    try {
      issues = await fetchProjectIssues(project.key)
    } catch (e) {
      console.error(`[sweep] ${project.key}: failed to fetch issues:`, e)
      continue
    }
    for (const issue of issues) {
      scanned += 1
      const problems = detectProblems(toProblemInput(issue), now, config.deadlineWarningDays)
      try {
        if (await handleDeadline(issue, problems.lowPriorityNearDeadline, now)) sent += 1
      } catch (e) {
        console.error(`[sweep] ${issue.key}: deadline notify failed:`, e)
      }
      try {
        if (await handleUnassigned(issue, problems.unassigned, config.unassignedGraceDays, nowMs)) {
          sent += 1
        }
      } catch (e) {
        console.error(`[sweep] ${issue.key}: unassigned notify failed:`, e)
      }
    }
  }

  console.log(
    `[sweep] scanned ${scanned}, sent ${sent} alert(s) across ${projects.length} project(s)`,
  )
}

/** Forge invokes this hourly with `{ context }` (no user); we ignore the arg. */
export const handler = run
