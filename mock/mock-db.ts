import type {
  Issue,
  IssuePriority,
  Member,
  ProjectSummary,
} from '@/shared/api/contract'
import type { ErrorCode } from '@result'
import { ApiError } from '@/shared/api/errors'
import { ISSUES_BY_PROJECT, MEMBERS, PROJECTS } from './fixtures'

/**
 * In-memory mock backend. Holds mutable state seeded from the fixtures and
 * implements the same operations as the resolvers. Two deliberate features make
 * loading / error paths demoable rather than theoretical:
 *  - `LATENCY_MS` simulates network delay (tunable via `VITE_MOCK_LATENCY_MS`),
 *  - the **fault map** injects a *deterministic* error code per action — the seam
 *    E2E tests and manual demos drive to hit a specific taxonomy branch on cue
 *    (armed via the `?fault=…` URL param or the `window.__mock` handle).
 */

const LATENCY_MS = Number(import.meta.env.VITE_MOCK_LATENCY_MS ?? 400)

// Deep-clone the seed so mutations don't mutate the fixture module.
const projects: ProjectSummary[] = structuredClone(PROJECTS)
const members: Member[] = structuredClone(MEMBERS)
const issuesByProject: Record<string, Issue[]> = structuredClone(ISSUES_BY_PROJECT)

/**
 * Deterministic fault injection. Maps an action name (`getIssues`, `assignIssue`,
 * …) to the `ErrorCode` the mock should throw for it, so a test or demo can drive
 * a *specific* taxonomy branch on cue. Seeded from a
 * `?fault=action:code,action:code` URL param and adjustable at runtime via
 * `window.__mock`. Mock-only — this module is dynamic-imported behind
 * `VITE_USE_MOCKS`, so none of it reaches the prod bundle.
 */
const faults = new Map<string, ErrorCode>()

function parseFaultsFromUrl(): void {
  if (typeof window === 'undefined') return
  const raw = new URLSearchParams(window.location.search).get('fault')
  if (!raw) return
  for (const entry of raw.split(',')) {
    const [action, code] = entry.split(':')
    if (action && code) faults.set(action.trim(), code.trim() as ErrorCode)
  }
}
parseFaultsFromUrl()

// Runtime handle for E2E / manual demos:
//   window.__mock.fail('getIssues', 'rateLimited')  // arm a fault
//   window.__mock.pass('getIssues')                 // disarm one (e.g. before a Retry)
//   window.__mock.clear()                            // disarm all
if (typeof window !== 'undefined') {
  ;(window as unknown as { __mock: unknown }).__mock = {
    fail: (action: string, code: ErrorCode = 'unknown') => faults.set(action, code),
    pass: (action: string) => faults.delete(action),
    clear: () => faults.clear(),
    faults: () => Object.fromEntries(faults),
  }
}

/**
 * Throw in the normalized taxonomy (NOT raw Jira) — the mock never needs Jira
 * knowledge; it just produces the same `ApiError` codes the UI handles. Fires
 * only when a deterministic fault is armed for this action.
 */
function maybeFail(action: string): void {
  const fault = faults.get(action)
  if (fault) {
    throw new ApiError({ code: fault, message: `[mock] injected ${fault} on "${action}"` })
  }
}

async function delay(action: string): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, LATENCY_MS))
  maybeFail(action)
}

// Match on id OR key — writes (assign/setPriority) pass the numeric id, while the
// issue-panel view loads by the human key (DEMO-2). The two namespaces are disjoint
// in the fixtures, so one lookup serves both.
function findIssue(issueIdOrKey: string): Issue {
  for (const list of Object.values(issuesByProject)) {
    const found = list.find((i) => i.id === issueIdOrKey || i.key === issueIdOrKey)
    if (found) return found
  }
  throw new ApiError({ code: 'notFound', message: `[mock] issue ${issueIdOrKey} not found` })
}

export const mockDb = {
  async getProjects(): Promise<ProjectSummary[]> {
    await delay('getProjects')
    return structuredClone(projects)
  },

  async getMembers(_projectKey: string): Promise<Member[]> {
    await delay('getMembers')
    return structuredClone(members)
  },

  async getIssues(projectKey: string): Promise<Issue[]> {
    await delay('getIssues')
    return structuredClone(issuesByProject[projectKey] ?? [])
  },

  async getIssue(issueIdOrKey: string): Promise<Issue> {
    await delay('getIssue')
    return structuredClone(findIssue(issueIdOrKey))
  },

  async assignIssue(issueId: string, accountId: string): Promise<Issue> {
    await delay('assignIssue')
    const issue = findIssue(issueId)
    const member = members.find((m) => m.accountId === accountId)
    if (!member)
      throw new ApiError({ code: 'notFound', message: `[mock] member ${accountId} not found` })
    issue.assignee = { ...member }
    return structuredClone(issue)
  },

  async setPriority(issueId: string, priority: IssuePriority): Promise<Issue> {
    await delay('setPriority')
    const issue = findIssue(issueId)
    issue.priority = priority
    return structuredClone(issue)
  },
}
