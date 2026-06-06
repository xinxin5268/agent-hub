import { useEffect, useRef } from 'react'
import { useHubStore } from '@/lib/store'
import { getRegistryUrl } from '@/lib/store'
import type { AgentInfo } from '@/types'

/**
 * useRealtimeRegistry — 实时拉取注册中心数据
 * 
 * 1. 页面加载时 HTTP GET /api/agents 拉一次
 * 2. 通过 WebSocket 监听注册中心的事件推送（注册/注销/心跳变化）
 * 3. 每 5 秒 HTTP 轮询兜底（防止 WS 断连）
 */
export function useRealtimeRegistry() {
  const { setAgents, setConnected, addActivity } = useHubStore()
  const wsRef = useRef<WebSocket | null>(null)
  const intervalRef = useRef<number | null>(null)

  useEffect(() => {
    const base = getRegistryUrl()
    const wsUrl = base.replace(/^http/, 'ws') + '/ws'

    // ─── 1. 初始拉取 ──────────────────────────────────
    async function fetchAgents() {
      try {
        const resp = await fetch(`${base}/api/agents`)
        const data = await resp.json()
        if (data.agents) {
          setAgents(data.agents)
          setConnected(true)
        }
      } catch {
        setConnected(false)
      }
    }

    fetchAgents()

    // ─── 2. WebSocket 实时推送 ────────────────────────
    function connectWs() {
      try {
        const ws = new WebSocket(wsUrl)
        wsRef.current = ws

        ws.onopen = () => {
          console.log('[Hub] WS connected')
          setConnected(true)
        }

        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data)
            handleWsMessage(msg)
          } catch {
            // non-JSON message, ignore
          }
        }

        ws.onclose = () => {
          console.log('[Hub] WS disconnected')
          setConnected(false)
          // 3s 后重连
          setTimeout(connectWs, 3000)
        }

        ws.onerror = () => {
          ws.close()
        }
      } catch {
        // WS not available, fallback to polling
      }
    }

    function handleWsMessage(msg: any) {
      switch (msg.type) {
        case 'agent:register':
        case 'agent:registered':
        case 'agent:update':
          // 单个 Agent 更新，重新拉取全量
          fetchAgents()
          if (msg.agent) {
            addActivity({
              id: `ws-${Date.now()}`,
              agentId: msg.agent.id || 'hub',
              agentName: msg.agent.name || msg.agent.id || '未知',
              type: msg.type === 'agent:register' ? 'register' : 'update',
              summary: msg.type === 'agent:register'
                ? `Agent 注册: ${msg.agent.name || msg.agent.id}`
                : `Agent 更新: ${msg.agent.name || msg.agent.id} (${msg.agent.status})`,
              timestamp: Date.now(),
            })
          }
          break

        case 'agent:unregister':
          fetchAgents()
          break

        case 'heartbeat':
          // 心跳消息，不需要全量拉取，但更新连接状态
          setConnected(true)
          break

        case 'registry:stats':
          // 统计信息更新，拉取全量 Agent
          fetchAgents()
          break

        default:
          // 未知消息类型，忽略
          break
      }
    }

    connectWs()

    // ─── 3. HTTP 轮询兜底（5s） ───────────────────────
    intervalRef.current = window.setInterval(fetchAgents, 5000)

    return () => {
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [])
}
