// Waterhole: first contact, decoded over six nights with Vega, an astronomer you reason with.
// Folded, the phone is a receiver and walkie-talkie; open it to the lab.
import { DRIFT, PIC_W, LESSON, lineHolds, PULSARS, DECOYS, ORIGIN, CONTACT } from './world.js';
import { renderLab, readRay } from './lab.js';
import { renderCover } from './cover.js';
import { answer, react, chips, radio } from './vega.js';
import { makeInstruments } from './instruments.js';

export const panel = [['ask', 'Ask Vega'], ['talk', 'Talk (cover)'], ['solve', 'Solve tonight'], ['newContact', 'Start over']];

const STYLE = 'styles/waterhole.css';
const THINK_MS = 900;
const CHAR_MS = 14;
const POINT_MS = 5200;

function freshState() {
  return {
    screen: 'inner', night: 1, tab: 1, incoming: true, solved: {}, log: [], toast: null, nb: 'vega',
    world: { drift: DRIFT, ra: 'RA 11h 47m · Dec +00° 48′' },
    drift: .25, counting: false, assign: {}, pick: null, width: 40, factored: false, matches: {}, ray: null,
    vega: [], listening: null, radio: null, points: null, opened: {}, said: {},
    reply: { stage: 0, slots: [], pending: null },
  };
}

export async function mount({ inner, outer, host }) {
  const link = await new Promise((resolve, reject) => {
    const el = Object.assign(document.createElement('link'), { rel: 'stylesheet', href: `${new URL(STYLE, import.meta.url)}?v=${Date.now()}` });
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('Unable to load Waterhole styles'));
    document.head.append(el);
  });
  await Promise.all([document.fonts.load('400 14px "IBM Plex Mono"'), document.fonts.load('600 14px "IBM Plex Sans Condensed"')]);
  inner.className = 'wh wh-inner';
  outer.className = 'wh wh-outer';
  const roots = [inner, outer];
  const timers = new Set();
  let state = freshState();
  const gauges = makeInstruments(inner, outer, () => state);

  // ── Rendering ───────────────────────────────────────────────────────────
  function applyPoints() {
    if (!state.points) return;
    for (const id of state.points.ids) roots.forEach(root => root.querySelectorAll(`[data-pt="${CSS.escape(id)}"]`).forEach(el => el.classList.add('pointed')));
  }
  function render() {
    const focused = document.activeElement?.id;
    const typed = Object.fromEntries([...inner.querySelectorAll('input[id]:not([type=range])')].map(el => [el.id, el.value]));
    const now = performance.now();
    inner.innerHTML = renderLab(state, now);
    outer.innerHTML = renderCover(state, now);
    for (const [id, value] of Object.entries(typed)) { const el = inner.querySelector(`#${id}`); if (el && !el.value) el.value = value; }
    if (focused) inner.querySelector(`#${focused}`)?.focus();
    gauges.drawStatic();
    applyPoints();
  }
  const update = recipe => { const next = structuredClone(state); recipe(next); state = next; render(); };
  const later = (ms, fn) => { const id = setTimeout(() => { timers.delete(id); fn(); }, ms); timers.add(id); };
  const toast = (screen, text) => {
    const key = Math.random();
    update(s => { s.toast = { screen, text, key }; });
    later(2400, () => { if (state.toast?.key === key) update(s => { s.toast = null; }); });
  };

  // ── Vega ────────────────────────────────────────────────────────────────
  function vegaSay(reply, { night = state.tab, think = 'thinking', delay = THINK_MS } = {}) {
    if (!reply) return;
    const t = performance.now() + delay;
    update(s => { s.vega.push({ night, from: 'vega', text: reply.text, think: reply.think || think, t }); });
    if (reply.points?.length) later(delay, () => update(s => { s.points = { ids: reply.points, until: performance.now() + POINT_MS }; }));
  }
  const once = (key, reply, opts) => { if (state.said[key]) return; update(s => { s.said[key] = true; }); vegaSay(reply, opts); };
  function ask(text) {
    const reply = answer(state, text);
    update(s => { s.vega.push({ night: s.tab, from: 'you', text, t: 0 }); });
    if (reply.act) actions[reply.act]();
    vegaSay(reply);
  }
  const nextChip = () => {
    const asked = new Set(state.vega.filter(m => m.night === state.tab && m.from === 'you').map(m => m.text));
    const list = chips(state);
    return list.find(c => !asked.has(c)) || list[0];
  };
  function openNight(n) {
    if (state.opened[n]) return;
    update(s => { s.opened[n] = true; });
    vegaSay(react(state, 'open', { night: n }), { night: n, think: 'reading the new transmission', delay: 1200 });
  }
  function talk() {
    if (state.radio) return;
    const { q, a } = radio(state);
    const t = performance.now() + 500;
    update(s => { s.radio = { phase: 'listen', q, a, t }; });
    later(500 + q.length * CHAR_MS + 600, () => {
      update(s => { s.radio = { ...s.radio, phase: 'speak', at: performance.now() + 700 }; });
      later(700 + a.length * CHAR_MS + 4200, () => update(s => { s.radio = null; }));
    });
  }

  const solve = (n, text) => {
    if (state.solved[n]) return;
    update(s => { s.solved[n] = true; s.log.unshift({ night: n, text }); });
    toast('inner', `Night ${n} decoded`);
    vegaSay(react(state, 'solved', { night: n }), { night: n, delay: 1100 });
  };

  // ── Actions ─────────────────────────────────────────────────────────────
  const actions = {
    tab: n => { update(s => { s.tab = Number(n); s.points = null; }); openNight(Number(n)); },
    nb: v => update(s => { s.nb = v; }),
    ask: text => ask(text || nextChip()),
    'form:ask': data => { const q = String(data.get('q') || '').trim(); if (q) ask(q); },
    mic: () => {
      if (state.listening) return;
      const text = nextChip();
      update(s => { s.nb = 'vega'; s.listening = { text, t: performance.now() + 500 }; });
      later(500 + text.length * CHAR_MS + 700, () => { update(s => { s.listening = null; }); ask(text); });
    },
    talk: () => talk(),
    openLab: () => host.fold(true),
    nextNight: () => {
      const open = host.isOpen();
      update(s => { s.night = Math.min(6, s.night + 1); s.tab = s.night; s.incoming = !open; s.points = null; });
      if (open) openNight(state.night);
    },
    lock: () => {
      if (Math.abs(state.drift - state.world.drift) > .06) return vegaSay(react(state, 'lockFail'), { delay: 500 });
      solve(1, `Narrowband carrier at the hydrogen line, drift ${state.world.drift} Hz/s. Too narrow to be natural.`);
    },
    count: () => update(s => { s.counting = true; }),
    'form:next': data => {
      const n = Number(String(data.get('next')).trim());
      if (n === 17) return solve(2, 'Bursts of 2, 3, 5, 7, 11, 13, 17 pulses: prime numbers. The sender is intelligent.');
      if (n) vegaSay(react(state, 'wrongNext', { n }), { delay: 600 });
    },
    pick: g => update(s => { s.pick = s.pick === g ? null : g; }),
    assign: v => {
      const before = new Set(LESSON.map((l, i) => (lineHolds(l, state.assign) === false ? i : -1)));
      update(s => { if (v === '') delete s.assign[s.pick]; else s.assign[s.pick] = v; });
      if (LESSON.every(line => lineHolds(line, state.assign) === true)) return solve(3, 'They count in base 6. Symbols for 0–5, plus, times and equals are known.');
      const broke = LESSON.findIndex((l, i) => lineHolds(l, state.assign) === false && !before.has(i));
      if (broke >= 0) return vegaSay(react(state, 'lineBad', { i: broke }), { delay: 600 });
      if (state.assign.d1 === '1' && state.assign.d0 === '0') once('base', react(state, 'base'));
    },
    factor: () => { update(s => { s.factored = true; }); once('factored', react(state, 'factored')); },
    ray: i => update(s => { s.ray = Number(i); }),
    match: name => {
      if (state.ray === null) return vegaSay({ text: 'Tap a line on the map first and I\'ll read it with you.', points: ['map'] }, { delay: 400 });
      const reading = readRay(state, state.ray);
      const pulsar = PULSARS[state.ray];
      if (pulsar.name !== name) {
        const picked = [...PULSARS, ...DECOYS].find(p => p.name === name);
        return vegaSay(react(state, 'matchWrong', { name, ms: picked.ms, value: reading.value ?? pulsar.ratio }), { delay: 600 });
      }
      const i = state.ray;
      update(s => { s.matches[s.ray] = name; s.ray = null; });
      if (Object.keys(state.matches).length >= 4) return solve(5, `Triangulated from ${Object.keys(state.matches).length} pulsars: ${ORIGIN.star}, ${ORIGIN.distance} light-years away. ${ORIGIN.planet}: ${ORIGIN.planetNote}.`);
      vegaSay(react(state, 'matchRight', { name, i }), { delay: 500 });
    },
    key: g => update(s => { if (s.reply.slots.length < 4) s.reply.slots.push(g); }),
    unkey: () => update(s => { s.reply.slots.pop(); }),
    send: () => {
      const { stage, slots } = state.reply;
      if (!slots.length || state.reply.pending) return;
      if (slots.join() !== CONTACT[stage].expect.join()) return vegaSay(react(state, 'replyWrong', { glyphs: slots }), { delay: 700 });
      update(s => { s.reply.pending = { glyphs: slots, t: performance.now() }; s.reply.slots = []; });
      vegaSay(react(state, 'sent'), { delay: 400 });
      later(gauges.FLIGHT_MS + 300, () => arrive(stage + 1));
    },
  };

  function arrive(stage) {
    if (stage <= state.reply.stage) return; // a skipped-ahead exchange makes late arrivals stale
    update(s => { s.reply.stage = stage; s.reply.pending = null; });
    if (stage === 1) {
      update(s => { s.assign.q = '?'; });
      vegaSay(react(state, 'ack'), { think: 'comparing with their arithmetic' });
      later(4200, () => { update(s => { s.assign.them = 'them'; s.assign.you = 'you'; }); vegaSay(react(state, 'question')); });
    }
    if (stage === 2) solve(6, 'We told them we have four limbs. Twenty-two years later they sent back a drawing of a human.');
  }

  for (const root of roots) {
    root.addEventListener('click', event => {
      const el = event.target.closest('[data-act]');
      if (el && root.contains(el) && !el.disabled) actions[el.dataset.act]?.(el.dataset.arg);
    });
    root.addEventListener('submit', event => { event.preventDefault(); actions[`form:${event.target.dataset.form}`]?.(new FormData(event.target)); });
    root.addEventListener('input', event => {
      if (event.target.id === 'wh-drift') {
        state = { ...state, drift: Number(event.target.value) / 100 };
        const snr = Math.max(0, 1 - Math.abs(state.drift - state.world.drift) / .4);
        inner.querySelector('[data-drift]').textContent = state.drift.toFixed(2);
        inner.querySelector('[data-snr]').style.setProperty('--v', snr.toFixed(2));
        inner.querySelector('[data-snr-db]').textContent = `${(snr * 31).toFixed(1)} dB`;
        inner.querySelector('[data-act="lock"]').classList.toggle('hot', snr > .85);
      }
      if (event.target.id === 'wh-width') {
        state = { ...state, width: Number(event.target.value) };
        inner.querySelector('[data-width]').textContent = state.width;
        inner.querySelector('[data-bits]').dataset.bits = state.width;
        gauges.drawStatic();
        if (state.width === PIC_W) solve(4, 'At 23 bits per row the picture resolves: counting, hydrogen, a six-limbed body, their star system, and their dish.');
      }
    });
    // Vega comments when you let go of a slider, never mid-drag.
    root.addEventListener('change', event => {
      if (event.target.id === 'wh-drift' && !state.solved[1] && Math.abs(state.drift - state.world.drift) < .06) once('near', react(state, 'near'), { delay: 500 });
      if (event.target.id === 'wh-width' && !state.solved[4] && Math.abs(state.width - PIC_W) <= 2) once('widthNear', react(state, 'widthNear'), { delay: 500 });
    });
  }

  const offScreen = host.onScreen(kind => {
    if (!kind) return;
    const opened = kind === 'inner' && state.screen === 'outer';
    update(s => { s.screen = kind; if (opened) s.incoming = false; });
    if (opened) openNight(state.night);
  });

  let raf;
  function frame(now) {
    gauges.frame(now);
    if (state.points && now > state.points.until) {
      roots.forEach(root => root.querySelectorAll('.pointed').forEach(el => el.classList.remove('pointed')));
      state = { ...state, points: null };
    }
    raf = requestAnimationFrame(frame);
  }
  render();
  if (host.isOpen()) { update(s => { s.incoming = false; }); openNight(1); }
  raf = requestAnimationFrame(frame);

  return {
    trigger(name) {
      if (name === 'newContact') {
        timers.forEach(clearTimeout);
        timers.clear();
        state = { ...freshState(), screen: state.screen, incoming: !host.isOpen() };
        render();
        if (host.isOpen()) openNight(1);
      }
      if (name === 'solve') autoSolve();
      if (name === 'ask') actions.ask();
      if (name === 'talk') { if (host.isOpen()) { host.fold(false); later(1600, talk); } else talk(); }
      return null;
    },
    run: (name, arg) => actions[name]?.(arg),
    destroy() {
      cancelAnimationFrame(raf);
      timers.forEach(clearTimeout);
      offScreen();
      link.remove();
      roots.forEach(root => { root.innerHTML = ''; root.className = ''; });
    },
  };

  // Presenter helper: solve tonight's puzzle so a demo can move through the story.
  function autoSolve() {
    const n = state.tab;
    if (n === 1) { update(s => { s.drift = s.world.drift; }); actions.lock(); }
    if (n === 2) { update(s => { s.counting = true; }); solve(2, 'Bursts of 2, 3, 5, 7, 11, 13, 17 pulses: prime numbers. The sender is intelligent.'); }
    if (n === 3) {
      update(s => { Object.assign(s.assign, { d0: '0', d1: '1', d2: '2', d3: '3', d4: '4', d5: '5', plus: '+', eq: '=', times: '×' }); });
      solve(3, 'They count in base 6. Symbols for 0–5, plus, times and equals are known.');
    }
    if (n === 4) { update(s => { s.width = PIC_W; s.factored = true; }); solve(4, 'At 23 bits per row the picture resolves: counting, hydrogen, a six-limbed body, their star system, and their dish.'); }
    if (n === 5) {
      update(s => { PULSARS.forEach((p, i) => { s.matches[i] = p.name; }); });
      solve(5, `Triangulated from 6 pulsars: ${ORIGIN.star}, ${ORIGIN.distance} light-years away. ${ORIGIN.planet}: ${ORIGIN.planetNote}.`);
    }
    if (n === 6) { update(s => { Object.assign(s.assign, { q: '?', them: 'them', you: 'you' }); }); arrive(2); }
  }
}
