// 15-second promo choreography for the "computer" mockup.
// Injected by scripts/render_promo.py into index.html?capture; window.promoFrame(t) renders the frame at t seconds.
(() => {
  const { THREE, camera, renderer, screens, innerUIFrame, outerUIFrame, setAngle, render } = window.duo;
  const SCREEN_FPS = 30;
  const SCREEN_FRAMES = 240;
  const BASE_FOV = 26;

  const ramp = (t, a, b) => Math.min(1, Math.max(0, (t - a) / (b - a)));
  const easeInOut = x => x < .5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2;
  const window_ = (t, a, b, fade = .35) => ramp(t, a, a + fade) * (1 - ramp(t, b - fade, b));
  const hash = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

  // Page chrome: black stage, no viewer UI, starfield behind the canvas, captions above it.
  document.head.insertAdjacentHTML('beforeend', `
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Antonio:wght@400;600;700&display=block">
    <style>
      html, :root { background: #000 !important; }
      main { height: 100vh; }
      .control-dock, .github-link { display: none !important; }
      #viewport { inset: 0 !important; z-index: 1; }
      #sky { position: fixed; inset: 0; width: 100vw; height: 100vh; z-index: 0; }
      #promo { position: fixed; inset: 0; z-index: 2; pointer-events: none; font-family: 'Antonio', sans-serif; text-transform: uppercase; }
      #promo > * { position: absolute; opacity: 0; }
      .kicker { left: 0; right: 0; top: 64px; text-align: center; font-size: 30px; font-weight: 600; letter-spacing: .42em; color: #ffcc99; }
      .kicker b { color: #ff9900; font-weight: 600; }
      .lower { left: 96px; bottom: 58px; display: grid; grid-template-columns: 22px auto; column-gap: 22px; }
      .lower .rail { grid-row: 1 / 3; border-radius: 11px; background: linear-gradient(#ff9900 0 52%, #000 52% 54%, #cc99cc 54%); }
      .lower h2 { font-size: 92px; line-height: .95; font-weight: 600; letter-spacing: .05em; color: #ff9900; }
      .lower p { font-size: 32px; letter-spacing: .08em; color: #ffcc99; text-transform: none; margin-top: 6px; }
      .topline { left: 0; right: 0; top: 34px; text-align: center; font-size: 26px; font-weight: 600; letter-spacing: .3em; color: #9999ff; }
      .end { left: 0; right: 0; bottom: 64px; display: flex; flex-direction: column; align-items: center; gap: 16px; }
      .end .bars { display: flex; align-items: center; gap: 10px; height: 104px; }
      .end .bars i { display: block; height: 52px; }
      .end h1 { font-size: 112px; line-height: 104px; font-weight: 600; letter-spacing: .08em; color: #ff9900; padding: 0 12px; margin-top: -6px; }
      .end p { font-size: 30px; letter-spacing: .14em; color: #ffcc99; }
      .end p span { color: #cc99cc; }
    </style>`);
  const sky = document.createElement('canvas');
  sky.id = 'sky';
  document.body.prepend(sky);
  const overlay = document.createElement('div');
  overlay.id = 'promo';
  overlay.innerHTML = `
    <div class="kicker" id="kicker">A concept for <b>iPhone Duo</b></div>
    <div class="lower" id="lower"><div class="rail"></div><h2 id="lower-title">Computer</h2><p id="lower-sub">Talk to it. It plans, drafts and acts.</p></div>
    <div class="topline" id="topline">Live reasoning · your day · every task in motion</div>
    <div class="end" id="end">
      <div class="bars">
        <i id="bar-l" style="width:150px;background:#ff9900;border-radius:26px 0 0 26px"></i>
        <i style="width:22px;background:#ff9966"></i>
        <h1>Computer</h1>
        <i style="width:22px;background:#cc99cc"></i>
        <i id="bar-r" style="width:150px;background:#9999ff;border-radius:0 26px 26px 0"></i>
      </div>
      <p>An AI assistant for iPhone Duo <span>·</span> Concept UI</p>
    </div>`;
  document.body.append(overlay);
  const $ = id => document.getElementById(id);

  const dpr = devicePixelRatio;
  sky.width = innerWidth * dpr;
  sky.height = innerHeight * dpr;
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;

  // Screen textures come from the mockup's rendered frames, stepped exactly with the promo clock.
  const textures = {};
  for (const kind of ['inner', 'outer']) {
    const texture = new THREE.Texture();
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    textures[kind] = texture;
    const screen = screens[kind];
    screen.material.map = texture;
    screen.frame.value.copy(kind === 'inner' ? innerUIFrame : outerUIFrame);
    screen.gradient.value.set(kind === 'inner' ? .5 : 0, kind === 'inner' ? 0 : 1);
    screen.material.needsUpdate = true;
  }
  async function setScreens(t) {
    const name = String(Math.round(t * SCREEN_FPS) % SCREEN_FRAMES).padStart(4, '0');
    await Promise.all(['inner', 'outer'].map(async kind => {
      const image = new Image();
      image.src = `./assets/promo-frames/${kind}/${name}.jpg`;
      await image.decode();
      textures[kind].image = image;
      textures[kind].needsUpdate = true;
      screens[kind].pixel.value.set(1 / image.width, 1 / image.height);
    }));
  }

  // Camera path: cubic Hermite through keys (continuous velocity, eases at both ends).
  // az/pol in degrees around the target; tx is added to the fold-dependent centring offset.
  const keys = [
    { t: 0, az: -30, pol: 84, dist: 40, tx: 0, ty: .7 },
    { t: 3, az: -12, pol: 87, dist: 34, tx: 0, ty: .7 },
    { t: 6, az: 17, pol: 86, dist: 42, tx: 0, ty: -1.4 },
    { t: 9.4, az: 6, pol: 88, dist: 40, tx: 0, ty: -1.4 },
    { t: 11, az: -7, pol: 89, dist: 31.5, tx: -2.3, ty: .6 },
    { t: 12.4, az: 5, pol: 89, dist: 31.5, tx: 2.3, ty: .6 },
    { t: 13.9, az: 0, pol: 90, dist: 50, tx: 0, ty: -2.9 },
    { t: 15, az: 0, pol: 90, dist: 52, tx: 0, ty: -3 },
  ];
  function track(t, field) {
    const i = Math.min(keys.length - 2, Math.max(0, keys.findIndex(k => k.t > t) - 1));
    const a = keys[i], b = keys[i + 1];
    const slope = j => (j <= 0 || j >= keys.length - 1) ? 0
      : (keys[j + 1][field] - keys[j - 1][field]) / (keys[j + 1].t - keys[j - 1].t);
    const dt = b.t - a.t, u = Math.min(1, Math.max(0, (t - a.t) / dt));
    const u2 = u * u, u3 = u2 * u;
    return (2 * u3 - 3 * u2 + 1) * a[field] + (u3 - 2 * u2 + u) * dt * slope(i)
      + (-2 * u3 + 3 * u2) * b[field] + (u3 - u2) * dt * slope(i + 1);
  }

  // Starfield with parallax against the camera orbit, plus two slow nebula glows.
  const stars = Array.from({ length: 340 }, (_, i) => ({
    x: hash(i), y: hash(i + 500), depth: .25 + .75 * hash(i + 900), size: .5 + 1.6 * hash(i + 1300) ** 3, tw: hash(i + 1700),
  }));
  function drawSky(t, az) {
    const c = sky.getContext('2d'), w = sky.width, h = sky.height;
    c.fillStyle = '#000';
    c.fillRect(0, 0, w, h);
    for (const [x, y, r, color] of [[.18 + .01 * t, .82, .55, 'rgba(255,140,40,.10)'], [.84 - .008 * t, .16, .5, 'rgba(130,120,255,.11)']]) {
      const g = c.createRadialGradient(x * w, y * h, 0, x * w, y * h, r * w);
      g.addColorStop(0, color);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g;
      c.fillRect(0, 0, w, h);
    }
    const fade = .55 + .45 * ramp(t, 0, .8);
    for (const s of stars) {
      const x = ((s.x - az * .004 * s.depth - t * .004 * s.depth) % 1 + 1) % 1 * w;
      const y = s.y * h;
      const alpha = fade * (.35 + .65 * s.depth) * (.75 + .25 * Math.sin(t * 3 + s.tw * 40));
      c.fillStyle = `rgba(255,240,225,${alpha.toFixed(3)})`;
      c.beginPath();
      c.arc(x, y, s.size * dpr, 0, Math.PI * 2);
      c.fill();
    }
  }

  function typed(el, t, start, duration) {
    el.dataset.full ??= el.textContent;
    el.textContent = el.dataset.full.slice(0, Math.round(el.dataset.full.length * ramp(t, start, start + duration)));
  }
  function captions(t) {
    $('kicker').style.opacity = window_(t, .3, 2.8);
    $('kicker').style.letterSpacing = `${.42 + .06 * ramp(t, .3, 2.8)}em`;
    const lower = window_(t, 6.1, 9.4);
    $('lower').style.opacity = lower;
    $('lower').style.transform = `translateX(${(1 - easeInOut(ramp(t, 6.1, 6.6))) * -40}px)`;
    typed($('lower-sub'), t, 6.5, 1.3);
    $('topline').style.opacity = window_(t, 9.8, 12.3);
    const end = ramp(t, 13.6, 14.05);
    $('end').style.opacity = end;
    const grow = easeInOut(ramp(t, 13.6, 14.3));
    $('bar-l').style.width = $('bar-r').style.width = `${30 + 120 * grow}px`;
  }

  window.promoReady = document.fonts.load('600 40px Antonio');
  window.promoFrame = async t => {
    await setScreens(t);
    const fold = 180 * easeInOut(ramp(t, 3, 6));
    setAngle(fold);
    const az = THREE.MathUtils.degToRad(track(t, 'az'));
    const pol = THREE.MathUtils.degToRad(track(t, 'pol'));
    const dist = track(t, 'dist');
    // Folded, the phone sits on the fixed right half (centre x ≈ 3.95). It stays there until the
    // cover passes 90°, then re-centres; a cubic ease keeps that shift smooth.
    const open = (1 - Math.cos(THREE.MathUtils.degToRad(fold))) / 2;
    const target = new THREE.Vector3(3.95 * (1 - open ** 3) + track(t, 'tx'), track(t, 'ty'), .275454);
    camera.position.set(
      target.x + dist * Math.sin(pol) * Math.sin(az),
      target.y + dist * Math.cos(pol),
      target.z + dist * Math.sin(pol) * Math.cos(az),
    );
    camera.fov = BASE_FOV;
    camera.updateProjectionMatrix();
    camera.lookAt(target);
    drawSky(t, THREE.MathUtils.radToDeg(az));
    captions(t);
    render();
  };
})();
