// ============================================================
// Activity Feed — real-time event stream
// Inspired by nerve's AgentLog + mission-control's activity timeline
// ============================================================

import { useHubStore } from '@/lib/store'

interface ActivityFeedProps {
  limit?: number
  activities?: any[]
}

export function ActivityFeed({ limit = 20, activities: propActivities }: ActivityFeedProps) {
  const { activities: storeActivities } = useHubStore()
  const items = (propActivities || storeActivities).slice(0, limit)

  if (items.length === 0) {
    return (
      <div className="text-center text-gray-600 py-12">
        <div className="text-2xl mb-2">📡</div>
        <p className="text-sm">等待活动事件...</p>
        <p className="text-xs mt-1">连接 Gateway 后将实时显示 Agent 活动</p>
      </div>
    )
  }

  return (
    <div className="space-y-1">
      {items.map((event) => {
        const time = new Date(event.timestamp)
        const isRecent = Date.now() - event.timestamp < 5000

        const typeConfig = {
          tool_call: { icon: '🔧', color: 'text-blue-400', bg: 'bg-blue-500/5' },
          tool_result: { icon: '✅', color: 'text-green-400', bg: 'bg-green-500/5' },
          thinking: { icon: '🤔', color: 'text-yellow-400', bg: 'bg-yellow-500/5' },
          message: { icon: '💬', color: 'text-indigo-400', bg: 'bg-indigo-500/5' },
          error: { icon: '❌', color: 'text-red-400', bg: 'bg-red-500/5' },
          session_start: { icon: '🔌', color: 'text-cyan-400', bg: 'bg-cyan-500/5' },
          session_end: { icon: '🔌', color: 'text-gray-400', bg: 'bg-gray-500/5' },
        }
        const cfg = typeConfig[event.type] || typeConfig.message

        return (
          <div
            key={event.id}
            className={`flex items-start gap-3 p-2 rounded-lg text-xs transition-all
              ${cfg.bg} ${isRecent ? 'animate-slide-in' : ''}`}
          >
            {/* Agent dot */}
            <div className="flex items-center gap-1.5 w-20 shrink-0">
              <span className={`status-dot ${event.status === 'running' ? 'busy' : event.status === 'error' ? 'error' : 'online'}`} />
              <span className="text-gray-400 truncate">{event.agentName}</span>
            </div>

            {/* Icon */}
            <span className={cfg.color}>{cfg.icon}</span>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <span className="text-gray-300">{event.summary}</span>
            </div>

            {/* Timestamp */}
            <span className="text-gray-600 shrink-0">
              {time.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          </div>
        )
      })}
    </div>
  )
}