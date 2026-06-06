import WebSocket from 'ws';

const TOKEN = '8a21bb037f384d32c506f06236dea86d98ddcabb8450577c';
const ws = new WebSocket('ws://127.0.0.1:18790');

ws.on('open', () => console.log('Connected'));

ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());

  if (msg.type === 'event' && msg.event === 'connect.challenge') {
    ws.send(JSON.stringify({
      type: 'req', id: 'connect-1', method: 'connect',
      params: {
        minProtocol: 3, maxProtocol: 4,
        client: { id: 'cli', version: '1.0.0', platform: 'wsl', mode: 'backend' },
        auth: { token: TOKEN },
      },
    }));
  }

  if (msg.type === 'res' && msg.id === 'connect-1' && msg.ok) {
    const featured = msg.payload.features;
    console.log('=== METHODS ===');
    console.log(JSON.stringify(featured.methods, null, 2));
    console.log('=== EVENTS ===');
    console.log(JSON.stringify(featured.events, null, 2));
    console.log('=== AUTH ===');
    console.log(JSON.stringify(msg.payload.auth, null, 2));
    console.log('=== POLICY ===');
    console.log(JSON.stringify(msg.payload.policy, null, 2));
    ws.close();
    setTimeout(() => process.exit(0), 500);
  }

  if (msg.type === 'res' && !msg.ok) {
    console.log('FAIL:', JSON.stringify(msg.error));
    ws.close();
    setTimeout(() => process.exit(1), 500);
  }
});

ws.on('error', (err) => { console.error('ERR:', err.message); process.exit(1); });
setTimeout(() => { console.log('TIMEOUT'); process.exit(1); }, 8000);
