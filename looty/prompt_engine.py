"""Prompt templates for Looty game asset generation."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class StylePrompt:
    id: str
    label: str
    prompt_block: str


STYLE_PROMPTS: dict[str, StylePrompt] = {
    "pixel": StylePrompt(
        id="pixel",
        label="复古2D像素风",
        prompt_block=(
            "2D indie game pixel art, 16-bit style, sharp square pixels, "
            "limited clean palette, crisp silhouette, readable at small size"
        ),
    ),
    "comic_vector": StylePrompt(
        id="comic_vector",
        label="美漫粗线矢量风",
        prompt_block=(
            "bold comic vector game icon, thick black outline, clean flat colors, "
            "three-step cel shading, high contrast silhouette"
        ),
    ),
}

BASE_ASSET_CONSTRAINTS = (
    "standalone single equipment item, centered composition, full object visible, "
    "pure solid white background, no scene, no character, no hands, no UI, no text, "
    "no logo, no watermark, no floating particles, clean edge boundary, game-ready asset"
)

TRANSPARENT_OUTPUT_HINT = (
    "Final goal: after background removal this must work as a transparent PNG sprite "
    "for Unity or other 2D game engines."
)


def get_style_options() -> dict[str, str]:
    """Return Streamlit-friendly style options."""
    return {style.label: style_id for style_id, style in STYLE_PROMPTS.items()}


def build_asset_prompt(description: str, style_id: str) -> str:
    """Build a text-to-image prompt for a standalone equipment asset."""
    normalized = _require_text(description, "请输入装备描述。")
    style = _get_style(style_id)
    return "\n".join(
        [
            f"Create a game equipment asset: {normalized}.",
            f"Style: {style.prompt_block}.",
            f"Constraints: {BASE_ASSET_CONSTRAINTS}.",
            TRANSPARENT_OUTPUT_HINT,
        ]
    )


def build_evolution_prompt(base_description: str, evolution: str, style_id: str) -> str:
    """Build a prompt for a lightweight equipment evolution flow."""
    base = _require_text(base_description, "缺少原始装备描述。")
    change = _require_text(evolution, "请输入进化描述。")
    style = _get_style(style_id)
    return "\n".join(
        [
            f"Evolve the existing game equipment asset: {base}.",
            f"Upgrade instruction: {change}.",
            "Preserve the original item's main silhouette, readable shape, and equipment category.",
            f"Style: {style.prompt_block}.",
            f"Constraints: {BASE_ASSET_CONSTRAINTS}.",
            TRANSPARENT_OUTPUT_HINT,
        ]
    )


def _get_style(style_id: str) -> StylePrompt:
    try:
        return STYLE_PROMPTS[style_id]
    except KeyError as exc:
        raise ValueError(f"未知画风: {style_id}") from exc


def _require_text(value: str, message: str) -> str:
    normalized = (value or "").strip()
    if not normalized:
        raise ValueError(message)
    return normalized

