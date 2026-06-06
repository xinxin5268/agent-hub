// ============================================================
// Agent Hub Core Types
// ============================================================

export interface AgentInfo {
  id: string
  name: string
  status: 'online' | 'busy' | 'offline' | 'error'
  type: string
  platform: string
  host: string
  port: number
  wsUrl: string
  httpUrl: string
  model: string
  workspace: string
  lastActive: number
  currentTask?: string
  sessionCount: number
  toolsUsed: number
  capabilities?: string[]
  skills?: string[]
  uptime: number
  cpu?: number
  memoryMb?: number
  launchPath?: string
  launchCommand?: string
}

export interface ActivityEvent {
  id: string
  agentId: string
  agentName: string
  type: 'tool_call' | 'tool_result' | 'thinking' | 'message' | 'error' | 'session_start' | 'session_end'
  summary: string
  detail?: string
  timestamp: number
  status?: 'running' | 'done' | 'error'
}

export interface Project {
  id: string
  name: string
  description: string
  assignedAgents: string[]
  status: 'planning' | 'in_progress' | 'review' | 'done'
  progress: number
  createdAt: number
  updatedAt: number
  tasks: Task[]
}

export interface Task {
  id: string
  projectId: string
  title: string
  description?: string
  agentId?: string
  status: 'todo' | 'in_progress' | 'review' | 'done'
  priority: 'low' | 'medium' | 'high'
  createdAt: number
  updatedAt: number
}

export interface SessionInfo {
  key: string
  agentId: string
  lastActivity: number
  messageCount: number
}

export interface GatewayHealth {
  connected: boolean
  version?: string
  uptimeMs?: number
  agents?: number
  sessions?: number
  error?: string
}

// Gateway WebSocket Protocol
export type GatewayEvent = {
  type: 'event'
  event: string
  payload: Record<string, unknown>
  seq?: number
  stateVersion?: number
}

export type GatewayResponse = {
  type: 'res'
  id: string
  ok: boolean
  payload?: unknown
  error?: { code: string; message: string }
}
// Skills
export interface SkillInfo {
  name: string
  category: string
  description: string
  tier: 'core' | 'toolkit' | 'scenario' | 'unknown'
  status: 'active' | 'inactive' | 'conflict'
  triggers: string[]
  tools: string[]
  path: string
  source: string
  size: number
  hash: string
  tags: string[]
  updated_at: string
  last_agent?: string
  priority_score?: number
}

export interface SkillMatch {
  rank: number
  skill: string
  tier: string
  category: string
  score: string
  reason: string
}

export interface SkillCatalog {
  skills: SkillInfo[]
  categories: Record<string, { count: number; skills: string[] }>
  total: number
  last_updated: string
}

// ═══ 共享知识库 ═══
export interface KnowledgeEntry {
  id: string
  type: 'fact' | 'skill' | 'code' | 'experience' | 'decision'
  title: string
  content: string
  tags: string[]
  source: string
  sourceAgent: string
  confidence: number
  timestamp: number
}
