// 60-second trailer director for the live Waterhole app.
// Injected by scripts/render_waterhole_trailer.py into index.html?demo&app=waterhole. window.demo.step(t)
// advances the script to t seconds: taps and slider drags on the real app, title cards, captions, the camera.
(() => {
  const duo = window.duo;
  const q = sel => document.querySelector(sel);
  const ramp = (t, a, b) => Math.min(1, Math.max(0, (t - a) / (b - a)));
  const ease = x => x < .5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2;
  const fade = (t, a, b, f = .35) => ramp(t, a, a + f) * (1 - ramp(t, b - f, b));
  const audio = [];
  const cue = (t, kind) => audio.push({ t: Math.round(t * 1000) / 1000, kind });

  document.head.insertAdjacentHTML('beforeend', `<style>
    .wh .toast { display: none !important; }
    #demo-ui { position: fixed; inset: 0; z-index: 50; pointer-events: none; }
    #demo-ui .glow { position: absolute; inset: 0; background:
      radial-gradient(55% 55% at 10% 90%, rgba(124,255,178,.07), transparent 70%),
      radial-gradient(50% 50% at 92% 8%, rgba(198,168,255,.08), transparent 70%),
      radial-gradient(120% 90% at 50% 50%, transparent 55%, rgba(0,0,0,.6)); }
    #demo-ui .scrim { position: absolute; left: 0; right: 0; bottom: 0; height: 300px; background: linear-gradient(transparent, rgba(2,5,6,.9)); opacity: 0; }
    .cap-side { position: absolute; left: 130px; top: 50%; width: 680px; transform: translateY(-50%); opacity: 0; }
    .cap-side h1 { margin: 0; font: 600 64px/1.02 'IBM Plex Mono', monospace; letter-spacing: .02em; color: #7cffb2; text-shadow: 0 0 30px rgba(124,255,178,.35); }
    .cap-side.violet h1 { color: #c6a8ff; text-shadow: 0 0 30px rgba(198,168,255,.4); }
    .cap-side p { margin: 18px 0 0; font: 500 34px/1.25 'IBM Plex Sans Condensed', sans-serif; color: #d8efe3; }
    .cap-side small { display: block; margin-bottom: 16px; font: 600 18px/1 'IBM Plex Mono', monospace; letter-spacing: .3em; text-transform: uppercase; color: #6f8c80; }
    .cap-bottom { position: absolute; left: 0; right: 0; bottom: 44px; text-align: center; opacity: 0; }
    .cap-bottom h2 { margin: 0; font: 600 44px/1 'IBM Plex Mono', monospace; color: #7cffb2; letter-spacing: .02em; text-shadow: 0 0 24px rgba(124,255,178,.35); }
    .cap-bottom.violet h2 { color: #c6a8ff; text-shadow: 0 0 24px rgba(198,168,255,.4); }
    .cap-bottom p { margin: 12px 0 0; font: 500 28px/1.2 'IBM Plex Sans Condensed', sans-serif; color: #d8efe3; }
    .card { position: absolute; inset: 0; display: grid; place-items: center; background: #020405; opacity: 0; }
    .card h3 { margin: 0; font: 600 58px/1 'IBM Plex Mono', monospace; letter-spacing: .32em; text-transform: uppercase; color: #7cffb2; text-shadow: 0 0 34px rgba(124,255,178,.45); }
    .card h3.amber { color: #ffb547; text-shadow: 0 0 34px rgba(255,181,71,.45); }
    .card::after { content: ""; position: absolute; inset: 0; background: repeating-linear-gradient(transparent 0 3px, rgba(124,255,178,.035) 3px 4px); }
    .end { position: absolute; left: 130px; top: 50%; transform: translateY(-50%); width: 760px; opacity: 0; }
    .end h1 { margin: 0; font: 600 100px/1 'IBM Plex Mono', monospace; letter-spacing: .1em; color: #7cffb2; text-shadow: 0 0 40px rgba(124,255,178,.45); }
    .end p { margin: 24px 0 0; font: 500 38px/1.2 'IBM Plex Sans Condensed', sans-serif; color: #ece4ff; }
    .end small { display: block; margin-top: 26px; font: 600 18px/1 'IBM Plex Mono', monospace; letter-spacing: .3em; text-transform: uppercase; color: #6f8c80; }
    .end .rule { height: 3px; margin: 26px 0 0; background: linear-gradient(90deg, #7cffb2, #c6a8ff 60%, transparent); }
    .finger { position: absolute; left: 0; top: 0; width: 0; height: 0; }
    .finger .dot { position: absolute; left: -22px; top: -22px; width: 44px; height: 44px; border-radius: 50%; background: rgba(255,255,255,.5); box-shadow: 0 0 0 2px rgba(255,255,255,.85), 0 6px 18px rgba(0,0,0,.4); }
    .finger .ring { position: absolute; left: -22px; top: -22px; width: 44px; height: 44px; border-radius: 50%; border: 3px solid #c6a8ff; }
  </style>`);
  const ui = document.createElement('div');
  ui.id = 'demo-ui';
  ui.innerHTML = `
    <div class="glow"></div><div class="scrim"></div>
    <div class="cap-side"><small></small><h1></h1><p></p></div>
    <div class="cap-bottom"><h2></h2><p></p></div>
    <div class="card"><h3></h3></div>
    <div class="end"><h1>Waterhole</h1><div class="rule"></div><p>First contact, decoded with an AI at your side.</p><small>iPhone Duo · Concept</small></div>
    <div class="finger"><div class="ring"></div><div class="dot"></div></div>`;
  document.body.append(ui);
  const side = ui.querySelector('.cap-side'), bottom = ui.querySelector('.cap-bottom'), card = ui.querySelector('.card');
  const end = ui.querySelector('.end'), scrim = ui.querySelector('.scrim'), fingerEl = ui.querySelector('.finger');

  // ── Script ──────────────────────────────────────────────────────────
  const CAPTIONS = [
    { a: .4, b: 4.6, at: 'side', kicker: '21:43', title: 'Your phone picks up a signal', sub: 'Right on the hydrogen line. It isn\'t one of ours.' },
    { a: 4.8, b: 10.5, at: 'side', violet: true, kicker: 'Meet Vega', title: 'An AI on the night shift', sub: 'Talk to it from the cover. It pings you when something comes in.' },
    { a: 12.8, b: 16.2, at: 'bottom', title: 'Unfold, and it\'s the lab', sub: 'Instruments on the left. Vega\'s notebook on the right.' },
    { a: 16.4, b: 19.8, at: 'bottom', violet: true, title: 'Ask it anything', sub: 'It answers about your data, and points at what it means.' },
    { a: 20.0, b: 24.3, at: 'bottom', title: 'Decode a real signal', sub: 'Correct for the Earth\'s spin until the carrier stands still.' },
    { a: 25.8, b: 32.5, at: 'bottom', violet: true, title: 'It reasons with you', sub: 'Its beliefs update live as you work. It never hands you the answer.' },
    { a: 34.1, b: 39.9, at: 'bottom', title: '1,679 bits', sub: 'Lay them out 23 wide and they draw themselves.' },
    { a: 41.5, b: 46.7, at: 'bottom', title: 'Triangulated from real pulsars', sub: 'Ross 128. Eleven light-years away.' },
    { a: 48.3, b: 53.3, at: 'bottom', violet: true, title: 'Answer in their numbers', sub: 'Light delay: eleven years each way.' },
    { a: 53.7, b: 56.3, at: 'bottom', violet: true, title: 'They drew us.', sub: 'From one number we sent.' },
  ];
  const CARDS = [
    { a: 24.4, b: 25.5, text: 'They teach us to count' },
    { a: 32.7, b: 33.8, text: 'They send a picture' },
    { a: 40.1, b: 41.2, text: 'And a map home' },
    { a: 46.9, b: 48.0, text: 'Then they ask a question', amber: true },
  ];
  const END = { a: 58.0, b: 61 };

  const events = [];
  const tasks = [];
  const at = (t, fn) => events.push({ t, fn });
  const finger = { x: -100, y: -100, t: -99 };
  const app = () => duo.live.app;

  function tap(t, sel) {
    let el;
    at(t, () => {
      el = q(sel);
      if (!el) { console.warn('trailer: missing', sel); return; }
      const r = el.getBoundingClientRect();
      Object.assign(finger, { x: r.left + r.width / 2, y: r.top + r.height / 2, t });
    });
    // Re-query: a re-render between touch-down and release replaces the element.
    at(t + .15, () => (q(sel) || el)?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    cue(t + .15, 'tap');
  }
  function drag(a, b, sel, from, to) {
    let fingerSet = false;
    tasks.push({ a, b, fn: p => {
      const input = q(sel);
      if (!input) return;
      const value = Math.round(from + (to - from) * ease(p));
      if (Number(input.value) !== value) { input.value = value; input.dispatchEvent(new Event('input', { bubbles: true })); }
      const r = input.getBoundingClientRect();
      const frac = (value - Number(input.min)) / (Number(input.max) - Number(input.min));
      Object.assign(finger, { x: r.left + r.width * frac, y: r.top + r.height / 2, t: fingerSet ? finger.t : a });
      fingerSet = true;
    } });
    at(b + .02, () => q(sel)?.dispatchEvent(new Event('change', { bubbles: true })));
    for (let s = a; s < b; s += .12) cue(s, 'tick');
  }
  // Under a title card: finish tonight and move to the next night.
  function jump(t, setup) { at(t, () => { app().trigger('solve'); app().run('nextNight'); setup?.(); }); }

  // Cold open: closed phone, amber light, Vega's ping, then the walkie-talkie.
  cue(0, 'drone'); cue(.5, 'blips');
  tap(4.4, '.wh-outer .ptt');
  cue(5.2, 'voice');
  tap(10.6, '.wh-outer .go');
  cue(10.8, 'whoosh');
  // Night 1: read Vega, ask it something, de-drift, lock.
  tap(16.4, '.wh-inner .chips button:nth-child(2)');
  drag(19.9, 22.1, '#wh-drift', 25, -27);
  tap(22.5, '.wh-inner [data-act="lock"]');
  cue(22.65, 'lock');
  // Night 3: assign meanings, Vega's board shifts.
  cue(CARDS[0].a, 'hit');
  at(CARDS[0].a + .1, () => { app().run('nextNight'); });
  jump(CARDS[0].a + .2, () => { for (const [g, v] of [['d2', '2'], ['d3', '3'], ['plus', '+'], ['eq', '=']]) { app().run('pick', g); app().run('assign', v); } app().run('pick', ''); });
  tap(27.4, '.wh-inner .g[data-arg="d1"]');
  tap(28.0, '.wh-inner .picker [data-act="assign"][data-arg="1"]');
  tap(28.6, '.wh-inner .g[data-arg="d0"]');
  tap(29.2, '.wh-inner .picker [data-act="assign"][data-arg="0"]');
  cue(30.2, 'think');
  // Night 4: the picture.
  cue(CARDS[1].a, 'hit');
  jump(CARDS[1].a + .2);
  drag(34.8, 37.2, '#wh-width', 84, 23);
  cue(37.25, 'reveal');
  // Night 5: the last pulsar.
  cue(CARDS[2].a, 'hit');
  jump(CARDS[2].a + .2, () => { for (const i of [0, 2, 3]) { app().run('ray', String(i)); app().run('match', ['PSR B1937+21', '', 'Crab · B0531+21', 'Vela · B0833−45'][i]); } });
  tap(42.2, '.wh-inner g.ray[data-arg="5"]');
  tap(43.0, '.wh-inner .catalog [data-arg="PSR B1919+21"]');
  cue(43.25, 'reveal');
  // Night 6: transmit, then their drawing.
  cue(CARDS[3].a, 'hit');
  jump(CARDS[3].a + .2);
  tap(50.4, '.wh-inner .keys [data-arg="d1"]');
  tap(50.9, '.wh-inner .keys [data-arg="d0"]');
  tap(51.5, '.wh-inner .send');
  cue(51.7, 'transmit');
  at(53.5, () => app().trigger('solve'));
  cue(53.55, 'impact');
  at(56.3, () => duo.live.fold(false));
  cue(56.4, 'whoosh');
  cue(57.8, 'swell');
  events.sort((x, y) => x.t - y.t);

  // ── Camera: Hermite path through keys. tx is added to the fold-dependent centre. ──
  const KEYS = [
    { t: 0, az: -18, pol: 85, dist: 36, tx: -2.7, ty: .2 },
    { t: 4.4, az: -9, pol: 88, dist: 29.5, tx: -2.95, ty: 0 },
    { t: 10.6, az: -3, pol: 89, dist: 28, tx: -2.95, ty: 0 },
    { t: 12.8, az: 0, pol: 89, dist: 32, tx: 0, ty: -1.2 },
    { t: 16.2, az: 1, pol: 89, dist: 31, tx: .3, ty: -1.2 },
    { t: 17.6, az: 1.5, pol: 89, dist: 27, tx: 2.2, ty: -.9 },
    { t: 19.6, az: 1, pol: 89, dist: 27, tx: 2.4, ty: -.9 },
    { t: 21.0, az: -1, pol: 89, dist: 27, tx: -2.0, ty: -.9 },
    { t: 23.4, az: 0, pol: 89, dist: 27, tx: -.4, ty: -1.0 },
    { t: 24.4, az: 0, pol: 89, dist: 27, tx: .4, ty: -1.0 },
    { t: 25.6, az: 0, pol: 89, dist: 30, tx: 0, ty: -1.4 },
    { t: 29.4, az: 1, pol: 89, dist: 29, tx: .6, ty: -1.3 },
    { t: 31.2, az: 1.5, pol: 89, dist: 27, tx: 2.0, ty: -1.0 },
    { t: 32.7, az: 1, pol: 89, dist: 27, tx: 2.1, ty: -1.0 },
    { t: 33.9, az: 0, pol: 89, dist: 28, tx: -1.6, ty: -1.2 },
    { t: 37.5, az: -1, pol: 89, dist: 24.5, tx: -2.3, ty: -.9 },
    { t: 40.0, az: -1.5, pol: 89, dist: 24, tx: -2.2, ty: -.9 },
    { t: 41.3, az: 0, pol: 89, dist: 29, tx: -.6, ty: -1.3 },
    { t: 45.0, az: 1, pol: 89, dist: 28, tx: -.2, ty: -1.2 },
    { t: 46.8, az: 1.5, pol: 89, dist: 27.5, tx: .2, ty: -1.2 },
    { t: 48.1, az: 0, pol: 89, dist: 29, tx: 0, ty: -1.4 },
    { t: 52.0, az: -1, pol: 89, dist: 28, tx: -.6, ty: -1.4 },
    { t: 54.0, az: 0, pol: 89, dist: 24, tx: -2.0, ty: -1.8 },
    { t: 56.2, az: -1, pol: 89, dist: 24.5, tx: -1.8, ty: -1.7 },
    { t: 58.2, az: -6, pol: 87.5, dist: 29, tx: -3.35, ty: .1 },
    { t: 61, az: -14, pol: 86, dist: 31, tx: -3.35, ty: .1 },
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
    const ty = track(t, 'ty'), tz = .275454;
    const az = track(t, 'az') * Math.PI / 180, pol = track(t, 'pol') * Math.PI / 180, dist = track(t, 'dist');
    duo.controls.target.set(tx, ty, tz);
    duo.camera.position.set(tx + dist * Math.sin(pol) * Math.sin(az), ty + dist * Math.cos(pol), tz + dist * Math.sin(pol) * Math.cos(az));
    duo.camera.fov = 26;
    duo.camera.updateProjectionMatrix();
    duo.camera.lookAt(tx, ty, tz);
  }

  // ── Overlay drawing ─────────────────────────────────────────────────
  const shown = new Map();
  function captions(t) {
    for (const [el, where] of [[side, 'side'], [bottom, 'bottom']]) {
      const cap = CAPTIONS.find(c => c.at === where && t >= c.a && t <= c.b);
      if (cap && shown.get(where) !== cap) {
        el.querySelector('h1, h2').textContent = cap.title;
        el.querySelector('p').textContent = cap.sub;
        el.querySelector('small')?.replaceChildren(cap.kicker || '');
        el.classList.toggle('violet', Boolean(cap.violet));
        shown.set(where, cap);
      }
      const o = cap ? fade(t, cap.a, cap.b) : 0;
      el.style.opacity = o;
      el.style.transform = where === 'side' ? `translate(${(1 - ease(ramp(t, cap?.a ?? 0, (cap?.a ?? 0) + .5))) * -30}px, -50%)` : `translateY(${(1 - o) * 14}px)`;
      if (where === 'bottom') scrim.style.opacity = o;
    }
    const c = CARDS.find(k => t >= k.a && t <= k.b);
    card.style.opacity = c ? fade(t, c.a, c.b, .12) : 0;
    if (c) { const h = card.querySelector('h3'); h.textContent = c.text; h.classList.toggle('amber', Boolean(c.amber)); h.style.letterSpacing = `${.32 + .06 * ramp(t, c.a, c.b)}em`; }
    end.style.opacity = fade(t, END.a, END.b, .6);
    end.querySelector('.rule').style.width = `${ease(ramp(t, END.a + .2, END.a + 1.2)) * 100}%`;
  }
  function drawFinger(t) {
    const d = t - finger.t;
    const dragging = tasks.some(k => t >= k.a && t <= k.b);
    if (!dragging && (d < 0 || d > .7)) { fingerEl.style.opacity = 0; return; }
    fingerEl.style.opacity = 1;
    fingerEl.style.transform = `translate(${finger.x}px, ${finger.y}px)`;
    const dot = fingerEl.querySelector('.dot'), ring = fingerEl.querySelector('.ring');
    const press = ramp(d, 0, .15);
    dot.style.opacity = dragging ? 1 : press * (1 - ramp(d, .3, .6));
    dot.style.transform = `scale(${1.25 - .25 * press})`;
    const pop = ramp(d, .15, .6);
    ring.style.opacity = dragging ? 0 : (d > .15 ? 1 - pop : 0);
    ring.style.transform = `scale(${1 + pop * 1.4})`;
  }

  let cursor = 0;
  window.demo = {
    audio,
    step(t) {
      while (cursor < events.length && events[cursor].t <= t) events[cursor++].fn();
      for (const k of tasks) if (t >= k.a && t <= k.b + .05) k.fn(ramp(t, k.a, k.b));
      camera(t);
      captions(t);
      drawFinger(t);
    },
  };
})();
