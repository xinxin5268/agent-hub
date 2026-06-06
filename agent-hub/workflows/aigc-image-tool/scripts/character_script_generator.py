#!/usr/bin/env python3
"""
AIGC 剧情人物设定脚本生成器
输入：故事创意一句话
输出：完整的角色卡 + 剧情分镜脚本
"""

import json, os, sys
from datetime import datetime

class CharacterScriptGenerator:
    def __init__(self):
        self.story = ""
        self.characters = []
        self.scenes = []
        
    def generate_from_idea(self, idea: str) -> dict:
        """从一句话创意生成完整设定"""
        self.story = idea
        
        # 解析创意，生成角色和场景
        result = {
            "meta": {
                "title": "",
                "genre": "",
                "theme": "",
                "created_at": datetime.now().isoformat(),
                "version": "1.0"
            },
            "characters": self._generate_characters(idea),
            "story_structure": self._generate_story_structure(idea),
            "scenes": self._generate_scenes(idea),
            "visual_guide": self._generate_visual_guide()
        }
        
        return result
    
    def _generate_characters(self, idea: str) -> list:
        """生成角色设定"""
        # 这里在实际使用时会调用 LLM
        # 目前返回模板结构
        return [
            {
                "name": "",
                "role": "主角/配角/反派",
                "age": 0,
                "gender": "",
                "height": "160-180cm",
                "weight": "50-70kg",
                "body_type": "纤细/匀称/健壮/丰满",
                
                # 外貌特征（不可变）
                "appearance": {
                    "hair": {"style": "", "color": "", "length": ""},
                    "eyes": {"shape": "", "color": ""},
                    "face": {"shape": "瓜子脸/圆脸/方脸", "skin_tone": ""},
                    "distinctive_features": [],  # 标志性特征（泪痣/疤痕/纹身等）
                },
                
                # 服装（可变）
                "costume": {
                    "main_outfit": "",
                    "accessories": [],
                    "color_palette": [],
                },
                
                # 多视角参考图描述
                "multi_view_references": {
                    "front": "",      # 正面全身
                    "side": "",       # 侧面
                    "three_quarter": "", # 3/4侧
                    "back": "",       # 背面
                    "portrait": "",   # 头像特写
                    "full_body": "",  # 全身
                },
                
                # 表情集
                "expressions": {
                    "neutral": "",
                    "happy": "",
                    "sad": "",
                    "angry": "",
                    "surprised": "",
                    "fear": "",
                    "disgust": "",
                    "smirk": "",
                    "crying": "",
                    "laughing": "",
                },
                
                # 动作集
                "actions": {
                    "walking": "",
                    "running": "",
                    "sitting": "",
                    "standing": "",
                    "fighting": "",
                    "gesturing": "",
                },
                
                # 角色背景
                "background": {
                    "personality": "",
                    "backstory": "",
                    "motivation": "",
                    "skills": [],
                    "weaknesses": [],
                },
                
                # 关系网
                "relationships": {},
                
                # 对白风格
                "dialogue_style": {
                    "tone": "",      # 语气（温柔/暴躁/冷静）
                    "catchphrases": [],  # 口头禅
                    "speech_pattern": "", # 说话方式
                },
                
                # 角色弧光（成长变化）
                "character_arc": {
                    "start": "",
                    "mid": "",
                    "end": "",
                }
            }
        ]
    
    def _generate_story_structure(self, idea: str) -> dict:
        """生成故事结构"""
        return {
            "logline": idea,
            "three_act_structure": {
                "act_1_setup": {
                    "summary": "",
                    "key_events": [],
                    "character_introductions": []
                },
                "act_2_confrontation": {
                    "summary": "",
                    "key_events": [],
                    "turning_point": ""
                },
                "act_3_resolution": {
                    "summary": "",
                    "key_events": [],
                    "climax": ""
                }
            },
            "themes": [],
            "target_audience": ""
        }
    
    def _generate_scenes(self, idea: str) -> list:
        """生成分镜场景"""
        return [
            {
                "scene_number": 1,
                "location": "",
                "time": "日/夜/黄昏/黎明",
                "weather": "",
                "atmosphere": "",
                
                # 分镜面板
                "panels": [
                    {
                        "panel_number": 1,
                        "camera_angle": "远景/中景/特写/过肩/俯拍/仰拍",
                        "camera_movement": "固定/推/拉/摇/移/跟",
                        "characters_in_frame": [],
                        "character_positions": {},
                        "action": "",
                        "dialogue": "",
                        "expression_notes": "",
                        "composition_notes": "",
                        
                        # 视觉描述（用于生图prompt）
                        "visual_prompt": "",
                        "negative_prompt": "",
                        
                        # 多人物交互
                        "interaction": {
                            "type": "对话/打斗/追逐/拥抱等",
                            "spatial_relationship": "面对面/背对背/并排等"
                        }
                    }
                ],
                
                # 场景过渡
                "transition": "切/淡入淡出/划像/溶解"
            }
        ]
    
    def _generate_visual_guide(self) -> dict:
        """生成视觉风格指南"""
        return {
            "art_style": "日式动漫/美式漫画/写实/水墨/赛璐璐",
            "color_palette": {
                "primary": [],
                "secondary": [],
                "accent": [],
                "mood_colors": {}
            },
            "lighting": "自然光/戏剧光/逆光/侧光",
            "line_art": "粗线/细线/无线",
            "rendering": "平涂/厚涂/赛璐璐",
            "reference_artists": [],
            "consistency_rules": [
                "同一场景内角色服装不变",
                "同一角色在不同场景保持发型和发色一致",
                "表情变化时五官比例保持不变",
                "动作连续时注意肢体位置连贯性"
            ]
        }


def generate_sample_character_card(char: dict) -> str:
    """生成可读的角色卡文本"""
    lines = []
    lines.append("=" * 50)
    lines.append(f"【角色卡】{char['name']}")
    lines.append("=" * 50)
    lines.append(f"  📋 基础信息")
    lines.append(f"     角色定位: {char['role']}")
    lines.append(f"     年龄: {char['age']}岁")
    lines.append(f"     身高: {char['height']}")
    lines.append(f"     体型: {char['body_type']}")
    lines.append("")
    lines.append(f"  👤 外貌特征 (identity-markers - 不可变)")
    lines.append(f"     发型: {char['appearance']['hair']['style']} ({char['appearance']['hair']['color']})")
    lines.append(f"     眼睛: {char['appearance']['eyes']['shape']} ({char['appearance']['eyes']['color']})")
    lines.append(f"     脸型: {char['appearance']['face']['shape']}")
    lines.append(f"     肤色: {char['appearance']['face']['skin_tone']}")
    if char['appearance']['distinctive_features']:
        lines.append(f"     标志特征: {', '.join(char['appearance']['distinctive_features'])}")
    lines.append("")
    lines.append(f"  👗 服装设定")
    lines.append(f"     主服装: {char['costume']['main_outfit']}")
    lines.append(f"     配色: {', '.join(char['costume']['color_palette'])}")
    lines.append("")
    lines.append(f"  😊 表情集")
    for expr, desc in char['expressions'].items():
        if desc:
            lines.append(f"     {expr}: {desc}")
    lines.append("")
    lines.append(f"  🏃 动作集")
    for act, desc in char['actions'].items():
        if desc:
            lines.append(f"     {act}: {desc}")
    lines.append("")
    lines.append(f"  📖 背景故事")
    lines.append(f"     性格: {char['background']['personality']}")
    lines.append(f"     背景: {char['background']['backstory'][:100]}...")
    lines.append(f"     动机: {char['background']['motivation']}")
    lines.append("")
    lines.append(f"  🎭 角色弧光")
    lines.append(f"     起点: {char['character_arc']['start']}")
    lines.append(f"     终点: {char['character_arc']['end']}")
    lines.append("=" * 50)
    return "\n".join(lines)


def generate_sample_storyboard(scenes: list) -> str:
    """生成分镜脚本文本"""
    lines = []
    lines.append("=" * 60)
    lines.append("【分镜脚本】")
    lines.append("=" * 60)
    
    for scene in scenes:
        lines.append(f"\n{'─' * 60}")
        lines.append(f"【场景 {scene['scene_number']}】{scene['location']} | {scene['time']} | {scene['atmosphere']}")
        lines.append(f"{'─' * 60}")
        
        for panel in scene['panels']:
            lines.append(f"\n  Panel {panel['panel_number']} | {panel['camera_angle']} | {panel['camera_movement']}")
            lines.append(f"  人物: {', '.join(panel['characters_in_frame'])}")
            if panel['dialogue']:
                lines.append(f"  对白: \"{panel['dialogue']}\"")
            lines.append(f"  动作: {panel['action']}")
            lines.append(f"  表情: {panel['expression_notes']}")
            lines.append(f"  → {panel['visual_prompt'][:80]}...")
        
        lines.append(f"\n  转场: {scene['transition']}")
    
    return "\n".join(lines)


if __name__ == "__main__":
    # 示例用法
    gen = CharacterScriptGenerator()
    
    idea = "一位能看见别人命运线的咖啡师，在帮助客人改变命运的过程中，发现自己的命运线正在消失"
    
    result = gen.generate_from_idea(idea)
    
    print(json.dumps(result, indent=2, ensure_ascii=False))

