import { useState } from 'react'
import { useHubStore, getRegistryUrl } from '@/lib/store'
import { AgentCard } from './AgentCard'
import { sendCommand, checkRegistryHealth } from '@/lib/registry-api'
import type { AgentInfo } from '@/types'

export function AgentsPanel() {
  const { agents, selectedAgentId, setSelectedAgentId, addActivity, setActiveTab } = useHubStore()
  const selected = agents.find(a => a.id === selectedAgentId)
  const [filter, setFilter] = useState('all')
  const [showSendForm, setShowSendForm] = useState(false)
  const [sendTarget, setSendTarget] = useState(selectedAgentId ?? '')
  const [sendMessage, setSendMessage] = useState('')
  const [toast, setToast] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [showLogModal, setShowLogModal] = useState(false)
  const [logContent, setLogContent] = useState('')
  const [sessionModal, setSessionModal] = useState<AgentInfo | null>(null)

  const filtered = filter === 'all' ? agents : agents.filter(a => a.status === filter)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  const handleSend = async () => {
    if (!sendMessage.trim() || !sendTarget) return
    setSending(true)
    const result = await sendCommand(sendTarget, sendMessage.trim())
    const target = agents.find(a => a.id === sendTarget)
    if (result.ok) {
      addActivity({
        id: `cmd-${Date.now()}`,
        agentId: sendTarget,
        agentName: target?.name || sendTarget,
        type: 'message',
        summary: `[指令] ${sendMessage.trim()}`,
        timestamp: Date.now(),
      })
      showToast(`指令已发送到 ${target?.name || sendTarget}`)
      setSendMessage('')
      setShowSendForm(false)
    } else {
      showToast(`发送失败: ${result.error || '连接超时'}`)
    }
    setSending(false)
  }

  const handleHealthCheck = async () => {
    const result = await checkRegistryHealth()
    if (result.ok) {
      setLogContent(`健康检查通过\nAgent 数: ${result.data.agents}\n在线: ${result.data.online}\n离线: ${result.data.offline}`)
    } else {
      setLogContent(`健康检查失败\n${result.error}`)
    }
    setShowLogModal(true)
  }

  const handleViewLogs = () => {
    const logs = agents.map(a =>
      `[${a.status.toUpperCase()}] ${a.name} (${a.id})\n  模型: ${a.model}\n  会话: ${a.sessionCount}\n  运行: ${Math.floor(a.uptime / 3600)}h\n  最后活跃: ${new Date(a.lastActive).toLocaleString('zh-CN')}`
    ).join('\n\n')
    setLogContent(logs || '暂无 Agent 数据')
    setShowLogModal(true)
  }

  const handleViewSessions = (agent: AgentInfo) => {
    setSessionModal(agent)
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 animate-fade-in">
      <div className="lg:col-span-2 space-y-4">
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <span className="text-gray-500">筛选:</span>
          {[
            { key: 'all', label: '全部' },
            { key: 'online', label: '在线' },
            { key: 'busy', label: '忙碌' },
            { key: 'offline', label: '离线' },
          ].map(s => (
            <button
              key={s.key}
              onClick={() => setFilter(s.key)}
              className={`px-3 py-1 rounded-full transition-all duration-200 ${
                filter === s.key ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              {s.label}
            </button>
          ))}
          <button
            onClick={handleHealthCheck}
            className="ml-auto px-3 py-1 rounded-full bg-gray-800 text-gray-400 hover:bg-gray-700 transition-colors"
          >
            健康检查
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.map(agent => (
            <div key={agent.id} className="relative group">
              <AgentCard key={agent.id} agent={agent} />
              <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {agent.status === 'offline' && (
                  <button
                    onClick={async () => {
                      try {
                        const resp = await fetch(getRegistryUrl() + '/api/launch', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ agentId: agent.id }),
                        })
                        const data = await resp.json()
                        showToast(data.ok ? `已启动 ${agent.name}` : `启动失败: ${data.error}`)
                      } catch {
                        showToast('启动失败: 连接超时')
                      }
                    }}
                    className="w-6 h-6 rounded bg-gray-700 hover:bg-green-600 text-white text-[10px] transition-colors"
                    title="启动 Agent"
                  >▶</button>
                )}
                <button
                  onClick={() => { setSelectedAgentId(agent.id); setShowSendForm(true); setSendTarget(agent.id) }}
                  className="w-6 h-6 rounded bg-gray-700 hover:bg-indigo-600 text-white text-[10px] transition-colors"
                  title="发送指令"
                >💬</button>
                <button
                  onClick={() => handleViewSessions(agent)}
                  className="w-6 h-6 rounded bg-gray-700 hover:bg-gray-600 text-white text-[10px] transition-colors"
                  title="查看会话"
                >📋</button>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="col-span-2 text-center text-gray-500 py-12">
              没有符合条件的 Agent
            </div>
          )}
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        {selected ? (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <span className={`status-dot ${selected.status}`} />
              <h3 className="text-lg font-semibold text-gray-100">{selected.name}</h3>
              <button onClick={() => setSelectedAgentId(null)} className="ml-auto text-gray-500 hover:text-gray-300">✕</button>
            </div>
            <div className="space-y-3 text-sm mb-4">
              <DetailRow label="ID" value={selected.id} />
              <DetailRow label="模型" value={selected.model} />
              <DetailRow label="工作空间" value={selected.workspace} />
              <DetailRow label="状态" value={selected.status === 'online' ? '在线' : selected.status === 'busy' ? '忙碌' : selected.status === 'offline' ? '离线' : '错误'} />
              <DetailRow label="会话数" value={String(selected.sessionCount)} />
              <DetailRow label="工具调用" value={String(selected.toolsUsed)} />
              <DetailRow label="在线时长" value={`${Math.floor(selected.uptime / 3600)}h`} />
              {selected.skills && selected.skills.length > 0 && (
                <div className="py-2">
                  <span className="text-xs text-gray-500 block mb-1.5">技能</span>
                  <div className="flex flex-wrap gap-1">
                    {selected.skills.map(s => (
                      <span key={s} className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-600/15 text-indigo-400 border border-indigo-500/20">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <button
                onClick={() => setShowSendForm(v => !v)}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg py-2 text-sm font-medium transition-all duration-200 active:scale-[0.98]"
              >
                {showSendForm ? '收起指令' : '发送指令'}
              </button>

              {showSendForm && (
                <div className="space-y-2 animate-slide-in">
                  <select
                    value={sendTarget}
                    onChange={e => setSendTarget(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-indigo-500"
                  >
                    {agents.map(a => (
                      <option key={a.id} value={a.id}>{a.name} ({a.status === 'online' ? '在线' : a.status === 'busy' ? '忙碌' : '离线'})</option>
                    ))}
                  </select>
                  <textarea
                    value={sendMessage}
                    onChange={e => setSendMessage(e.target.value)}
                    placeholder="输入指令内容..."
                    rows={3}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-500 resize-none focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    disabled={!sendMessage.trim() || sending}
                    onClick={handleSend}
                    className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg py-2 text-sm font-medium transition-all duration-200 active:scale-[0.98] flex items-center justify-center gap-1.5"
                  >
                    {sending ? (
                      <><span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin-slow" /> 发送中...</>
                    ) : '发送'}
                  </button>
                </div>
              )}

              <button
                onClick={handleViewLogs}
                className="w-full bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg py-2 text-sm transition-colors"
              >
                查看日志
              </button>
              <button
                onClick={() => { setSelectedAgentId(null); setActiveTab('tasks') }}
                className="w-full bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg py-2 text-sm transition-colors"
              >
                分配任务
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center text-gray-500 py-12">
            <div className="text-3xl mb-2">🤖</div>
            <p className="text-sm">点击 Agent 查看详情</p>
          </div>
        )}
      </div>

      {toast && (
        <div className="fixed bottom-6 right-6 bg-gray-800 border border-gray-700 text-gray-200 px-4 py-2 rounded-lg text-sm shadow-xl z-50 animate-slide-in">
          {toast}
        </div>
      )}

      {showLogModal && (
        <Modal title="日志信息" onClose={() => setShowLogModal(false)}>
          <pre className="text-xs text-gray-300 whitespace-pre-wrap font-mono leading-relaxed">{logContent}</pre>
        </Modal>
      )}

      {sessionModal && (
        <Modal title={`${sessionModal.name} - 会话`} onClose={() => setSessionModal(null)}>
          <div className="text-sm text-gray-400 space-y-3">
            <p>Agent ID: {sessionModal.id}</p>
            <p>模型: {sessionModal.model}</p>
            <p>状态: {sessionModal.status === 'online' ? '在线' : sessionModal.status === 'busy' ? '忙碌' : '离线'}</p>
            <p>会话数: {sessionModal.sessionCount}</p>
            <p>工具调用: {sessionModal.toolsUsed}</p>
            <p>最后活跃: {new Date(sessionModal.lastActive).toLocaleString('zh-CN')}</p>
            {sessionModal.currentTask && (
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 text-yellow-400">
                当前任务: {sessionModal.currentTask}
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-1">
      <span className="text-gray-500">{label}</span>
      <span className="text-gray-200">{value}</span>
    </div>
  )
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-5 w-[480px] max-h-[70vh] overflow-y-auto shadow-2xl animate-fade-in" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold text-gray-100">{title}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300">✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}
