// ============================================================
// MonitorPanel — 自动化监测看板
// 实时显示 Agent 健康分、系统概览、异常告警
// 数据源: GET /api/monitor + WS 实时推送
// ============================================================

import { useState, useEffect, useCallback, useRef } from 'react'
import { useHubStore, getRegistryUrl } from '@/lib/store'
import {
  Activity, AlertTriangle, Cpu, MemoryStick, Clock, Wifi, WifiOff,
  Zap, RefreshCw, Heart, TrendingUp, TrendingDown, Minus
} from 'lucide-react'
import { GaugeMeter } from './GaugeMeter'
import { RealtimeChart } from './RealtimeChart'

interface AgentMonitorData {
  agentId: string
  agentName: string
  status: string
  cpu: number
  memoryMb: number
  taskProgress: number
  errorRate: number
  responseLatency: number
  uptime: number
  healthScore: number
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

interface MonitorSummary {
  totalAgents: number
  onlineAgents: number
  offlineAgents: number
  onlineRate: number
  averageHealthScore: number
  totalAlerts: number
  unresolvedAlerts: number
  criticalAlerts: number
  lastUpdated: number
}

const ALERT_TYPE_MAP: Record<string, { label: string; icon: string }> = {
  agent_offline: { label: 'Agent 离线', icon: '🔴' },
  task_timeout: { label: '任务超时', icon: '⏰' },
  error_spike: { label: '错误飙升', icon: '📈' },
  high_latency: { label: '延迟过高', icon: '🐢' },
  low_health: { label: '健康过低', icon: '💔' },
}

function formatUptime(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h}h${m}m`
  return `${m}m`
}

function getHealthColor(score: number): string {
  if (score >= 80) return 'text-green-400 border-green-500/30 bg-green-600/10'
  if (score >= 50) return 'text-yellow-400 border-yellow-500/30 bg-yellow-600/10'
  return 'text-red-400 border-red-500/30 bg-red-600/10'
}

function getHealthBar(score: number): string {
  if (score >= 80) return 'bg-green-500'
  if (score >= 50) return 'bg-yellow-500'
  return 'bg-red-500'
}

export function MonitorPanel() {
  const [monitorData, setMonitorData] = useState<Record<string, AgentMonitorData>>({})
  const [alerts, setAlerts] = useState<AlertEvent[]>([])
  const [summary, setSummary] = useState<MonitorSummary | null>(null)
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all')
  const [loading, setLoading] = useState(true)
  const [pulseAgents, setPulseAgents] = useState<Record<string, boolean>>({})
  const prevDataRef = useRef<Record<string, AgentMonitorData>>({})

  const loadMonitorData = useCallback(async () => {
    try {
      const resp = await fetch(getRegistryUrl() + '/api/monitor')
      const data = await resp.json()
      if (data.ok) {
        setMonitorData(data.agents || {})
        setAlerts(data.alerts || [])
        setSummary(data.summary || null)

        // 检测变化触发脉冲动画
        const prev = prevDataRef.current
        const newPulse: Record<string, boolean> = {}
        for (const [id, agent] of Object.entries(data.agents || {}) as [string, AgentMonitorData][]) {
          const prevAgent = prev[id]
          if (prevAgent && (
            Math.abs(prevAgent.cpu - agent.cpu) > 5 ||
            Math.abs(prevAgent.healthScore - agent.healthScore) > 5 ||
            prevAgent.status !== agent.status
          )) {
            newPulse[id] = true
          }
        }
        setPulseAgents(newPulse)
        // 清除脉冲动画
        setTimeout(() => setPulseAgents({}), 600)
        prevDataRef.current = data.agents || {}
      }
    } catch {}
    setLoading(false)
  }, [])

  useEffect(() => { loadMonitorData() }, [loadMonitorData])

  // WS 实时更新
  useEffect(() => {
    const wsUrl = getRegistryUrl().replace(/^http/, 'ws') + '/ws'
    let ws: WebSocket | null = null
    let reconnectTimer: NodeJS.Timeout

    const connect = () => {
      ws = new WebSocket(wsUrl)
      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data)
          if (msg.type === 'monitor:update') {
            if (msg.data) setMonitorData(msg.data)
            if (msg.alerts) setAlerts(msg.alerts.slice(-100))
          }
          if (msg.type === 'monitor:alert' && msg.alert) {
            setAlerts(prev => [...prev.slice(-99), msg.alert])
          }
          if (msg.type === 'monitor:summary' && msg.summary) {
            setSummary(msg.summary)
          }
        } catch {}
      }
      ws.onclose = () => {
        reconnectTimer = setTimeout(connect, 5000)
      }
    }
    connect()
    return () => {
      ws?.close()
      clearTimeout(reconnectTimer)
    }
  }, [])

  const agents = Object.values(monitorData)
  const filteredAlerts = selectedSeverity === 'all'
    ? alerts
    : alerts.filter(a => a.severity === selectedSeverity)

  const severityBadge = (s: string) => {
    if (s === 'critical') return 'bg-red-600/20 text-red-400'
    if (s === 'warning') return 'bg-yellow-600/20 text-yellow-400'
    return 'bg-blue-600/20 text-blue-400'
  }

  return (
    <div className="flex flex-col h-full bg-gray-950 text-gray-100 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-800/60">
        <div className="flex items-center gap-2">
          <Activity size={14} className="text-cyan-400" />
          <span className="text-sm font-medium">自动化监测</span>
        </div>
        <button onClick={loadMonitorData}
          className="flex items-center gap-1 px-2 py-1 rounded-lg bg-gray-800 text-gray-400 text-xs hover:bg-gray-700 transition-colors"
        ><RefreshCw size={11} /> 刷新</button>
      </div>

      {/* ═══ 咪表概览 ═══ */}
      {summary && (
        <div className="px-4 py-3 border-b border-gray-800/40">
          <div className="flex items-center justify-center gap-8 mb-3">
            <GaugeMeter value={summary.averageHealthScore} label="整体健康分" size={100} />
            <GaugeMeter value={summary.onlineRate} label="在线率" size={100} color="#06b6d4" />
            <GaugeMeter
              value={Math.max(0, 100 - summary.criticalAlerts * 25)}
              label="严重告警"
              size={100}
              color={summary.criticalAlerts > 0 ? '#ef4444' : '#22c55e'}
            />
          </div>
          <div className="grid grid-cols-5 gap-2">
            <div className="bg-gray-900/60 border border-gray-800/50 rounded-xl p-2 text-center">
              <div className="text-[9px] text-gray-500 mb-0.5">Agent 总数</div>
              <div className="text-sm font-bold text-cyan-400">{summary.totalAgents}</div>
            </div>
            <div className="bg-gray-900/60 border border-gray-800/50 rounded-xl p-2 text-center">
              <div className="text-[9px] text-gray-500 mb-0.5">在线</div>
              <div className="text-sm font-bold text-green-400">{summary.onlineAgents}</div>
            </div>
            <div className="bg-gray-900/60 border border-gray-800/50 rounded-xl p-2 text-center">
              <div className="text-[9px] text-gray-500 mb-0.5">离线</div>
              <div className="text-sm font-bold text-red-400">{summary.offlineAgents}</div>
            </div>
            <div className="bg-gray-900/60 border border-gray-800/50 rounded-xl p-2 text-center">
              <div className="text-[9px] text-gray-500 mb-0.5">未解决告警</div>
              <div className={`text-sm font-bold ${summary.unresolvedAlerts > 0 ? 'text-yellow-400' : 'text-gray-400'}`}>{summary.unresolvedAlerts}</div>
            </div>
            <div className="bg-gray-900/60 border border-gray-800/50 rounded-xl p-2 text-center">
              <div className="text-[9px] text-gray-500 mb-0.5">严重告警</div>
              <div className={`text-sm font-bold ${summary.criticalAlerts > 0 ? 'text-red-400' : 'text-gray-400'}`}>{summary.criticalAlerts}</div>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        {/* Left: Agent monitor cards */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading ? (
            <div className="flex items-center justify-center h-full text-gray-500 text-sm">加载监测数据...</div>
          ) : agents.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-600">
              <Activity size={32} className="mb-2 opacity-40" />
              <p className="text-sm">暂无监测数据</p>
              <p className="text-xs mt-1">等待监测引擎收集数据...</p>
            </div>
          ) : agents.map(agent => (
            <div
              key={agent.agentId}
              className={`bg-gray-900/60 border rounded-xl p-4 transition-all duration-300 ${
                pulseAgents[agent.agentId]
                  ? 'border-cyan-500/50 shadow-[0_0_12px_rgba(6,182,212,0.15)] scale-[1.01]'
                  : 'border-gray-800/50 hover:border-gray-700/50'
              }`}
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  {agent.status === 'online' || agent.status === 'busy'
                    ? <Wifi size={12} className="text-green-400 animate-pulse" />
                    : <WifiOff size={12} className="text-red-400" />}
                  <span className="text-sm font-medium text-gray-200">{agent.agentName}</span>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded ${
                    agent.status === 'online' ? 'bg-green-600/20 text-green-400' :
                    agent.status === 'busy' ? 'bg-yellow-600/20 text-yellow-400' :
                    'bg-red-600/20 text-red-400'
                  }`}>{agent.status}</span>
                </div>
                {/* Health score ring — 改为小咪表 */}
                <div className="transform scale-75 origin-right">
                  <GaugeMeter value={agent.healthScore} label="" size={48} />
                </div>
              </div>

              {/* Metrics grid */}
              <div className="grid grid-cols-4 gap-3">
                <div>
                  <div className="text-[9px] text-gray-500 mb-0.5 flex items-center gap-1"><Cpu size={9} /> CPU</div>
                  <div className="flex items-center gap-1">
                    <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          agent.cpu > 70 ? 'bg-red-500' : agent.cpu > 50 ? 'bg-yellow-500' : 'bg-green-500'
                        }`}
                        style={{ width: `${agent.cpu}%`, transition: 'width 0.5s ease' }}
                      />
                    </div>
                    <span className="text-[10px] text-gray-400 w-8 text-right">{agent.cpu.toFixed(0)}%</span>
                  </div>
                </div>
                <div>
                  <div className="text-[9px] text-gray-500 mb-0.5 flex items-center gap-1"><MemoryStick size={9} /> 内存</div>
                  <span className="text-[10px] text-gray-300">{agent.memoryMb.toFixed(0)} MB</span>
                </div>
                <div>
                  <div className="text-[9px] text-gray-500 mb-0.5 flex items-center gap-1"><Clock size={9} /> 延迟</div>
                  <span className={`text-[10px] ${agent.responseLatency > 5000 ? 'text-red-400' : 'text-gray-300'}`}>
                    {agent.responseLatency.toFixed(0)}ms
                  </span>
                </div>
                <div>
                  <div className="text-[9px] text-gray-500 mb-0.5 flex items-center gap-1"><Zap size={9} /> 错误率</div>
                  <span className={`text-[10px] ${agent.errorRate > 20 ? 'text-red-400' : 'text-gray-300'}`}>
                    {agent.errorRate.toFixed(1)}%
                  </span>
                </div>
              </div>

              {/* Realtime mini charts */}
              <div className="grid grid-cols-3 gap-2 mt-3">
                <RealtimeChart agentId={agent.agentId} metric="latency" title="延迟" height={60} maxPoints={20} />
                <RealtimeChart agentId={agent.agentId} metric="healthScore" title="健康分" height={60} maxPoints={20} />
                <RealtimeChart agentId={agent.agentId} metric="cpu" title="CPU" height={60} maxPoints={20} color="#f97316" />
              </div>

              {/* Current task */}
              {agent.currentTask && (
                <div className="mt-2 text-[10px] text-gray-500 flex items-center gap-1">
                  <span>当前任务:</span>
                  <span className="text-yellow-400/80 truncate">{agent.currentTask}</span>
                </div>
              )}

              {/* Error info */}
              {agent.lastError && (
                <div className="mt-1 text-[9px] text-red-400/70 truncate">{agent.lastError}</div>
              )}
            </div>
          ))}
        </div>

        {/* Right: Alert stream */}
        <div className="w-80 border-l border-gray-800/60 flex flex-col">
          <div className="px-3 py-2 border-b border-gray-800/40">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle size={12} className="text-yellow-400" />
              <span className="text-xs font-medium">告警流</span>
              <span className="text-[10px] text-gray-500">{alerts.length}</span>
            </div>
            <div className="flex gap-1">
              {['all', 'critical', 'warning', 'info'].map(s => (
                <button key={s} onClick={() => setSelectedSeverity(s)}
                  className={`px-2 py-0.5 rounded text-[9px] font-medium transition-colors ${
                    selectedSeverity === s
                      ? severityBadge(s)
                      : 'bg-gray-800/60 text-gray-500 hover:text-gray-300'
                  }`}
                >{s === 'all' ? '全部' : s === 'critical' ? '严重' : s === 'warning' ? '警告' : '提示'}</button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {filteredAlerts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-600 text-xs">
                <AlertTriangle size={20} className="mb-1 opacity-40" />
                <p>无告警</p>
              </div>
            ) : filteredAlerts.slice().reverse().map(alert => (
              <div
                key={alert.id}
                className={`bg-gray-900/60 border rounded-lg p-2 ${
                  alert.severity === 'critical'
                    ? 'border-red-800/40 animate-pulse'
                    : alert.severity === 'warning'
                    ? 'border-yellow-800/40'
                    : 'border-blue-800/40'
                }`}
              >
                <div className="flex items-center gap-1 mb-0.5">
                  <span className={`text-[9px] px-1 py-0.5 rounded ${severityBadge(alert.severity)}`}>
                    {ALERT_TYPE_MAP[alert.type]?.label || alert.type}
                  </span>
                  <span className="text-[9px] text-gray-600 ml-auto">{new Date(alert.timestamp).toLocaleTimeString()}</span>
                </div>
                <div className="text-[10px] text-gray-400">{alert.message}</div>
                <div className="text-[8px] text-gray-600 mt-0.5">{alert.agentName}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}