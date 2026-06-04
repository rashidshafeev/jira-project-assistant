import { dueInDays } from '../domain/problem'
import type { JiraIssue } from '../types'

/**
 * Email subject + body for each problem-acquisition alert. Acquisition framing
 * ("just entered", "for over N days") — the cadence is per-transition now, not a
 * weekly digest. Plain text (no ADF). Kept tiny and dependency-light.
 */
export interface NotificationMessage {
  subject: string
  textBody: string
}

/** A low-priority issue that just entered (or is past) its deadline window. */
export function deadlineMessage(issue: JiraIssue, now: Date): NotificationMessage {
  const days = dueInDays(issue.fields.duedate ?? null, now)
  const due =
    days === null
      ? 'approaching'
      : days > 0
        ? `due in ${days} day${days === 1 ? '' : 's'}`
        : days === 0
          ? 'due today'
          : `overdue by ${-days} day${-days === 1 ? '' : 's'}`
  return {
    subject: `[${issue.key}] Entered the deadline-risk window`,
    textBody: [
      `Project Assistant flagged ${issue.key} — "${issue.fields.summary}":`,
      '',
      `• Low priority and ${due}.`,
      '',
      'Raise its priority or push the due date if this is expected.',
    ].join('\n'),
  }
}

/** An issue that has been unassigned past the grace period. */
export function unassignedMessage(issue: JiraIssue, graceDays: number): NotificationMessage {
  const window = `${graceDays} day${graceDays === 1 ? '' : 's'}`
  return {
    subject: `[${issue.key}] Unassigned for over ${window}`,
    textBody: [
      `Project Assistant flagged ${issue.key} — "${issue.fields.summary}":`,
      '',
      `• No assignee for over ${window} — pick someone to own it.`,
    ].join('\n'),
  }
}
