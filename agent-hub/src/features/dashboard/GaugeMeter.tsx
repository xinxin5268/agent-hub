// ============================================================
// GaugeMeter — 圆形仪表盘组件
// SVG 弧形进度条 + 数字显示 + 入场动画
// ============================================================

import { useEffect, useState } from 'react'

interface GaugeMeterProps {
  value: number    // 0-100
  label: string
  color?: string   // 默认按值渐变
  size?: number    // 默认 120px
}

function getDefaultColor(value: number): string {
  if (value >= 80) return '#22c55e' // green-500
  if (value >= 50) return '#eab308' // yellow-500
  if (value >= 30) return '#f97316' // orange-500
  return '#ef4444' // red-500
}

function getBackgroundColor(value: number): string {
  if (value >= 80) return '#166534' // green-900
  if (value >= 50) return '#713f12' // yellow-900
  if (value >= 30) return '#7c2d12' // orange-900
  return '#450a0a' // red-900
}

export function GaugeMeter({ value, label, color, size = 120 }: GaugeMeterProps) {
  const [animatedValue, setAnimatedValue] = useState(0)
  const effectiveColor = color || getDefaultColor(value)
  const bgColor = getBackgroundColor(value)

  // 入场动画
  useEffect(() => {
    const timer = setTimeout(() => setAnimatedValue(value), 50)
    return () => clearTimeout(timer)
  }, [value])

  // SVG 弧线参数
  const strokeWidth = 10
  const radius = (size - strokeWidth * 2) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - animatedValue / 100)

  // 弧线路径（从 225° 到 315°，即底部开口）
  const arcStartAngle = 225
  const arcEndAngle = 315
  const center = size / 2
  const startRad = ((arcStartAngle - 90) * Math.PI) / 180
  const endRad = ((arcEndAngle - 90) * Math.PI) / 180
  const startX = center + radius * Math.cos(startRad)
  const startY = center + radius * Math.sin(startRad)
  const endX = center + radius * Math.cos(endRad)
  const endY = center + radius * Math.sin(endRad)
  const largeArc = arcEndAngle - arcStartAngle > 180 ? 1 : 0

  return (
    <div className="flex flex-col items-center gap-1" style={{ width: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* 背景弧 */}
        <path
          d={`M ${startX} ${startY} A ${radius} ${radius} 0 ${largeArc} 1 ${endX} ${endY}`}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
        {/* 进度弧 */}
        <path
          d={`M ${startX} ${startY} A ${radius} ${radius} 0 ${largeArc} 1 ${endX} ${endY}`}
          fill="none"
          stroke={effectiveColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{
            transition: 'stroke-dashoffset 1s cubic-bezier(0.4, 0, 0.2, 1)',
            filter: `drop-shadow(0 0 4px ${effectiveColor}66)`,
          }}
        />
        {/* 数值文字 */}
        <text
          x={center}
          y={center - 2}
          textAnchor="middle"
          dominantBaseline="central"
          fill={effectiveColor}
          fontSize={size * 0.22}
          fontWeight="bold"
          fontFamily="monospace"
          style={{
            transition: 'color 1s ease',
          }}
        >
          {Math.round(animatedValue)}
        </text>
        <text
          x={center}
          y={center + size * 0.14}
          textAnchor="middle"
          dominantBaseline="central"
          fill="rgba(255,255,255,0.3)"
          fontSize={size * 0.08}
        >
          / 100
        </text>
      </svg>
      <span className="text-[10px] text-gray-400 font-medium truncate max-w-full text-center">
        {label}
      </span>
    </div>
  )
}
