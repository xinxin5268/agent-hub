// ============================================================
// Gateway WebSocket Client — inspired by nerve's useWebSocket
// ============================================================

import type { GatewayEvent, GatewayResponse } from '@/types'

type EventHandler = (event: GatewayEvent) => void

interface GatewayClient {
  connectionState: 'disconnected' | 'connecting' | 'connected' | 'reconnecting'
  connect: (url: string, token?: string) => Promise<void>
  disconnect: () => void
  rpc: (method: string, params?: Record<string, unknown>) => Promise<unknown>
  subscribe: (handler: EventHandler) => () => void
  connectError: string | null
}

export function createGatewayClient(): GatewayClient {
  let ws: WebSocket | null = null
  let state: GatewayClient['connectionState'] = 'disconnected'
  let error: string | null = null
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null
  let gwUrl = ''
  let gwToken = ''
  let reqId = 0
  const pending = new Map<string, { resolve: (v: unknown) => void; reject: (e: unknown) => void }>()
  const subscribers = new Set<EventHandler>()
  const stateListeners = new Set<(s: GatewayClient['connectionState']) => void>()

  function setState(s: GatewayClient['connectionState']) {
    state = s
    stateListeners.forEach(l => l(s))
  }

  function notifyEvent(msg: GatewayEvent) {
    subscribers.forEach(h => { try { h(msg) } catch { /* ignore */ } })
  }

  function handleMessage(data: string) {
    try {
      const msg = JSON.parse(data)
      if (msg.type === 'res') {
        const p = pending.get(msg.id)
        if (p) {
          pending.delete(msg.id)
          if (msg.ok) p.resolve(msg.payload)
          else p.reject(new Error(msg.error?.message || 'RPC error'))
        }
      } else if (msg.type === 'event') {
        notifyEvent(msg as GatewayEvent)
      }
    } catch { /* ignore */ }
  }

  function scheduleReconnect() {
    if (reconnectTimer) clearTimeout(reconnectTimer)
    if (state === 'disconnected') return
    setState('reconnecting')
    reconnectTimer = setTimeout(() => doConnect(), 2000)
  }

  async function doConnect() {
    if (ws) {
      ws.onclose = null
      ws.onerror = null
      ws.close()
    }
    setState('connecting')
    error = null

    try {
      ws = new WebSocket(gwUrl)

      ws.onopen = async () => {
        // Handshake
        const token = gwToken || ''
        try {
          const res = await rpcCall('connect', {
            minProtocol: 4,
            maxProtocol: 4,
            client: {
              id: 'webchat-ui',
              version: '1.0.0',
              platform: 'web',
              mode: 'ui',
            },
            role: 'operator',
            scopes: ['operator.read', 'operator.write'],
            auth: token ? { token } : undefined,
          })
          if (res) {
            setState('connected')
            error = null
          }
        } catch (e: any) {
          error = e.message || 'Handshake failed'
          setState('disconnected')
          scheduleReconnect()
        }
      }

      ws.onclose = () => {
        if (state === 'connected' || state === 'reconnecting') {
          scheduleReconnect()
        }
      }

      ws.onerror = () => {
        error = 'WebSocket error'
      }

      ws.onmessage = (e) => handleMessage(e.data as string)
    } catch (e: any) {
      error = e.message || 'Connection failed'
      setState('disconnected')
      scheduleReconnect()
    }
  }

  function rpcCall(method: string, params?: Record<string, unknown>): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const id = String(++reqId)
      pending.set(id, { resolve, reject })
      const msg = { type: 'req', id, method, params: params || {} }
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(msg))
      } else {
        pending.delete(id)
        reject(new Error('Not connected'))
      }
      // Timeout
      setTimeout(() => {
        if (pending.has(id)) {
          pending.delete(id)
          reject(new Error('RPC timeout'))
        }
      }, 15000)
    })
  }

  return {
    get connectionState() { return state },
    get connectError() { return error },

    async connect(url: string, token?: string) {
      gwUrl = url
      gwToken = token || ''
      doConnect()
    },

    disconnect() {
      if (reconnectTimer) clearTimeout(reconnectTimer)
      setState('disconnected')
      if (ws) {
        ws.onclose = null
        ws.close()
        ws = null
      }
      pending.clear()
    },

    async rpc(method: string, params?: Record<string, unknown>) {
      return rpcCall(method, params)
    },

    subscribe(handler: EventHandler) {
      subscribers.add(handler)
      return () => subscribers.delete(handler)
    },
  }
}

// Singleton
let instance: ReturnType<typeof createGatewayClient> | null = null

export function getGatewayClient() {
  if (!instance) {
    instance = createGatewayClient()
  }
  return instance
}