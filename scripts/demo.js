// 60-second demo reel director for the live Computer app.
// Injected by scripts/render_demo.py into index.html?demo&app=computer. window.demo.step(t) advances the
// script to t seconds: real taps, typing and holds on the app, the camera path, the fingertip and captions.
// Page time itself is stepped by Playwright's fake clock, so every frame is exact.
(() => {
  const duo = window.duo;
  const q = sel => document.querySelector(sel);
  const ramp = (t, a, b) => Math.min(1, Math.max(0, (t - a) / (b - a)));
  const ease = x => x < .5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2;
  const fade = (t, a, b, f = .4) => ramp(t, a, a + f) * (1 - ramp(t, b - f, b));
  const audio = [];
  const cue = (t, kind) => audio.push({ t: Math.round(t * 1000) / 1000, kind });

  // ── Overlay: vignette, captions, end card, fingertip ───────────────────
  document.head.insertAdjacentHTML('beforeend', `<style>
    #demo-ui { position: fixed; inset: 0; z-index: 50; pointer-events: none; font-family: 'Antonio', 'Arial Narrow', sans-serif; text-transform: uppercase; }
    #demo-ui .glow { position: absolute; inset: 0; background:
      radial-gradient(60% 55% at 12% 88%, rgba(255,140,40,.10), transparent 70%),
      radial-gradient(50% 50% at 90% 10%, rgba(130,120,255,.10), transparent 70%),
      radial-gradient(120% 90% at 50% 50%, transparent 55%, rgba(0,0,0,.55)); }
    .cap-side { position: absolute; left: 120px; top: 50%; width: 700px; transform: translateY(-50%); display: grid; grid-template-columns: 18px 1fr; column-gap: 26px; opacity: 0; }
    .cap-side .rail { grid-row: 1 / 3; border-radius: 9px; background: linear-gradient(#ff9900 0 58%, #000 58% 60.5%, #cc99cc 60.5%); }
    .cap-side h1 { font-size: 64px; line-height: 1; font-weight: 600; letter-spacing: .04em; color: #ff9900; margin: 0; }
    .cap-side.big h1 { font-size: 132px; letter-spacing: .08em; }
    .cap-side p { font-size: 34px; line-height: 1.2; letter-spacing: .05em; color: #ffcc99; text-transform: none; margin: 14px 0 0; }
    .cap-bottom { position: absolute; left: 0; right: 0; bottom: 34px; display: flex; flex-direction: column; align-items: center; gap: 8px; opacity: 0; }
    .cap-bottom .row { display: flex; align-items: center; gap: 14px; }
    .cap-bottom .row i { display: block; height: 18px; width: 70px; border-radius: 9px; }
    .cap-bottom h2 { font-size: 46px; line-height: 1; font-weight: 600; letter-spacing: .06em; color: #ff9900; margin: 0; }
    .cap-bottom p { font-size: 27px; letter-spacing: .05em; color: #ffcc99; text-transform: none; margin: 0; }
    .end { position: absolute; left: 120px; top: 50%; transform: translateY(-50%); width: 820px; opacity: 0; }
    .end .bars { display: flex; align-items: center; gap: 12px; margin-bottom: 18px; }
    .end .bars i { display: block; height: 30px; border-radius: 15px 0 0 15px; }
    .end h1 { font-size: 150px; line-height: .95; font-weight: 600; letter-spacing: .08em; color: #ff9900; margin: 0; }
    .end p { font-size: 31px; letter-spacing: .08em; white-space: nowrap; color: #ffcc99; margin: 18px 0 0; }
    .end p span { color: #cc99cc; }
    .finger { position: absolute; left: 0; top: 0; width: 0; height: 0; }
    .finger .dot { position: absolute; left: -22px; top: -22px; width: 44px; height: 44px; border-radius: 50%; background: rgba(255,255,255,.55); box-shadow: 0 0 0 2px rgba(255,255,255,.85), 0 6px 18px rgba(0,0,0,.4); }
    .finger .ring { position: absolute; left: -22px; top: -22px; width: 44px; height: 44px; border-radius: 50%; border: 3px solid #ffcc99; }
    .finger .prog { position: absolute; left: -31px; top: -31px; width: 62px; height: 62px; border-radius: 50%; }
  </style>`);
  const ui = document.createElement('div');
  ui.id = 'demo-ui';
  ui.innerHTML = `
    <div class="glow"></div>
    <div class="cap-side"><div class="rail"></div><h1></h1><p></p></div>
    <div class="cap-bottom"><div class="row"><i style="background:#ff9900"></i><h2></h2><i style="background:#cc99cc"></i></div><p></p></div>
    <div class="end"><div class="bars"><i id="eb1" style="background:#ff9900"></i><i style="width:24px;border-radius:0;background:#ff9966"></i><i id="eb2" style="border-radius:0 15px 15px 0;background:#9999ff"></i></div>
      <h1>Computer</h1><p>An AI assistant for iPhone Duo <span>·</span> Concept UI</p></div>
    <div class="finger"><div class="prog"></div><div class="ring"></div><div class="dot"></div></div>`;
  document.body.append(ui);
  const side = ui.querySelector('.cap-side');
  const bottom = ui.querySelector('.cap-bottom');
  const end = ui.querySelector('.end');
  const fingerEl = ui.querySelector('.finger');

  // ── Script ──────────────────────────────────────────────────────────
  const CAPTIONS = [
    { a: .2, b: 3.2, at: 'side', big: true, title: 'Computer', sub: 'An AI assistant for iPhone Duo' },
    { a: 3.3, b: 6.4, at: 'side', title: 'Notifications live on the edge', sub: 'Tap a tile to peek inside.' },
    { a: 6.5, b: 14.4, at: 'side', title: 'It calls you when something needs you', sub: 'Your 6:40 is delayed. Vela already found a fix.' },
    { a: 14.5, b: 19.8, at: 'side', title: 'Approve with a hold', sub: 'Exact amount, one-time card, receipt filed.' },
    { a: 21.7, b: 24.8, at: 'bottom', title: 'Unfold. It picks up where you left off', sub: 'The receipt is already in the mission log.' },
    { a: 25.0, b: 30.1, at: 'bottom', title: 'Talk to it like a person', sub: 'Anything it can\'t answer right away becomes a mission.' },
    { a: 30.3, b: 35.5, at: 'bottom', title: 'A crew of specialists', sub: 'Each works on its own computer. Watch, and step in when they ask.' },
    { a: 35.7, b: 41.8, at: 'bottom', title: 'Your agent negotiates with theirs', sub: 'Priya\'s agent and yours settle on Thursday, 14:30.' },
    { a: 42.0, b: 45.4, at: 'bottom', title: 'You decide what it does alone', sub: 'Auto, ask first, or never. Area by area.' },
    { a: 45.7, b: 50.4, at: 'bottom', title: 'When it matters, it doesn\'t wait', sub: 'A charge you didn\'t make. Frozen in one tap.' },
  ];
  const END = { a: 52.8, b: 61 };

  const events = [];
  const tasks = [];
  const at = (t, fn) => events.push({ t, fn });
  const finger = { x: -100, y: -100, t: -99, hold: 0 };

  function tap(t, sel, hold = 0) {
    let el;
    at(t, () => {
      el = q(sel);
      if (!el) { console.warn('demo: missing', sel); return; }
      const r = el.getBoundingClientRect();
      Object.assign(finger, { x: r.left + r.width / 2, y: r.top + r.height / 2, t, hold });
    });
    if (!hold) {
      at(t + .15, () => { if (!el) return; el.focus?.(); el.click(); });
      cue(t + .15, 'chirp');
      return;
    }
    at(t + .15, () => el?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1 })));
    at(t + .15 + hold, () => el?.closest('.cx')?.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 1 })));
    cue(t + .15, 'chirp');
  }
  function type(a, b, sel, text) {
    tasks.push({ a, b, fn: p => { const input = q(sel); if (input) input.value = text.slice(0, Math.round(text.length * p)); } });
    for (let i = 1; i <= text.length; i++) if (text[i - 1] !== ' ') cue(a + (b - a) * i / text.length, 'tick');
  }
  const app = () => duo.live.app;

  cue(.35, 'boot');
  tap(3.4, '.cx-outer [data-act="peek"][data-arg="ana"]');
  tap(5.9, '.cx-outer [data-act="closePeek"]');
  at(6.6, () => app().trigger('hail'));
  cue(6.6, 'ring'); cue(8.3, 'ring');
  tap(9.2, '.cx-outer [data-act="acceptHail"]');
  tap(14.6, '.cx-outer [data-act="authorize"][data-arg="M-112:cover"]');
  tap(16.3, '.cx-outer [data-hold]', 1.6);
  cue(17.88, 'confirm');
  tap(19.8, '.cx-outer [data-act="unfoldTo"][data-arg="missions:M-112"]');
  cue(20.1, 'whoosh');
  tap(24.0, '.cx-inner [data-act="nav"][data-arg="bridge"]');
  tap(25.0, '#cx-command');
  type(25.4, 27.3, '#cx-command', 'Find a quiet dinner spot for Friday at 7');
  tap(27.5, '.cx-inner .engage');
  tap(30.2, '.cx-inner [data-act="nav"][data-arg="crew"]');
  tap(31.2, '.cx-inner [data-act="selectCrew"][data-arg="tally"]');
  tap(34.0, '.cx-inner [data-act="approveMission"][data-arg="M-110"]');
  cue(34.2, 'confirm');
  tap(35.6, '.cx-inner [data-act="nav"][data-arg="subspace"]');
  tap(41.0, '.cx-inner [data-act="confirmPriya"]');
  cue(41.2, 'confirm');
  tap(41.9, '.cx-inner [data-act="nav"][data-arg="clearance"]');
  tap(42.8, '.cx-inner [data-act="selectArea"][data-arg="messages"]');
  tap(43.9, '.cx-inner [data-act="setLevel"][data-arg="messages:auto"]');
  at(45.6, () => app().trigger('alert'));
  cue(45.6, 'klaxon'); cue(46.9, 'klaxon'); cue(48.2, 'klaxon');
  tap(48.4, '.cx-inner [data-act="freezeCard"]');
  cue(48.6, 'confirm');
  tap(49.9, '.cx-inner [data-act="standDown"]');
  at(50.3, () => app().trigger('home'));
  at(50.6, () => duo.live.fold(false));
  cue(50.7, 'whoosh');
  cue(52.8, 'swell');
  events.sort((x, y) => x.t - y.t);

  // ── Camera: Hermite path through keys. tx is added to the fold-dependent centre. ──
  const KEYS = [
    { t: 0, az: -16, pol: 86, dist: 35, tx: -2.6, ty: .3 },
    { t: 3.2, az: -6, pol: 88.5, dist: 30, tx: -2.95, ty: 0 },
    { t: 13, az: -3, pol: 89, dist: 29.5, tx: -2.95, ty: 0 },
    { t: 19.9, az: -2, pol: 89, dist: 30, tx: -2.95, ty: 0 },
    { t: 22.4, az: 0, pol: 89, dist: 30, tx: 0, ty: -.6 },
    { t: 30, az: 2.5, pol: 89, dist: 30, tx: 0, ty: -.6 },
    { t: 35.5, az: -2, pol: 89, dist: 30, tx: 0, ty: -.6 },
    { t: 41.5, az: 1.5, pol: 89, dist: 30, tx: 0, ty: -.6 },
    { t: 50.4, az: 0, pol: 89, dist: 30, tx: 0, ty: -.6 },
    { t: 53, az: -8, pol: 87, dist: 31, tx: -2.95, ty: .1 },
    { t: 60, az: -20, pol: 86, dist: 32, tx: -2.95, ty: .1 },
  ];
  function track(t, field) {
    const i = Math.min(KEYS.length - 2, Math.max(0, KEYS.findIndex(k => k.t > t) - 1));
    const a = KEYS[i], b = KEYS[i + 1];
    const slope = j => (j <= 0 || j >= KEYS.length - 1) ? 0 : (KEYS[j + 1][field] - KEYS[j - 1][field]) / (KEYS[j + 1].t - KEYS[j - 1].t);
    const dt = b.t - a.t, u = Math.min(1, Math.max(0, (t - a.t) / dt)), u2 = u * u, u3 = u2 * u;
    return (2 * u3 - 3 * u2 + 1) * a[field] + (u3 - 2 * u2 + u) * dt * slope(i) + (-2 * u3 + 3 * u2) * b[field] + (u3 - u2) * dt * slope(i + 1);
  }
  function camera(t) {
    const open = (1 - Math.cos(duo.getAngle() * Math.PI / 180)) / 2;
    const tx = 3.95 * (1 - open ** 3) + track(t, 'tx');
    const ty = track(t, 'ty');
    const tz = .275454;
    const az = track(t, 'az') * Math.PI / 180, pol = track(t, 'pol') * Math.PI / 180, dist = track(t, 'dist');
    duo.controls.target.set(tx, ty, tz);
    duo.camera.position.set(tx + dist * Math.sin(pol) * Math.sin(az), ty + dist * Math.cos(pol), tz + dist * Math.sin(pol) * Math.cos(az));
    duo.camera.fov = 26;
    duo.camera.updateProjectionMatrix();
    duo.camera.lookAt(tx, ty, tz);
  }

  // ── Overlay drawing ─────────────────────────────────────────────────
  let sideShown = null, bottomShown = null;
  function captions(t) {
    for (const [el, where] of [[side, 'side'], [bottom, 'bottom']]) {
      const cap = CAPTIONS.find(c => c.at === where && t >= c.a && t <= c.b);
      if (cap && cap !== (where === 'side' ? sideShown : bottomShown)) {
        el.querySelector('h1, h2').textContent = cap.title;
        el.querySelector('p').textContent = cap.sub;
        el.classList.toggle('big', Boolean(cap.big));
        if (where === 'side') sideShown = cap; else bottomShown = cap;
      }
      const o = cap ? fade(t, cap.a, cap.b) : 0;
      el.style.opacity = o;
      el.style.transform = where === 'side' ? `translate(${(1 - ease(ramp(t, cap?.a ?? 0, (cap?.a ?? 0) + .5))) * -30}px, -50%)` : `translateY(${(1 - o) * 14}px)`;
    }
    const e = fade(t, END.a, END.b, .6);
    end.style.opacity = e;
    const grow = ease(ramp(t, END.a, END.a + .8));
    ui.querySelector('#eb1').style.width = `${40 + 200 * grow}px`;
    ui.querySelector('#eb2').style.width = `${20 + 120 * grow}px`;
  }
  function drawFinger(t) {
    const d = t - finger.t;
    const life = .75 + finger.hold;
    if (d < 0 || d > life) { fingerEl.style.opacity = 0; return; }
    fingerEl.style.opacity = 1;
    fingerEl.style.transform = `translate(${finger.x}px, ${finger.y}px)`;
    const press = ramp(d, 0, .15);
    const release = .15 + finger.hold;
    const dot = fingerEl.querySelector('.dot');
    dot.style.opacity = press * (1 - ramp(d, release + .1, release + .45));
    dot.style.transform = `scale(${1.35 - .35 * press})`;
    const ring = fingerEl.querySelector('.ring');
    const r = ramp(d, .15, .7);
    ring.style.opacity = d < .15 ? 0 : .9 * (1 - r);
    ring.style.transform = `scale(${.6 + 1.8 * r})`;
    const prog = fingerEl.querySelector('.prog');
    if (finger.hold && d >= .15 && d <= release + .2) {
      const p = ramp(d, .15, .15 + Math.min(finger.hold, 1.4));
      prog.style.opacity = 1;
      prog.style.background = `conic-gradient(#ff9900 ${p * 360}deg, rgba(255,255,255,.18) 0)`;
      prog.style.mask = prog.style.webkitMask = 'radial-gradient(circle, transparent 25px, #000 26px)';
    } else prog.style.opacity = 0;
  }

  let last = -1;
  window.demo = {
    audio,
    step(t) {
      for (const e of events) if (e.t > last && e.t <= t) e.fn(t);
      for (const k of tasks) if (t >= k.a && last < k.b) k.fn(ramp(t, k.a, k.b));
      last = t;
      camera(t);
      captions(t);
      drawFinger(t);
    },
  };
})();
