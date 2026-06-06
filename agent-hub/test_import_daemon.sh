cd /home/chenxin520/.openclaw/workspace/agent-hub
npx tsx -e "
try {
  const m = await import('./src/registry/daemon.ts');
  console.log('Module loaded successfully');
  console.log('Exports:', Object.keys(m));
} catch(e) {
  console.error('Error:', e.message);
  console.error(e.stack);
}
" 2>&1
