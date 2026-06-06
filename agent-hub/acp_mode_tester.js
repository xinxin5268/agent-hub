import WebSocket from 'ws';
import crypto from 'crypto';

const TOKEN = '8a21bb037f384d32c506f06236dea86d98ddcabb8450577c';

const modes = ['operator', 'headless', 'browser', 'cli', 'daemon', 'node', 'control', 'standard', 'agent', 'service'];
let modeIdx = 0;

function tryConnect() {
  if (modeIdx >= modes.length) { console.log('All modes failed'); process.exit(1); return; }
  const mode = modes[modeIdx];
  const ws = new WebSocket('ws://127.0.0.1:18790');
  console.log(`Trying mode="${mode}"...`);

  ws.on('message', (data) => {
    const msg = JSON.parse(data.toString());
    if (msg.type === 'event' && msg.event === 'connect.challenge') {
      const { nonce, ts } = msg.payload;
      const deviceId = crypto.createHash('sha256').update('agent-hub-bridge').digest('hex').substring(0, 16);
      const pubKey = crypto.createHash('sha256').update('pub-' + deviceId).digest('base64');
      const sig = crypto.createHmac('sha256', TOKEN).update(nonce).digest('base64');

      ws.send(JSON.stringify({
        type: 'req', id: 'connect-1', method: 'connect',
        params: {
          minProtocol: 3, maxProtocol: 4,
          client: { id: 'cli', version: '1.0.0', platform: 'wsl', mode },
          role: 'operator', scopes: ['operator.read', 'operator.write'],
          caps: [], commands: [], permissions: {},
          auth: { token: TOKEN },
          locale: 'en-US', userAgent: 'agent-hub-bridge/1.0.0',
          device: { id: deviceId, publicKey: pubKey, signature: sig, signedAt: ts, nonce },
        },
      }));
    }
    if (msg.type === 'res') {
      if (msg.ok) {
        console.log(`SUCCESS! mode="${mode}"`);
        console.log('Response:', JSON.stringify(msg.payload).substring(0, 300));
        ws.close(); process.exit(0);
      } else {
        console.log(`FAIL(${mode}): ${msg.error?.message}`);
        modeIdx++; ws.close();
      }
    }
  });

  ws.on('close', (code) => { if (code !== 1000) { modeIdx++; setTimeout(tryConnect, 100); } });
}

tryConnect();
