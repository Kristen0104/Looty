import base64
import json
import os
import urllib.error
import urllib.request


ZHIPU_IMAGES_URL = "https://open.bigmodel.cn/api/paas/v4/images/generations"


class ZhipuProviderError(RuntimeError):
    pass


def _download_as_data_url(url):
    request = urllib.request.Request(url, headers={"User-Agent": "LootyMVP/0.4"})
    with urllib.request.urlopen(request, timeout=180) as response:
        content_type = response.headers.get("Content-Type", "image/png").split(";", 1)[0]
        data = response.read()
    return f"data:{content_type};base64,{base64.b64encode(data).decode('ascii')}"


def generate_images(prompt, count=1, api_key=None, model=None):
    api_key = api_key or os.environ.get("ZHIPUAI_API_KEY") or os.environ.get("ZHIPU_API_KEY")
    if not api_key:
        raise ZhipuProviderError("ZHIPUAI_API_KEY is not configured")

    model = model or os.environ.get("LOOTY_IMAGE_MODEL", "glm-image")
    payload = {
        "model": model,
        "prompt": prompt,
        "size": os.environ.get("LOOTY_IMAGE_SIZE", "1024x1024"),
        "n": max(1, min(int(count), 4)),
    }

    request = urllib.request.Request(
        ZHIPU_IMAGES_URL,
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=240) as response:
            body = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise ZhipuProviderError(f"ZhipuAI API error {exc.code}: {detail}") from exc
    except urllib.error.URLError as exc:
        raise ZhipuProviderError(f"ZhipuAI API connection failed: {exc}") from exc

    images = []
    for item in body.get("data", []) or []:
        if item.get("b64_json"):
            images.append(f"data:image/png;base64,{item['b64_json']}")
        elif item.get("url"):
            images.append(_download_as_data_url(item["url"]))

    if not images:
        raise ZhipuProviderError(f"ZhipuAI API did not return image data: {body}")

    return {
        "images": images,
        "provider": "zhipu",
        "model": model,
    }
