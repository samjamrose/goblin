// Small shared helpers: number formatting, RNG, math.

const SUFFIXES = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];

export function fmt(n, digits = 2) {
  if (n === undefined || n === null || isNaN(n)) return '0';
  if (!isFinite(n)) return '∞';
  const neg = n < 0;
  n = Math.abs(n);
  let out;
  if (n < 1000) {
    out = n < 10 && n % 1 !== 0 ? n.toFixed(1).replace(/\.0$/, '') : Math.floor(n).toString();
  } else {
    let tier = Math.floor(Math.log10(n) / 3);
    let scaled = n / Math.pow(1000, tier);
    if (scaled >= 999.995) { tier++; scaled /= 1000; }
    let suf;
    if (tier < SUFFIXES.length) suf = SUFFIXES[tier];
    else {
      const t = tier - SUFFIXES.length;
      suf = String.fromCharCode(97 + Math.floor(t / 26) % 26) + String.fromCharCode(97 + (t % 26));
    }
    const d = scaled >= 100 ? 0 : scaled >= 10 ? 1 : digits;
    out = scaled.toFixed(d).replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1') + suf;
  }
  return (neg ? '-' : '') + out;
}

export function fmtTime(sec) {
  sec = Math.max(0, Math.ceil(sec));
  if (sec < 60) return sec + 's';
  const m = Math.floor(sec / 60), s = sec % 60;
  if (m < 60) return m + 'm' + (s ? ' ' + s + 's' : '');
  const h = Math.floor(m / 60), mm = m % 60;
  if (h < 24) return h + 'h' + (mm ? ' ' + mm + 'm' : '');
  const d = Math.floor(h / 24);
  return d + 'd ' + (h % 24) + 'h';
}

export function pct(x) { return Math.round(x * 100) + '%'; }

// Mulberry32 seeded RNG
export function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

export const rand = Math.random;
export function ri(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
export function pick(arr, r = Math.random) { return arr[Math.floor(r() * arr.length)]; }
export function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function weighted(entries, r = Math.random) {
  // entries: [[value, weight], ...]
  let tot = 0;
  for (const e of entries) tot += e[1];
  let x = r() * tot;
  for (const e of entries) { x -= e[1]; if (x <= 0) return e[0]; }
  return entries[entries.length - 1][0];
}

export function dayKey(t = Date.now()) {
  const d = new Date(t);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

export function weekKey(t = Date.now()) {
  // weeks start Monday 00:00 local
  const d = new Date(t);
  const day = (d.getDay() + 6) % 7;
  const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - day);
  return monday.getTime();
}

export function shuffle(arr, r = Math.random) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
