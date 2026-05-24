from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import json
import mimetypes
import os
import sys

from dashscope_provider import DashScopeProviderError
from dashscope_provider import generate_images as generate_dashscope_images
from mock_generator import data_url, generate_png
from openai_provider import OpenAIProviderError
from openai_provider import generate_images as generate_openai_images
from prompt_engine import build_prompt
from zhipu_provider import ZhipuProviderError
from zhipu_provider import generate_images as generate_zhipu_images


ROOT = Path(__file__).resolve().parents[1]
STATIC_TYPES = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".md": "text/markdown; charset=utf-8",
}


def _json_response(handler, status, payload):
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(body)))
    handler.end_headers()
    handler.wfile.write(body)


def _env_mock_allowed():
    return os.environ.get("LOOTY_ALLOW_MOCK", "").lower() in ("1", "true", "yes")


def _request_allows_mock(payload):
    value = payload.get("allowMock")
    return value is True or str(value).lower() in ("1", "true", "yes")


def _configured_provider():
    requested = os.environ.get("LOOTY_IMAGE_PROVIDER", "dashscope").lower()
    if requested == "dashscope" and os.environ.get("DASHSCOPE_API_KEY"):
        return "dashscope"
    if requested == "openai" and os.environ.get("OPENAI_API_KEY"):
        return "openai"
    if requested == "zhipu" and (os.environ.get("ZHIPUAI_API_KEY") or os.environ.get("ZHIPU_API_KEY")):
        return "zhipu"
    return "unconfigured"


def _safe_variant_index(value, count):
    try:
        index = int(value)
    except (TypeError, ValueError):
        index = 0
    if count <= 0:
        return 0
    return max(0, min(index, count - 1))


def _call_provider(provider, prompt, count, api_key=None, model=None):
    if provider == "openai":
        return generate_openai_images(prompt, count=count, api_key=api_key, model=model)
    if provider == "dashscope":
        return generate_dashscope_images(prompt, count=count, api_key=api_key, model=model)
    if provider == "zhipu":
        return generate_zhipu_images(prompt, count=count, api_key=api_key, model=model)
    raise OpenAIProviderError(f"Unsupported image provider: {provider}")


class LootyHandler(BaseHTTPRequestHandler):
    server_version = "LootyMVP/0.4"

    def do_GET(self):
        if self.path == "/api/health":
            return _json_response(
                self,
                200,
                {
                    "ok": True,
                    "provider": _configured_provider(),
                    "configuredProvider": os.environ.get("LOOTY_IMAGE_PROVIDER", "dashscope").lower(),
                    "mockAllowedByEnv": _env_mock_allowed(),
                    "supportedProviders": ["zhipu", "dashscope", "openai"],
                },
            )

        path = self.path.split("?", 1)[0]
        if path == "/":
            path = "/index.html"

        file_path = (ROOT / path.lstrip("/")).resolve()
        if ROOT not in file_path.parents and file_path != ROOT:
            self.send_error(403)
            return
        if not file_path.exists() or not file_path.is_file():
            self.send_error(404)
            return

        content_type = STATIC_TYPES.get(file_path.suffix, mimetypes.guess_type(str(file_path))[0] or "application/octet-stream")
        data = file_path.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_POST(self):
        if self.path != "/api/generate":
            self.send_error(404)
            return

        length = int(self.headers.get("Content-Length", "0"))
        try:
            payload = json.loads(self.rfile.read(length).decode("utf-8") or "{}")
        except json.JSONDecodeError:
            return _json_response(self, 400, {"error": "Invalid JSON body"})

        text = payload.get("text") or "神秘装备"
        style = payload.get("style") or "vector"
        asset_type = payload.get("assetType") or "auto"
        seed = payload.get("seed") or "looty-demo"
        upgrade_text = payload.get("upgradeText") or ""
        selected_variant = payload.get("variant") or 0
        provider_name = (payload.get("provider") or os.environ.get("LOOTY_IMAGE_PROVIDER", "dashscope")).lower()
        request_api_key = payload.get("apiKey") or None
        request_model = payload.get("model") or None

        meta = build_prompt(
            text,
            style=style,
            manual_type=asset_type,
            seed=seed,
            upgrade_text=upgrade_text,
            variant=selected_variant,
        )

        variants = []
        provider = "mock"
        model = None

        try:
            ai_result = _call_provider(
                provider_name,
                meta["prompt"],
                count=3,
                api_key=request_api_key,
                model=request_model,
            )
            provider = ai_result["provider"]
            model = ai_result["model"]
            variants = [{"index": index, "image": image} for index, image in enumerate(ai_result["images"])]
        except (OpenAIProviderError, DashScopeProviderError, ZhipuProviderError) as exc:
            if not (_env_mock_allowed() and _request_allows_mock(payload)):
                return _json_response(
                    self,
                    503,
                    {
                        "error": "AI provider is not available",
                        "detail": str(exc),
                        "provider": provider_name,
                        "model": request_model,
                        "hint": (
                            "This request did not fall back to Mock. Check that the provider, model and API key are valid. "
                            "For ZhipuAI try model glm-image first, or cogView-4-250304 if your account supports it."
                        ),
                        "prompt": meta["prompt"],
                        "thinking": meta["thinking"],
                        "intent": meta["intent"],
                    },
                )

            for index in range(3):
                png = generate_png(
                    text=text,
                    asset_type=meta["asset_type"],
                    element=meta["element"],
                    style=style,
                    seed=seed,
                    tier=meta["tier"],
                    variant=index,
                    size=256,
                )
                variants.append({"index": index, "image": data_url(png)})

        chosen = _safe_variant_index(selected_variant, len(variants))
        response = {
            "image": variants[chosen]["image"],
            "variants": variants,
            "prompt": meta["prompt"],
            "negativePrompt": meta["negative_prompt"],
            "assetType": meta["asset_type"],
            "assetLabel": meta["asset_label"],
            "element": meta["element"],
            "elementLabel": meta["element_label"],
            "tier": meta["tier"],
            "styleLabel": meta["style_label"],
            "thinking": meta["thinking"],
            "intent": meta["intent"],
            "provider": provider,
            "model": model,
        }
        return _json_response(self, 200, response)

    def log_message(self, fmt, *args):
        sys.stderr.write("[Looty] " + fmt % args + "\n")


def run():
    host = os.environ.get("LOOTY_HOST", "127.0.0.1")
    port = int(os.environ.get("LOOTY_PORT", "8000"))
    server = ThreadingHTTPServer((host, port), LootyHandler)
    print(f"Looty server running at http://{host}:{port}")
    server.serve_forever()


if __name__ == "__main__":
    run()
