#!/usr/bin/env node
/**
 * ACP WebSocket Bridge v2
 * 
 * 监听 WebSocket 端口，将 ACP 协议消息转发到 hermes acp stdio 进程。
 * 支持 JSON-RPC 2.0 格式，处理 initialize 握手、sessions.send、prompt 等。
 * 
 * 用法:
 *   node acp-bridge.cjs --port=8765
 */

const WebSocket = require('ws');
const { spawn } = require('child_process');
const os = require('os');

const args = {};
process.argv.slice(2).forEach(arg => {
  if (arg.startsWith('--')) {
    const [k, v] = arg.slice(2).split('=');
    args[k] = v || true;
  }
});

const PORT = parseInt(args.port || process.env.ACP_PORT || '8765');
const HERMES_HOME = process.env.HERMES_HOME || '/home/chenxin520/.hermes';

// ─── 日志 ───────────────────────────────────────────────
function log(level, msg) {
  const ts = new Date().toISOString().slice(11, 23);
  const prefix = { info: 'ℹ️', ok: '✅', warn: '⚠️', error: '❌', debug: '🔍' }[level] || '•';
  console.log(`[${ts}] ${prefix} [acp-bridge] ${msg}`);
}

// ─── ACP 子进程 ─────────────────────────────────────────
let acpProcess = null;
let pendingAcp = [];
let initialized = false;
let nextRequestId = 1;
const pendingResponses = new Map(); // requestId -> { resolve, reject, collectedContent }

function startAcp() {
  if (acpProcess) return;
  
  log('info', `Starting hermes acp (HOME=${HERMES_HOME})`);
  acpProcess = spawn('hermes', ['acp'], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, HERMES_HOME },
    cwd: HERMES_HOME,
  });

  acpProcess.stdout.on('data', (data) => {
    const text = data.toString();
    // Parse newline-delimited JSON-RPC responses
    const lines = text.split('\n').filter(l => l.trim());
    for (const line of lines) {
      try {
        const msg = JSON.parse(line);
        log('debug', `ACP response: ${JSON.stringify(msg).slice(0, 200)}`);
        
        // Handle response to our request
        if (msg.id !== undefined && pendingResponses.has(msg.id)) {
          const entry = pendingResponses.get(msg.id);
          pendingResponses.delete(msg.id);
          if (msg.error) {
            entry.resolve({ error: msg.error });
          } else {
            // Merge collected content into the result
            if (entry.collectedContent.length > 0) {
              msg.result.content = entry.collectedContent;
            }
            entry.resolve(msg.result);
          }
          continue;
        }
        
        // Handle notification (no id) - collect session/update chunks
        if (msg.method && !('id' in msg)) {
          // Collect agent_message_chunk for pending requests
          if (msg.method === 'session/update' && msg.params?.update?.sessionUpdate === 'agent_message_chunk') {
            const textContent = msg.params?.update?.content?.text;
            if (textContent) {
              for (const [, entry] of pendingResponses) {
                entry.collectedContent.push({ type: 'text', text: textContent });
              }
            }
          }
          // Forward other notifications to all clients
          for (const [, client] of clients) {
            try {
              client.ws.send(JSON.stringify({
                type: 'acp_notification',
                method: msg.method,
                data: msg.params,
              }));
            } catch (e) {}
          }
        }
      } catch (e) {
        log('warn', `Parse error on ACP stdout: ${line.slice(0, 100)}`);
      }
    }
  });

  acpProcess.stderr.on('data', (data) => {
    const text = data.toString();
    // Log stderr to all connected clients
    for (const [, client] of clients) {
      try {
        client.ws.send(JSON.stringify({
          type: 'stderr',
          data: text,
        }));
      } catch (e) {}
    }
  });

  acpProcess.on('exit', (code) => {
    log('warn', `hermes acp exited with code ${code}, restarting in 3s...`);
    acpProcess = null;
    initialized = false;
    // Reject all pending requests
    for (const [id, { reject }] of pendingResponses) {
      reject(new Error('hermes acp exited'));
      pendingResponses.delete(id);
    }
    setTimeout(startAcp, 3000);
  });

  acpProcess.on('error', (err) => {
    log('error', `hermes acp spawn error: ${err.message}`);
  });
}

// ─── JSON-RPC 2.0 封装 ──────────────────────────────────
function toJsonRpc(method, params, id) {
  const msg = { jsonrpc: '2.0', method, params: params || {} };
  if (id !== undefined) msg.id = id;
  return msg;
}

async function sendAcpRequest(method, params, requestId) {
  return new Promise((resolve, reject) => {
    const id = requestId || nextRequestId++;
    const msg = toJsonRpc(method, params, id);
    
    pendingResponses.set(id, { resolve, reject, collectedContent: [] });
    
    if (acpProcess && acpProcess.stdin.writable) {
      acpProcess.stdin.write(JSON.stringify(msg) + '\n');
      log('debug', `Sent ACP request: ${method} (id=${id})`);
    } else {
      pendingAcp.push(msg);
      log('warn', `ACP not ready, queued: ${method}`);
      reject(new Error('ACP process not ready'));
    }
    
    // Timeout after 120s
    setTimeout(() => {
      if (pendingResponses.has(id)) {
        pendingResponses.delete(id);
        reject(new Error(`ACP request timeout: ${method}`));
      }
    }, 120000);
  });
}

async function ensureInitialized() {
  if (initialized) return true;
  if (!acpProcess) startAcp();
  
  // Wait for acp process to be ready
  let retries = 0;
  while (!acpProcess || !acpProcess.stdin.writable) {
    if (retries > 20) throw new Error('ACP process not starting');
    await new Promise(r => setTimeout(r, 250));
    retries++;
  }
  
  // Send initialize request
  log('info', 'Sending ACP initialize...');
  try {
    await sendAcpRequest('initialize', {
      protocolVersion: 1,
      clientInfo: { name: 'agent-hub-bridge', version: '2.0.0' },
      capabilities: {},
    });
    initialized = true;
    log('ok', 'ACP initialized');
    return true;
  } catch (e) {
    log('error', `ACP initialize failed: ${e.message}`);
    return false;
  }
}

const SESSION_CWD = '/home/chenxin520';
const SESSION_MCP_SERVERS = []; // Empty MCP servers list

async function createSession() {
  const result = await sendAcpRequest('session/new', {
    cwd: SESSION_CWD,
    mcpServers: SESSION_MCP_SERVERS,
  });
  return result;
}

// ─── 处理 ACP 会话操作 ──────────────────────────────────
async function handleSessionSend(params) {
  // ACP: send a message to an ACP session
  // params: { sessionId, message } or { message } or { text }
  const sessionId = params.sessionId;
  
  if (sessionId) {
    // Send prompt to existing session
    let promptContent;
    if (typeof params.message === 'string') {
      promptContent = [{ type: 'text', text: params.message }];
    } else if (Array.isArray(params.message)) {
      promptContent = params.message;
    } else {
      promptContent = [{ type: 'text', text: String(params.message || '') }];
    }
    return await sendAcpRequest('session/prompt', { sessionId, prompt: promptContent });
  } else {
    // No session - create one first, then prompt
    let promptContent;
    if (typeof params === 'string') {
      promptContent = [{ type: 'text', text: params }];
    } else if (Array.isArray(params)) {
      promptContent = params;
    } else {
      promptContent = [{ type: 'text', text: String(params.text || params.message || params.content || '') }];
    }
    const newSession = await createSession();
    const newSessionId = newSession?.sessionId || newSession?.session_id;
    if (newSessionId) {
      return await sendAcpRequest('session/prompt', { sessionId: newSessionId, prompt: promptContent });
    }
    return { error: 'Failed to create session' };
  }
}

// ─── WebSocket 服务器 ───────────────────────────────────
const wss = new WebSocket.Server({ port: PORT, host: '127.0.0.1' });
const clients = new Map();
let nextClientId = 1;

wss.on('connection', (ws, req) => {
  const clientId = String(nextClientId++);
  const ip = req.socket.remoteAddress;
  log('info', `Client connected: ${clientId} from ${ip}`);
  
  clients.set(clientId, { ws, connected: true });
  
  // Send welcome
  ws.send(JSON.stringify({
    type: 'welcome',
    clientId,
    port: PORT,
    timestamp: Date.now(),
  }));
  
  // Initialize ACP on first connection
  ensureInitialized().catch(err => {
    log('error', `ACP init failed: ${err.message}`);
  });

  ws.on('message', async (data) => {
    let msg;
    try {
      msg = JSON.parse(data.toString());
    } catch (e) {
      ws.send(JSON.stringify({ type: 'error', data: 'Invalid JSON' }));
      return;
    }

    // GatewayBridge connect.challenge
    if (msg.type === 'event' && msg.event === 'connect.challenge') {
      const { nonce, ts } = msg.payload;
      ws.send(JSON.stringify({
        type: 'res',
        id: 'connect-1',
        ok: true,
        payload: {
          server: { connId: `acp-${clientId}` },
          auth: { deviceToken: `token-${clientId}` },
        },
      }));
      log('debug', `Challenge response sent to ${clientId}`);
      return;
    }

    // Direct ACP command (JSON-RPC format)
    if (msg.jsonrpc === '2.0' && msg.method) {
      try {
        const result = await sendAcpRequest(msg.method, msg.params, msg.id);
        ws.send(JSON.stringify({
          type: 'acp_response',
          id: msg.id,
          result: result,
        }));
      } catch (err) {
        ws.send(JSON.stringify({
          type: 'acp_error',
          id: msg.id,
          error: err.message,
        }));
      }
      return;
    }

    // High-level command format (backward compat)
    const command = msg.type || msg.method;
    try {
      switch (command) {
        case 'prompt':
        case 'sessions.send': {
          const params = msg.params || msg.payload || { text: msg.text || msg.content || '' };
          const result = await handleSessionSend(params);
          ws.send(JSON.stringify({
            type: 'command_result',
            command,
            result: result,
          }));
          break;
        }
        case 'prompt_message': {
          const text = msg.text || msg.content || msg.message || '';
          // Create session first, then prompt
          const newSession = await createSession();
          const sessionId = newSession?.sessionId || newSession?.session_id;
          let result;
          if (sessionId) {
            result = await sendAcpRequest('session/prompt', {
              sessionId,
              prompt: [{ type: 'text', text }],
            });
          } else {
            result = { error: 'Failed to create session' };
          }
          ws.send(JSON.stringify({
            type: 'command_result',
            command: 'prompt_message',
            result: result,
          }));
          break;
        }
        case 'new_session': {
          const result = await sendAcpRequest('session/new', msg.params || {});
          ws.send(JSON.stringify({
            type: 'command_result',
            command: 'new_session',
            result: result,
          }));
          break;
        }
        case 'load_session': {
          const result = await sendAcpRequest('session/load', msg.params || {});
          ws.send(JSON.stringify({
            type: 'command_result',
            command: 'load_session',
            result: result,
          }));
          break;
        }
        default:
          // Try to forward as ACP method
          const result = await sendAcpRequest(command, msg.params || {});
          ws.send(JSON.stringify({
            type: 'command_result',
            command,
            result: result,
          }));
      }
    } catch (err) {
      ws.send(JSON.stringify({
        type: 'command_error',
        command: command,
        error: err.message,
      }));
    }
  });

  ws.on('close', () => {
    log('info', `Client disconnected: ${clientId}`);
    clients.delete(clientId);
  });

  ws.on('error', (err) => {
    log('error', `Client ${clientId} error: ${err.message}`);
  });
});

wss.on('error', (err) => {
  log('error', `Server error: ${err.message}`);
});

log('ok', `ACP bridge v2 listening on ws://127.0.0.1:${PORT}`);
log('info', `Supports: initialize, prompt, sessions.send, new_session, load_session`);

// ─── 心跳 ──────────────────────────────────────────────
setInterval(() => {
  if (acpProcess && acpProcess.stdin.writable) {
    acpProcess.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'ping' }) + '\n');
  }
}, 30000);

// ─── 优雅退出 ───────────────────────────────────────────
process.on('SIGINT', () => {
  log('info', 'Shutting down...');
  wss.close();
  if (acpProcess) acpProcess.kill();
  process.exit(0);
});

process.on('SIGTERM', () => {
  log('info', 'Shutting down...');
  wss.close();
  if (acpProcess) acpProcess.kill();
  process.exit(0);
});
