import { useQuery } from '@tanstack/react-query'
import { api } from '@/shared/api'

/**
 * Server state: a single issue by id or key. Backs the issue-panel view, which
 * loads one issue from the Forge context. Disabled until a key is known. Kept on
 * its own cache key (`['issue', key]`) — separate from the project issue list —
 * so the panel can be invalidated independently after a fix.
 */
export function useIssue(issueIdOrKey: string | null) {
  return useQuery({
    queryKey: ['issue', issueIdOrKey],
    queryFn: () => api.getIssue(issueIdOrKey as string),
    enabled: issueIdOrKey !== null,
  })
}
