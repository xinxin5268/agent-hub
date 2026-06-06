// ============================================================
// MessageStream — 消息流组件（简化重写版）
// 只保证发送按钮 + 回车能工作
// ============================================================

import { useState, useRef, useEffect, useMemo } from 'react'
import { Send, Radio, User, ChevronDown, Trash2, RefreshCw } from 'lucide-react'
import { useHubStore, getRegistryUrl } from '@/lib/store'

export interface StreamMessage {
  id: string
  from: string
  to: string
  content: string
  type: 'broadcast' | 'chat'
  timestamp: number
}

interface MessageStreamProps {
  onSend?: (msg: { to: string; content: string; type: string }) => void
  wsRef?: React.MutableRefObject<WebSocket | null>
}

export function MessageStream({ onSend, wsRef }: MessageStreamProps) {
  const [messages, setMessages] = useState<StreamMessage[]>([])
  const [input, setInput] = useState('')
  const [target, setTarget] = useState<string>('broadcast')
  const [showTargetPicker, setShowTargetPicker] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const { agents } = useHubStore()

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages.length])

  useEffect(() => {
    const handler = (e: CustomEvent<StreamMessage>) => {
      setMessages(prev => {
        if (prev.some(m => m.id === e.detail.id)) return prev
        return [...prev, e.detail]
      })
    }
    window.addEventListener('message-stream:add', handler as any)
    return () => window.removeEventListener('message-stream:add', handler as any)
  }, [])

  // 加载历史消息
  useEffect(() => {
    const load = async () => {
      try {
        const resp = await fetch(getRegistryUrl() + '/api/chat-history')
        const data = await resp.json()
        if (data.ok && Array.isArray(data.messages)) {
          setMessages(data.messages)
        }
      } catch {}
    }
    load()
  }, [])

  const onlineAgents = useMemo(
    () => agents.filter(a => a.status !== 'offline'),
    [agents],
  )

  const getAgentName = (id: string): string => {
    if (id === 'broadcast') return '广播'
    return agents.find(a => a.id === id)?.name ?? id.slice(0, 8)
  }

  // ── 发送消息（直接函数，不依赖任何外部状态）──
  function doSend() {
    const content = input.trim()
    if (!content) return

    const msg: StreamMessage = {
      id: 'msg-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      from: 'studio-ui',
      to: target,
      content,
      type: target === 'broadcast' ? 'broadcast' : 'chat',
      timestamp: Date.now(),
    }

    // 乐观更新
    setMessages(prev => [...prev, msg])
    setInput('')

    // HTTP 发送
    fetch(getRegistryUrl() + '/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(msg),
    }).catch(() => {
      // WS 兜底
      const ws = wsRef?.current
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'agent:message', message: msg }))
      }
    })

    if (onSend) {
      onSend({ to: target, content, type: msg.type })
    }
  }

  return (
    <div className="flex flex-col h-full bg-gray-950 text-gray-100">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-800/60">
        <div className="flex items-center gap-2">
          <Radio size={14} className="text-green-400" />
          <span className="text-sm font-medium">共享会话</span>
          <span className="text-xs text-gray-500">{messages.length} 条</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={async () => {
              try {
                const resp = await fetch(getRegistryUrl() + '/api/chat-history')
                const data = await resp.json()
                if (data.ok && Array.isArray(data.messages)) setMessages(data.messages)
              } catch {}
            }}
            className="p-1.5 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition-colors"
            title="刷新"
          ><RefreshCw size={13} /></button>
          {messages.length > 0 && (
            <button
              onClick={() => setMessages([])}
              className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-gray-800 transition-colors"
              title="清除"
            ><Trash2 size={13} /></button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-600">
            <Radio size={32} className="mb-2 opacity-40" />
            <p className="text-sm">暂无消息</p>
            <p className="text-xs mt-1">输入文字发送共享消息</p>
          </div>
        ) : messages.map(msg => {
          const isSelf = msg.from === 'studio-ui'
          const senderName = isSelf ? '我' : getAgentName(msg.from)

          return (
            <div key={msg.id} className="animate-slide-in flex items-end gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                isSelf ? 'bg-blue-600/80 text-white' : 'bg-gray-700 text-gray-300'
              }`}>
                {isSelf ? 'U' : senderName.charAt(0).toUpperCase()}
              </div>
              <div className="flex flex-col max-w-[75%] items-start">
                <div className="flex items-center gap-1.5 mb-0.5 text-[10px] text-gray-500">
                  <span className="font-medium">{senderName}</span>
                  {msg.to === 'broadcast' && (
                    <span className="px-1 py-px rounded bg-purple-500/20 text-purple-400">广播</span>
                  )}
                  <span>{new Date(msg.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <div className={`rounded-xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap break-words ${
                  isSelf ? 'bg-blue-600/15 border border-blue-500/20 text-blue-100' : 'bg-gray-800 text-gray-200'
                }`}>
                  {msg.content}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Input Area — 用原生 HTML 表单确保提交事件 */}
      <form
        onSubmit={(e) => {
          e.preventDefault()
          doSend()
        }}
        className="border-t border-gray-800/60 p-3"
      >
        <div className="flex items-center gap-2">
          {/* 目标选择 */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowTargetPicker(!showTargetPicker)}
              className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                target === 'broadcast'
                  ? 'bg-purple-600/20 text-purple-300 border border-purple-500/30'
                  : 'bg-gray-800 text-gray-300 border border-gray-700/50'
              }`}
            >
              {target === 'broadcast' ? <><Radio size={12} /> 广播</> : <><User size={12} /> {getAgentName(target)}</>}
              <ChevronDown size={10} />
            </button>

            {showTargetPicker && (
              <div className="absolute bottom-full left-0 mb-1 w-52 bg-gray-900 border border-gray-700/60 rounded-xl shadow-xl overflow-hidden z-50">
                <button type="button" onClick={() => { setTarget('broadcast'); setShowTargetPicker(false) }}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-xs transition-colors ${
                    target === 'broadcast' ? 'bg-purple-600/20 text-purple-300' : 'text-gray-300 hover:bg-gray-800'
                  }`}
                ><Radio size={12} className="text-purple-400" /> 广播</button>
                <div className="border-t border-gray-800" />
                {onlineAgents.map(a => (
                  <button key={a.id} type="button" onClick={() => { setTarget(a.id); setShowTargetPicker(false) }}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-xs transition-colors ${
                      target === a.id ? 'bg-blue-600/20 text-blue-300' : 'text-gray-300 hover:bg-gray-800'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${a.status === 'online' ? 'bg-green-400' : 'bg-yellow-400'}`} />
                    <span className="truncate">{a.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 输入框 — 用原生 input 和 onKeyDown 确保回车 */}
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder={target === 'broadcast' ? '广播消息...' : '私聊消息...'}
            className="flex-1 bg-gray-900 border border-gray-800/60 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-600 outline-none focus:border-blue-600/50 transition-colors"
          />

          {/* 发送按钮 — 表单内的 submit 按钮 */}
          <button
            type="submit"
            disabled={!input.trim()}
            className="bg-blue-600 hover:bg-blue-500 disabled:bg-gray-800 disabled:text-gray-600 text-white p-2 rounded-lg transition-colors shrink-0"
          >
            <Send size={14} />
          </button>
        </div>
      </form>
    </div>
  )
}
// ─── 全局挂载，确保按钮能触发 ───
// 如果 React 事件绑定失败，用原生 DOM 事件兜底
if (typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    const btn = document.getElementById('msg-send-btn')
    const input = document.getElementById('msg-input') as HTMLInputElement | null
    
    if (btn) {
      // 原生点击事件
      btn.addEventListener('click', (e) => {
        e.preventDefault()
        // 触发 form 的 submit
        const form = btn.closest('form')
        if (form) form.requestSubmit()
      })
    }
    
    if (input) {
      // 原生回车事件
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault()
          const form = input.closest('form')
          if (form) form.requestSubmit()
        }
      })
    }
  })
}
