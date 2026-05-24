STYLE_PROMPTS = {
    "pixel": (
        "premium 2D indie game pixel art icon, crisp pixel clusters, clear readable "
        "silhouette, pure solid white background, no scene, no floating text, standalone object"
    ),
    "vector": (
        "premium mobile game loot icon, bold clean outline, cel shaded material, gem and rune "
        "details, clear readable silhouette, pure solid white background, no scene, standalone object"
    ),
}

TYPE_KEYWORDS = {
    "sword": ("剑", "刀", "刃", "sword", "blade", "katana", "dagger"),
    "axe": ("斧", "axe"),
    "hammer": ("锤", "槌", "hammer", "mace"),
    "staff": ("杖", "法杖", "staff", "wand"),
    "bow": ("弓", "bow"),
    "shield": ("盾", "shield"),
    "potion": ("药", "瓶", "水剂", "potion", "bottle", "elixir"),
    "coin": ("金币", "徽章", "奖章", "coin", "badge", "medal", "crest"),
}

ELEMENT_KEYWORDS = {
    "fire": ("火", "炎", "焰", "熔岩", "fire", "flame", "lava", "ember"),
    "ice": ("冰", "霜", "雪", "寒", "晶", "ice", "frost", "snow", "crystal"),
    "lightning": ("雷", "电", "闪", "风暴", "thunder", "lightning", "storm"),
    "poison": ("毒", "酸", "腐", "液", "poison", "toxic", "acid", "venom"),
    "holy": ("圣", "光", "神", "金", "holy", "divine", "gold"),
    "shadow": ("暗", "影", "黑", "夜", "紫", "shadow", "dark", "void"),
}


def _contains_any(text, keywords):
    lower = text.lower()
    return any(keyword in text or keyword in lower for keyword in keywords)


def detect_asset_type(text, manual_type="auto"):
    if manual_type and manual_type != "auto":
        return manual_type

    for asset_type, keywords in TYPE_KEYWORDS.items():
        if _contains_any(text, keywords):
            return asset_type

    return "relic"


def detect_element(text, upgrade_text=""):
    if upgrade_text:
        for element, keywords in ELEMENT_KEYWORDS.items():
            if _contains_any(upgrade_text, keywords):
                return element

    joined = f"{text} {upgrade_text}".strip()
    for element, keywords in ELEMENT_KEYWORDS.items():
        if _contains_any(joined, keywords):
            return element
    return "arcane"


def build_prompt(text, style="vector", manual_type="auto", seed="looty-demo", upgrade_text="", variant=0):
    clean_text = " ".join((text or "神秘装备").split())
    clean_upgrade = " ".join((upgrade_text or "").split())
    asset_type = detect_asset_type(clean_text, manual_type)
    element = detect_element(clean_text, clean_upgrade)
    tier = 2 if clean_upgrade else 1
    style_prompt = STYLE_PROMPTS.get(style, STYLE_PROMPTS["vector"])
    upgrade_part = ""

    if clean_upgrade:
        upgrade_part = (
            f", image-to-image upgrade direction: {clean_upgrade}, preserve the base silhouette, "
            "add upgraded materials, gems, runes and stronger elemental VFX"
        )

    prompt = (
        f"{clean_text}, asset type: {asset_type}, element: {element}, {style_prompt}"
        f"{upgrade_part}, deterministic seed: {seed}, variant: {variant}, final transparent PNG "
        "after automatic background removal."
    )

    return {
        "prompt": prompt,
        "asset_type": asset_type,
        "element": element,
        "tier": tier,
        "style": style,
        "seed": seed,
    }
