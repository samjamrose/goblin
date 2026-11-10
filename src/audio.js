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
  musicGain = ac.createGain(); musicGain.gain.value = 0.16; musicGain.connect(master);
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

// --- simple procedural tavern jig in D dorian-ish
const SCALE = [146.8, 164.8, 174.6, 196, 220, 246.9, 261.6, 293.7, 329.6, 349.2, 392, 440];
const BASS = [73.4, 73.4, 98, 87.3, 73.4, 110, 98, 82.4];
function startMusic() {
  if (!ac || musicTimer) return;
  let step = 0;
  let phrase = makePhrase();
  const beat = 0.19;
  let next = ac.currentTime + 0.1;
  musicTimer = setInterval(() => {
    if (!ac) return;
    while (next < ac.currentTime + 0.5) {
      const i = step % 32;
      if (i === 0 && step > 0 && Math.random() < 0.5) phrase = makePhrase();
      const n = phrase[i];
      if (n !== null) tone(SCALE[n], beat * 0.9, 'triangle', 0.22, 0, next - ac.currentTime, musicGain);
      if (i % 4 === 0) tone(BASS[(Math.floor(step / 4)) % BASS.length], beat * 1.8, 'square', 0.12, 0, next - ac.currentTime, musicGain);
      if (i % 2 === 1 && Math.random() < 0.5) {
        // tiny percussion tick
        const t = next - ac.currentTime;
        tone(2400, 0.02, 'square', 0.03, 0, t, musicGain);
      }
      next += beat;
      step++;
    }
  }, 120);
}
function makePhrase() {
  const p = [];
  let n = 4 + Math.floor(Math.random() * 3);
  for (let i = 0; i < 32; i++) {
    if (Math.random() < 0.22) { p.push(null); continue; }
    n += Math.floor(Math.random() * 5) - 2;
    n = Math.max(0, Math.min(SCALE.length - 1, n));
    if (i % 8 === 7) n = [0, 4, 7][Math.floor(Math.random() * 3)];
    p.push(n);
  }
  return p;
}
function stopMusic() { if (musicTimer) clearInterval(musicTimer); musicTimer = null; }
