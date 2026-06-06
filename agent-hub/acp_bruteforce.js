import WebSocket from 'ws';
import crypto from 'crypto';

const TOKEN = '8a21bb037f384d32c506f06236dea86d98ddcabb8450577c';

function hm(n, ts) { return crypto.createHmac('sha256', TOKEN).update(n).digest('hex'); }
const sigs = [
  { name: 'connect.reply HMAC(TOKEN,nonce)', fn: (n, ts) => JSON.stringify({ type: 'connect.reply', nonce: n, signature: hm(n, ts) }) },
  { name: 'connect.reply HMAC(TOKEN,n+ts)', fn: (n, ts) => JSON.stringify({ type: 'connect.reply', nonce: n, signature: crypto.createHmac('sha256', TOKEN).update(n + ts).digest('hex') }) },
  { name: 'connect.reply SHA256(TOKEN+n)', fn: (n, ts) => JSON.stringify({ type: 'connect.reply', nonce: n, signature: crypto.createHash('sha256').update(TOKEN + n).digest('hex') }) },
  { name: 'connect.reply plain TOKEN', fn: (n, ts) => JSON.stringify({ type: 'connect.reply', nonce: n, signature: TOKEN }) },
  { name: 'connect.reply plain nonce', fn: (n, ts) => JSON.stringify({ type: 'connect.reply', nonce: n, signature: n }) },
  { name: 'connect.reply HMAC("",nonce)', fn: (n, ts) => JSON.stringify({ type: 'connect.reply', nonce: n, signature: crypto.createHmac('sha256', '').update(n).digest('hex') }) },
  // Different message types instead of connect.reply
  { name: 'connect.auth {nonce,token}', fn: (n, ts) => JSON.stringify({ type: 'connect.auth', nonce: n, token: TOKEN }) },
  { name: 'auth {token}', fn: (n, ts) => JSON.stringify({ type: 'auth', token: TOKEN }) },
  { name: 'jsonrpc challenge', fn: (n, ts) => JSON.stringify({ jsonrpc: '2.0', method: 'challenge', params: { nonce: n, signature: hm(n, ts) } }) },
  { name: 'jsonrpc connect.challenge', fn: (n, ts) => JSON.stringify({ jsonrpc: '2.0', method: 'connect.reply', params: { nonce: n, signature: hm(n, ts) } }) },
  { name: 'connect.reply empty sig', fn: (n, ts) => JSON.stringify({ type: 'connect.reply', nonce: n }) },
  { name: 'challenge {answer}', fn: (n, ts) => JSON.stringify({ type: 'challenge', answer: n }) },
];

let idx = 0;

function tryNext() {
  if (idx >= sigs.length) {
    console.log('All signatures failed');
    process.exit(1);
    return;
  }

  const sig = sigs[idx];
  const ws = new WebSocket('ws://127.0.0.1:18790');
  let nonce = '';
  let ts = 0;

  ws.on('open', () => {
    console.log(`[${idx + 1}/${sigs.length}] Connected, waiting for challenge...`);
  });

  let responded = false;

  ws.on('message', (data) => {
    const msg = JSON.parse(data.toString());
    if (msg.type === 'event' && msg.event === 'connect.challenge') {
      if (responded) return;
      responded = true;
      nonce = msg.payload.nonce;
      ts = msg.payload.ts;
      const payload = sig.fn(nonce, ts);
      console.log(`  Trying: ${sig.name}`);
      console.log(`  Send: ${payload.substring(0, 80)}...`);
      ws.send(payload);
      // If no close/ready in 1.5s, try next
      setTimeout(() => {
        if (ws.readyState === WebSocket.OPEN) {
          console.log(`  SUCCESS! Connection stayed open! #${idx + 1}: ${sig.name}`);
          ws.close();
          process.exit(0);
        }
      }, 1500);
    }
    if (msg.type === 'event' && msg.event === 'connect.ready') {
      console.log(`  SUCCESS! Got connect.ready! #${idx + 1}: ${sig.name}`);
      ws.close();
      process.exit(0);
    }
  });

  ws.on('error', (err) => {
    console.log(`  Error: ${err.message}`);
    idx++;
    tryNext();
  });

  ws.on('close', (code, reason) => {
    const reasonStr = reason?.toString() || '';
    console.log(`  Close(${code}): ${reasonStr.substring(0, 60)}`);
    // Only try next if we actually got an auth rejection
    if (code !== 1000) {
      idx++;
      setTimeout(tryNext, 200);
    }
  });
}

tryNext();
