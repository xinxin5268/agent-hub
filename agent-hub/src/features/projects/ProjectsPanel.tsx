// ============================================================
// Projects Panel — 项目管理
// 创建项目时可选择参与的 Agent，数据保存到后端 API
// ============================================================

import { useState, useEffect, useCallback } from 'react'
import { useHubStore, getRegistryUrl } from '@/lib/store'
import type { Project } from '@/types'

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  planning: { label: '规划中', color: 'bg-gray-500' },
  in_progress: { label: '进行中', color: 'bg-blue-500' },
  review: { label: '审核中', color: 'bg-yellow-500' },
  done: { label: '已完成', color: 'bg-green-500' },
}

export function ProjectsPanel() {
  const { projects, setProjects, agents } = useHubStore()
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [selectedAgents, setSelectedAgents] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  const baseUrl = getRegistryUrl()

  // 从后端加载项目
  const fetchProjects = useCallback(async () => {
    try {
      const resp = await fetch(`${baseUrl}/api/projects`)
      const data = await resp.json()
      if (data.ok && Array.isArray(data.projects)) {
        setProjects(data.projects.map((p: any) => ({
          ...p,
          tasks: p.tasks || [],
          status: p.status || 'planning',
          progress: p.progress || 0,
        })))
      }
    } catch {}
  }, [baseUrl, setProjects])

  useEffect(() => { fetchProjects() }, [fetchProjects])

  const toggleAgent = (id: string) => {
    setSelectedAgents(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  const handleCreate = async () => {
    if (!newName.trim()) return
    setSaving(true)
    try {
      const resp = await fetch(`${baseUrl}/api/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName,
          description: newDesc,
          assignedAgents: selectedAgents,
        }),
      })
      const data = await resp.json()
      if (data.ok) {
        await fetchProjects()
        setNewName('')
        setNewDesc('')
        setSelectedAgents([])
        setShowCreate(false)
      }
    } catch {}
    setSaving(false)
  }

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-100">项目管理</h2>
        <button
          onClick={() => setShowCreate(true)}
          className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          + 新建项目
        </button>
      </div>

      {/* Create Dialog */}
      {showCreate && (
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 mb-4 animate-slide-in">
          <h3 className="text-sm font-semibold text-gray-200 mb-3">新建项目</h3>
          <div className="space-y-3">
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="项目名称"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100
                focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <textarea
              value={newDesc}
              onChange={e => setNewDesc(e.target.value)}
              placeholder="项目描述"
              rows={2}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100
                focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />

            {/* Agent 多选 */}
            <div>
              <label className="text-xs text-gray-500 block mb-2">参与 Agent</label>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {agents.filter(a => a.status !== 'offline').map(agent => (
                  <label
                    key={agent.id}
                    className="flex items-center gap-2 bg-gray-800 rounded-lg px-3 py-2 cursor-pointer hover:bg-gray-700 transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={selectedAgents.includes(agent.id)}
                      onChange={() => toggleAgent(agent.id)}
                      className="rounded bg-gray-800 border-gray-600"
                    />
                    <span className="flex items-center gap-1.5 text-sm text-gray-200">
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        agent.status === 'online' ? 'bg-green-500' : 'bg-gray-600'
                      }`} />
                      {agent.name}
                    </span>
                    <span className="text-xs text-gray-500 ml-auto">{agent.id}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleCreate}
                disabled={!newName.trim() || saving}
                className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm"
              >
                {saving ? '创建中...' : '创建'}
              </button>
              <button onClick={() => setShowCreate(false)} className="bg-gray-800 hover:bg-gray-700 text-gray-300 px-4 py-2 rounded-lg text-sm">取消</button>
            </div>
          </div>
        </div>
      )}

      {/* Project Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {projects.map(project => (
          <ProjectCard key={project.id} project={project} onDelete={() => fetchProjects()} />
        ))}
        {projects.length === 0 && (
          <div className="col-span-full text-center text-gray-600 py-16">
            <div className="text-3xl mb-2">📋</div>
            <p className="text-sm">还没有项目</p>
            <p className="text-xs mt-1">点击"新建项目"开始</p>
          </div>
        )}
      </div>
    </div>
  )
}

function ProjectCard({ project, onDelete }: { project: Project; onDelete?: () => void }) {
  const sc = STATUS_CONFIG[project.status] || STATUS_CONFIG.planning
  const taskDone = project.tasks.filter(t => t.status === 'done').length
  const taskTotal = project.tasks.length

  const handleDelete = async () => {
    if (!confirm(`确定删除项目 "${project.name}" ？`)) return
    try {
      const base = getRegistryUrl()
      await fetch(base + '/api/projects/' + project.id, { method: 'DELETE' })
      onDelete?.()
    } catch {}
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 hover:border-gray-700 transition-colors group">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-100 truncate">{project.name}</h3>
          <p className="text-xs text-gray-500 mt-1 line-clamp-2">{project.description}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <span className={'text-xs px-2 py-0.5 rounded-full text-white ' + sc.color}>
            {sc.label}
          </span>
          <button
            onClick={handleDelete}
            className="opacity-0 group-hover:opacity-100 text-xs text-red-400 hover:text-red-300 px-1.5 py-0.5 rounded bg-gray-800 hover:bg-gray-700 transition-all"
            title="删除项目"
          >✕</button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-3">
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>进度</span>
          <span>{project.progress}%</span>
        </div>
        <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-indigo-500 to-cyan-400 rounded-full transition-all duration-500"
            style={{ width: `${project.progress}%` }}
          />
        </div>
      </div>

      {/* Meta */}
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>{taskTotal > 0 ? `${taskDone}/${taskTotal} 任务` : '0 任务'}</span>
        <span>{project.assignedAgents.length} Agent</span>
      </div>
    </div>
  )
}