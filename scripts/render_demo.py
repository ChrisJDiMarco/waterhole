"""Render the 60 s demo reel of the live Computer app (1920×1080, 30 fps, synthesized LCARS sound).

Needs the viewer on 127.0.0.1:8767 (python3 scripts/serve.py 8767).
Usage:
  .venv/bin/python scripts/render_demo.py                  # full video → promo/computer-demo.mp4
  .venv/bin/python scripts/render_demo.py --stills 4,12,30 # step the whole script, save PNGs at those seconds
"""

import argparse
import subprocess
import tempfile
import wave
from pathlib import Path

import numpy as np
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
URL = "http://127.0.0.1:8767/?demo&app=computer"
FPS = 30
SECONDS = 60
OUT = ROOT / "promo" / "computer-demo.mp4"
SR = 48000

# Pause every CSS animation/transition and advance it by exactly one frame, so CSS motion
# matches the fake clock instead of running on wall time while frames are captured.
ADVANCE = """dt => { for (const a of document.getAnimations()) {
  if (a.playState !== 'paused') a.pause();
  a.currentTime = (a.currentTime || 0) + dt; } }"""


def open_demo(p):
    browser = p.chromium.launch(args=["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"])
    page = browser.new_page(viewport={"width": 1920, "height": 1080}, device_scale_factor=2)
    page.on("console", lambda m: m.type in ("error", "warning") and print("page:", m.text))
    page.clock.install()
    page.goto(URL)
    page.wait_for_function("window.duo && window.duo.live && window.duo.live.app", timeout=120_000)
    page.wait_for_timeout(1500)
    page.evaluate("window.__fixedClock = '09:41'")
    page.evaluate("duo.live.app.trigger('quiet')")
    page.evaluate("duo.live.fold(false)")
    page.wait_for_function("duo.getAngle() === 0", timeout=20_000)
    page.wait_for_timeout(800)
    page.add_script_tag(path=str(ROOT / "scripts" / "demo.js"))
    page.clock.pause_at(page.evaluate("Date.now()") + 500)
    return browser, page


def frame_ms(i):
    return 34 if i % 3 == 2 else 33  # 33+33+34 = 100 ms per 3 frames


def run(page, count, on_frame):
    for i in range(count):
        t = i / FPS
        page.evaluate("t => demo.step(t)", t)
        page.evaluate(ADVANCE, frame_ms(i))
        page.clock.run_for(frame_ms(i))
        on_frame(i, t)
        if i % 150 == 0:
            print(f"t={t:5.1f}s", flush=True)


# ── Sound ────────────────────────────────────────────────────────────────
def tone(buf, start, dur, f0, f1=None, kind="sine", gain=.05, attack=.006):
    f1 = f1 or f0
    n = int(dur * SR)
    i0 = int(start * SR)
    if i0 >= len(buf):
        return
    n = min(n, len(buf) - i0)
    t = np.arange(n) / SR
    freq = f0 * (f1 / f0) ** (t / dur)
    phase = 2 * np.pi * np.cumsum(freq) / SR
    if kind == "saw":
        wave_ = 2 * ((phase / (2 * np.pi)) % 1) - 1
    elif kind == "tri":
        wave_ = 2 * np.abs(2 * ((phase / (2 * np.pi)) % 1) - 1) - 1
    else:
        wave_ = np.sin(phase)
    env = np.minimum(1, t / attack) * np.exp(-t / (dur / 4))
    buf[i0:i0 + n] += gain * wave_ * env


def noise_swoosh(buf, start, dur, gain=.06):
    rng = np.random.default_rng(int(start * 1000))
    n = int(dur * SR)
    i0 = int(start * SR)
    n = min(n, len(buf) - i0)
    white = rng.standard_normal(n)
    smooth = np.convolve(white, np.ones(24) / 24, mode="same")  # soft low-pass
    t = np.arange(n) / n
    env = np.sin(np.pi * t) ** 2
    buf[i0:i0 + n] += gain * smooth * env * 3


def soundtrack(events, seconds):
    buf = np.zeros(int(seconds * SR))
    t = np.arange(len(buf)) / SR
    # Ambient bridge hum, fading in and out.
    hum = .010 * np.sin(2 * np.pi * 55 * t) + .006 * np.sin(2 * np.pi * 110 * t) + .003 * np.sin(2 * np.pi * 165 * t)
    hum *= .75 + .25 * np.sin(2 * np.pi * .13 * t)
    buf += hum * np.minimum(1, t / 1.5) * np.minimum(1, (seconds - t) / 2.5)
    for k, e in enumerate(events):
        at, kind = e["t"], e["kind"]
        if kind == "chirp":
            tone(buf, at, .06, 1350 + (k * 137) % 520, kind="tri", gain=.05)
        elif kind == "tick":
            tone(buf, at, .014, 2600, gain=.012, attack=.001)
        elif kind == "boot":
            for j, f in enumerate((900, 1200, 1600)):
                tone(buf, at + j * .11, .08, f, gain=.04)
        elif kind == "ring":
            tone(buf, at, .13, 1100, 2200, gain=.06)
            tone(buf, at + .17, .13, 1100, 2200, gain=.06)
            tone(buf, at + .85, .13, 1100, 2200, gain=.05)
            tone(buf, at + 1.02, .13, 1100, 2200, gain=.05)
        elif kind == "confirm":
            tone(buf, at, .1, 880, gain=.05)
            tone(buf, at + .11, .18, 1320, gain=.05)
        elif kind == "klaxon":
            tone(buf, at, .6, 420, 960, kind="saw", gain=.035, attack=.05)
        elif kind == "whoosh":
            noise_swoosh(buf, at, .9)
        elif kind == "swell":
            for f in (220, 330, 440, 660):
                tone(buf, at, 6.5, f, gain=.018, attack=1.4)
    return buf / max(1e-9, np.abs(buf).max()) * .89


def write_wav(path, samples):
    data = (np.clip(samples, -1, 1) * 32767).astype("<i2")
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(data.tobytes())


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--stills", help="comma-separated seconds to save as PNG instead of rendering video")
    args = parser.parse_args()
    OUT.parent.mkdir(exist_ok=True)
    count = SECONDS * FPS

    with sync_playwright() as p:
        browser, page = open_demo(p)
        if args.stills:
            wanted = {round(float(s) * FPS): float(s) for s in args.stills.split(",")}
            last = max(wanted)
            run(page, last + 1, lambda i, t: i in wanted and page.screenshot(path=str(OUT.parent / f"demo-{wanted[i]:05.2f}.png")))
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
            write_wav(sound, soundtrack(events, SECONDS))
            subprocess.run([
                "ffmpeg", "-y", "-loglevel", "error", "-i", str(video), "-i", str(sound),
                "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", str(OUT),
            ], check=True)
    print(f"wrote {OUT}")


if __name__ == "__main__":
    main()
