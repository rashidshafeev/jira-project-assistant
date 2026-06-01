import { create } from 'zustand'

/**
 * App-wide session state. Currently just the selected project, which is
 * cross-cutting (the control panel, issue list and team tab all read it).
 * Feature/entity-specific state lives in its own slice's `model` segment.
 */
interface SessionState {
  selectedProjectKey: string | null
  setSelectedProjectKey: (key: string | null) => void
}

export const useSessionStore = create<SessionState>((set) => ({
  selectedProjectKey: null,
  setSelectedProjectKey: (key) => set({ selectedProjectKey: key }),
}))
