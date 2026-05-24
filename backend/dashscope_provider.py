import base64
import json
import os
import urllib.error
import urllib.request


DASHSCOPE_ENDPOINTS = {
    "cn-beijing": "https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation",
    "ap-southeast-1": "https://dashscope-intl.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation",
    "us-east-1": "https://dashscope-us.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation",
}


class DashScopeProviderError(RuntimeError):
    pass


def _download_as_data_url(url):
    request = urllib.request.Request(url, headers={"User-Agent": "LootyMVP/0.2"})
    with urllib.request.urlopen(request, timeout=180) as response:
        content_type = response.headers.get("Content-Type", "image/png").split(";", 1)[0]
        data = response.read()
    return f"data:{content_type};base64,{base64.b64encode(data).decode('ascii')}"


def _extract_image_urls(body):
    urls = []

    for choice in body.get("output", {}).get("choices", []) or []:
        content = choice.get("message", {}).get("content", []) or []
        for item in content:
            image_url = item.get("image")
            if image_url:
                urls.append(image_url)

    for result in body.get("output", {}).get("results", []) or []:
        image_url = result.get("url")
        if image_url:
            urls.append(image_url)

    return urls


def generate_images(prompt, count=1, api_key=None, model=None):
    api_key = api_key or os.environ.get("DASHSCOPE_API_KEY")
    if not api_key:
        raise DashScopeProviderError("DASHSCOPE_API_KEY is not configured")

    model = model or os.environ.get("LOOTY_IMAGE_MODEL", "wan2.6-t2i")
    region = os.environ.get("DASHSCOPE_REGION", "cn-beijing")
    endpoint = os.environ.get("DASHSCOPE_ENDPOINT") or DASHSCOPE_ENDPOINTS.get(region)
    if not endpoint:
        raise DashScopeProviderError(f"Unsupported DashScope region: {region}")

    payload = {
        "model": model,
        "input": {
            "messages": [
                {
                    "role": "user",
                    "content": [{"text": prompt}],
                }
            ]
        },
        "parameters": {
            "prompt_extend": os.environ.get("LOOTY_PROMPT_EXTEND", "true").lower() not in ("0", "false", "no"),
            "watermark": False,
            "n": max(1, min(int(count), 4)),
            "negative_prompt": (
                "人物，手持武器，背景场景，文字，水印，边框，多个物体，普通长剑替代，"
                "抽象水晶替代，徽章替代，低清晰度，畸形结构，裁切主体"
            ),
            "size": os.environ.get("LOOTY_IMAGE_SIZE", "1280*1280"),
        },
    }

    request = urllib.request.Request(
        endpoint,
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
        raise DashScopeProviderError(f"DashScope API error {exc.code}: {detail}") from exc
    except urllib.error.URLError as exc:
        raise DashScopeProviderError(f"DashScope API connection failed: {exc}") from exc

    if body.get("code") or body.get("message") and not body.get("output"):
        raise DashScopeProviderError(f"DashScope API error: {body.get('code')} {body.get('message')}")

    urls = _extract_image_urls(body)
    if not urls:
        raise DashScopeProviderError(f"DashScope API did not return image URLs: {body}")

    images = [_download_as_data_url(url) for url in urls]
    return {
        "images": images,
        "provider": "dashscope",
        "model": model,
        "region": region,
    }
