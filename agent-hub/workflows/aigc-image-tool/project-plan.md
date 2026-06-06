# AIGC 生图工具搭建 — 项目计划

## 目标
搭建一个输入一句话创意→自动生成多视角多人物带剧情对白的漫画/短剧的工具

## 4个子任务

### Task 1 🟢 角色卡/人设表生成 (xiaocong-win)
角色描述→标准化角色卡（基础数据+多视角+表情集+动作集）

### Task 2 🟢 安装 PenShot + ai-drama-platform (opencode-wsl)
剧本→分镜→prompt 流程验证

### Task 3 🟢 IP-Adapter + ControlNet 生图 (opencode-win)
ComfyUI + 角色一致性 + 姿态控制

### Task 4 ⏳ 整合框架 (xiaobao)
角色卡→分镜→生图 一体化

## 技术路线
GLM-5(剧本) + PenShot(分镜) + Wanx2.1/IP-Adapter(生图) + Wan2.6(视频)
