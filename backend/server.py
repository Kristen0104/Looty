from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import json
import mimetypes
import os
import sys

from mock_generator import data_url, generate_png
from prompt_engine import build_prompt


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


class LootyHandler(BaseHTTPRequestHandler):
    server_version = "LootyMVP/0.1"

    def do_GET(self):
        if self.path == "/api/health":
            return _json_response(self, 200, {"ok": True, "provider": "mock"})

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
        selected_variant = int(payload.get("variant") or 0)

        meta = build_prompt(text, style=style, manual_type=asset_type, seed=seed, upgrade_text=upgrade_text, variant=selected_variant)

        variants = []
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

        response = {
            "image": variants[selected_variant]["image"],
            "variants": variants,
            "prompt": meta["prompt"],
            "assetType": meta["asset_type"],
            "element": meta["element"],
            "tier": meta["tier"],
            "provider": os.environ.get("LOOTY_IMAGE_PROVIDER", "mock"),
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
