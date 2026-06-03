import { pending, type ByTarget } from '../../testing/shared/target'

export interface TeamData {
  /** A member shown on the Team tab. */
  teamMember: string
}

export const teamData: ByTarget<TeamData> = {
  mock: { teamMember: 'Anna Ivanova' },
  jira: pending<TeamData>('team: wire a seeded member name'),
}
