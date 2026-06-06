// ============================================================
// Top Bar
// ============================================================

import { useHubStore } from '@/lib/store'

interface TopBarProps {
  panels: Record<string, { label: string; icon: string }>
  activeTab: string
}

export function TopBar({ panels, activeTab }: TopBarProps) {
  const { connected, agents, health } = useHubStore()
  const panel = panels[activeTab]
  const onlineCount = agents.filter(a => a.status === 'online' || a.status === 'busy').length

  return (
    <header className="h-12 bg-gray-900/80 backdrop-blur-sm border-b border-gray-800 flex items-center px-4 gap-4 shrink-0">
      {/* Panel title */}
      <h1 className="text-lg font-semibold text-gray-100">
        {panel?.icon} {panel?.label}
      </h1>

      <div className="flex-1" />

      {/* Status indicators */}
      <div className="flex items-center gap-3 text-xs text-gray-400">
        <span className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-400' : 'bg-red-400'}`} />
          {connected ? '已连接' : '离线'}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-indigo-400" />
          {agents.length} 个Agent
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-green-400" />
          {onlineCount} 在线
        </span>
        {health.version && (
          <span className="text-gray-500">v{health.version}</span>
        )}
      </div>
    </header>
  )
}