import { useState } from 'react'
import { useHubStore, getRegistryUrl } from '@/lib/store'
import { AgentCard } from '@/features/agents/AgentCard'
import { ActivityFeed } from '@/features/activity/ActivityFeed'
import { sendCommand, checkRegistryHealth } from '@/lib/registry-api'
import type { AgentInfo } from '@/types'

export function DashboardPanel() {
  const { agents, addActivity, setActiveTab } = useHubStore()
  const online = agents.filter(a => a.status === 'online' || a.status === 'busy')
  const [showBroadcast, setShowBroadcast] = useState(false)
  const [healthResult, setHealthResult] = useState<string | null>(null)
  const [healthLoading, setHealthLoading] = useState(false)

  const handleHealthCheck = async () => {
    setHealthLoading(true)
    const result = await checkRegistryHealth()
    if (result.ok) {
      setHealthResult(`✅ 注册中心正常\nAgent 总数: ${result.data.agents || '--'}\n在线: ${result.data.online || 0}\n离线: ${result.data.offline || 0}`)
    } else {
      setHealthResult(`❌ 连接失败\n${result.error}`)
    }
    setHealthLoading(false)
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="grid grid-cols-4 gap-3">
        <StatCard label="Agent 总数" value={agents.length} icon="🤖" color="indigo" />
        <StatCard label="在线" value={online.length} icon="🟢" color="green" />
        <StatCard label="忙碌中" value={agents.filter(a => a.status === 'busy').length} icon="⏳" color="yellow" />
        <StatCard label="会话总数" value={agents.reduce((s, a) => s + a.sessionCount, 0)} icon="💬" color="cyan" />
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <h2 className="text-sm font-semibold text-gray-300 mb-3 uppercase tracking-wider">
          Agent 舰队 · 实时状态
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {agents.length > 0 ? agents.map(agent => (
            <AgentCard key={agent.id} agent={agent} compact />
          )) : (
            <div className="col-span-full text-center text-gray-500 text-sm py-8">
              暂无 Agent 数据 — 请确认注册中心 (port 3210) 是否运行
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-gray-900 border border-gray-800 rounded-xl p-4">
          <h2 className="text-sm font-semibold text-gray-300 mb-3 uppercase tracking-wider flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            实时活动流
          </h2>
          <ActivityFeed limit={8} />
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <h2 className="text-sm font-semibold text-gray-300 mb-3 uppercase tracking-wider">
            快速操作
          </h2>
          <div className="space-y-2">
            <QuickActionButton
              icon="🤖"
              label="广播指令"
              desc="向所有 Agent 发送"
              onClick={() => setShowBroadcast(true)}
            />
            <QuickActionButton
              icon="📋"
              label="新建项目"
              desc="创建协作项目"
              onClick={() => setActiveTab('projects')}
            />
            <QuickActionButton
              icon="📡"
              label="查看日志"
              desc="检查运行状态"
              onClick={handleHealthCheck}
            />
            <QuickActionButton
              icon="⚡"
              label="健康检查"
              desc="Gateway 诊断"
              onClick={handleHealthCheck}
            />
            <QuickActionButton
              icon="🚀"
              label="启动离线"
              desc="一键启动所有离线 Agent"
              onClick={async () => {
                try {
                  const resp = await fetch(getRegistryUrl() + '/api/launch-all', { method: 'POST' })
                  const data = await resp.json()
                  const ok = data.results?.filter((r: any) => r.ok).length || 0
                  addActivity({
                    id: 'launch-' + Date.now(),
                    agentId: 'dashboard',
                    agentName: '仪表盘',
                    type: 'tool_result',
                    summary: `一键启动: ${ok} 个 Agent 已启动`,
                    timestamp: Date.now(),
                  })
                } catch {}
              }}
            />
          </div>
        </div>
      </div>

      {showBroadcast && (
        <BroadcastDialog
          agents={online}
          onSend={async (content, selectedIds) => {
            let sent = 0
            let failed = 0
            for (const id of selectedIds) {
              const result = await sendCommand(id, content)
              const agent = agents.find(a => a.id === id)
              if (result.ok) {
                sent++
                addActivity({
                  id: `brd-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                  agentId: id,
                  agentName: agent?.name || id,
                  type: 'message',
                  summary: `[广播] ${content}`,
                  timestamp: Date.now(),
                })
              } else {
                failed++
              }
            }
            if (sent > 0) {
              addActivity({
                id: `brd-done-${Date.now()}`,
                agentId: 'hub',
                agentName: 'Hub',
                type: 'message',
                summary: `广播完成: ${sent} 成功, ${failed} 失败`,
                timestamp: Date.now(),
              })
            }
            setShowBroadcast(false)
          }}
          onClose={() => setShowBroadcast(false)}
        />
      )}

      {healthResult && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setHealthResult(null)}>
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-96 shadow-2xl animate-fade-in" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-gray-100 mb-4">健康检查</h3>
            {healthLoading ? (
              <div className="flex items-center gap-2 text-gray-400 text-sm">
                <span className="w-4 h-4 border-2 border-gray-400/30 border-t-gray-400 rounded-full animate-spin-slow" />
                检查中...
              </div>
            ) : (
              <>
                <pre className="text-sm text-gray-300 whitespace-pre-wrap font-mono leading-relaxed mb-4">{healthResult}</pre>
                <button
                  onClick={() => setHealthResult(null)}
                  className="w-full bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg py-2 text-sm transition-colors"
                >
                  关闭
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, icon, color }: { label: string; value: number; icon: string; color: string }) {
  const colors: Record<string, string> = {
    indigo: 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400',
    green: 'bg-green-500/10 border-green-500/30 text-green-400',
    yellow: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400',
    cyan: 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400',
  }
  return (
    <div className={`rounded-xl border p-3 transition-all duration-200 hover:scale-[1.02] ${colors[color] || colors.indigo}`}>
      <div className="flex items-center justify-between">
        <span className="text-lg">{icon}</span>
        <span className="text-2xl font-bold">{value}</span>
      </div>
      <div className="text-xs mt-1 opacity-80">{label}</div>
    </div>
  )
}

function QuickActionButton({ icon, label, desc, onClick }: { icon: string; label: string; desc: string; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 bg-gray-800 hover:bg-gray-700 rounded-lg p-3 transition-all duration-200 active:scale-[0.98] text-left group"
    >
      <span className="text-lg transition-transform duration-200 group-hover:scale-110">{icon}</span>
      <div>
        <div className="text-sm font-medium text-gray-200">{label}</div>
        <div className="text-xs text-gray-500">{desc}</div>
      </div>
    </button>
  )
}

function BroadcastDialog({
  agents,
  onSend,
  onClose,
}: {
  agents: AgentInfo[]
  onSend: (content: string, selectedIds: string[]) => void
  onClose: () => void
}) {
  const [content, setContent] = useState('')
  const [selected, setSelected] = useState<Record<string, boolean>>(
    Object.fromEntries(agents.map(a => [a.id, true]))
  )
  const [sending, setSending] = useState(false)

  const toggle = (id: string) => setSelected(prev => ({ ...prev, [id]: !prev[id] }))
  const selectedIds = agents.filter(a => selected[a.id]).map(a => a.id)

  const handleSend = async () => {
    if (!content.trim() || selectedIds.length === 0) return
    setSending(true)
    await onSend(content, selectedIds)
    setSending(false)
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-96 shadow-2xl animate-fade-in">
        <h2 className="text-xl font-bold text-gray-100 mb-1">广播指令</h2>
        <p className="text-sm text-gray-400 mb-4">向在线 Agent 发送指令</p>

        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder="输入指令内容..."
          rows={4}
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100
            focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none mb-4"
        />

        <div className="mb-4">
          <label className="text-xs text-gray-500 block mb-2">在线 Agent</label>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {agents.length > 0 ? agents.map(agent => (
              <label key={agent.id} className="flex items-center gap-2 bg-gray-800 rounded-lg px-3 py-2 cursor-pointer hover:bg-gray-700 transition-colors">
                <input
                  type="checkbox"
                  checked={selected[agent.id] ?? true}
                  onChange={() => toggle(agent.id)}
                  className="rounded bg-gray-800 border-gray-600"
                />
                <span className="text-sm text-gray-200">{agent.name}</span>
                <span className="text-xs text-gray-500 ml-auto">{agent.id}</span>
              </label>
            )) : (
              <p className="text-xs text-gray-500 text-center py-4">暂无在线 Agent</p>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleSend}
            disabled={!content.trim() || selectedIds.length === 0 || sending}
            className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed
              text-white rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 active:scale-[0.98] flex items-center justify-center gap-1.5"
          >
            {sending ? (
              <><span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin-slow" /> 发送中...</>
            ) : '发送'}
          </button>
          <button
            onClick={onClose}
            disabled={sending}
            className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg px-4 py-2 text-sm transition-colors disabled:opacity-40"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  )
}
