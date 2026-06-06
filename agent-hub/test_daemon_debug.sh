cd /home/chenxin520/.openclaw/workspace/agent-hub
node -e "const cp = require('child_process'); console.log('execSync type:', typeof cp.execSync);"
echo "---"
npx tsx -e "console.log('tsx works')" 2>&1
echo "---"
npx tsx src/registry/daemon.ts 2>&1
echo "EXIT: $?"
