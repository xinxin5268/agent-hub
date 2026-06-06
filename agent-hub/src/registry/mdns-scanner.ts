// ============================================================
// mDNS Scanner — 自动发现局域网内的 Agent
// 监听 _opencode._tcp 和 _openclaw-gw._tcp 服务
// ============================================================

import MulticastDNS from 'multicast-dns'
import { MDNS_SERVICE_TYPES, type AgentRegistration } from './protocol'

export interface DiscoveredService {
  name: string
  type: string
  host: string
  port: number
  txt: Record<string, string>
  fullname: string
}

export type DiscoveryListener = (service: DiscoveredService) => void

export class MdnsScanner {
  private mdns: ReturnType<typeof MulticastDNS> | null = null
  private running = false
  private readonly onDiscovered: DiscoveryListener
  private readonly onLost: DiscoveryListener
  private readonly known = new Map<string, DiscoveredService>()
  private refreshInterval: ReturnType<typeof setInterval> | null = null
  private responseHandler: ((response: any) => void) | null = null

  constructor(opts: {
    onDiscovered: DiscoveryListener
    onLost: DiscoveryListener
  }) {
    this.onDiscovered = opts.onDiscovered
    this.onLost = opts.onLost
  }

  start() {
    if (this.running) return
    this.running = true

    try {
      this.mdns = MulticastDNS({ multicast: true, interface: '0.0.0.0' })
    } catch (err: any) {
      console.error('[mdns] failed to create multicast-dns instance:', err.message)
      this.running = false
      return
    }

    // 单次 response 处理器，处理所有服务类型
    this.responseHandler = (response: any) => {
      try {
        if (!response || !response.answers) return

        for (const serviceType of Object.values(MDNS_SERVICE_TYPES)) {
          const ptrRecord = response.answers.find(
            (a: any) => a.type === 'PTR' && a.name === serviceType
          )
          if (!ptrRecord) continue

          const instanceName = ptrRecord.data
          if (!instanceName) continue

          const srvRecord = response.additionals?.find(
            (a: any) => a.type === 'SRV' && a.name === instanceName
          )
          if (!srvRecord || !srvRecord.data) continue

          const txtRecord = response.additionals?.find(
            (a: any) => a.type === 'TXT' && a.name === instanceName
          )

          // Parse TXT records
          const txt: Record<string, string> = {}
          if (txtRecord?.data) {
            const data = Array.isArray(txtRecord.data) ? txtRecord.data : [txtRecord.data]
            for (const entry of data) {
              if (entry == null) continue
              const [key, ...rest] = String(entry).split('=')
              if (key) txt[key.trim()] = rest.join('=').trim()
            }
          }

          const target = srvRecord.data.target
          const host = target ? target.replace(/\.$/, '') : 'unknown'

          const service: DiscoveredService = {
            name: typeof instanceName === 'string' ? instanceName.replace(`.${serviceType}`, '') : String(instanceName),
            type: serviceType,
            host,
            port: srvRecord.data.port || 0,
            txt,
            fullname: instanceName,
          }

          const key = `${service.type}:${service.name}:${service.host}:${service.port}`

          if (!this.known.has(key)) {
            this.known.set(key, service)
            console.log(`[mdns] discovered: ${service.name} (${service.type}) at ${service.host}:${service.port}`)
            try {
              this.onDiscovered(service)
            } catch (cbErr: any) {
              console.error('[mdns] onDiscovered callback error:', cbErr.message)
            }
          }
        }
      } catch (err: any) {
        // 捕获所有 mDNS 响应处理中的异常，防止进程崩溃
        console.warn('[mdns] response handler error (caught):', err.message)
      }
    }

    this.mdns.on('response', this.responseHandler)

    // 初始查询所有服务类型
    for (const type of Object.values(MDNS_SERVICE_TYPES)) {
      try {
        this.mdns.query({
          questions: [{ name: type, type: 'PTR' }],
        })
      } catch (err: any) {
        console.warn(`[mdns] query error for ${type}:`, err.message)
      }
    }

    console.log('[mdns] scanner started on 0.0.0.0')
  }

  /** 定期刷新查询 */
  startRefreshing(intervalMs = 30_000) {
    if (this.refreshInterval) return // 防止重复创建
    this.refreshInterval = setInterval(() => {
      if (!this.mdns || !this.running) return
      try {
        for (const type of Object.values(MDNS_SERVICE_TYPES)) {
          this.mdns?.query({
            questions: [{ name: type, type: 'PTR' }],
          })
        }
      } catch (err: any) {
        console.warn('[mdns] refresh query error:', err.message)
      }
    }, intervalMs)
  }

  /** 将 mDNS 发现的服务转换为 AgentRegistration */
  serviceToRegistration(svc: DiscoveredService): AgentRegistration | null {
    const wsUrl = `ws://${svc.host}:${svc.port}`
    const httpUrl = `http://${svc.host}:${svc.port}`

    const now = Date.now()

    if (svc.type === MDNS_SERVICE_TYPES.OPENCODE) {
      return {
        id: `opencode-${svc.host}-${svc.port}`,
        name: svc.txt?.name || svc.name || `opencode@${svc.host}`,
        type: 'opencode',
        platform: svc.host.includes('wsl') || svc.host === 'localhost' ? 'wsl' : 'windows',
        host: svc.host,
        port: svc.port,
        wsUrl,
        httpUrl,
        status: 'online',
        models: svc.txt?.models?.split(',') || [],
        cwd: svc.txt?.cwd,
        version: svc.txt?.version,
        lastHeartbeat: now,
        registeredAt: now,
        tags: { discoveredBy: 'mdns', serviceType: svc.type },
      }
    }

    if (svc.type === MDNS_SERVICE_TYPES.OPENCLAW_GW) {
      const gwPort = parseInt(svc.txt?.port || String(svc.port)) || svc.port
      return {
        id: `gateway-${svc.host}-${gwPort}`,
        name: svc.txt?.name || `gateway@${svc.host}:${gwPort}`,
        type: 'openclaw-gateway',
        platform: 'windows',
        host: svc.host,
        port: gwPort,
        wsUrl: `ws://${svc.host}:${gwPort}`,
        httpUrl: `http://${svc.host}:${gwPort}`,
        status: 'online',
        lastHeartbeat: now,
        registeredAt: now,
        tags: { discoveredBy: 'mdns', serviceType: svc.type },
      }
    }

    return null
  }

  stop() {
    this.running = false
    // 清除刷新定时器
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval)
      this.refreshInterval = null
    }
    // 移除 response 处理器
    if (this.mdns && this.responseHandler) {
      try {
        this.mdns.removeListener('response', this.responseHandler)
      } catch (e: any) {
        // ignore
      }
    }
    if (this.mdns) {
      try {
        this.mdns.destroy()
      } catch (err: any) {
        console.warn('[mdns] destroy error:', err.message)
      }
      this.mdns = null
    }
    this.known.clear()
    console.log('[mdns] scanner stopped')
  }

  getKnownServices(): DiscoveredService[] {
    return Array.from(this.known.values())
  }
}