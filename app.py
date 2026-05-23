from __future__ import annotations

import os
from datetime import datetime

import streamlit as st
from dotenv import load_dotenv

from looty.background import BackgroundRemovalError, remove_background
from looty.image_provider import ImageGenerationError, ProviderConfig, generate_image
from looty.prompt_engine import (
    build_asset_prompt,
    build_evolution_prompt,
    get_style_options,
)

load_dotenv()
st.set_page_config(page_title="Looty", page_icon="🪓", layout="wide")


def main() -> None:
    _init_state()
    _render_header()

    style_options = get_style_options()
    left, right = st.columns([0.42, 0.58], gap="large")

    with left:
        st.subheader("1. 生成游戏资产")
        description = st.text_input("你需要什么装备？", value=st.session_state.description)
        selected_style_label = st.selectbox("选择素材画风", list(style_options.keys()))
        style_id = style_options[selected_style_label]

        provider_label = st.radio(
            "生图模式",
            ["mock 演示模式", "Seedream 真实模式"],
            index=0 if st.session_state.provider == "mock" else 1,
            horizontal=True,
        )
        provider = "mock" if provider_label.startswith("mock") else "seedream"

        if provider == "seedream" and not os.getenv("ARK_API_KEY"):
            st.warning("当前没有检测到 ARK_API_KEY，真实模式会失败。可先用 mock 模式演示。")

        if st.button("生成游戏资产", type="primary", use_container_width=True):
            st.session_state.description = description
            st.session_state.style_id = style_id
            st.session_state.provider = provider
            _generate_asset(description, style_id, provider)

        st.divider()
        st.subheader("2. 装备进化室")
        evolution = st.text_input("升级此装备", placeholder="例如：变为冰属性")
        can_evolve = st.session_state.result_png is not None
        if not can_evolve:
            st.caption("先生成一个基础装备后，就可以在这里做轻量进化。")

        if st.button("进化", disabled=not can_evolve, use_container_width=True):
            st.session_state.provider = provider
            _evolve_asset(description, evolution, style_id, provider)

    with right:
        _render_workspace()


def _init_state() -> None:
    defaults = {
        "description": "魔法大剑",
        "style_id": "pixel",
        "provider": os.getenv("LOOTY_PROVIDER", "mock"),
        "raw_image": None,
        "result_png": None,
        "evolved_png": None,
        "last_prompt": "",
        "last_error": "",
    }
    for key, value in defaults.items():
        st.session_state.setdefault(key, value)


def _render_header() -> None:
    st.title("🪓 Looty")
    st.caption("Make games easy. 输入装备描述，直接得到可下载的透明 PNG 游戏素材。")


def _generate_asset(description: str, style_id: str, provider: str) -> None:
    try:
        prompt = build_asset_prompt(description, style_id)
    except ValueError as exc:
        st.error(str(exc))
        return

    st.session_state.last_prompt = prompt
    st.session_state.last_error = ""
    st.session_state.evolved_png = None

    with st.status("正在生成资产...", expanded=True) as status:
        try:
            st.write("封装 Prompt")
            config = ProviderConfig.from_env(provider=provider)
            st.write("调用生图服务")
            raw = generate_image(prompt, config)
            st.session_state.raw_image = raw
            st.write("自动去除背景")
            st.session_state.result_png = remove_background(raw)
            status.update(label="生成完毕", state="complete")
        except (ImageGenerationError, BackgroundRemovalError, ValueError) as exc:
            st.session_state.last_error = str(exc)
            status.update(label="生成失败", state="error")
            st.error(str(exc))


def _evolve_asset(description: str, evolution: str, style_id: str, provider: str) -> None:
    try:
        prompt = build_evolution_prompt(description, evolution, style_id)
    except ValueError as exc:
        st.error(str(exc))
        return

    st.session_state.last_prompt = prompt
    st.session_state.last_error = ""

    with st.status("正在进化装备...", expanded=True) as status:
        try:
            config = ProviderConfig.from_env(provider=provider)
            st.write("读取当前透明 PNG 作为参考")
            reference = st.session_state.result_png
            st.write("调用生图服务")
            raw = generate_image(prompt, config, reference_image=reference)
            st.write("自动去除背景")
            st.session_state.evolved_png = remove_background(raw)
            status.update(label="进化完成", state="complete")
        except (ImageGenerationError, BackgroundRemovalError, ValueError) as exc:
            st.session_state.last_error = str(exc)
            status.update(label="进化失败", state="error")
            st.error(str(exc))


def _render_workspace() -> None:
    st.subheader("资产结果")

    if st.session_state.last_error:
        st.error(st.session_state.last_error)

    if st.session_state.result_png:
        st.image(st.session_state.result_png, caption="透明 PNG 素材")
        st.download_button(
            "下载透明 PNG 素材",
            st.session_state.result_png,
            file_name=_file_name("looty_asset"),
            mime="image/png",
            use_container_width=True,
        )
    else:
        st.info("生成后将在这里展示去背后的透明 PNG。")

    if st.session_state.evolved_png:
        st.divider()
        st.image(st.session_state.evolved_png, caption="进化后的透明 PNG 素材")
        st.download_button(
            "下载进化 PNG 素材",
            st.session_state.evolved_png,
            file_name=_file_name("looty_evolved_asset"),
            mime="image/png",
            use_container_width=True,
        )

    with st.expander("查看本次 Prompt"):
        st.code(st.session_state.last_prompt or "还没有生成。", language="text")


def _file_name(prefix: str) -> str:
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    return f"{prefix}_{stamp}.png"


if __name__ == "__main__":
    main()
