// ============================================================
// Agent Pool — 注册表管理
// 管理所有注册 Agent 的生命周期 + 持久化 + 远程启动
// ============================================================

import { type AgentRegistration, type CommandRequest, type CommandResponse } from './protocol'
import { execSync, spawn } from 'child_process'
import path from 'path'
import fs from 'fs'

const DATA_DIR = process.env.HUB_DATA_DIR || path.resolve(process.env.HOME || '~', '.openclaw/workspace/agent-hub/data')
const AGENTS_DB = path.join(DATA_DIR, 'agents.json')

export class AgentPool {
  private agents = new Map<string, AgentRegistration>()
  private heartbeatTimers = new Map<string, ReturnType<typeof setTimeout>>()
  private healthCheckInterval: ReturnType<typeof setInterval> | null = null

  /** Agent 状态变更回调 */
  onStatusChange?: (agentId: string, status: string, agent: AgentRegistration) => void
  /** Agent 注册回调 */
  onRegistered?: (agent: AgentRegistration) => void
  /** Agent 注销回调 */
  onUnregistered?: (agentId: string) => void

  constructor() {
    this.loadPersistedAgents()
    this.startHealthCheck()
  }

  // ─── 持久化 ──────────────────────────────────────────

  private persistPath(): string {
    fs.mkdirSync(path.dirname(AGENTS_DB), { recursive: true })
    return AGENTS_DB
  }

  private save() {
    try {
      const data = JSON.stringify(this.getAllAgents(), null, 2)
      fs.writeFileSync(this.persistPath(), data, 'utf-8')
    } catch (e: any) {
      console.error('[pool] persist error:', e.message)
    }
  }

  private loadPersistedAgents() {
    try {
      if (!fs.existsSync(AGENTS_DB)) return
      const raw = fs.readFileSync(AGENTS_DB, 'utf-8')
      const list: AgentRegistration[] = JSON.parse(raw)
      for (const agent of list) {
        // 加载时全部标记为 offline（心跳会重新标记 online）
        agent.status = 'offline'
        agent.lastHeartbeat = 0
        this.agents.set(agent.id, agent)
      }
      console.log(`[pool] loaded ${list.length} agents from ${AGENTS_DB}`)
    } catch (e: any) {
      console.error('[pool] load error:', e.message)
    }
  }

  // ─── 核心操作 ────────────────────────────────────────

  register(agent: AgentRegistration): { ok: boolean; error?: string } {
    if (!agent.id || !agent.wsUrl) {
      return { ok: false, error: 'agent.id and agent.wsUrl are required' }
    }

    const existing = this.agents.get(agent.id)
    const wasOffline = existing?.status === 'offline' || !existing

    // 保留 launchPath 和 launchCommand（如果新注册没传就用旧的）
    if (existing) {
      agent.launchPath = agent.launchPath || existing.launchPath
      agent.launchCommand = agent.launchCommand || existing.launchCommand
    }

    agent.lastHeartbeat = Date.now()
    agent.registeredAt = existing?.registeredAt || Date.now()

    // Agent 注册时自动匹配技能（如果还没有技能声明）
    if (!agent.skills || agent.skills.length === 0) {
      agent.skills = this.autoMatchSkills(agent)
    }

    this.agents.set(agent.id, agent)
    this.save() // 每次注册持久化

    // Setup heartbeat timeout
    this.resetHeartbeatTimer(agent.id)

    if (wasOffline) {
      this.onRegistered?.(agent)
      this.onStatusChange?.(agent.id, 'online', agent)
    }

    console.log(`[pool] registered: ${agent.name} (${agent.id}) at ${agent.wsUrl}`)
    return { ok: true }
  }

  unregister(agentId: string) {
    const agent = this.agents.get(agentId)
    if (!agent) return

    this.clearHeartbeatTimer(agentId)
    // 不删除，标记为 offline 保留 launchPath
    agent.status = 'offline'
    this.save()
    this.onUnregistered?.(agentId)
    this.onStatusChange?.(agentId, 'offline', agent)
    console.log(`[pool] unregistered: ${agentId}`)
  }

  heartbeat(agentId: string): boolean {
    const agent = this.agents.get(agentId)
    if (!agent) return false

    agent.lastHeartbeat = Date.now()
    agent.status = 'online'
    this.resetHeartbeatTimer(agentId)
    return true
  }

  markOffline(agentId: string) {
    const agent = this.agents.get(agentId)
    if (!agent) return
    agent.status = 'offline'
    this.save()
    this.onStatusChange?.(agentId, 'offline', agent)
  }

  getAgent(agentId: string): AgentRegistration | undefined {
    return this.agents.get(agentId)
  }

  getAllAgents(): AgentRegistration[] {
    return Array.from(this.agents.values())
  }

  getAgentsByType(type: string): AgentRegistration[] {
    return this.getAllAgents().filter(a => a.type === type)
  }

  getOnlineAgents(): AgentRegistration[] {
    return this.getAllAgents().filter(a => a.status === 'online')
  }

  // ─── 远程启动 Agent ─────────────────────────────────

  /**
   * 启动离线 Agent
   * 如果 Agent 有 launchPath 或 launchCommand，执行它
   * 如果是 Windows Agent，尝试通过 powershell 远程启动
   */
  launchAgent(agentId: string): { ok: boolean; error?: string; detail?: string } {
    const agent = this.agents.get(agentId)
    if (!agent) return { ok: false, error: 'agent not found' }

    if (agent.status === 'online') return { ok: true, detail: 'already online' }

    // 优先用 launchCommand
    if (agent.launchCommand) {
      try {
        const cwd = agent.cwd || undefined
        const child = spawn(agent.launchCommand, {
          cwd,
          shell: true,
          stdio: 'ignore',
          detached: true,
        })
        child.unref()
        console.log(`[pool] launched agent ${agentId} with command: ${agent.launchCommand}`)
        return { ok: true, detail: `launched: ${agent.launchCommand}` }
      } catch (e: any) {
        return { ok: false, error: `launch failed: ${e.message}` }
      }
    }

    // 次优用 launchPath
    if (agent.launchPath) {
      try {
        if (fs.existsSync(agent.launchPath)) {
          const child = spawn(agent.launchPath, [], {
            cwd: agent.cwd || path.dirname(agent.launchPath),
            shell: true,
            stdio: 'ignore',
            detached: true,
          })
          child.unref()
          return { ok: true, detail: `launched: ${agent.launchPath}` }
        }
        return { ok: false, error: `launchPath not found: ${agent.launchPath}` }
      } catch (e: any) {
        return { ok: false, error: `launch failed: ${e.message}` }
      }
    }

    // 如果是 Windows Agent，尝试通过 PowerShell 远程启动
    if (agent.platform === 'windows' && agent.host) {
      try {
        const psCmd = `powershell.exe -Command "Start-Process -FilePath 'C:\\Users\\Administrator\\AppData\\Roaming\\npm\\opencode.cmd' -ArgumentList 'serve','--port','0','--hostname','0.0.0.0','--mdns' -WindowStyle Hidden"`
        execSync(psCmd, { timeout: 10000 })
        return { ok: true, detail: `remote launch attempted via powershell: ${agent.host}` }
      } catch (e: any) {
        return { ok: false, error: `remote launch failed: ${e.message}` }
      }
    }

    return { ok: false, error: 'no launch path or command configured for this agent' }
  }

  /** 启动所有离线 Agent */
  launchAllOffline(): { ok: boolean; results: Array<{ id: string; ok: boolean; error?: string }> } {
    const offline = this.getAllAgents().filter(a => a.status === 'offline')
    const results = offline.map(a => {
      const r = this.launchAgent(a.id)
      return { id: a.id, ok: r.ok, error: r.error }
    })
    return { ok: results.some(r => r.ok), results }
  }

  // ─── 主动健康检查 ──────────────────────────────────

  /** 启动主动健康检查（每 30 秒 ping 一次所有在线 Agent） */
  startHealthCheck() {
    if (this.healthCheckInterval) return
    console.log('[pool] starting health check (30s interval)')
    this.healthCheckInterval = setInterval(() => {
      this.checkAllAgents()
    }, 30_000)
  }

  stopHealthCheck() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval)
      this.healthCheckInterval = null
    }
  }

  /** 检查所有在线 Agent 的健康状态 */
  private async checkAllAgents() {
    const online = this.getAllAgents().filter(a => a.status === 'online' || a.status === 'busy')
    for (const agent of online) {
      await this.pingAgent(agent)
    }
  }

  /** Ping 单个 Agent，如果无响应标记离线 */
  private async pingAgent(agent: AgentRegistration) {
    // 如果是 WS 连接的 Agent，尝试发送 ping 帧
    if (agent.wsUrl) {
      // WS ping 由 daemon.ts 的 WebSocket 层处理
      // 这里做 HTTP 兜底检测
      const httpUrl = agent.httpUrl || `http://${agent.host}:${agent.port}`
      try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 5000)
        const resp = await fetch(httpUrl, { method: 'HEAD', signal: controller.signal })
        clearTimeout(timeout)
        if (resp.ok) {
          // 在线，更新心跳
          agent.lastHeartbeat = Date.now()
          return
        }
      } catch {
        // HTTP 不通，尝试 WS ping
        // 如果 WS 也不通，30 秒后 heartbeat timer 会标记离线
        console.log(`[pool] health check: ${agent.id} HTTP unreachable, waiting for WS heartbeat`)
      }
    }
  }

  /** 手动触发健康检查并返回结果 */
  async runHealthCheck(): Promise<{
    checked: number
    online: number
    offline: number
    details: Array<{ id: string; name: string; status: string }>
  }> {
    const all = this.getAllAgents()
    const details: Array<{ id: string; name: string; status: string }> = []
    for (const agent of all) {
      if (agent.status === 'online' || agent.status === 'busy') {
        await this.pingAgent(agent)
      }
      details.push({ id: agent.id, name: agent.name, status: agent.status })
    }
    return {
      checked: all.length,
      online: all.filter(a => a.status === 'online').length,
      offline: all.filter(a => a.status === 'offline').length,
      details,
    }
  }

  // ─── 内部方法 ────────────────────────────────────────

  private resetHeartbeatTimer(agentId: string) {
    this.clearHeartbeatTimer(agentId)
    const timer = setTimeout(() => {
      this.markOffline(agentId)
    }, 90_000) // 90s 无心跳标记离线
    this.heartbeatTimers.set(agentId, timer)
  }

  private clearHeartbeatTimer(agentId: string) {
    const timer = this.heartbeatTimers.get(agentId)
    if (timer) {
      clearTimeout(timer)
      this.heartbeatTimers.delete(agentId)
    }
  }

  getStats() {
    const all = this.getAllAgents()
    return {
      total: all.length,
      online: all.filter(a => a.status === 'online').length,
      busy: all.filter(a => a.status === 'busy').length,
      offline: all.filter(a => a.status === 'offline').length,
      byType: {
        opencode: all.filter(a => a.type === 'opencode').length,
        'openclaw-gateway': all.filter(a => a.type === 'openclaw-gateway').length,
        custom: all.filter(a => a.type === 'custom').length,
      },
      byPlatform: {
        windows: all.filter(a => a.platform === 'windows').length,
        wsl: all.filter(a => a.platform === 'wsl').length,
        linux: all.filter(a => a.platform === 'linux').length,
      },
    }
  }

  /** 根据 Agent 的 name/type/tags/capabilities 自动匹配技能 */
  private autoMatchSkills(agent: AgentRegistration): string[] {
    const skills: string[] = []
    const text = `${agent.name} ${agent.type} ${agent.platform} ${Object.values(agent.tags || {}).join(' ')} ${(agent.capabilities || []).join(' ')}`.toLowerCase()

    // 基于 Agent 类型匹配技能
    const skillMap: Array<{ keywords: string[]; skill: string }> = [
      { keywords: ['xiaobao', 'ceo', '小宝', 'master'], skill: 'ceo-agent' },
      { keywords: ['xiaocong', '小聪', 'cong'], skill: 'assistant-agent' },
      { keywords: ['opencode', 'coder', 'codex'], skill: 'coding-agent' },
      { keywords: ['千问', 'qianwen', 'a3'], skill: 'research-agent' },
      { keywords: ['openclaw-gateway', 'gateway'], skill: 'gateway-agent' },
      { keywords: ['opencode'], skill: 'code-review' },
      { keywords: ['opencode'], skill: 'debugging' },
    ]

    // 基于 capabilities 匹配
    if (agent.capabilities) {
      const capSkillMap: Record<string, string[]> = {
        'code': ['code-review', 'debugging', 'coding-agent'],
        'research': ['research-agent', 'deep-research'],
        'chat': ['assistant-agent'],
        'vision': ['vision-agent'],
        'voice': ['voice-agent'],
        'browse': ['browsing-agent'],
        'tools': ['tool-use-agent'],
      }
      for (const cap of agent.capabilities) {
        const mapped = capSkillMap[cap.toLowerCase()]
        if (mapped) skills.push(...mapped)
      }
    }

    // 关键词匹配
    for (const { keywords, skill } of skillMap) {
      for (const kw of keywords) {
        if (text.includes(kw)) {
          skills.push(skill)
          break
        }
      }
    }

    // 去重
    return [...new Set(skills)]
  }

  destroy() {
    this.save()
    for (const timer of this.heartbeatTimers.values()) {
      clearTimeout(timer)
    }
    this.heartbeatTimers.clear()
    this.agents.clear()
  }
}