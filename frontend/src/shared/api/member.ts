import type { JiraUser } from '@types'

/** A project member (assignable user), as the UI consumes it. */
export interface Member {
  accountId: string
  displayName: string
  active: boolean
  avatarUrl?: string
}

export function mapUser(user: JiraUser): Member {
  const avatarUrl = user.avatarUrls?.['24x24']
  return {
    accountId: user.accountId,
    displayName: user.displayName,
    active: user.active,
    ...(avatarUrl ? { avatarUrl } : {}),
  }
}
