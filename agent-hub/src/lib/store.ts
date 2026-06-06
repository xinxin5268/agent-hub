// ============================================================
// Global state store — Registry-backed Agent Hub
// ============================================================

import { create } from 'zustand'
import type { AgentInfo, ActivityEvent, Project, GatewayHealth, SkillInfo, SkillMatch } from '@/types'

// Registry URL (from localStorage or default)
const REGISTRY_URL_KEY = 'hub-registry-url'
export function getRegistryUrl(): string {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem(REGISTRY_URL_KEY)
    if (stored) return stored
    const host = window.location.hostname
    if (host !== '127.0.0.1' && host !== 'localhost') {
      return `http://${host}:3210`
    }
    return 'http://localhost:3210'
  }
  return 'http://localhost:3210'
}
export function setRegistryUrl(url: string) {
  localStorage.setItem(REGISTRY_URL_KEY, url)
}

interface HubState {
  // Connection
  connected: boolean
  registryUrl: string
  setRegistryUrl: (url: string) => void
  setConnected: (v: boolean) => void

  // Agents (from registry, not demo)
  agents: AgentInfo[]
  setAgents: (agents: AgentInfo[]) => void
  updateAgent: (id: string, patch: Partial<AgentInfo>) => void

  // Activity feed
  activities: ActivityEvent[]
  addActivity: (event: ActivityEvent) => void
  clearActivities: () => void

  // Projects
  projects: Project[]
  setProjects: (projects: Project[]) => void
  addProject: (project: Project) => void
  updateProject: (id: string, patch: Partial<Project>) => void

  // Gateway health
  health: GatewayHealth
  setHealth: (health: GatewayHealth) => void

  // UI state
  activeTab: string
  setActiveTab: (tab: string) => void
  selectedAgentId: string | null
  setSelectedAgentId: (id: string | null) => void

  // Skills
  skills: SkillInfo[]
  setSkills: (skills: SkillInfo[]) => void
  skillMatches: SkillMatch[]
  setSkillMatches: (matches: SkillMatch[]) => void
  skillLoading: boolean
  setSkillLoading: (v: boolean) => void
}

export const useHubStore = create<HubState>((set) => ({
  connected: false,
  registryUrl: getRegistryUrl(),
  setRegistryUrl: (url) => { setRegistryUrl(url); set({ registryUrl: url }) },
  setConnected: (v) => set({ connected: v }),

  // Start with empty agents — registry fills them in
  agents: [],
  setAgents: (agents) => set({ agents }),
  updateAgent: (id, patch) => set((s) => ({
    agents: s.agents.map(a => a.id === id ? { ...a, ...patch } : a),
  })),

  activities: [],
  addActivity: (event) => set((s) => ({
    activities: [event, ...s.activities].slice(0, 200),
  })),
  clearActivities: () => set({ activities: [] }),

  projects: [],
  setProjects: (projects) => set({ projects }),
  addProject: (project) => set((s) => ({ projects: [...s.projects, project] })),
  updateProject: (id, patch) => set((s) => ({
    projects: s.projects.map(p => p.id === id ? { ...p, ...patch } : p),
  })),

  health: { connected: false },
  setHealth: (health) => set({ health }),

  activeTab: 'dashboard',
  setActiveTab: (tab) => set({ activeTab: tab }),
  selectedAgentId: null,
  setSelectedAgentId: (id) => set({ selectedAgentId: id }),

  skills: [],
  setSkills: (skills) => set({ skills }),
  skillMatches: [],
  setSkillMatches: (matches) => set({ skillMatches: matches }),
  skillLoading: false,
  setSkillLoading: (v) => set({ skillLoading: v }),
}))
