"""Render mockups/<slug>/{inner,outer}.html to @3x PNGs and write mockups/index.json.

Animated mockups (window.duoAnimate) also get a seamless looping {inner,outer}.mp4,
stepped frame by frame so timing is exact regardless of capture speed.

Usage: .venv/bin/python scripts/render_mockups.py [slug ...]
"""

import json
import subprocess
import sys
import tempfile
from pathlib import Path

from playwright.sync_api import sync_playwright

MOCKUPS = Path(__file__).resolve().parents[1] / "mockups"
SCALE = 3
FPS = 30
SCREENS = {"inner": (890, 626), "outer": (431, 626)}


def mockup_dirs(only):
    dirs = sorted(d for d in MOCKUPS.iterdir() if d.is_dir() and not d.name.startswith("_"))
    return [d for d in dirs if not only or d.name in only]


def encode(frames, target):
    subprocess.run([
        "ffmpeg", "-y", "-loglevel", "error", "-framerate", str(FPS), "-i", str(frames / "%04d.jpg"),
        # H.264 needs even dimensions; pad the odd outer width by one pixel.
        "-vf", "pad=ceil(iw/2)*2:ceil(ih/2)*2,format=yuv420p",
        "-c:v", "libx264", "-crf", "18", "-preset", "slow", "-movflags", "+faststart", str(target),
    ], check=True)


def record(page, folder, kind, loop):
    with tempfile.TemporaryDirectory() as tmp:
        frames = Path(tmp)
        count = round(loop / 1000 * FPS)
        for i in range(count):
            page.evaluate("t => window.duoAnimate.frame(t)", i * 1000 / FPS)
            page.screenshot(path=str(frames / f"{i:04d}.jpg"), type="jpeg", quality=93)
        encode(frames, folder / f"{kind}.mp4")


def render(browser, folder):
    for kind, (width, height) in SCREENS.items():
        source = folder / f"{kind}.html"
        if not source.exists():
            raise SystemExit(f"{folder.name}: missing {kind}.html")
        page = browser.new_page(viewport={"width": width, "height": height}, device_scale_factor=SCALE)
        page.add_init_script("window.__duoRecording = true")
        page.goto(source.as_uri())
        page.evaluate("document.fonts.ready")
        loop = page.evaluate("window.duoAnimate ? window.duoAnimate.loop : 0")
        if loop:
            page.evaluate("window.duoAnimate.frame(window.duoAnimate.poster || 0)")
        page.screenshot(path=str(folder / f"{kind}.png"))
        if loop:
            record(page, folder, kind, loop)
        else:
            (folder / f"{kind}.mp4").unlink(missing_ok=True)
        page.close()
    print(f"rendered {folder.name}")


def write_index():
    entries = []
    for folder in mockup_dirs(None):
        if (folder / "inner.png").exists() and (folder / "outer.png").exists():
            title = folder.name.replace("-", " ").title()
            meta = folder / "meta.json"
            if meta.exists():
                title = json.loads(meta.read_text()).get("title", title)
            video = (folder / "inner.mp4").exists() and (folder / "outer.mp4").exists()
            entries.append({"slug": folder.name, "title": title, "video": video})
    (MOCKUPS / "index.json").write_text(json.dumps(entries, indent=2) + "\n")


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        for folder in mockup_dirs(set(sys.argv[1:])):
            render(browser, folder)
        browser.close()
    write_index()


if __name__ == "__main__":
    main()
