"""Background removal helpers reused from the standalone demo project."""

from __future__ import annotations

import os
from collections import deque
from io import BytesIO
from pathlib import Path

from PIL import Image


MAX_IMAGE_SIZE = 2000
WHITE_THRESHOLD = 245
MODEL_FILE_NAME = "u2net.onnx"


class BackgroundRemovalError(RuntimeError):
    """Raised when rembg cannot produce a transparent PNG."""


def remove_background(image_bytes: bytes, max_size: int = MAX_IMAGE_SIZE) -> bytes:
    """Remove the image background and return PNG bytes with alpha channel."""
    try:
        image = Image.open(BytesIO(image_bytes)).convert("RGBA")
        image = resize_image(image, max_size)
    except Exception as exc:
        raise BackgroundRemovalError(f"无法读取图片: {exc}") from exc

    if _should_use_rembg():
        try:
            from rembg import remove

            fixed = remove(image).convert("RGBA")
            return image_to_png_bytes(fixed)
        except Exception as exc:  # rembg can raise model/runtime/download errors.
            if _require_rembg():
                raise BackgroundRemovalError(f"rembg 去背失败: {exc}") from exc

    fixed = remove_solid_white_background(image)
    return image_to_png_bytes(fixed)


def remove_solid_white_background(image: Image.Image) -> Image.Image:
    """Remove near-white background connected to image edges."""
    rgba = image.convert("RGBA")
    width, height = rgba.size
    pixels = rgba.load()
    visited = bytearray(width * height)
    queue: deque[tuple[int, int]] = deque()

    def index(x: int, y: int) -> int:
        return y * width + x

    def is_background_pixel(x: int, y: int) -> bool:
        r, g, b, _ = pixels[x, y]
        return (
            r >= WHITE_THRESHOLD
            and g >= WHITE_THRESHOLD
            and b >= WHITE_THRESHOLD
            and max(r, g, b) - min(r, g, b) <= 12
        )

    def enqueue_if_background(x: int, y: int) -> None:
        idx = index(x, y)
        if not visited[idx] and is_background_pixel(x, y):
            visited[idx] = 1
            queue.append((x, y))

    for x in range(width):
        enqueue_if_background(x, 0)
        enqueue_if_background(x, height - 1)
    for y in range(height):
        enqueue_if_background(0, y)
        enqueue_if_background(width - 1, y)

    while queue:
        x, y = queue.popleft()
        r, g, b, _ = pixels[x, y]
        pixels[x, y] = (r, g, b, 0)
        if x > 0:
            enqueue_if_background(x - 1, y)
        if x + 1 < width:
            enqueue_if_background(x + 1, y)
        if y > 0:
            enqueue_if_background(x, y - 1)
        if y + 1 < height:
            enqueue_if_background(x, y + 1)

    return rgba


def resize_image(image: Image.Image, max_size: int = MAX_IMAGE_SIZE) -> Image.Image:
    """Resize large images while preserving aspect ratio."""
    width, height = image.size
    if width <= max_size and height <= max_size:
        return image

    scale = max_size / max(width, height)
    new_size = (max(1, int(width * scale)), max(1, int(height * scale)))
    return image.resize(new_size, Image.LANCZOS)


def image_to_png_bytes(image: Image.Image) -> bytes:
    """Serialize a Pillow image as PNG bytes."""
    buffer = BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


def _model_cache_dir() -> Path:
    return Path(__file__).resolve().parents[1] / ".u2net"


def _should_use_rembg() -> bool:
    cache_dir = _ensure_local_model_cache()
    model_exists = (cache_dir / MODEL_FILE_NAME).exists()
    allow_download = os.getenv("LOOTY_ALLOW_REMBG_DOWNLOAD", "0") == "1"
    return model_exists or allow_download or _require_rembg()


def _require_rembg() -> bool:
    return os.getenv("LOOTY_REQUIRE_REMBG", "0") == "1"


def _ensure_local_model_cache() -> Path:
    """Keep rembg model downloads inside the project on locked-down Windows setups."""
    cache_dir = _model_cache_dir()
    cache_dir.mkdir(exist_ok=True)
    os.environ.setdefault("U2NET_HOME", str(cache_dir))
    return cache_dir
