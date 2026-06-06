// ============================================================
// SkillsRadar — Agent 能力雷达图
// 基于 skills 数量可视化，展示 Agent 的技能分布
// ============================================================

import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer } from 'recharts'

// 技能大类映射
const CATEGORY_MAP: Record<string, string> = {
  frontend: '前端',
  backend: '后端',
  database: '数据库',
  devops: 'DevOps',
  security: '安全',
  ai: 'AI',
  design: '设计',
  testing: '测试',
  data: '数据',
  mobile: '移动端',
  network: '网络',
  api: 'API',
  python: 'Python',
  javascript: 'JavaScript',
  typescript: 'TypeScript',
  react: 'React',
  node: 'Node',
  rust: 'Rust',
  go: 'Go',
  java: 'Java',
  docker: 'Docker',
  kubernetes: 'K8s',
  linux: 'Linux',
  git: 'Git',
  cloud: '云服务',
  cicd: 'CI/CD',
  block: '区块链',
  game: '游戏',
  iot: 'IoT',
}

function categorizeSkill(skillName: string): string {
  const lower = skillName.toLowerCase()
  for (const [key, label] of Object.entries(CATEGORY_MAP)) {
    if (lower.includes(key)) return label
  }
  return '其他'
}

interface SkillsRadarProps {
  skills: string[]
}

export function SkillsRadar({ skills }: SkillsRadarProps) {
  // 按大类统计技能数量
  const categoryCounts: Record<string, number> = {}
  for (const s of skills) {
    const cat = categorizeSkill(s)
    categoryCounts[cat] = (categoryCounts[cat] || 0) + 1
  }

  const data = Object.entries(categoryCounts)
    .map(([category, count]) => ({ category, count: Math.min(count, 10) }))
    .slice(0, 8) // 最多显示 8 个维度

  if (data.length < 3) return null // 不足 3 个维度时不显示

  return (
    <div className="bg-gray-800/30 rounded-lg p-2">
      <div className="text-[10px] text-gray-500 mb-1 font-medium">能力雷达</div>
      <ResponsiveContainer width="100%" height={140}>
        <RadarChart data={data} cx="50%" cy="50%" outerRadius="65%">
          <PolarGrid stroke="#374151" strokeWidth={0.5} />
          <PolarAngleAxis dataKey="category" tick={{ fontSize: 9, fill: '#9CA3AF' }} />
          <PolarRadiusAxis angle={90} domain={[0, 10]} tick={false} axisLine={false} />
          <Radar
            name="技能"
            dataKey="count"
            stroke="#818CF8"
            fill="#818CF8"
            fillOpacity={0.2}
            strokeWidth={1.5}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  )
}
