// Tiny WebAudio synth for sound effects + a gentle procedural tavern tune.
let ac = null, master = null, musicGain = null, sfxGain = null;
let musicOn = true, sfxOn = true, musicTimer = null;
const last = {};

function ensure() {
  if (ac) return ac;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ac = new AC();
  master = ac.createGain(); master.gain.value = 0.6; master.connect(ac.destination);
  sfxGain = ac.createGain(); sfxGain.gain.value = 0.5; sfxGain.connect(master);
  musicGain = ac.createGain(); musicGain.gain.value = 0.26; musicGain.connect(master);
  return ac;
}

export function unlockAudio() {
  const a = ensure();
  if (a && a.state === 'suspended') a.resume();
  if (musicOn && !musicTimer) startMusic();
}

function tone(freq, dur, type = 'square', vol = 0.3, slide = 0, delay = 0, dest) {
  if (!ac) return;
  const t = ac.currentTime + delay;
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(dest || sfxGain);
  o.start(t); o.stop(t + dur + 0.02);
}
function noise(dur, vol = 0.3, delay = 0, hp = 800) {
  if (!ac) return;
  const t = ac.currentTime + delay;
  const len = Math.floor(ac.sampleRate * dur);
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ac.createBufferSource(); src.buffer = buf;
  const f = ac.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp;
  const g = ac.createGain(); g.gain.value = vol;
  src.connect(f); f.connect(g); g.connect(sfxGain);
  src.start(t);
}

const SFX = {
  tap: () => tone(520, 0.05, 'square', 0.08),
  pop: () => { tone(880, 0.06, 'square', 0.15, 400); tone(1320, 0.08, 'triangle', 0.12, 0, 0.04); },
  coin: () => { tone(988, 0.06, 'square', 0.12); tone(1319, 0.12, 'square', 0.12, 0, 0.05); },
  buy: () => { tone(660, 0.05, 'square', 0.12); tone(880, 0.05, 'square', 0.12, 0, 0.04); tone(1100, 0.08, 'square', 0.1, 0, 0.08); },
  build: () => { for (let i = 0; i < 4; i++) noise(0.05, 0.25, i * 0.12, 1500); tone(330, 0.3, 'triangle', 0.15, 0, 0.5); tone(440, 0.3, 'triangle', 0.15, 0, 0.6); },
  built: () => { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.18, 'square', 0.12, 0, i * 0.08)); },
  milestone: () => { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.22, 'square', 0.13, 0, i * 0.07)); noise(0.3, 0.1, 0.35, 3000); },
  levelup: () => { [392, 523, 659, 784, 1047].forEach((f, i) => tone(f, 0.25, 'triangle', 0.18, 0, i * 0.09)); [784, 1047].forEach((f, i) => tone(f, 0.4, 'square', 0.08, 0, 0.5 + i * 0.1)); },
  gob: () => { const b = 300 + Math.random() * 200; tone(b, 0.07, 'square', 0.1, 200); tone(b * 1.3, 0.08, 'square', 0.08, -150, 0.07); },
  golden: () => { [1047, 1319, 1568, 2093].forEach((f, i) => tone(f, 0.12, 'triangle', 0.15, 0, i * 0.05)); },
  sparkle: () => { [1568, 2093, 2637].forEach((f, i) => tone(f, 0.08, 'sine', 0.08, 0, i * 0.06)); },
  squeak: () => tone(1800, 0.08, 'square', 0.08, 900),
  splash: () => noise(0.18, 0.2, 0, 2000),
  recruit: () => { noise(0.4, 0.1, 0, 400); [262, 330, 392].forEach((f, i) => tone(f, 0.15, 'triangle', 0.12, 0, 0.3 + i * 0.08)); },
  reveal: () => { [523, 784, 1047].forEach((f, i) => tone(f, 0.2, 'square', 0.12, 0, i * 0.06)); },
  epic: () => { [392, 494, 587, 784, 988, 1175].forEach((f, i) => tone(f, 0.3, 'square', 0.1, 0, i * 0.07)); noise(0.5, 0.08, 0.4, 4000); },
  battle: () => { tone(196, 0.15, 'sawtooth', 0.1); tone(262, 0.25, 'sawtooth', 0.1, 0, 0.15); },
  hit: () => { noise(0.06, 0.15, 0, 1200); tone(150 + Math.random() * 80, 0.06, 'square', 0.08, -60); },
  poke: () => { tone(700 + Math.random() * 300, 0.04, 'square', 0.08, -300); },
  ko: () => { tone(400, 0.2, 'square', 0.1, -300); },
  ouch: () => { tone(300, 0.25, 'triangle', 0.12, -200); },
  throw: () => tone(500, 0.3, 'sine', 0.1, 600),
  boom: () => { noise(0.6, 0.45, 0, 80); tone(90, 0.5, 'sawtooth', 0.2, -60); },
  victory: () => { [523, 523, 523, 659, 784, 659, 784].forEach((f, i) => tone(f, i === 6 ? 0.5 : 0.12, 'square', 0.12, 0, [0, 0.12, 0.24, 0.36, 0.5, 0.62, 0.74][i])); },
  defeat: () => { [392, 370, 349, 330].forEach((f, i) => tone(f, 0.3, 'triangle', 0.14, 0, i * 0.22)); },
  alarm: () => { for (let i = 0; i < 3; i++) { tone(880, 0.12, 'square', 0.12, 0, i * 0.3); tone(660, 0.12, 'square', 0.12, 0, i * 0.3 + 0.15); } },
  event: () => { tone(660, 0.08, 'triangle', 0.12); tone(990, 0.12, 'triangle', 0.12, 0, 0.08); },
  error: () => tone(160, 0.15, 'square', 0.1),
  achieve: () => { [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.18, 'square', 0.1, 0, i * 0.08)); },
  whoosh: () => noise(0.25, 0.12, 0, 600),
  fire: () => noise(0.4, 0.12, 0, 300),
};

export function sfx(name) {
  if (!sfxOn || !ac) return;
  const now = performance.now();
  if (last[name] && now - last[name] < 40) return;
  last[name] = now;
  try { SFX[name] && SFX[name](); } catch (e) { /* ignore */ }
}

export function setSfx(on) { sfxOn = on; }
export function setMusic(on) {
  musicOn = on;
  if (on && ac) startMusic();
  if (!on) stopMusic();
}

// --- Music: a small sequencer that plays any of the track definitions below ----
const N = (m) => 440 * Math.pow(2, (m - 69) / 12); // midi -> Hz
const P = (str) => str.split('').map(c => c === 'x'); // drum pattern string -> booleans
let fx = null;

// Each track: bpm, sub (2 = eighth steps, 4 = sixteenth steps), chord progressions (4 bars, midi),
// melody scale, and layers. Bass/arp patterns have one entry per step (null = rest).
export const TRACKS = {
  mudlight: { name: 'Mudlight Serenade', mood: 'Chill campfire tune', bpm: 72, sub: 2,
    progs: [[[50, 57, 60, 65], [46, 53, 57, 62], [41, 48, 57, 64], [48, 55, 59, 64]], [[50, 57, 60, 64], [43, 50, 57, 59], [45, 52, 55, 60], [46, 53, 57, 60]]],
    scale: [62, 64, 65, 67, 69, 72, 74, 76, 77, 79],
    pad: { vol: 0.028 }, bass: { pattern: [0, null, null, null, 7, null, null, null], vol: 0.1 },
    arp: { pattern: [0, 1, 2, 3, 2, 1, 2, 3], vol: 0.018, type: 'square', oct: 12, filter: 1500 },
    lead: { vol: 0.06, type: 'sine', vibrato: 4, every: 2, rest: 0.38 },
    drums: { kick: P('x.......'), hat: P('.x.x.x.x'), kickVol: 0.012, hatVol: 0.006 }, chime: true },
  moonrise: { name: 'Mushroom Moonrise', mood: 'Dreamy music box under the stars', bpm: 64, sub: 2,
    progs: [[[41, 53, 57, 64], [43, 53, 59, 62], [40, 52, 55, 62], [45, 52, 57, 60]]],
    scale: [72, 74, 76, 77, 79, 81, 83, 84, 86, 88],
    pad: { vol: 0.03, type: 'sine' }, bass: { pattern: [0, null, null, null, null, null, null, null], vol: 0.08 },
    arp: { pattern: [0, 2, 3, 1, 3, 2, 3, 1], vol: 0.03, type: 'triangle', oct: 24, release: 0.9 },
    lead: { vol: 0.045, type: 'triangle', vibrato: 2, every: 2, rest: 0.5 },
    drums: { hat: P('...x...x'), hatVol: 0.004 }, chime: true },
  tavern: { name: 'Tavern Twilight', mood: 'Bouncy jig with a recorder', bpm: 104, sub: 2,
    progs: [[[45, 57, 60, 64], [43, 55, 59, 62], [41, 53, 57, 60], [40, 52, 56, 59]], [[45, 57, 60, 64], [48, 55, 60, 64], [43, 55, 59, 62], [40, 52, 56, 59]]],
    scale: [69, 71, 72, 74, 76, 77, 79, 81, 83, 84],
    pad: null, bass: { pattern: [0, null, 7, null, 0, null, 7, null], vol: 0.09 },
    arp: { pattern: [1, 2, 3, 2, 1, 2, 3, 2], vol: 0.026, type: 'square', oct: 12, filter: 2200, release: 0.15 },
    lead: { vol: 0.055, type: 'sine', vibrato: 3, every: 1, rest: 0.25 },
    drums: { kick: P('x...x...'), hat: P('..x...x.'), kickVol: 0.02, hatVol: 0.012 } },
  minegroove: { name: 'Gold Mine Groove', mood: 'Lo-fi beats to dig gold to', bpm: 82, sub: 4,
    progs: [[[40, 55, 59, 62], [36, 55, 59, 64], [45, 55, 60, 64], [47, 54, 57, 63]]],
    scale: [64, 67, 69, 71, 74, 76, 79, 81],
    pad: { vol: 0.03, type: 'triangle', filter: 1100 },
    bass: { pattern: [0, null, null, null, null, null, 0, null, null, null, 7, null, null, null, null, null], vol: 0.12, type: 'sine' },
    arp: null, lead: { vol: 0.05, type: 'triangle', vibrato: 1, every: 2, rest: 0.5 },
    drums: { kick: P('x.....x...x.....'), snare: P('....x.......x...'), hat: P('x.x.x.x.x.x.x.xx'), kickVol: 0.05, snareVol: 0.03, hatVol: 0.008 } },
  frostfang: { name: 'Frostfang Echoes', mood: 'Icy bells on a silent mountain', bpm: 58, sub: 2, hard: true,
    progs: [[[40, 55, 59, 64], [36, 55, 60, 64], [43, 55, 59, 62], [38, 54, 57, 62]]],
    scale: [76, 78, 79, 81, 83, 86, 88, 90, 91],
    pad: { vol: 0.034, type: 'sine', attack: 1.6 }, bass: { pattern: [0, null, null, null, null, null, null, null], vol: 0.07 },
    arp: { pattern: [3, null, 2, null, 1, null, 2, null], vol: 0.035, type: 'sine', oct: 24, release: 1.6 },
    lead: { vol: 0.04, type: 'sine', vibrato: 5, every: 2, rest: 0.55 }, drums: null, chime: true, wet: 0.6 },
  dragonhoard: { name: 'Hoard of the Dragon', mood: 'Epic march over a mountain of gold', bpm: 100, sub: 4, hard: true,
    progs: [[[38, 50, 53, 57], [34, 50, 53, 58], [43, 50, 55, 58], [45, 49, 52, 57]]],
    scale: [62, 64, 65, 67, 69, 70, 73, 74, 76, 77],
    pad: { vol: 0.03, type: 'sawtooth', filter: 900 },
    bass: { pattern: [0, null, 0, null, 0, null, 0, 0, 0, null, 0, null, 7, null, 5, null], vol: 0.08, type: 'triangle' },
    arp: null, lead: { vol: 0.05, type: 'square', vibrato: 3, every: 1, rest: 0.3, filter: 2400 },
    drums: { kick: P('x.......x.x.....'), snare: P('....x.......x..x'), hat: P('..x...x...x...x.'), tom: P('..............xx'), kickVol: 0.06, snareVol: 0.03, hatVol: 0.008 } },
  gobtopia: { name: 'Eternal Gobtopia', mood: 'The triumphant anthem of a goblin empire', bpm: 90, sub: 4, hard: true,
    progs: [[[48, 55, 64, 67], [50, 57, 62, 66], [52, 55, 59, 64], [53, 57, 60, 65]], [[53, 57, 60, 65], [55, 59, 62, 67], [52, 55, 60, 64], [48, 55, 64, 67]]],
    scale: [67, 69, 71, 72, 74, 76, 78, 79, 81, 83, 84],
    pad: { vol: 0.03, type: 'triangle', filter: 1800 },
    bass: { pattern: [0, null, null, 12, null, null, 7, null, 0, null, null, 12, null, 7, null, null], vol: 0.09 },
    arp: { pattern: [0, 1, 2, 3, 0, 1, 2, 3, 0, 1, 2, 3, 0, 1, 2, 3], vol: 0.015, type: 'square', oct: 12, filter: 2000 },
    lead: { vol: 0.055, type: 'square', vibrato: 3, every: 1, rest: 0.3, filter: 2600 },
    drums: { kick: P('x...x...x...x...'), snare: P('....x.......x...'), hat: P('..x...x...x...x.'), kickVol: 0.05, snareVol: 0.025, hatVol: 0.007 }, chime: true },
  // ---- combat
  battle: { name: 'Bonk Time', bpm: 140, sub: 4,
    progs: [[[45, 57, 60, 64], [41, 57, 60, 65], [43, 55, 59, 62], [40, 56, 59, 64]]],
    scale: [69, 71, 72, 74, 76, 77, 79, 80, 81],
    pad: null, bass: { pattern: [0, null, 12, null, 0, null, 12, null, 0, null, 12, null, 0, 0, 12, null], vol: 0.09, type: 'square', filter: 700 },
    arp: { pattern: [1, 2, 3, null, 1, 2, 3, null, 1, 2, 3, null, 3, 2, 1, null], vol: 0.02, type: 'square', oct: 12, filter: 2500, release: 0.1 },
    lead: { vol: 0.045, type: 'square', vibrato: 2, every: 1, rest: 0.25, filter: 3000 },
    drums: { kick: P('x...x...x...x...'), snare: P('....x.......x...'), hat: P('x.xxx.xxx.xxx.xx'), kickVol: 0.06, snareVol: 0.035, hatVol: 0.008 }, wet: 0.15 },
  boss: { name: 'Big Bad Boss', bpm: 152, sub: 4,
    progs: [[[36, 48, 51, 55], [32, 48, 51, 56], [34, 46, 50, 53], [31, 47, 50, 55]]],
    scale: [60, 61, 63, 65, 67, 68, 71, 72, 73, 75],
    pad: { vol: 0.03, type: 'sawtooth', filter: 700 },
    bass: { pattern: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0], vol: 0.07, type: 'sawtooth', filter: 500 },
    arp: { pattern: [3, null, 2, null, 3, null, 1, null, 3, null, 2, null, 1, 2, 3, 2], vol: 0.02, type: 'square', oct: 12, filter: 2200, release: 0.08 },
    lead: { vol: 0.05, type: 'sawtooth', vibrato: 4, every: 1, rest: 0.2, filter: 2200 },
    drums: { kick: P('x.x.x..xx.x.x..x'), snare: P('....x.......x...'), hat: P('xxxxxxxxxxxxxxxx'), tom: P('............xxxx'), kickVol: 0.07, snareVol: 0.04, hatVol: 0.006 }, wet: 0.2 },
};
export const TOWN_TRACKS = ['mudlight', 'moonrise', 'tavern', 'minegroove', 'frostfang', 'dragonhoard', 'gobtopia'];

function musicFx() {
  if (fx) return fx;
  const input = ac.createGain();
  const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3200; lp.Q.value = 0.3;
  const delay = ac.createDelay(2); delay.delayTime.value = 0.4;
  const fb = ac.createGain(); fb.gain.value = 0.3;
  const dwet = ac.createGain(); dwet.gain.value = 0.25;
  const dlp = ac.createBiquadFilter(); dlp.type = 'lowpass'; dlp.frequency.value = 1800;
  delay.connect(dlp); dlp.connect(fb); fb.connect(delay); dlp.connect(dwet);
  const verb = ac.createConvolver();
  const len = Math.floor(ac.sampleRate * 2.8), ir = ac.createBuffer(2, len, ac.sampleRate);
  for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
  verb.buffer = ir;
  const vwet = ac.createGain(); vwet.gain.value = 0.35;
  const fade = ac.createGain(); fade.gain.value = 1;
  input.connect(lp);
  lp.connect(fade); lp.connect(delay); lp.connect(verb);
  dwet.connect(fade); verb.connect(vwet); vwet.connect(fade);
  fade.connect(musicGain);
  fx = { input, delay, vwet, fade };
  return fx;
}

function voice(freq, t, dur, { type = 'triangle', vol = 0.1, attack = 0.02, release = 0.3, detune = 0, vibrato = 0, filter = 0 } = {}) {
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t); o.detune.value = detune;
  let node = o;
  if (vibrato) {
    const lfo = ac.createOscillator(), lg = ac.createGain();
    lfo.frequency.value = 5; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(vibrato, t + Math.min(0.4, dur));
    lfo.connect(lg); lg.connect(o.frequency); lfo.start(t); lfo.stop(t + dur + release + 0.05);
  }
  if (filter) { const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = filter; o.connect(f); node = f; }
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + attack);
  g.gain.setValueAtTime(vol, t + Math.max(attack, dur));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur + release);
  node.connect(g); g.connect(musicFx().input);
  o.start(t); o.stop(t + dur + release + 0.05);
}
function drumNoise(t, vol, hp, dur, bp) {
  const len = Math.floor(ac.sampleRate * dur), buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
  const src = ac.createBufferSource(); src.buffer = buf;
  const f = ac.createBiquadFilter(); f.type = bp ? 'bandpass' : 'highpass'; f.frequency.value = hp;
  const g = ac.createGain(); g.gain.value = vol;
  src.connect(f); f.connect(g); g.connect(musicFx().input); src.start(t);
}
function kick(t, vol) {
  const o = ac.createOscillator(), g = ac.createGain();
  o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
  g.gain.setValueAtTime(vol * 6, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
  o.connect(g); g.connect(musicFx().input); o.start(t); o.stop(t + 0.25);
}
function tom(t, vol, f0) {
  const o = ac.createOscillator(), g = ac.createGain();
  o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f0 * 0.6, t + 0.15);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
  o.connect(g); g.connect(musicFx().input); o.start(t); o.stop(t + 0.2);
}

function makeMelody(T, prog, steps) {
  const notes = [];
  const sc = T.scale;
  let idx = Math.floor(sc.length / 2);
  const L = T.lead, stepLen = T.sub === 4 ? [2, 2, 4, 4, 6, 8] : [1, 2, 2, 3, 4, 6];
  for (let bar = 0; bar < 8; bar++) {
    const chord = prog[bar % 4];
    let step = 0;
    while (step < steps) {
      if (Math.random() < L.rest) { step += T.sub === 4 ? 2 : 1; continue; }
      idx = Math.max(0, Math.min(sc.length - 1, idx + [-2, -1, -1, 0, 1, 1, 2][Math.floor(Math.random() * 7)]));
      let m = sc[idx];
      if (step === 0) { const tones = chord.map(c => c % 12); for (let k = 0; k < 3 && !tones.includes(m % 12); k++) m++; }
      const len = Math.min(stepLen[Math.floor(Math.random() * stepLen.length)], steps - step);
      notes.push({ bar, step, m, len });
      step += len;
    }
  }
  return notes;
}

let musicState = null, wantTrack = 'mudlight', townTrack = 'mudlight', musicMode = 'town';
function startMusic() {
  if (!ac || musicTimer) return;
  musicFx();
  musicState = null;
  beginTrack(wantTrack, ac.currentTime + 0.15);
  musicTimer = setInterval(scheduleMusic, 100);
}
function beginTrack(id, at) {
  const T = TRACKS[id] || TRACKS.mudlight;
  musicState = { id, T, next: at, step: 0, section: -1, prog: T.progs[0], melody: null };
  const f = musicFx();
  f.delay.delayTime.setValueAtTime(60 / T.bpm * 0.75, at);
  f.vwet.gain.setValueAtTime(T.wet ?? 0.35, at);
  f.fade.gain.cancelScheduledValues(at); f.fade.gain.setValueAtTime(0.0001, at); f.fade.gain.linearRampToValueAtTime(1, at + 0.8);
}
// switch songs with a short fade
function switchTrack(id) {
  wantTrack = id;
  if (!ac || !musicTimer || !musicState || musicState.id === id) return;
  const f = musicFx(), now = ac.currentTime;
  f.fade.gain.cancelScheduledValues(now); f.fade.gain.setValueAtTime(f.fade.gain.value, now); f.fade.gain.linearRampToValueAtTime(0.0001, now + 0.5);
  musicState.next = Infinity; // stop scheduling the old song
  setTimeout(() => { if (wantTrack === id && musicTimer) beginTrack(id, ac.currentTime + 0.05); }, 550);
}
export function setTownTrack(id) { townTrack = TRACKS[id] ? id : 'mudlight'; if (musicMode === 'town') switchTrack(townTrack); }
export function setMusicMode(mode) { musicMode = mode; switchTrack(mode === 'town' ? townTrack : mode); }
export function currentTrack() { return wantTrack; }

function scheduleMusic() {
  if (!ac || !musicState) return;
  const M = musicState, T = M.T;
  const stepDur = 60 / T.bpm / T.sub, perBar = 4 * T.sub;
  while (M.next < ac.currentTime + 0.7) {
    const t = M.next;
    const sStep = M.step % (perBar * 8);
    if (sStep === 0) {
      M.section++;
      M.prog = T.progs[Math.floor(Math.random() * T.progs.length)];
      M.melody = T.lead && M.section % (T.lead.every || 1) === (T.lead.every > 1 ? 1 : 0) ? makeMelody(T, M.prog, perBar) : null;
    }
    const bar = Math.floor(sStep / perBar), st = sStep % perBar;
    const chord = M.prog[bar % 4];
    const barDur = stepDur * perBar;
    if (T.pad && st === 0) {
      for (const m of chord.slice(1)) {
        voice(N(m), t, barDur * 0.95, { type: T.pad.type || 'triangle', vol: T.pad.vol, attack: T.pad.attack || 0.9, release: 1.2, detune: -6, filter: T.pad.filter || 1400 });
        voice(N(m), t, barDur * 0.95, { type: 'sine', vol: T.pad.vol * 0.9, attack: (T.pad.attack || 0.9) + 0.1, release: 1.2, detune: 7 });
      }
    }
    if (T.bass) {
      const off = T.bass.pattern[st % T.bass.pattern.length];
      if (off !== null && off !== undefined) voice(N(chord[0] - 12 + off), t, stepDur * (T.sub === 4 ? 1.6 : 3), { type: T.bass.type || 'triangle', vol: T.bass.vol, attack: 0.01, release: 0.25, filter: T.bass.filter || 650 });
    }
    if (T.arp) {
      const i = T.arp.pattern[st % T.arp.pattern.length];
      if (i !== null && i !== undefined) voice(N(chord[i] + (T.arp.oct || 12)), t, stepDur * 0.7, { type: T.arp.type || 'square', vol: T.arp.vol, attack: 0.005, release: T.arp.release ?? 0.35, filter: T.arp.filter || 0 });
    }
    if (M.melody) for (const n of M.melody) if (n.bar === bar && n.step === st) voice(N(n.m), t, stepDur * n.len * 0.95, { type: T.lead.type, vol: T.lead.vol, attack: 0.04, release: 0.4, vibrato: T.lead.vibrato || 0, filter: T.lead.filter || 0 });
    const D = T.drums;
    if (D) {
      const k = st % (D.kick || D.hat || [1]).length;
      if (D.kick && D.kick[st % D.kick.length]) kick(t, D.kickVol || 0.03);
      if (D.snare && D.snare[st % D.snare.length]) { drumNoise(t, D.snareVol || 0.03, 1800, 0.14, true); voice(190, t, 0.04, { type: 'triangle', vol: (D.snareVol || 0.03) * 1.5, release: 0.06 }); }
      if (D.hat && D.hat[st % D.hat.length]) drumNoise(t, D.hatVol || 0.006, 7000, 0.035);
      if (D.tom && D.tom[st % D.tom.length]) tom(t, 0.08, 160 - (st % 4) * 20);
      void k;
    }
    if (T.chime && sStep % (perBar * 4) === perBar * 4 - perBar / 2 && Math.random() < 0.7) voice(N(chord[3] + 24), t, 0.1, { type: 'sine', vol: 0.025, attack: 0.002, release: 1.6 });
    M.next += stepDur;
    M.step++;
  }
}
function stopMusic() { if (musicTimer) clearInterval(musicTimer); musicTimer = null; musicState = null; }
