// Inner display: the lab. Left half = the instrument for tonight's transmission; right half = Vega's notebook.
// Anything Vega can point at carries data-pt.
import { GLYPHS, GLYPH_IDS, LESSON, lineHolds, PULSARS, DECOYS, ORIGIN, CARRIER_MHZ, BASE, CONTACT, LIGHT_YEARS } from './world.js';
import { renderNotebook } from './notebook.js';

export const esc = v => String(v ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const act = (name, arg = '') => `data-act="${name}" data-arg="${esc(arg)}"`;
export const glyph = (id, cls = '') => `<svg class="glyph ${cls}" viewBox="0 0 24 24"><path d="${GLYPHS[id]}"/></svg>`;

export const NIGHTS = [
  { n: 1, title: 'Carrier', task: 'Something narrow is sitting at the hydrogen line, sliding across the band as the Earth turns. Correct the drift until it stands still, then lock it.' },
  { n: 2, title: 'Pulses', task: 'The locked carrier is pulsing in groups. Count them, find the rule, and say what comes next.' },
  { n: 3, title: 'Arithmetic', task: 'Symbols, taught by example. Tap a symbol and pick its meaning. When every line is true, you know how they count.' },
  { n: 4, title: 'Picture', task: 'A stream of exactly 1,679 bits. It only makes sense laid out in rows. Find the row width.' },
  { n: 5, title: 'Map', task: 'Lines from one point, labeled in their numbers: pulsars timed against the fastest one. Match four lines to real pulsars.' },
  { n: 6, title: 'Reply', task: 'They sent a question in their own numbers, with symbols we have never seen. Work out what they are asking and answer.' },
];

// ── Tools ─────────────────────────────────────────────────────────────────
function carrier(state) {
  const err = Math.abs(state.drift - state.world.drift);
  const snr = Math.max(0, 1 - err / .4);
  return `
  <div class="tool">
    <div class="axis"><span>${(CARRIER_MHZ - .0004).toFixed(4)}</span><span>${CARRIER_MHZ.toFixed(4)} MHz</span><span>${(CARRIER_MHZ + .0004).toFixed(4)}</span></div>
    <canvas class="waterfall" width="404" height="440" data-waterfall data-pt="waterfall"></canvas>
    <div class="rig">
      <label class="knob" data-pt="drift"><small>Drift correction</small><input id="wh-drift" type="range" min="-60" max="60" value="${Math.round(state.drift * 100)}"><b><span data-drift>${state.drift.toFixed(2)}</span> Hz/s</b></label>
      <div class="meter" data-pt="snr"><small>SNR</small><i style="--v:${snr.toFixed(2)}" data-snr></i><b data-snr-db>${(snr * 31).toFixed(1)} dB</b></div>
      <button class="btn ${snr > .85 ? 'hot' : ''}" data-pt="lock" ${act('lock')}>${state.solved[1] ? 'Locked ✓' : 'Lock carrier'}</button>
    </div>
  </div>`;
}

const GROUPS = [2, 3, 5, 7, 11, 13];
function pulses(state) {
  return `
  <div class="tool">
    <svg class="scope" viewBox="0 0 404 216" preserveAspectRatio="none" data-scope data-pt="scope"></svg>
    <div class="groups" data-pt="groups">${state.counting ? GROUPS.map(g => `<span>${g}</span>`).join('<i>·</i>') + '<i>·</i><span class="q">?</span>' : `<button class="btn" ${act('count')}>Count pulses per burst</button>`}</div>
    <form class="answer" data-form="next" data-pt="answer">
      <label>Next group</label><input id="wh-next" name="next" inputmode="numeric" autocomplete="off" placeholder="?" value="${state.solved[2] ? 17 : ''}">
      <button class="btn">Submit</button>
    </form>
  </div>`;
}

function arithmetic(state) {
  return `
  <div class="tool lesson">
    ${LESSON.map((line, i) => {
      const holds = lineHolds(line, state.assign);
      const lead = line.kind === 'count' ? `<span class="dots">${'•'.repeat(line.dots)}</span><span class="is">→</span>` : '';
      return `<div class="eq ${holds === true ? 'ok' : holds === false ? 'bad' : ''}" data-pt="line-${i}">${lead}${line.glyphs.map(g =>
        `<button class="g ${state.pick === g ? 'pick' : ''}" data-pt="g-${g}" ${act('pick', g)}>${glyph(g)}<em>${esc(state.assign[g] ?? '')}</em></button>`).join('')}</div>`;
    }).join('')}
  </div>
  <div class="picker" data-pt="picker">${state.pick ? `<span>${glyph(state.pick, 'big')} means</span>${['0', '1', '2', '3', '4', '5', '+', '=', '×'].map(v => `<button ${act('assign', v)}>${v}</button>`).join('')}<button ${act('assign', '')}>clear</button>` : '<span class="muted">Tap any symbol above to assign a meaning.</span>'}</div>`;
}

function picture(state) {
  const w = state.width;
  return `
  <div class="tool">
    <div class="bitbox"><canvas class="bits" width="404" height="380" data-bits="${w}" data-pt="bits"></canvas></div>
    <div class="rig">
      <label class="knob" data-pt="width"><small>Bits per row</small><input id="wh-width" type="range" min="7" max="120" value="${w}"><b><span data-width>${w}</span> wide</b></label>
      <button class="btn" data-pt="factor" ${act('factor')}>${state.factored ? '23 × 73' : 'Factor 1,679'}</button>
    </div>
  </div>`;
}

export function readRay(state, i) {
  const digits = PULSARS[i].ratio.toString(BASE).split('').map(d => state.assign[`d${d}`]);
  if (digits.some(d => d === undefined || !/^[0-5]$/.test(d))) return { text: 'unreadable: finish your lexicon', value: null };
  const value = parseInt(digits.join(''), BASE);
  return { text: `${digits.join(' ')} (base 6) = ${value}`, value };
}

function mapTool(state) {
  const cx = 202, cy = 128, R = 104;
  const all = [...PULSARS, ...DECOYS].sort((a, b) => a.ms - b.ms);
  const reading = state.ray !== null ? readRay(state, state.ray) : null;
  return `
  <div class="tool">
    <svg class="pulsar-map" viewBox="0 0 404 256" data-pt="map">
      ${PULSARS.map((p, i) => {
        const a = p.angle * Math.PI / 180, x = cx + Math.cos(a) * R * p.len, y = cy + Math.sin(a) * R * p.len;
        const lx = cx + Math.cos(a) * (R * p.len + 20), ly = cy + Math.sin(a) * (R * p.len + 20);
        const label = p.ratio.toString(BASE).split('').map(d => `d${d}`);
        return `<g class="ray ${state.matches[i] !== undefined ? 'done' : ''} ${state.ray === i ? 'sel' : ''}" data-pt="ray-${i}" ${act('ray', i)}>
          <line x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}"/>
          <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4"/>
          <foreignObject x="${(lx - label.length * 9).toFixed(1)}" y="${(ly - 10).toFixed(1)}" width="${label.length * 18}" height="20"><div class="lbl">${label.map(g => glyph(g)).join('')}</div></foreignObject>
        </g>`;
      }).join('')}
      <circle class="home" cx="${cx}" cy="${cy}" r="6"/>
    </svg>
    <p class="reading">${reading ? `Line reads <b>${esc(reading.text)}</b>` : 'Tap a line, then the pulsar it points to.'}</p>
    <div class="catalog" data-pt="catalog">${all.map(p => `<button class="${Object.values(state.matches).includes(p.name) ? 'done' : ''}" data-pt="cat-${esc(p.name)}" ${act('match', p.name)}><span>${esc(p.name)}</span><em>${p.ms} ms · ×${p.ratio}</em></button>`).join('')}</div>
    ${state.solved[5] ? `<div class="origin" data-pt="origin"><small>Origin</small><b>${ORIGIN.star}</b><span>${ORIGIN.type} · ${ORIGIN.where} · ${ORIGIN.distance} ly</span></div>` : ''}
  </div>`;
}

// Night 6: the conversation log is derived from how far the exchange has gone.
function contactLog(state) {
  const { stage, pending } = state.reply;
  const rows = [{ from: 'them', glyphs: CONTACT[0].ask, when: 'RX 2026·10·08' }];
  if (stage >= 1) rows.push({ from: 'us', glyphs: CONTACT[0].expect, when: 'TX 2026·10·08' }, { from: 'them', glyphs: CONTACT[0].ack, when: 'RX 2048·10·09' }, { from: 'them', glyphs: CONTACT[1].ask, when: 'RX 2048·10·09' });
  if (stage >= 2) rows.push({ from: 'us', glyphs: CONTACT[1].expect, when: 'TX 2048·10·09' }, { from: 'them', picture: true, when: 'RX 2070·10·10' });
  if (pending) rows.push({ from: 'us', glyphs: pending.glyphs, when: 'TX · in flight', pending: true });
  return rows;
}

function contact(state) {
  const rows = contactLog(state);
  const slots = state.reply.slots;
  const gloss = g => (state.assign[g] ?? '');
  return `
  <div class="tool contact">
    <div class="xhead"><span>Transmission log</span><b>Light delay ${LIGHT_YEARS} years each way</b></div>
    <div class="xlog">${rows.map((r, k) => `
      <div class="xrow ${r.from} ${r.pending ? 'pending' : ''}" data-pt="${r.pending ? 'log-pending' : `log-${k}`}">
        <small>${r.from === 'them' ? 'Ross 128' : 'Earth'}<em>${r.when}</em></small>
        ${r.picture ? `<div class="us-pic" data-pt="us"><canvas width="380" height="138" data-us></canvas><div class="cap"><span>Them · six limbs</span><span>Us · 4 limbs</span></div></div>`
          : `<div class="xg">${r.glyphs.map(g => `<span>${glyph(g)}<em>${esc(gloss(g))}</em></span>`).join('')}</div>`}
        ${r.pending ? `<div class="flight"><i data-flight="${state.reply.pending.t}"></i><b>${LIGHT_YEARS} ly · arrives Oct 2037</b></div>` : ''}
      </div>`).join('')}
    </div>
    ${state.reply.stage < 2 ? `
    <div class="composer" data-pt="composer">
      <div class="slots">${[0, 1, 2, 3].map(i => `<span class="${slots[i] ? 'full' : ''}">${slots[i] ? glyph(slots[i]) : ''}</span>`).join('')}
        <button class="del" ${act('unkey')}>⌫</button><button class="btn send" ${state.reply.pending || !slots.length ? 'disabled' : act('send')}>Transmit</button></div>
      <div class="keys">${GLYPH_IDS.map(g => `<button ${act('key', g)}>${glyph(g)}<em>${esc(gloss(g))}</em></button>`).join('')}</div>
    </div>` : ''}
  </div>`;
}

const TOOLS = { 1: carrier, 2: pulses, 3: arithmetic, 4: picture, 5: mapTool, 6: contact };

export function renderLab(state, now) {
  return `
  <section class="panel data">
    <header><b>Waterhole</b><span>RX-1 · ${CARRIER_MHZ.toFixed(4)} MHz · ${state.world.ra}</span></header>
    <nav class="tabs">${NIGHTS.map(n => `<button class="${state.tab === n.n ? 'on' : ''} ${state.solved[n.n] ? 'solved' : ''}" ${n.n <= state.night ? act('tab', n.n) : 'disabled'}><small>Night ${n.n}</small>${n.n <= state.night ? n.title : '· · ·'}</button>`).join('')}</nav>
    ${TOOLS[state.tab](state)}
  </section>
  ${renderNotebook(state, NIGHTS[state.tab - 1], now)}
  ${state.toast?.screen === 'inner' ? `<div class="toast">${esc(state.toast.text)}</div>` : ''}`;
}
