import { useQuery } from '@tanstack/react-query'
import { api } from '@/shared/api'

/** Server state: all projects the user can see. */
export function useProjects() {
  return useQuery({
    queryKey: ['projects'],
    queryFn: () => api.getProjects(),
  })
}
