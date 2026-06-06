// ============================================================
// Agent Card — individual agent status card
// ============================================================

import type { AgentInfo } from '@/types'
import { useHubStore } from '@/lib/store'
import { SkillsRadar } from './SkillsRadar'

interface AgentCardProps {
  agent: AgentInfo
  compact?: boolean
}

export function AgentCard({ agent, compact }: AgentCardProps) {
  const { setSelectedAgentId } = useHubStore()
  const statusColors = {
    online: 'border-green-500/30 bg-green-500/5',
    busy: 'border-yellow-500/30 bg-yellow-500/5',
    offline: 'border-gray-600/30 bg-gray-800/50',
    error: 'border-red-500/30 bg-red-500/5',
  }

  const formatUptime = (s: number) => {
    const h = Math.floor(s / 3600)
    if (h > 24) return `${Math.floor(h / 24)}d`
    return `${h}h`
  }

  if (compact) {
    return (
      <div
        onClick={() => setSelectedAgentId(agent.id)}
        className={`rounded-lg border p-3 cursor-pointer transition-all hover:scale-[1.02] ${statusColors[agent.status]}`}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className={`status-dot ${agent.status}`} />
            <span className="font-medium text-sm text-gray-100">{agent.name}</span>
          </div>
          {agent.status === 'busy' && (
            <div className="audio-bars">
              <span /><span /><span /><span /><span />
            </div>
          )}
        </div>
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>{agent.model.split('/').pop()}</span>
          <span>{agent.sessionCount} 会话</span>
        </div>
        {agent.skills && agent.skills.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {agent.skills.slice(0, 2).map(s => (
              <span key={s} className="text-[9px] px-1.5 py-0.5 rounded-full bg-indigo-600/20 text-indigo-400 border border-indigo-500/20">
                {s}
              </span>
            ))}
          </div>
        )}
        {agent.currentTask && (
          <div className="mt-1.5 text-xs text-yellow-400/80 truncate">
            ⏳ {agent.currentTask}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className={`rounded-xl border p-4 ${statusColors[agent.status]}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <span className={`status-dot ${agent.status}`} />
          <div>
            <div className="font-semibold text-gray-100">{agent.name}</div>
            <div className="text-xs text-gray-500">{agent.model}</div>
          </div>
        </div>
        <div className="text-right text-xs text-gray-500">
          <div>↑ {formatUptime(agent.uptime)}</div>
          <div>{agent.toolsUsed} tools</div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        <div className="bg-gray-800/50 rounded-lg p-2">
          <div className="text-gray-300 font-medium">{agent.sessionCount}</div>
          <div className="text-gray-500">会话</div>
        </div>
        <div className="bg-gray-800/50 rounded-lg p-2">
          <div className="text-gray-300 font-medium">{agent.toolsUsed}</div>
          <div className="text-gray-500">工具调用</div>
        </div>
        <div className="bg-gray-800/50 rounded-lg p-2">
          <div className="text-gray-300 font-medium">{formatUptime(agent.uptime)}</div>
          <div className="text-gray-500">运行时间</div>
        </div>
      </div>
      {agent.skills && agent.skills.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {agent.skills.slice(0, 4).map(s => (
            <span key={s} className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-600/15 text-indigo-400 border border-indigo-500/20">
              {s}
            </span>
          ))}
          {agent.skills.length > 4 && (
            <span className="text-[10px] text-gray-500">+{agent.skills.length - 4}</span>
          )}
        </div>
      )}
      {/* 能力雷达图 */}
      {agent.skills && agent.skills.length > 0 && (
        <div className="mt-3">
          <SkillsRadar skills={agent.skills} />
        </div>
      )}
      {agent.currentTask && (
        <div className="mt-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-2 text-xs text-yellow-400">
          ⏳ 正在执行: {agent.currentTask}
        </div>
      )}
    </div>
  )
}