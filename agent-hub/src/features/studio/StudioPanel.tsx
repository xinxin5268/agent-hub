// ============================================================
// Studio Panel — 工作室主面板（三栏布局）
// 左侧: ProjectList | 中间: MeetingRoom + MessageStream | 右侧: AgentDetail
// ============================================================

import { useEffect, useState, useCallback, useRef } from 'react'
import { useHubStore } from '@/lib/store'
import { ProjectList } from './ProjectList'
import { MeetingRoom } from './MeetingRoom'
import { MessageStream } from './MessageStream'
import { AgentDetail } from './AgentDetail'
import { GlobalOverview } from './GlobalOverview'
import { Wifi, WifiOff } from 'lucide-react'
import type { AgentRegistration } from '@/registry/protocol'

export function StudioPanel() {
  const {
    agents,
    projects,
    connected,
    selectedAgentId,
    setSelectedAgentId,
    setAgents,
    updateAgent,
    setConnected,
  } = useHubStore()

  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const wsRef = useRef<WebSocket | null>(null)

  const selectedProject = projects.find(p => p.id === selectedProjectId)
  const selectedAgent = agents.find(a => a.id === selectedAgentId) ?? null

  // ── Connect to registry WebSocket for real-time agent data ──
  useEffect(() => {
    const REGISTRY_WS = 'ws://127.0.0.1:3210/ws'
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null
    let mounted = true

    function connect() {
      if (!mounted) return
      console.log('[studio] connecting to registry ws...')
      const ws = new WebSocket(REGISTRY_WS)
      wsRef.current = ws

      ws.onopen = () => {
        console.log('[studio] registry ws connected')
        if (mounted) setConnected(true)
      }

      ws.onmessage = (event) => {
        if (!mounted) return
        try {
          const data = JSON.parse(event.data)
          if (data.type === 'registry:state') {
            // Full state sync — replace agents
            if (Array.isArray(data.agents) && data.agents.length > 0) {
              const mapped = data.agents.map((a: AgentRegistration) => ({
                id: a.id,
                name: a.name,
                status: a.status || 'offline',
                model: (a.models && a.models[0]) || a.type || '--',
                workspace: a.platform || '',
                lastActive: a.lastHeartbeat || Date.now(),
                sessionCount: 0,
                toolsUsed: 0,
                uptime: 0,
                currentTask: undefined,
                skills: a.skills || [],
              }))
              if (mounted) setAgents(mapped)
            }
          } else if (data.type === 'agent:status') {
            if (mounted) updateAgent(data.agentId, { status: data.status })
          } else if (data.type === 'agent:registered' || data.type === 'agent:heartbeat') {
            if (mounted && data.agent) {
              const current = useHubStore.getState().agents
              const exists = current.find(a => a.id === data.agent.id)
              if (exists) {
                updateAgent(data.agent.id, { status: 'online', lastActive: Date.now() })
              } else {
                setAgents([...current, {
                  id: data.agent.id,
                  name: data.agent.name,
                  status: 'online',
                  model: (data.agent.models?.[0]) || data.agent.type || '--',
                  workspace: data.agent.platform || '',
                  lastActive: Date.now(),
                  sessionCount: 0,
                  toolsUsed: 0,
                  uptime: 0,
                  skills: data.agent.skills || [],
                }])
              }
            }
          } else if (data.type === 'agent:message' && data.message) {
            // Forward incoming message to MessageStream via CustomEvent
            const msg = data.message
            window.dispatchEvent(new CustomEvent('message-stream:add', {
              detail: {
                id: msg.id,
                from: msg.from,
                to: msg.to,
                content: msg.content,
                type: msg.type === 'broadcast' ? 'broadcast' : 'chat',
                timestamp: msg.timestamp,
              }
            }))
          }
        } catch (e) {
          console.error('[studio] ws parse error:', e)
        }
      }

      ws.onclose = () => {
        console.log('[studio] registry ws closed')
        if (mounted) {
          setConnected(false)
          reconnectTimer = setTimeout(connect, 3000)
        }
      }

      ws.onerror = (e) => {
        console.error('[studio] registry ws error:', e)
        ws.close()
      }

      ws.onerror = () => {
        console.warn('[studio] registry ws error')
      }
    }

    connect()

    return () => {
      mounted = false
      if (reconnectTimer) clearTimeout(reconnectTimer)
      if (wsRef.current) {
        wsRef.current.onclose = null
        wsRef.current.close()
        wsRef.current = null
      }
    }
  }, [setConnected, setAgents, updateAgent])

  // ── handle agent detail command ──
  const handleCommand = useCallback((agentId: string, command: string) => {
    window.dispatchEvent(new CustomEvent('studio:command', { detail: { agentId, command } }))
  }, [])

  // ── Ctrl+N 新建项目 ──
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault()
        window.dispatchEvent(new CustomEvent('studio:new-project'))
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <div className="flex flex-col h-full bg-gray-950 text-gray-100 overflow-hidden">

      {/* ═══════════ TOP BAR ═══════════ */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800/60 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-200">
            {selectedProject?.name ?? 'Agent Hub'}
          </span>
          {selectedProject && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-800 text-gray-400">
              {selectedProject.status}
            </span>
          )}
        </div>
        <span className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full ${
          connected ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
        }`}>
          {connected ? <Wifi size={10} /> : <WifiOff size={10} />}
          {connected ? '已连接' : '断开'}
        </span>
      </div>

      {/* ═══════════ MAIN: THREE COLUMN ═══════════ */}
      <div className="flex flex-1 min-h-0">

        {/* ── LEFT: ProjectList ── */}
        <div className="w-56 shrink-0">
          <ProjectList
            selectedProjectId={selectedProjectId}
            onSelectProject={setSelectedProjectId}
          />
        </div>

        {/* ── CENTER: MeetingRoom (top) + MessageStream (bottom) ── */}
        <div className="flex-1 flex flex-col min-w-0 border-r border-gray-800/60">
          {selectedProjectId ? (
            <>
              <div className="flex-1 min-h-0">
                <MeetingRoom projectId={selectedProjectId} />
              </div>
            </>
          ) : (
            <div className="flex-1 min-h-0">
              <GlobalOverview />
            </div>
          )}
          {/* 消息流始终显示在下方 — 全局共享会话 */}
          <div className="flex-[2] min-h-0 border-t border-gray-800/60">
            <MessageStream wsRef={wsRef} />
          </div>
        </div>

        {/* ── RIGHT: AgentDetail (conditional, w-80) ── */}
        {selectedAgent && (
          <div className="w-80 shrink-0">
            <AgentDetail
              agent={selectedAgent as any}
              onClose={() => setSelectedAgentId(null)}
              onSendMessage={() => {}}
              onCommand={handleCommand}
            />
          </div>
        )}
      </div>
    </div>
  )
}
