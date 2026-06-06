import WebSocket from 'ws';

const TOKEN = '8a21bb037f384d32c506f06236dea86d98ddcabb8450577c';
const ws = new WebSocket('ws://127.0.0.1:18790');
let connId = '';
let replyReceived = false;

ws.on('open', () => console.log('[ws] connected'));

ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());

  if (msg.type === 'event' && msg.event === 'connect.challenge') {
    console.log('[acp] challenge received, sending connect...');
    ws.send(JSON.stringify({
      type: 'req', id: 'connect-1', method: 'connect',
      params: {
        minProtocol: 3, maxProtocol: 4,
        client: { id: 'cli', version: '1.0.0', platform: 'wsl', mode: 'backend' },
        auth: { token: TOKEN },
        scopes: ['operator.read', 'operator.write'],
      },
    }));
    return;
  }

  if (msg.type === 'res' && msg.id === 'connect-1' && msg.ok) {
    connId = msg.payload.server.connId;
    console.log(`[acp] connected! connId=${connId}, sending message...`);

    // Subscribe to session messages first
    ws.send(JSON.stringify({
      type: 'req', id: 'sub-sessions', method: 'sessions.messages.subscribe',
      params: {
        sessionKeys: ['agent:main:main'],
        since: Date.now(),
      },
    }));
    console.log('[acp] subscribed to session messages');

    // Send a message to the agent
    ws.send(JSON.stringify({
      type: 'req', id: 'chat-send-1', method: 'chat.send',
      params: {
        sessionKey: 'agent:main:main',
        message: '你好，我是 Agent Hub 测试消息。请简单回复 "hi from xiaobao" 即可。',
      },
    }));
    console.log('[acp] sent message to agent');
    return;
  }

  // Listen for chat/session events (streaming response)
  if (msg.type === 'event') {
    console.log(`[event] ${msg.event}:`, JSON.stringify(msg.payload).substring(0, 200));
    if (msg.event === 'session.message' || msg.event === 'chat') {
      replyReceived = true;
    }
  }

  if (msg.type === 'res') {
    console.log(`[res] ${msg.id} ok=${msg.ok}:`, JSON.stringify(msg.payload || msg.error).substring(0, 300));
    if (msg.id === 'chat-send-1' && msg.ok) {
      // Message accepted, wait for streaming response via events
      setTimeout(() => {
        if (!replyReceived) {
          console.log('\n[result] no streaming events received, checking session...');
          ws.send(JSON.stringify({
            type: 'req', id: 'history-1', method: 'chat.history',
            params: { sessionKey: 'agent:main:main', limit: 5 },
          }));
        }
      }, 15000);
    }
    if (msg.id === 'history-1') {
      const history = msg.payload?.messages || msg.payload;
      console.log('\n=== CHAT HISTORY ===');
      console.log(JSON.stringify(history, null, 2).substring(0, 2000));
      ws.close();
      setTimeout(() => process.exit(0), 500);
    }
  }
});

ws.on('error', (err) => { console.error('[ws] error:', err.message); });
ws.on('close', () => {
  console.log('[ws] closed');
  if (!replyReceived) setTimeout(() => process.exit(1), 500);
});

setTimeout(() => {
  console.log('[timeout] no response within 25s');
  process.exit(1);
}, 25000);
