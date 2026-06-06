// ============================================================
// Tasks Panel — Kanban board
// 任务数据通过后端 API 持久化
// ============================================================

import { useState, useEffect, useCallback } from 'react'
import { useHubStore, getRegistryUrl } from '@/lib/store'
import type { SkillMatch } from '@/types'

interface TaskItem {
  id: string
  projectId: string
  projectName?: string
  title: string
  description: string
  assignedTo: string
  status: 'todo' | 'in_progress' | 'review' | 'done'
  createdAt: number
  updatedAt: number
}

const COLUMNS = [
  { id: 'todo', label: '待办', color: 'border-gray-600' },
  { id: 'in_progress', label: '进行中', color: 'border-blue-500' },
  { id: 'review', label: '审核', color: 'border-yellow-500' },
  { id: 'done', label: '完成', color: 'border-green-500' },
]

export function TasksPanel() {
  const { projects, agents } = useHubStore()
  const [tasks, setTasks] = useState<TaskItem[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newProjectId, setNewProjectId] = useState('')
  const [newAssignedTo, setNewAssignedTo] = useState('')
  const [saving, setSaving] = useState(false)

  const baseUrl = getRegistryUrl()

  // 从后端加载所有任务（遍历每个项目）
  const fetchTasks = useCallback(async () => {
    const all: TaskItem[] = []
    for (const p of projects) {
      try {
        const resp = await fetch(`${baseUrl}/api/tasks/${p.id}`)
        const data = await resp.json()
        if (data.ok && Array.isArray(data.tasks)) {
          all.push(...data.tasks.map((t: any) => ({ ...t, projectName: p.name })))
        }
      } catch {}
    }
    setTasks(all)
  }, [baseUrl, projects])

  useEffect(() => { fetchTasks() }, [fetchTasks])

  // 自动分配：根据任务描述匹配技能，选择最适合的 Agent
  const [autoAssigning, setAutoAssigning] = useState(false)
  const [autoAssignResult, setAutoAssignResult] = useState<{taskId: string; agentId: string; agentName: string} | null>(null)

  const handleAutoAssign = async (task: TaskItem) => {
    setAutoAssigning(true)
    setAutoAssignResult(null)
    try {
      // 1. 调用技能匹配 API
      const matchResp = await fetch(`${baseUrl}/api/skills/match?task=${encodeURIComponent(task.title + ' ' + task.description)}`)
      const matchData = await matchResp.json()
      const matches: SkillMatch[] = matchData?.matches || matchData?.skills || []
      
      // 2. 根据匹配结果找 Agent
      const onlineAgents = agents.filter(a => a.status !== 'offline')
      let bestAgent: typeof agents[0] | null = null
      let bestScore = 0

      for (const agent of onlineAgents) {
        const agentSkills = agent.skills || []
        if (agentSkills.length === 0) continue
        // 计算技能匹配度
        let score = 0
        for (const match of matches) {
          const skillName = match.skill || ''
          if (agentSkills.some(s => s.toLowerCase().includes(skillName.toLowerCase()))) {
            score += parseFloat(match.score || '0') || 0.5
          }
        }
        if (score > bestScore) {
          bestScore = score
          bestAgent = agent
        }
      }

      // 如果没有匹配到，选第一个在线 Agent
      if (!bestAgent && onlineAgents.length > 0) {
        bestAgent = onlineAgents[0]
      }

      if (bestAgent) {
        // 3. 更新任务分配
        const updateResp = await fetch(`${baseUrl}/api/tasks/${task.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ assignedTo: bestAgent.id }),
        })
        const updateData = await updateResp.json()
        if (updateData.ok) {
          setAutoAssignResult({ taskId: task.id, agentId: bestAgent.id, agentName: bestAgent.name })
          await fetchTasks()
        }
      }
    } catch (e) {
      console.error('[auto-assign] error:', e)
    }
    setAutoAssigning(false)
  }

  // 创建任务
  const handleCreate = async () => {
    if (!newTitle.trim() || !newProjectId) return
    setSaving(true)
    try {
      const resp = await fetch(`${baseUrl}/api/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: newProjectId,
          title: newTitle,
          assignedTo: newAssignedTo,
        }),
      })
      const data = await resp.json()
      if (data.ok) {
        await fetchTasks()
        setNewTitle('')
        setNewProjectId('')
        setNewAssignedTo('')
        setShowCreate(false)
      }
    } catch {}
    setSaving(false)
  }

  // 拖拽更新状态
  const handleDrop = async (taskId: string, newStatus: string) => {
    try {
      await fetch(`${baseUrl}/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      await fetchTasks()
    } catch {}
  }

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-100">任务看板</h2>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">{tasks.length} 任务</span>
          <button
            onClick={() => setShowCreate(true)}
            className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            + 新建任务
          </button>
        </div>
      </div>

      {/* Create dialog */}
      {showCreate && (
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 mb-4 animate-slide-in">
          <h3 className="text-sm font-semibold text-gray-200 mb-3">新建任务</h3>
          <div className="space-y-3">
            <input
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              placeholder="任务标题"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <select
              value={newProjectId}
              onChange={e => setNewProjectId(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">选择项目</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <select
              value={newAssignedTo}
              onChange={e => setNewAssignedTo(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">分配给...</option>
              {agents.filter(a => a.status !== 'offline').map(a => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
            <div className="flex gap-2">
              <button
                onClick={handleCreate}
                disabled={!newTitle.trim() || !newProjectId || saving}
                className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm"
              >
                {saving ? '创建中...' : '创建'}
              </button>
              <button onClick={() => setShowCreate(false)} className="bg-gray-800 hover:bg-gray-700 text-gray-300 px-4 py-2 rounded-lg text-sm">取消</button>
            </div>
          </div>
        </div>
      )}

      {/* Kanban Board */}
      <div className="grid grid-cols-4 gap-3 h-[calc(100vh-200px)]">
        {COLUMNS.map(col => {
          const columnTasks = tasks.filter(t => t.status === col.id)
          return (
            <div
              key={col.id}
              className="bg-gray-900/50 border border-gray-800 rounded-xl flex flex-col"
              onDragOver={e => e.preventDefault()}
              onDrop={async e => {
                const taskId = e.dataTransfer.getData('text/task-id')
                if (taskId) await handleDrop(taskId, col.id)
              }}
            >
              {/* Column header */}
              <div className={`p-3 border-b border-gray-800 flex items-center justify-between ${col.color}`}>
                <h3 className="text-sm font-semibold text-gray-300">{col.label}</h3>
                <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full">{columnTasks.length}</span>
              </div>

              {/* Task cards */}
              <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {columnTasks.map(task => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onDragStart={e => {
                      e.dataTransfer.setData('text/task-id', task.id)
                      e.dataTransfer.effectAllowed = 'move'
                    }}
                  />
                ))}
                {columnTasks.length === 0 && (
                  <div className="text-center text-gray-700 text-xs py-8">暂无任务</div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function TaskCard({ task, onDragStart }: { task: TaskItem; onDragStart?: (e: React.DragEvent) => void }) {
  const time = new Date(task.updatedAt)
  const base = getRegistryUrl()

  const handleDelete = async () => {
    if (!confirm(`确定删除任务 "${task.title}" ？`)) return
    try {
      await fetch(base + '/api/tasks/' + task.id, { method: 'DELETE' })
      window.location.reload()
    } catch {}
  }

  return (
    <div
      className="bg-gray-800 border border-gray-700 rounded-lg p-3 hover:border-gray-600 transition-colors cursor-grab active:cursor-grabbing group"
      draggable
      onDragStart={onDragStart}
    >
      <div className="flex items-start justify-between mb-2">
        <span className="text-xs font-medium text-gray-200 line-clamp-2">{task.title}</span>
        <div className="flex items-center gap-1 shrink-0">
          {!task.assignedTo && (
            <AutoAssignBtn task={task} />
          )}
          <button
            onClick={handleDelete}
            className="opacity-0 group-hover:opacity-100 text-xs text-red-400 hover:text-red-300 transition-all"
          >✕</button>
        </div>
      </div>
      {task.projectName && (
        <div className="text-xs text-gray-500 mb-1">📁 {task.projectName}</div>
      )}
      {task.assignedTo && (
        <div className="text-xs text-gray-500">🤖 {task.assignedTo}</div>
      )}
      <div className="text-xs text-gray-600 mt-2">
        {time.toLocaleDateString('zh-CN')}
      </div>
    </div>
  )
}

// 自动分配按钮组件
function AutoAssignBtn({ task }: { task: TaskItem }) {
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const baseUrl = getRegistryUrl()

  const handleAutoAssign = async () => {
    setLoading(true)
    try {
      const matchResp = await fetch(`${baseUrl}/api/skills/match?task=${encodeURIComponent(task.title)}`)
      const matchData = await matchResp.json()
      const matches: SkillMatch[] = matchData?.matches || matchData?.skills || []

      // 从 store 获取在线 Agent
      const { agents } = useHubStore.getState()
      const onlineAgents = agents.filter(a => a.status !== 'offline')
      let bestAgent: any = null
      let bestScore = 0

      for (const agent of onlineAgents) {
        const agentSkills = agent.skills || []
        if (agentSkills.length === 0) continue
        let score = 0
        for (const match of matches) {
          const skillName = match.skill || ''
          if (agentSkills.some((s: string) => s.toLowerCase().includes(skillName.toLowerCase()))) {
            score += parseFloat(match.score || '0') || 0.5
          }
        }
        if (score > bestScore) {
          bestScore = score
          bestAgent = agent
        }
      }

      if (!bestAgent && onlineAgents.length > 0) {
        bestAgent = onlineAgents[0]
      }

      if (bestAgent) {
        await fetch(`${baseUrl}/api/tasks/${task.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ assignedTo: bestAgent.id }),
        })
        setDone(true)
        window.location.reload()
      }
    } catch {}
    setLoading(false)
  }

  if (done) return null
  return (
    <button
      onClick={handleAutoAssign}
      disabled={loading}
      className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600/30 border border-indigo-500/20 transition-colors disabled:opacity-40"
      title="自动分配 Agent"
    >
      {loading ? '...' : '🎯 自动'}
    </button>
  )
}