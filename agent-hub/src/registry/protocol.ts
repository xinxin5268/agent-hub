// ============================================================
// Registry Protocol — 注册中心通信协议
// Agent 与注册中心之间的 WebSocket + HTTP 协议定义
// ============================================================

/** Agent 信息 */
export interface AgentRegistration {
  id: string
  name: string
  type: 'opencode' | 'openclaw-gateway' | 'custom'
  platform: 'windows' | 'wsl' | 'linux' | 'macos'
  host: string
  port: number
  /** opencode: ACP WebSocket URL; Gateway: WS URL */
  wsUrl: string
  /** HTTP API base URL (if available) */
  httpUrl?: string
  /** Agent 当前状态 */
  status: 'online' | 'busy' | 'offline'
  /** 支持的模型列表 */
  models?: string[]
  /** 工作目录 */
  cwd?: string
  /** 版本 */
  version?: string
  /** 最后心跳时间 */
  lastHeartbeat: number
  /** 注册时间 */
  registeredAt: number
  /** 自定义标签 */
  tags?: Record<string, string>
  /** Agent 声明的能力列表 */
  capabilities?: string[]
  /** Agent 启动脚本路径（注册中心可用此路径拉起离线 Agent） */
  launchPath?: string
  currentTask?: string
  /** Agent 启动命令（注册中心可用此命令拉起离线 Agent） */
  launchCommand?: string
  /** Agent 所在工作目录 */
  skills?: string[]
}

/** 注册请求（Agent → Registry） */
export interface RegisterRequest {
  action: 'register' | 'heartbeat' | 'unregister'
  agent: AgentRegistration
}

/** 注册响应（Registry → Agent） */
export interface RegisterResponse {
  ok: boolean
  error?: string
  /** 注册中心分配的会话 token */
  token?: string
  /** 注册中心信息 */
  registry?: {
    name: string
    version: string
  }
}

/** 指令请求（Registry/Studio → Agent） */
export interface CommandRequest {
  id: string
  agentId: string
  command: 'start' | 'stop' | 'restart' | 'inject' | 'exec' | 'status'
  /** inject/exec 时的消息内容 */
  payload?: string
  /** 来源（谁发的指令） */
  from?: string
  timestamp: number
}

/** 指令响应 */
export interface CommandResponse {
  id: string
  agentId: string
  ok: boolean
  error?: string
  result?: unknown
  timestamp: number
}

/** Agent 间消息 */
export interface AgentMessage {
  id: string
  from: string
  fromName?: string
  to: string  // agentId or 'broadcast'
  content: string
  type: 'chat' | 'command' | 'broadcast'
  timestamp: number
}

export interface MessageEvent {
  type: 'agent:message'
  message: AgentMessage
}

/** 注册中心事件（推送到工作室 UI） */
export type RegistryEvent =
  | { type: 'agent:registered'; agent: AgentRegistration }
  | { type: 'agent:unregistered'; agentId: string }
  | { type: 'agent:status'; agentId: string; status: string }
  | { type: 'agent:heartbeat'; agentId: string; timestamp: number }
  | { type: 'command:result'; response: CommandResponse }
  | { type: 'log'; level: string; message: string; timestamp: number }
  | { type: 'agent:message'; message: AgentMessage }
  | { type: 'registry:state'; agents: AgentRegistration[]; stats: { total: number; online: number; busy: number; offline: number; byType: Record<string, number>; byPlatform: Record<string, number> } }

/** mDNS 服务类型 */
export const MDNS_SERVICE_TYPES = {
  OPENCODE: '_opencode._tcp',
  OPENCLAW_GW: '_openclaw-gw._tcp',
  AGENT_HUB: '_agent-hub._tcp',
} as const

/** 注册中心配置 */
export interface RegistryConfig {
  name: string
  port: number
  mdnsPort: number
  heartbeatIntervalMs: number
  heartbeatTimeoutMs: number
  allowedOrigins: string[]
}

export const DEFAULT_REGISTRY_CONFIG: RegistryConfig = {
  name: 'Agent Hub Registry',
  port: 3210,
  mdnsPort: 3211,
  heartbeatIntervalMs: 30_000,
  heartbeatTimeoutMs: 90_000,
  allowedOrigins: ['*'],
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
