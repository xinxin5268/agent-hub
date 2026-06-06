// ============================================================
// KnowledgeHub — 共享知识库面板
// 存储和检索 Agent 的工作经验、技能、代码片段、事实、决策
// ============================================================

import { useState, useEffect } from 'react'
import { useHubStore, getRegistryUrl } from '@/lib/store'
import { BookOpen, Search, Tag, User, Clock, Plus, X, ChevronDown } from 'lucide-react'
import type { KnowledgeEntry } from '@/types'

const TYPE_MAP: Record<string, { label: string; color: string; icon: string }> = {
  fact: { label: '事实', color: 'bg-blue-600/20 text-blue-400 border-blue-500/30', icon: '📌' },
  skill: { label: '技能', color: 'bg-green-600/20 text-green-400 border-green-500/30', icon: '⚡' },
  code: { label: '代码', color: 'bg-purple-600/20 text-purple-400 border-purple-500/30', icon: '💻' },
  experience: { label: '经验', color: 'bg-yellow-600/20 text-yellow-400 border-yellow-500/30', icon: '🧠' },
  decision: { label: '决策', color: 'bg-red-600/20 text-red-400 border-red-500/30', icon: '🎯' },
}

export function KnowledgeHub() {
  const [entries, setEntries] = useState<KnowledgeEntry[]>([])
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [newEntry, setNewEntry] = useState({ type: 'experience', title: '', content: '', tags: '', source: 'manual' })
  const [stats, setStats] = useState<Record<string, number>>({})
  const { agents } = useHubStore()

  const loadEntries = async () => {
    try {
      const params = new URLSearchParams()
      if (search) params.set('q', search)
      if (typeFilter) params.set('type', typeFilter)
      const resp = await fetch(getRegistryUrl() + '/api/knowledge?' + params)
      const data = await resp.json()
      if (data.ok) setEntries(data.entries)
    } catch {}
  }

  const loadStats = async () => {
    try {
      const resp = await fetch(getRegistryUrl() + '/api/knowledge/stats')
      const data = await resp.json()
      if (data.ok) setStats(data.stats)
    } catch {}
  }

  useEffect(() => { loadEntries(); loadStats() }, [search, typeFilter])

  const handleAdd = async () => {
    if (!newEntry.content.trim()) return
    const tags = newEntry.tags.split(',').map(t => t.trim()).filter(Boolean)
    await fetch(getRegistryUrl() + '/api/knowledge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: newEntry.type,
        title: newEntry.title,
        content: newEntry.content,
        tags,
        source: 'manual',
      }),
    })
    setShowAdd(false)
    setNewEntry({ type: 'experience', title: '', content: '', tags: '', source: 'manual' })
    loadEntries()
    loadStats()
  }

  const handleDelete = async (id: string) => {
    await fetch(getRegistryUrl() + '/api/knowledge/' + id, { method: 'DELETE' })
    loadEntries()
    loadStats()
  }

  // 分享知识到 Agent
  const [sharingId, setSharingId] = useState<string | null>(null)
  const [shareToast, setShareToast] = useState<string | null>(null)

  const handleShareToAgent = async (entry: KnowledgeEntry) => {
    setSharingId(entry.id)
    try {
      const baseUrl = getRegistryUrl()
      // 通过消息 API 广播给所有在线 Agent
      const content = `📚 知识分享: ${entry.title || entry.type}\n\n${entry.content.slice(0, 500)}\n\n🏷️ 标签: ${entry.tags.join(', ')}`
      const resp = await fetch(baseUrl + '/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'knowledge-hub',
          to: 'broadcast',
          content,
          type: 'broadcast',
        }),
      })
      const data = await resp.json()
      if (data.ok) {
        setShareToast(`已分享到所有在线 Agent`)
      } else {
        setShareToast('分享失败')
      }
    } catch {
      setShareToast('分享失败: 网络错误')
    }
    setSharingId(null)
    setTimeout(() => setShareToast(null), 2500)
  }

  const allTags = [...new Set(entries.flatMap(e => e.tags))]

  return (
    <div className="flex flex-col h-full bg-gray-950 text-gray-100">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-800/60">
        <div className="flex items-center gap-2">
          <BookOpen size={14} className="text-indigo-400" />
          <span className="text-sm font-medium">共享知识库</span>
          <span className="text-xs text-gray-500">{entries.length} 条</span>
        </div>
        <button onClick={() => setShowAdd(true)}
          className="flex items-center gap-1 px-2 py-1 rounded-lg bg-indigo-600/20 text-indigo-300 text-xs hover:bg-indigo-600/30 transition-colors"
        ><Plus size={12} /> 新增</button>
      </div>

      {/* Stats + Search */}
      <div className="px-4 py-2 border-b border-gray-800/40 space-y-2">
        {/* Type stats chips */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button onClick={() => setTypeFilter('')}
            className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${!typeFilter ? 'bg-gray-700 text-gray-200' : 'bg-gray-800/60 text-gray-500 hover:text-gray-300'}`}
          >全部 ({entries.length})</button>
          {Object.entries(TYPE_MAP).map(([k, v]) => (
            <button key={k} onClick={() => setTypeFilter(k)}
              className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${typeFilter === k ? v.color : 'bg-gray-800/60 text-gray-500 hover:text-gray-300'}`}
            >{v.icon} {v.label} ({stats[k] || 0})</button>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="搜索知识库..."
            className="w-full bg-gray-900 border border-gray-800/60 rounded-lg pl-7 pr-3 py-1.5 text-xs text-gray-100 placeholder-gray-600 outline-none focus:border-indigo-600/50 transition-colors"
          />
        </div>
      </div>

      {/* Knowledge entries */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-600">
            <BookOpen size={32} className="mb-2 opacity-40" />
            <p className="text-sm">知识库为空</p>
            <p className="text-xs mt-1">Agent 的工作经验会自动同步到这里</p>
          </div>
        ) : entries.slice().reverse().map(entry => {
          const t = TYPE_MAP[entry.type] || TYPE_MAP.experience
          return (
            <div key={entry.id} className="bg-gray-900/60 border border-gray-800/50 rounded-xl p-3 hover:border-gray-700/50 transition-colors group">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${t.color}`}>
                    {t.icon} {t.label}
                  </span>
                  {entry.title && <span className="text-xs font-medium text-gray-200">{entry.title}</span>}
                  <span className="text-[9px] text-gray-600 ml-1">{new Date(entry.timestamp).toLocaleDateString()}</span>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => handleShareToAgent(entry)}
                    disabled={sharingId === entry.id}
                    className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-gray-500 hover:text-indigo-400 transition-all disabled:opacity-40"
                    title="分享到 Agent"
                  >
                    <svg size={10} width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
                      <polyline points="16 6 12 2 8 6"/>
                      <line x1="12" y1="2" x2="12" y2="15"/>
                    </svg>
                  </button>
                  <button onClick={() => handleDelete(entry.id)}
                    className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-gray-600 hover:text-red-400 transition-all"
                  ><X size={10} /></button>
                </div>
              </div>
              <p className="text-xs text-gray-300 leading-relaxed whitespace-pre-wrap break-words">{entry.content.slice(0, 300)}</p>
              <div className="flex items-center gap-2 mt-1.5 text-[9px] text-gray-500">
                {entry.tags.map(tag => (
                  <span key={tag} className="flex items-center gap-0.5">
                    <Tag size={8} /> {tag}
                  </span>
                ))}
                {entry.sourceAgent && (
                  <span className="flex items-center gap-0.5"><User size={8} /> {entry.sourceAgent}</span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Add dialog */}
      {/* Toast */}
      {shareToast && (
        <div className="fixed bottom-6 right-6 bg-indigo-600/90 border border-indigo-500/50 text-white px-4 py-2 rounded-lg text-xs shadow-xl z-50 animate-slide-in">
          {shareToast}
        </div>
      )}

      {showAdd && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
          onClick={() => setShowAdd(false)}>
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-5 w-[420px] shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-gray-100 mb-4">新增知识</h3>
            <div className="space-y-3">
              <select value={newEntry.type} onChange={e => setNewEntry({...newEntry, type: e.target.value})}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-gray-200 outline-none"
              >
                <option value="fact">📌 事实</option>
                <option value="skill">⚡ 技能</option>
                <option value="code">💻 代码</option>
                <option value="experience">🧠 经验</option>
                <option value="decision">🎯 决策</option>
              </select>
              <input value={newEntry.title} onChange={e => setNewEntry({...newEntry, title: e.target.value})}
                placeholder="标题（可选）"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-gray-200 placeholder-gray-500 outline-none"
              />
              <textarea value={newEntry.content} onChange={e => setNewEntry({...newEntry, content: e.target.value})}
                placeholder="内容..."
                rows={4}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-gray-200 placeholder-gray-500 outline-none resize-none"
              />
              <input value={newEntry.tags} onChange={e => setNewEntry({...newEntry, tags: e.target.value})}
                placeholder="标签（逗号分隔，如：react,frontend,debug）"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-gray-200 placeholder-gray-500 outline-none"
              />
              <div className="flex justify-end gap-2">
                <button onClick={() => setShowAdd(false)}
                  className="px-3 py-1.5 rounded-lg text-xs text-gray-400 hover:text-gray-200 bg-gray-800 hover:bg-gray-700 transition-colors"
                >取消</button>
                <button onClick={handleAdd} disabled={!newEntry.content.trim()}
                  className="px-3 py-1.5 rounded-lg text-xs text-white bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:text-gray-500 transition-colors"
                >保存</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}