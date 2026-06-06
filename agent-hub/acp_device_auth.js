import WebSocket from 'ws';
import crypto from 'crypto';

const TOKEN = process.env.ACP_TOKEN || '⚠️ REDACTED';  // 从公开仓库移除，请通过环境变量注入

const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519', {
  publicKeyEncoding: { type: 'spki', format: 'der' },
  privateKeyEncoding: { type: 'pkcs8', format: 'der' },
});

const SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');
const rawPubKey = publicKey.subarray(SPKI_PREFIX.length);
const deviceId = crypto.createHash('sha256').update(rawPubKey).digest('hex');
const pubKeyB64url = rawPubKey.toString('base64url');

const privateKeyObj = crypto.createPrivateKey({ key: privateKey, format: 'der', type: 'pkcs8' });

function buildV3Payload(deviceId, clientId, clientMode, role, scopes, signedAtMs, token, nonce, platform, deviceFamily) {
  return [
    'v3', deviceId, clientId, clientMode, role,
    scopes.join(','),
    String(signedAtMs),
    token || '',
    nonce,
    (platform || '').trim().toLowerCase(),
    (deviceFamily || '').trim().toLowerCase(),
  ].join('|');
}

const ws = new WebSocket('ws://127.0.0.1:18790');

ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());

  if (msg.type === 'event' && msg.event === 'connect.challenge') {
    const { nonce, ts } = msg.payload;

    // Build v3 payload
    const payloadStr = buildV3Payload(
      deviceId, 'cli', 'cli', 'operator',
      ['operator.read', 'operator.write'],
      ts, TOKEN, nonce, 'wsl', ''
    );
    console.log(`payload string: ${payloadStr}`);

    // Sign with Ed25519
    const sig = crypto.sign(null, Buffer.from(payloadStr, 'utf-8'), privateKeyObj);
    const sigB64url = sig.toString('base64url');

    ws.send(JSON.stringify({
      type: 'req', id: 'connect-1', method: 'connect',
      params: {
        minProtocol: 3, maxProtocol: 4,
        client: { id: 'cli', version: '1.0.0', platform: 'wsl', mode: 'cli' },
        role: 'operator',
        scopes: ['operator.read', 'operator.write'],
        auth: { token: TOKEN },
        device: {
          id: deviceId,
          publicKey: pubKeyB64url,
          signature: sigB64url,
          signedAt: ts,
          nonce,
        },
        locale: 'en-US',
        userAgent: 'agent-hub-bridge/1.0.0',
      },
    }));
    console.log(`[acp] connect with device (v3 sig)`);
    return;
  }

  if (msg.type === 'res' && msg.id === 'connect-1') {
    if (msg.ok) {
      const auth = msg.payload.auth;
      console.log(`[acp] CONNECTED! role=${auth.role} scopes=[${auth.scopes.join(',')}]`);
      if (auth.deviceToken) {
        console.log(`[acp] DEVICE TOKEN: ${auth.deviceToken}`);
      }

      // Subscribe to session messages
      ws.send(JSON.stringify({
        type: 'req', id: 'sub-msgs', method: 'sessions.messages.subscribe',
        params: { sessionKeys: ['agent:main:main'] },
      }));
      console.log('[test] subscribed to session messages');

      // Test sending a message with idempotencyKey
      setTimeout(() => {
        console.log('\n[test] sending chat.send...');
        ws.send(JSON.stringify({
          type: 'req', id: 'chat-1', method: 'chat.send',
          params: {
            sessionKey: 'agent:main:main',
            message: '回复一句话：收到 Agent Hub 测试。',
            idempotencyKey: `hub-test-${Date.now()}`,
          },
        }));
      }, 1000);
    } else {
      console.log(`[acp] FAIL: ${JSON.stringify(msg.error)}`);
      ws.close();
      process.exit(1);
    }
    return;
  }

  if (msg.type === 'res') {
    const payload = msg.ok ? msg.payload : msg.error;
    console.log(`[res] ${msg.id} ok=${msg.ok}:`, JSON.stringify(payload).substring(0, 500));
    if (msg.id === 'chat-1' && msg.ok) {
      console.log('\n=== MESSAGE SENT SUCCESSFULLY! ===');
    }
  }

  if (msg.type === 'event' && msg.event !== 'health' && msg.event !== 'tick') {
    console.log(`[event] ${msg.event}:`, JSON.stringify(msg.payload).substring(0, 500));
  }
});

ws.on('error', (err) => console.error('[ws] error:', err.message));
ws.on('close', () => { console.log('[ws] closed'); });
setTimeout(() => { console.log('[timeout]'); process.exit(1); }, 20000);
