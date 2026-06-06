/**
 * OpenCode WSL Agent 启动脚本
 * 给 ws-client 注册 onCommand 回调，让 chat 任务能自动执行
 */

const path = require('path');

// 加载 ws-client
const client = require('./agent-ws-client.cjs');

// ─── 任务处理回调 ───────────────────────────────────────
client.setOnCommand((cmd) => {
  if (cmd.command !== 'chat') return;
  
  const task = cmd.payload || '';
  const from = cmd.from || 'unknown';
  
  console.log(`\n[OpenCode WSL] 收到任务: ${task.slice(0, 100)}`);
  console.log(`[OpenCode WSL] 来自: ${from}`);
  
  // 把任务写入文件，OpenCode IDE 可以检测到
  const fs = require('fs');
  const taskFile = '/tmp/opencode-wsl-tasks.md';
  
  try {
    const entry = `\n## 任务 ${new Date().toISOString()}\n- 来自: ${from}\n- 内容: ${task}\n`;
    fs.appendFileSync(taskFile, entry);
    console.log(`[OpenCode WSL] 任务已写入 ${taskFile}`);
  } catch(e) {
    console.error(`[OpenCode WSL] 写入任务文件失败: ${e.message}`);
  }
});

// ─── 启动 ────────────────────────────────────────────────
client.start();

console.log('[OpenCode WSL] Agent 启动完成，onCommand 回调已注册');
