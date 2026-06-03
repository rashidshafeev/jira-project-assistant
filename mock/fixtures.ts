import type { Issue, Member, ProjectSummary } from '@/shared/api/contract'

/**
 * Seed data for the dev mock. Crafted to exercise the UI's problem highlighting:
 * some issues are unassigned (🔴), some are low-priority with a near/overdue due
 * date (🟡), the rest are "healthy". Due dates are relative to mid-2026 so the
 * near-deadline cases trigger against a current date around then.
 */

export const MEMBERS: Member[] = [
  { accountId: 'u-anna', displayName: 'Anna Ivanova', active: true },
  { accountId: 'u-boris', displayName: 'Boris Petrov', active: true },
  { accountId: 'u-clara', displayName: 'Clara Nguyen', active: true },
  { accountId: 'u-dmitri', displayName: 'Dmitri Volkov', active: true },
  { accountId: 'u-fatima', displayName: 'Fatima Al-Sayed', active: true },
  { accountId: 'u-grigor', displayName: 'Grigor Petrosyan', active: true },
  { accountId: 'u-hana', displayName: 'Hana Kim', active: true },
  { accountId: 'u-igor', displayName: 'Igor Sokolov', active: true },
  { accountId: 'u-julia', displayName: 'Julia Santos', active: true },
  { accountId: 'u-erin', displayName: 'Erin OConnor (inactive)', active: false },
]

export const PROJECTS: ProjectSummary[] = [
  { id: '10001', key: 'DEMO', name: 'Demo Product' },
  { id: '10002', key: 'OPS', name: 'Operations' },
]

const byId = (accountId: string): Member =>
  MEMBERS.find((m) => m.accountId === accountId) ?? MEMBERS[0]!

export const ISSUES_BY_PROJECT: Record<string, Issue[]> = {
  DEMO: [
    {
      id: '1001',
      key: 'DEMO-1',
      summary: 'Set up CI pipeline',
      status: { name: 'In Progress', category: 'indeterminate' },
      assignee: byId('u-anna'),
      priority: 'High',
      dueDate: '2026-07-15',
    },
    {
      id: '1002',
      key: 'DEMO-2',
      summary: 'Design onboarding flow',
      status: { name: 'To Do', category: 'new' },
      assignee: null, // 🔴 unassigned
      priority: 'Medium',
      dueDate: null,
    },
    {
      id: '1003',
      key: 'DEMO-3',
      summary: 'Fix flaky checkout test',
      status: { name: 'To Do', category: 'new' },
      assignee: byId('u-boris'),
      priority: 'Low', // 🟡 low priority + near deadline
      dueDate: '2026-06-03',
    },
    {
      id: '1004',
      key: 'DEMO-4',
      summary: 'Write API documentation',
      status: { name: 'To Do', category: 'new' },
      assignee: null, // 🔴 unassigned
      priority: 'Lowest', // 🟡 low priority + overdue
      dueDate: '2026-05-28',
    },
    {
      id: '1005',
      key: 'DEMO-5',
      summary: 'Refactor auth module',
      status: { name: 'Done', category: 'done' },
      assignee: byId('u-clara'),
      priority: 'Medium',
      dueDate: '2026-05-01',
    },
    {
      id: '1006',
      key: 'DEMO-6',
      summary: 'Add dark mode',
      status: { name: 'To Do', category: 'new' },
      assignee: byId('u-dmitri'),
      priority: 'Low', // low but deadline far away → healthy
      dueDate: '2026-09-30',
    },
    {
      id: '1007',
      key: 'DEMO-7',
      summary: 'Investigate memory leak',
      status: { name: 'In Progress', category: 'indeterminate' },
      assignee: null, // 🔴 unassigned
      priority: 'Highest',
      dueDate: '2026-06-10',
    },
    { id: '1008', key: 'DEMO-8', summary: 'Improve search relevance', status: { name: 'In Progress', category: 'indeterminate' }, assignee: byId('u-fatima'), priority: 'Medium', dueDate: '2026-07-01' },
    { id: '1009', key: 'DEMO-9', summary: 'Migrate to Postgres 16', status: { name: 'To Do', category: 'new' }, assignee: byId('u-boris'), priority: 'High', dueDate: '2026-06-20' },
    { id: '1010', key: 'DEMO-10', summary: 'Add audit logging', status: { name: 'To Do', category: 'new' }, assignee: null, priority: 'Medium', dueDate: null },
    { id: '1011', key: 'DEMO-11', summary: 'Reduce bundle size', status: { name: 'In Progress', category: 'indeterminate' }, assignee: byId('u-grigor'), priority: 'Low', dueDate: '2026-09-01' },
    { id: '1012', key: 'DEMO-12', summary: 'Fix mobile layout overflow', status: { name: 'To Do', category: 'new' }, assignee: byId('u-dmitri'), priority: 'Medium', dueDate: '2026-06-08' },
    { id: '1013', key: 'DEMO-13', summary: 'Implement SSO login', status: { name: 'To Do', category: 'new' }, assignee: null, priority: 'High', dueDate: '2026-06-25' },
    { id: '1014', key: 'DEMO-14', summary: 'Write E2E tests for checkout', status: { name: 'To Do', category: 'new' }, assignee: byId('u-boris'), priority: 'Low', dueDate: '2026-06-05' },
    { id: '1015', key: 'DEMO-15', summary: 'Upgrade Node runtime', status: { name: 'Done', category: 'done' }, assignee: byId('u-anna'), priority: 'Medium', dueDate: '2026-05-20' },
    { id: '1016', key: 'DEMO-16', summary: 'Add API rate limiting', status: { name: 'To Do', category: 'new' }, assignee: byId('u-hana'), priority: 'High', dueDate: '2026-07-10' },
    { id: '1017', key: 'DEMO-17', summary: 'Localize error messages', status: { name: 'In Progress', category: 'indeterminate' }, assignee: null, priority: 'Low', dueDate: '2026-06-06' },
    { id: '1018', key: 'DEMO-18', summary: 'Refresh design tokens', status: { name: 'Done', category: 'done' }, assignee: byId('u-dmitri'), priority: 'Low', dueDate: '2026-05-15' },
    { id: '1019', key: 'DEMO-19', summary: 'Set up staging environment', status: { name: 'To Do', category: 'new' }, assignee: byId('u-igor'), priority: 'Medium', dueDate: '2026-06-30' },
    { id: '1020', key: 'DEMO-20', summary: 'Harden CSP headers', status: { name: 'To Do', category: 'new' }, assignee: null, priority: 'High', dueDate: '2026-06-12' },
    { id: '1021', key: 'DEMO-21', summary: 'Cache API responses', status: { name: 'In Progress', category: 'indeterminate' }, assignee: byId('u-julia'), priority: 'Medium', dueDate: '2026-07-05' },
    { id: '1022', key: 'DEMO-22', summary: 'Fix timezone handling bug', status: { name: 'To Do', category: 'new' }, assignee: byId('u-clara'), priority: 'Highest', dueDate: '2026-06-04' },
    { id: '1023', key: 'DEMO-23', summary: 'Add CSV export', status: { name: 'To Do', category: 'new' }, assignee: byId('u-dmitri'), priority: 'Low', dueDate: '2026-10-01' },
    { id: '1024', key: 'DEMO-24', summary: 'Improve onboarding copy', status: { name: 'To Do', category: 'new' }, assignee: null, priority: 'Lowest', dueDate: '2026-06-07' },
    { id: '1025', key: 'DEMO-25', summary: 'Optimize image delivery', status: { name: 'Done', category: 'done' }, assignee: byId('u-boris'), priority: 'Low', dueDate: '2026-05-10' },
    { id: '1026', key: 'DEMO-26', summary: 'Add keyboard shortcuts', status: { name: 'To Do', category: 'new' }, assignee: byId('u-anna'), priority: 'Low', dueDate: '2026-08-15' },
    { id: '1027', key: 'DEMO-27', summary: 'Review dependency licenses', status: { name: 'To Do', category: 'new' }, assignee: byId('u-clara'), priority: 'Medium', dueDate: '2026-06-22' },
    { id: '1028', key: 'DEMO-28', summary: 'Fix pagination off-by-one', status: { name: 'In Progress', category: 'indeterminate' }, assignee: byId('u-hana'), priority: 'High', dueDate: '2026-06-18' },
    { id: '1029', key: 'DEMO-29', summary: 'Add toggle integration test', status: { name: 'To Do', category: 'new' }, assignee: null, priority: 'Medium', dueDate: null },
    { id: '1030', key: 'DEMO-30', summary: 'Document deploy process', status: { name: 'To Do', category: 'new' }, assignee: byId('u-boris'), priority: 'Low', dueDate: '2026-09-10' },
    { id: '1031', key: 'DEMO-31', summary: 'Investigate slow dashboard query', status: { name: 'In Progress', category: 'indeterminate' }, assignee: byId('u-anna'), priority: 'Highest', dueDate: '2026-06-09' },
  ],
  OPS: [
    {
      id: '2001',
      key: 'OPS-1',
      summary: 'Rotate TLS certificates',
      status: { name: 'To Do', category: 'new' },
      assignee: byId('u-boris'),
      priority: 'High',
      dueDate: '2026-06-05',
    },
    {
      id: '2002',
      key: 'OPS-2',
      summary: 'Clean up stale backups',
      status: { name: 'To Do', category: 'new' },
      assignee: null, // 🔴 unassigned
      priority: 'Low', // 🟡 low priority + near deadline
      dueDate: '2026-06-04',
    },
    {
      id: '2003',
      key: 'OPS-3',
      summary: 'Upgrade monitoring stack',
      status: { name: 'In Progress', category: 'indeterminate' },
      assignee: byId('u-anna'),
      priority: 'Medium',
      dueDate: '2026-08-20',
    },
  ],
}
