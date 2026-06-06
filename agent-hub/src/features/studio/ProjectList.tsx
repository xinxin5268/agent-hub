// ============================================================
// Project List — 项目侧边栏
// 显示项目列表，支持选中、新建、重命名、删除
// ============================================================

import { useState, useCallback, useRef, useEffect } from 'react'
import { useHubStore } from '@/lib/store'
import type { Project } from '@/types'
import { FolderKanban, Plus, MoreHorizontal } from 'lucide-react'

interface ProjectListProps {
  selectedProjectId: string | null
  onSelectProject: (id: string | null) => void
}

export function ProjectList({ selectedProjectId, onSelectProject }: ProjectListProps) {
  const { projects, agents, addProject, updateProject } = useHubStore()
  const [contextMenu, setContextMenu] = useState<{ projectId: string; x: number; y: number } | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const menuRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // 点击外部关闭右键菜单
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as HTMLElement)) {
        setContextMenu(null)
      }
    }
    if (contextMenu) {
      document.addEventListener('mousedown', handleClick)
      return () => document.removeEventListener('mousedown', handleClick)
    }
  }, [contextMenu])

  // 新建项目
  const handleNewProject = useCallback(() => {
    const newProject: Project = {
      id: `proj-${Date.now()}`,
      name: `新项目 ${projects.length + 1}`,
      description: '',
      assignedAgents: [],
      status: 'planning',
      progress: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      tasks: [],
    }
    addProject(newProject)
    onSelectProject(newProject.id)
    // 自动进入重命名
    setTimeout(() => {
      setRenamingId(newProject.id)
      setRenameValue(newProject.name)
    }, 100)
  }, [projects.length, addProject, onSelectProject])

  // 右键菜单
  const handleContextMenu = useCallback((e: React.MouseEvent, projectId: string) => {
    e.preventDefault()
    setContextMenu({ projectId, x: e.clientX, y: e.clientY })
  }, [])

  // 重命名
  const handleStartRename = useCallback(() => {
    if (!contextMenu) return
    const project = projects.find(p => p.id === contextMenu.projectId)
    if (project) {
      setRenamingId(contextMenu.projectId)
      setRenameValue(project.name)
    }
    setContextMenu(null)
  }, [contextMenu, projects])

  const handleConfirmRename = useCallback(() => {
    if (renamingId && renameValue.trim()) {
      updateProject(renamingId, { name: renameValue.trim() })
    }
    setRenamingId(null)
    setRenameValue('')
  }, [renamingId, renameValue, updateProject])

  const handleCancelRename = useCallback(() => {
    setRenamingId(null)
    setRenameValue('')
  }, [])

  // 删除项目
  const handleDelete = useCallback(() => {
    if (!contextMenu) return
    // 软删除：将项目名标记为已删除
    updateProject(contextMenu.projectId, { name: `[已删除] ${projects.find(p => p.id === contextMenu.projectId)?.name || ''}` })
    setContextMenu(null)
    if (selectedProjectId === contextMenu.projectId) {
      onSelectProject(null)
    }
  }, [contextMenu, projects, selectedProjectId, updateProject, onSelectProject])

  // ── Drag & Drop: handle drop agent onto project ──
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'link'
  }, [])

  const handleDrop = useCallback((e: React.DragEvent, projectId: string) => {
    e.preventDefault()
    const agentId = e.dataTransfer.getData('text/agent-id')
    if (!agentId) return
    const project = projects.find(p => p.id === projectId)
    if (!project) return
    if (project.assignedAgents.includes(agentId)) return // already assigned
    updateProject(projectId, {
      assignedAgents: [...project.assignedAgents, agentId],
      updatedAt: Date.now(),
    })
  }, [projects, updateProject])

  // 计算项目的在线 Agent 数
  const getOnlineAgentCount = (project: Project) => {
    return project.assignedAgents.filter(agentId =>
      agents.some(a => a.id === agentId && a.status === 'online')
    ).length
  }

  return (
    <div className="w-64 border-r border-gray-800/60 flex flex-col shrink-0 bg-gray-950">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-800/60">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FolderKanban size={16} className="text-gray-400" />
            <span className="text-sm font-semibold">项目</span>
          </div>
          <button
            onClick={handleNewProject}
            className="p-1 rounded hover:bg-gray-800 text-gray-400 hover:text-gray-200 transition-colors"
            title="新建项目"
          >
            <Plus size={14} />
          </button>
        </div>
      </div>

      {/* Project List */}
      <div className="flex-1 overflow-y-auto">
        {projects.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-gray-600 px-4">
            <FolderKanban size={24} className="mb-2 opacity-30" />
            <p className="text-xs text-center">暂无项目</p>
            <button
              onClick={handleNewProject}
              className="mt-2 text-xs text-blue-400 hover:text-blue-300"
            >
              创建第一个项目
            </button>
          </div>
        )}

        {projects.map(project => (
          <div
            key={project.id}
            onClick={() => onSelectProject(project.id)}
            onContextMenu={(e) => handleContextMenu(e, project.id)}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, project.id)}
            className={`group flex items-center justify-between px-3 py-2.5 cursor-pointer transition-colors border-l-2 animate-fade-in
              ${selectedProjectId === project.id
                ? 'bg-gray-800/60 border-l-blue-500'
                : 'border-l-transparent hover:bg-gray-900/60'
              }
              hover:ring-1 hover:ring-blue-500/20`}
          >
            <div className="flex-1 min-w-0">
              {renamingId === project.id ? (
                <input
                  ref={inputRef}
                  type="text"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={handleConfirmRename}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleConfirmRename()
                    if (e.key === 'Escape') handleCancelRename()
                  }}
                  className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-0.5 text-sm text-gray-100 outline-none focus:border-blue-500"
                  autoFocus
                />
              ) : (
                <>
                  <div className="text-sm font-medium truncate text-gray-100">{project.name}</div>
                  <div className="flex items-center gap-2 text-[10px] text-gray-500 mt-0.5">
                    <span>{project.assignedAgents.length} Agents</span>
                    <span className="text-green-400">{getOnlineAgentCount(project)} 在线</span>
                  </div>
                  <div className="text-[9px] text-blue-500/40 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    📥 拖拽 Agent 到这里
                  </div>
                </>
              )}
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation()
                handleContextMenu(e, project.id)
              }}
              className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-gray-700 text-gray-400 transition-opacity"
            >
              <MoreHorizontal size={14} />
            </button>
          </div>
        ))}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          ref={menuRef}
          className="fixed z-50 bg-gray-800 border border-gray-700 rounded-lg shadow-xl py-1 min-w-[120px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            onClick={handleStartRename}
            className="w-full px-3 py-1.5 text-left text-sm text-gray-200 hover:bg-gray-700 transition-colors"
          >
            重命名
          </button>
          <button
            onClick={handleDelete}
            className="w-full px-3 py-1.5 text-left text-sm text-red-400 hover:bg-gray-700 transition-colors"
          >
            删除
          </button>
        </div>
      )}
    </div>
  )
}
