import WebSocket from 'ws';
import crypto from 'crypto';

const TOKEN = '8a21bb037f384d32c506f06236dea86d98ddcabb8450577c';
const ws = new WebSocket('ws://127.0.0.1:18790');

ws.on('open', () => console.log('Connected, waiting for challenge...'));

ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  console.log('RECV:', JSON.stringify(msg).substring(0, 120));

  if (msg.type === 'event' && msg.event === 'connect.challenge') {
    const { nonce, ts } = msg.payload;
    console.log('Challenge received, responding...');

    ws.send(JSON.stringify({
      type: 'req',
      id: 'connect-1',
      method: 'connect',
      params: {
        minProtocol: 3,
        maxProtocol: 4,
        client: { id: 'cli', version: '1.0.0', platform: 'wsl', mode: 'backend' },
        role: 'operator',
        scopes: ['operator.read', 'operator.write'],
        caps: [],
        commands: [],
        permissions: {},
        auth: { token: TOKEN },
        locale: 'en-US',
        userAgent: 'agent-hub-bridge/1.0.0',
      },
    }));
    console.log('Sent connect request');
  }

  if (msg.type === 'res' && msg.ok) {
    console.log('CONNECTED! Response:', JSON.stringify(msg.payload).substring(0, 300));
    ws.close(); process.exit(0);
  }

  if (msg.type === 'res' && !msg.ok) {
    console.log('FAILED:', JSON.stringify(msg.error));
    ws.close(); process.exit(1);
  }
});

ws.on('error', (err) => console.error('ERR:', err.message));
ws.on('close', (code, reason) => {
  console.log(`Close(${code}): ${reason?.toString() || ''}`);
  process.exit(code && code !== 1000 ? 1 : 0);
});
setTimeout(() => { console.log('TIMEOUT'); process.exit(1); }, 8000);
