import json
d = json.load(open('/home/chenxin520/.openclaw/openclaw.json'))
keys_to_show = [k for k in d.keys() if k not in ('skills', 'subagents')]
print(json.dumps({k: d[k] for k in keys_to_show}, indent=2, ensure_ascii=False)[:3000])
