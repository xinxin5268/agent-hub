// ============================================================
// Sidebar Navigation
// ============================================================

import { useHubStore } from '@/lib/store'

interface SidebarProps {
  panels: Record<string, { label: string; icon: string }>
  activeTab: string
  onTabChange: (tab: string) => void
  onConnect: () => void
}

export function Sidebar({ panels, activeTab, onTabChange, onConnect }: SidebarProps) {
  const { connected, agents } = useHubStore()
  const onlineCount = agents.filter(a => a.status === 'online' || a.status === 'busy').length

  return (
    <aside className="w-16 bg-gray-900 border-r border-gray-800 flex flex-col items-center py-4 gap-1 shrink-0">
      {/* Logo */}
      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-400 flex items-center justify-center text-lg font-bold mb-4">
        H
      </div>

      {/* Nav items */}
      {Object.entries(panels).map(([key, panel]) => (
        <button
          key={key}
          onClick={() => onTabChange(key)}
          className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg transition-all
            ${activeTab === key
              ? 'bg-indigo-500/20 text-indigo-400 shadow-sm shadow-indigo-500/20'
              : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800'
            }`}
          title={panel.label}
        >
          {panel.icon}
        </button>
      ))}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Connection status */}
      <button
        onClick={onConnect}
        className={`w-8 h-8 rounded-full flex items-center justify-center text-xs transition-all
          ${connected ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}
        `}
        title={connected ? `${onlineCount} 个Agent在线` : '未连接'}
      >
        <div className={`w-2.5 h-2.5 rounded-full ${connected ? 'bg-green-400' : 'bg-red-400'}`} />
      </button>
    </aside>
  )
}