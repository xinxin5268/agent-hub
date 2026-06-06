// ============================================================
// Connect Dialog
// ============================================================

import { useState } from 'react'

interface ConnectDialogProps {
  defaultUrl: string
  onConnect: (url: string, token?: string) => void
  onSkip: () => void
}

export function ConnectDialog({ defaultUrl, onConnect, onSkip }: ConnectDialogProps) {
  const [url, setUrl] = useState(defaultUrl)
  const [token, setToken] = useState('')
  const [showToken, setShowToken] = useState(false)

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-96 shadow-2xl animate-fade-in">
        <h2 className="text-xl font-bold text-gray-100 mb-1">连接 Gateway</h2>
        <p className="text-sm text-gray-400 mb-4">连接到 OpenClaw Gateway 以获取实时 Agent 数据</p>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-500 block mb-1">WebSocket 地址</label>
            <input
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="ws://localhost:8080"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100
                focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="flex items-center gap-2 text-xs text-gray-500 mb-1">
              <input type="checkbox" checked={showToken} onChange={e => setShowToken(e.target.checked)}
                className="rounded bg-gray-800 border-gray-600" />
              需要 Token
            </label>
            {showToken && (
              <input
                value={token}
                onChange={e => setToken(e.target.value)}
                placeholder="Gateway Token"
                type="password"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100
                  focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            )}
          </div>
        </div>

        <div className="flex gap-2 mt-6">
          <button
            onClick={() => onConnect(url, token || undefined)}
            className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
          >
            连接
          </button>
          <button
            onClick={onSkip}
            className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg px-4 py-2 text-sm transition-colors"
          >
            跳过（演示数据）
          </button>
        </div>
      </div>
    </div>
  )
}