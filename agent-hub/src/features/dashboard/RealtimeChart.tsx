// ============================================================
// RealtimeChart — 实时监测折线图
// SVG 折线图显示 Agent 延迟/健康分历史曲线，每 30 秒自动更新
// ============================================================

import { useState, useEffect, useRef } from 'react'
import { getRegistryUrl } from '@/lib/store'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface DataPoint {
  timestamp: number
  value: number
}

interface RealtimeChartProps {
  agentId?: string          // 留空则显示全部 Agent 平均
  metric?: 'latency' | 'healthScore' | 'cpu' | 'errorRate'
  title?: string
  height?: number           // 默认 120
  maxPoints?: number        // 默认 30
  color?: string
}

function getMetricColor(metric: string): string {
  const colors: Record<string, string> = {
    latency: '#06b6d4',
    healthScore: '#22c55e',
    cpu: '#f97316',
    errorRate: '#ef4444',
  }
  return colors[metric] || '#22c55e'
}

function getMetricLabel(metric: string): string {
  const labels: Record<string, string> = {
    latency: '延迟 (ms)',
    healthScore: '健康分',
    cpu: 'CPU (%)',
    errorRate: '错误率 (%)',
  }
  return labels[metric] || metric
}

export function RealtimeChart({
  agentId,
  metric = 'healthScore',
  title,
  height = 120,
  maxPoints = 30,
  color,
}: RealtimeChartProps) {
  const [data, setData] = useState<DataPoint[]>([])
  const chartRef = useRef<HTMLDivElement>(null)
  const effectiveColor = color || getMetricColor(metric)
  const chartTitle = title || getMetricLabel(metric)

  // 加载初始数据并设置定时轮询
  useEffect(() => {
    const fetchData = async () => {
      try {
        const resp = await fetch(getRegistryUrl() + '/api/monitor')
        const result = await resp.json()
        if (!result.ok) return

        const agents = result.agents || {}
        let value: number

        if (agentId && agents[agentId]) {
          value = agents[agentId][metric] ?? 0
        } else {
          // 全部 Agent 平均
          const values = Object.values(agents).map((a: any) => a[metric] ?? 0)
          value = values.length > 0
            ? values.reduce((a: number, b: number) => a + b, 0) / values.length
            : 0
        }

        setData(prev => {
          const now = Date.now()
          const next = [...prev, { timestamp: now, value }]
          // 保留最近 maxPoints 个点
          return next.slice(-maxPoints)
        })
      } catch {}
    }

    // 立即拉取一次
    fetchData()

    // 每 30 秒更新
    const interval = setInterval(fetchData, 30000)
    return () => clearInterval(interval)
  }, [agentId, metric, maxPoints])

  if (data.length === 0) {
    return (
      <div className="bg-gray-900/60 border border-gray-800/50 rounded-xl p-3">
        <div className="text-[10px] text-gray-500 mb-2">{chartTitle}</div>
        <div style={{ height }} className="flex items-center justify-center text-gray-600 text-xs">
          等待数据...
        </div>
      </div>
    )
  }

  // 计算趋势
  const lastValue = data[data.length - 1].value
  const prevValue = data.length > 1 ? data[data.length - 2].value : lastValue
  const trend = lastValue > prevValue ? 'up' : lastValue < prevValue ? 'down' : 'flat'
  const trendColor = metric === 'errorRate'
    ? (trend === 'up' ? 'text-red-400' : trend === 'down' ? 'text-green-400' : 'text-gray-400')
    : (trend === 'up' ? 'text-green-400' : trend === 'down' ? 'text-red-400' : 'text-gray-400')

  // SVG 折线图
  const padding = { top: 8, right: 8, bottom: 20, left: 8 }
  const chartW = 280
  const chartH = height
  const plotW = chartW - padding.left - padding.right
  const plotH = chartH - padding.top - padding.bottom

  // 计算数据范围
  const values = data.map(d => d.value)
  const minVal = Math.min(...values)
  const maxVal = Math.max(...values)
  const range = maxVal - minVal || 1
  const paddingRatio = 0.1
  const yMin = minVal - range * paddingRatio
  const yMax = maxVal + range * paddingRatio
  const yRange = yMax - yMin || 1

  // 生成折线路径
  const points = data.map((d, i) => {
    const x = padding.left + (i / (data.length - 1 || 1)) * plotW
    const y = padding.top + (1 - (d.value - yMin) / yRange) * plotH
    return `${x},${y}`
  })
  const pathD = points.length > 1
    ? `M ${points.join(' L ')}`
    : `M ${points[0]} L ${points[0]}`

  // 渐变填充
  const fillPathD = pathD + ` L ${padding.left + plotW},${padding.top + plotH} L ${padding.left},${padding.top + plotH} Z`

  // Y 轴刻度
  const yTicks = 3
  const yTickValues = Array.from({ length: yTicks }, (_, i) => yMin + (yRange * (i + 1)) / (yTicks + 1))

  return (
    <div className="bg-gray-900/60 border border-gray-800/50 rounded-xl p-3">
      {/* 标题 + 当前值 + 趋势 */}
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] text-gray-500">{chartTitle}</span>
        <div className="flex items-center gap-1">
          <span className="text-xs font-mono font-bold" style={{ color: effectiveColor }}>
            {metric === 'latency' ? `${lastValue.toFixed(0)}ms` : lastValue.toFixed(1)}
          </span>
          <span className={trendColor}>
            {trend === 'up' ? <TrendingUp size={10} /> : trend === 'down' ? <TrendingDown size={10} /> : <Minus size={10} />}
          </span>
        </div>
      </div>

      {/* SVG 折线图 */}
      <svg width="100%" height={chartH} viewBox={`0 0 ${chartW} ${chartH}`} preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id={`gradient-${metric}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={effectiveColor} stopOpacity={0.25} />
            <stop offset="100%" stopColor={effectiveColor} stopOpacity={0.02} />
          </linearGradient>
        </defs>

        {/* Y 轴参考线 */}
        {yTickValues.map((v, i) => (
          <line
            key={i}
            x1={padding.left}
            y1={padding.top + (1 - (v - yMin) / yRange) * plotH}
            x2={padding.left + plotW}
            y2={padding.top + (1 - (v - yMin) / yRange) * plotH}
            stroke="rgba(255,255,255,0.04)"
            strokeWidth={0.5}
          />
        ))}

        {/* 填充区域 */}
        <path
          d={fillPathD}
          fill={`url(#gradient-${metric})`}
        />

        {/* 折线 */}
        <path
          d={pathD}
          fill="none"
          stroke={effectiveColor}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            filter: `drop-shadow(0 0 3px ${effectiveColor}44)`,
          }}
        />

        {/* 最新数据点 */}
        <circle
          cx={padding.left + plotW}
          cy={padding.top + (1 - (lastValue - yMin) / yRange) * plotH}
          r={2.5}
          fill={effectiveColor}
          stroke="#1f2937"
          strokeWidth={1}
        />

        {/* X 轴时间标签（首尾） */}
        <text x={padding.left} y={chartH - 4} fill="rgba(255,255,255,0.2)" fontSize={8}>
          {new Date(data[0].timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </text>
        <text x={padding.left + plotW} y={chartH - 4} fill="rgba(255,255,255,0.2)" fontSize={8} textAnchor="end">
          {new Date(data[data.length - 1].timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </text>
      </svg>
    </div>
  )
}