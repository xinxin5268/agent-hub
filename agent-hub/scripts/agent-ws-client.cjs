#!/usr/bin/env node
/**
 * Agent WS 注册客户端
 * 
 * 每个 Agent 启动时运行此脚本，通过 WebSocket 连接到注册中心。
 * 连接后自动注册、定时心跳、接收指令，断线自动重连。
 * 
 * 用法:
 *   node agent-ws-client.js --id=xiaobao --name="小宝 (CEO)" --type=openclaw-gateway --ws=ws://127.0.0.1:3210/ws
 *   node agent-ws-client.js --id=opencode-wsl --name="OpenCode (WSL)" --type=opencode --ws=ws://192.168.1.100:3210/ws
 * 
 * 环境变量:
 *   AGENT_ID, AGENT_NAME, AGENT_TYPE, AGENT_PLATFORM, AGENT_HOST, AGENT_PORT
 *   REGISTRY_WS (注册中心 WS 地址)
 *   AGENT_WS_URL, AGENT_HTTP_URL (Agent 自身的服务地址)
 */

const WebSocket = require('ws');
const http = require('http');
const os = require('os');

// ─── 配置 ───────────────────────────────────────────────
const args = {};
process.argv.slice(2).forEach(arg => {
  if (arg.startsWith('--')) {
    const [k, v] = arg.slice(2).split('=');
    args[k] = v || true;
  }
});

const config = {
  id: args.id || process.env.AGENT_ID || os.hostname(),
  name: args.name || process.env.AGENT_NAME || os.hostname(),
  type: args.type || process.env.AGENT_TYPE || 'custom',
  platform: args.platform || process.env.AGENT_PLATFORM || 
    (os.platform() === 'win32' ? 'windows' : 
     (() => { try { return require('fs').readFileSync('/proc/version','utf8').toLowerCase().includes('microsoft') ? 'wsl' : 'linux'; } catch { return 'linux'; } })()),
  host: args.host || process.env.AGENT_HOST || getLocalIP(),
  port: parseInt(args.port || process.env.AGENT_PORT || '0'),
  wsUrl: args['agent-ws'] || process.env.AGENT_WS_URL || '',
  httpUrl: args['agent-http'] || process.env.AGENT_HTTP_URL || '',
  registryWs: args.ws || process.env.REGISTRY_WS || 'ws://127.0.0.1:3210/ws',
  registryHttp: args.http || process.env.REGISTRY_HTTP || 'http://127.0.0.1:3210',
  tags: args.tags ? JSON.parse(args.tags) : (process.env.AGENT_TAGS ? JSON.parse(process.env.AGENT_TAGS) : {}),
  version: args.version || '1.0.0',
  reconnectDelay: 3000,
  heartbeatInterval: 30000,
};

function getLocalIP() {
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address;
    }
  }
  return '127.0.0.1';
}

// ─── 状态 ───────────────────────────────────────────────
let ws = null;
let reconnectTimer = null;
let heartbeatTimer = null;
let reconnectCount = 0;
let registered = false;
let lastMessageId = 0;

// ─── 日志 ───────────────────────────────────────────────
function log(level, msg, data) {
  const ts = new Date().toISOString().slice(11, 23);
  const prefix = { info: 'ℹ️', ok: '✅', warn: '⚠️', error: '❌', msg: '📨' }[level] || '•';
  console.log(`[${ts}] ${prefix} [${config.id}] ${msg}${data ? ' ' + JSON.stringify(data) : ''}`);
}

// ─── 注册到注册中心 (HTTP fallback) ────────────────────
function httpRegister() {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      action: 'register',
      agent: buildAgentInfo(),
    });

    const req = http.request(`${config.registryHttp}/api/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
      timeout: 5000,
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const r = JSON.parse(data);
          r.ok ? resolve(r) : reject(new Error(r.error || 'register failed'));
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.write(body);
    req.end();
  });
}

// ─── 心跳 (HTTP fallback) ──────────────────────────────
function httpHeartbeat() {
  const body = JSON.stringify({ agentId: config.id });
  const req = http.request(`${config.registryHttp}/api/heartbeat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    timeout: 3000,
  });
  req.on('error', () => {});
  req.write(body);
  req.end();
}

// ─── 构建 Agent 信息 ───────────────────────────────────
function buildAgentInfo() {
  return {
    id: config.id,
    name: config.name,
    type: config.type,
    platform: config.platform,
    host: config.host,
    port: config.port,
    wsUrl: config.wsUrl || `ws://${config.host}:${config.port}`,
    httpUrl: config.httpUrl || `http://${config.host}:${config.port}`,
    status: 'online',
    version: config.version,
    tags: config.tags,
    launchPath: args['launch-path'] || process.env.AGENT_LAUNCH_PATH || '',
    launchCommand: args['launch-command'] || process.env.AGENT_LAUNCH_COMMAND || '',
    lastHeartbeat: Date.now(),
    registeredAt: Date.now(),
  };
}

// ─── 发送消息到注册中心 ────────────────────────────────
function wsSend(msg) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
    return true;
  }
  return false;
}

// ─── WebSocket 连接 ─────────────────────────────────────
function connect() {
  if (ws) {
    try { ws.close(); } catch {}
    ws = null;
  }

  const url = `${config.registryWs}?agentId=${config.id}`;
  log('info', `正在连接注册中心 ${url}${reconnectCount > 0 ? ` (重连 #${reconnectCount})` : ''}`);

  ws = new WebSocket(url);
  const connTimeout = setTimeout(() => {
    log('warn', '连接超时');
    ws.close();
  }, 10000);

  ws.on('open', () => {
    clearTimeout(connTimeout);
    reconnectCount = 0;
    log('ok', `已连接注册中心 ${config.registryWs}`);

    // 发送注册信息
    wsSend({ action: 'register', agent: buildAgentInfo() });
    registered = true;

    // 启动心跳
    clearInterval(heartbeatTimer);
    heartbeatTimer = setInterval(() => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        wsSend({ action: 'heartbeat' });
      } else {
        httpHeartbeat();
      }
    }, config.heartbeatInterval);

    log('ok', `注册成功: ${config.name} (${config.id})`);

    // 拉取注册中心的消息队列（断线重连后获取积压消息）
    const registryUrl = config.registryWs.replace('ws://', 'http://').replace(/\/ws$/, '')
    const queueUrl = `${registryUrl}/api/messages/${config.id}`
    log('info', `拉取队列消息: ${queueUrl}`)
    fetch(queueUrl)
      .then(r => r.json())
      .then(data => {
        const msgs = data.messages || []
        log('info', `队列拉取结果: ${msgs.length} 条`)
        if (msgs.length > 0) {
          msgs.forEach(msg => {
            log('info', `  [队列] ${msg.from}: ${msg.content?.slice(0,100)}`)
            if (typeof onCommand === 'function') {
              onCommand({ command: 'chat', from: msg.from, payload: msg.content, messageId: msg.id })
            }
          })
        }
      })
      .catch(e => log('warn', `拉取队列消息失败: ${e.message}`))
  });

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      handleMessage(msg);
    } catch (e) {
      log('error', `消息解析失败: ${e.message}`);
    }
  });

  ws.on('close', (code, reason) => {
    clearTimeout(connTimeout);
    registered = false;
    log('warn', `连接关闭 (${code}): ${reason || '无原因'}`);
    ws = null;
    scheduleReconnect();
  });

  ws.on('error', (err) => {
    clearTimeout(connTimeout);
    log('error', `连接错误: ${err.message}`);
    // error 后 close 事件会触发，不用重复重连
  });
}

// ─── 消息处理 ───────────────────────────────────────────
function handleMessage(msg) {
  switch (msg.type) {
    case 'command':
      handleCommand(msg.command);
      break;

    case 'agent:message':
      log('msg', `来自 ${msg.message?.from || '未知'} → ${msg.message?.content?.slice(0, 100)}`);
      // Agent 收到消息后可以在这里处理
      onMessage?.(msg.message);
      break;

    case 'registry:state':
      log('info', `收到注册中心状态: ${msg.stats?.total || 0} 个 Agent`);
      break;

    case 'register:response':
      if (msg.ok) {
        log('ok', 'WS 注册确认');
      }
      break;

    default:
      log('info', `收到未知消息类型: ${msg.type}`);
  }
}

// ─── 指令处理 ───────────────────────────────────────────
function handleCommand(cmd) {
  if (!cmd || !cmd.command) return;

  log('info', `收到指令: ${cmd.command}${cmd.payload ? ` → ${cmd.payload.slice(0, 80)}` : ''}`);

  switch (cmd.command) {
    case 'exec':
      // 远程执行 shell 命令
      log('info', `[执行] ${cmd.payload}`);
      executeCommand(cmd);
      break;

    case 'chat':
      log('msg', `[chat] ${cmd.from || '未知'}: ${cmd.payload?.slice(0, 200)}`);
      // 调用外部回调处理任务（如果有注册）
      if (typeof onCommand === 'function') {
        onCommand(cmd);
      }
      // 通过 hermes CLI 执行 chat 指令（仅 hermes 类型 agent）
      if (config.type === 'hermes') {
        executeHermesChat(cmd);
      }
      // 自动回复一条消息给注册中心
      if (cmd.from) {
        wsSend({
          action: 'message',
          message: {
            id: `chat-${Date.now()}`,
            from: config.id,
            fromName: config.name,
            to: cmd.from,
            content: `[${config.name}] 收到消息: ${cmd.payload?.slice(0, 100)}`,
            type: 'chat',
            timestamp: Date.now(),
          },
        });
      }
      break;

    case 'status':
      // 返回 Agent 状态
      wsSend({
        action: 'message',
        message: {
          id: `res-${Date.now()}`,
          from: config.id,
          fromName: config.name,
          to: cmd.from || 'registry',
          content: JSON.stringify({
            status: 'online',
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            platform: config.platform,
            host: config.host,
          }),
          type: 'command',
          timestamp: Date.now(),
        },
      });
      break;

    case 'restart':
      log('warn', '收到重启指令，5 秒后重启...');
      setTimeout(() => {
        ws?.close();
        connect();
      }, 5000);
      break;

    default:
      log('warn', `未知指令: ${cmd.command}`);
  }
}

// ─── 远程命令执行 ───────────────────────────────────────
function executeCommand(cmd) {
  const { execSync } = require('child_process');
  try {
    const result = execSync(cmd.payload || '', {
      encoding: 'utf-8',
      timeout: 30000,
      maxBuffer: 1024 * 1024,
    }).toString();
    
    log('ok', `命令执行成功 (${result.length} 字符)`);
    
    // 发送结果回注册中心
    wsSend({
      action: 'message',
      message: {
        id: `exec-${Date.now()}`,
        from: config.id,
        fromName: config.name,
        to: cmd.from || 'registry',
        content: result.slice(0, 50000),
        type: 'command',
        timestamp: Date.now(),
      },
    });
  } catch (e) {
    log('error', `命令执行失败: ${e.message}`);
    wsSend({
      action: 'message',
      message: {
        id: `exec-${Date.now()}`,
        from: config.id,
        fromName: config.name,
        to: cmd.from || 'registry',
        content: `❌ 执行失败: ${e.message}`,
        type: 'command',
        timestamp: Date.now(),
      },
    });
  }
}

// ─── Hermes Chat 执行 ────────────────────────────────────
function executeHermesChat(cmd) {
  const { execSync } = require('child_process');
  const query = cmd.payload || cmd.params?.query || '';
  if (!query) {
    log('warn', 'chat 指令内容为空，跳过');
    return;
  }
  log('info', `[hermes] 开始执行 chat: ${query.slice(0, 80)}...`);
  try {
    const result = execSync(
      `hermes chat -q ${JSON.stringify(query)} --max-turns 10 2>&1`,
      { encoding: 'utf-8', timeout: 300000, maxBuffer: 10 * 1024 * 1024 }
    ).toString();
    log('ok', `[hermes] chat 完成 (${result.length} 字符)`);
    // 发送结果回注册中心
    if (cmd.from) {
      wsSend({
        action: 'message',
        message: {
          id: `chat-res-${Date.now()}`,
          from: config.id,
          fromName: config.name,
          to: cmd.from,
          content: result.slice(0, 50000),
          type: 'command',
          timestamp: Date.now(),
        },
      });
    }
  } catch (e) {
    log('error', `[hermes] chat 执行失败: ${e.message}`);
    if (cmd.from) {
      wsSend({
        action: 'message',
        message: {
          id: `chat-res-${Date.now()}`,
          from: config.id,
          fromName: config.name,
          to: cmd.from,
          content: `❌ 执行失败: ${e.message}`,
          type: 'command',
          timestamp: Date.now(),
        },
      });
    }
  }
}

// ─── 回调（供外部集成） ─────────────────────────────────
let onMessage = null;
let onCommand = null;

function setOnMessage(cb) { onMessage = cb; }
function setOnCommand(cb) { onCommand = cb; }

// ─── 重连 ───────────────────────────────────────────────
function scheduleReconnect() {
  if (reconnectTimer) return;
  const delay = Math.min(config.reconnectDelay * Math.pow(1.5, reconnectCount), 30000);
  reconnectCount++;
  log('info', `${delay / 1000}s 后重连...`);
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect();
  }, delay);
}

// ─── 发送消息 ───────────────────────────────────────────
function sendMessage(to, content, type = 'chat') {
  const msg = {
    id: `msg-${Date.now()}-${++lastMessageId}`,
    from: config.id,
    fromName: config.name,
    to,
    content,
    type,
    timestamp: Date.now(),
  };

  if (!wsSend({ action: 'message', message: msg })) {
    log('warn', 'WS 未连接，消息入队列');
    return false;
  }
  log('ok', `消息已发送 → ${to}`);
  return true;
}

// ─── 启动 ───────────────────────────────────────────────
function start() {
  log('info', `启动 Agent WS 客户端`);
  log('info', `  ID:       ${config.id}`);
  log('info', `  名称:     ${config.name}`);
  log('info', `  类型:     ${config.type}`);
  log('info', `  平台:     ${config.platform}`);
  log('info', `  主机:     ${config.host}:${config.port}`);
  log('info', `  注册中心: ${config.registryWs}`);
  console.log('');

  // 先 HTTP 注册一次，确保即使 WS 失败也有记录
  httpRegister()
    .then(() => log('ok', 'HTTP 注册成功'))
    .catch((e) => log('warn', `HTTP 注册失败: ${e.message} (WS 连接后会重试)`));

  // 建立 WS 连接
  connect();

  // 优雅退出
  process.on('SIGINT', () => {
    log('info', '正在断开...');
    clearInterval(heartbeatTimer);
    clearTimeout(reconnectTimer);
    if (ws) {
      wsSend({ action: 'unregister' });
      ws.close();
    }
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    clearInterval(heartbeatTimer);
    clearTimeout(reconnectTimer);
    ws?.close();
    process.exit(0);
  });
}

// ─── 导出（供其他模块使用） ────────────────────────────
module.exports = { start, sendMessage, setOnMessage, setOnCommand, config, buildAgentInfo };

// 直接运行时启动
if (require.main === module) {
  start();
}
