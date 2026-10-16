# Waterhole

A first-contact puzzle game for the iPhone Duo foldable, played live on a 3D model of the phone in the browser. You decode an alien signal over six nights with Vega, an AI astronomer you reason with.

Folded, the cover is the RX-1 receiver: radar sweep, hydrogen-line readout and an amber INCOMING light, plus a push-to-talk strip for walkie-talkie exchanges with Vega. Unfold it to open the lab. The left half holds tonight's instrument; the right half is the notebook (task, progressive hints, lexicon, findings, decipherment percentage).

The nights:

1. De-drift a narrowband carrier on a live waterfall, then lock it.
2. Count the prime pulse bursts.
3. Assign meanings to glyphs from example arithmetic. They count in base 6.
4. Lay 1,679 bits out at 23 per row to reveal a picture.
5. Read base-6 pulsar ratios on a map, match them to real pulsars, and triangulate the origin star.
6. Reply. Compose an answer in their glyphs with an 11-year light delay.

Vega points at parts of the instruments, keeps a live hypothesis board built from your moves, offers suggested questions, and never gives answers away. Vega is scripted: everything runs offline and deterministically from `apps/waterhole/world.js` (seed 1977), with no API calls.

Built by Chris DiMarco with Claude (Claude Code / JARVIS) on 2026-10-08, inside a local "duo-studio" workspace that extends an open-source iPhone Duo fold viewer.

## Run it

You need Python 3.12 and a Chromium-based browser. The Apple 3D model and screen images are not in this repo (see below), so download them first:

```sh
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements-assets.txt
python scripts/prepare-assets.py
```

If you use the python.org build of Python and the download fails with an SSL error, run it as:

```sh
SSL_CERT_FILE=$(.venv/bin/python -c 'import certifi;print(certifi.where())') .venv/bin/python scripts/prepare-assets.py
```

Then serve the folder over HTTP (opening `index.html` as a file cannot load the model):

```sh
python3 scripts/serve.py 8767
```

Open <http://127.0.0.1:8767/?app=waterhole>.

`scripts/serve.py` is a no-cache static server, so edited ES modules reload. `python3 -m http.server 8767 --bind 127.0.0.1` also works.

## How the viewer picks the app

- `main.js` reads the `?app=<name>` query parameter once the model has loaded and calls `startLiveMode(name)`.
- `live.js` does `import('./apps/<name>/app.js')` and calls the app's `mount({ inner, outer, host })`. The two screens are real DOM placed behind the WebGL canvas with three.js `CSS3DRenderer`; the visible screen mesh punches a transparent hole so the bezel hides the DOM like glass. During a fold, both screens switch to `modern-screenshot` snapshots so the fold blur and darkening still run.
- Without the query parameter, pick **Waterhole — Interactive** from the "App mockup" dropdown under Screen UI.
- The dropdown also lists Computer, Duomatic, Salvo and Epoch. Those apps live in the original duo-studio workspace and are not in this repo, so choosing them shows an error.

Panel buttons in live mode: Fold / unfold, Ask Vega, Talk (cover), Solve tonight, Start over. "Solve tonight" and "Start over" are there for presenting. The viewer's generic Sound and Reset demo buttons also show, but Waterhole does not use them.

## Files

| Path | Purpose |
| --- | --- |
| `apps/waterhole/app.js` | Game state, nights, panel triggers |
| `apps/waterhole/world.js` | The deterministic world: signal, glyphs, lesson, pulsars, origin |
| `apps/waterhole/lab.js`, `notebook.js` | Inner-screen lab instruments and notebook |
| `apps/waterhole/cover.js` | Outer-screen receiver |
| `apps/waterhole/vega.js` | Vega, the scripted AI astronomer |
| `apps/waterhole/instruments.js` | Live gauges and readouts |
| `apps/waterhole/styles/`, `apps/waterhole/fonts/` | Styles and fonts (IBM Plex Mono, IBM Plex Sans Condensed) |
| `index.html`, `main.js`, `ui.js`, `style.css` | The iPhone Duo fold viewer |
| `live.js`, `live-halves.js` | Mount live app screens on the 3D model |
| `vendor/` | three.js r186 (with CSS3DRenderer and USDLoader), modern-screenshot, Octicons license |
| `scripts/prepare-assets.py` | Downloads and prepares the Apple model and screen images into `assets/` |
| `scripts/serve.py` | No-cache dev server. It also hosts the Epoch app's API through `epoch_api.py`, which Waterhole does not use |
| `scripts/render_waterhole_trailer.py`, `scripts/waterhole_trailer.js` | 30-second trailer renderer (Playwright + ffmpeg; imports helpers from `render_demo.py`) |
| `scripts/*` (other) | Promo and demo renderers from the duo-studio workspace; not needed to play |

## Not in this repo

- `assets/` (about 183 MB in the original workspace). The iPhone Duo model, textures and UI images belong to Apple and are excluded from the upstream project's license; `scripts/prepare-assets.py` downloads them from Apple's URLs. The rest of that folder was a render cache for promo videos.
- The rendered trailers (`promo/waterhole-trailer.mp4`, `promo/waterhole-trailer-30s.mp4`). Re-render with `.venv/bin/python scripts/render_waterhole_trailer.py`.
- `.venv/`, `__pycache__/`.

## Credits and license

- Viewer: the iPhone Duo fold preview by jadon7 (<https://github.com/jadon7/iphone-duo>), MIT, see `LICENSE` and `THIRD_PARTY_NOTICES.md`. The local clone's origin was <https://github.com/chuspeeism/iphone-duo>.
- Waterhole game code: Chris DiMarco, built with Claude.
- Fonts: IBM Plex Mono and IBM Plex Sans Condensed, SIL Open Font License.
- Apple models and imagery are not included. iPhone and Apple are trademarks of Apple Inc.

Original location: `/Users/chrisdimarco/Projects/duo-studio/apps/waterhole` (viewer files from `/Users/chrisdimarco/Projects/duo-studio/`). Backed up 2026-10-16.
