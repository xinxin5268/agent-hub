// ============================================================
// Agent Detail — Agent 详情面板
// 展示选中 Agent 的详细信息、状态和操作按钮
// ============================================================

import type { AgentRegistration } from '@/registry/protocol'
import { X, MessageSquare, Play, Square, RotateCcw, Clock, Cpu, Globe, FolderOpen, Tag } from 'lucide-react'

interface AgentDetailProps {
  agent: AgentRegistration | null
  onClose: () => void
  onSendMessage: (agentId: string) => void
  onCommand: (agentId: string, command: string) => void
}

function formatRelativeTime(timestamp: number): string {
  const now = Date.now()
  const diff = now - timestamp
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (seconds < 5) return '刚刚'
  if (seconds < 60) return `${seconds}秒前`
  if (minutes < 60) return `${minutes}分钟前`
  if (hours < 24) return `${hours}小时前`
  return `${days}天前`
}

function StatusBadge({ status }: { status: AgentRegistration['status'] }) {
  const config = {
    online: {
      label: '在线',
      dotClass: 'bg-green-400 animate-pulse',
      bgClass: 'bg-green-500/10 text-green-400 border-green-500/20',
    },
    busy: {
      label: '忙碌',
      dotClass: 'bg-yellow-400',
      bgClass: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    },
    offline: {
      label: '离线',
      dotClass: 'bg-gray-600',
      bgClass: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
    },
  }

  const { label, dotClass, bgClass } = config[status]

  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs border ${bgClass}`}>
      <span className={`w-2 h-2 rounded-full ${dotClass}`} />
      {label}
    </span>
  )
}

function InfoRow({ icon: Icon, label, value, mono }: {
  icon: React.ComponentType<{ size?: number; className?: string }>
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center gap-2 text-gray-500">
        <Icon size={14} />
        <span className="text-xs">{label}</span>
      </div>
      <span className={`text-xs text-gray-300 ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  )
}

export function AgentDetail({ agent, onClose, onSendMessage, onCommand }: AgentDetailProps) {
  if (!agent) {
    return (
      <div className="w-80 border-l border-gray-800 bg-gray-950 flex flex-col items-center justify-center text-gray-600">
        <Cpu size={48} className="mb-3 opacity-30" />
        <p className="text-sm">未选中 Agent</p>
        <p className="text-xs mt-1">点击左侧卡片查看详情</p>
      </div>
    )
  }

  return (
    <div className="w-80 border-l border-gray-800 bg-gray-950 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-lg">🤖</span>
          <h3 className="text-sm font-semibold text-gray-100 truncate">{agent.name}</h3>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition-colors shrink-0"
        >
          <X size={16} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Status & Heartbeat */}
        <div className="px-4 py-3 border-b border-gray-800">
          <div className="flex items-center justify-between mb-2">
            <StatusBadge status={agent.status} />
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <Clock size={12} />
              <span title={new Date(agent.lastHeartbeat).toLocaleString()}>
                {formatRelativeTime(agent.lastHeartbeat)}
              </span>
            </div>
          </div>
        </div>

        {/* Basic Info */}
        <div className="px-4 py-2 border-b border-gray-800">
          <InfoRow icon={Cpu} label="ID" value={agent.id} mono />
          <InfoRow icon={Cpu} label="类型" value={agent.type} />
          <InfoRow icon={Globe} label="平台" value={agent.platform} />
          <InfoRow icon={Globe} label="地址" value={`${agent.host}:${agent.port}`} mono />
          {agent.wsUrl && (
            <InfoRow icon={Globe} label="WebSocket" value={agent.wsUrl} mono />
          )}
          {agent.httpUrl && (
            <InfoRow icon={Globe} label="HTTP" value={agent.httpUrl} mono />
          )}
        </div>

        {/* Models */}
        {agent.models && agent.models.length > 0 && (
          <div className="px-4 py-3 border-b border-gray-800">
            <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
              <Cpu size={14} />
              <span>模型</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {agent.models.map(model => (
                <span
                  key={model}
                  className="px-2 py-1 rounded-md bg-blue-500/10 text-blue-400 text-[11px] border border-blue-500/20"
                >
                  {model}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Version & Tags */}
        <div className="px-4 py-2 border-b border-gray-800">
          {agent.version && (
            <InfoRow icon={Tag} label="版本" value={agent.version} />
          )}
          {agent.cwd && (
            <InfoRow icon={FolderOpen} label="工作目录" value={agent.cwd} mono />
          )}
        </div>

        {/* Tags */}
        {agent.tags && Object.keys(agent.tags).length > 0 && (
          <div className="px-4 py-3 border-b border-gray-800">
            <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
              <Tag size={14} />
              <span>标签</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(agent.tags).map(([key, value]) => (
                <span
                  key={key}
                  className="px-2 py-1 rounded-md bg-gray-800 text-gray-300 text-[11px] border border-gray-700"
                >
                  {key}: {value}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Registration Info */}
        <div className="px-4 py-2 border-b border-gray-800">
          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-2 text-gray-500">
              <Clock size={14} />
              <span className="text-xs">注册时间</span>
            </div>
            <span className="text-xs text-gray-400">
              {new Date(agent.registeredAt).toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="px-4 py-3 border-t border-gray-800 space-y-2">
        <button
          onClick={() => onSendMessage(agent.id)}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg
            bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors"
        >
          <MessageSquare size={16} />
          发送消息
        </button>

        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => onCommand(agent.id, 'start')}
            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg
              bg-green-600/10 hover:bg-green-600/20 text-green-400 text-xs font-medium
              border border-green-600/20 transition-colors"
          >
            <Play size={12} />
            启动
          </button>
          <button
            onClick={() => onCommand(agent.id, 'stop')}
            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg
              bg-red-600/10 hover:bg-red-600/20 text-red-400 text-xs font-medium
              border border-red-600/20 transition-colors"
          >
            <Square size={12} />
            停止
          </button>
          <button
            onClick={() => onCommand(agent.id, 'restart')}
            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg
              bg-yellow-600/10 hover:bg-yellow-600/20 text-yellow-400 text-xs font-medium
              border border-yellow-600/20 transition-colors"
          >
            <RotateCcw size={12} />
            重启
          </button>
        </div>
      </div>
    </div>
  )
}
