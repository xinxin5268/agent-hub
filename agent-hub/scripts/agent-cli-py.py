#!/usr/bin/env python3
"""
Agent Hub CLI — Python 数据处理辅助
接收 stdin 的 JSON 数据并格式化输出
"""
import json
import sys
from datetime import datetime
from typing import Any

# ─── 颜色（ANSI 转义序列） ───────────────────────────────
BOLD = '\033[1m'
NC = '\033[0m'
GREEN = '\033[0;32m'
YELLOW = '\033[1;33m'
BLUE = '\033[0;34m'
RED = '\033[0;31m'

STATUS_ICON = {'online': '🟢', 'busy': '🟡', 'offline': '🔴'}
PLATFORM_ICON = {'wsl': '🐧', 'windows': '🪟', 'linux': '🐧', 'macos': '🍎'}

def ts_to_str(ts: int) -> str:
    """Convert unix timestamp (ms or s) to readable string"""
    if not ts:
        return 'N/A'
    if ts > 1e12:
        ts = ts / 1000
    try:
        dt = datetime.fromtimestamp(ts)
        return dt.strftime('%H:%M:%S')
    except:
        return 'N/A'

def fmt_agent(a: dict, indent: str = '    ', show_ts: bool = False) -> str:
    """Format a single agent entry"""
    si = STATUS_ICON.get(a.get('status', ''), '⚪')
    pi = PLATFORM_ICON.get(a.get('platform', ''), '💻')
    name = a.get('name', a.get('id', '?'))
    aid = a.get('id', '?')
    atype = a.get('type', '?')
    host = a.get('host', '?')
    port = a.get('port', '?')
    role = (a.get('tags') or {}).get('role', '')
    models = a.get('models', [])

    lines = [f'{indent}{si} {pi} {BOLD}{name}{NC} ({aid})']
    lines.append(f'{indent}   Type: {atype}  |  {host}:{port}')
    if role:
        lines.append(f'{indent}   Role: {role}')
    if show_ts:
        lines.append(f'{indent}   心跳: {ts_to_str(a.get("lastHeartbeat", 0))}')
    if models:
        lines.append(f'{indent}   Models: {", ".join(models[:3])}')
    return '\n'.join(lines)

# ─── Commands ─────────────────────────────────────────────

def cmd_list(data: dict):
    agents = data.get('agents', [])
    stats = data.get('stats', {})

    print(f'{BOLD}📋 Agent 舰队{NC}')
    print('═' * 50)

    # Group by platform
    by_platform: dict[str, list] = {}
    for a in agents:
        p = a.get('platform', 'unknown')
        by_platform.setdefault(p, []).append(a)

    for platform in sorted(by_platform):
        plat_agents = by_platform[platform]
        icon = PLATFORM_ICON.get(platform, '💻')
        print(f'\n  {BOLD}{icon} {platform.upper()}{NC}')
        print(f'  {BLUE}{"─" * 40}{NC}')
        for a in plat_agents:
            print(fmt_agent(a))
            print()

    print(f'{BOLD}📊 统计{NC}')
    print(f'   总计: {stats.get("total", 0)}  |  🟢在线: {stats.get("online", 0)}  |  '
          f'🟡忙碌: {stats.get("busy", 0)}  |  🔴离线: {stats.get("offline", 0)}')

def cmd_status(data: dict):
    s = data
    print(f'{BOLD}📊 注册中心状态{NC}')
    print('═' * 40)
    print(f'  Agent 总数:     {BOLD}{s["total"]}{NC}')
    print(f'  🟢 在线:       {s["online"]}')
    print(f'  🟡 忙碌:       {s["busy"]}')
    print(f'  🔴 离线:       {s["offline"]}')
    print(f'\n  {BOLD}By 类型:{NC}')
    for t, c in s.get('byType', {}).items():
        print(f'    {t}: {c}')
    print(f'\n  {BOLD}By 平台:{NC}')
    for p, c in s.get('byPlatform', {}).items():
        icon = PLATFORM_ICON.get(p, '💻')
        print(f'    {icon} {p}: {c}')

def cmd_info(data: dict):
    a = data.get('agent', {})
    if not a:
        print('❌ Agent 未找到')
        return
    si = STATUS_ICON.get(a.get('status', ''), '⚪')
    print(f'{BOLD}Agent 详情{NC}')
    print('═' * 40)
    print(f'  {si} {BOLD}{a.get("name", a.get("id"))}{NC}')
    for k, v in a.items():
        if k in ('name', 'tags'):
            continue
        if k in ('lastHeartbeat', 'registeredAt'):
            v = ts_to_str(v)
        print(f'  {k}: {v}')
    if a.get('tags'):
        print(f'\n  {BOLD}Tags:{NC}')
        for tk, tv in a['tags'].items():
            print(f'    {tk} = {tv}')

def cmd_send(data: dict):
    if data.get('ok'):
        print(f'{GREEN}✅ 指令已发送{NC}')
    else:
        print(f'❌ 发送失败: {data.get("error", "unknown")}')

def cmd_exec(data: dict):
    if data.get('ok'):
        result = data.get('result', '')
        if result:
            print(f'{GREEN}✅ 执行成功{NC}')
            if isinstance(result, str):
                print(result)
            else:
                print(json.dumps(result, indent=2, ensure_ascii=False))
        else:
            print(f'{GREEN}✅ 指令已发送{NC}')
    else:
        print(f'❌ 失败: {data.get("error", "unknown")}')

def cmd_register(data: dict):
    if data.get('ok'):
        print(f'{GREEN}✅ 注册成功{NC}')
    else:
        print(f'❌ 失败: {data.get("error", "unknown")}')

def cmd_watch(data: dict):
    agents = data.get('agents', [])
    stats = data.get('stats', {})
    now = datetime.now()

    print(f'  总计: {stats.get("total", 0)}  '
          f'🟢在线: {stats.get("online", 0)}  '
          f'🟡忙碌: {stats.get("busy", 0)}  '
          f'🔴离线: {stats.get("offline", 0)}')
    print()

    for a in sorted(agents, key=lambda x: x.get('status', 'z') + x.get('name', '')):
        hb = a.get('lastHeartbeat', 0)
        if hb and hb > 1e12:
            hb = hb / 1000
        hb_str = 'N/A'
        if hb:
            try:
                delta = int((now - datetime.fromtimestamp(hb)).total_seconds())
                hb_str = f'{delta}s前' if delta < 60 else f'{delta // 60}m前'
            except:
                pass
        # Add heartbeat to tags for fmt_agent
        a['_hb_str'] = hb_str
        print(fmt_agent(a, show_ts=True))
        print()


def main():
    cmd = sys.argv[1] if len(sys.argv) > 1 else 'list'
    raw = sys.stdin.read()

    try:
        data = json.loads(raw) if raw.strip() else {}
    except json.JSONDecodeError as e:
        print(f'{RED}❌ JSON 解析错误: {e}{NC}', file=sys.stderr)
        sys.exit(1)

    commands = {
        'list': cmd_list,
        'status': cmd_status,
        'info': cmd_info,
        'send': cmd_send,
        'exec': cmd_exec,
        'register': cmd_register,
        'watch': cmd_watch,
    }

    handler = commands.get(cmd)
    if handler:
        handler(data)
    else:
        print(f'{RED}❌ 未知命令: {cmd}{NC}', file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
