# Agent Hub 🦞

> **多 Agent 协作管理系统** — 让 AI Agent 集群像真实团队一样工作

<p align="center">
  <img src="https://img.shields.io/github/stars/xinxin5268/agent-hub?style=social" alt="stars" />
  <img src="https://img.shields.io/github/license/xinxin5268/agent-hub" alt="license" />
  <img src="https://img.shields.io/badge/PRs-welcome-brightgreen" alt="prs" />
  <img src="https://img.shields.io/github/languages/top/xinxin5268/agent-hub" alt="lang" />
</p>

## 简介

Agent Hub 是一个多异构 Agent 协作平台，通过 WebSocket + 消息队列实现 Agent 间的通信与任务编排。

## 核心能力

- **Agent 编排** — 消息路由 + 状态追踪 + 任务分发
- **管线系统** — 多阶段管线，每阶段质量门禁
- **专家库** — 即插即用 AI 专家角色
- **AIGC 工作流** — 小说 → 剧本 → 分镜 → 视频

## 快速开始

```bash
git clone https://github.com/xinxin5268/agent-hub.git
cd agent-hub
npm install
node server/hub-core.js
```

## 项目结构

```
agent-hub/
├── src/              # 前端源码
├── server/           # 后端服务
└── scripts/          # 部署脚本
```

## License

MIT
