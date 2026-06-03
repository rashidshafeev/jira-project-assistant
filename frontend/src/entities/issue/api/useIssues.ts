import { useQuery } from '@tanstack/react-query'
import { api } from '@/shared/api'

/** Server state: issues for a project. Disabled until a project is selected. */
export function useIssues(projectKey: string | null) {
  return useQuery({
    queryKey: ['issues', projectKey],
    queryFn: () => api.getIssues(projectKey as string),
    enabled: projectKey !== null,
  })
}
