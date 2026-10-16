// The universe behind the signal. Everything is derived from a seed so every player could get a
// different, internally consistent contact. Physics and pulsar data are real.

export const SEED = 1977;
export const BASE = 6; // six limbs, so they count in sixes
export const CARRIER_MHZ = 1420.40575; // the hydrogen line: the frequency every radio civilization knows
export const DRIFT = -0.27; // Hz/s: Doppler drift from Earth's rotation at the dish's latitude

function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };
}

// ── Glyphs: strokes between points of a 3×3 lattice, unique per symbol ──────
const POINTS = [[4, 4], [12, 4], [20, 4], [4, 12], [12, 12], [20, 12], [4, 20], [12, 20], [20, 20]];
const EDGES = [];
for (let a = 0; a < 9; a++) {
  for (let b = a + 1; b < 9; b++) {
    const [ax, ay] = POINTS[a], [bx, by] = POINTS[b];
    if (Math.abs(ax - bx) <= 8 && Math.abs(ay - by) <= 8) EDGES.push([a, b]);
  }
}
function makeGlyphs(names, random) {
  const used = new Set();
  return Object.fromEntries(names.map(name => {
    for (;;) {
      const count = 3 + Math.floor(random() * 2);
      const strokes = [];
      while (strokes.length < count) {
        const edge = EDGES[Math.floor(random() * EDGES.length)];
        if (!strokes.includes(edge)) strokes.push(edge);
      }
      const key = strokes.map(e => e.join('-')).sort().join('|');
      if (used.has(key)) continue;
      used.add(key);
      return [name, strokes.map(([a, b]) => `M${POINTS[a].join(' ')}L${POINTS[b].join(' ')}`).join('')];
    }
  }));
}
export const GLYPH_IDS = ['d0', 'd1', 'd2', 'd3', 'd4', 'd5', 'plus', 'eq', 'times'];
// Symbols that only appear on night 6. Appended, so the first nine stay identical.
export const EXTRA_IDS = ['q', 'them', 'you'];
export const GLYPHS = makeGlyphs([...GLYPH_IDS, ...EXTRA_IDS], rng(SEED));
export const MEANINGS = { d0: '0', d1: '1', d2: '2', d3: '3', d4: '4', d5: '5', plus: '+', eq: '=', times: '×' };

// A number in their base, as glyph ids.
export const numeral = n => n.toString(BASE).split('').map(d => `d${d}`);

// ── Night 3: arithmetic, taught only by example ─────────────────────────────
export const LESSON = [
  ...[1, 2, 3, 4, 5, 6, 7].map(n => ({ kind: 'count', dots: n, glyphs: numeral(n) })),
  ...[[2, 3], [4, 4], [5, 1]].map(([a, b]) => ({ kind: 'sum', glyphs: [...numeral(a), 'plus', ...numeral(b), 'eq', ...numeral(a + b)] })),
  ...[[2, 3], [3, 3], [5, 5]].map(([a, b]) => ({ kind: 'product', glyphs: [...numeral(a), 'times', ...numeral(b), 'eq', ...numeral(a * b)] })),
];

// Does a lesson line hold under the player's current lexicon?
export function lineHolds(line, assign) {
  const read = line.glyphs.map(g => assign[g]);
  if (read.some(v => v === undefined)) return null;
  const value = digits => (digits.length && digits.every(d => /^[0-5]$/.test(d)) ? parseInt(digits.join(''), BASE) : NaN);
  if (line.kind === 'count') return value(read) === line.dots;
  const eq = read.indexOf('=');
  const op = read.findIndex(v => v === '+' || v === '×');
  if (eq < 0 || op < 0 || op > eq || read.lastIndexOf('=') !== eq) return false;
  const a = value(read.slice(0, op)), b = value(read.slice(op + 1, eq)), c = value(read.slice(eq + 1));
  return read[op] === '+' ? a + b === c : a * b === c;
}

// ── Night 4: a 1,679-bit picture (1,679 = 23 × 73, both prime) ───────────────
export const PIC_W = 23, PIC_H = 73;
export const BITS = (() => {
  const grid = Array.from({ length: PIC_H }, () => new Array(PIC_W).fill(0));
  const set = (x, y) => { if (x >= 0 && y >= 0 && x < PIC_W && y < PIC_H) grid[y][x] = 1; };
  const line = (x0, y0, x1, y1) => { const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)); for (let i = 0; i <= n; i++) set(Math.round(x0 + (x1 - x0) * i / n), Math.round(y0 + (y1 - y0) * i / n)); };
  const ring = (cx, cy, r) => { for (let a = 0; a < 64; a++) set(Math.round(cx + r * Math.cos(a / 64 * Math.PI * 2)), Math.round(cy + r * Math.sin(a / 64 * Math.PI * 2))); };
  // 1–6 in binary columns, with a marker bit underneath each
  for (let n = 1; n <= 6; n++) { const x = 2 + (n - 1) * 3 + 1; for (let b = 0; b < 3; b++) if (n >> b & 1) set(x, 4 - b); set(x, 6); }
  // hydrogen: proton and electron, spins flipped (the 21 cm line)
  ring(7, 13, 2); ring(15, 13, 2); set(7, 13); set(15, 13); line(7, 9, 7, 10); line(15, 16, 15, 17);
  // the sender: a six-limbed radial body, with its height bracket
  ring(11, 29, 3); for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2 + Math.PI / 6; line(11 + Math.round(3 * Math.cos(a)), 29 + Math.round(3 * Math.sin(a)), 11 + Math.round(8 * Math.cos(a)), 29 + Math.round(8 * Math.sin(a))); }
  line(21, 21, 21, 37); set(20, 21); set(20, 37);
  // their star system: a dim star and five planets, the second raised (home)
  ring(2, 48, 1); set(2, 48); [7, 10, 13, 16, 19].forEach((x, i) => set(x, i === 1 ? 45 : 48)); line(10, 44, 11, 38);
  // the dish, its focus and the beam
  for (let x = 3; x <= 19; x++) set(x, 70 - Math.round(((x - 11) ** 2) / 8)); set(11, 60); line(11, 58, 11, 53); line(7, 58, 5, 54); line(15, 58, 17, 54);
  return grid.flat();
})();

// ── Night 5: a pulsar map. Periods are sent as ratios to the fastest pulsar, so no units are needed. ──
export const PULSARS = [
  { name: 'PSR B1937+21', ms: 1.5578, angle: -100, len: .5, ref: true },
  { name: 'PSR J0437−4715', ms: 5.7575, angle: -30, len: .38 },
  { name: 'Crab · B0531+21', ms: 33.392, angle: 25, len: .9 },
  { name: 'Vela · B0833−45', ms: 89.329, angle: 80, len: .62 },
  { name: 'PSR B0329+54', ms: 714.52, angle: 150, len: .74 },
  { name: 'PSR B1919+21', ms: 1337.3, angle: 205, len: .55 },
].map(p => ({ ...p, ratio: Math.round(p.ms / 1.5578) }));
export const DECOYS = [
  { name: 'PSR J1748−2446ad', ms: 1.396 }, { name: 'PSR B1257+12', ms: 6.219 }, { name: 'PSR B0656+14', ms: 384.9 },
].map(p => ({ ...p, ratio: Math.round(p.ms / 1.5578) }));
export const ORIGIN = {
  star: 'Ross 128', type: 'Quiet red dwarf · M4V', where: 'Constellation Virgo', distance: 11.0,
  planet: 'Ross 128 b', planetNote: 'About 1.4 Earth masses · a 9.9-day year · likely tidally locked',
};

// ── Night 6: they ask questions. Each stage is their message plus the reply that satisfies it. ──
export const CONTACT = [
  { ask: ['d2', 'times', 'd3', 'eq', 'q'], expect: ['d1', 'd0'], ack: ['eq', 'eq', 'eq'] },
  { ask: ['them', 'eq', 'd1', 'd0', 'you', 'eq', 'q'], expect: ['d4'] },
];
export const LIGHT_YEARS = ORIGIN.distance;
