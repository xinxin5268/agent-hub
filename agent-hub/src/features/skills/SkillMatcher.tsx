import { useState } from 'react'
import { useHubStore, getRegistryUrl } from '@/lib/store'
import type { SkillMatch } from '@/types'

export function SkillMatcher() {
  const { skillMatches, setSkillMatches } = useHubStore()
  const [task, setTask] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleMatch = async () => {
    if (!task.trim()) return
    setLoading(true)
    setError('')
    try {
      const base = getRegistryUrl()
      const resp = await fetch(`${base}/api/skills/match?task=${encodeURIComponent(task)}`)
      const data = await resp.json()
      if (data.ok) {
        setSkillMatches(data.matches || [])
      } else {
        setError(data.error || '匹配失败')
      }
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  return (
    <div className="h-full flex flex-col animate-fade-in">
      <div className="mb-4">
        <label className="block text-xs text-gray-400 mb-1.5">任务描述</label>
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <input
              type="text"
              value={task}
              onChange={e => setTask(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleMatch()}
              placeholder="例如: 写一个Python爬虫..."
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors pr-8"
            />
            {task && (
              <button
                onClick={() => setTask('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 text-sm"
              >
                ✕
              </button>
            )}
          </div>
          <button
            onClick={handleMatch}
            disabled={loading || !task.trim()}
            className="px-4 py-2 bg-blue-700 text-white text-xs rounded-lg hover:bg-blue-600 disabled:opacity-50 transition-all duration-200 active:scale-95 flex items-center gap-1.5"
          >
            {loading ? (
              <>
                <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin-slow" />
                匹配中...
              </>
            ) : '匹配'}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-3 px-3 py-2 bg-red-900/40 border border-red-700 rounded-lg text-red-300 text-xs animate-slide-in">
          {error}
        </div>
      )}

      <div className="flex-1 overflow-y-auto space-y-1.5">
        {loading && (
          <div className="space-y-1.5">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-14 bg-gray-800/50 rounded-lg animate-pulse" style={{ animationDelay: `${i * 0.1}s` }} />
            ))}
          </div>
        )}

        {!loading && skillMatches.length === 0 && (
          <div className="text-center text-gray-500 text-xs py-16 animate-fade-in">
            <div className="text-2xl mb-2">🔍</div>
            输入任务描述，点击匹配查找合适的技能
          </div>
        )}

        {!loading && skillMatches.map((m, i) => (
          <div
            key={i}
            className="flex items-center gap-3 px-3 py-2.5 bg-gray-900/60 border border-gray-800 rounded-lg hover:border-gray-600 transition-all duration-200 animate-slide-in group"
            style={{ animationDelay: `${i * 0.05}s` }}
          >
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-all duration-300 ${
              m.rank <= 3
                ? 'bg-yellow-700 text-yellow-200 shadow-sm shadow-yellow-700/40'
                : 'bg-gray-700 text-gray-300'
            }`}>
              {m.rank}
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-gray-200 truncate flex items-center gap-2">
                {m.skill}
                <button
                  onClick={() => copyToClipboard(m.skill)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] text-gray-500 hover:text-gray-300"
                  title="复制技能名"
                >
                  📋
                </button>
              </div>
              <div className="text-[10px] text-gray-500 truncate">{m.category} · {m.reason}</div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className={`text-[10px] px-1.5 py-0.5 rounded transition-all ${
                m.tier === 'core' ? 'bg-purple-900/40 text-purple-300' :
                m.tier === 'toolkit' ? 'bg-blue-900/40 text-blue-300' :
                'bg-emerald-900/40 text-emerald-300'
              }`}>
                {m.tier === 'core' ? '核心' : m.tier === 'toolkit' ? '工具' : '场景'}
              </span>
              <span className="text-[10px] text-gray-400 font-mono">{m.score}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
