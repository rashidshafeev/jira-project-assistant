import { useQuery } from '@tanstack/react-query'
import { api } from '@/shared/api'

/** Server state: assignable members for a project. Disabled until one is chosen. */
export function useMembers(projectKey: string | null) {
  return useQuery({
    queryKey: ['members', projectKey],
    queryFn: () => api.getMembers(projectKey as string),
    enabled: projectKey !== null,
  })
}
