// ============================================================
// Agent Hub — Main App Shell
// Data source: Registry REST API + WebSocket
// ============================================================

import { useState, useEffect, useCallback, useRef } from "react"
import { useHubStore, getRegistryUrl } from "@/lib/store"
import { AlertTriangle, Bell, X } from "lucide-react"
import { Sidebar } from "@/components/Sidebar"
import { TopBar } from "@/components/TopBar"
import { DashboardPanel } from "@/features/dashboard/DashboardPanel"
import { AgentsPanel } from "@/features/agents/AgentsPanel"
import { ActivityPanel } from "@/features/activity/ActivityPanel"
import { ProjectsPanel } from "@/features/projects/ProjectsPanel"
import { TasksPanel } from "@/features/tasks/TasksPanel"
import { StudioPanel } from "@/features/studio/StudioPanel"
import { SkillsPanel } from "@/features/skills/SkillsPanel"
import { KnowledgeHub } from "@/features/skills/KnowledgeHub"
import { MonitorPanel } from "@/features/dashboard/MonitorPanel"
import type { AgentInfo, ActivityEvent } from "@/types"

const PANELS: Record<string, { label: string; icon: string }> = {
  dashboard: { label: "\u9a7e\u9a76\u8231", icon: "\ud83d\udcca" },
  agents: { label: "Agent \u8230\u961f", icon: "\ud83e\udd16" },
  activity: { label: "\u6d3b\u52a8\u6d41", icon: "\ud83d\udce1" },
  projects: { label: "\u9879\u76ee\u7ba1\u7406", icon: "\ud83d\udccb" },
  tasks: { label: "\u4efb\u52a1\u770b\u677f", icon: "\ud83d\udccc" },
  studio: { label: "\u5de5\u4f5c\u5ba4", icon: "\ud83c\udfe2" },
  skills: { label: "\u6280\u80fd\u7ba1\u7406", icon: "\ud83e\uddf0" },
  knowledge: { label: '知识库', icon: '📚' },
}

function mapRegistryAgent(a: any): AgentInfo {
  return {
    id: a.id,
    name: a.name || a.id,
    status: a.status === "online" ? "online" : a.status === "busy" ? "busy" : "offline",
    type: a.type || "custom",
    platform: a.platform || "",
    host: a.host || "",
    port: a.port || 0,
    wsUrl: a.wsUrl || "",
    httpUrl: a.httpUrl || "",
    model: (a.models && a.models[0]) || a.tags?.model || "--",
    workspace: a.cwd || a.platform || "",
    lastActive: a.lastHeartbeat || Date.now(),
    sessionCount: 0,
    toolsUsed: 0,
    uptime: 0,
    currentTask: undefined,
    launchPath: a.launchPath || undefined,
    launchCommand: a.launchCommand || undefined,
  }
}

function makeActivity(
  id: string,
  agentId: string,
  agentName: string,
  type: ActivityEvent["type"],
  summary: string
): ActivityEvent {
  return { id, agentId, agentName, type, summary, timestamp: Date.now() }
}

// 告警通知接口
interface AlertNotification {
  id: string
  type: string
  agentId: string
  agentName: string
  severity: 'info' | 'warning' | 'critical'
  message: string
  timestamp: number
  resolved: boolean
}

export default function App() {
  const { activeTab, setActiveTab, connected, setConnected, setAgents, addActivity } = useHubStore()
  const [alerts, setAlerts] = useState<AlertNotification[]>([])
  const [showAlertPanel, setShowAlertPanel] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>()
  const mounted = useRef(true)

  const connectToRegistry = useCallback(async () => {
    const baseUrl = getRegistryUrl()
    const wsUrl = baseUrl.replace(/^http/, "ws") + "/ws"

    // 1. REST fetch
    try {
      const resp = await fetch(baseUrl + "/api/agents")
      const data = await resp.json()
      if (Array.isArray(data.agents) && data.agents.length > 0) {
        setAgents(data.agents.map(mapRegistryAgent))
        setConnected(true)
      }
    } catch (e) {
      console.warn("[App] REST fetch failed", e)
    }

    // 2. WebSocket
    if (wsRef.current?.readyState === WebSocket.OPEN) return
    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    ws.onopen = () => {
      console.log("[App] registry WS connected")
      setConnected(true)
    }

    ws.onmessage = (event: MessageEvent) => {
      if (!mounted.current) return
      try {
        const msg = JSON.parse(event.data as string)
        if (msg.type === "registry:state" && Array.isArray(msg.agents)) {
          setAgents(msg.agents.map(mapRegistryAgent))
        } else if (msg.type === "agent:registered" && msg.agent) {
          const store = useHubStore.getState()
          const exists = store.agents.find((a: AgentInfo) => a.id === msg.agent.id)
          if (exists) {
            store.updateAgent(msg.agent.id, { status: "online" })
          } else {
            store.setAgents([...store.agents, mapRegistryAgent(msg.agent)])
          }
          addActivity(
            makeActivity("reg-" + Date.now(), msg.agent.id, msg.agent.name || msg.agent.id, "message", "\u4e0a\u7ebf")
          )
        } else if (msg.type === "agent:status") {
          useHubStore.getState().updateAgent(msg.agentId, { status: msg.status })
        } else if (msg.type === "agent:message" && msg.message) {
          const m = msg.message
          addActivity(
            makeActivity(
              "msg-" + Date.now(),
              m.from,
              m.fromName || m.from,
              "message",
              (m.content || "").slice(0, 100)
            )
          )
        } else if (msg.type === "monitor:alert" && msg.alert) {
          const alert = msg.alert as AlertNotification
          setAlerts(prev => [alert, ...prev].slice(0, 50))
          addActivity(
            makeActivity(
              "alert-" + Date.now(),
              alert.agentId,
              alert.agentName,
              "error",
              `[${alert.severity}] ${alert.message}`
            )
          )
        } else if (msg.type === "monitor:update" && msg.data) {
          // 更新 Agent 监测数据（health score 等）
        }
      } catch (e) {
        // ignore parse errors
      }
    }

    ws.onclose = () => {
      if (mounted.current) {
        setConnected(false)
        reconnectTimer.current = setTimeout(connectToRegistry, 3000)
      }
    }

    ws.onerror = () => {
      console.warn("[App] registry WS error")
    }
  }, [setConnected, setAgents, addActivity])

  useEffect(() => {
    mounted.current = true
    connectToRegistry()
    
    // 兜底轮询：每 3 秒拉一次 Agent 列表
    const pollTimer = setInterval(async () => {
      try {
        const baseUrl = getRegistryUrl()
        const resp = await fetch(baseUrl + "/api/agents")
        const data = await resp.json()
        if (Array.isArray(data.agents) && data.agents.length > 0) {
          setAgents(data.agents.map(mapRegistryAgent))
          setConnected(true)
        }
      } catch {}
    }, 3000)

    return () => {
      mounted.current = false
      clearInterval(pollTimer)
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current)
      if (wsRef.current) {
        wsRef.current.onclose = null
        wsRef.current.close()
        wsRef.current = null
      }
    }
  }, [connectToRegistry])

  return (
    <div className="flex h-screen overflow-hidden bg-gray-950">
      <Sidebar
        panels={PANELS}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onConnect={connectToRegistry}
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar panels={PANELS} activeTab={activeTab} />
        <main className="flex-1 overflow-y-auto p-4 space-y-4">
          {activeTab === "dashboard" && <DashboardPanel />}
          {activeTab === "agents" && <AgentsPanel />}
          {activeTab === "activity" && <ActivityPanel />}
          {activeTab === "projects" && <ProjectsPanel />}
          {activeTab === "tasks" && <TasksPanel />}
          {activeTab === "studio" && <StudioPanel />}
          {activeTab === "skills" && <SkillsPanel />}
          {activeTab === "knowledge" && <KnowledgeHub />}
          {activeTab === "monitor" && <MonitorPanel />}
        </main>

        {/* 告警通知铃铛 */}
        <button
          onClick={() => setShowAlertPanel(v => !v)}
          className={`fixed top-3 right-4 z-50 flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition-colors ${
            alerts.filter(a => !a.resolved).length > 0
              ? 'bg-red-600/20 text-red-400 border border-red-500/30'
              : 'bg-gray-800/50 text-gray-400 border border-gray-700/50'
          }`}
        >
          <Bell size={14} />
          {alerts.filter(a => !a.resolved).length > 0 && (
            <span className="font-bold">{alerts.filter(a => !a.resolved).length}</span>
          )}
        </button>

        {/* 告警面板 */}
        {showAlertPanel && (
          <div className="fixed top-12 right-4 w-80 max-h-96 overflow-y-auto bg-gray-900 border border-gray-700 rounded-xl shadow-2xl z-50 animate-fade-in">
            <div className="flex items-center justify-between px-3 py-2 border-b border-gray-800">
              <span className="text-xs font-semibold text-gray-200">告警通知</span>
              <button onClick={() => setShowAlertPanel(false)} className="text-gray-500 hover:text-gray-300">
                <X size={14} />
              </button>
            </div>
            {alerts.length === 0 ? (
              <div className="text-center text-gray-600 text-xs py-6">暂无告警</div>
            ) : (
              <div className="p-2 space-y-1.5">
                {alerts.map(alert => {
                  const severityColors = {
                    info: 'border-l-blue-500 bg-blue-500/5',
                    warning: 'border-l-yellow-500 bg-yellow-500/5',
                    critical: 'border-l-red-500 bg-red-500/10',
                  }
                  return (
                    <div
                      key={alert.id}
                      className={`border-l-2 pl-2 py-1.5 rounded ${severityColors[alert.severity]} ${alert.resolved ? 'opacity-50' : ''}`}
                    >
                      <div className="flex items-center gap-1 text-[10px]">
                        <AlertTriangle size={10} className={
                          alert.severity === 'critical' ? 'text-red-400' :
                          alert.severity === 'warning' ? 'text-yellow-400' : 'text-blue-400'
                        } />
                        <span className="font-medium text-gray-200">{alert.agentName}</span>
                        <span className="text-gray-600">·</span>
                        <span className="text-gray-500">
                          {new Date(alert.timestamp).toLocaleTimeString('zh-CN')}
                        </span>
                      </div>
                      <p className="text-[10px] text-gray-400 mt-0.5">{alert.message}</p>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
