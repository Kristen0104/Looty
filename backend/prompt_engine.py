STYLE_PROMPTS = {
    "pixel": {
        "label": "精致 2D 像素风",
        "positive": (
            "premium 2D indie game pixel art sprite, crisp pixel clusters, readable silhouette, "
            "limited palette, clean highlight blocks, centered single object"
        ),
    },
    "vector": {
        "label": "美漫粗线游戏图标",
        "positive": (
            "premium mobile game loot icon, bold clean outline, cel shaded material, polished metal, "
            "sharp edge highlights, gem and rune details, centered single object"
        ),
    },
}

TYPE_RULES = {
    "sword": {
        "label": "剑 / 刀",
        "keywords": ("剑", "刀", "刃", "sword", "blade", "katana", "dagger"),
        "parts": "a clear blade, guard, grip, and pommel",
    },
    "axe": {
        "label": "斧头",
        "keywords": ("斧", "axe"),
        "parts": "a heavy axe head, cutting edge, and handle",
    },
    "hammer": {
        "label": "战锤",
        "keywords": ("锤", "槌", "hammer", "mace"),
        "parts": "a heavy hammer head, handle, and impact faces",
    },
    "staff": {
        "label": "法杖",
        "keywords": ("杖", "法杖", "staff", "wand"),
        "parts": "a long staff shaft, magical focus, and top crystal",
    },
    "bow": {
        "label": "弓",
        "keywords": ("弓", "bow"),
        "parts": "curved bow limbs, string, and arrow rest",
    },
    "shield": {
        "label": "盾牌",
        "keywords": ("盾", "盾牌", "shield"),
        "parts": "a shield body, rim, and center boss",
    },
    "potion": {
        "label": "药水",
        "keywords": ("药", "瓶", "药水", "potion", "bottle", "elixir"),
        "parts": "a glass bottle, cork, and visible liquid fill",
    },
    "coin": {
        "label": "徽章 / 金币",
        "keywords": ("金币", "徽章", "奖章", "coin", "badge", "medal", "crest"),
        "parts": "a round emblem, raised symbol, and metal rim",
    },
    "polearm": {
        "label": "长柄武器",
        "keywords": ("戟", "矛", "枪", "长枪", "方天画戟", "polearm", "halberd", "spear", "lance", "glaive"),
        "parts": (
            "a very long vertical shaft, a central spear tip, two symmetrical crescent moon side blades "
            "near the spear tip, a small tail spike at the bottom, ornate bindings on the shaft"
        ),
    },
    "book": {
        "label": "法典 / 卷轴",
        "keywords": ("书", "法典", "卷轴", "book", "tome", "scroll"),
        "parts": "a cover, pages or scroll roll, and magic markings",
    },
    "helmet": {
        "label": "头盔",
        "keywords": ("头盔", "盔", "helmet", "helm"),
        "parts": "a helmet shell, visor, and cheek guards",
    },
    "glove": {
        "label": "手套 / 爪",
        "keywords": ("手套", "爪", "拳套", "glove", "gauntlet", "claw"),
        "parts": "gauntlet fingers, wrist guard, and claw or knuckle details",
    },
}

ELEMENT_RULES = {
    "fire": {"label": "火属性", "keywords": ("火", "炎", "焰", "熔岩", "fire", "flame", "lava", "ember")},
    "ice": {"label": "冰属性", "keywords": ("冰", "霜", "雪", "寒", "晶", "ice", "frost", "snow", "crystal")},
    "lightning": {"label": "雷电属性", "keywords": ("雷", "电", "闪", "风暴", "thunder", "lightning", "storm", "electric")},
    "poison": {"label": "毒属性", "keywords": ("毒", "酸", "腐", "液", "poison", "toxic", "acid", "venom")},
    "holy": {"label": "圣光属性", "keywords": ("圣", "光", "神", "金", "holy", "divine", "gold", "light")},
    "shadow": {"label": "暗影属性", "keywords": ("暗", "影", "黑", "夜", "紫", "shadow", "dark", "void", "night")},
}

SPECIFIC_ITEM_HINTS = {
    "方天画戟": (
        "This is Fangtian Huaji, a Chinese halberd. It must not look like a sword, axe, badge, crystal, "
        "or abstract icon. It needs a long straight pole, a sharp central spear point, and two mirrored "
        "crescent moon side blades just under the spear point."
    ),
}

NEGATIVE_PROMPT = (
    "character, person, hand holding the item, environment, scenery, background texture, text, watermark, "
    "UI frame, multiple objects, cropped object, blurry edges, photorealistic render, abstract logo, "
    "generic sword replacement, axe-only replacement, random crystal replacement, badge replacement"
)


def _contains_any(text, keywords):
    lower = text.lower()
    return any(keyword in text or keyword in lower for keyword in keywords)


def _specific_hint(text):
    for key, hint in SPECIFIC_ITEM_HINTS.items():
        if key in text:
            return hint
    return ""


def detect_asset_type(text, manual_type="auto"):
    if manual_type and manual_type != "auto":
        return manual_type
    for asset_type, rule in TYPE_RULES.items():
        if _contains_any(text, rule["keywords"]):
            return asset_type
    return "custom"


def detect_element(text, upgrade_text=""):
    if upgrade_text:
        for element, rule in ELEMENT_RULES.items():
            if _contains_any(upgrade_text, rule["keywords"]):
                return element
    joined = f"{text} {upgrade_text}".strip()
    for element, rule in ELEMENT_RULES.items():
        if _contains_any(joined, rule["keywords"]):
            return element
    return "arcane"


def build_prompt(text, style="vector", manual_type="auto", seed="looty-demo", upgrade_text="", variant=0):
    clean_text = " ".join((text or "神秘装备").split())
    clean_upgrade = " ".join((upgrade_text or "").split())
    asset_type = detect_asset_type(clean_text, manual_type)
    element = detect_element(clean_text, clean_upgrade)
    tier = 2 if clean_upgrade else 1
    style_rule = STYLE_PROMPTS.get(style, STYLE_PROMPTS["vector"])
    type_rule = TYPE_RULES.get(asset_type, {"label": "自定义道具", "parts": "recognizable object silhouette and defining parts"})
    element_label = ELEMENT_RULES.get(element, {"label": "奥术属性"})["label"] if element != "arcane" else "奥术属性"
    item_hint = _specific_hint(clean_text)

    upgrade_part = ""
    if clean_upgrade:
        upgrade_part = (
            f" Upgrade direction: {clean_upgrade}. Preserve the original item category and silhouette, "
            "then add upgraded materials, gems, runes and elemental VFX without changing it into another item."
        )

    prompt = (
        f"Create a production-ready transparent PNG game sprite for this exact item: {clean_text}. "
        f"{item_hint} "
        f"Item type: {type_rule['label']}; required structure: {type_rule['parts']}. "
        f"Element theme: {element_label}. Style: {style_rule['positive']}. "
        "The full object must be visible from tip to bottom, isolated, centered, readable at small inventory-icon size, "
        "with strong silhouette and clean alpha-ready edges. Use a pure solid white or transparent background only; "
        "no scene and no extra props."
        f"{upgrade_part} Negative constraints: {NEGATIVE_PROMPT}. "
        f"Deterministic art direction seed: {seed}; variant index: {variant}."
    )

    return {
        "prompt": prompt,
        "negative_prompt": NEGATIVE_PROMPT,
        "asset_type": asset_type,
        "asset_label": type_rule["label"],
        "element": element,
        "element_label": element_label,
        "tier": tier,
        "style": style,
        "style_label": style_rule["label"],
        "seed": seed,
        "thinking": [
            f"解析用户输入为「{type_rule['label']}」，必须保留结构：{type_rule['parts']}。",
            f"根据文本和升级方向选择「{element_label}」，用于材质、光效和配色。",
            f"套用「{style_rule['label']}」生产约束，并强制单物体、无文字、无场景、透明 PNG 交付。",
        ],
        "intent": {
            "用户需求": clean_text,
            "识别类型": type_rule["label"],
            "识别属性": element_label,
            "目标风格": style_rule["label"],
            "进化方向": clean_upgrade or "无，生成基础版本",
        },
    }
