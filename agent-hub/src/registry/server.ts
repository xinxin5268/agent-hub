// ============================================================
// Registry Server Entry — 启动注册中心
// 运行: npx tsx src/registry/server.ts
// ============================================================

import { RegistryDaemon } from './daemon'

const PORT = parseInt(process.env.REGISTRY_PORT || '3210', 10)

const daemon = new RegistryDaemon({
  port: PORT,
  name: 'Agent Hub Registry',
})

daemon.start().catch((err) => {
  console.error('[registry] failed to start:', err)
  process.exit(1)
})

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n[registry] shutting down...')
  daemon.stop()
  process.exit(0)
})

process.on('SIGTERM', () => {
  daemon.stop()
  process.exit(0)
})