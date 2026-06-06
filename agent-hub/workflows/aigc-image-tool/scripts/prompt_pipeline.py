#!/usr/bin/env python3
"""
AI漫剧提示词流水线 v2.0
输入：一句话故事创意
输出：5个脚本 + 完整描述模板图prompt → 直接喂给免费视频API出10-15秒视频

流程：
  创意 → ①角色设定prompt → ②场景描述prompt → ③表情描述prompt 
  → ④动作行为prompt → ⑤分镜运镜prompt → ⑥融合成一张完整描述模板图
"""

import json
import os
import sys
from datetime import datetime

# ============================================================
# 词库
# ============================================================

CAMERA_ANGLES = {
    "远景": "wide shot, full environment visible, small figure in frame, establishing context",
    "中景": "medium shot, character from waist up, balanced composition, focus on interaction",
    "特写": "close-up, focus on face or specific detail, shallow depth of field, emotional intimacy",
    "大特写": "extreme close-up, single feature fills frame, highly detailed, intense focus",
    "过肩镜头": "over-the-shoulder shot, foreground shoulder blur, focus on subject's perspective",
    "俯拍": "high angle looking down, vulnerability, overview of scene",
    "仰拍": "low angle looking up, power dynamic, dramatic effect",
    "鸟瞰": "bird's eye view, top-down, abstract pattern, spatial relationships",
    "跟拍": "tracking shot, dynamic movement, following action"
}

CAMERA_MOVEMENTS = {
    "固定": "static locked-down shot, stable composition",
    "缓慢推进": "slow dolly in, gradual zoom in, intensifying focus and emotion",
    "缓慢拉远": "slow dolly out, zoom out, revealing context, sense of scale",
    "横移": "pan left or right, following character movement",
    "上摇": "tilt up, revealing height, scale, or verticality",
    "下摇": "tilt down, revealing ground, fall, or descent",
    "手持": "handheld shot, slight camera shake, documentary feel, urgency",
    "斯坦尼康": "steadicam, smooth flowing movement, following characters gracefully",
    "推拉变焦": "dolly zoom, vertigo effect, psychological tension"
}

TRANSITIONS = {
    "切": "hard cut, immediate transition, standard scene change",
    "淡入": "fade in from black, beginning of scene or new day",
    "淡出": "fade out to black, end of scene or passage into memory",
    "交叉溶解": "cross dissolve, smooth transition showing passage of time",
    "交叉叠化": "superimpose dissolve, dream sequence, flashback, memory overlap",
    "甩切": "whip pan cut, high energy, fast paced transition",
    "划入": "wipe transition, comic book style, energetic scene change"
}

VISUAL_STYLES = {
    "日式治愈动画": "anime style, cel shading, clean lines, warm vibrant colors, soft lighting, detailed backgrounds",
    "新海诚风": "Makoto Shinkai style, hyper-realistic lighting, lens flares, volumetric light rays, highly detailed skies and clouds, emotional atmosphere",
    "吉卜力风": "Studio Ghibli style, soft watercolor textures, warm earth tones, whimsical details, hand-drawn feel, lush backgrounds",
    "赛博朋克": "cyberpunk aesthetic, neon lights, dark rainy streets, holographic billboards, high contrast blue and purple tones",
    "水墨画风": "ink wash painting style, flowing brush strokes, minimalist, black ink on rice paper, poetic composition",
    "厚涂油画": "painterly oil painting style, rich texture, impasto strokes, dramatic lighting, classical composition",
    "美式漫画": "American comic style, bold outlines, high contrast shading, halftone dots, dynamic poses, speech bubbles",
    "像素复古": "pixel art, retro 8-bit/16-bit game aesthetic, limited color palette, blocky sprites, nostalgic feel"
}

# 10秒 / 30帧 / 约15个分镜面板
DEFAULT_PANEL_COUNT = 15

# ============================================================
# 核心工具函数 - 调用LLM生成
# ============================================================

def call_llm(system_prompt: str, user_input: str) -> str:
    """调用DeepSeek API生成内容 - 就绪后可替换为真实API调用"""
    import subprocess
    prompt = f"{system_prompt}\n\n用户输入: {user_input}\n\n请直接输出JSON，不要解释。"
    
    # 使用curl调用本地LLM
    cmd = [
        "curl", "-s", "http://localhost:11434/api/generate",
        "-H", "Content-Type: application/json",
        "-d", json.dumps({
            "model": "deepseek-r1:7b",
            "prompt": prompt,
            "stream": False
        }, ensure_ascii=False)
    ]
    
    # 或者用更简单的mock方式
    return f"[LLM would generate: {user_input[:50]}...]"


def debug_print(data: dict, label: str = ""):
    """调试输出"""
    print(f"\n{'='*50}")
    print(f"📋 {label}")
    print(f"  内容: {json.dumps(data, ensure_ascii=False, indent=2)[:200]}...")
    print(f"  大小: {len(json.dumps(data, ensure_ascii=False))} bytes")
    print(f"{'='*50}\n")


def save_json(data, path: str):
    """保存JSON文件"""
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    print(f"  ✅ {path} ({os.path.getsize(path)} bytes)")


# ============================================================
# 5阶段生成器
# ============================================================

def generate_characters(idea: str) -> list:
    """阶段1: 角色设定prompt"""
    print("\n【阶段1】角色设定prompt")
    
    system = f"""你是一个专业的动漫角色设计师。根据故事创意生成2-4个角色的完整设定。
每个角色必须包含：
1. identity markers（泪痣、疤痕、耳环等不可变特征——用于多帧一致）
2. 多视角参考（正面/侧面/3/4侧/头像/全身）
3. 8-10种表情（平静/开心/悲伤/愤怒/惊讶/恐惧/哭泣/大笑/戏谑/好奇）
4. 动作集（走路/跑步/坐/站/各自专属动作）
5. 配色方案（服装主色+辅色+点缀色）

输出格式必须是valid JSON数组，每项结构：
{{
  "name": "角色名",
  "role": "主角/女主角/配角等",
  "age": 数字,
  "gender": "男/女",
  "identity_markers": ["泪痣在右眼角", "左手腕有疤"],
  "appearance": {{"hair": "描述", "eyes": "描述", "face": "描述", "body": "描述"}},
  "costume": {{"main_outfit": "详细服装", "color_palette": ["主色", "辅色"]}},
  "multiview_references": {{"front": "正面描述", "side": "侧面描述", "portrait": "头像描述", "full_body": "全身描述"}},
  "expressions": {{"neutral": "平静表情描述", "happy": "开心表情描述", "sad": "悲伤表情描述", "angry": "...", "surprised": "...", "fear": "...", "crying": "...", "laughing": "..."}},
  "actions": {{"walking": "走路动作描述", "running": "...", "sitting": "...", "standing": "...", ...}},
  "personality": "性格描述",
  "backstory": "背景故事",
  "motivation": "动机",
  "dialogue_style": "对话风格"
}}

重要：identity_markers 必须精确到位置（如"泪痣在右眼角正下方3mm"），这是保持多帧一致的关键。"""

    user_prompt = f"""故事创意：{idea}
请生成主角和女主角两个角色的完整设定，如果故事需要可以增加1-2个关键配角。
每个角色必须包含identity markers、多视角参考、表情集、动作集。"""

    # 暂时用mock
    return mock_characters(idea)


def generate_scenes(characters: list, idea: str) -> list:
    """阶段2: 场景描述prompt"""
    print("\n【阶段2】场景描述prompt")
    
    system = f"""你是影视场景设计师。根据角色设定和故事创意，设计5-8个场景。
每个场景必须包含：地点、时间、天气、氛围、布光说明、色调方案、风格参考。

参考视觉风格：
{json.dumps(VISUAL_STYLES, ensure_ascii=False, indent=2)}

参考布光类型：自然光、逆光、侧光、顶光、霓虹光、烛光、黄昏光、晨光

输出JSON数组，每项：
{{
  "scene_number": 1,
  "location": "地点描述",
  "time": "时间",
  "weather": "天气",
  "atmosphere": "氛围描述",
  "visual_style": "风格名",
  "lighting": "布光描述",
  "color_palette": ["#HEX主色", "#HEX辅色", "#HEX点缀色"],
  "mood_keywords": ["关键词"],
  "camera_suggestions": "推荐镜头风格"
}}"""

    return mock_scenes(idea)


def generate_expressions(characters: list, scenes: list) -> list:
    """阶段3: 表情描述prompt"""
    print("\n【阶段3】表情描述prompt")
    
    expressions = []
    for char in characters:
        for expr_name, expr_desc in char.get("expressions", {}).items():
            if expr_desc:
                expressions.append({
                    "character": char["name"],
                    "expression_type": expr_name,
                    "visual_description": expr_desc,
                    "face_details": f"眉毛状态 + 眼睛形状 + 嘴部状态 + 肌肉紧张度",
                    "prompt_control_words": expr_name,
                    "when_to_use": f"当{char['name']}{ _get_emotion_scenario(expr_name) }时使用"
                })
    return expressions


def generate_actions(characters: list, scenes: list) -> list:
    """阶段4: 动作行为prompt"""
    print("\n【阶段4】动作行为prompt")
    
    actions = []
    for char in characters:
        for act_name, act_desc in char.get("actions", {}).items():
            if act_desc:
                actions.append({
                    "character": char["name"],
                    "action_type": act_name,
                    "visual_description": act_desc,
                    "body_language": "身体角度 + 手部位置 + 重心 + 头部朝向",
                    "pose_keywords": [act_desc.split("，")[0]] if "，" in act_desc else [act_desc],
                    "scene_context": "根据剧情走向确定使用场景"
                })
    return actions


def generate_storyboard(characters: list, scenes: list, expressions: list, actions: list, idea: str) -> list:
    """阶段5: 分镜运镜prompt — 融合输出"""
    print("\n【阶段5】分镜运镜prompt")
    
    storyboard = []
    scene_names = [s["location"] for s in scenes]
    
    # 分配分镜面板
    for i in range(min(15, len(scenes) * 3)):
        scene_idx = min(i // 3, len(scenes) - 1)
        scene = scenes[scene_idx]
        panel_in_scene = (i % 3) + 1
        
        # 选择一个角色
        char_idx = i % len(characters)
        char = characters[char_idx]
        
        # 选择表情和动作
        char_exprs = [e for e in expressions if e["character"] == char["name"]]
        char_acts = [a for a in actions if a["character"] == char["name"]]
        
        expr = char_exprs[i % max(len(char_exprs), 1)] if char_exprs else {"visual_description": "平静", "prompt_control_words": "neutral"}
        act = char_acts[i % max(len(char_acts), 1)] if char_acts else {"visual_description": "站立", "pose_keywords": ["standing"]}
        
        # 镜头参数
        angle_names = list(CAMERA_ANGLES.keys())
        move_names = list(CAMERA_MOVEMENTS.keys())
        trans_names = list(TRANSITIONS.keys())
        
        angle = angle_names[i % len(angle_names)]
        move = move_names[i % len(move_names)]
        trans = trans_names[i % len(trans_names)]
        
        # 构建完整prompt
        visual_prompt = (
            f"{VISUAL_STYLES.get(scene.get('visual_style', '日式治愈动画'), 'anime style, high quality, detailed')}, "
            f"{scene.get('atmosphere', '')}, "
            f"{scene.get('location', '')}, "
            f"{scene.get('lighting', 'natural lighting')}, "
            f"{char.get('appearance', {}).get('hair', '')}, {char.get('appearance', {}).get('eyes', '')}, "
            f"{char.get('appearance', {}).get('face', '')}, "
            f"{char.get('costume', {}).get('main_outfit', '')}, "
            f"{expr.get('visual_description', '')}, "
            f"{act.get('visual_description', '')}, "
            f"{CAMERA_ANGLES[angle]}, {CAMERA_MOVEMENTS[move]}, "
            f"best quality, ultra detailed, 8K, cinematic lighting, masterpiece"
        )
        
        negative = "low quality, blurry, distorted face, bad anatomy, extra limbs, ugly, deformed, watermark, text, signature, worst quality, normal quality, jpeg artifacts, signature, watermark, username, blurry"
        
        panel = {
            "panel_id": i + 1,
            "scene_number": scene_idx + 1,
            "location": scene.get("location", ""),
            "time": scene.get("time", ""),
            "atmosphere": scene.get("atmosphere", ""),
            "camera_angle": angle,
            "camera_movement": move,
            "transition": trans,
            "characters": [char["name"]],
            "character_appearance": {
                "identity_markers": char.get("identity_markers", []),
                "expression": expr.get("expression_type", "neutral"),
                "action": act.get("action_type", "standing"),
                "costume": char.get("costume", {}).get("main_outfit", ""),
                "color_palette": char.get("costume", {}).get("color_palette", [])
            },
            "composition": f"{char['name']}在画面{['中心', '左侧三分之一', '右侧三分之一', '黄金分割点'][i % 4]}，{['正对镜头', '侧身', '背对', '45度角'][i % 4]}",
            "visual_prompt": visual_prompt,
            "negative_prompt": negative,
            "seed_lock": f"seed_char_{char['name']}_{expr.get('expression_type', 'neutral')}"
        }
        
        storyboard.append(panel)
    
    return storyboard


# ============================================================
# 融合：生成ComfyUI可直接导入的模板图描述
# ============================================================

def generate_comfyui_template(storyboard: list, idea: str, output_dir: str):
    """将分镜融合成完整描述模板 → 供视频API使用"""
    print("\n【融合】生成完整描述模板")
    
    # 1. 单张面板prompt
    single_panel = storyboard[0].copy()
    
    # 2. 全剧序列（给视频API看整体节奏）
    sequence_summary = []
    for p in storyboard:
        sequence_summary.append({
            f"panel_{p['panel_id']:02d}": {
                "scene": p["scene_number"],
                "location": p["location"],
                "characters": ", ".join(p["characters"]),
                "expression": p["character_appearance"]["expression"],
                "action": p["character_appearance"]["action"],
                "camera": f"{p['camera_angle']} | {p['camera_movement']}",
                "transition": p["transition"],
                "prompt": p["visual_prompt"]
            }
        })
    
    # 3. 角色一致性参考表（关键：给视频API保持角色一致）
    character_refs = {}
    for p in storyboard:
        for char_name in p["characters"]:
            key = (p["panel_id"], char_name)
            character_refs[f"p{p['panel_id']:02d}_{char_name}"] = {
                "identity_markers": p["character_appearance"]["identity_markers"],
                "expression": p["character_appearance"]["expression"],
                "action": p["character_appearance"]["action"],
                "costume": p["character_appearance"]["costume"],
                "color_palette": p["character_appearance"]["color_palette"],
                "seed": p["seed_lock"]
            }
    
    # 4. 视频生成配置
    video_config = {
        "total_frames": len(storyboard),
        "total_seconds": 12,
        "fps": 8,
        "style_consistency": {
            "method": "locked_seed + ip_adapter_facet_id",
            "character_consistency": character_refs,
            "scene_consistency": f"全片保持{VISUAL_STYLES.get('日式治愈动画', 'consistent anime style')}",
            "color_grading": "全片暖色调，咖啡馆场景保持木色+暖黄，医院场景保持白色+晨光"
        },
        "audio_staging": {
            "bgm_style": "治愈系轻音乐，钢琴+弦乐",
            "sound_effects": ["咖啡机声", "门铃声", "脚步声", "翻书声", "心跳声"]
        }
    }
    
    template = {
        "project": f"AI漫剧: {idea[:30]}",
        "generated_at": datetime.now().isoformat(),
        "pipeline_version": "2.0",
        "method": "prompt_to_video_via_api",
        "usage": "将以下内容复制到免费视频API（Wan2.6/Kling/Runway），直接出10-15秒视频",
        
        "total_panels": len(storyboard),
        
        "step_1_character_scripts": "见01_characters_output.json",
        "step_2_scene_scripts": "见02_scenes_output.json",
        "step_3_expression_scripts": "见03_expressions_output.json",
        "step_4_action_scripts": "见04_actions_output.json",
        "step_5_storyboard_scripts": "见05_storyboard_output.json",
        
        "comfyui_direct_import": {
            "prompts_for_comfyui": [p["visual_prompt"] for p in storyboard],
            "negative_prompts": [p["negative_prompt"] for p in storyboard],
            "seed_locks": list(set(p["seed_lock"] for p in storyboard)),
            "camera_list": [{"angle": p["camera_angle"], "movement": p["camera_movement"]} for p in storyboard],
            "transitions": [p["transition"] for p in storyboard]
        },
        
        # 这个是给视频API看的关键——一张图的完整描述
        "full_scene_description_for_video_api": f"""
一句话创意: {idea}

角色设定:
{_format_characters_for_prompt(storyboard, character_refs)}

分镜序列({len(storyboard)}个面板):
{_format_storyboard_sequence(storyboard)}

【视频生成指示】
模型: 任意视频生成模型
输入方式: 纯文本描述（无需参考图）
风格: 日式治愈动画，温暖色调
镜头语言: 交替使用远景/中景/特写营造节奏感
角色一致: 每帧锁定seed，关键帧用IP-Adapter守护features
时长: 10-15秒
转场: 缓慢溶解连接，营造梦核感
""",
        
        "video_generation_config": video_config
    }
    
    save_json(template, os.path.join(output_dir, "comfyui_template.json"))
    # 保存纯文本版本给视频API直接使用
    text_prompt = template["full_scene_description_for_video_api"]
    txt_path = os.path.join(output_dir, "video_api_prompt.txt")
    with open(txt_path, "w", encoding="utf-8") as f:
        f.write(text_prompt)
    print(f"  ✅ {txt_path} ({os.path.getsize(txt_path)} bytes)")
    
    print(f"\n{'='*50}")
    print(f"  ✅ 融合完成！直接给视频API用的prompt已生成")
    print(f"  📂 输出目录: {output_dir}")
    print(f"  📊 总面板: {len(storyboard)}")
    print(f"  ⏱  预计视频: 10-15秒")
    print(f"{'='*50}")
    
    return template


# ============================================================
# 辅助函数
# ============================================================

def _get_emotion_scenario(expr_type: str) -> str:
    scenarios = {
        "neutral": "处于平静状态",
        "happy": "感到开心或温暖",
        "sad": "感到悲伤或失落",
        "angry": "感到愤怒或不满",
        "surprised": "感到惊讶或震惊",
        "fear": "感到恐惧或不安",
        "crying": "哭泣或极度悲伤",
        "laughing": "大笑或极度开心",
        "smirk": "戏谑或得意",
        "curious": "感到好奇或感兴趣",
        "worried": "担忧或焦虑",
        "serious": "严肃或专注",
        "warm": "温暖或感动"
    }
    return scenarios.get(expr_type, f"表达{expr_type}情感")


def _format_characters_for_prompt(storyboard, character_refs) -> str:
    """格式化角色信息给prompt使用"""
    seen = set()
    lines = []
    for p in storyboard:
        for char_name in p["characters"]:
            if char_name not in seen:
                seen.add(char_name)
                ref = None
                for k, v in character_refs.items():
                    if char_name in k:
                        ref = v
                        break
                if ref:
                    lines.append(f"- {char_name}: identity_markers={json.dumps(ref.get('identity_markers', []), ensure_ascii=False)}, costume={ref.get('costume', '')}")
    return "\n".join(lines)


def _format_storyboard_sequence(storyboard) -> str:
    """格式化分镜序列"""
    lines = []
    for p in storyboard:
        lines.append(f"  面板{p['panel_id']:02d}: {p['camera_angle']} | {p['camera_movement']} → {p['transition']}")
        lines.append(f"    角色: {', '.join(p['characters'])}")
        lines.append(f"    动作: {p['character_appearance']['action']} | 表情: {p['character_appearance']['expression']}")
        lines.append(f"    场景: {p['location']} ({p['time']})")
        lines.append(f"    Prompt: {p['visual_prompt'][:100]}...")
        lines.append("")
    return "\n".join(lines)


# ============================================================
# Mock 生成器（替换为真实LLM调用）
# ============================================================

def mock_characters(idea: str) -> list:
    """根据创意生成mock角色数据"""
    # 解析创意关键词
    idea_lower = idea.lower()
    
    # 默认两个角色
    chars = [
        {
            "name": "林星",
            "role": "男主角",
            "age": 26,
            "gender": "男",
            "identity_markers": ["右眼角正下方3mm处有一颗小泪痣", "左手腕有咖啡烫伤旧疤呈淡褐色椭圆形"],
            "appearance": {
                "hair": "深棕色微卷碎发，长度及眉，刘海自然分开",
                "eyes": "琥珀色内双细长眼，虹膜有金色光点",
                "face": "暖白皮瓜子脸，下颌线清晰，鼻梁挺拔",
                "body": "身高178cm，匀称偏瘦，手指修长"
            },
            "costume": {
                "main_outfit": "白色棉质衬衫，袖子卷到小臂，深棕色帆布围裙，黑色修身长裤，棕色帆布鞋",
                "color_palette": ["暖白#FFF8F0", "咖啡棕#6B4226", "琥珀金#C8956E", "深灰#4A4A4A"]
            },
            "multiview_references": {
                "front": "正面站立，右手端白色咖啡杯，温和微笑，泪痣清晰可见",
                "side": "右侧45度，低头专注调制手冲咖啡，阳光照在侧脸",
                "three_quarter": "左3/4侧，转头望向窗外，手搭在吧台上",
                "portrait": "头像特写，琥珀色眼睛直视前方，泪痣在右眼角正下方，表情温和",
                "full_body": "全身站立在咖啡吧台后，白衬衫围裙黑裤，手持咖啡壶"
            },
            "expressions": {
                "neutral": "温和微笑，眼神柔和放松，嘴角自然上扬",
                "happy": "眼睛弯成月牙形，嘴角上扬露出虎牙，眼角有笑纹",
                "sad": "微微低头，睫毛下垂盖住半个瞳孔，嘴角勉强维持但颤抖",
                "angry": "眉头紧皱形成川字纹，眼神锐利，嘴唇紧抿成一条线",
                "surprised": "瞳孔明显放大，嘴唇微张，身体微微后倾",
                "fear": "脸色苍白，瞳孔收缩成针尖，嘴唇微微颤抖，呼吸急促",
                "crying": "眼眶蓄满泪水，泪珠顺着泪痣滑落，鼻尖和眼眶泛红",
                "laughing": "仰头大笑，眼睛闭起，眼镜笑歪了也顾不上扶"
            },
            "actions": {
                "walking": "步伐从容稳定，右手习惯性推一下眼镜",
                "running": "身体前倾，左手按住围裙口袋防止物品掉落",
                "sitting": "坐在吧台高脚凳上时习惯性跷二郎腿，单手托腮",
                "standing": "笔直站立双手交叉放在身前，服务员标准站姿",
                "pouring_coffee": "右手稳握咖啡壶手柄，左手轻扶壶底，手腕匀速倾斜，水流细而稳",
                "gesturing": "说话时喜欢用手比划，手掌向上开展，手指修长动作优雅"
            },
            "personality": "外表温和内敛，内心敏感细腻。表面随和但其实很有主见。有轻微强迫症，咖啡杯必须摆成一条直线",
            "backstory": "从小就能看见别人的命运线，开咖啡馆用咖啡和倾听帮客人改变命运",
            "motivation": "探索自己命运线消失的原因",
            "dialogue_style": "温和沉稳，语速适中，喜欢在句尾加'吧'字，显得商量语气"
        },
        {
            "name": "苏晚晴",
            "role": "女主角",
            "age": 24,
            "gender": "女",
            "identity_markers": ["左耳垂有三个银色小耳环等距排列", "右手小指戴着一枚素面银戒"],
            "appearance": {
                "hair": "墨黑色及腰直发，发质柔顺有光泽，自然垂落",
                "eyes": "圆润杏眼，深褐色虹膜，睫毛浓密纤长",
                "face": "冷白皮鹅蛋脸，饱满额头，小巧鼻子，唇形优美",
                "body": "身高163cm，纤细体态，锁骨明显"
            },
            "costume": {
                "main_outfit": "米白色宽松针织开衫，内搭浅蓝色碎花连衣裙，棕色短靴，背着帆布托特包",
                "color_palette": ["米白#F5F0E8", "浅蓝#B4D4E8", "暖棕#8B6914", "碎花多色"]
            },
            "multiview_references": {
                "front": "正面站立，双手抱着书本，微笑中带着安静观察",
                "side": "侧面坐在咖啡馆窗边看书，阳光透过玻璃照在墨黑长发上",
                "three_quarter": "3/4侧转身回头，长发随风飘起，眼神明亮有光",
                "portrait": "头像特写，大眼带着温柔的好奇心，左耳三个银耳环在光下闪烁",
                "full_body": "全身站在咖啡店门口，阳光从背后照来形成漂亮逆光"
            },
            "expressions": {
                "neutral": "安静恬淡，眼神带着观察和思考，嘴角微微放松",
                "happy": "眼睛瞬间被点亮，笑容灿烂如花，整个人散发着温暖",
                "sad": "低头咬住下嘴唇，眼眶泛红但倔强地不让眼泪掉下来",
                "surprised": "瞪大圆润的眼睛，瞳孔放大，嘴巴微微张开",
                "angry": "眉头紧锁成结，眼神倔强坚定，嘴角紧紧抿住",
                "curious": "微微歪头，眼睛眯起一半，带着探究的神情",
                "worried": "咬着下唇，手指紧张地绞在一起，眼神游移",
                "fear": "脸色瞬间苍白，瞳孔收缩，身体微微后退"
            },
            "actions": {
                "walking": "步伐轻快有弹性，喜欢一蹦一跳地走，裙摆随之飘动",
                "sitting": "喜欢窝在咖啡馆靠窗的沙发角落，把腿蜷缩在椅子上",
                "reading": "微微低头看书，时不时用手指撩一下垂落的发丝别到耳后",
                "drinking": "双手十指环绕捧住咖啡杯，小口慢慢啜饮，然后满足地眯起眼睛",
                "typing": "坐在笔记本前双手快速敲击键盘，全神贯注",
                "listening": "安静地听对方说话时头微微倾斜，眼神专注认真"
            },
            "personality": "外表温柔安静，内心倔强勇敢。表面文艺女青年，实际是编程高手",
            "backstory": "计算机专业毕业全栈开发，被诊断罕见心脏病只剩半年生命",
            "motivation": "在生命结束前完成自己的AI幸福程序",
            "dialogue_style": "温柔但坚定，偶尔蹦出技术术语，说话前喜欢思考3秒"
        }
    ]
    
    # 检查创意是否有特殊角色需求
    if any(kw in idea_lower for kw in ["神秘", "反派", "使者", "老人"]):
        chars.append({
            "name": "神秘客人",
            "role": "关键配角/命运使者",
            "age": 35,
            "gender": "男",
            "identity_markers": ["总是随身携带一把黑色长柄伞", "左手无名指有一圈淡金色印记"],
            "appearance": {
                "hair": "银灰色整齐后梳短发，长度及颈",
                "eyes": "深邃灰蓝色丹凤眼，眼神锐利有穿透力",
                "face": "棱角分明方形脸，苍白肤色，薄唇",
                "body": "身高185cm，修长挺拔，肩宽腰窄"
            },
            "costume": {
                "main_outfit": "黑色长风衣，内搭深灰三件套西装，雪白衬衫，黑色皮鞋",
                "color_palette": ["黑#0A0A0A", "深灰#3A3A3A", "银#C0C0C0"]
            },
            "expressions": {
                "neutral": "面无表情，眼神深邃如深渊",
                "amused": "嘴角极轻微上扬不到1mm，眼里有让人看不透的笑意",
                "serious": "目光如刀，周身三米内温度骤降",
                "warm": "极罕见，但真正笑的时候如冬雪初融般温暖"
            },
            "personality": "神秘莫测话中有话，看似冷漠实则在暗中观察和引导",
            "backstory": "命运线的管理者，给林星最后选择的人",
            "motivation": "测试人性，看林星会做出什么选择",
            "dialogue_style": "低沉平静，说话语速极慢，每句话后停顿三秒"
        })
    
    return chars


def mock_scenes(idea: str) -> list:
    """生成mock场景数据"""
    return [
        {
            "scene_number": 1,
            "location": "『星尘』咖啡馆室内",
            "time": "午后阳光最好时",
            "weather": "晴朗，阳光透过落地玻璃窗洒进来",
            "atmosphere": "温暖治愈，空气中弥漫着咖啡豆和奶泡的香气，有轻柔的爵士乐背景",
            "visual_style": "日式治愈动画",
            "lighting": "自然暖光为主，从西侧落地窗射入形成美丽的光束，空气中可见漂浮的咖啡粉尘",
            "color_palette": ["#FFF8F0", "#6B4226", "#C8956E", "#D4A574"],
            "mood_keywords": ["温暖", "治愈", "宁静", "时光缓慢"],
            "camera_suggestions": "多用固定镜头和浅景深，突出角色的孤独感和温暖环境的对比"
        },
        {
            "scene_number": 2,
            "location": "咖啡馆靠窗座位",
            "time": "午后",
            "weather": "晴朗",
            "atmosphere": "轻松中带着一丝微妙的紧张感，初次相遇的微妙氛围",
            "visual_style": "日式治愈动画",
            "lighting": "逆光，从窗边拍摄剪影效果，角色轮廓被阳光勾勒出金边",
            "color_palette": ["#FFF8F0", "#B4D4E8", "#8B6914"],
            "mood_keywords": ["相遇", "微妙", "光影", "视线交汇"],
            "camera_suggestions": "过肩镜头交替拍摄，突出两人视线交汇的瞬间"
        },
        {
            "scene_number": 3,
            "location": "咖啡馆吧台",
            "time": "黄昏暮色时分",
            "weather": "多云，金色余晖透过云层",
            "atmosphere": "温柔中带着即将别离的感伤，最后的谈判时刻",
            "visual_style": "新海诚风",
            "lighting": "金色黄昏光从西侧射入，形成强烈的冷暖对比——暖色照人冷色照影",
            "color_palette": ["#E8924A", "#4A90D9", "#1A1A2E", "#FFD700"],
            "mood_keywords": ["选择", "牺牲", "黄昏", "命运转折"],
            "camera_suggestions": "多用特写捕捉面部微表情，缓慢推进增加紧张感"
        },
        {
            "scene_number": 4,
            "location": "医院病房",
            "time": "清晨第一缕阳光",
            "weather": "晴朗，窗外有樱花树枝",
            "atmosphere": "安静圣洁，充满新生的希望，一切都重新开始",
            "visual_style": "吉卜力风",
            "lighting": "柔和的晨光从窗户均匀地洒入，白色窗帘微动，整体色调偏白偏柔",
            "color_palette": ["#FFFFFF", "#FFF5EE", "#FFB7C5", "#90EE90"],
            "mood_keywords": ["新生", "希望", "干净", "白色"],
            "camera_suggestions": "中景平拍，构图对称，给人安稳感"
        },
        {
            "scene_number": 5,
            "location": "新咖啡馆『初星』门口到室内",
            "time": "午后",
            "weather": "晴空万里",
            "atmosphere": "命运的轮回感，熟悉又陌生的气息，一切重新开始",
            "visual_style": "新海诚风",
            "lighting": "强烈阳光从门口照入形成光柱，室内暖黄灯光与外面对比",
            "color_palette": ["#FFF8F0", "#6B4226", "#FFD700", "#FFF5EE"],
            "mood_keywords": ["重逢", "轮回", "咖啡香", "似曾相识"],
            "camera_suggestions": "从室外远景缓慢推进到室内过肩镜头，最后落在两人对视的中景"
        }
    ]


# ============================================================
# 主流程
# ============================================================

def run_pipeline(idea: str, output_dir: str = None):
    """运行完整的提示词流水线"""
    
    if output_dir is None:
        output_dir = os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
            "output",
            datetime.now().strftime("%Y%m%d_%H%M%S")
        )
    
    print("\n" + "="*60)
    print("  AI漫剧提示词流水线 v2.0")
    print(f"  创意: {idea}")
    print("="*60)
    
    # 阶段1-5
    characters = generate_characters(idea)
    save_json(characters, os.path.join(output_dir, "01_characters_output.json"))
    
    scenes = generate_scenes(characters, idea)
    save_json(scenes, os.path.join(output_dir, "02_scenes_output.json"))
    
    expressions = generate_expressions(characters, scenes)
    save_json(expressions, os.path.join(output_dir, "03_expressions_output.json"))
    
    actions = generate_actions(characters, scenes)
    save_json(actions, os.path.join(output_dir, "04_actions_output.json"))
    
    storyboard = generate_storyboard(characters, scenes, expressions, actions, idea)
    save_json(storyboard, os.path.join(output_dir, "05_storyboard_output.json"))
    
    # 融合：生成完整模板
    template = generate_comfyui_template(storyboard, idea, output_dir)
    
    # 打印核心输出（给视频API的文本）
    print("\n📋 核心输出 — 直接给视频API的描述：")
    print("-" * 50)
    print(template["full_scene_description_for_video_api"])
    print("-" * 50)
    print(f"\n📂 完整输出目录: {output_dir}")
    print("  01_characters_output.json — 角色设定")
    print("  02_scenes_output.json    — 场景描述")
    print("  03_expressions_output.json — 表情描述")
    print("  04_actions_output.json   — 动作行为")
    print("  05_storyboard_output.json — 分镜运镜")
    print("  comfyui_template.json    — 融合模板（全量数据）")
    print("  video_api_prompt.txt     — 直接给视频API的纯文本prompt")
    
    return template


if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1:
        idea = " ".join(sys.argv[1:])
    else:
        print("AI漫剧提示词流水线 v2.0")
        print("="*40)
        print("示例: 一位能看见别人命运线的咖啡师")
        print("")
        idea = input("请输入故事创意: ").strip()
        if not idea:
            idea = "一位能看见别人命运线的咖啡师，在帮助客人改变命运的过程中，发现自己的命运线正在消失"
    
    run_pipeline(idea)
