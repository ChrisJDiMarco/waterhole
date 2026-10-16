// Cover display: the receiver. A sweeping dish, live signal meter, an amber light when tonight's transmission
// arrives, and Vega on the walkie-talkie: she pings you, and you hold the strip's mic to talk back.
import { CARRIER_MHZ } from './world.js';
import { esc, act } from './lab.js';
import { coverLine } from './vega.js';
import { streamText } from './notebook.js';

const MIC = '<svg viewBox="0 0 24 24"><path d="M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3zM6 11a6 6 0 0 0 12 0M12 17v4"/></svg>';

function status(state) {
  const r = state.radio;
  if (r) return [r.phase === 'listen' ? 'Vega · listening' : 'Vega · speaking', 'violet talk'];
  if (state.solved[6]) return ['They drew us', 'violet'];
  if (state.incoming) return [`Incoming · night ${state.night}`, 'amber'];
  if (state.solved[5] && state.night === 5) return ['Origin found', 'violet'];
  if (state.solved[state.night]) return ['Transmission ended', 'dim'];
  return ['Receiving', 'green'];
}

function vegaLine(state, now) {
  const r = state.radio;
  if (!r) return `<div class="vega-line"><i class="orb"></i><p><b>Vega</b>${esc(coverLine(state))}</p></div>`;
  return `<div class="vega-line live"><i class="orb"></i>
    <p class="you"><b>You</b><span data-stream="${esc(r.q)}" data-think="Listening" data-t="${r.t}">${esc(streamText(r.q, 'Listening', r.t, now))}</span></p>
    ${r.phase === 'speak' ? `<p><b>Vega</b><span data-stream="${esc(r.a)}" data-think="Thinking" data-t="${r.at}">${esc(streamText(r.a, 'Thinking', r.at, now))}</span></p>` : ''}
  </div>`;
}

function button(state) {
  if (!state.solved[6] && state.solved[state.night] && !state.incoming && state.night < 6) return `<button class="go" ${act('nextNight')}>Skip to night ${state.night + 1} ›</button>`;
  return `<button class="go" ${act('openLab')}>${state.solved[6] ? 'Open the lab' : 'Open to analyze'}</button>`;
}

export function renderCover(state, now) {
  const [label, tone] = status(state);
  return `
  <div class="body">
    <div class="brand"><b>Waterhole</b><small>RX-1 · deep-space receiver</small></div>
    <div class="dish">
      <svg viewBox="0 0 300 300">
        <defs>
          <radialGradient id="whg" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#0f2a22"/><stop offset="1" stop-color="#040b09"/></radialGradient>
          <linearGradient id="whsweep" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#7cffb2" stop-opacity="0"/><stop offset="1" stop-color="#7cffb2" stop-opacity=".35"/></linearGradient>
        </defs>
        <circle cx="150" cy="150" r="146" fill="url(#whg)" stroke="#1d4a3c" stroke-width="2"/>
        ${[40, 80, 120].map(r => `<circle cx="150" cy="150" r="${r}" fill="none" stroke="#1b4637" stroke-dasharray="2 4"/>`).join('')}
        <line x1="4" y1="150" x2="296" y2="150" stroke="#163b2f"/><line x1="150" y1="4" x2="150" y2="296" stroke="#163b2f"/>
        <g data-sweep><path d="M150 150 L150 4 A146 146 0 0 1 253 47 Z" fill="url(#whsweep)"/></g>
        <circle class="blip ${state.incoming ? 'hot' : ''}" cx="212" cy="96" r="5"/>
      </svg>
      <span class="ra">${esc(state.world.ra)}</span>
    </div>
    <div class="freq"><b>${CARRIER_MHZ.toFixed(5)}</b><small>MHz · hydrogen line</small></div>
    <div class="bars ${state.radio ? 'voice' : ''}" data-bars>${'<i></i>'.repeat(24)}</div>
    <div class="status ${tone}"><i></i>${label}</div>
    ${vegaLine(state, now)}
    ${button(state)}
  </div>
  <div class="strip">
    <i class="cam"></i>
    <div class="sys"><b>21:43</b></div>
    <div class="vu"><i data-vu></i></div>
    <button class="ptt ${state.radio ? 'on' : ''}" ${act('talk')} aria-label="Talk to Vega">${MIC}</button>
    <small class="rx">Talk</small>
  </div>
  ${state.toast?.screen === 'outer' ? `<div class="toast">${esc(state.toast.text)}</div>` : ''}`;
}
