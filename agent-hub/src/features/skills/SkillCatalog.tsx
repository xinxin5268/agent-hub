import { useState, useMemo, useCallback, useRef } from 'react'
import { useHubStore } from '@/lib/store'
import type { SkillInfo } from '@/types'

const STATUS_LABELS: Record<string, string> = {
  active: '活跃',
  inactive: '未激活',
  conflict: '冲突',
}

const TIER_CONFIG: Record<string, { label: string; color: string; icon: string; bar: string }> = {
  core: { label: '核心层', color: 'bg-purple-700', icon: '核', bar: 'bg-purple-500' },
  toolkit: { label: '工具层', color: 'bg-blue-700', icon: '工', bar: 'bg-blue-500' },
  scenario: { label: '场景层', color: 'bg-emerald-700', icon: '场', bar: 'bg-emerald-500' },
  unknown: { label: '未分类', color: 'bg-gray-600', icon: '?', bar: 'bg-gray-500' },
}

function getFavorites(): string[] {
  try { return JSON.parse(localStorage.getItem('skill-favs') || '[]') } catch { return [] }
}
function saveFavorites(ids: string[]) {
  localStorage.setItem('skill-favs', JSON.stringify(ids))
}

export function SkillCatalog() {
  const { skills, skillLoading } = useHubStore()
  const [search, setSearch] = useState('')
  const [tierFilter, setTierFilter] = useState<string>('all')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [favorites, setFavorites] = useState<string[]>(getFavorites)
  const [order, setOrder] = useState<string[]>(() => [])
  const dragIdx = useRef<number | null>(null)

  const sortedOrder = useMemo(() => {
    if (order.length > 0) return order
    const list = [...skills]
    const tierOrder = { core: 0, toolkit: 1, scenario: 2, unknown: 3 }
    list.sort((a, b) => {
      const ta = tierOrder[a.tier] ?? 99
      const tb = tierOrder[b.tier] ?? 99
      if (ta !== tb) return ta - tb
      return a.name.localeCompare(b.name)
    })
    return list.map(s => s.name)
  }, [skills, order])

  const filtered = useMemo(() => {
    let names = sortedOrder
    if (tierFilter === 'fav') {
      names = names.filter(n => favorites.includes(n))
    } else if (tierFilter !== 'all') {
      names = names.filter(n => {
        const skill = skills.find(s => s.name === n)
        return skill?.tier === tierFilter
      })
    }
    if (search) {
      const q = search.toLowerCase()
      names = names.filter(n => {
        const skill = skills.find(s => s.name === n)
        if (!skill) return false
        return skill.name.toLowerCase().includes(q) ||
          skill.description?.toLowerCase().includes(q) ||
          skill.category?.toLowerCase().includes(q)
      })
    }
    return names
  }, [sortedOrder, skills, search, tierFilter, favorites])

  const tiers = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const s of skills) counts[s.tier] = (counts[s.tier] || 0) + 1
    return counts
  }, [skills])

  const toggleFav = (name: string) => {
    setFavorites(prev => {
      const next = prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
      saveFavorites(next)
      return next
    })
  }

  const handleDragStart = (idx: number) => { dragIdx.current = idx }
  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault()
    if (dragIdx.current === null || dragIdx.current === idx) return
    const newOrder = [...sortedOrder]
    const [moved] = newOrder.splice(dragIdx.current, 1)
    newOrder.splice(idx, 0, moved)
    setOrder(newOrder)
    dragIdx.current = idx
  }
  const handleDragEnd = () => { dragIdx.current = null }

  if (skillLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="h-12 bg-gray-800/50 rounded-lg animate-pulse" style={{ animationDelay: `${i * 0.08}s` }} />
        ))}
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-2 mb-3">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="搜索技能..."
          className="flex-1 px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
        />
        {favorites.length > 0 && (
          <span className="text-[10px] text-yellow-500 shrink-0">★ {favorites.length}</span>
        )}
      </div>

      <div className="flex gap-1.5 mb-3 overflow-x-auto pb-1">
        {[
          { key: 'all', label: '全部', count: skills.length, color: '' },
          { key: 'fav', label: '收藏', count: favorites.length, color: 'text-yellow-400' },
        ].concat(
          Object.entries(TIER_CONFIG).map(([k, c]) => ({ key: k, label: c.label, count: tiers[k] || 0, color: '' }))
        ).map(t => (
          <button
            key={t.key}
            onClick={() => setTierFilter(t.key)}
            className={`px-2.5 py-1 text-xs rounded-full shrink-0 transition-all duration-200 ${
              tierFilter === t.key
                ? 'bg-gray-600 text-white shadow-sm'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            } ${t.color}`}
          >
            {t.key === 'fav' ? '★ ' : ''}{t.label} ({t.count})
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto space-y-1">
        {filtered.map((name, i) => {
          const skill = skills.find(s => s.name === name)
          if (!skill) return null
          return (
            <div
              key={skill.name}
              draggable
              onDragStart={() => handleDragStart(i)}
              onDragOver={e => handleDragOver(e, i)}
              onDragEnd={handleDragEnd}
              className="animate-slide-in"
              style={{ animationDelay: `${Math.min(i * 0.03, 0.5)}s` }}
            >
              <SkillCard
                skill={skill}
                expanded={expanded === skill.name}
                onToggle={() => setExpanded(expanded === skill.name ? null : skill.name)}
                favorited={favorites.includes(skill.name)}
                onToggleFav={() => toggleFav(skill.name)}
              />
            </div>
          )
        })}
        {filtered.length === 0 && (
          <div className="text-center text-gray-500 text-xs py-12 animate-fade-in">
            {tierFilter === 'fav' ? '还没有收藏的技能，点击星级图标收藏' : '没有匹配的技能'}
          </div>
        )}
      </div>
    </div>
  )
}

function SkillCard({
  skill, expanded, onToggle, favorited, onToggleFav,
}: {
  skill: SkillInfo; expanded: boolean; onToggle: () => void; favorited: boolean; onToggleFav: () => void
}) {
  const cfg = TIER_CONFIG[skill.tier] || TIER_CONFIG.unknown
  const contentRef = useRef<HTMLDivElement>(null)

  const handleFavClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    onToggleFav()
  }

  return (
    <div
      className={`bg-gray-900/60 border rounded-lg overflow-hidden cursor-default transition-all duration-200 ${
        expanded ? 'border-gray-600 shadow-md' : 'border-gray-800 hover:border-gray-600'
      } ${favorited ? 'border-l-yellow-500 border-l-2' : ''}`}
    >
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-gray-800/50 transition-colors duration-150"
      >
        <span className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold text-white ${cfg.color} shrink-0`}>
          {cfg.icon}
        </span>
        <span className="text-xs font-medium text-gray-200 truncate">{skill.name}</span>
        <span className="text-[10px] text-gray-500 truncate hidden sm:block max-w-24">{skill.category}</span>
        <span className={`ml-auto text-[10px] px-1.5 py-0.5 rounded-full transition-colors ${
          skill.status === 'active' ? 'bg-green-900/40 text-green-400' : 'bg-gray-800 text-gray-500'
        }`}>
          {STATUS_LABELS[skill.status] || skill.status}
        </span>
        <span
          onClick={handleFavClick}
          className={`text-sm cursor-pointer transition-all duration-200 hover:scale-125 active:scale-150 ${
            favorited ? 'text-yellow-400 scale-110' : 'text-gray-600 hover:text-yellow-600'
          }`}
        >
          {favorited ? '★' : '☆'}
        </span>
        <span className={`text-gray-500 text-xs transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}>
          ▼
        </span>
      </button>

      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          expanded ? 'max-h-80 opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div ref={contentRef} className="px-3 pb-3 pt-1 space-y-2 text-xs text-gray-400 border-t border-gray-800">
          <p className="text-gray-300 leading-relaxed">{skill.description || '暂无描述'}</p>
          {skill.tags && skill.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {skill.tags.slice(0, 10).map(t => (
                <span key={t} className="px-1.5 py-0.5 bg-gray-800 rounded text-[10px] text-gray-400">{t}</span>
              ))}
            </div>
          )}
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
            {skill.triggers && skill.triggers.length > 0 && (
              <div>
                <span className="text-gray-500">触发词: </span>
                <span className="text-gray-300">{skill.triggers.slice(0, 4).join(', ')}</span>
              </div>
            )}
            {skill.tools && skill.tools.length > 0 && (
              <div>
                <span className="text-gray-500">工具: </span>
                <span className="text-gray-300">{skill.tools.slice(0, 4).join(', ')}</span>
              </div>
            )}
          </div>
          {skill.path && (
            <div className="text-gray-600 truncate text-[10px] font-mono" title={skill.path}>
              {skill.path}
            </div>
          )}
          <div className="flex gap-3 text-[10px] text-gray-500 pt-1 border-t border-gray-800/50">
            <span>大小: {skill.size || '--'}</span>
            {skill.last_agent && <span>所属Agent: {skill.last_agent}</span>}
            {skill.priority_score != null && <span>优先级: {skill.priority_score}</span>}
          </div>
        </div>
      </div>
    </div>
  )
}
