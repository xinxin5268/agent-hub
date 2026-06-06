// Registry API helper — send commands, broadcast, check health
import { getRegistryUrl } from '@/lib/store'

export async function sendCommand(agentId: string, command: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const base = getRegistryUrl()
    const resp = await fetch(`${base}/api/command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId, command, id: `cmd-${Date.now()}` }),
    })
    const data = await resp.json()
    return data
  } catch (e: any) {
    return { ok: false, error: e.message }
  }
}

export async function checkRegistryHealth(): Promise<{ ok: boolean; data?: any; error?: string }> {
  try {
    const base = getRegistryUrl()
    const resp = await fetch(`${base}/api/stats`)
    const data = await resp.json()
    return { ok: true, data }
  } catch (e: any) {
    return { ok: false, error: e.message }
  }
}

export function openWebSocket(): WebSocket | null {
  try {
    const base = getRegistryUrl()
    const wsUrl = base.replace(/^http/, 'ws') + '/ws'
    return new WebSocket(wsUrl)
  } catch {
    return null
  }
}
