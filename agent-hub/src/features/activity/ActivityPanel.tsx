// ============================================================
// Activity Panel — 实时活动流，加筛选、搜索
// ============================================================

import { useState, useMemo } from 'react'
import { useHubStore } from '@/lib/store'
import { ActivityFeed } from './ActivityFeed'

const EVENT_TYPES = [
  { key: 'all', label: '全部' },
  { key: 'tool_call', label: '工具调用' },
  { key: 'tool_result', label: '工具结果' },
  { key: 'thinking', label: '思考' },
  { key: 'message', label: '消息' },
  { key: 'error', label: '错误' },
  { key: 'session_start', label: '会话开始' },
  { key: 'session_end', label: '会话结束' },
]

export function ActivityPanel() {
  const { activities, agents, clearActivities } = useHubStore()
  const [filterType, setFilterType] = useState('all')
  const [filterAgent, setFilterAgent] = useState('all')
  const [searchText, setSearchText] = useState('')

  const filtered = useMemo(() => {
    return activities.filter(e => {
      if (filterType !== 'all' && e.type !== filterType) return false
      if (filterAgent !== 'all' && e.agentId !== filterAgent) return false
      if (searchText && !e.summary.toLowerCase().includes(searchText.toLowerCase())) return false
      return true
    })
  }, [activities, filterType, filterAgent, searchText])

  return (
    <div className="animate-fade-in">
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
            <span className="inline-block w-2 h-2 rounded-full bg-green-400 animate-pulse mr-2" />
            实时活动流
          </h2>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">{filtered.length}/{activities.length} 条</span>
            {activities.length > 0 && (
              <button
                onClick={clearActivities}
                className="text-xs text-gray-500 hover:text-gray-300 px-2 py-1 rounded bg-gray-800 hover:bg-gray-700"
              >
                清空
              </button>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {/* 类型筛选 */}
          <div className="flex gap-1">
            {EVENT_TYPES.map(t => (
              <button
                key={t.key}
                onClick={() => setFilterType(t.key)}
                className={`text-xs px-2 py-1 rounded-full transition-colors ${
                  filterType === t.key
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Agent 筛选 */}
          <select
            value={filterAgent}
            onChange={e => setFilterAgent(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-xs text-gray-200 focus:outline-none"
          >
            <option value="all">所有 Agent</option>
            {agents.map(a => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>

          {/* 搜索框 */}
          <input
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            placeholder="搜索事件..."
            className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-indigo-500 w-40"
          />
        </div>

        <ActivityFeed activities={filtered} />
      </div>
    </div>
  )
}