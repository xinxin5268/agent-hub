#!/usr/bin/env python3
"""
publish-adapter.py — 发布适配器

将 HTML 小说转换为各平台格式
"""

import re
import sys
import os
from bs4 import BeautifulSoup

def html_to_plaintext(html_content):
    """HTML → 纯文本（起点/晋江格式）"""
    soup = BeautifulSoup(html_content, 'html.parser')
    
    # 提取所有卡片中的文本
    cards = soup.find_all(class_='card')
    text_parts = []
    
    for card in cards:
        tag = card.find(class_='chapter-tag')
        if tag:
            text_parts.append(f'\n【{tag.get_text(strip=True)}】\n')
        
        for p in card.find_all('p'):
            t = p.get_text(strip=True)
            if t:
                if p.get('class') and 'dialogue' in p.get('class'):
                    text_parts.append(f'  "{t}"')
                elif p.get('class') and 'thought' in p.get('class'):
                    text_parts.append(f'  （{t}）')
                else:
                    text_parts.append(f'    {t}')
    
    return '\n'.join(text_parts)

def html_to_markdown(html_content):
    """HTML → Markdown"""
    soup = BeautifulSoup(html_content, 'html.parser')
    
    md_parts = []
    
    # 标题
    title = soup.find('h1')
    if title:
        md_parts.append(f'# {title.get_text(strip=True)}\n')
    
    subtitle = soup.find(class_='sub')
    if subtitle:
        md_parts.append(f'*{subtitle.get_text(strip=True)}*\n')
    
    # 正文
    cards = soup.find_all(class_='card')
    for card in cards:
        tag = card.find(class_='chapter-tag')
        if tag:
            md_parts.append(f'\n## {tag.get_text(strip=True)}\n')
        
        for p in card.find_all('p'):
            t = p.get_text(strip=True)
            if not t:
                continue
            if p.get('class') and 'dialogue' in p.get('class'):
                md_parts.append(f'> "{t}"')
            elif p.get('class') and 'thought' in p.get('class'):
                md_parts.append(f'*（{t}）*')
            else:
                md_parts.append(t)
    
    # 评估部分
    eval_section = soup.find(id='eval')
    if eval_section:
        md_parts.append('\n---\n')
        for h in eval_section.find_all(['h2', 'h3']):
            md_parts.append(f'\n## {h.get_text(strip=True)}')
        for li in eval_section.find_all('li'):
            md_parts.append(f'- {li.get_text(strip=True)}')
    
    return '\n\n'.join(md_parts)

def html_to_wechat(html_content):
    """HTML → 公众号文章格式"""
    soup = BeautifulSoup(html_content, 'html.parser')
    
    style = '''
<style>
.novel-card { margin: 20px 0; padding: 20px; background: #f8f8f8; border-radius: 8px; }
.novel-card .tag { color: #888; font-size: 13px; }
.novel-card p { text-indent: 2em; line-height: 1.8; font-size: 16px; }
.novel-card .dialogue { color: #2a6ea8; }
.novel-card .thought { color: #999; font-style: italic; }
</style>
'''
    
    title = soup.find('h1')
    title_html = f'<h1>{title.get_text(strip=True)}</h1>' if title else ''
    
    cards_html = []
    for card in soup.find_all(class_='card'):
        cards_html.append(str(card))
    
    return f'{style}\n{title_html}\n' + '\n'.join(cards_html)

def main():
    if len(sys.argv) < 3:
        print('用法: python3 publish-adapter.py <input.html> <format>')
        print('format: plaintext | markdown | wechat')
        sys.exit(1)
    
    with open(sys.argv[1]) as f:
        html = f.read()
    
    fmt = sys.argv[2]
    
    if fmt == 'plaintext':
        result = html_to_plaintext(html)
    elif fmt == 'markdown':
        result = html_to_markdown(html)
    elif fmt == 'wechat':
        result = html_to_wechat(html)
    else:
        print(f'不支持的格式: {fmt}')
        sys.exit(1)
    
    output = os.path.splitext(sys.argv[1])[0] + f'.{fmt}'
    with open(output, 'w') as f:
        f.write(result)
    
    print(f'已转换: {sys.argv[1]} → {output}')

if __name__ == '__main__':
    main()