#!/usr/bin/env python3
"""
toonflow-to-video.py — Toonflow ↔ html-video 打通脚本

读取 Toonflow 的 JSON 分镜表，转换为 html-video content-graph 格式
"""

import json
import os
import sys
import subprocess
import tempfile

def toonflow_to_content_graph(toonflow_json):
    """
    转换 Toonflow 分镜 JSON → html-video content-graph
    
    Toonflow 分镜格式预期:
    {
        "scenes": [
            {
                "scene_id": 1,
                "title": "场景1",
                "description": "场景描述",
                "characters": ["角色A", "角色B"],
                "background": "背景描述",
                "dialogue": "对话内容",
                "duration": 5  # 秒
            }
        ]
    }
    """
    if isinstance(toonflow_json, str):
        data = json.loads(toonflow_json)
    else:
        data = toonflow_json
    
    scenes = data.get('scenes', data.get('storyboard', data.get('frames', [])))
    
    content_graph = {
        "version": "1.0",
        "project": data.get('title', '小说改编视频'),
        "frames": []
    }
    
    for i, scene in enumerate(scenes):
        frame = {
            "id": f"frame-{i+1:04d}",
            "title": scene.get('title', f'场景 {i+1}'),
            "template": "novel-storyboard",
            "duration": scene.get('duration', 5),
            "variables": {
                "scene_number": str(i + 1),
                "background": scene.get('background', ''),
                "characters": ', '.join(scene.get('characters', [])),
                "dialogue": scene.get('dialogue', ''),
                "description": scene.get('description', ''),
                "narration": scene.get('narration', ''),
                "mood": scene.get('mood', 'neutral'),
                "transition": scene.get('transition', 'fade')
            }
        }
        content_graph["frames"].append(frame)
    
    return content_graph

def render_video(content_graph, output_path='output.mp4'):
    """调用 html-video CLI 渲染视频"""
    
    # 写入临时 content-graph 文件
    tmp = tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False)
    json.dump(content_graph, tmp, ensure_ascii=False, indent=2)
    tmp_path = tmp.name
    tmp.close()
    
    try:
        # 调用 html-video CLI
        cmd = [
            'html-video', 'render',
            '--project', tmp_path,
            '--output', output_path
        ]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
        
        if result.returncode == 0:
            print(f'✅ 视频已生成: {output_path}')
            return True
        else:
            print(f'❌ 渲染失败: {result.stderr}')
            return False
    except FileNotFoundError:
        print('⚠️ html-video CLI 未找到，生成 content-graph JSON 文件代替')
        graph_path = output_path.replace('.mp4', '.json')
        with open(graph_path, 'w') as f:
            json.dump(content_graph, f, ensure_ascii=False, indent=2)
        print(f'✅ content-graph 已保存: {graph_path}')
        return True
    finally:
        os.unlink(tmp_path)

def main():
    if len(sys.argv) < 2:
        print('用法: python3 toonflow-to-video.py <toonflow.json> [output.mp4]')
        sys.exit(1)
    
    with open(sys.argv[1]) as f:
        toonflow_data = json.load(f)
    
    output = sys.argv[2] if len(sys.argv) > 2 else 'novel-video.mp4'
    
    graph = toonflow_to_content_graph(toonflow_data)
    render_video(graph, output)

if __name__ == '__main__':
    main()