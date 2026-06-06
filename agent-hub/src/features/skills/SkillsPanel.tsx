import { useState, useEffect, useCallback } from 'react'
import { useHubStore, getRegistryUrl } from '@/lib/store'
import { SkillCatalog } from './SkillCatalog'
import { SkillMatcher } from './SkillMatcher'

type SkillTab = 'catalog' | 'matcher'

export function SkillsPanel() {
  const { skills, setSkills, setSkillLoading } = useHubStore()
  const [tab, setTab] = useState<SkillTab>('catalog')
  const [error, setError] = useState('')
  const [scanning, setScanning] = useState(false)

  const fetchSkills = useCallback(async () => {
    setSkillLoading(true)
    setError('')
    try {
      const base = getRegistryUrl()
      const resp = await fetch(`${base}/api/skills`)
      const data = await resp.json()
      if (data.ok && Array.isArray(data.skills)) {
        setSkills(data.skills)
      } else {
        setError(data.error || '加载技能失败')
      }
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSkillLoading(false)
    }
  }, [setSkills, setSkillLoading])

  const handleScan = async () => {
    setScanning(true)
    try {
      const base = getRegistryUrl()
      await fetch(`${base}/api/skills/scan`, { method: 'POST' })
      await fetchSkills()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setScanning(false)
    }
  }

  useEffect(() => { fetchSkills() }, [fetchSkills])

  const tabs: { key: SkillTab; label: string }[] = [
    { key: 'catalog', label: '技能目录' },
    { key: 'matcher', label: '技能匹配' },
  ]

  const tierCounts: Record<string, number> = {}
  for (const s of skills) {
    const t = s.tier || 'unknown'
    tierCounts[t] = (tierCounts[t] || 0) + 1
  }

  return (
    <div className="h-full flex flex-col animate-fade-in">
      <div className="flex items-center justify-between mb-3">
        <div className="flex gap-2">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-3 py-1.5 text-xs rounded-lg transition-all duration-200 ${
                tab === t.key
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/30'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <button
          onClick={handleScan}
          disabled={scanning}
          className="px-3 py-1.5 text-xs bg-emerald-700 text-white rounded-lg hover:bg-emerald-600 disabled:opacity-50 transition-all duration-200 active:scale-95"
        >
          {scanning ? (
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin-slow" />
              扫描中...
            </span>
          ) : '重新扫描'}
        </button>
      </div>

      {tab === 'catalog' && (
        <div className="flex gap-3 mb-3">
          {[
            { key: 'core', label: '核心层', color: 'bg-purple-700/20 text-purple-300 border-purple-700/30' },
            { key: 'toolkit', label: '工具层', color: 'bg-blue-700/20 text-blue-300 border-blue-700/30' },
            { key: 'scenario', label: '场景层', color: 'bg-emerald-700/20 text-emerald-300 border-emerald-700/30' },
            { key: 'unknown', label: '未分类', color: 'bg-gray-700/20 text-gray-400 border-gray-700/30' },
          ].map(t => (
            <div key={t.key} className={`flex-1 rounded-lg border px-3 py-2 ${t.color}`}>
              <div className="text-lg font-bold">{tierCounts[t.key] || 0}</div>
              <div className="text-[10px] opacity-80">{t.label}</div>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="mb-3 px-3 py-2 bg-red-900/40 border border-red-700 rounded-lg text-red-300 text-xs animate-slide-in">
          {error}
          <button onClick={fetchSkills} className="ml-2 underline hover:text-red-200">重试</button>
        </div>
      )}

      <div className="flex-1 min-h-0">
        {tab === 'catalog' && <SkillCatalog />}
        {tab === 'matcher' && <SkillMatcher />}
      </div>
    </div>
  )
}
