#!/bin/bash
# agency-agents 角色系统 — 发任务时自动加载对应角色定义
# 用法: source role-system.sh; load_role "engineering/code-reviewer"

ROLE_BASE="$HOME/.openclaw/workspace/agent-hub/agency-agents"

# 加载角色定义，返回 Markdown 内容
load_role() {
    local role_path="$1"
    local file=""
    
    # 支持短名：code-reviewer → engineering/engineering-code-reviewer.md
    case "$role_path" in
        code-reviewer|code-review)     file="$ROLE_BASE/engineering/engineering-code-reviewer.md" ;;
        frontend|frontend-dev)         file="$ROLE_BASE/engineering/engineering-frontend-developer.md" ;;
        architect|software-architect)  file="$ROLE_BASE/engineering/engineering-software-architect.md" ;;
        sre)                           file="$ROLE_BASE/engineering/engineering-sre.md" ;;
        security)                      file="$ROLE_BASE/engineering/engineering-security-engineer.md" ;;
        devops)                        file="$ROLE_BASE/engineering/engineering-devops-automator.md" ;;
        tester|test)                   file="$ROLE_BASE/testing/testing-qa-engineer.md" ;;
        designer|design)               file="$ROLE_BASE/design/design-ui-designer.md" ;;
        pm|product-manager)            file="$ROLE_BASE/product/product-manager.md" ;;
        technical-writer|writer)       file="$ROLE_BASE/engineering/engineering-technical-writer.md" ;;
        *)                             file="$ROLE_BASE/$role_path" ;;
    esac
    
    if [ -f "$file" ]; then
        # 提取 name + description
        head -10 "$file" | grep -E "^name:|^description:" | sed 's/^name:/角色:/' | sed 's/^description:/描述:/'
        echo "---"
        head -30 "$file" | grep -A100 "^#" | head -20
    else
        echo "⚠️ 角色文件不存在: $file"
        return 1
    fi
}

# 列出所有可用角色
list_roles() {
    echo "=== 可用角色 ==="
    for dept in engineering design marketing product finance legal hr sales support; do
        count=$(ls "$ROLE_BASE/$dept"/*.md 2>/dev/null | wc -l)
        [ "$count" -gt 0 ] && echo "  $dept ($count):"
        for f in "$ROLE_BASE/$dept"/*.md 2>/dev/null; do
            name=$(head -5 "$f" | grep "^name:" | sed 's/^name: //')
            short=$(basename "$f" .md | sed 's/^engineering-//')
            echo "    - $name → role $short"
        done
    done
}

case "${1:-}" in
    list|ls)  list_roles ;;
    load)     shift; load_role "$1" ;;
    *)        echo "用法: source role-system.sh; load_role <角色名> 或 list_roles" ;;
esac
