import WebSocket from 'ws';
import crypto from 'crypto';
const ws = new WebSocket('ws://127.0.0.1:18790');

ws.on('open', () => {
  console.log('Connected to ACP WebSocket');
});

ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  console.log('Received:', JSON.stringify(msg, null, 2));

  if (msg.type === 'event' && msg.event === 'connect.challenge') {
    const { nonce, ts } = msg.payload;
    const TOKEN = '8a21bb037f384d32c506f06236dea86d98ddcabb8450577c';
    // Try HMAC-SHA256(token, nonce)
    const sig1 = crypto.createHmac('sha256', TOKEN).update(nonce).digest('hex');
    // Try HMAC-SHA256(token, nonce + ts)
    const sig2 = crypto.createHmac('sha256', TOKEN).update(nonce + ts).digest('hex');
    // Try HMAC-SHA256(token, nonce:ts)
    const sig3 = crypto.createHmac('sha256', TOKEN).update(nonce + ':' + ts).digest('hex');
    // Try just the token itself as signature
    ws.send(JSON.stringify({ type: 'connect.reply', nonce, signature: sig1 }));
    console.log('Sent sig1 (HMAC(nonce))');
  }

  if (msg.type === 'event' && msg.event === 'connect.ready') {
    console.log('AUTHENTICATED!');
    ws.close();
  }

  if (msg.type === 'event' && msg.event === 'connect.error') {
    console.log('Auth failed:', msg.payload?.message);
    ws.close();
  }
});

ws.on('error', (err) => console.error('WS Error:', err.message));
ws.on('close', (code, reason) => {
  console.log(`WS closed: code=${code} reason=${reason.toString()}`);
  process.exit(0);
});

setTimeout(() => { console.log('Timeout'); process.exit(0); }, 5000);
