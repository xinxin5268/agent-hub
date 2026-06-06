const { RegistryDaemon } = await import('./src/registry/daemon.ts')
console.log('Module loaded successfully, class:', RegistryDaemon?.name || 'not found')
