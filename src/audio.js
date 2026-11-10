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
  musicGain = ac.createGain(); musicGain.gain.value = 0.17; musicGain.connect(master);
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

// --- Chill retro-fantasy soundtrack -------------------------------------------
// Slow modal chord loop (D dorian / F lydian colours) with soft pads, a gentle
// plucked arpeggio, a breathy "flute" lead, warm bass and a touch of echo + reverb.
const BPM = 72, EIGHTH = 60 / BPM / 2;
const N = (m) => 440 * Math.pow(2, (m - 69) / 12); // midi -> Hz
// 4-bar progressions (midi chord tones), chosen per 8-bar section
const PROGS = [
  [[50, 57, 60, 65], [46, 53, 57, 62], [41, 48, 57, 64], [48, 55, 59, 64]],   // Dm9 - Bbmaj7 - Fmaj9 - C(add9)
  [[50, 57, 60, 64], [43, 50, 57, 59], [45, 52, 55, 60], [46, 53, 57, 60]],   // Dm - G9 - Am7 - Bbmaj7
  [[41, 48, 55, 64], [43, 50, 57, 59], [45, 52, 57, 60], [43, 50, 55, 62]],   // Fmaj7 - G6 - Am - Gsus
];
const MELODY_SCALE = [62, 64, 65, 67, 69, 72, 74, 76, 77, 79]; // D dorian, upper register
let fx = null;

function musicFx() {
  if (fx) return fx;
  const input = ac.createGain();
  const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2600; lp.Q.value = 0.3;
  // dotted-eighth echo
  const delay = ac.createDelay(2); delay.delayTime.value = EIGHTH * 1.5;
  const fb = ac.createGain(); fb.gain.value = 0.32;
  const dwet = ac.createGain(); dwet.gain.value = 0.28;
  const dlp = ac.createBiquadFilter(); dlp.type = 'lowpass'; dlp.frequency.value = 1800;
  delay.connect(dlp); dlp.connect(fb); fb.connect(delay); dlp.connect(dwet);
  // simple generated reverb
  const verb = ac.createConvolver();
  const len = Math.floor(ac.sampleRate * 2.8), ir = ac.createBuffer(2, len, ac.sampleRate);
  for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
  verb.buffer = ir;
  const vwet = ac.createGain(); vwet.gain.value = 0.35;
  input.connect(lp);
  lp.connect(musicGain); lp.connect(delay); lp.connect(verb);
  dwet.connect(musicGain); verb.connect(vwet); vwet.connect(musicGain);
  fx = { input };
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
function softNoise(t, vol, hp = 6000, dur = 0.05) {
  const len = Math.floor(ac.sampleRate * dur), buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ac.createBufferSource(); src.buffer = buf;
  const f = ac.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp;
  const g = ac.createGain(); g.gain.value = vol;
  src.connect(f); f.connect(g); g.connect(musicFx().input); src.start(t);
}

function makeMelody(prog) {
  // gentle phrase: a few long notes and rests per bar, leaning on chord tones
  const notes = [];
  let idx = 3 + Math.floor(Math.random() * 3);
  for (let bar = 0; bar < 8; bar++) {
    const chord = prog[bar % 4];
    let step = 0;
    while (step < 8) {
      if (Math.random() < 0.38) { step += Math.random() < 0.5 ? 2 : 1; continue; }
      idx = Math.max(0, Math.min(MELODY_SCALE.length - 1, idx + [-2, -1, -1, 0, 1, 1, 2][Math.floor(Math.random() * 7)]));
      let m = MELODY_SCALE[idx];
      // snap the first note of a bar to a chord tone
      if (step === 0) { const tones = chord.map(c => c % 12); for (let k = 0; k < 3 && !tones.includes(m % 12); k++) m++; }
      const len = [2, 2, 3, 4, 4, 6][Math.floor(Math.random() * 6)];
      notes.push({ bar, step, m, len: Math.min(len, 8 - step) });
      step += len;
    }
  }
  return notes;
}

let musicState = null;
function startMusic() {
  if (!ac || musicTimer) return;
  musicFx();
  musicState = { next: ac.currentTime + 0.15, step: 0, section: 0, prog: PROGS[0], melody: null };
  musicTimer = setInterval(scheduleMusic, 100);
}
function scheduleMusic() {
  if (!ac || !musicState) return;
  const M = musicState;
  while (M.next < ac.currentTime + 0.7) {
    const t = M.next;
    const s8 = M.step % 64; // 8 bars of 8 eighths
    if (s8 === 0) {
      M.section++;
      M.prog = PROGS[Math.floor(Math.random() * PROGS.length)];
      // every other section has a lead melody; the rest is just the calm bed
      M.melody = M.section % 2 === 0 ? makeMelody(M.prog) : null;
    }
    const bar = Math.floor(s8 / 8), st = s8 % 8;
    const chord = M.prog[bar % 4];
    if (st === 0) {
      // warm pad: two detuned soft voices per chord tone
      for (const m of chord.slice(1)) {
        voice(N(m), t, EIGHTH * 7.6, { type: 'triangle', vol: 0.028, attack: 0.9, release: 1.4, detune: -6, filter: 1400 });
        voice(N(m), t, EIGHTH * 7.6, { type: 'sine', vol: 0.03, attack: 1.0, release: 1.4, detune: 7 });
      }
      voice(N(chord[0] - 12), t, EIGHTH * 3.5, { type: 'triangle', vol: 0.11, attack: 0.04, release: 0.6, filter: 600 });
      softNoise(t, 0.012, 200, 0.12); // soft "kick" thump
    }
    if (st === 4) voice(N(chord[0] - 12 + (Math.random() < 0.5 ? 7 : 0)), t, EIGHTH * 3, { type: 'triangle', vol: 0.08, attack: 0.04, release: 0.5, filter: 600 });
    // plucked arpeggio (retro square, heavily softened)
    const pattern = [0, 1, 2, 3, 2, 1, 2, 3];
    const am = chord[pattern[st]] + 12;
    if (!(M.section % 3 === 1 && st % 2 === 1)) voice(N(am), t, EIGHTH * 0.6, { type: 'square', vol: 0.018, attack: 0.005, release: 0.35, filter: 1500 });
    if (st % 2 === 1 && Math.random() < 0.6) softNoise(t, 0.006, 7000, 0.03); // brushed hat
    // breathy flute lead
    if (M.melody) for (const n of M.melody) if (n.bar === bar && n.step === st) voice(N(n.m), t, EIGHTH * n.len * 0.95, { type: 'sine', vol: 0.06, attack: 0.08, release: 0.5, vibrato: 4 });
    // sparkly chime every 4 bars
    if (s8 % 32 === 28 && Math.random() < 0.7) voice(N(chord[3] + 24), t, 0.1, { type: 'sine', vol: 0.025, attack: 0.002, release: 1.6 });
    M.next += EIGHTH;
    M.step++;
  }
}
function stopMusic() { if (musicTimer) clearInterval(musicTimer); musicTimer = null; musicState = null; }
