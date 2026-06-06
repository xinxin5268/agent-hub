#!/bin/bash
python3 /home/chenxin520/.openclaw/workspace/agent-hub/smart-skill-manager/skill-bridge.py list 2>&1 | python3 -c "
import sys,json
d=json.load(sys.stdin)
print('OK=' + str(d.get('ok')) + ', total=' + str(len(d.get('skills',[]))))
if d.get('skills'):
    s=d['skills'][0]
    print('sample=' + s.get('name','?') + ' tier=' + s.get('tier','?'))
else:
    print('ERROR: ' + str(d.get('error','unknown')))
"