import type { JiraIssue, JiraPriority, JiraStatus } from '@types'
import { mapUser, type Member } from './member'

/**
 * The Issue DTO and its mapper. This is the boundary where real Jira messiness
 * is normalized (the OpenAPI spec can't type issue `fields`):
 *  - priority may be absent → `null`
 *  - status names are localized → branch on the stable `statusCategory.key`
 *  - custom/non-standard priorities → `null` rather than a wrong label
 */

export type IssuePriority = 'Highest' | 'High' | 'Medium' | 'Low' | 'Lowest'

/**
 * An issue's priority, or `null`. Real Jira issues can have **no** priority
 * (team-managed projects often omit the field). A null priority is simply "not
 * low", so it never trips the near-deadline rule.
 */
export type IssuePriorityOrNone = IssuePriority | null

/** Language-stable status category (mapped from Jira's `statusCategory.key`). */
export type StatusCategory = 'new' | 'indeterminate' | 'done'

export interface IssueStatus {
  name: string
  category: StatusCategory
}

export interface Issue {
  id: string
  key: string
  summary: string
  status: IssueStatus
  assignee: Member | null
  priority: IssuePriorityOrNone
  /** ISO date `yyyy-mm-dd`, or null when no due date is set. */
  dueDate: string | null
}

/** Standard Jira priority ids. Mapping by id avoids breaking on localized names. */
const PRIORITY_NAME_BY_ID: Record<string, IssuePriority> = {
  '1': 'Highest',
  '2': 'High',
  '3': 'Medium',
  '4': 'Low',
  '5': 'Lowest',
}

const PRIORITY_NAMES: ReadonlySet<string> = new Set<IssuePriority>([
  'Highest',
  'High',
  'Medium',
  'Low',
  'Lowest',
])

/** DTO priority name → Jira id, for the write path (`setPriority` in bridge-client). */
export const PRIORITY_ID_BY_NAME: Record<IssuePriority, string> = {
  Highest: '1',
  High: '2',
  Medium: '3',
  Low: '4',
  Lowest: '5',
}

export function mapPriority(
  priority: JiraPriority | null | undefined,
): IssuePriorityOrNone {
  if (!priority) return null
  // Prefer the stable id; fall back to a name that matches our union; else null.
  const byId = PRIORITY_NAME_BY_ID[priority.id]
  if (byId) return byId
  if (PRIORITY_NAMES.has(priority.name)) return priority.name as IssuePriority
  return null
}

export function mapStatus(status: JiraStatus): IssueStatus {
  return {
    name: status.name,
    category: mapStatusCategory(status.statusCategory.key),
  }
}

function mapStatusCategory(key: string): StatusCategory {
  if (key === 'done' || key === 'indeterminate') return key
  return 'new'
}

export function mapIssue(issue: JiraIssue): Issue {
  const f = issue.fields
  return {
    id: issue.id,
    key: issue.key,
    summary: f.summary,
    status: mapStatus(f.status),
    assignee: f.assignee ? mapUser(f.assignee) : null,
    priority: mapPriority(f.priority),
    dueDate: f.duedate ?? null,
  }
}
