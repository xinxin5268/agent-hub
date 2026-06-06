# Smart Skill Manager — 核心规则（自动注入版）

适用于直接粘贴到 `AGENTS.md` 的场景推荐规则。

IF 收到新任务 THEN 扫描 skill 上下文 → 调用 `classifier.py match` 分类匹配
IF 分类完成 THEN 按三级层级生成推荐清单（核心层始终加载 / 工具层按任务关键词 / 场景层按主题）
IF 是核心层 skill THEN 始终加载，不占「可选的」token 预算
IF 是工具层 skill THEN 仅当任务关键词匹配时推荐，按匹配度排序，最多 SKILL_MANAGER_MAX_RECOMMEND 个
IF 是场景层 skill THEN 按主题批量推荐（如「安全审计」→ 安全工具包）
IF 用户/Agent 确认 THEN 调用 `classifier.py load` 标记加载
IF 任务完成 THEN 调用 `classifier.py cleanup` 清理未用 skill
IF 弱模型 THEN 推荐不超过 5 个，所有推荐按匹配度排序
IF SKILL_MANAGER_DISABLE=true THEN 跳过所有推荐和加载逻辑（最高优先级，覆盖 CORE_ONLY）
IF SKILL_MANAGER_CORE_ONLY=true THEN 仅保留核心层，不推荐工具层和场景层（仅当 DISABLE 未设置时生效）
IF 任务包含「安全/扫描/漏洞」关键词 THEN 自动推荐安全工具 + 安全审计场景
IF 任务包含「写/创建/开发」关键词 THEN 推荐代码工具，但不过度加载（只推最高匹配的 3 个）
IF 工具层匹配了某个分类的多个技能 THEN 自动关联该分类所属的场景层
IF 任务描述包含中文 AND 分词不理想 THEN classifier 自动用 jieba 或关键词表补充匹配
IF 场景层被自动关联（非关键词直匹配）THEN 在推荐中标注「auto」
IF 清理时指定 --keep core THEN 仅清理工具层和场景层，核心层不受影响
IF 环境变量 SKILL_MANAGER_AUTO_RECOMMEND=false THEN 等待手动输入 match 命令再推荐
