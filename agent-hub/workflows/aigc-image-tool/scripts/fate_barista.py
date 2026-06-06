#!/usr/bin/env python3
"""
AIGC 剧情人物设定脚本 — 完整示例
故事: 《命运咖啡师》
"""

import json

story = {
    "meta": {
        "title": "命运咖啡师",
        "genre": "奇幻 / 都市 / 温情",
        "theme": "选择与命运、自我牺牲、人与人之间的羁绊",
        "logline": "一位能看见别人命运线的咖啡师，在帮助客人改变命运的过程中，发现自己的命运线正在消失",
        "target_audience": "18-35岁，喜欢温情奇幻故事的年轻人",
        "created_at": "2026-06-04",
        "version": "1.0"
    },
    
    "characters": [
        {
            "name": "林星",
            "role": "主角",
            "age": 26,
            "gender": "男",
            "height": "178cm",
            "weight": "68kg",
            "body_type": "匀称偏瘦",
            
            "appearance": {
                "hair": {"style": "微卷碎发", "color": "深棕色", "length": "及眉"},
                "eyes": {"shape": "内双细长眼", "color": "琥珀色"},
                "face": {"shape": "瓜子脸", "skin_tone": "暖白皮"},
                "distinctive_features": ["右眼角下有颗小泪痣", "左手腕有咖啡烫伤旧疤"]
            },
            
            "costume": {
                "main_outfit": "白色衬衫 + 深棕色围裙 + 黑色长裤 + 帆布鞋",
                "accessories": ["银框圆眼镜", "皮质腕表"],
                "color_palette": ["暖白", "咖啡棕", "深灰"]
            },
            
            "multi_view_references": {
                "front": "正面站立，右手端咖啡杯，微笑",
                "side": "右侧45度，低头调咖啡，专注",
                "three_quarter": "左3/4侧，转头看向窗外",
                "back": "背面，系围裙带子",
                "portrait": "头像特写，琥珀色眼睛直视镜头，泪痣清晰可见",
                "full_body": "全身，站立在咖啡吧台后"
            },
            
            "expressions": {
                "neutral": "温和微笑，眼神柔和",
                "happy": "眼睛弯成月牙，嘴角上扬露出虎牙",
                "sad": "微微低头，睫毛垂下来，嘴角勉强牵动",
                "angry": "眉头紧皱，眼神锐利，嘴唇紧抿",
                "surprised": "瞳孔放大，微微张嘴，身体后倾",
                "fear": "脸色苍白，瞳孔收缩，嘴唇微颤",
                "smirk": "单侧嘴角上扬，眼神带点狡黠",
                "crying": "眼泪顺着泪痣滑落，鼻尖发红",
                "laughing": "仰头大笑，眼镜歪了也不在意"
            },
            
            "actions": {
                "walking": "步伐从容，右手习惯性推眼镜",
                "running": "身体前倾，左手按着围裙口袋跑",
                "sitting": "靠在吧台边，单手托腮",
                "standing": "笔直站立，双手交叉放在身前",
                "pouring_coffee": "右手提壶，左手扶杯，手腕稳定缓慢倾斜",
                "gesturing": "说话时喜欢用手比划，手指修长"
            },
            
            "background": {
                "personality": "外表温和内敛，内心敏感细腻。表面随和但其实很有主见。有轻微的强迫症，咖啡杯必须摆成一条直线。",
                "backstory": "从小就能看见别人身上的命运线——一条从心口延伸出的发光丝线。命运线断裂代表灾难，缠绕代表纠葛，暗淡代表生命流逝。他开了一家小咖啡馆，用咖啡和倾听帮助客人改变命运。但每次改变他人命运，自己的命运线就会缩短一截。",
                "motivation": "想知道自己的命运线为什么会消失，以及消失之后会发生什么",
                "skills": ["顶级咖啡师", "命运线解读", "倾听与开导"],
                "weaknesses": ["过度共情", "不擅长拒绝", "对自己命运过于悲观"]
            },
            
            "relationships": {
                "苏晚晴": "常客，后来成为最重要的朋友",
                "陈叔": "隔壁书店老板，知情人",
                "神秘客人": "每周三下午三点准时出现的黑伞客人"
            },
            
            "dialogue_style": {
                "tone": "温和沉稳，语速适中",
                "catchphrases": ["你的咖啡好了", "命运这种东西……其实是可以改的", "小心烫"],
                "speech_pattern": "喜欢在句尾加'吧'字，显得商量语气"
            },
            
            "character_arc": {
                "start": "被动接受命运，只是默默观察客人的命运线",
                "mid": "开始主动干预，牺牲自己的命运线长度去帮助别人",
                "end": "接受命运线的消失，发现真正的命运不是线而是与他人的连接"
            }
        },
        
        {
            "name": "苏晚晴",
            "role": "女主角 / 关键人物",
            "age": 24,
            "gender": "女",
            "height": "163cm",
            "weight": "50kg",
            "body_type": "纤细",
            
            "appearance": {
                "hair": {"style": "及腰直发", "color": "墨黑色", "length": "及腰"},
                "eyes": {"shape": "圆润杏眼", "color": "深褐色"},
                "face": {"shape": "鹅蛋脸", "skin_tone": "冷白皮"},
                "distinctive_features": ["左耳三个银色耳环", "右手小指戴一枚银戒"]
            },
            
            "costume": {
                "main_outfit": "米白色针织开衫 + 浅蓝碎花连衣裙 + 棕色短靴",
                "accessories": ["帆布托特包", "银色细链项链"],
                "color_palette": ["米白", "浅蓝", "暖棕"]
            },
            
            "multi_view_references": {
                "front": "正面站立，双手抱着书本，微笑",
                "side": "侧面坐在窗边看书，阳光洒在头发上",
                "three_quarter": "3/4侧转身，头发随风飘起",
                "portrait": "头像，大眼睛带着好奇",
                "full_body": "全身，站在咖啡店门口，阳光从背后照来"
            },
            
            "expressions": {
                "neutral": "安静恬淡，眼神带着观察",
                "happy": "眼睛发亮，笑容灿烂",
                "sad": "低头咬嘴唇，眼眶泛红",
                "surprised": "瞪大眼睛，微微张嘴",
                "angry": "眉头紧锁，眼神倔强",
                "curious": "歪头，眼睛微眯，带着探究",
                "worried": "咬着下唇，手指绞在一起"
            },
            
            "actions": {
                "walking": "步伐轻快，喜欢蹦跳着走",
                "reading": "窝在沙发里，时不时撩一下垂落的头发",
                "sitting": "喜欢靠窗位置，腿蜷缩在椅子上",
                "drinking": "双手捧杯，小口啜饮，眼睛眯起来"
            },
            
            "background": {
                "personality": "外表温柔安静，内心倔强勇敢。表面是个文艺女青年，实际是个编程高手。喜欢用理性和逻辑解决问题。",
                "backstory": "大学计算机专业毕业，在一家创业公司做全栈开发。三个月前被诊断出罕见的心脏病，医生说可能只剩半年。她来咖啡馆是为了在剩下的时间里，完成自己一直想写的程序——一个能帮人找到幸福的AI。",
                "motivation": "在生命结束前完成自己的AI项目，帮助更多人找到幸福",
                "skills": ["全栈开发", "AI/机器学习", "钢琴八级"],
                "weaknesses": ["过于要强", "不愿意接受帮助", "把情绪都藏在心里"]
            },
            
            "relationships": {
                "林星": "咖啡师，最初只是常客，后来成为互相救赎的人",
                "妈妈": "远在老家的母亲，还不知道她的病情"
            },
            
            "dialogue_style": {
                "tone": "温柔但坚定，偶尔会蹦出技术术语",
                "catchphrases": ["这个逻辑不对", "相信我，我是程序员"],
                "speech_pattern": "喜欢先思考3秒再回答，偶尔自言自语"
            },
            
            "character_arc": {
                "start": "隐瞒病情，独自面对死亡，用工作麻痹自己",
                "mid": "在林星的帮助下，开始接受现实，学会依赖他人",
                "end": "坦然面对生命，发现真正重要的不是活多久，而是怎么活"
            }
        },
        
        {
            "name": "神秘客人（顾先生）",
            "role": "关键配角 / 命运使者",
            "age": "不详（看似35岁左右）",
            "gender": "男",
            "height": "185cm",
            "weight": "75kg",
            "body_type": "修长挺拔",
            
            "appearance": {
                "hair": {"style": "整齐后梳", "color": "银灰色", "length": "及颈"},
                "eyes": {"shape": "深邃丹凤眼", "color": "灰蓝色"},
                "face": {"shape": "棱角分明", "skin_tone": "苍白"},
                "distinctive_features": ["总是带着一把黑色长柄伞", "左手无名指有一圈淡金色印记"]
            },
            
            "costume": {
                "main_outfit": "黑色长风衣 + 深灰西装三件套 + 黑皮鞋",
                "accessories": ["银质怀表", "黑伞"],
                "color_palette": ["黑", "深灰", "银"]
            },
            
            "expressions": {
                "neutral": "面无表情，眼神深邃",
                "amused": "嘴角极轻微上扬，眼里有笑意",
                "serious": "眼神锐利，气场压迫",
                "warm": "很少见，但笑的时候会让人如沐春风"
            },
            
            "background": {
                "personality": "神秘莫测，说话总是话中有话。看似冷漠，实则一直在暗中观察和引导",
                "backstory": "他似乎是命运线的管理者。每个命运线即将消失的人都会遇见他。他来给林星最后一个选择：用自己的命运线换苏晚晴的命。",
                "motivation": "测试人性，看林星会做出什么选择",
                "skills": ["命运操控", "空间移动", "时间感知"]
            },
            
            "dialogue_style": {
                "tone": "低沉平静，带着不容置疑的从容",
                "catchphrases": ["你还有三次机会", "时间不多了", "选择权在你手上"],
                "speech_pattern": "喜欢用短句，每句话之间停顿三秒"
            }
        },
        
        {
            "name": "陈叔",
            "role": "配角 / 知情人",
            "age": 58,
            "gender": "男",
            "height": "172cm",
            "weight": "70kg",
            "body_type": "微胖",
            
            "appearance": {
                "hair": {"style": "短发", "color": "花白", "length": "短"},
                "eyes": {"shape": "笑眼", "color": "深棕色"},
                "face": {"shape": "圆脸", "skin_tone": "健康小麦色"},
                "distinctive_features": ["总是戴一顶贝雷帽", "嘴角有一颗痣"]
            },
            
            "costume": {
                "main_outfit": "格子衬衫 + 卡其色马甲 + 深蓝围裙",
                "accessories": ["老花镜挂在胸前", "烟斗（从不点燃）"],
                "color_palette": ["格子", "卡其", "深蓝"]
            },
            
            "background": {
                "personality": "慈祥和蔼，爱说教但其实很通透。年轻时也曾拥有看见命运线的能力。",
                "backstory": "30年前他也和林星一样，能看见命运线。他选择用能力赚钱，结果命运线加速消失。最后他放弃了能力，开了这家书店，过普通人的生活。他是唯一理解林星处境的人。",
                "motivation": "不希望林星重蹈他的覆辙，但又知道拦不住年轻人"
            },
            
            "dialogue_style": {
                "tone": "慢悠悠的，带着长辈的慈爱",
                "catchphrases": ["年轻人啊……", "我年轻的时候也……"],
                "speech_pattern": "喜欢用比喻，说到一半会走神"
            }
        }
    ],
    
    "story_structure": {
        "three_act_structure": {
            "act_1_setup": {
                "summary": "介绍林星和他的小咖啡馆，展示他能看见命运线的能力。通过几位客人的故事展现能力规则。苏晚晴第一次出现，林星注意到她的命运线异常暗淡。",
                "key_events": [
                    "林星帮一位客人避免了一场车祸（命运线断裂→修复）",
                    "苏晚晴第一次来咖啡馆，林星发现她的命运线只剩一小截",
                    "神秘客人第一次出现，留下一句话'你还有三个月'",
                    "陈叔透露自己也曾有这种能力，警告林星不要过度使用"
                ],
                "character_introductions": ["林星", "苏晚晴", "陈叔", "神秘客人"]
            },
            "act_2_confrontation": {
                "summary": "林星和苏晚晴逐渐熟悉。苏晚晴坦白自己的病情。林星开始用能力帮助她，但每次使用自己的命运线就缩短一截。神秘客人每周出现，像倒计时一样提醒他。林星必须在救苏晚晴和保全自己之间做选择。",
                "key_events": [
                    "苏晚晴展示自己写的AI程序，说想在死前完成它",
                    "林星用命运线帮苏晚晴找到更好的医疗方案",
                    "林星的手开始变得透明——命运线消失的前兆",
                    "神秘客人给出最终选择：用你全部命运线换她活"
                ],
                "turning_point": "林星发现苏晚晴的AI程序里有一个关于'幸福'的算法，其实是她为他设计的——她早就知道自己会爱上他"
            },
            "act_3_resolution": {
                "summary": "林星做出选择。他用自己的全部命运线换了苏晚晴的命。在命运线消失的最后一刻，他看见了自己的命运——原来他的命运线从一开始就只有26年，他存在的意义就是在这26年里找到值得付出一切的人。苏晚晴活了下来，她的AI程序获得大奖。但她不记得林星了——所有关于他的记忆都被抹去。直到有一天，她走进一家咖啡馆，点了一杯咖啡，觉得这里的味道好熟悉。",
                "key_events": [
                    "林星做出选择，命运线完全消失",
                    "苏晚晴手术成功，醒来后不记得林星",
                    "一年后，苏晚晴的AI获得国际大奖",
                    "苏晚晴偶然走进一家新开的咖啡馆，觉得一切都好熟悉",
                    "最后一幕：吧台后一个年轻人抬起头，琥珀色眼睛，右眼角有颗泪痣——'你的咖啡好了'"
                ],
                "climax": "苏晚晴站在咖啡馆门口，阳光从背后照来，吧台后的年轻人对她微笑——一切重新开始"
            }
        },
        "themes": [
            "真正的命运不是注定的线，而是我们主动做出的选择",
            "付出和牺牲的意义不在于回报，而在于付出的那一刻",
            "记忆可以被抹去，但感觉不会消失",
            "生命的长短不重要，重要的是如何度过"
        ]
    },
    
    "scenes": [
        {
            "scene_number": 1,
            "location": "『星尘咖啡馆』室内",
            "time": "午后",
            "weather": "晴天，阳光透过落地窗",
            "atmosphere": "温暖宁静，咖啡香气弥漫",
            
            "panels": [
                {
                    "panel_number": 1,
                    "camera_angle": "远景",
                    "camera_movement": "固定",
                    "characters_in_frame": ["林星"],
                    "action": "林星在吧台后擦拭咖啡杯，阳光从侧面照在他身上",
                    "visual_prompt": "电影感远景，温暖的咖啡馆室内，木色装修，阳光透过落地窗洒进来，年轻咖啡师在吧台后擦拭杯子，深棕色碎发，琥珀色眼睛，专注的表情，柔和的自然光，浅景深，温暖色调",
                    "negative_prompt": "过曝，冷色调，空无一人，脏乱"
                },
                {
                    "panel_number": 2,
                    "camera_angle": "特写",
                    "camera_movement": "缓慢推进",
                    "characters_in_frame": ["林星"],
                    "action": "林星拿起一个白色咖啡杯，突然手指一顿，眼神变得专注",
                    "visual_prompt": "手部特写，修长的手指握着白色咖啡杯，杯子上隐约可见一条发光的金色丝线，年轻男人的手指修长干净，暖色调，微距镜头",
                    "negative_prompt": "手部畸形，线条突兀"
                },
                {
                    "panel_number": 3,
                    "camera_angle": "中景",
                    "camera_movement": "固定",
                    "characters_in_frame": ["林星"],
                    "action": "林星抬头看向门口，表情微变——他看见新客人的命运线",
                    "visual_prompt": "中景，年轻咖啡师抬起头，琥珀色眼睛望向镜头方向，表情从平静变成微微惊讶，柔和的逆光勾勒出轮廓，眼神中有金色的光点反射",
                    "negative_prompt": "表情僵硬，眼神空洞"
                }
            ],
            "transition": "切"
        },
        {
            "scene_number": 2,
            "location": "『星尘咖啡馆』靠窗座位",
            "time": "午后",
            "weather": "晴天",
            "atmosphere": "轻松带着一丝微妙",
            
            "panels": [
                {
                    "panel_number": 1,
                    "camera_angle": "过肩镜头（林星视角）",
                    "camera_movement": "固定",
                    "characters_in_frame": ["苏晚晴", "林星（背影）"],
                    "action": "苏晚晴推门进来，林星从吧台后看到她——她的命运线只有短短一截",
                    "visual_prompt": "过肩镜头，从林星背后拍摄，年轻女子推门走进咖啡馆，逆光中她的轮廓被阳光勾勒，长发及腰，墨黑色，米白色开衫，她环顾四周，表情安静中带着一丝疲惫",
                    "negative_prompt": "过曝，面部模糊"
                },
                {
                    "panel_number": 2,
                    "camera_angle": "特写",
                    "camera_movement": "固定",
                    "characters_in_frame": ["苏晚晴"],
                    "action": "苏晚晴的侧脸，阳光照在她脸上，她微微眯眼",
                    "visual_prompt": "年轻女子侧面特写，鹅蛋脸，冷白皮，圆润杏眼微眯，睫毛很长，左耳三个银色耳环在阳光下闪光，柔和的光线勾勒出脸部轮廓，浅景深，背景虚化",
                    "negative_prompt": "皮肤瑕疵过多，表情扭曲"
                },
                {
                    "panel_number": 3,
                    "camera_angle": "中景",
                    "camera_movement": "固定",
                    "characters_in_frame": ["苏晚晴", "林星"],
                    "action": "林星开口打招呼，苏晚晴转头看向他，两人第一次对视",
                    "visual_prompt": "中景，吧台后的年轻咖啡师和刚进门的女子对视，阳光在他们之间形成一道光柱，空气中漂浮着细微的咖啡粉尘和光点，构图对称，温暖色调",
                    "negative_prompt": "过曝，表情生硬"
                }
            ],
            "transition": "淡入淡出"
        },
        {
            "scene_number": 3,
            "location": "『星尘咖啡馆』吧台",
            "time": "黄昏",
            "weather": "多云，金色余晖",
            "atmosphere": "温柔中带着感伤",
            
            "panels": [
                {
                    "panel_number": 1,
                    "camera_angle": "特写",
                    "camera_movement": "固定",
                    "characters_in_frame": ["林星"],
                    "action": "林星看着自己的手，指尖边缘变得半透明，命运线只剩短短一截",
                    "visual_prompt": "手部特写，年轻男人的手指，指尖边缘变得半透明，可以隐约看到背景的木纹，手腕处一条微弱的金色丝线只剩最后一小段，即将熄灭，暖色调中带着一丝冷蓝",
                    "negative_prompt": "手部明显不自然，线条过多"
                },
                {
                    "panel_number": 2,
                    "camera_angle": "中景",
                    "camera_movement": "固定",
                    "characters_in_frame": ["林星", "神秘客人"],
                    "action": "神秘客人坐在吧台前，黑色长伞靠在桌边。他平静地看着林星",
                    "visual_prompt": "中景，暮色中两个男人隔着吧台对坐，年轻咖啡师表情复杂，神秘客人身穿黑色长风衣，银灰色头发，灰蓝色眼睛深邃，吧台上放着一杯未动的咖啡，黑色长伞靠在桌边，气氛凝重，冷暖色调对比",
                    "negative_prompt": "表情夸张，光线不合理"
                },
                {
                    "panel_number": 3,
                    "camera_angle": "特写",
                    "camera_movement": "缓慢推进",
                    "characters_in_frame": ["神秘客人"],
                    "action": "神秘客人看着林星，说出最终选择",
                    "visual_prompt": "面部特写，神秘客人的脸，棱角分明，灰蓝色眼睛深邃如深海，表情平静但眼神中有一丝审视，嘴唇微启，银灰色发丝有一缕垂在额前，背景是完全的黑色，只有他的脸被一束顶光照亮，对比强烈",
                    "negative_prompt": "表情狰狞，光线平淡"
                },
                {
                    "panel_number": 4,
                    "camera_angle": "特写",
                    "camera_movement": "固定",
                    "characters_in_frame": ["林星"],
                    "action": "林星沉默三秒，然后露出了一个释然的微笑",
                    "visual_prompt": "面部特写，年轻男人的脸，琥珀色眼睛中有泪光但嘴角上扬，是释然的微笑，右眼角下的泪痣清晰可见，暖色调，一束金色夕阳正好照在他的脸上，眼神坚定而温柔",
                    "negative_prompt": "表情痛苦，光线过暗"
                }
            ],
            "transition": "溶解到白"
        },
        {
            "scene_number": 4,
            "location": "医院病房",
            "time": "清晨",
            "weather": "晴天",
            "atmosphere": "安静，充满希望",
            
            "panels": [
                {
                    "panel_number": 1,
                    "camera_angle": "中景",
                    "camera_movement": "固定",
                    "characters_in_frame": ["苏晚晴"],
                    "action": "苏晚晴从病床上醒来，窗外阳光正好。她看起来健康了",
                    "visual_prompt": "中景，年轻女子在医院病床上醒来，晨光从窗户照进来，她的脸色恢复了红润，墨黑色长发散在枕头上，眼睛缓缓睁开，表情从迷茫到清醒，构图柔和，希望感",
                    "negative_prompt": "面色苍白，病房阴暗"
                },
                {
                    "panel_number": 2,
                    "camera_angle": "特写",
                    "camera_movement": "固定",
                    "characters_in_frame": ["苏晚晴"],
                    "action": "苏晚晴摸了一下自己的心口，感觉空落落的，好像忘了什么重要的事",
                    "visual_prompt": "特写，年轻女子的手按在心口，手指修长，小指上戴着一枚银戒，表情若有所思，眼神带着一丝迷茫和失落，晨光在她的睫毛上投下阴影",
                    "negative_prompt": "表情痛苦"
                }
            ],
            "transition": "切"
        },
        {
            "scene_number": 5,
            "location": "新咖啡馆『初星』室内",
            "time": "午后",
            "weather": "晴天",
            "atmosphere": "温暖熟悉，带着淡淡的咖啡香",
            
            "panels": [
                {
                    "panel_number": 1,
                    "camera_angle": "远景",
                    "camera_movement": "缓慢推进",
                    "characters_in_frame": ["苏晚晴"],
                    "action": "苏晚晴路过一家新开的咖啡馆，被里面的咖啡香吸引，停下脚步",
                    "visual_prompt": "远景，从街道对面拍摄，一家新开的咖啡馆，暖黄色的灯光从玻璃窗透出来，门口挂着木质招牌'初星'，一个年轻女子站在门口，被香气吸引，正要推门进去，午后阳光，街景柔和",
                    "negative_prompt": "冷清，灯光惨白"
                },
                {
                    "panel_number": 2,
                    "camera_angle": "过肩镜头（苏晚晴视角）",
                    "camera_movement": "固定",
                    "characters_in_frame": ["苏晚晴（背影）", "林星"],
                    "action": "苏晚晴推开门，看到吧台后的年轻人。心跳莫名加速了一拍",
                    "visual_prompt": "过肩镜头，从年轻女子背后拍摄，吧台后一个年轻咖啡师抬起头，深棕色微卷碎发，琥珀色眼睛，右眼角有颗泪痣，穿着白衬衫和深棕色围裙，他对她微笑，阳光在他身后形成光晕",
                    "negative_prompt": "表情冷漠，光线混乱"
                },
                {
                    "panel_number": 3,
                    "camera_angle": "中景",
                    "camera_movement": "固定",
                    "characters_in_frame": ["林星", "苏晚晴"],
                    "action": "林星微笑，说出和第一次见面时一模一样的话。苏晚晴愣住，眼眶泛红",
                    "visual_prompt": "中景，年轻咖啡师微笑看着门口的女子，眼神温暖，女子站在门口，表情从惊讶变成眼眶泛红，两人之间隔着一段距离，但构图上有一种无形的连接感，阳光在他们之间形成一道光柱，温暖梦幻的色调",
                    "negative_prompt": "表情夸张，光线过曝"
                }
            ],
            "transition": "淡出"
        }
    ],
    
    "visual_guide": {
        "art_style": "日式治愈系动漫风格，参考新海诚作品",
        "color_palette": {
            "primary": ["暖白 #FFF8F0", "咖啡棕 #6B4226", "琥珀金 #C8956E"],
            "secondary": ["墨黑 #1A1A2E", "深灰 #4A4A4A", "米白 #F5F0E8"],
            "accent": ["命运线金 #FFD700", "冷蓝 #4A90D9", "暖橙 #E8924A"],
            "mood_colors": {
                "温馨": "暖黄 + 棕",
                "感伤": "冷蓝 + 灰",
                "希望": "金色 + 白",
                "神秘": "黑 + 银灰"
            }
        },
        "lighting": "以自然光为主，强调阳光和阴影的对比",
        "line_art": "柔和细线，线条有温度感",
        "rendering": "赛璐璐风格，干净清透的上色",
        "consistency_rules": [
            "林星的泪痣在所有镜头中必须位于右眼角正下方",
            "苏晚晴的左耳三个耳环间距保持一致",
            "命运线呈现为半透明金色发光丝线，从心口延伸",
            "咖啡馆场景保持木色+暖黄的统一色调",
            "神秘客人始终带着黑伞，即使晴天"
        ]
    }
}

# 输出
print(json.dumps(story, indent=2, ensure_ascii=False))
