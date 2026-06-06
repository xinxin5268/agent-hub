// ============================================================
// Meeting Room — 2×2 Agent 卡片网格会议室视图
// ============================================================

import { useCallback } from 'react'
import { useHubStore, getRegistryUrl } from '@/lib/store'
import type { AgentInfo } from '@/types'
import type { AgentRegistration } from '@/registry/protocol'

const PLATFORM_ICONS: Record<string, string> = {
  windows: '🪟',
  wsl: '🐧',
  linux: '🐧',
  macos: '🍎',
}

const ROLE_MAP: Record<string, string> = {
  xiaobao: '助理',
  xiaocong: '安全',
  hermes: '运维',
  opencode: '编码',
}

const STATUS_BORDER: Record<AgentInfo['status'], string> = {
  online: 'border-green-500/40 shadow-[0_0_12px_rgba(34,197,94,0.25)]',
  busy: 'border-yellow-500/40 shadow-[0_0_12px_rgba(245,158,11,0.25)]',
  offline: 'border-gray-600/30',
  error: 'border-red-500/40 shadow-[0_0_12px_rgba(239,68,68,0.25)]',
}

interface MeetingRoomProps {
  projectId: string
  agents?: (AgentInfo | AgentRegistration)[]
}

export function MeetingRoom({ projectId, agents: propAgents }: MeetingRoomProps) {
  const { agents: storeAgents, projects, setSelectedAgentId } = useHubStore()
  const agents = propAgents ?? storeAgents

  const project = projects.find(p => p.id === projectId)
  const onlineCount = agents.filter(a => a.status === 'online').length
  const busyCount = agents.filter(a => a.status === 'busy').length

  const getPlatformIcon = (agent: AgentInfo) => {
    const ws = agent.workspace.toLowerCase()
    if (ws.includes('windows') || ws.includes('win')) return PLATFORM_ICONS.windows
    if (ws.includes('linux') || ws.includes('main')) return PLATFORM_ICONS.linux
    if (ws.includes('mac')) return PLATFORM_ICONS.macos
    return PLATFORM_ICONS.linux
  }

  const getRole = (agent: AgentInfo) => ROLE_MAP[agent.id] || agent.model.split('/').pop() || 'Agent'

  // ── Drag & Drop: make agent cards draggable ──
  const handleDragStart = useCallback((e: React.DragEvent, agentId: string) => {
    e.dataTransfer.setData('text/agent-id', agentId)
    e.dataTransfer.effectAllowed = 'link'
    // Slight visual feedback
    const el = e.currentTarget as HTMLElement
    el.style.opacity = '0.6'
  }, [])

  const handleDragEnd = useCallback((e: React.DragEvent) => {
    const el = e.currentTarget as HTMLElement
    el.style.opacity = '1'
  }, [])

  return (
    <div className="flex flex-col h-full bg-gray-950 text-gray-100 animate-fade-in">
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-800/60">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold text-gray-200">
            {project?.name || '会议室'}
          </h2>
          {project && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-800 text-gray-400">
              {project.status}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-[11px] text-gray-500">
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
            {onlineCount} 在线
          </span>
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
            {busyCount} 忙碌
          </span>
          <span className="text-gray-600">/ {agents.length} 总计</span>
        </div>
      </div>

      {/* ── 2×2 Grid ── */}
      <div className="flex-1 p-4 overflow-y-auto">
        <div className="grid grid-cols-2 gap-3 h-full">
          {agents.slice(0, 4).map(agent => (
            <div
              key={agent.id}
              draggable
              onDragStart={(e) => handleDragStart(e, agent.id)}
              onDragEnd={handleDragEnd}
              onClick={() => setSelectedAgentId(agent.id)}
              className={`
                relative rounded-xl border p-4
                bg-gray-900/60 backdrop-blur-sm
                transition-all duration-200
                cursor-pointer
                hover:-translate-y-0.5 active:scale-[0.98]
                ${STATUS_BORDER[agent.status]}
                ${agent.status === 'busy' ? 'breathing-glow' : ''}
              `}
            >
              {/* Top row: icon + name + status */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <span className="text-lg">{getPlatformIcon(agent)}</span>
                  <div>
                    <div className="font-semibold text-sm text-gray-100">{agent.name}</div>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-800/80 text-gray-400">
                      {getRole(agent)}
                    </span>
                  </div>
                </div>
                <span className={`status-dot ${agent.status}`} />
              </div>

              {/* Audio bars (when busy/speaking) */}
              {agent.status === 'busy' && (
                <div className="flex items-center gap-2 mb-3">
                  <div className="audio-bars">
                    <span /><span /><span /><span /><span />
                  </div>
                  {agent.currentTask && (
                    <span className="text-[10px] text-yellow-400/80 truncate max-w-[140px]">
                      {agent.currentTask}
                    </span>
                  )}
                </div>
              )}

              {/* Bottom stats + 邀请按钮 */}
              <div className="flex items-center justify-between text-[10px] text-gray-500 mt-auto">
                <span>{agent.model.split('/').pop()}</span>
                <div className="flex items-center gap-1">
                  <span>{agent.sessionCount} 会话</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      // 发消息邀请 Agent 参会
                      fetch(getRegistryUrl() + '/api/messages', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          from: 'studio',
                          to: agent.id,
                          content: `邀请 ${agent.name} 加入会议室`,
                          type: 'chat',
                        }),
                      })
                    }}
                    className="ml-1 px-1.5 py-0.5 rounded bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 text-[10px] transition-colors"
                    title="邀请参会"
                  >邀请</button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {agents.length === 0 && (
          <div className="flex items-center justify-center h-full text-gray-600 text-sm">
            等待 Agent 加入会议室...
          </div>
        )}
      </div>
    </div>
  )
}
