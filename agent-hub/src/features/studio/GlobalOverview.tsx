// ============================================================
// Global Overview — dashboard stats, agent list, activity stream
// 加了快速操作入口：创建项目、启动离线Agent、查看所有Agent
// ============================================================

import { useMemo, useState } from 'react'
import { Activity, Users, FolderKanban, MessageSquare, PlusCircle, Play, List } from 'lucide-react'
import { useHubStore, getRegistryUrl } from '@/lib/store'
import type { AgentInfo, ActivityEvent } from '@/types'

export function GlobalOverview() {
  const { agents, projects, activities, setSelectedAgentId, setActiveTab } = useHubStore()
  const [launching, setLaunching] = useState(false)
  const [launchResult, setLaunchResult] = useState<string | null>(null)

  const stats = useMemo(() => ({
    totalAgents: agents.length,
    onlineAgents: agents.filter(a => a.status === 'online' || a.status === 'busy').length,
    totalProjects: projects.length,
    totalMessages: activities.filter(a => a.type === 'message').length,
  }), [agents, projects, activities])

  const offlineCount = agents.filter(a => a.status === 'offline').length

  const recentActivities = useMemo(() => activities.slice(0, 10), [activities])

  const formatTime = (ts: number) => {
    const diff = Date.now() - ts
    if (diff < 60000) return '刚刚'
    if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`
    return new Date(ts).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  }

  const statusColor: Record<AgentInfo['status'], string> = {
    online: 'bg-green-500',
    busy: 'bg-yellow-500',
    offline: 'bg-gray-600',
    error: 'bg-red-500',
  }

  const activityIcon: Record<ActivityEvent['type'], string> = {
    tool_call: '🔧',
    tool_result: '✅',
    thinking: '🤔',
    message: '💬',
    error: '❌',
    session_start: '🔌',
    session_end: '🔌',
  }

  // 一键启动所有离线 Agent
  const handleLaunchAll = async () => {
    setLaunching(true)
    setLaunchResult(null)
    try {
      const resp = await fetch(`${getRegistryUrl()}/api/launch-all`, { method: 'POST' })
      const data = await resp.json()
      const ok = data.results?.filter((r: any) => r.ok).length || 0
      const fail = data.results?.filter((r: any) => !r.ok).length || 0
      setLaunchResult(`✅ ${ok} 个已启动, ${fail} 个失败`)
    } catch {
      setLaunchResult('❌ 启动失败: 连接超时')
    }
    setLaunching(false)
    setTimeout(() => setLaunchResult(null), 5000)
  }

  return (
    <div className="animate-fade-in space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Agent 总数', value: stats.totalAgents, icon: Users, color: 'text-blue-400' },
          { label: '在线', value: stats.onlineAgents, icon: Activity, color: 'text-green-400' },
          { label: '项目', value: stats.totalProjects, icon: FolderKanban, color: 'text-purple-400' },
          { label: '消息', value: stats.totalMessages, icon: MessageSquare, color: 'text-cyan-400' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-500">{label}</span>
              <Icon className={`w-4 h-4 ${color}`} />
            </div>
            <div className="text-2xl font-bold text-gray-100">{value}</div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
        <h3 className="text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
          <Play className="w-4 h-4" />
          快速操作
        </h3>
        <div className="grid grid-cols-3 gap-3">
          <button
            onClick={() => setActiveTab('projects')}
            className="flex items-center gap-2 bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 rounded-lg p-3 transition-colors text-left"
          >
            <PlusCircle className="w-5 h-5 text-indigo-400" />
            <div>
              <div className="text-sm font-medium text-gray-200">新建项目</div>
              <div className="text-xs text-gray-500">创建协作项目</div>
            </div>
          </button>

          <button
            onClick={handleLaunchAll}
            disabled={launching || offlineCount === 0}
            className="flex items-center gap-2 bg-green-600/20 hover:bg-green-600/30 border border-green-500/30 rounded-lg p-3 transition-colors text-left disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Play className="w-5 h-5 text-green-400" />
            <div>
              <div className="text-sm font-medium text-gray-200">启动离线 Agent</div>
              <div className="text-xs text-gray-500">{offlineCount > 0 ? `${offlineCount} 个离线` : '全部在线'}</div>
            </div>
          </button>

          <button
            onClick={() => setActiveTab('agents')}
            className="flex items-center gap-2 bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-500/30 rounded-lg p-3 transition-colors text-left"
          >
            <List className="w-5 h-5 text-cyan-400" />
            <div>
              <div className="text-sm font-medium text-gray-200">Agent 管理</div>
              <div className="text-xs text-gray-500">查看全部 Agent</div>
            </div>
          </button>
        </div>
        {launchResult && (
          <div className="mt-2 text-xs text-gray-400">{launchResult}</div>
        )}
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Agent List */}
        <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
          <h3 className="text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
            <Users className="w-4 h-4" />
            所有 Agent
          </h3>
          <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1 scrollbar-thin">
            {agents.length === 0 ? (
              <p className="text-xs text-gray-600 text-center py-4">暂无 Agent</p>
            ) : (
              agents.map(agent => (
                <div
                  key={agent.id}
                  onClick={() => setSelectedAgentId(agent.id)}
                  className="flex items-center justify-between p-2 rounded-lg bg-gray-700/30 hover:bg-gray-700/50 cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`w-2 h-2 rounded-full ${statusColor[agent.status]}`} />
                    <span className="text-sm text-gray-200 truncate">{agent.name}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-500 shrink-0">
                    <span>{agent.model.split('/').pop()}</span>
                    <span>{agent.sessionCount}会话</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Activity Stream */}
        <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
          <h3 className="text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
            <Activity className="w-4 h-4" />
            最近活动
          </h3>
          <div className="space-y-1.5 max-h-[320px] overflow-y-auto pr-1 scrollbar-thin">
            {recentActivities.length === 0 ? (
              <p className="text-xs text-gray-600 text-center py-4">暂无活动</p>
            ) : (
              recentActivities.map(event => (
                <div
                  key={event.id}
                  className="flex items-center gap-2 p-1.5 rounded text-xs"
                >
                  <span>{activityIcon[event.type]}</span>
                  <span className="text-gray-400 w-16 truncate shrink-0">{event.agentName}</span>
                  <span className="text-gray-300 flex-1 truncate">{event.summary}</span>
                  <span className="text-gray-600 shrink-0">{formatTime(event.timestamp)}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}