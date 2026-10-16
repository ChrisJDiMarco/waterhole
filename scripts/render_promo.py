"""Render the 15 s promo video (1920×1080, 30 fps) from the live viewer.

Needs the viewer served on 127.0.0.1:8767 and screen frames in assets/promo-frames/{inner,outer}/
(ffmpeg -i mockups/computer/inner.mp4 -q:v 1 -start_number 0 assets/promo-frames/inner/%04d.jpg).

Usage: .venv/bin/python scripts/render_promo.py [--seconds 15] [--frames N]
"""

import argparse
import subprocess
import tempfile
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
URL = "http://127.0.0.1:8767/?capture"
FPS = 30
OUT = ROOT / "promo" / "computer-promo.mp4"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--seconds", type=float, default=15)
    parser.add_argument("--frames", type=int, help="render only the first N frames (preview)")
    parser.add_argument("--stills", help="comma-separated times in seconds to save as PNG instead of video")
    args = parser.parse_args()
    OUT.parent.mkdir(exist_ok=True)

    with sync_playwright() as p:
        browser = p.chromium.launch(args=["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"])
        page = browser.new_page(viewport={"width": 1920, "height": 1080}, device_scale_factor=2)
        page.goto(URL)
        page.wait_for_function("window.duo", timeout=120_000)
        page.add_script_tag(path=str(ROOT / "scripts" / "promo.js"))
        page.evaluate("window.promoReady")

        if args.stills:
            for t in (float(s) for s in args.stills.split(",")):
                page.evaluate("t => window.promoFrame(t)", t)
                page.screenshot(path=str(OUT.parent / f"still-{t:05.2f}.png"))
            browser.close()
            return

        count = args.frames or round(args.seconds * FPS)
        with tempfile.TemporaryDirectory() as tmp:
            frames = Path(tmp)
            for i in range(count):
                page.evaluate("t => window.promoFrame(t)", i / FPS)
                page.screenshot(path=str(frames / f"{i:04d}.jpg"), type="jpeg", quality=95)
                if i % 30 == 0:
                    print(f"frame {i}/{count}", flush=True)
            browser.close()
            subprocess.run([
                "ffmpeg", "-y", "-loglevel", "error", "-framerate", str(FPS), "-i", str(frames / "%04d.jpg"),
                # Standard limited-range BT.709 so X and phones play colours as rendered.
                "-vf", "scale=1920:1080:flags=lanczos:out_color_matrix=bt709:out_range=tv,format=yuv420p",
                "-color_range", "tv", "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709",
                "-c:v", "libx264", "-profile:v", "high", "-crf", "17", "-preset", "slow",
                "-r", str(FPS), "-movflags", "+faststart", str(OUT),
            ], check=True)
    print(f"wrote {OUT}")


if __name__ == "__main__":
    main()
