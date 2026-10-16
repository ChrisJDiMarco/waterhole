"""Render the 60 s Waterhole trailer (1920×1080, 30 fps, synthesized score).

Needs the viewer on 127.0.0.1:8767 (python3 scripts/serve.py 8767).
Usage:
  .venv/bin/python scripts/render_waterhole_trailer.py                  # → promo/waterhole-trailer.mp4
  .venv/bin/python scripts/render_waterhole_trailer.py --stills 3,10,25 # save PNGs at those seconds
"""

import argparse
import subprocess
import tempfile
from pathlib import Path

import numpy as np
from playwright.sync_api import sync_playwright

from render_demo import FPS, SR, noise_swoosh, run, tone, write_wav

ROOT = Path(__file__).resolve().parents[1]
URL = "http://127.0.0.1:8767/?demo&app=waterhole"
SECONDS = 60
OUT = ROOT / "promo" / "waterhole-trailer.mp4"


def open_trailer(p):
    browser = p.chromium.launch(args=["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"])
    page = browser.new_page(viewport={"width": 1920, "height": 1080}, device_scale_factor=2)
    page.on("console", lambda m: m.type in ("error", "warning") and print("page:", m.text))
    page.clock.install()
    page.goto(URL)
    page.wait_for_function("window.duo && window.duo.live && window.duo.live.app", timeout=120_000)
    page.wait_for_timeout(1500)
    page.evaluate("duo.live.fold(false)")
    page.wait_for_function("duo.getAngle() === 0", timeout=20_000)
    page.evaluate("duo.live.app.trigger('newContact')")
    page.wait_for_timeout(800)
    page.add_script_tag(path=str(ROOT / "scripts" / "waterhole_trailer.js"))
    page.clock.pause_at(page.evaluate("Date.now()") + 500)
    return browser, page


# ── Score ────────────────────────────────────────────────────────────────
def boom(buf, at, gain=.32):
    i0 = int(at * SR)
    n = min(int(1.8 * SR), len(buf) - i0)
    t = np.arange(n) / SR
    freq = 30 + 50 * np.exp(-t * 9)
    buf[i0:i0 + n] += gain * np.sin(2 * np.pi * np.cumsum(freq) / SR) * np.exp(-t * 2.2)
    noise_swoosh(buf, at - .05, .35, gain=.05)


def riser(buf, at, dur, gain=.03):
    i0 = int(at * SR)
    n = min(int(dur * SR), len(buf) - i0)
    t = np.arange(n) / SR
    freq = 180 * (4 ** (t / dur))
    phase = 2 * np.pi * np.cumsum(freq) / SR
    buf[i0:i0 + n] += gain * (2 * ((phase / (2 * np.pi)) % 1) - 1) * (t / dur) ** 2


def pad(buf, at, dur, freqs, gain=.022, attack=1.2):
    i0 = int(at * SR)
    n = min(int(dur * SR), len(buf) - i0)
    t = np.arange(n) / SR
    env = np.minimum(1, t / attack) * np.minimum(1, (dur - t) / 1.5)
    for k, f in enumerate(freqs):
        detune = 1 + .0025 * (k % 2 * 2 - 1)
        buf[i0:i0 + n] += gain * env * (np.sin(2 * np.pi * f * t) + .5 * np.sin(2 * np.pi * f * detune * t))


def score(events, seconds):
    buf = np.zeros(int(seconds * SR))
    t = np.arange(len(buf)) / SR
    # Deep space drone: low fifth with a slow breathing swell, gone by the end card's tail.
    drone = .05 * np.sin(2 * np.pi * 41.2 * t) + .03 * np.sin(2 * np.pi * 61.7 * t) + .012 * np.sin(2 * np.pi * 82.4 * t + np.sin(2 * np.pi * .2 * t))
    drone *= (.7 + .3 * np.sin(2 * np.pi * .11 * t)) * np.minimum(1, t / 2) * np.minimum(1, (seconds - t) / 2)
    buf += drone
    # A heartbeat pulse under the decoding montage, quickening toward night 6.
    beat, at = [], 12.6
    while at < 53.4:
        beat.append(at)
        at += .72 if at < 41 else .5
    for b in beat:
        tone(buf, b, .18, 62, 40, gain=.11, attack=.004)
        tone(buf, b + .16, .14, 58, 40, gain=.06, attack=.004)
    for e in events:
        at, kind = e["t"], e["kind"]
        if kind == "blips":
            for k in range(6):
                tone(buf, at + k * .32, .07, 1420, gain=.035)
        elif kind == "tap":
            tone(buf, at, .05, 1900, 1500, kind="tri", gain=.03)
        elif kind == "tick":
            tone(buf, at, .012, 3200, gain=.008, attack=.001)
        elif kind == "voice":
            for k in range(10):
                tone(buf, at + k * .19, .12, 520 + (k * 173) % 380, kind="tri", gain=.012, attack=.02)
        elif kind == "whoosh":
            noise_swoosh(buf, at, 1.1, gain=.07)
        elif kind == "lock":
            tone(buf, at, .09, 880, gain=.05)
            tone(buf, at + .1, .3, 1760, gain=.045)
        elif kind == "hit":
            boom(buf, at, gain=.26)
        elif kind == "think":
            for k, f in enumerate((660, 880, 990)):
                tone(buf, at + k * .09, .25, f, gain=.02)
        elif kind == "reveal":
            pad(buf, at, 2.2, (330, 495, 660), gain=.012, attack=.3)
        elif kind == "transmit":
            riser(buf, at, 1.25, gain=.03)
            for k in range(8):
                tone(buf, at + k * .15, .06, 1420 * (1 + k * .06), gain=.025)
        elif kind == "impact":
            boom(buf, at, gain=.4)
            pad(buf, at, 4.2, (110, 165, 220, 330, 440), gain=.02, attack=.15)
        elif kind == "swell":
            pad(buf, at, seconds - at, (110, 164.8, 220, 277.2, 329.6), gain=.02, attack=1.0)
            for k in range(5):
                tone(buf, at + .3 + k * .4, .9, 1318.5 / (1 + k * .25), gain=.012, attack=.05)
    return buf / max(1e-9, np.abs(buf).max()) * .89


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--stills", help="comma-separated seconds to save as PNG instead of rendering video")
    args = parser.parse_args()
    OUT.parent.mkdir(exist_ok=True)
    count = SECONDS * FPS

    with sync_playwright() as p:
        browser, page = open_trailer(p)
        if args.stills:
            wanted = {round(float(s) * FPS): float(s) for s in args.stills.split(",")}
            run(page, max(wanted) + 1, lambda i, t: i in wanted and page.screenshot(path=str(OUT.parent / f"wh-trailer-{wanted[i]:05.2f}.png")))
            browser.close()
            return
        with tempfile.TemporaryDirectory() as tmp:
            frames = Path(tmp)
            run(page, count, lambda i, t: page.screenshot(path=str(frames / f"{i:04d}.jpg"), type="jpeg", quality=94))
            events = page.evaluate("demo.audio")
            browser.close()
            video = frames / "video.mp4"
            subprocess.run([
                "ffmpeg", "-y", "-loglevel", "error", "-framerate", str(FPS), "-i", str(frames / "%04d.jpg"),
                "-vf", "scale=1920:1080:flags=lanczos:out_color_matrix=bt709:out_range=tv,format=yuv420p",
                "-color_range", "tv", "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709",
                "-c:v", "libx264", "-profile:v", "high", "-crf", "18", "-preset", "slow", "-r", str(FPS), str(video),
            ], check=True)
            sound = frames / "sound.wav"
            write_wav(sound, score(events, SECONDS))
            subprocess.run([
                "ffmpeg", "-y", "-loglevel", "error", "-i", str(video), "-i", str(sound),
                "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", str(OUT),
            ], check=True)
    print(f"wrote {OUT}")


if __name__ == "__main__":
    main()
