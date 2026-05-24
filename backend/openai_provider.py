import json
import os
import urllib.error
import urllib.request


OPENAI_IMAGES_URL = "https://api.openai.com/v1/images/generations"


class OpenAIProviderError(RuntimeError):
    pass


def _model_supports_transparent_background(model):
    return not model.startswith("gpt-image-2")


def generate_images(prompt, count=1, api_key=None, model=None):
    api_key = api_key or os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise OpenAIProviderError("OPENAI_API_KEY is not configured")

    model = model or os.environ.get("LOOTY_IMAGE_MODEL", "gpt-image-1-mini")
    payload = {
        "model": model,
        "prompt": prompt,
        "n": count,
        "size": os.environ.get("LOOTY_IMAGE_SIZE", "1024x1024"),
        "quality": os.environ.get("LOOTY_IMAGE_QUALITY", "low"),
        "output_format": "png",
    }

    if _model_supports_transparent_background(model):
        payload["background"] = "transparent"

    request = urllib.request.Request(
        OPENAI_IMAGES_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=180) as response:
            body = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise OpenAIProviderError(f"OpenAI API error {exc.code}: {detail}") from exc
    except urllib.error.URLError as exc:
        raise OpenAIProviderError(f"OpenAI API connection failed: {exc}") from exc

    images = []
    for item in body.get("data", []):
        b64 = item.get("b64_json")
        if b64:
            images.append(f"data:image/png;base64,{b64}")

    if not images:
        raise OpenAIProviderError("OpenAI API did not return image data")

    return {
        "images": images,
        "provider": "openai",
        "model": model,
        "background": payload.get("background", "auto"),
    }
