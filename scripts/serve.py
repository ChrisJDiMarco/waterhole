"""Static dev server that disables caching, so edited ES modules always reload.
Also hosts the Epoch time-travel API (scripts/epoch_api.py) under /api/epoch.

Usage: python3 scripts/serve.py [port]   (serves the project root on 127.0.0.1)
"""

import json
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

sys.path.insert(0, str(Path(__file__).resolve().parent))
import epoch_api  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
MAX_UPLOAD = 15 * 1024 * 1024


class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def send_json(self, code, payload):
        body = json.dumps(payload).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path.rstrip("/") == "/api/epoch":
            return self.send_json(200, epoch_api.recent())
        if self.path.startswith("/api/epoch/where"):
            query = parse_qs(urlparse(self.path).query)
            try:
                return self.send_json(200, {"place": epoch_api.reverse_geocode(float(query["lat"][0]), float(query["lon"][0]))})
            except (KeyError, ValueError, OSError) as err:
                return self.send_json(400, {"error": f"Could not find that place: {err}"})
        if self.path.startswith("/api/epoch/"):
            job = epoch_api.status(self.path.rsplit("/", 1)[-1])
            return self.send_json(200, job) if job else self.send_json(404, {"error": "No such trip"})
        return super().do_GET()

    def do_POST(self):
        if self.path.rstrip("/") != "/api/epoch":
            return self.send_json(404, {"error": "Not found"})
        length = int(self.headers.get("Content-Length", 0))
        if not 0 < length <= MAX_UPLOAD:
            return self.send_json(413, {"error": "Photo missing or too large"})
        try:
            payload = json.loads(self.rfile.read(length))
            if not str(payload.get("image", "")).startswith("data:image/"):
                return self.send_json(400, {"error": "Expected a photo as a data URL"})
            year = int(payload.get("year"))
            if not 1 <= year <= 3000:
                return self.send_json(400, {"error": "Year must be between 1 and 3000"})
            return self.send_json(202, {"id": epoch_api.start(payload)})
        except (ValueError, KeyError, TypeError) as err:
            return self.send_json(400, {"error": f"Bad request: {err}"})


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8767
    server = ThreadingHTTPServer(("127.0.0.1", port), partial(NoCacheHandler, directory=str(ROOT)))
    print(f"Serving {ROOT} on http://127.0.0.1:{port}/ (no-cache, Epoch API)", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
