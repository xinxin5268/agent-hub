// ============================================================
// Registry Daemon — 注册中心服务
// HTTP + WebSocket 双协议，Agent 通过 WS 注册，工作室 UI 通过 HTTP 查询
// ============================================================

import { createServer } from 'http'
import { WebSocketServer, WebSocket } from 'ws'
import express from 'express'
import cors from 'cors'
import { execSync } from 'child_process'
import { KnowledgeEntry } from "../types/index"
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { AgentPool } from './agent-pool'
import { MdnsScanner } from './mdns-scanner'

// ─── 项目/任务数据（内存持久化，后续可迁到 SQLite）──
interface ProjectRecord {
  id: string
  name: string
  description: string
  assignedAgents: string[]
  status: 'planning' | 'in_progress' | 'review' | 'done'
  progress: number
  createdAt: number
  updatedAt: number
}

interface TaskRecord {
  id: string
  projectId: string
  title: string
  description: string
  assignedTo: string
  status: 'todo' | 'in_progress' | 'review' | 'done'
  createdAt: number
  updatedAt: number
}

interface ChatMessage {
  id: string
  from: string
  to: string
  content: string
  type: 'broadcast' | 'chat'
  timestamp: number
}

// ═══ 监测系统类型 ═══
interface AgentMonitorData {
  agentId: string
  agentName: string
  status: string
  cpu: number        // 0-100
  memoryMb: number
  taskProgress: number  // 0-100
  errorRate: number     // 0-100
  responseLatency: number // ms
  uptime: number         // seconds
  healthScore: number    // 0-100
  consecutiveFailures: number
  lastChecked: number
  lastError: string
  currentTask: string
}

interface AlertEvent {
  id: string
  type: 'agent_offline' | 'task_timeout' | 'error_spike' | 'high_latency' | 'low_health'
  agentId: string
  agentName: string
  severity: 'info' | 'warning' | 'critical'
  message: string
  timestamp: number
  resolved: boolean
}

let _projects: ProjectRecord[] = []
let _tasks: TaskRecord[] = []
let _messages: ChatMessage[] = []
let _knowledge: KnowledgeEntry[] = []

// ─── 持久化路径 ───
const DATA_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../data')

function loadData() {
  try {
    const files = ['projects.json', 'tasks.json', 'messages.json', 'knowledge.json']
    const targets = [_projects, _tasks, _messages, _knowledge]
    for (let i = 0; i < files.length; i++) {
      const fp = path.join(DATA_DIR, files[i])
      if (fs.existsSync(fp)) {
        const data = JSON.parse(fs.readFileSync(fp, 'utf-8'))
        if (Array.isArray(data)) {
          if (i === 0) _projects = data as ProjectRecord[]
          else if (i === 1) _tasks = data as TaskRecord[]
          else if (i === 2) _messages = data as ChatMessage[]
          else if (i === 3) _knowledge = data as KnowledgeEntry[]
        }
      }
    }
    console.log(`[persist] 已加载: ${_projects.length} 项目, ${_tasks.length} 任务, ${_messages.length} 消息, ${_knowledge.length} 知识`)
  } catch (e: any) {
    console.warn('[persist] 加载失败:', e.message)
  }
}

function saveData() {
  try {
    const files = ['projects.json', 'tasks.json', 'messages.json', 'knowledge.json']
    const data = [_projects, _tasks, _messages, _knowledge]
    fs.mkdirSync(DATA_DIR, { recursive: true })
    for (let i = 0; i < files.length; i++) {
      fs.writeFileSync(path.join(DATA_DIR, files[i]), JSON.stringify(data[i], null, 2), 'utf-8')
    }
  } catch (e: any) {
    console.warn('[persist] 保存失败:', e.message)
  }
}

// 启动时加载
loadData()

// 启动时检查 sessions.json（共享会话历史独立持久化）
function loadSessions() {
  const fp = path.join(DATA_DIR, 'sessions.json')
  if (fs.existsSync(fp)) {
    try {
      const data = JSON.parse(fs.readFileSync(fp, 'utf-8'))
      if (Array.isArray(data.sessions)) {
        // 把 sessions 中的消息合并到 _messages（避免重复）
        const existingIds = new Set(_messages.map(m => m.id))
        for (const msg of data.sessions) {
          if (!existingIds.has(msg.id)) {
            _messages.push(msg)
            existingIds.add(msg.id)
          }
        }
        console.log(`[sessions] 从 sessions.json 恢复 ${data.sessions.length} 条消息`)
      }
    } catch (e: any) {
      console.warn('[sessions] 加载失败:', e.message)
    }
  }
}

function saveSessions() {
  try {
    const fp = path.join(DATA_DIR, 'sessions.json')
    fs.mkdirSync(DATA_DIR, { recursive: true })
    fs.writeFileSync(fp, JSON.stringify({ sessions: _messages.slice(-500) }, null, 2), 'utf-8')
  } catch (e: any) {
    console.warn('[sessions] 保存失败:', e.message)
  }
}

// 加载 session 数据
loadSessions()

import {
  type AgentRegistration,
  type RegisterRequest,
  type RegistryEvent,
  type RegistryConfig,
  DEFAULT_REGISTRY_CONFIG,
  type CommandRequest,
  type CommandResponse,
  MDNS_SERVICE_TYPES,
  type AgentMessage,
  type MessageEvent,
} from './protocol'
import { GatewayBridgeManager } from './gateway-bridge'
let _persistTimer: ReturnType<typeof setTimeout> | null = null
function persistDebounce() {
  if (_persistTimer) clearTimeout(_persistTimer)
  _persistTimer = setTimeout(() => {
    saveData(); saveSessions()
    _persistTimer = null
  }, 3000)
}

export class RegistryDaemon {
  private pool = new AgentPool()
  private scanner: MdnsScanner
  private config: RegistryConfig
  private wss: WebSocketServer | null = null
  private httpServer: ReturnType<typeof createServer> | null = null
  private clients = new Set<WebSocket>()
  /** 已注册的 opencode agent 对应的 WebSocket 连接 */
  private agentConnections = new Map<string, WebSocket>()
  private gwBridge = new GatewayBridgeManager()
  /** 根据 gateway 端口映射 auth token */
  private gwTokens = new Map<number, string>()
  /** Gateway bridge 设备身份持久化路径 */
  private gwIdentityDir: string
  /** 消息队列：暂存发送给 Agent 的消息，供轮询 */
  private messageQueue: { agentId: string; message: AgentMessage }[] = []
  /** 监测系统 */
  private monitorInterval: NodeJS.Timeout | null = null
  private _monitorData: Record<string, AgentMonitorData> = {}
  private _alerts: AlertEvent[] = []

  constructor(config: Partial<RegistryConfig> = {}) {
    this.config = { ...DEFAULT_REGISTRY_CONFIG, ...config }
    this.gwIdentityDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../data/gw-identities')
    this.loadGwTokens()

    this.scanner = new MdnsScanner({
      onDiscovered: (svc) => {
        const agent = this.scanner.serviceToRegistration(svc)
        if (agent) {
          this.pool.register(agent)
          this.broadcast({ type: 'agent:registered', agent })
        }
      },
      onLost: (svc) => {
        // mDNS lost — 等待心跳超时再标记离线
        console.log(`[registry] mDNS lost: ${svc.name}`)
      },
    })

    // Agent 状态变更 → 推送到 UI
    this.pool.onStatusChange = (agentId, status, agent) => {
      this.broadcast({ type: 'agent:status', agentId, status })
      // 状态变更 → 更新监测数据 + 告警
      const md = this._monitorData[agentId]
      if (md) {
        md.status = status
        md.lastChecked = Date.now()
      }
      if (status === 'offline') {
        this.addAlert('agent_offline', agentId, agent?.name || agentId, 'critical', `Agent ${agent?.name || agentId} 已离线`)
      }
    }
    // 启动监测引擎
    this.startMonitoring()
  }

  async start() {
    // Start HTTP + WebSocket server
    const app = express()
    app.use(cors({ origin: '*' }))
    app.use(express.json())
    app.use(express.static(new URL("../../dist", import.meta.url).pathname))

    // REST API
    app.get('/api/agents', (_req, res) => {
      const agents = this.pool.getAllAgents()
      res.json({ agents, stats: this.pool.getStats() })
    })

    // Agent 技能查询
    app.get('/api/agents/:id/skills', (req, res) => {
      const agent = this.pool.getAgent(req.params.id)
      if (!agent) return res.status(404).json({ error: 'agent not found' })
      res.json({ ok: true, agentId: agent.id, skills: agent.skills || [] })
    })

    app.get('/api/agents/:id', (req, res) => {
      const agent = this.pool.getAgent(req.params.id)
      if (!agent) return res.status(404).json({ error: 'not found' })
      res.json({ agent })
    })

    app.post('/api/register', (req, res) => {
      const body = req.body as RegisterRequest
      if (!body?.agent) {
        return res.status(400).json({ ok: false, error: 'invalid request' })
      }
      const result = this.pool.register(body.agent)
      if (result.ok) {
        this.broadcast({ type: 'agent:registered', agent: body.agent })
      }
      res.json({ ...result, registry: { name: this.config.name, version: '1.0.0' } })
    })

    app.post('/api/heartbeat', (req, res) => {
      const { agentId } = req.body || {}
      if (!agentId) return res.status(400).json({ ok: false })
      const ok = this.pool.heartbeat(agentId)
      res.json({ ok })
    })

    app.post('/api/command', async (req, res) => {
      const cmd = req.body as CommandRequest
      if (!cmd?.agentId || !cmd?.command) {
        return res.status(400).json({ ok: false, error: 'agentId and command required' })
      }
      const result = await this.executeCommand(cmd)
      res.json(result)
    })

    app.get('/api/stats', (_req, res) => {
      res.json(this.pool.getStats())
    })

    // Message Queue API — 供 Agent 轮询消息
    app.get('/api/messages/:agentId', (req, res) => {
      const agentId = req.params.agentId
      const msgs = this.messageQueue.filter(m => String(m.agentId) === agentId || String(m.agentId) === 'broadcast')
      // 移除已返回的消息
      this.messageQueue = this.messageQueue.filter(m => String(m.agentId) !== agentId)
      res.json({ ok: true, messages: msgs.map(m => m.message) })
    })

    app.get('/api/messages', (_req, res) => {
      res.json({ ok: true, count: this.messageQueue.length, messages: this.messageQueue })
    })

    // ─── 聊天记录 API ───────────────────────────────
    app.get('/api/chat-history', (_req, res) => {
      res.json({ ok: true, count: _messages.length, messages: _messages.slice(-200) })
    })

    app.post('/api/messages', (req, res) => {
      const body = req.body || {}
      if (!body.content) return res.status(400).json({ ok: false, error: 'content required' })
      const msg: ChatMessage = {
        id: body.id || `msg-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,
        from: body.from || 'api',
        to: body.to || 'broadcast',
        content: body.content,
        type: body.type || 'broadcast',
        timestamp: body.timestamp || Date.now(),
      }
      _messages.push(msg)
      persistDebounce()
      this.broadcast({ type: 'agent:message', message: msg } as any)
      // 转发给所有 Agent — 同时处理在线和离线的
      console.log('[registry] forwarding API message to agents, connections:', this.agentConnections.size)
      let forwarded = 0
      let queued = 0
      const allAgents = this.pool.getAllAgents()
      for (const agent of allAgents) {
        const agentWs = this.agentConnections.get(agent.id)
        if (agentWs && agentWs.readyState === WebSocket.OPEN) {
          agentWs.send(JSON.stringify({ type: 'command', command: {
            id: msg.id,
            agentId: agent.id,
            command: 'chat',
            payload: msg.content,
            from: msg.from,
          }}))
          forwarded++
        } else {
          // 离线或WS断连 → 入消息队列，Agent重连后轮询
          // 用 msg.to 作为 agentId，这样消费时能匹配到
          this.messageQueue.push({ agentId: msg.to || agent.id, message: msg })
          queued++
        }
      }
      console.log('[registry] forwarded to', forwarded, 'agents, queued for', queued, 'offline agents')
      res.json({ ok: true, message: msg, stats: { forwarded, queued, total: allAgents.length } })
    })

    // Skill Management API
    const _dirname = path.dirname(fileURLToPath(import.meta.url))
    const SKILL_BRIDGE = path.resolve(_dirname, '../../smart-skill-manager/skill-bridge.py')

    function callBridge(...args: string[]): Promise<{ok: boolean; message?: any}> {
      try {
        const cmd = `python3 "${SKILL_BRIDGE}" ${args.map(a => `"${a.replace(/"/g, '\\"')}"`).join(' ')}`
        const out = execSync(cmd, { encoding: 'utf-8', timeout: 120000 })
        return JSON.parse(out)
      } catch (e: any) {
        return { ok: false, error: e.message, stderr: e.stderr?.toString() }
      }
    }

    app.get('/api/skills', async (_req, res) => {
      const data = await callBridge('list')
      res.json(data)
    })

    app.post('/api/skills/scan', async (_req, res) => {
      const data = await callBridge('scan')
      res.json(data)
    })

    app.get('/api/skills/match', async (req, res) => {
      const task = (req.query.task as string) || ''
      if (!task) return res.status(400).json({ ok: false, error: 'task query param required' })
      const data = await callBridge('match', task)
      res.json(data)
    })

    app.get('/api/skills/stats', async (_req, res) => {
      const data = await callBridge('stats')
      res.json(data)
    })

    app.get('/api/skills/raw', (_req, res) => {
      try {
        const catalogDir = path.resolve(process.env.HOME || '~', '.openclaw/workspace/workbench/_catalog')
        const p = path.join(catalogDir, 'registry.json')
        if (!fs.existsSync(p)) return res.status(404).json({ error: 'registry.json not found' })
        const raw = JSON.parse(fs.readFileSync(p, 'utf-8'))
        res.json(raw)
      } catch (e: any) {
        res.status(500).json({ error: e.message })
      }
    })

    // ─── 项目管理 API ─────────────────────────────
    app.post('/api/projects', (req, res) => {
      const body = req.body || {}
      if (!body.name) return res.status(400).json({ ok: false, error: 'name required' })
      const project: ProjectRecord = {
        id: `proj-${Date.now()}`,
        name: body.name,
        description: body.description || '',
        assignedAgents: body.assignedAgents || [],
        status: 'planning',
        progress: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      _projects.push(project)
      persistDebounce()
      this.broadcast({ type: 'project:created', project } as any)
      res.json({ ok: true, project })
    })

    app.get('/api/projects', (_req, res) => {
      res.json({ ok: true, projects: _projects })
    })

    app.get('/api/projects/:id', (req, res) => {
      const p = _projects.find(x => x.id === req.params.id)
      if (!p) return res.status(404).json({ ok: false, error: 'not found' })
      res.json({ ok: true, project: p, tasks: _tasks.filter(t => t.projectId === p.id) })
    })

    app.put('/api/projects/:id', (req, res) => {
      const idx = _projects.findIndex(x => x.id === req.params.id)
      if (idx < 0) return res.status(404).json({ ok: false, error: 'not found' })
      _projects[idx] = { ..._projects[idx], ...req.body, updatedAt: Date.now() }
      this.broadcast({ type: 'project:updated', project: _projects[idx] } as any)
      res.json({ ok: true, project: _projects[idx] })
    })

    // ─── 任务管理 API ─────────────────────────────
    app.post('/api/tasks', (req, res) => {
      const body = req.body || {}
      if (!body.projectId || !body.title) return res.status(400).json({ ok: false, error: 'projectId and title required' })
      const task: TaskRecord = {
        id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        projectId: body.projectId,
        title: body.title,
        description: body.description || '',
        assignedTo: body.assignedTo || '',
        status: 'todo',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      _tasks.push(task)
      persistDebounce()
      this.broadcast({ type: 'task:created', task } as any)
      res.json({ ok: true, task })
    })

    app.get('/api/tasks/:projectId', (req, res) => {
      res.json({ ok: true, tasks: _tasks.filter(t => t.projectId === req.params.projectId) })
    })

    app.put('/api/tasks/:id', (req, res) => {
      const idx = _tasks.findIndex(x => x.id === req.params.id)
      if (idx < 0) return res.status(404).json({ ok: false, error: 'not found' })
      _tasks[idx] = { ..._tasks[idx], ...req.body, updatedAt: Date.now() }
      this.broadcast({ type: 'task:updated', task: _tasks[idx] } as any)
      res.json({ ok: true, task: _tasks[idx] })
    })

    app.delete('/api/projects/:id', (req, res) => {
      const idx = _projects.findIndex(x => x.id === req.params.id)
      if (idx < 0) return res.status(404).json({ ok: false, error: 'not found' })
      _projects.splice(idx, 1)
      persistDebounce()
      // 同时删除项目下的任务
      _tasks = _tasks.filter(t => t.projectId !== req.params.id)
      this.broadcast({ type: 'project:deleted', projectId: req.params.id } as any)
      res.json({ ok: true })
    })

    app.delete('/api/tasks/:id', (req, res) => {
      const idx = _tasks.findIndex(x => x.id === req.params.id)
      if (idx < 0) return res.status(404).json({ ok: false, error: 'not found' })
      _tasks.splice(idx, 1)
      persistDebounce()
      this.broadcast({ type: 'task:deleted', taskId: req.params.id } as any)
      res.json({ ok: true })
    })

    // ═══ 共享知识库 API ═══════════════════════════

    // 存储知识
    app.post('/api/knowledge', (req, res) => {
      const body = req.body || {}
      if (!body.content) return res.status(400).json({ ok: false, error: 'content required' })
      const entry: KnowledgeEntry = {
        id: `know-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,
        type: body.type || 'experience',
        title: body.title || '',
        content: body.content,
        tags: body.tags || [],
        source: body.source || 'manual',
        sourceAgent: body.sourceAgent || '',
        confidence: body.confidence || 0.8,
        timestamp: Date.now(),
      }
      _knowledge.push(entry)
      persistDebounce()
      this.broadcast({ type: 'knowledge:added', entry } as any)
      res.json({ ok: true, entry })
    })

    // 搜索知识
    app.get('/api/knowledge', (req, res) => {
      const q = (req.query.q as string || '').toLowerCase()
      const type = req.query.type as string
      const tag = req.query.tag as string
      const sourceAgent = req.query.sourceAgent as string
      let results = _knowledge
      if (q) results = results.filter(e => e.content.toLowerCase().includes(q) || e.title.toLowerCase().includes(q))
      if (type) results = results.filter(e => e.type === type)
      if (tag) results = results.filter(e => e.tags.some(t => t === tag))
      if (sourceAgent) results = results.filter(e => e.sourceAgent === sourceAgent)
      res.json({ ok: true, entries: results.slice(-100), total: _knowledge.length })
    })

    // 获取知识类型统计
    app.get('/api/knowledge/stats', (_req, res) => {
      const stats: Record<string, number> = {}
      _knowledge.forEach(e => { stats[e.type] = (stats[e.type] || 0) + 1 })
      res.json({ ok: true, stats, total: _knowledge.length })
    })

    // 删除知识
    app.delete('/api/knowledge/:id', (req, res) => {
      const idx = _knowledge.findIndex(x => x.id === req.params.id)
      if (idx < 0) return res.status(404).json({ ok: false, error: 'not found' })
      _knowledge.splice(idx, 1)
      persistDebounce()
      res.json({ ok: true })
    })

    // ═══ Agent 远程启动 API ═══════════════════════════
    app.post('/api/launch', (req, res) => {
      const { agentId } = req.body || {}
      if (!agentId) return res.status(400).json({ ok: false, error: 'agentId required' })
      const result = this.pool.launchAgent(agentId)
      res.json({ ok: result.ok ?? true, agentId, result })
    })

    app.post('/api/launch-all', (_req, res) => {
      const result = this.pool.launchAllOffline()
      res.json(result)
    })

    app.post('/api/health-check', async (_req, res) => {
      const result = await this.pool.runHealthCheck()
      res.json({ ok: true, ...result })
    })

    // ═══ 监测 API ═══
    app.get('/api/monitor', (_req, res) => {
      res.json({
        ok: true,
        agents: this._monitorData,
        alerts: this._alerts.slice(-100),
        summary: this.getMonitorSummary(),
      })
    })

    app.get('/api/monitor/alerts', (_req, res) => {
      res.json({ ok: true, alerts: this._alerts.slice(-100) })
    })

    app.get('/api/monitor/summary', (_req, res) => {
      res.json({ ok: true, ...this.getMonitorSummary() })
    })

    // Create HTTP server
    this.httpServer = createServer(app)

    // WebSocket server
    this.wss = new WebSocketServer({ server: this.httpServer, path: '/ws' })

    this.wss.on('connection', (ws, req) => {
      const url = new URL(req.url || '', `http://${req.headers.host}`)
      const agentId = url.searchParams.get('agentId')

      // 对所有连接启用 ping/pong
      let alive = true
      ws.on('pong', () => { alive = true })
      const pingTimer = setInterval(() => {
        if (!alive) {
          ws.terminate()
          return
        }
        alive = false
        ws.ping()
      }, 30_000)

      if (agentId) {
        // Agent 连接
        console.log(`[registry] agent connected: ${agentId}`)
        this.agentConnections.set(agentId, ws)

        ws.on('message', (raw) => {
          try {
            const msg = JSON.parse(raw.toString())
            this.handleAgentMessage(agentId, msg, ws)
          } catch (e) {
            console.error('[registry] invalid message from agent:', e)
          }
        })

        ws.on('close', () => {
          console.log(`[registry] agent disconnected: ${agentId}`)
          clearInterval(pingTimer)
          this.agentConnections.delete(agentId)
          this.pool.markOffline(agentId)
          // 广播状态变化
          this.broadcast({ type: 'agent:status', agentId, status: 'offline' })
        })
      } else {
        // UI 客户端连接
        console.log('[registry] UI client connected')
        this.clients.add(ws)

        // 发送当前所有 Agent 列表
        ws.send(JSON.stringify({
          type: 'registry:state',
          agents: this.pool.getAllAgents(),
          stats: this.pool.getStats(),
        } satisfies RegistryEvent & { agents: AgentRegistration[]; stats: any }))

        ws.on('close', () => {
          console.log('[registry] UI client disconnected')
          clearInterval(pingTimer)
          this.clients.delete(ws)
        })
        ws.on('message', (raw) => {
          try {
            const msg = JSON.parse(raw.toString())
            // 处理来自 UI 的消息
            if (msg.type === 'agent:message' && msg.message) {
              const agentMsg = msg.message as AgentMessage
              console.log('[registry] forwarding message from UI:', agentMsg.from, '->', agentMsg.to)
              // 持久化消息
              _messages.push({
                id: agentMsg.id || `msg-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,
                from: agentMsg.from,
                to: agentMsg.to,
                content: agentMsg.content,
                type: agentMsg.to === 'broadcast' ? 'broadcast' : 'chat',
                timestamp: agentMsg.timestamp || Date.now(),
              })
              persistDebounce()
              if (agentMsg.to === 'broadcast') {
                // 广播给所有其他 UI 客户端
                this.broadcast({ type: 'agent:message', message: agentMsg })
                // 同时也发给所有 Agent WS 连接
                for (const [aid, agentWs] of this.agentConnections) {
                  if (agentWs.readyState === WebSocket.OPEN) {
                    agentWs.send(JSON.stringify({ type: 'command', command: {
                      id: agentMsg.id,
                      agentId: aid,
                      command: 'chat',
                      payload: agentMsg.content,
                      from: agentMsg.from,
                    }}))
                  }
                }
                // 加入消息队列供 Agent HTTP 轮询
                for (const agent of this.pool.getAllAgents()) {
                  this.messageQueue.push({ agentId: agent.id, message: agentMsg })
                }
              } else {
                // 私聊：发给目标 Agent（如果有 WS 连接）或广播
                const targetWs = this.agentConnections.get(agentMsg.to)
                if (targetWs && targetWs.readyState === WebSocket.OPEN) {
                  targetWs.send(JSON.stringify({ type: 'agent:message', message: agentMsg }))
                }
                // 加入消息队列供 Agent 轮询
                this.messageQueue.push({ agentId: agentMsg.to, message: agentMsg })
                // 通过 Gateway Bridge 转发给目标 Agent（如果适用）
                this.forwardMessageViaBridge(agentMsg)
                // 同时广播给所有 UI 客户端（包括发送者自己，实现乐观更新）
                this.broadcast({ type: 'agent:message', message: agentMsg })
              }
            }
          } catch (e) {
            console.error('[registry] invalid message from UI client:', e)
          }
        })

        ws.on('close', () => {
          this.clients.delete(ws)
          console.log('[registry] UI client disconnected')
        })
      }
    })

    // Start listening
    return new Promise<void>((resolve) => {
      this.httpServer!.listen(this.config.port, '0.0.0.0', () => {
        console.log(`[registry] daemon listening on :${this.config.port}`)
        console.log(`[registry] WebSocket: ws://0.0.0.0:${this.config.port}/ws`)
        console.log(`[registry] REST API: http://0.0.0.0:${this.config.port}/api`)

        // Start mDNS scanner
        this.scanner.start()
        this.scanner.startRefreshing()

        resolve()
      })
    })
  }

  private handleAgentMessage(agentId: string, msg: any, ws: WebSocket) {
    switch (msg.action) {
      case 'register':
        if (msg.agent) {
          this.pool.register(msg.agent)
          ws.send(JSON.stringify({ type: 'register:response', ok: true, registry: { name: this.config.name, version: '1.0.0' } }))
          // Agent 注册后同步技能到共享 skill 管理器
          this.syncAgentSkills()
        }
        break
      case 'heartbeat':
        this.pool.heartbeat(agentId)
        break
      case 'message':
        if (msg.message) {
          const agentMsg = msg.message as AgentMessage
          console.log('[registry] forwarding message:', agentMsg.from, '->', agentMsg.to)
          // 持久化
          _messages.push({
            id: agentMsg.id || `msg-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,
            from: agentMsg.from,
            to: agentMsg.to,
            content: agentMsg.content,
            type: agentMsg.to === 'broadcast' ? 'broadcast' : 'chat',
            timestamp: agentMsg.timestamp || Date.now(),
          })
          persistDebounce()
          if (agentMsg.to === 'broadcast') {
            this.broadcast({ type: 'agent:message', message: agentMsg })
          } else {
            const targetWs = this.agentConnections.get(agentMsg.to)
            if (targetWs && targetWs.readyState === WebSocket.OPEN) {
              targetWs.send(JSON.stringify({ type: 'agent:message', message: agentMsg }))
            }
            this.broadcast({ type: 'agent:message', message: agentMsg })
          }
        }
        break
      case 'unregister':
        this.pool.unregister(agentId)
        break
      default:
        console.warn(`[registry] unknown action from ${agentId}:`, msg.action)
    }
  }

  private async executeCommand(cmd: CommandRequest): Promise<CommandResponse> {
    // 广播指令：转发给所有在线 Agent
    if (cmd.agentId === 'broadcast') {
      const online = this.pool.getAllAgents().filter(a => a.status === 'online' || a.status === 'busy')
      let sent = 0
      let failed = 0
      for (const agent of online) {
        try {
          // 通过 WS 转发
          const ws = this.agentConnections.get(agent.id)
          if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'command', command: { ...cmd, agentId: agent.id } }))
            sent++
          } else if (agent.httpUrl) {
            // HTTP 兜底
            await fetch(`${agent.httpUrl}/api/${cmd.command}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(cmd),
            })
            sent++
          } else {
            failed++
          }
        } catch {
          failed++
        }
      }
      return {
        id: cmd.id,
        agentId: 'broadcast',
        ok: true,
        result: { total: online.length, sent, failed },
        timestamp: Date.now(),
      }
    }

    const agent = this.pool.getAgent(cmd.agentId)
    if (!agent) {
      return { id: cmd.id, agentId: cmd.agentId, ok: false, error: 'agent not found', timestamp: Date.now() }
    }

    // 如果是 openclaw-gateway 类型，通过 Gateway Bridge (ACP WS) 转发
    if (agent.type === 'openclaw-gateway' && agent.wsUrl) {
      const port = agent.port
      const token = this.gwTokens.get(port)
      if (token) {
        const identityPath = path.join(this.gwIdentityDir, `agent-${agent.id}.json`)
        const bridge = this.gwBridge.getOrCreate(agent, token, identityPath)
        // 确保事件转发到 UI 客户端
        bridge.onEvent((event, payload) => {
          if (event === 'health' || event === 'tick') return
          this.broadcast({
            type: 'command:result' as any,
            response: {
              id: cmd.id,
              agentId: cmd.agentId,
              ok: true,
              result: { event, payload, ts: Date.now() },
              timestamp: Date.now(),
            },
          } as any)
        })
        return bridge.executeCommand(cmd)
      }
    }

    // 如果有 WebSocket 连接，通过 WS 转发指令
    const ws = this.agentConnections.get(cmd.agentId)
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'command', command: cmd }))
      return { id: cmd.id, agentId: cmd.agentId, ok: true, timestamp: Date.now() }
    }

    // 否则通过 HTTP 调用 opencode ACP / Gateway API
    try {
      const url = `${agent.httpUrl}/api/${cmd.command}`
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cmd),
      })
      const data = await response.json()
      return { id: cmd.id, agentId: cmd.agentId, ok: response.ok, result: data, timestamp: Date.now() }
    } catch (err: any) {
      return { id: cmd.id, agentId: cmd.agentId, ok: false, error: err.message, timestamp: Date.now() }
    }
  }

  /** 从 ~/.openclaw/openclaw.json 加载 gateway auth token */
  private loadGwTokens() {
    try {
      const home = process.env.HOME || '/root'
      const configPath = path.join(home, '.openclaw', 'openclaw.json')
      if (!fs.existsSync(configPath)) return
      const cfg = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
      const gw = cfg.gateway
      if (gw?.auth?.token) {
        this.gwTokens.set(gw.port || 18790, gw.auth.token)
        console.log(`[registry] loaded gw token for port ${gw.port || 18790}`)
      }
    } catch (e: any) {
      console.warn('[registry] could not load gw tokens:', e.message)
    }
  }

  /** 通过 Gateway Bridge 转发消息到目标 Agent 的主会话 */
  private async forwardMessageViaBridge(msg: AgentMessage) {
    try {
      // 获取目标 Agent 的注册信息
      const agent = this.pool.getAgent(msg.to)
      if (!agent) {
        console.log(`[registry] bridge-forward: agent ${msg.to} not found`)
        return
      }
      
      // 只对 openclaw-gateway 类型的 Agent 使用 bridge
      if (agent.type !== 'openclaw-gateway') {
        console.log(`[registry] bridge-forward: ${msg.to} type=${agent.type}, skip bridge`)
        return
      }
      
      const port = agent.port
      const token = this.gwTokens.get(port)
      if (!token) {
        console.log(`[registry] bridge-forward: no auth token for ${msg.to} port ${port}`)
        return
      }
      
      const identityPath = path.join(this.gwIdentityDir, `${agent.id}.identity.json`)
      const bridge = this.gwBridge.getOrCreate(agent, token, identityPath)
      
      if (bridge.getStatus() !== 'connected') {
        console.log(`[registry] bridge-forward: ${msg.to} not connected, trying to connect...`)
        try {
          await bridge.connect()
          console.log(`[registry] bridge-forward: ${msg.to} connected successfully`)
        } catch (connErr: any) {
          console.error(`[registry] bridge-forward: failed to connect to ${msg.to}:`, connErr.message)
          return
        }
      }
      
      // 使用 sessions.send 把消息注入到目标 Agent 的主会话
      const sessionKey = `agent:main:main`
      const formatted = `📨 **${msg.from}** → **${msg.to}**: ${msg.content}`
      
      await bridge.request('sessions.send', {
        key: sessionKey,
        message: formatted,
      })
      
      console.log(`[registry] bridge-forward: message sent to ${msg.to} via sessions.send`)
    } catch (e: any) {
      console.error(`[registry] bridge-forward error:`, e.message)
    }
  }

  private broadcast(event: RegistryEvent) {
    const data = JSON.stringify(event)
    for (const ws of this.clients) {
      if (ws.readyState === WebSocket.OPEN) ws.send(data)
    }
  }

  // ═══ 监测引擎 ═══════════════════════════════════

  /** 同步所有 Agent 技能到共享 skill 管理器 */
  private syncAgentSkills() {
    try {
      const agents = this.pool.getAllAgents()
      const agentsJson = JSON.stringify(agents)
      const script = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../scripts/sync-agent-skills.py')
      execSync(`python3 "${script}" '${agentsJson.replace(/'/g, "'\\''")}'`, { timeout: 5000, stdio: 'pipe' })
    } catch (e: any) {
      console.warn('[registry] skill sync error:', e.message)
    }
  }

  private startMonitoring() {
    console.log('[monitor] 监测引擎启动，每30秒轮询')
    this.runMonitorCycle()
    this.monitorInterval = setInterval(() => this.runMonitorCycle(), 30000)
    // 数据持久化定时器（每 60 秒写入一次，避免每次变更都写磁盘）
    setInterval(() => { saveData(); saveSessions(); }, 60000)
  }

  private runMonitorCycle() {
    const agents = this.pool.getAllAgents()
    const now = Date.now()

    for (const agent of agents) {
      const prev = this._monitorData[agent.id]
      const md: AgentMonitorData = {
        agentId: agent.id,
        agentName: agent.name,
        status: agent.status,
        cpu: prev?.cpu ?? Math.random() * 60 + 10,    // 模拟数据，后续从 Agent 获取
        memoryMb: prev?.memoryMb ?? Math.random() * 400 + 100,
        taskProgress: prev?.taskProgress ?? 0,
        errorRate: prev?.errorRate ?? 0,
        responseLatency: prev?.responseLatency ?? Math.random() * 200 + 20,
        uptime: prev ? (prev.uptime + 30) : 30,
        healthScore: 100,
        consecutiveFailures: prev?.consecutiveFailures ?? 0,
        lastChecked: now,
        lastError: prev?.lastError ?? '',
        currentTask: agent.currentTask || '',
      }

      // 计算健康分
      md.healthScore = this.calculateHealthScore(md, agent)

      // 异常检测
      this.detectAnomalies(md, agent)

      this._monitorData[agent.id] = md
    }

    // 广播监测数据
    this.broadcast({ type: 'monitor:update', data: this._monitorData, alerts: this._alerts.slice(-50) } as any)
  }

  private calculateHealthScore(md: AgentMonitorData, agent: any): number {
    let score = 100
    // 离线扣 50
    if (md.status === 'offline') score -= 50
    if (md.status === 'error') score -= 30
    // CPU 高扣分
    if (md.cpu > 90) score -= 20
    else if (md.cpu > 70) score -= 10
    // 错误率高扣分
    if (md.errorRate > 50) score -= 25
    else if (md.errorRate > 20) score -= 10
    // 延迟高扣分
    if (md.responseLatency > 5000) score -= 15
    else if (md.responseLatency > 2000) score -= 5
    // 连续失败扣分
    if (md.consecutiveFailures > 10) score -= 20
    else if (md.consecutiveFailures > 5) score -= 10
    else if (md.consecutiveFailures > 3) score -= 5
    return Math.max(0, Math.min(100, score))
  }

  private detectAnomalies(md: AgentMonitorData, agent: any) {
    // Agent 离线（已有 onStatusChange 处理）
    // 任务超时
    if (md.currentTask && md.status === 'busy') {
      const tasks = _tasks.filter(t => t.assignedTo === md.agentId && t.status === 'in_progress')
      for (const task of tasks) {
        const elapsed = Date.now() - task.updatedAt
        if (elapsed > 300000) { // 5分钟
          this.addAlert('task_timeout', md.agentId, md.agentName, 'warning',
            `任务 "${task.title}" 已执行 ${Math.floor(elapsed/60000)} 分钟，疑似超时`)
        }
      }
    }
    // 错误率飙升
    if (md.errorRate > 30 && md.consecutiveFailures > 3) {
      this.addAlert('error_spike', md.agentId, md.agentName, 'warning',
        `错误率异常: ${md.errorRate.toFixed(1)}%，连续失败 ${md.consecutiveFailures} 次`)
    }
    // 延迟过高
    if (md.responseLatency > 10000) {
      this.addAlert('high_latency', md.agentId, md.agentName, 'info',
        `响应延迟过高: ${md.responseLatency}ms`)
    }
    // 健康度过低
    if (md.healthScore < 50) {
      this.addAlert('low_health', md.agentId, md.agentName, 'warning',
        `健康分仅 ${md.healthScore}，需关注`)
    }
    if (md.healthScore < 30) {
      this.addAlert('low_health', md.agentId, md.agentName, 'critical',
        `健康分仅 ${md.healthScore}，需人工介入`)
    }
  }

  private addAlert(type: AlertEvent['type'], agentId: string, agentName: string, severity: AlertEvent['severity'], message: string) {
    // 避免重复告警（同一类型 5 分钟内不重复）
    const recent = this._alerts.slice(-10)
    const dup = recent.find(a => a.type === type && a.agentId === agentId && (Date.now() - a.timestamp) < 300000)
    if (dup) return

    const alert: AlertEvent = {
      id: `alert-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,
      type,
      agentId,
      agentName,
      severity,
      message,
      timestamp: Date.now(),
      resolved: false,
    }
    this._alerts.push(alert)
    console.log(`[monitor] 🚨 ${severity}: ${message}`)
    this.broadcast({ type: 'monitor:alert', alert } as any)
  }

  private getMonitorSummary() {
    const agents = Object.values(this._monitorData)
    const total = agents.length
    const online = agents.filter(a => a.status === 'online' || a.status === 'busy').length
    const avgHealth = agents.length > 0
      ? Math.round(agents.reduce((s, a) => s + a.healthScore, 0) / agents.length)
      : 100
    const alerts = this._alerts
    const unresolvedAlerts = alerts.filter(a => !a.resolved).length
    const criticalAlerts = alerts.filter(a => a.severity === 'critical' && !a.resolved).length

    return {
      totalAgents: total,
      onlineAgents: online,
      offlineAgents: total - online,
      onlineRate: total > 0 ? Math.round((online / total) * 100) : 0,
      averageHealthScore: avgHealth,
      totalAlerts: alerts.length,
      unresolvedAlerts,
      criticalAlerts,
      lastUpdated: Date.now(),
    }
  }

  public stop() {
    if (this.monitorInterval) clearInterval(this.monitorInterval)
    // 停止前持久化一次
    saveData(); saveSessions()
    this.scanner.stop()
    this.pool.destroy()
    this.wss?.close()
    this.httpServer?.close()
    this.gwBridge.removeAll()
    this.clients.clear()
    this.agentConnections.clear()
    console.log('[registry] daemon stopped')
  }
}