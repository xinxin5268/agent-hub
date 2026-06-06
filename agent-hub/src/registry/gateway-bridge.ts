import WebSocket from 'ws'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import { type CommandRequest, type CommandResponse, type AgentRegistration } from './protocol'

type BridgeStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

interface PendingRequest {
  resolve: (value: unknown) => void
  reject: (err: Error) => void
  timer: ReturnType<typeof setTimeout>
}

interface EventHandler {
  event: string
  cb: (payload: any) => void
}

const SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex')

function buildV3Payload(
  deviceId: string, clientId: string, clientMode: string,
  role: string, scopes: string[], signedAtMs: number,
  token: string | null, nonce: string,
  platform: string, deviceFamily: string,
): string {
  return [
    'v3', deviceId, clientId, clientMode, role,
    scopes.join(','),
    String(signedAtMs),
    token || '',
    nonce,
    (platform || '').trim().toLowerCase(),
    (deviceFamily || '').trim().toLowerCase(),
  ].join('|')
}

function generateDeviceIdentity() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519', {
    publicKeyEncoding: { type: 'spki', format: 'der' },
    privateKeyEncoding: { type: 'pkcs8', format: 'der' },
  })
  const rawPubKey = publicKey.subarray(SPKI_PREFIX.length)
  const deviceId = crypto.createHash('sha256').update(rawPubKey).digest('hex')
  const pubKeyB64url = rawPubKey.toString('base64url')
  const privKeyB64url = privateKey.toString('base64url')
  return { deviceId, publicKey: pubKeyB64url, privateKey: privKeyB64url, privKeyDer: privateKey }
}

function loadOrCreateIdentity(identityPath: string) {
  try {
    if (fs.existsSync(identityPath)) {
      const data = JSON.parse(fs.readFileSync(identityPath, 'utf-8'))
      return data as { deviceId: string; publicKey: string; privateKey: string }
    }
  } catch {}
  const id = generateDeviceIdentity()
  try {
    fs.mkdirSync(path.dirname(identityPath), { recursive: true })
    fs.writeFileSync(identityPath, JSON.stringify({ deviceId: id.deviceId, publicKey: id.publicKey, privateKey: id.privateKey }, null, 2))
  } catch {}
  return id
}

export class GatewayBridge {
  private ws: WebSocket | null = null
  private status: BridgeStatus = 'disconnected'
  private agent: AgentRegistration
  private authToken: string
  private deviceToken: string | null = null
  private identity: ReturnType<typeof loadOrCreateIdentity>
  private privKeyDer: Buffer
  private connId: string | null = null
  private pending = new Map<string, PendingRequest>()
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private heartbeatTimer: ReturnType<typeof setTimeout> | null = null
  private connectPromise: Promise<void> | null = null
  private connectCount = 0
  private onStatusChange: ((status: BridgeStatus) => void) | null = null
  private onEventCb: ((event: string, payload: any) => void) | null = null

  constructor(agent: AgentRegistration, authToken: string, identityPath: string) {
    this.agent = agent
    this.authToken = authToken
    const fullId = loadOrCreateIdentity(identityPath)
    this.identity = fullId
    this.privKeyDer = Buffer.from(fullId.privateKey, 'base64url')
  }

  getStatus(): BridgeStatus { return this.status }
  getDeviceId(): string { return this.identity.deviceId }

  onStatus(cb: (status: BridgeStatus) => void) { this.onStatusChange = cb }
  onEvent(cb: (event: string, payload: any) => void) { this.onEventCb = cb }

  private setStatus(s: BridgeStatus) {
    this.status = s
    this.onStatusChange?.(s)
  }

  connect(): Promise<void> {
    if (this.connectPromise) return this.connectPromise
    if (this.ws) this.disconnect()
    const url = this.agent.wsUrl
    if (!url) return Promise.reject(new Error('No wsUrl for agent'))

    this.setStatus('connecting')
    console.log(`[gw-bridge] ${this.agent.id} connecting to ${url}`)

    this.connectPromise = new Promise((resolve, reject) => {
      const ws = new WebSocket(url)
      const timeout = setTimeout(() => {
        ws.close()
        this.connectPromise = null
        reject(new Error('Connection timeout'))
      }, 15000)

      ws.on('open', () => {
        console.log(`[gw-bridge] ${this.agent.id} TCP connected, waiting for challenge`)
      })

      ws.on('message', (raw) => {
        try {
          const msg = JSON.parse(raw.toString())
          this.handleFrame(msg)
        } catch (e) {
          console.error('[gw-bridge] invalid frame:', e)
        }
      })

      ws.on('error', (err) => {
        clearTimeout(timeout)
        console.error(`[gw-bridge] ${this.agent.id} error: ${err.message}`)
        this.setStatus('error')
        this.connectPromise = null
        reject(err)
      })

      ws.on('close', (code, reason) => {
        clearTimeout(timeout)
        console.log(`[gw-bridge] ${this.agent.id} closed(${code}): ${reason?.toString() || ''}`)
        this.ws = null
        this.setStatus('disconnected')
        this.connectPromise = null
        this.rejectAllPending(new Error(`Connection closed (${code})`))
        this.scheduleReconnect()
      })

      this.ws = ws
      this.pending.set('__connect__', {
        resolve: () => {
          clearTimeout(timeout)
          this.connectCount = 0
          this.setStatus('connected')
          this.startHeartbeat()
          this.connectPromise = null
          resolve()
        },
        reject: (err: Error) => {
          clearTimeout(timeout)
          this.connectPromise = null
          this.setStatus('error')
          reject(err)
        },
        timer: setTimeout(() => {}),
      })
    })

    return this.connectPromise
  }

  private handleFrame(msg: any) {
    if (msg.type === 'event' && msg.event === 'connect.challenge') {
      this.sendConnect(msg.payload)
      return
    }

    if (msg.type === 'res' && msg.id === 'connect-1') {
      if (msg.ok) {
        this.connId = msg.payload?.server?.connId
        const auth = msg.payload?.auth
        if (auth?.deviceToken) {
          this.deviceToken = auth.deviceToken
        }
        const pending = this.pending.get('__connect__')
        if (pending) {
          this.pending.delete('__connect__')
          clearTimeout(pending.timer)
          pending.resolve(msg.payload)
        }
      } else {
        const pending = this.pending.get('__connect__')
        if (pending) {
          this.pending.delete('__connect__')
          clearTimeout(pending.timer)
          pending.reject(new Error(`${msg.error?.message || 'auth failed'}`))
        }
        this.ws?.close()
      }
      return
    }

    if (msg.type === 'res') {
      const pending = this.pending.get(msg.id)
      if (pending) {
        this.pending.delete(msg.id)
        clearTimeout(pending.timer)
        if (msg.ok) {
          pending.resolve(msg.payload)
        } else {
          pending.reject(new Error(`${msg.error?.code}: ${msg.error?.message}`))
        }
      }
      return
    }

    if (msg.type === 'event') {
      this.onEventCb?.(msg.event, msg.payload)
      return
    }
  }

  private sendConnect(challenge: any) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return

    const { nonce, ts } = challenge
    const privKeyObj = crypto.createPrivateKey({ key: this.privKeyDer, format: 'der', type: 'pkcs8' })
    const payloadStr = buildV3Payload(
      this.identity.deviceId, 'cli', 'cli', 'operator',
      ['operator.read', 'operator.write'],
      ts, this.authToken, nonce, 'linux', '',
    )
    const sig = crypto.sign(null, Buffer.from(payloadStr, 'utf-8'), privKeyObj)
    const sigB64url = sig.toString('base64url')

    this.ws.send(JSON.stringify({
      type: 'req', id: 'connect-1', method: 'connect',
      params: {
        minProtocol: 3, maxProtocol: 4,
        client: { id: 'cli', version: '1.0.0', platform: 'linux', mode: 'cli' },
        role: 'operator',
        scopes: ['operator.read', 'operator.write'],
        auth: { token: this.authToken },
        device: {
          id: this.identity.deviceId,
          publicKey: this.identity.publicKey,
          signature: sigB64url,
          signedAt: ts,
          nonce,
        },
        locale: 'en-US',
        userAgent: 'agent-hub-bridge/1.0.0',
      },
    }))
  }

  async request(method: string, params?: unknown): Promise<unknown> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('Not connected')
    }
    const id = `req-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error(`Request timeout: ${method}`))
      }, 60000)
      this.pending.set(id, { resolve, reject, timer })
      this.ws!.send(JSON.stringify({ type: 'req', id, method, params: params || {} }))
    })
  }

  async executeCommand(cmd: CommandRequest): Promise<CommandResponse> {
    try {
      if (this.status !== 'connected') {
        await this.connect()
      }

      const commandStr = cmd.payload || cmd.command
      const result = await this.request('chat.send', {
        sessionKey: 'agent:main:main',
        message: `${commandStr}`,
        idempotencyKey: `hub-cmd-${cmd.id}`,
      })

      return {
        id: cmd.id,
        agentId: cmd.agentId,
        ok: true,
        result,
        timestamp: Date.now(),
      }
    } catch (err: any) {
      return {
        id: cmd.id,
        agentId: cmd.agentId,
        ok: false,
        error: err.message,
        timestamp: Date.now(),
      }
    }
  }

  private startHeartbeat() {
    this.heartbeatTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.request('health').catch(() => {})
      }
    }, 30000)
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return
    if (this.connectPromise) return
    const delay = Math.min(1000 * 2 ** this.connectCount, 30000)
    this.connectCount++
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      if (this.status !== 'connected' && !this.connectPromise) {
        this.connect().catch((err) => console.error(`[gw-bridge] ${this.agent.id} reconnect: ${err.message}`))
      }
    }, delay)
  }

  private rejectAllPending(err: Error) {
    for (const [id, p] of this.pending) {
      clearTimeout(p.timer)
      p.reject(err)
    }
    this.pending.clear()
  }

  disconnect() {
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null }
    if (this.heartbeatTimer) { clearInterval(this.heartbeatTimer); this.heartbeatTimer = null }
    this.rejectAllPending(new Error('Disconnected'))
    this.ws?.close()
    this.ws = null
    this.connectPromise = null
    this.setStatus('disconnected')
  }
}

export class GatewayBridgeManager {
  private bridges = new Map<string, GatewayBridge>()

  getOrCreate(agent: AgentRegistration, authToken: string, identityPath: string): GatewayBridge {
    let bridge = this.bridges.get(agent.id)
    if (!bridge) {
      bridge = new GatewayBridge(agent, authToken, identityPath)
      bridge.onStatus((status) => {
        console.log(`[gw-bridge] ${agent.id} status: ${status}`)
      })
      bridge.onEvent((event, payload) => {
        if (event === 'health' || event === 'tick') return
        console.log(`[gw-bridge] ${agent.id} event: ${event}`, JSON.stringify(payload).substring(0, 200))
      })
      this.bridges.set(agent.id, bridge)
    }
    return bridge
  }

  get(agentId: string): GatewayBridge | undefined {
    return this.bridges.get(agentId)
  }

  remove(agentId: string) {
    this.bridges.get(agentId)?.disconnect()
    this.bridges.delete(agentId)
  }

  removeAll() {
    for (const [, bridge] of this.bridges) bridge.disconnect()
    this.bridges.clear()
  }
}
