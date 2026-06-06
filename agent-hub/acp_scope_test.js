import WebSocket from 'ws';

const TOKEN = '8a21bb037f384d32c506f06236dea86d98ddcabb8450577c';

async function tryConnect(clientId, mode) {
  return new Promise((resolve) => {
    const ws = new WebSocket('ws://127.0.0.1:18790');
    const timer = setTimeout(() => { ws.close(); resolve(null); }, 5000);

    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'event' && msg.event === 'connect.challenge') {
        ws.send(JSON.stringify({
          type: 'req', id: 'connect-1', method: 'connect',
          params: {
            minProtocol: 3, maxProtocol: 4,
            client: { id: clientId, version: '1.0', platform: 'wsl', mode },
            auth: { token: TOKEN },
          },
        }));
      }
      if (msg.type === 'res' && msg.id === 'connect-1') {
        clearTimeout(timer);
        ws.close();
        resolve(msg.ok ? msg.payload.auth : msg.error);
      }
    });
    ws.on('error', () => { clearTimeout(timer); resolve(null); });
  });
}

const combos = [
  ['cli', 'cli'],
  ['webchat', 'webchat'],
  ['openclaw-tui', 'ui'],
  ['openclaw-control-ui', 'ui'],
  ['openclaw-macos', 'ui'],
  ['node-host', 'node'],
  ['test', 'test'],
  ['probe', 'probe'],
  ['gateway-client', 'backend'],
];

for (const [id, mode] of combos) {
  const result = await tryConnect(id, mode);
  if (result?.scopes) {
    console.log(`${id}/${mode}: role=${result.role} scopes=[${result.scopes.join(',')}] deviceToken=${result.deviceToken ? 'yes' : 'no'}`);
  } else {
    console.log(`${id}/${mode}: FAIL ${JSON.stringify(result)}`);
  }
}
