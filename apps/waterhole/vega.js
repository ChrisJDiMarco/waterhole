// Vega: the night-shift astronomer you reason with. A scripted stand-in for a live model. Every reply reads
// the actual game state, points at things on the instruments, and never hands over an answer.
import { DRIFT, LESSON, lineHolds, PIC_W, PULSARS, ORIGIN, BASE, CONTACT, LIGHT_YEARS } from './world.js';

const clamp = v => Math.max(0, Math.min(1, v));
const say = (text, points = []) => ({ text, points });
const readGlyphs = (glyphs, assign) => glyphs.map(g => assign[g] ?? '?').join(' ');
const matched = state => Object.keys(state.matches).length;
const snrOf = state => clamp(1 - Math.abs(state.drift - DRIFT) / .4);
const stage = state => state.reply.stage;

export const THINK = {
  1: 'comparing against 4,200 known satellites',
  2: 'testing eleven sequence models',
  3: 'checking 13 lines against bases 6, 10 and 12',
  4: 'trying every factor of 1,679',
  5: 'timing against the pulsar catalogue',
  6: 'parsing with our lexicon',
};

// ── What Vega believes right now. The numbers are derived from your moves. ───
export function board(state) {
  const n = state.tab, solved = state.solved[n];
  if (n === 1) {
    const art = solved ? .94 : .15 + .55 * snrOf(state);
    return { title: 'What is the source?', rows: [['Natural emission', (1 - art) * .55], ['Our own interference', (1 - art) * .45], ['Artificial, interstellar', art]] };
  }
  if (n === 2) {
    const primes = solved ? .97 : state.counting ? .62 : .2;
    return { title: 'What is the pattern?', rows: [['Pulsar timing', (1 - primes) * .6], ['Random bursts', (1 - primes) * .4], ['Counting primes', primes]] };
  }
  if (n === 3) {
    const green = LESSON.filter(line => lineHolds(line, state.assign) === true).length;
    const rolls = state.assign.d1 === '1' && state.assign.d0 === '0';
    const six = solved ? .98 : clamp(.34 + green * .045 + (rolls ? .25 : 0));
    return { title: 'How do they count?', rows: [['Base 10', (1 - six) * .55], ['Base 6', six], ['Base 12', (1 - six) * .45]] };
  }
  if (n === 4) {
    const img = solved ? .96 : state.factored ? .55 : .2 + Math.max(0, .3 - Math.abs(state.width - PIC_W) * .02);
    return { title: 'What is the stream?', rows: [['Audio', (1 - img) * .6], ['Image, 23 × 73', img], ['Image, 73 × 23', (1 - img) * .4]] };
  }
  if (n === 5) {
    const ross = solved ? .97 : .2 + matched(state) * .17;
    return { title: 'Where was it sent from?', rows: [['Ross 128', ross], ['Wolf 359', (1 - ross) * .6], ['Gliese 1061', (1 - ross) * .4]] };
  }
  const s = stage(state);
  if (s === 0) return { title: 'What are they asking?', rows: [['An arithmetic test', .7], ['A greeting', .2], ['Our location', .1]] };
  return { title: 'What are they asking?', rows: [['Our body plan', s > 1 ? .98 : .74], ['Our population', s > 1 ? .01 : .16], ['Our distance', s > 1 ? .01 : .1]] };
}

// ── Questions you can ask, per night. Chips show the labels; typed text matches the patterns. ──
const INTENTS = {
  1: [
    { label: 'Could it be natural?', re: /natur|star|real|noise/i, reply: () => say('Natural emitters smear across thousands of hertz. This line is under one hertz wide. Nature doesn\'t make lines that clean. Transmitters do.', ['waterfall']) },
    { label: 'Why is it slanted?', re: /slant|drift|move|tilt|diagonal/i, reply: () => say('We\'re on a spinning planet. As the dish turns, the Doppler shift changes and the line walks across the band. Dial in the opposite drift and it should stand up straight.', ['drift']) },
    { label: 'What should I do?', re: /what.*do|how|help|start/i, reply: () => say('Drag the drift correction until the trace runs straight down, and watch the SNR. When it peaks, lock it.', ['drift', 'snr']) },
    { label: 'Is it a satellite?', re: /satell|plane|gps|interfer/i, reply: () => say('A satellite would drift much faster and vanish when the dish moves off target. This one stays fixed on the sky, so it\'s coming from beyond the Solar System.', ['waterfall']) },
  ],
  2: [
    { label: 'Count with me', re: /count|how many/i, act: 'count', reply: () => say('I get 2, then 3, 5, 7, 11, 13, and then it loops. What do those numbers have in common?', ['groups']) },
    { label: 'Is it a code?', re: /code|mean|message/i, reply: () => say('Not a code yet. A calling card. Try dividing each of those by anything other than 1 and itself.', ['groups']) },
    { label: 'What comes next?', re: /next|after|answer/i, reply: () => say('I won\'t say it, but here\'s how I\'d check: whatever follows 13 should only divide by 1 and itself.', ['answer']) },
  ],
  3: [
    { label: 'Where do I start?', re: /start|begin|first|where/i, reply: () => say('One dot, one symbol. Tap the symbol on the first line and tell me what it means.', ['line-0']) },
    { label: 'Why two symbols for six?', re: /six|two symbol|base/i, reply: () => say('Six dots and suddenly two symbols. That\'s where their counting rolls over, the way our 9 rolls over to 10. What base rolls over at six?', ['line-5']) },
    { label: 'What\'s the operator?', re: /operat|plus|times|equal|middle/i, reply: () => say('In the lower lines one symbol sits in the middle of each, and another just before the result. One is an operation, one means equals.', ['line-7', 'line-10']) },
    { label: 'Check my lexicon', re: /check|lexicon|right|wrong/i, reply: state => {
      const bad = LESSON.findIndex(line => lineHolds(line, state.assign) === false);
      if (bad < 0) return say(`No contradictions yet. ${LESSON.filter(l => lineHolds(l, state.assign) === true).length} of 13 lines hold.`, ['board']);
      return say(`Line ${bad + 1} breaks. With your meanings it reads ${readGlyphs(LESSON[bad].glyphs, state.assign)}, which isn't true in any base.`, [`line-${bad}`]);
    } },
  ],
  4: [
    { label: 'Why 1,679?', re: /1,?679|why|number|length/i, reply: () => say('Factor it. There are only two ways to make that rectangle, and that\'s on purpose.', ['factor']) },
    { label: 'Is it an image?', re: /image|picture|draw/i, reply: () => say('Drag the width and watch the diagonals. At the wrong width it\'s slanted noise. The slant flattens as you get close.', ['width', 'bits']) },
    { label: 'Which width?', re: /width|wide|row/i, reply: () => say('Try the smaller of the two prime factors.', ['width']) },
  ],
  5: [
    { label: 'Why pulsars?', re: /why|pulsar/i, reply: () => say('Every pulsar ticks at its own fixed rate. Send the ratios between them and anyone in the galaxy can find them, no units needed. Pioneer 10 carried the same idea.', ['map']) },
    { label: 'Read this line', re: /read|label|line|this/i, reply: state => {
      if (state.ray === null) return say('Tap a line on the map and I\'ll read its label with our lexicon.', ['map']);
      const digits = PULSARS[state.ray].ratio.toString(BASE).split('');
      const value = PULSARS[state.ray].ratio;
      return say(`That label reads ${digits.join(' ')} in base six, which is ${value}. Find a pulsar whose period is ${value} times the fastest one's.`, [`ray-${state.ray}`, 'catalog']);
    } },
    { label: 'How do we find them?', re: /find|where|triang|how/i, reply: () => say('Match four lines to real pulsars and the angles pin down where the map was drawn from.', ['catalog']) },
  ],
};
const CONTACT_INTENTS = [
  [
    { label: 'What are they asking?', re: /ask|mean|what/i, reply: () => say('Two, times, three, equals, then a symbol we\'ve never seen. I think the new one means "what?" It\'s a test.', ['log-0']) },
    { label: 'How do I answer?', re: /answer|reply|how|say/i, reply: () => say('Six. But remember how they count: six takes two symbols for them.', ['composer']) },
    { label: 'How long will it take?', re: /long|time|when|light/i, reply: () => say(`Light takes ${LIGHT_YEARS} years to reach Ross 128. A reply sent tonight arrives in 2037, and the earliest answer lands in 2048. The demo squeezes that into a few seconds.`, ['log-0']) },
  ],
  [
    { label: 'What are they asking?', re: /ask|mean|what/i, reply: () => say('The first new symbol stood beside the six-limbed figure in their picture: "us, six." The second must be "you," then the question mark. They\'re asking how many limbs we have.', ['log-2']) },
    { label: 'What should we say?', re: /say|answer|reply/i, reply: () => say('Count limbs, not fingers. In their numbers it\'s a single symbol.', ['composer']) },
    { label: 'Why six?', re: /why|six/i, reply: () => say('Six limbs, base six. Ten fingers, base ten. The math is universal. The way you count it isn\'t.', ['board']) },
  ],
];

export function chips(state) {
  if (state.tab === 6) return stage(state) < 2 ? CONTACT_INTENTS[stage(state)].map(i => i.label) : ['What happens next?'];
  return state.solved[state.tab] ? ['What did we learn?'] : INTENTS[state.tab].map(i => i.label);
}

export function answer(state, input) {
  const pool = state.tab === 6 ? CONTACT_INTENTS[Math.min(1, stage(state))] : INTENTS[state.tab];
  if (/learn|summar|next|happen/i.test(input) && (state.solved[state.tab] || stage(state) > 1)) return { ...recap(state), think: THINK[state.tab] };
  const intent = pool.find(i => i.label === input) || pool.find(i => i.re.test(input));
  const reply = intent ? intent.reply(state) : fallback(state);
  return { ...reply, act: intent?.act, think: THINK[state.tab] };
}

function fallback(state) {
  const lines = {
    1: 'Let\'s not guess yet. What does the trace do when you change the drift?',
    2: 'Look at the bursts, not the gaps. How many pulses are in the shortest one?',
    3: 'Start with what you can count. Dots are the only thing here we both understand.',
    4: 'Everything about this message is deliberate, including its length.',
    5: 'Pick one line and we\'ll read it together.',
    6: 'Read their message out loud with our lexicon first. What\'s missing?',
  };
  return say(lines[state.tab], []);
}

function recap(state) {
  const lines = {
    1: 'A carrier one hertz wide on the hydrogen line, fixed on the sky. Nothing natural does that.',
    2: 'Primes, sent on purpose. They know we\'ll recognize them.',
    3: 'They count in sixes and they taught us arithmetic by example. We can talk in numbers now.',
    4: 'A self-portrait: counting, hydrogen, a six-limbed body, their star system, and their dish.',
    5: `${ORIGIN.star}, ${ORIGIN.distance} light-years away. ${ORIGIN.planet} is where they live.`,
    6: 'They drew us from one number. Something bigger is coming in. I\'ll wake you when it starts.',
  };
  return say(lines[state.tab], state.tab === 4 ? ['bits'] : state.tab === 5 ? ['origin'] : state.tab === 6 ? ['us'] : []);
}

// ── Things Vega says without being asked. ───────────────────────────────────
export function react(state, event, data = {}) {
  switch (event) {
    case 'open': return {
      1: say('Something is sitting right on the hydrogen line, 1420.4058 megahertz: the one frequency every radio astronomer on any planet would know. Look how thin it is.', ['waterfall']),
      2: say('It changed. The carrier is switching on and off: bursts, then silence. Count one burst with me.', ['scope']),
      3: say('Symbols now. I think they\'re teaching us to count. The top lines pair dots with a symbol. Start there.', ['line-0', 'line-1']),
      4: say('This one is exactly 1,679 bits long, then silence. That number isn\'t an accident.', ['bits', 'factor']),
      5: say('Lines from one point, each labeled in their numbers. I think it\'s a map, and pulsars are the only lighthouses everyone in the galaxy can see.', ['map']),
      6: say('They sent a question, and they used a symbol we\'ve never seen. Read the first message with me.', ['log-0']),
    }[data.night];
    case 'near': return say('There. It\'s standing still. That\'s a carrier tone once you take our own motion out. Lock it.', ['lock']);
    case 'lockFail': return say('Still slanted. Our drift here is a few tenths of a hertz per second.', ['drift']);
    case 'wrongNext': return say(data.n % 2 === 0 || [9, 15, 21, 25].includes(data.n) ? `${data.n} splits into smaller factors. Their numbers never do.` : `${data.n} is prime, but check you didn't skip one.`, ['groups']);
    case 'lineBad': {
      const line = LESSON[data.i], reads = readGlyphs(line.glyphs, state.assign);
      return say(line.kind === 'count'
        ? `Careful. Line ${data.i + 1} has ${line.dots} dot${line.dots > 1 ? 's' : ''}, but with your meanings it reads ${reads}.`
        : `Careful. Line ${data.i + 1} now reads ${reads}. That isn't true in base six or any other.`, [`line-${data.i}`]);
    }
    case 'base': return say('The six-dot line reads 1 0. They roll over at six. Six limbs, maybe? Keep going.', ['line-5', 'board']);
    case 'factored': return say('23 × 73. Both prime, so there\'s exactly one rectangle.', ['width']);
    case 'widthNear': return say('The stripes are almost vertical. You\'re within a couple of bits.', ['bits']);
    case 'matchWrong': return say(`That doesn't fit. ${data.name} would be about ${Math.round(data.ms / 1.5578)} times the fastest. This label says ${data.value}.`, ['catalog']);
    case 'matchRight': return say(`Match: ${data.name}. That's ${matched(state)} of 4.`, [`ray-${data.i}`]);
    case 'solved': return [null,
      say('Locked at 31 dB. Narrowband, drifting with the Earth, fixed on the sky. I\'ve checked every satellite catalog and nothing matches. Writing it up.', ['board']),
      say('Seventeen. Primes, sent on purpose. They\'re saying: we know you\'ll recognize this.', ['groups']),
      say('Every line holds. Base six, with plus, times and equals. We can do math with them now.', ['board']),
      say('There it is. Counting to six in binary, hydrogen, a body with six limbs, their star with the second planet raised, and their dish. It\'s a self-portrait.', ['bits']),
      say(`Triangulated. ${ORIGIN.star}, a quiet red dwarf ${ORIGIN.distance} light-years away in Virgo. Its planet is a little bigger than Earth. That's where they are.`, ['origin']),
      say('They drew us. Four limbs, standing upright. Eleven light-years away, someone drew a human being from one number we sent.', ['us']),
    ][data.night];
    case 'replyWrong': {
      const value = data.glyphs.every(g => /^d/.test(g)) ? parseInt(data.glyphs.map(g => g[1]).join(''), BASE) : null;
      return say(`Hold on before we spend 22 years on it. That reads ${readGlyphs(data.glyphs, state.assign)}${value !== null ? `, which is ${value} in our counting` : ''}. ${stage(state) === 0 ? 'Six in theirs is 1 0.' : 'Count limbs.'}`, ['composer']);
    }
    case 'sent': return say(`Transmitting. ${LIGHT_YEARS} light-years. It reaches them in October 2037.`, ['log-pending']);
    case 'ack': return say('Three equals signs. I\'d bet that means "correct." We just passed a test set by another species.', ['log-2']);
    case 'question': return say('New message. That first symbol stood beside the six-limbed figure in their picture. I think they\'re about to ask about us.', ['log-3']);
    default: return null;
  }
}

// ── The cover: proactive pings and the walkie-talkie. ───────────────────────
export function coverLine(state) {
  if (state.solved[6]) return 'They drew us. Something bigger is coming in. I\'ll wake you when it starts.';
  if (state.incoming) return {
    1: 'Something narrow on the hydrogen line, right at 21:40. It isn\'t one of ours.',
    2: 'The carrier is back, and now it\'s pulsing in groups. I want you to count with me.',
    3: 'Symbols. Thirteen lines of them. I think they\'re teaching us to count.',
    4: '1,679 bits, then silence. That number is a clue.',
    5: 'Lines from a point, labeled in their numbers. I think it\'s a map.',
    6: 'They sent a question. They\'re waiting for us.',
  }[state.night];
  if (state.solved[state.night]) return `Quiet since we decoded night ${state.night}. Next window is tomorrow at 21:40.`;
  return 'Still working on tonight\'s signal. Hold the mic to talk it through.';
}

export function radio(state) {
  if (state.incoming) return { q: 'Vega, what came in?', a: `${coverLine(state)} Open up and I'll show you.` };
  if (state.solved[6]) return { q: 'Anything from them?', a: 'A long transmission started an hour ago. It\'s bigger than everything so far combined. Get some sleep. I\'ve got it.' };
  if (state.solved[state.night]) return { q: 'Anything new?', a: `Nothing since night ${state.night}. Next listening window is tomorrow at 21:40. I'll ping you if the carrier comes back early.` };
  const top = board({ ...state, tab: state.night }).rows.reduce((a, b) => (b[1] > a[1] ? b : a));
  return { q: 'How are we doing?', a: `Night ${state.night}. My best guess is ${top[0].toLowerCase()}, about ${Math.round(top[1] * 100)} percent. Open up and let's push it over the line.` };
}

export { CONTACT };
