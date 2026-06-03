import type { JiraProject } from '@types'

/** A project, as the UI consumes it (for the picker). */
export interface ProjectSummary {
  id: string
  key: string
  name: string
  avatarUrl?: string
}

export function mapProject(project: JiraProject): ProjectSummary {
  const avatarUrl = project.avatarUrls?.['24x24']
  return {
    id: project.id,
    key: project.key,
    name: project.name,
    ...(avatarUrl ? { avatarUrl } : {}),
  }
}
