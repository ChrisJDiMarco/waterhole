// Everything drawn per frame: the waterfall, the pulse scope, the bit picture, the cover sweep and meters,
// streaming text, and the night 6 drawing of us.
import { BITS, PIC_W } from './world.js';
import { streamText } from './notebook.js';

const GROUPS = [2, 3, 5, 7, 11, 13];
const PULSE_SEQ = GROUPS.flatMap(g => [...Array.from({ length: g }, () => [1, 0, 0]).flat(), ...new Array(10).fill(0)]);
const FLIGHT_MS = 2600;

function heat(v) {
  const t = Math.max(0, Math.min(1, v));
  const r = Math.round(255 * Math.max(0, (t - .55) * 2.2)), g = Math.round(40 + 215 * t ** .8), b = Math.round(60 + 120 * t - 120 * t * t);
  return `rgb(${r},${g},${Math.max(30, b)})`;
}

function plot(ctx, cells, x0, y0, size, color) {
  ctx.fillStyle = color;
  cells.forEach(([x, y]) => ctx.fillRect(x0 + x * size, y0 + y * size, size - 1, size - 1));
}

function figure(kind) {
  const set = new Map();
  const add = (x, y) => set.set(`${x},${y}`, [x, y]);
  const line = (x0, y0, x1, y1) => { const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)); for (let i = 0; i <= n; i++) add(Math.round(x0 + (x1 - x0) * i / n), Math.round(y0 + (y1 - y0) * i / n)); };
  const ring = (cx, cy, r) => { for (let a = 0; a < 48; a++) add(Math.round(cx + r * Math.cos(a / 48 * Math.PI * 2)), Math.round(cy + r * Math.sin(a / 48 * Math.PI * 2))); };
  if (kind === 'them') {
    ring(11, 12, 3);
    for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2 + Math.PI / 6; line(11 + Math.round(3 * Math.cos(a)), 12 + Math.round(3 * Math.sin(a)), 11 + Math.round(9 * Math.cos(a)), 12 + Math.round(9 * Math.sin(a))); }
  } else {
    ring(11, 3, 2); line(11, 6, 11, 15); line(11, 8, 5, 13); line(11, 8, 17, 13); line(11, 15, 7, 23); line(11, 15, 15, 23);
  }
  return [...set.values()];
}

export function makeInstruments(inner, outer, getState) {
  const rows = [];
  let lastRow = performance.now();

  function drawBits() {
    const canvas = inner.querySelector('[data-bits]');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = Number(canvas.dataset.bits), lines = Math.ceil(BITS.length / w);
    const cell = Math.max(1, Math.min(Math.floor((canvas.width - 4) / w), Math.floor((canvas.height - 4) / lines)));
    ctx.fillStyle = '#03100c';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const ox = Math.floor((canvas.width - cell * w) / 2), oy = Math.floor((canvas.height - cell * lines) / 2);
    const gap = cell > 3 ? 1 : 0;
    ctx.fillStyle = w === PIC_W ? '#9dffc8' : '#5fcf98';
    BITS.forEach((bit, i) => { if (bit) ctx.fillRect(ox + (i % w) * cell, oy + Math.floor(i / w) * cell, cell - gap, cell - gap); });
  }

  function drawUs() {
    const canvas = inner.querySelector('[data-us]');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#03100c';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    plot(ctx, figure('them'), 48, 8, 5, '#5fcf98');
    plot(ctx, figure('us'), 218, 8, 5, '#c6a8ff');
  }

  function drawWaterfall(now, state) {
    const canvas = inner.querySelector('[data-waterfall]');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const bins = 101, bw = canvas.width / bins, rowH = 3;
    const err = Math.abs(state.drift - state.world.drift);
    if (now - lastRow > 2000) lastRow = now - 2000;
    while (now - lastRow > 45) {
      lastRow += 45;
      const offset = (state.world.drift - state.drift) * (lastRow / 1000) * 7;
      const center = 50 + ((offset % 60) + 90) % 60 - 30;
      rows.unshift(Array.from({ length: bins }, (_, i) => Math.random() ** 2.2 * .55 + Math.exp(-((i - center) ** 2) / .6) * (.5 + .5 * Math.max(0, 1 - err / .4))));
      if (rows.length > canvas.height / rowH) rows.pop();
    }
    rows.forEach((row, y) => row.forEach((v, i) => { ctx.fillStyle = heat(v); ctx.fillRect(i * bw, y * rowH, bw + .5, rowH); }));
  }

  function drawScope(now) {
    const svg = inner.querySelector('[data-scope]');
    if (!svg) return;
    const shift = now / 30;
    let d = '';
    for (let x = 0; x <= 404; x++) {
      const on = PULSE_SEQ[Math.floor((x + shift) / 4) % PULSE_SEQ.length];
      const y = on ? 40 : 176 + Math.sin(x * .9 + now / 80) * 2.5 + (Math.random() - .5) * 5;
      d += `${d ? ' L' : 'M'}${x} ${y.toFixed(1)}`;
    }
    svg.innerHTML = `<path d="M0 108 H404" class="mid"/><path d="${d}" class="trace"/>`;
  }

  function drawCover(now, state) {
    const sweep = outer.querySelector('[data-sweep]');
    if (sweep) sweep.setAttribute('transform', `rotate(${(now / 20) % 360} 150 150)`);
    const talking = state.radio;
    const speaking = talking && now > (talking.phase === 'speak' ? talking.at : talking.t);
    outer.querySelectorAll('[data-bars] i').forEach((bar, i) => {
      const base = talking ? (speaking ? .55 : .2) : state.solved[1] ? .65 : .3;
      const wobble = talking ? .45 * Math.abs(Math.sin(now / 90 + i * 1.3)) * Math.abs(Math.sin(now / 230 + i * .4)) : .35 * Math.sin(now / 220 + i * .7);
      bar.style.height = `${Math.round(6 + 34 * Math.max(0, base + wobble + (Math.random() - .5) * .25))}px`;
    });
    const vu = outer.querySelector('[data-vu]');
    if (vu) vu.style.height = `${Math.round(30 + 50 * (.5 + .5 * Math.sin(now / 300)) + Math.random() * 20)}%`;
  }

  function drawStreams(now) {
    for (const root of [inner, outer]) {
      root.querySelectorAll('[data-stream]').forEach(el => {
        const t = Number(el.dataset.t);
        const text = streamText(el.dataset.stream, el.dataset.think, t, now);
        if (el.textContent !== text) el.textContent = text;
        el.classList.toggle('thinking', now < t);
      });
    }
    inner.querySelectorAll('[data-flight]').forEach(el => { el.style.width = `${Math.min(100, (now - Number(el.dataset.flight)) / FLIGHT_MS * 100)}%`; });
  }

  return {
    FLIGHT_MS,
    drawStatic() { drawBits(); drawUs(); },
    frame(now) {
      const state = getState();
      drawWaterfall(now, state);
      drawScope(now);
      drawCover(now, state);
      drawStreams(now);
    },
  };
}
