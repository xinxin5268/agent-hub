import WebSocket from 'ws';

const TOKEN = '8a21bb037f384d32c506f06236dea86d98ddcabb8450577c';
const ws = new WebSocket('ws://127.0.0.1:18790');
let ready = false;
const queued = [];

function send(method, params = {}, label = method) {
  if (!ready) { queued.push({ method, params, label }); return; }
  const id = `req-${Date.now()}-${Math.random().toString(36).substr(2,6)}`;
  ws.send(JSON.stringify({ type: 'req', id, method, params }));
  console.log(`>> ${label}`);
}

ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());

  if (msg.type === 'event' && msg.event === 'connect.challenge') {
    ws.send(JSON.stringify({
      type: 'req', id: 'connect-1', method: 'connect',
      params: {
        minProtocol: 3, maxProtocol: 4,
        client: { id: 'cli', version: '1.0.0', platform: 'wsl', mode: 'cli' },
        auth: { token: TOKEN },
      },
    }));
    console.log('>> connect');
    return;
  }

  if (msg.type === 'res' && msg.id === 'connect-1' && msg.ok) {
    ready = true;
    console.log('<< CONNECTED!');
    for (const q of queued) send(q.method, q.params, q.label);
    return;
  }

  if (msg.type === 'res') {
    const payload = msg.payload || msg.error;
    const str = JSON.stringify(payload);
    console.log(`<< ${msg.id} ok=${msg.ok}: ${str.substring(0, 600)}`);
  }

  if (msg.type === 'event' && msg.event !== 'health' && msg.event !== 'tick') {
    console.log(`<< event:${msg.event}:`, JSON.stringify(msg.payload).substring(0, 300));
  }
});

ws.on('error', (err) => console.error('ERR:', err.message));
ws.on('close', () => { console.log('CLOSED'); process.exit(0); });

// Queue methods to run immediately after connect
setTimeout(() => send('agents.list', {}, 'agents.list'), 100);
setTimeout(() => send('sessions.list', {}, 'sessions.list'), 300);
setTimeout(() => send('tasks.list', {}, 'tasks.list'), 500);
setTimeout(() => send('commands.list', {}, 'commands.list'), 700);
setTimeout(() => send('models.list', {}, 'models.list'), 900);
setTimeout(() => send('environments.list', {}, 'environments.list'), 1100);
setTimeout(() => send('tools.catalog', {}, 'tools.catalog'), 1300);
setTimeout(() => send('config.get', { path: 'gateway' }, 'config.get'), 1500);
setTimeout(() => send('skills.status', {}, 'skills.status'), 1700);
setTimeout(() => send('status', {}, 'status'), 1900);
setTimeout(() => {
  console.log('\n=== DONE ===');
  ws.close();
}, 5000);
