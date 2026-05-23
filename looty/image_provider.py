"""Image generation providers for Looty."""

from __future__ import annotations

import base64
import os
from dataclasses import dataclass
from io import BytesIO
from pathlib import Path
from typing import Any

from PIL import Image, ImageDraw


DEFAULT_MODEL = "doubao-seedream-5-0-260128"
DEFAULT_BASE_URL = "https://ark.cn-beijing.volces.com/api/v3/images/generations"
DEFAULT_SIZE = "1024x1024"
DEFAULT_TIMEOUT_SECONDS = 90


class ImageGenerationError(RuntimeError):
    """Raised when an image provider cannot return image bytes."""


@dataclass(frozen=True)
class ProviderConfig:
    provider: str = "mock"
    api_key: str = ""
    base_url: str = DEFAULT_BASE_URL
    model: str = DEFAULT_MODEL
    size: str = DEFAULT_SIZE
    timeout_seconds: int = DEFAULT_TIMEOUT_SECONDS

    @classmethod
    def from_env(cls, provider: str | None = None) -> "ProviderConfig":
        selected_provider = provider or os.getenv("LOOTY_PROVIDER", "mock")
        return cls(
            provider=selected_provider,
            api_key=os.getenv("ARK_API_KEY", ""),
            base_url=os.getenv("ARK_API_BASE_URL", DEFAULT_BASE_URL),
            model=os.getenv("ARK_IMAGE_MODEL", DEFAULT_MODEL),
            size=os.getenv("ARK_IMAGE_SIZE", DEFAULT_SIZE),
            timeout_seconds=int(os.getenv("ARK_TIMEOUT_SECONDS", str(DEFAULT_TIMEOUT_SECONDS))),
        )


def generate_image(
    prompt: str,
    config: ProviderConfig,
    reference_image: bytes | None = None,
) -> bytes:
    """Generate image bytes with the selected provider."""
    if config.provider == "mock":
        return _mock_image_bytes()
    if config.provider == "seedream":
        return _call_seedream(prompt, config, reference_image=reference_image)
    raise ImageGenerationError(f"未知生图模式: {config.provider}")


def _call_seedream(
    prompt: str,
    config: ProviderConfig,
    reference_image: bytes | None = None,
) -> bytes:
    try:
        import requests
    except ImportError as exc:
        raise ImageGenerationError(
            "缺少 requests 依赖，请先运行 pip install -r requirements.txt。"
        ) from exc

    if not config.api_key:
        raise ImageGenerationError("缺少 ARK_API_KEY。请在 .env 或系统环境变量中配置后再使用真实 Seedream 模式。")

    payload: dict[str, Any] = {
        "model": config.model,
        "prompt": prompt,
        "size": config.size,
        "response_format": "b64_json",
    }

    # Seedream/Ark deployments differ for image-reference fields. Keeping the
    # field configurable makes the P1 evolution path adjustable without code edits.
    if reference_image:
        field_name = os.getenv("ARK_REFERENCE_IMAGE_FIELD", "image")
        payload[field_name] = _as_data_url(reference_image)

    try:
        response = requests.post(
            config.base_url,
            headers={
                "Authorization": f"Bearer {config.api_key}",
                "Content-Type": "application/json",
            },
            json=payload,
            timeout=config.timeout_seconds,
        )
    except requests.RequestException as exc:
        raise ImageGenerationError(f"Seedream 请求失败: {exc}") from exc

    if response.status_code >= 400:
        message = _extract_error_message(response)
        raise ImageGenerationError(f"Seedream 返回错误 {response.status_code}: {message}")

    try:
        data = response.json()
    except ValueError as exc:
        raise ImageGenerationError("Seedream 返回内容不是 JSON。") from exc

    return _extract_image_bytes(data)


def _extract_image_bytes(data: dict[str, Any]) -> bytes:
    items = data.get("data")
    if isinstance(items, list) and items:
        first = items[0]
    else:
        first = data

    b64_value = first.get("b64_json") or first.get("base64") or first.get("image")
    if isinstance(b64_value, str):
        return _decode_base64_image(b64_value)

    url = first.get("url")
    if isinstance(url, str) and url:
        return _download_image(url)

    raise ImageGenerationError("Seedream 响应中没有找到 url 或 b64_json 图片字段。")


def _decode_base64_image(value: str) -> bytes:
    if value.startswith("data:image"):
        value = value.split(",", 1)[1]
    try:
        return base64.b64decode(value)
    except ValueError as exc:
        raise ImageGenerationError("Seedream 返回的 base64 图片无法解码。") from exc


def _download_image(url: str) -> bytes:
    try:
        response = requests.get(url, timeout=60)
        response.raise_for_status()
        return response.content
    except requests.RequestException as exc:
        raise ImageGenerationError(f"下载 Seedream 图片失败: {exc}") from exc


def _extract_error_message(response: requests.Response) -> str:
    try:
        data = response.json()
    except ValueError:
        return response.text[:500]
    error = data.get("error")
    if isinstance(error, dict):
        return str(error.get("message") or error)
    return str(error or data)[:500]


def _as_data_url(image_bytes: bytes) -> str:
    return "data:image/png;base64," + base64.b64encode(image_bytes).decode("ascii")


def _mock_image_bytes() -> bytes:
    image = Image.new("RGB", (768, 768), "white")
    draw = ImageDraw.Draw(image)

    # Simple white-background fantasy sword mock, designed to exercise the MVP
    # background-removal and download flow without depending on external APIs.
    draw.polygon([(378, 92), (432, 420), (384, 610), (336, 420)], fill="#76d6ff", outline="#111111")
    draw.line([(378, 92), (432, 420), (384, 610), (336, 420), (378, 92)], fill="#111111", width=10)
    draw.polygon([(378, 120), (396, 414), (384, 548), (356, 410)], fill="#e9fbff")
    draw.rounded_rectangle((238, 438, 530, 504), radius=20, fill="#f5b942", outline="#111111", width=10)
    draw.rounded_rectangle((352, 496, 416, 678), radius=20, fill="#6d3f24", outline="#111111", width=10)
    draw.ellipse((338, 416, 430, 508), fill="#35d07f", outline="#111111", width=8)

    buffer = BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()
