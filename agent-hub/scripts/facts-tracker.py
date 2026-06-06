#!/usr/bin/env python3
"""
facts-tracker.py — 状态回写脚本

读取章节文本，解析角色状态变化，追加到 facts.jsonl
"""

import json
import re
import os
from datetime import datetime

FACTS_FILE = os.path.join(os.path.dirname(__file__), '..', 'facts.jsonl')

def load_facts():
    if not os.path.exists(FACTS_FILE):
        return []
    with open(FACTS_FILE) as f:
        return [json.loads(line) for line in f if line.strip()]

def save_fact(entry):
    with open(FACTS_FILE, 'a') as f:
        f.write(json.dumps(entry, ensure_ascii=False) + '\n')

def extract_changes(chapter_text):
    """提取 ---CHANGES--- 块中的声明"""
    pattern = r'---CHANGES---\n(.*?)\n---END-CHANGES---'
    match = re.search(pattern, chapter_text, re.DOTALL)
    if not match:
        return []
    
    changes = []
    for line in match.group(1).strip().split('\n'):
        line = line.strip()
        if not line:
            continue
        m = re.match(r'^(\w+)\s*[:：]\s*(.+)$', line)
        if m:
            changes.append({'field': m.group(1), 'value': m.group(2).strip()})
    return changes

def track_characters(chapter_text, chapter_num):
    """追踪角色状态变化"""
    facts = load_facts()
    known_chars = {f['name']: f for f in facts if f['type'] == 'character'}
    
    # 提取角色名（简化版）
    char_pattern = r'[\u4e00-\u9fff]{2,4}(?:先生|小姐|女士)?'
    names = set(re.findall(char_pattern, chapter_text))
    
    for name in names:
        if name in known_chars:
            # 检测位置变化
            loc_pattern = rf'{name}.*?(?:在|来到|前往|回到|离开)\s*([^。，！？\n]{{1,20}})'
            loc_match = re.search(loc_pattern, chapter_text)
            if loc_match and loc_match.group(1) != known_chars[name].get('location'):
                save_fact({
                    'type': 'character',
                    'name': name,
                    'chapter': chapter_num,
                    'timestamp': datetime.utcnow().isoformat() + 'Z',
                    'location': loc_match.group(1),
                    'status': 'alive'
                })

def track_locations(chapter_text, chapter_num):
    """追踪地点变化"""
    loc_pattern = r'(?:在|来到|前往|回到|离开|进入)\s*([^。，！？\n]{2,15}(?:城|市|镇|村|楼|大厦|公园|广场|街道|路|区|馆|院|中心|基地|会所))'
    locs = set(re.findall(loc_pattern, chapter_text))
    for loc in locs:
        save_fact({
            'type': 'location',
            'name': loc,
            'chapter': chapter_num,
            'timestamp': datetime.utcnow().isoformat() + 'Z',
            'status': 'active'
        })

def main():
    import sys
    if len(sys.argv) < 2:
        print('用法: python3 facts-tracker.py <chapter.md> [chapter_num]')
        sys.exit(1)
    
    with open(sys.argv[1]) as f:
        text = f.read()
    
    chapter_num = int(sys.argv[2]) if len(sys.argv) > 2 else 1
    
    # 提取 CHANGES 声明
    changes = extract_changes(text)
    if changes:
        print(f'解析到 {len(changes)} 条状态变更')
    
    # 追踪角色
    track_characters(text, chapter_num)
    
    # 追踪地点
    track_locations(text, chapter_num)
    
    print(f'章节 {chapter_num} 状态回写完成')

if __name__ == '__main__':
    main()