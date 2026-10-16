"""Epoch time-travel jobs: photo + place + year → historically grounded brief → transformed photo.

Runs inside scripts/serve.py. The OpenAI key is read from the macOS Keychain and never reaches the browser.
  POST /api/epoch            {image: dataURL, year, lat?, lon?, place?} → {id}
  GET  /api/epoch/<id>       → {status: research|render|done|error, ...}
  GET  /api/epoch            → recent finished trips
"""

import base64
import hashlib
import json
import subprocess
import threading
import time
import urllib.parse
import urllib.request
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TRIPS = ROOT / "apps" / "epoch" / "trips"
KEYCHAIN = ("com.chrisdimarco.cabinet.api-keys", "openai")
BRIEF_MODEL = "gpt-5.5"
IMAGE_MODEL = "gpt-image-2"
SIZE = "1600x1120"  # matches the inner display's 1.42 aspect
JOBS = {}
LOCK = threading.Lock()


def api_key():
    return subprocess.check_output(["security", "find-generic-password", "-s", KEYCHAIN[0], "-a", KEYCHAIN[1], "-w"], text=True).strip()


def post_json(url, payload, timeout=300):
    req = urllib.request.Request(url, data=json.dumps(payload).encode(), method="POST",
                                 headers={"Authorization": f"Bearer {api_key()}", "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.load(resp)


def reverse_geocode(lat, lon):
    url = "https://nominatim.openstreetmap.org/reverse?" + urllib.parse.urlencode({"lat": lat, "lon": lon, "format": "jsonv2", "zoom": 17})
    req = urllib.request.Request(url, headers={"User-Agent": "duo-studio-epoch/1.0 (local prototype)"})
    with urllib.request.urlopen(req, timeout=15) as resp:
        data = json.load(resp)
    a = data.get("address", {})
    parts = [a.get("road"), a.get("neighbourhood") or a.get("suburb"), a.get("city") or a.get("town") or a.get("village"), a.get("state"), a.get("country")]
    return ", ".join(p for p in parts if p) or data.get("display_name", "")


BRIEF_PROMPT = """You are a meticulous historical reconstruction researcher and photo art director.
The attached photo was taken TODAY (2026) at: {place}{coords}.
We will transform this exact photo to show the same spot in the year {year}.

Study the photo, then reply with JSON only:
{{
  "scene": "one sentence: camera position, framing, and the fixed geography to keep (terrain, coastline, hills, street layout, river, landmarks)",
  "brief": "5-8 concrete sentences describing exactly what stood at THIS place in {year}: buildings and architecture, ground surface and roads, transport and vehicles, people and clothing, signage and language, plants and landscape, weather and light. Be specific to this location and year (name real streets, styles, industries, events of that moment where known). If the city did not exist yet, describe the real landscape and the people who actually lived there then. If {year} is in the future, extrapolate plausibly from this place's real trends (climate, transit, architecture), not generic sci-fi.",
  "notes": ["4 short lines, max 9 words each, naming the most striking specific differences"],
  "photo_style": "the period-appropriate photographic look, e.g. 'wet-plate collodion, sepia, soft focus' or 'faded 1950s Kodachrome slide'; for years before photography existed say 'photorealistic, as if a modern camera had been there'"
}}"""


def brief(image_url, place, coords, year):
    text = BRIEF_PROMPT.format(place=place or "an unknown location", coords=coords, year=year)
    payload = {
        "model": BRIEF_MODEL,
        "reasoning": {"effort": "low"},
        "text": {"format": {"type": "json_object"}},
        "input": [{"role": "user", "content": [{"type": "input_text", "text": text}, {"type": "input_image", "image_url": image_url}]}],
    }
    data = post_json("https://api.openai.com/v1/responses", payload)
    out = data.get("output_text") or "".join(
        c.get("text", "") for item in data.get("output", []) if item.get("type") == "message" for c in item.get("content", []))
    return json.loads(out)


def render(image_bytes, prompt):
    boundary = uuid.uuid4().hex
    fields = [("model", IMAGE_MODEL), ("prompt", prompt), ("size", SIZE), ("quality", "high"), ("output_format", "jpeg"), ("n", "1")]
    body = bytearray()
    for name, value in fields:
        body += f"--{boundary}\r\nContent-Disposition: form-data; name=\"{name}\"\r\n\r\n{value}\r\n".encode()
    body += f"--{boundary}\r\nContent-Disposition: form-data; name=\"image[]\"; filename=\"now.jpg\"\r\nContent-Type: image/jpeg\r\n\r\n".encode()
    body += image_bytes + b"\r\n" + f"--{boundary}--\r\n".encode()
    req = urllib.request.Request("https://api.openai.com/v1/images/edits", data=bytes(body), method="POST",
                                 headers={"Authorization": f"Bearer {api_key()}", "Content-Type": f"multipart/form-data; boundary={boundary}"})
    with urllib.request.urlopen(req, timeout=600) as resp:
        data = json.load(resp)
    return base64.b64decode(data["data"][0]["b64_json"])


def image_prompt(info, place, year):
    return (f"Transform this exact photograph to show {place or 'this place'} in the year {year}. "
            f"Keep the identical camera position, lens, framing, horizon line, terrain and street geometry so it is unmistakably the same spot: {info['scene']} "
            f"{info['brief']} Render it as a real photograph: {info['photo_style']}. "
            "Historically accurate details only. No text overlays, captions, borders or watermarks.")


def run_job(job_id, image_bytes, image_url, year, lat, lon, place):
    job = JOBS[job_id]
    try:
        if not place and lat is not None and lon is not None:
            place = reverse_geocode(lat, lon)
        job.update(status="research", place=place)
        coords = f" (lat {lat:.4f}, lon {lon:.4f})" if lat is not None and lon is not None else ""
        info = brief(image_url, place, coords, year)
        job.update(status="render", notes=info.get("notes", [])[:4], brief=info.get("brief", ""))
        result = render(image_bytes, image_prompt(info, place, year))
        TRIPS.mkdir(parents=True, exist_ok=True)
        (TRIPS / f"{job['key']}-then.jpg").write_bytes(result)
        record = {"id": job_id, "key": job["key"], "year": year, "place": place, "notes": job["notes"], "brief": job["brief"],
                  "now": f"apps/epoch/trips/{job['key']}-now.jpg", "then": f"apps/epoch/trips/{job['key']}-then.jpg",
                  "seconds": round(time.time() - job["started"]), "at": time.time()}
        (TRIPS / f"{job['key']}.json").write_text(json.dumps(record, indent=2))
        job.update(status="done", **record)
    except Exception as err:  # surface the failure to the UI instead of hanging
        job.update(status="error", error=str(err)[:300])


def start(payload):
    image_url = payload["image"]
    image_bytes = base64.b64decode(image_url.split(",", 1)[1])
    year = int(payload["year"])
    lat, lon = payload.get("lat"), payload.get("lon")
    place = (payload.get("place") or "").strip()
    key = hashlib.sha1(image_bytes + f"{year}|{place}|{lat}|{lon}".encode()).hexdigest()[:16]
    cached = TRIPS / f"{key}.json"
    job_id = uuid.uuid4().hex[:12]
    if cached.exists():
        JOBS[job_id] = {**json.loads(cached.read_text()), "status": "done", "id": job_id, "cached": True}
        return job_id
    TRIPS.mkdir(parents=True, exist_ok=True)
    (TRIPS / f"{key}-now.jpg").write_bytes(image_bytes)
    with LOCK:
        JOBS[job_id] = {"id": job_id, "key": key, "status": "queued", "year": year, "place": place, "started": time.time()}
    threading.Thread(target=run_job, args=(job_id, image_bytes, image_url, year, lat, lon, place), daemon=True).start()
    return job_id


def status(job_id):
    job = JOBS.get(job_id)
    if not job:
        return None
    return {k: v for k, v in job.items() if k != "started"} | {"elapsed": round(time.time() - job.get("started", time.time()))}


def recent(limit=12):
    if not TRIPS.exists():
        return []
    trips = [json.loads(p.read_text()) for p in TRIPS.glob("*.json")]
    return sorted(trips, key=lambda t: t.get("at", 0), reverse=True)[:limit]
