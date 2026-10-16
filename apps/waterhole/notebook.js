// Right half of the lab: Vega's notebook. The conversation, what Vega currently believes, and your notes.
import { GLYPH_IDS, EXTRA_IDS } from './world.js';
import { esc, act, glyph } from './lab.js';
import { board, chips } from './vega.js';

const MIC = '<svg viewBox="0 0 24 24"><path d="M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3zM6 11a6 6 0 0 0 12 0M12 17v4"/></svg>';

// A streaming message is fully described by its start time, so a re-render never restarts it.
export function streamText(full, think, t, now) {
  if (now < t) return `${think}…`;
  return full.slice(0, Math.floor((now - t) / 14));
}

function message(m, now) {
  if (m.from === 'you') return `<div class="msg you"><p>${esc(m.text)}</p></div>`;
  const thinking = now < m.t;
  return `<div class="msg vega"><i class="orb"></i><p class="${thinking ? 'thinking' : ''}" data-stream="${esc(m.text)}" data-think="${esc(m.think || 'thinking')}" data-t="${m.t}">${esc(streamText(m.text, m.think || 'thinking', m.t, now))}</p></div>`;
}

function vegaView(state, night, now) {
  const b = board(state);
  const thread = state.vega.filter(m => m.night === state.tab).slice(-6);
  const listening = state.listening;
  const asked = new Set(thread.filter(m => m.from === 'you').map(m => m.text));
  return `
    <p class="task">${night.task}</p>
    <div class="board" data-pt="board">
      <h4><i class="orb sm"></i>Vega's working <span>${esc(b.title)}</span></h4>
      ${b.rows.map(([label, p]) => `<div class="hyp ${p === Math.max(...b.rows.map(r => r[1])) ? 'top' : ''}"><span>${esc(label)}</span><i style="--v:${p.toFixed(3)}"></i><b>${Math.round(p * 100)}%</b></div>`).join('')}
    </div>
    <div class="thread">${thread.map(m => message(m, now)).join('') || '<p class="muted">Vega is listening with you.</p>'}</div>
    <div class="chips">${chips(state).filter(c => !asked.has(c)).map(c => `<button ${act('ask', c)}>${esc(c)}</button>`).join('')}</div>
    <form class="ask ${listening ? 'listening' : ''}" data-form="ask">
      ${listening ? `<div class="listen"><span class="wave">${'<i></i>'.repeat(14)}</span><p data-stream="${esc(listening.text)}" data-think="Listening" data-t="${listening.t}">${esc(streamText(listening.text, 'Listening', listening.t, now))}</p></div>`
        : '<input id="wh-ask" name="q" autocomplete="off" placeholder="Ask Vega anything…">'}
      <button type="button" class="mic" ${act('mic')}>${MIC}</button><button class="send" aria-label="Send">↑</button>
    </form>`;
}

function notesView(state) {
  const known = [...GLYPH_IDS, ...EXTRA_IDS].filter(id => state.assign[id] !== undefined);
  return `
    <h4>Lexicon</h4>
    ${known.length ? `<div class="lex" data-pt="lexicon">${known.map(id => `<span>${glyph(id)}<b>${esc(state.assign[id])}</b></span>`).join('')}</div>` : '<p class="muted">No symbols assigned yet.</p>'}
    <h4>Findings</h4>
    <ul class="log">${state.log.map(l => `<li><time>N${l.night}</time>${esc(l.text)}</li>`).join('') || '<li class="muted">Nothing yet. The sky is listening back.</li>'}</ul>`;
}

export function renderNotebook(state, night, now) {
  const progress = Math.round(Object.values(state.solved).filter(Boolean).length / 6 * 100);
  return `
  <section class="panel notebook">
    <header><b>Night ${night.n} · ${night.title}${state.solved[night.n] ? ' <em>✓</em>' : ''}</b>
      <nav class="seg"><button class="${state.nb === 'vega' ? 'on' : ''}" ${act('nb', 'vega')}>Vega</button><button class="${state.nb === 'notes' ? 'on' : ''}" ${act('nb', 'notes')}>Notes</button></nav></header>
    ${state.nb === 'vega' ? vegaView(state, night, now) : notesView(state)}
    <div class="progress"><small>Contact</small><i style="--v:${progress / 100}"></i><b>${progress}%</b></div>
  </section>`;
}
