// Procedural pixel-art: goblins, buildings, terrain, enemies, icons.
import { TILE } from './data.js';
import { rng } from './util.js';

const OUTLINE = '#1c1424';
const cache = new Map();

export function makeCanvas(w, h) {
  if (typeof OffscreenCanvas !== 'undefined' && false) return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

// ---------------------------------------------------------- color helpers
function hexToRgb(h) {
  h = h.replace('#', '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
}
export function shade(c, amt) {
  // amt -1..1 : darken/lighten
  const [r, g, b] = hexToRgb(c);
  if (amt < 0) return rgbToHex(r * (1 + amt), g * (1 + amt), b * (1 + amt));
  return rgbToHex(r + (255 - r) * amt, g + (255 - g) * amt, b + (255 - b) * amt);
}
export function mix(a, b, t) {
  const A = hexToRgb(a), B = hexToRgb(b);
  return rgbToHex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t);
}

// ---------------------------------------------------------- drawing API
function P(ctx) {
  const api = {
    ctx,
    px(x, y, c) { ctx.fillStyle = c; ctx.fillRect(x | 0, y | 0, 1, 1); },
    rect(x, y, w, h, c) { if (w <= 0 || h <= 0) return; ctx.fillStyle = c; ctx.fillRect(x | 0, y | 0, w | 0, h | 0); },
    hline(x, y, w, c) { api.rect(x, y, w, 1, c); },
    vline(x, y, h, c) { api.rect(x, y, 1, h, c); },
    // filled ellipse
    oval(cx, cy, rx, ry, c) {
      ctx.fillStyle = c;
      for (let y = -ry; y <= ry; y++) {
        const w = Math.round(rx * Math.sqrt(Math.max(0, 1 - (y * y) / (ry * ry + 0.01))));
        ctx.fillRect(Math.round(cx - w), Math.round(cy + y), w * 2 + 1, 1);
      }
    },
    planks(x, y, w, h, c, R) {
      api.rect(x, y, w, h, c);
      for (let yy = y + 2; yy < y + h; yy += 3) api.hline(x, yy, w, shade(c, -0.25));
      for (let yy = y; yy < y + h; yy += 3) {
        const off = ((yy * 7) % 5) + 2;
        for (let xx = x + off; xx < x + w; xx += 6) api.px(xx, yy, shade(c, -0.18));
      }
      api.hline(x, y, w, shade(c, 0.15));
    },
    bricks(x, y, w, h, c) {
      api.rect(x, y, w, h, c);
      const m = shade(c, -0.3);
      for (let yy = y + 2; yy < y + h; yy += 3) api.hline(x, yy, w, m);
      for (let yy = y, row = 0; yy < y + h; yy += 3, row++) {
        for (let xx = x + (row % 2 ? 2 : 0); xx < x + w; xx += 4) api.vline(xx, yy, 2, m);
      }
      api.hline(x, y, w, shade(c, 0.15));
    },
    stones(x, y, w, h, c, seed = 1) {
      const R = rng(seed);
      api.rect(x, y, w, h, shade(c, -0.25));
      for (let yy = y; yy < y + h; yy += 3) {
        let xx = x + Math.floor(R() * 2);
        while (xx < x + w) {
          const sw = 2 + Math.floor(R() * 3);
          api.rect(xx, yy, Math.min(sw, x + w - xx), 2, shade(c, (R() - 0.5) * 0.2));
          api.px(xx, yy, shade(c, 0.2));
          xx += sw + 1;
        }
      }
    },
    // gable roof: a triangle-ish roof spanning x..x+w, peak at y, eaves at y+h
    roof(x, y, w, h, c, style = 'shingle') {
      const dark = shade(c, -0.3), light = shade(c, 0.18);
      for (let i = 0; i < h; i++) {
        const inset = Math.round((h - 1 - i) * (w / 2 - 2) / h);
        const rx = x + inset, rw = w - inset * 2;
        api.hline(rx, y + i, rw, c);
        if (style === 'shingle' && i % 2 === 1) for (let k = rx + (i % 4 === 1 ? 1 : 3); k < rx + rw; k += 4) api.px(k, y + i, dark);
        if (style === 'thatch' && i % 2 === 0) for (let k = rx + (i * 3) % 3; k < rx + rw; k += 3) api.px(k, y + i, light);
        api.px(rx, y + i, dark); api.px(rx + rw - 1, y + i, dark);
      }
      api.hline(x - 1, y + h, w + 2, dark);
    },
    door(x, y, w, h, c = '#5a3a20') {
      api.rect(x, y, w, h, shade(c, -0.35));
      api.rect(x + 1, y + 1, w - 2, h - 1, c);
      api.vline(x + Math.floor(w / 2), y + 1, h - 1, shade(c, -0.2));
      api.px(x + w - 2, y + Math.floor(h / 2), '#e8c040');
    },
    window(x, y, w = 3, h = 3, lit = '#ffd86a') {
      api.rect(x - 1, y - 1, w + 2, h + 2, '#3a2a2a');
      api.rect(x, y, w, h, lit);
      api.px(x, y, shade(lit, 0.5));
    },
    flag(x, y, c) {
      api.vline(x, y, 9, '#5a4030');
      api.rect(x + 1, y, 5, 3, c);
      api.rect(x + 1, y + 3, 3, 1, c);
      api.px(x + 1, y, shade(c, 0.3));
    },
    sign(x, y, w, h, c = '#a07040') {
      api.rect(x, y, w, h, shade(c, -0.4));
      api.rect(x + 1, y + 1, w - 2, h - 2, c);
    },
    coinPile(x, y, w) {
      for (let i = 0; i < w; i++) {
        const hh = Math.round(3 * Math.sin((i + 0.5) / w * Math.PI));
        api.vline(x + i, y - hh, hh + 1, i % 2 ? '#f0c030' : '#d8a020');
        api.px(x + i, y - hh, '#fff0a0');
      }
    },
  };
  return api;
}

function outline(canvas, color = OUTLINE) {
  const ctx = canvas.getContext('2d');
  const { width: w, height: h } = canvas;
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const out = ctx.createImageData(w, h);
  const o = out.data;
  const [r, g, b] = hexToRgb(color);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    if (d[i + 3] > 0) continue;
    let near = false;
    if (x > 0 && d[i - 4 + 3] > 0) near = true;
    else if (x < w - 1 && d[i + 4 + 3] > 0) near = true;
    else if (y > 0 && d[i - w * 4 + 3] > 0) near = true;
    else if (y < h - 1 && d[i + w * 4 + 3] > 0) near = true;
    if (near) { o[i] = r; o[i + 1] = g; o[i + 2] = b; o[i + 3] = 255; }
  }
  const tmp = makeCanvas(w, h);
  tmp.getContext('2d').putImageData(out, 0, 0);
  ctx.drawImage(tmp, 0, 0);
}

// ================================================================ GOBLINS
export const GOB_W = 26, GOB_H = 28;
// Frames: 0 idle, 1 blink, 2-5 walk, 6-7 work, 8 cheer
export const GOB_FRAMES = 9;

function drawTool(p, tool, x, y, up, look) {
  // x,y = hand position (right hand)
  const wood = '#8a5a30', metal = '#c8ccd8', dk = '#7a7e90';
  switch (tool) {
    case 'pick':
      if (up) { p.vline(x, y - 9, 9, wood); p.hline(x - 3, y - 10, 7, metal); p.px(x - 4, y - 9, metal); p.px(x + 4, y - 9, metal); }
      else { p.hline(x, y, 7, wood); p.vline(x + 6, y - 3, 7, metal); p.px(x + 5, y - 4, metal); p.px(x + 5, y + 4, metal); }
      break;
    case 'hammer':
      if (up) { p.vline(x, y - 7, 7, wood); p.rect(x - 2, y - 10, 5, 3, dk); p.hline(x - 2, y - 10, 5, metal); }
      else { p.hline(x, y, 5, wood); p.rect(x + 4, y - 2, 3, 5, dk); p.vline(x + 4, y - 2, 5, metal); }
      break;
    case 'sword': case 'bigsword': {
      const L = tool === 'bigsword' ? 11 : 7;
      if (up) { p.vline(x, y - L - 1, L, metal); p.vline(x + 1, y - L - 1, L, dk); p.hline(x - 2, y - 1, 5, '#a08030'); p.px(x, y, wood); }
      else { p.hline(x + 1, y - 1, L, metal); p.hline(x + 1, y, L, dk); p.vline(x, y - 3, 5, '#a08030'); }
      break;
    }
    case 'axe':
      p.vline(x, y - 9, 11, wood); p.rect(x + 1, y - 9, 4, 5, metal); p.vline(x + 5, y - 8, 3, dk); p.rect(x - 3, y - 9, 3, 4, metal);
      break;
    case 'club':
      p.vline(x, y - 6, 7, wood); p.rect(x - 1, y - 11, 4, 6, '#6a4a2a'); p.px(x - 2, y - 9, '#ccc'); p.px(x + 3, y - 7, '#ccc');
      break;
    case 'dagger':
      if (up) { p.vline(x, y - 5, 4, metal); p.px(x, y - 1, '#a08030'); } else { p.hline(x + 1, y, 4, metal); p.px(x, y, '#a08030'); }
      break;
    case 'shroom': case 'bigshroom': {
      const big = tool === 'bigshroom';
      p.vline(x, y - 3, 4, '#f0e8d0');
      p.oval(x, y - (big ? 6 : 4), big ? 4 : 3, big ? 2 : 1, '#d83a3a');
      p.px(x - 1, y - (big ? 7 : 5), '#fff'); p.px(x + 2, y - (big ? 6 : 4), '#fff');
      break;
    }
    case 'mug':
      p.rect(x - 1, y - 4, 4, 5, '#a07040'); p.rect(x - 1, y - 5, 4, 1, '#fff8e0'); p.vline(x + 3, y - 3, 3, '#a07040'); p.px(x, y - 3, '#d8a040');
      break;
    case 'potion':
      p.rect(x - 1, y - 4, 3, 4, up ? '#5af06a' : '#c050ff'); p.px(x, y - 5, '#ddd'); p.px(x, y - 6, '#8a5a30'); p.px(x - 1, y - 4, '#fff');
      break;
    case 'bag': case 'sack':
      p.oval(x + 1, y - 1, 3, 3, tool === 'sack' ? '#b09060' : '#c8a040'); p.px(x + 1, y - 5, '#5a4030');
      if (tool === 'bag') { p.px(x, y - 1, '#ffe080'); p.px(x + 2, y, '#8a6a20'); }
      break;
    case 'dice':
      p.rect(x - 1, y - 3, 4, 4, '#fff'); p.px(x, y - 2, '#222'); p.px(x + 2, y, '#222');
      break;
    case 'spyglass':
      p.hline(x - 1, y - 2, 5, '#a08030'); p.hline(x, y - 3, 3, '#c8a040'); p.px(x + 4, y - 2, '#8ad8ff');
      break;
    case 'orb':
      p.oval(x + 1, y - 3, 2, 2, '#a0d8ff'); p.px(x, y - 4, '#fff');
      break;
    case 'book':
      p.rect(x - 1, y - 4, 5, 5, '#8a2a2a'); p.vline(x + 3, y - 4, 5, '#f0e8d0');
      break;
    case 'fan':
      p.rect(x - 1, y - 5, 5, 3, '#ff80b0'); p.px(x + 1, y - 2, '#8a5a30');
      break;
    case 'hourglass':
      p.hline(x - 1, y - 6, 5, '#a08030'); p.hline(x - 1, y, 5, '#a08030'); p.rect(x, y - 5, 3, 2, '#e8d8a0'); p.rect(x, y - 2, 3, 2, '#e8d8a0'); p.px(x + 1, y - 3, '#e8c060');
      break;
    case 'moon':
      p.oval(x + 1, y - 4, 3, 3, '#fff8c0'); p.oval(x + 2, y - 5, 2, 2, look?.outfit || '#222');
      break;
    case 'scepter':
      p.vline(x, y - 9, 10, '#d8a020'); p.oval(x, y - 10, 1, 1, '#ff3a6a'); p.px(x, y - 11, '#fff');
      break;
    case 'whip':
      p.vline(x, y - 3, 4, '#5a3a20'); p.px(x + 1, y - 4, '#5a3a20'); p.px(x + 2, y - 5, '#5a3a20'); p.px(x + 3, y - 5, '#5a3a20'); p.px(x + 4, y - 4, '#5a3a20');
      break;
    case 'medkit':
      p.rect(x - 1, y - 4, 6, 5, '#f0f0f0'); p.hline(x - 1, y - 4, 6, '#ffffff'); p.vline(x + 1, y - 3, 3, '#e02a3a'); p.hline(x, y - 2, 3, '#e02a3a'); p.px(x + 1, y - 5, '#8a8a8a'); p.px(x + 2, y - 5, '#8a8a8a');
      break;
    case 'chain':
      for (let i = 0; i < 5; i++) p.px(x + (i % 2), y - i, '#9ab0c0');
      p.rect(x - 1, y + 1, 3, 2, '#7a8a9a');
      break;
  }
}

function drawHat(p, hat, cx, top, look) {
  // cx = head center x, top = head top y
  const x = cx;
  switch (hat) {
    case 'bandana': p.rect(x - 5, top, 10, 2, '#c03030'); p.px(x + 5, top + 1, '#c03030'); p.px(x + 6, top + 2, '#c03030'); p.px(x - 3, top, '#fff'); break;
    case 'pot': p.rect(x - 5, top - 3, 10, 4, '#7a7e90'); p.hline(x - 6, top + 1, 12, '#5a5e70'); p.hline(x - 4, top - 3, 8, '#9a9eb0'); p.px(x + 6, top - 1, '#5a5e70'); break;
    case 'hood': p.rect(x - 5, top - 1, 10, 4, look.outfit); p.rect(x - 6, top + 2, 2, 5, look.outfit); p.rect(x + 4, top + 2, 2, 5, look.outfit); p.hline(x - 4, top - 2, 8, shade(look.outfit, 0.15)); break;
    case 'cap': p.rect(x - 5, top - 1, 10, 3, '#3a6ac0'); p.hline(x - 1, top + 2, 8, '#2a4a90'); p.px(x, top - 2, '#fff'); break;
    case 'helmet': p.rect(x - 5, top - 2, 10, 4, '#a8acb8'); p.hline(x - 5, top + 2, 10, '#7a7e90'); p.vline(x, top - 3, 2, '#c03030'); p.hline(x - 4, top - 2, 3, '#d8dce8'); break;
    case 'leaf': p.oval(x, top, 5, 2, '#4a9a2a'); p.px(x, top - 3, '#2a6a1a'); p.px(x - 3, top, '#6aca4a'); break;
    case 'beanie': p.rect(x - 5, top - 1, 10, 3, '#d86a2a'); p.hline(x - 5, top + 2, 10, '#a84a1a'); p.px(x, top - 2, '#fff'); p.px(x, top - 3, '#fff'); break;
    case 'tophat': p.rect(x - 4, top - 6, 8, 7, '#2a2a2a'); p.hline(x - 6, top + 1, 12, '#1a1a1a'); p.hline(x - 4, top - 1, 8, '#a02a2a'); break;
    case 'mushcap': p.oval(x, top - 1, 7, 3, '#d83a3a'); p.px(x - 3, top - 2, '#fff'); p.px(x + 2, top - 3, '#fff'); p.px(x + 4, top, '#fff'); break;
    case 'horns': p.rect(x - 5, top - 1, 10, 3, '#6a5040'); p.px(x - 6, top - 1, '#f0e8d0'); p.px(x - 7, top - 2, '#f0e8d0'); p.px(x - 7, top - 3, '#f0e8d0'); p.px(x + 5, top - 1, '#f0e8d0'); p.px(x + 6, top - 2, '#f0e8d0'); p.px(x + 6, top - 3, '#f0e8d0'); break;
    case 'chef': p.rect(x - 4, top - 4, 8, 5, '#fff'); p.oval(x, top - 5, 5, 2, '#fff'); p.hline(x - 4, top, 8, '#ddd'); break;
    case 'wizard': for (let i = 0; i < 8; i++) p.hline(x - 5 + Math.floor(i * 0.6), top + 1 - i, 10 - Math.floor(i * 1.2), '#3a3aa0'); p.px(x + 1, top - 7, '#3a3aa0'); p.px(x + 2, top - 8, '#3a3aa0'); p.px(x - 1, top - 3, '#ffe060'); p.px(x + 2, top - 1, '#ffe060'); p.hline(x - 6, top + 1, 12, '#2a2a80'); break;
    case 'hardhat': p.oval(x, top, 5, 2, '#f0c020'); p.hline(x - 6, top + 2, 12, '#d0a010'); p.px(x, top - 2, '#fff080'); break;
    case 'candlehelm': p.rect(x - 5, top - 1, 10, 3, '#c8a040'); p.hline(x - 5, top + 2, 10, '#8a6a20'); p.rect(x, top - 4, 2, 3, '#f0e8d0'); p.px(x, top - 5, '#ffb030'); p.px(x + 1, top - 6, '#ffe060'); break;
    case 'goggles': p.hline(x - 5, top + 2, 10, '#5a3a20'); p.rect(x - 4, top + 1, 3, 3, '#8ad8ff'); p.rect(x + 1, top + 1, 3, 3, '#8ad8ff'); p.px(x - 4, top + 1, '#fff'); for (let i = -4; i <= 4; i += 2) p.px(x + i, top - 1, '#3a3a3a'); break;
    case 'scarf': p.rect(x - 5, top, 10, 3, '#e05a8a'); p.px(x - 2, top + 1, '#fff'); p.px(x + 2, top, '#fff'); p.rect(x + 4, top + 3, 2, 3, '#e05a8a'); break;
    case 'visor': p.hline(x - 5, top + 1, 10, '#2aa04a'); p.hline(x - 2, top + 2, 9, '#2aa04a'); p.hline(x - 5, top, 10, '#fff'); break;
    case 'crown': p.rect(x - 4, top - 2, 8, 3, '#f0c020'); p.px(x - 4, top - 3, '#f0c020'); p.px(x, top - 3, '#f0c020'); p.px(x + 3, top - 3, '#f0c020'); p.px(x - 1, top - 1, '#e02a4a'); p.px(x + 2, top - 1, '#2a8ae0'); break;
    case 'bigcrown': p.rect(x - 5, top - 4, 10, 5, '#f0c020'); for (let i = -5; i <= 4; i += 3) { p.px(x + i, top - 5, '#f0c020'); p.px(x + i, top - 6, '#fff080'); } p.px(x, top - 2, '#e02a4a'); p.px(x - 3, top - 2, '#2a8ae0'); p.px(x + 3, top - 2, '#2ae08a'); p.hline(x - 5, top, 10, '#b08010'); break;
    case 'turban': p.oval(x, top, 6, 3, '#7a2aa0'); p.px(x, top - 1, '#ffe060'); p.px(x, top - 2, '#e02a4a'); p.hline(x - 5, top + 1, 10, '#5a1a80'); break;
    case 'pirate': p.rect(x - 6, top - 2, 12, 3, '#2a2a2a'); p.rect(x - 3, top - 4, 6, 2, '#2a2a2a'); p.px(x, top - 2, '#fff'); p.hline(x - 6, top + 1, 12, '#c8a040'); break;
    case 'fancy': p.oval(x, top - 1, 6, 2, '#a0306a'); p.px(x + 3, top - 4, '#fff'); p.px(x + 4, top - 5, '#fff'); p.px(x + 5, top - 6, '#ffe0f0'); break;
    case 'ratcrown': p.rect(x - 4, top - 2, 8, 3, '#8a8a8a'); p.px(x - 4, top - 3, '#8a8a8a'); p.px(x + 3, top - 3, '#8a8a8a'); p.px(x - 2, top - 4, '#c0a0a0'); p.px(x + 1, top - 4, '#c0a0a0'); break;
    case 'spikes': for (let i = -4; i <= 4; i += 2) { p.vline(x + i, top - 3, 3, '#2a5a3a'); p.px(x + i, top - 4, '#4a8a5a'); } break;
    case 'stars': p.px(x - 4, top - 3, '#fff8c0'); p.px(x + 3, top - 4, '#fff8c0'); p.px(x, top - 6, '#ffe060'); p.px(x + 5, top - 1, '#ffe060'); p.px(x - 6, top, '#fff'); break;
    case 'headphones': p.hline(x - 4, top - 1, 8, '#2a2a3a'); p.px(x - 5, top, '#2a2a3a'); p.px(x + 4, top, '#2a2a3a'); p.rect(x - 7, top + 2, 3, 4, '#e0306a'); p.rect(x + 4, top + 2, 3, 4, '#e0306a'); p.px(x - 6, top + 3, '#ff80b0'); p.px(x + 5, top + 3, '#ff80b0'); break;
    case 'nurse': p.rect(x - 4, top - 2, 8, 3, '#ffffff'); p.hline(x - 5, top + 1, 10, '#e8e8e8'); p.px(x, top - 2, '#e02a3a'); p.hline(x - 1, top - 1, 3, '#e02a3a'); p.px(x, top, '#e02a3a'); break;
    case 'dragonhelm': p.rect(x - 5, top - 2, 10, 4, '#a03020'); p.hline(x - 5, top + 2, 10, '#702010'); p.px(x - 6, top - 3, '#f0e8d0'); p.px(x + 5, top - 3, '#f0e8d0'); p.px(x - 7, top - 4, '#f0e8d0'); p.px(x + 6, top - 4, '#f0e8d0'); p.px(x - 2, top - 1, '#ffd040'); p.px(x + 1, top - 1, '#ffd040'); break;
  }
}

export function drawGoblin(ctx, look, frame = 0, opts = {}) {
  const p = P(ctx);
  const skin = look.skin || '#6cbf45';
  const skD = shade(skin, -0.25), skL = shade(skin, 0.2);
  const out = look.outfit || '#8a5a32';
  const ouD = shade(out, -0.3);
  const cx = 13;
  let bob = 0, legL = 0, legR = 0, armUp = false, cheer = false, blink = false;
  if (frame === 1) blink = true;
  if (frame >= 2 && frame <= 5) { const f = frame - 2; bob = f % 2 ? 1 : 0; legL = f === 0 ? -1 : f === 2 ? 1 : 0; legR = -legL; }
  if (frame === 6) { armUp = true; }
  if (frame === 7) { bob = 1; }
  if (frame === 8) { cheer = true; bob = -1; }
  const big = look.extra === 'belly';
  const ghost = look.extra === 'ghost';

  // tail (behind)
  if (look.extra === 'tail') { p.rect(cx + 4, 22 + bob, 5, 2, skin); p.px(cx + 9, 21 + bob, skin); p.px(cx + 9, 20 + bob, skD); }
  // cape (behind)
  if (look.extra && look.extra.startsWith('cape')) {
    const cc = look.extra === 'cape_red' ? '#c02a3a' : '#6a2aa0';
    p.rect(cx - 6, 15 + bob, 12, 9, shade(cc, -0.2)); p.px(cx - 6, 24, shade(cc, -0.2)); p.px(cx + 5, 24, shade(cc, -0.2));
  }
  // legs
  const legC = shade(out, -0.4);
  if (!ghost) {
    p.rect(cx - 3, 22 + legL, 2, 3 - legL, legC);
    p.rect(cx + 1, 22 + legR, 2, 3 - legR, legC);
    p.rect(cx - 4, 25 + Math.min(0, legL), 3, 1, '#4a3020');
    p.rect(cx + 1, 25 + Math.min(0, legR), 3, 1, '#4a3020');
  } else {
    p.rect(cx - 3, 22, 6, 2, out); p.px(cx - 3, 24, out); p.px(cx, 24, out); p.px(cx + 2, 24, out);
  }
  // body
  const bw = big ? 10 : 8;
  p.rect(cx - bw / 2, 16 + bob, bw, 6, out);
  if (big) { p.oval(cx, 19 + bob, 5, 3, skin); p.px(cx, 19 + bob, skD); }
  p.hline(cx - bw / 2, 16 + bob, bw, shade(out, 0.15));
  p.hline(cx - bw / 2, 20 + bob, bw, ouD);
  p.px(cx, 20 + bob, '#c8a040');
  if (look.extra === 'scarf') { p.hline(cx - 4, 16 + bob, 8, '#3a8ae0'); p.px(cx + 2, 17 + bob, '#3a8ae0'); p.px(cx + 2, 18 + bob, '#3a8ae0'); }
  // arms
  if (cheer) {
    p.rect(cx - 6, 12 + bob, 2, 5, skin); p.rect(cx + 4, 12 + bob, 2, 5, skin);
  } else {
    p.rect(cx - 6, 16 + bob, 2, 4, skin); p.px(cx - 6, 20 + bob, skD);
    if (armUp) { p.rect(cx + 4, 13 + bob, 2, 4, skin); }
    else { p.rect(cx + 4, 16 + bob, 2, 4, skin); p.px(cx + 5, 20 + bob, skD); }
  }
  // head
  const hy = 7 + bob;
  // ears
  const earLen = 4 + (look.ears || 0);
  for (let i = 0; i < earLen; i++) {
    const h = Math.max(1, 3 - Math.floor(i * 3 / earLen));
    p.rect(cx - 5 - i, hy + 3 - Math.floor(i / 2), 1, h, i === earLen - 1 ? skD : skin);
    p.rect(cx + 4 + i, hy + 3 - Math.floor(i / 2), 1, h, i === earLen - 1 ? skD : skin);
  }
  p.px(cx - 6, hy + 4, shade(skin, -0.1)); p.px(cx + 5, hy + 4, shade(skin, -0.1));
  // skull
  p.rect(cx - 4, hy + 1, 8, 7, skin);
  p.hline(cx - 3, hy, 6, skin);
  p.hline(cx - 3, hy + 8, 6, skin);
  p.hline(cx - 3, hy, 6, skL);
  p.px(cx - 4, hy + 1, skL);
  p.vline(cx + 3, hy + 2, 5, skD);
  // eyes
  const eyeC = ['#ffe040', '#ff5a3a', '#f8f8f8'][look.eyes || 0];
  if (blink) { p.hline(cx - 3, hy + 4, 2, '#1a1a1a'); p.hline(cx + 1, hy + 4, 2, '#1a1a1a'); }
  else {
    p.rect(cx - 3, hy + 3, 2, 2, eyeC); p.rect(cx + 1, hy + 3, 2, 2, eyeC);
    p.px(cx - 2, hy + 4, '#1a1a1a'); p.px(cx + 2, hy + 4, '#1a1a1a');
  }
  p.hline(cx - 3, hy + 2, 2, skD); p.hline(cx + 1, hy + 2, 2, skD); // brows
  // nose
  const nose = look.nose || 0;
  p.rect(cx - 1, hy + 4, 2, 2 + (nose === 2 ? 1 : 0), skD);
  if (nose >= 1) p.px(cx + 1, hy + 5, skD);
  if (nose === 3) { p.rect(cx - 1, hy + 4, 3, 3, skD); p.px(cx + 2, hy + 7, skD); }
  // mouth
  const mouthY = hy + 7;
  if (cheer) { p.rect(cx - 2, mouthY - 1, 4, 2, '#5a1a1a'); p.px(cx - 2, mouthY - 1, '#fff'); p.px(cx + 1, mouthY - 1, '#fff'); }
  else {
    p.hline(cx - 3, mouthY, 6, '#3a1a1a');
    const t = look.teeth || 0;
    p.px(cx - 2, mouthY, '#fff');
    if (t >= 1) p.px(cx + 1, mouthY, '#fff');
    if (t >= 2) p.px(cx + 1, mouthY - 1, '#fff');
  }
  // extras on face
  if (look.extra === 'beard') { p.rect(cx - 3, hy + 8, 6, 2, '#8a8a8a'); p.px(cx - 1, hy + 10, '#8a8a8a'); p.px(cx, hy + 10, '#8a8a8a'); }
  if (look.extra === 'eyepatch') { p.rect(cx + 1, hy + 3, 2, 2, '#1a1a1a'); p.hline(cx - 4, hy + 2, 8, '#1a1a1a'); }
  if (look.extra === 'monocle') { p.px(cx + 3, hy + 3, '#e8c040'); p.px(cx + 3, hy + 4, '#e8c040'); p.vline(cx + 3, hy + 5, 4, '#c8a040'); }
  if (look.extra === 'glasses') { p.hline(cx - 4, hy + 3, 8, '#3a3a3a'); }
  if (look.extra === 'mask') { p.hline(cx - 4, hy + 3, 8, '#1a1a1a'); p.hline(cx - 4, hy + 4, 1, '#1a1a1a'); p.hline(cx + 3, hy + 4, 1, '#1a1a1a'); p.px(cx - 2, hy + 3, eyeC); p.px(cx + 2, hy + 3, eyeC); }
  if (look.extra === 'earrings') { p.px(cx - 6, hy + 6, '#f0c020'); p.px(cx + 5, hy + 6, '#f0c020'); }
  if (look.extra === 'warpaint') { p.vline(cx - 3, hy + 5, 2, '#c02020'); p.vline(cx + 2, hy + 5, 2, '#c02020'); }
  if (look.extra === 'soot') { p.px(cx - 3, hy + 6, '#3a3a3a'); p.px(cx + 2, hy + 1, '#3a3a3a'); p.px(cx + 3, hy + 6, '#3a3a3a'); }
  if (look.extra === 'cosmic') { p.px(cx - 2, hy + 1, '#fff'); p.px(cx + 3, hy + 6, '#fff'); p.px(cx - 4, hy + 6, '#ffe0ff'); }
  // hat
  if (look.hat && look.hat !== 'none') drawHat(p, look.hat, cx, hy - 1, look);
  // shoulder pets
  if (look.extra === 'rats') { p.rect(cx - 7, 14 + bob, 3, 2, '#8a8a8a'); p.px(cx - 8, 14 + bob, '#ffb0b0'); p.px(cx - 7, 13 + bob, '#8a8a8a'); }
  if (look.extra === 'babydragon') { p.rect(cx - 8, 13 + bob, 4, 3, '#d04a2a'); p.px(cx - 9, 13 + bob, '#d04a2a'); p.px(cx - 8, 12 + bob, '#ffd040'); p.px(cx - 5, 12 + bob, '#f08060'); }
  // tool
  if (!cheer) {
    const toolUp = frame === 6;
    drawTool(p, look.tool, cx + 5, (toolUp ? 13 : 19) + bob, toolUp, look);
  }
  if (ghost) {
    // translucent shimmer
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = 'rgba(200,230,255,0.35)';
    ctx.fillRect(0, 0, GOB_W, GOB_H);
    ctx.globalCompositeOperation = 'source-over';
  }
}

export function lookKey(look) { return JSON.stringify(look); }

export function goblinSheet(look) {
  const key = 'g' + lookKey(look);
  if (cache.has(key)) return cache.get(key);
  const sheet = makeCanvas(GOB_W * GOB_FRAMES, GOB_H);
  const sctx = sheet.getContext('2d');
  for (let f = 0; f < GOB_FRAMES; f++) {
    const c = makeCanvas(GOB_W, GOB_H);
    drawGoblin(c.getContext('2d'), look, f);
    outline(c);
    sctx.drawImage(c, f * GOB_W, 0);
  }
  // flipped version
  const flip = makeCanvas(sheet.width, GOB_H);
  const fctx = flip.getContext('2d');
  for (let f = 0; f < GOB_FRAMES; f++) {
    fctx.save();
    fctx.translate(f * GOB_W + GOB_W, 0);
    fctx.scale(-1, 1);
    fctx.drawImage(sheet, f * GOB_W, 0, GOB_W, GOB_H, 0, 0, GOB_W, GOB_H);
    fctx.restore();
  }
  const res = { sheet, flip };
  cache.set(key, res);
  return res;
}

// Portrait (big, for UI): returns dataURL
export function goblinPortrait(look, scale = 4, frame = 0) {
  const key = 'p' + scale + frame + lookKey(look);
  if (cache.has(key)) return cache.get(key);
  const { sheet } = goblinSheet(look);
  const c = makeCanvas(GOB_W * scale, GOB_H * scale);
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(sheet, frame * GOB_W, 0, GOB_W, GOB_H, 0, 0, GOB_W * scale, GOB_H * scale);
  const url = c.toDataURL();
  cache.set(key, url);
  return url;
}

// ================================================================ BUILDINGS
// Each building function draws into a canvas of w*16 x (h*16+extra). Bottom-aligned.
export const B_EXTRA = 20; // extra height above footprint for roofs etc.

const TIER_TRIM = ['#8a5a30', '#a07040', '#c8a040', '#e8c040', '#ffd860'];

function groundShadow(p, w, h) {
  p.ctx.fillStyle = 'rgba(0,0,0,0.22)';
  p.ctx.beginPath();
  p.ctx.ellipse(w / 2, h - 4, w / 2 - 1, 5, 0, 0, Math.PI * 2);
  p.ctx.fill();
}

function house(p, x, y, w, h, wall, roofC, opts = {}) {
  // generic house: wall body from y to y+h, roof above
  const rh = opts.roofH || Math.round(w * 0.45);
  if (opts.stone) p.stones(x, y, w, h, wall, opts.seed || 3); else if (opts.brick) p.bricks(x, y, w, h, wall); else p.planks(x, y, w, h, wall);
  p.vline(x, y, h, shade(wall, -0.35)); p.vline(x + w - 1, y, h, shade(wall, -0.35));
  p.roof(x - 2, y - rh, w + 4, rh, roofC, opts.thatch ? 'thatch' : 'shingle');
  return rh;
}

const BUILD_DRAW = {
  shroom(p, W, H, t) {
    // dirt patch with mushrooms; grows with tier
    p.oval(W / 2, H - 12, W / 2 - 3, 9, '#6a4a2a');
    p.oval(W / 2, H - 13, W / 2 - 5, 7, '#7a5a34');
    for (let i = 0; i < 18; i++) p.px(6 + (i * 13) % (W - 12), H - 18 + (i * 7) % 12, '#5a3a20');
    const R = rng(7);
    const n = 9 + t * 4;
    const shrooms = [];
    for (let i = 0; i < n; i++) shrooms.push([8 + R() * (W - 16), H - 20 + R() * 14, 2 + Math.floor(R() * (2 + t)), R()]);
    shrooms.sort((a, b) => a[1] - b[1]);
    for (const [x, y, s, c] of shrooms) {
      const cap = c < 0.6 ? '#d83a3a' : c < 0.85 ? '#c070e0' : '#e8a030';
      p.rect(x - 1, y - s, 2, s + 1, '#f0e8d0');
      p.oval(x, y - s - 1, s + 1, Math.max(1, Math.floor(s / 2) + 1), cap);
      p.px(x - 1, y - s - 2, '#fff');
    }
    // giant mushroom at higher tiers
    if (t >= 2) {
      const gx = W - 14, gy = H - 14;
      p.rect(gx - 2, gy - 14, 5, 15, '#f0e8d0'); p.vline(gx + 2, gy - 14, 15, '#d0c8b0');
      p.oval(gx, gy - 17, 9, 5, t >= 4 ? '#f0c020' : '#d83a3a');
      p.px(gx - 4, gy - 19, '#fff'); p.px(gx + 3, gy - 20, '#fff'); p.px(gx, gy - 18, '#fff'); p.px(gx + 6, gy - 17, '#fff');
      p.rect(gx - 1, gy - 8, 3, 3, '#5a3a20'); // door
    }
    // fence
    for (let x = 3; x < W - 3; x += 4) { p.vline(x, H - 9, 4, '#8a5a30'); }
    p.hline(3, H - 8, W - 6, '#a07040');
    p.sign(4, H - 26, 9, 6); p.px(7, H - 24, '#d83a3a'); p.px(8, H - 24, '#d83a3a'); p.px(8, H - 23, '#fff');
    p.vline(8, H - 20, 6, '#5a4030');
  },
  mine(p, W, H, t) {
    // rocky hill with tunnel entrance, rails, cart
    const rock = '#8a7a6a';
    for (let i = 0; i < 24; i++) {
      const ww = W - 6 - i * 1.4;
      if (ww <= 0) break;
      p.hline(W / 2 - ww / 2, H - 8 - i, ww, i % 3 === 0 ? shade(rock, -0.1) : rock);
    }
    const R = rng(3);
    for (let i = 0; i < 30; i++) p.px(6 + R() * (W - 12), H - 30 + R() * 22, R() < 0.5 ? '#6a5a4a' : '#a89a8a');
    // gold veins
    for (let i = 0; i < 4 + t * 3; i++) p.px(8 + R() * (W - 16), H - 28 + R() * 18, '#f0c030');
    // tunnel
    p.oval(W / 2, H - 14, 7, 7, '#1a1218');
    p.rect(W / 2 - 7, H - 14, 15, 7, '#1a1218');
    p.rect(W / 2 - 8, H - 22, 2, 15, '#8a5a30'); p.rect(W / 2 + 7, H - 22, 2, 15, '#8a5a30');
    p.rect(W / 2 - 8, H - 23, 17, 2, '#a07040');
    p.px(W / 2 - 4, H - 19, '#ffb030'); p.px(W / 2 + 3, H - 19, '#ffb030'); // lanterns
    // rails
    p.hline(W / 2 - 5, H - 7, 22, '#6a6a7a'); p.hline(W / 2 - 5, H - 5, 22, '#6a6a7a');
    for (let x = W / 2 - 5; x < W / 2 + 17; x += 3) p.vline(x, H - 7, 3, '#5a3a20');
    // cart with gold
    const cxp = W / 2 + 6;
    p.rect(cxp, H - 12, 8, 5, '#6a5040'); p.hline(cxp, H - 12, 8, '#8a7060');
    p.coinPile(cxp, H - 12, 8);
    p.px(cxp + 1, H - 6, '#2a2a2a'); p.px(cxp + 6, H - 6, '#2a2a2a');
    if (t >= 1) p.flag(6, H - 34, '#c03030');
    if (t >= 3) { p.rect(4, H - 14, 8, 6, '#6a5040'); p.coinPile(4, H - 14, 8); }
    if (t >= 4) { p.coinPile(W - 12, H - 8, 9); }
  },
  tavern(p, W, H, t) {
    const x = 4, w = W - 8, y = H - 26 - (t >= 3 ? 8 : 0), h = H - 8 - y;
    house(p, x, y, w, h, '#9a6a3a', t >= 2 ? '#8a3a2a' : '#6a4a2a', { thatch: t < 2 });
    p.door(W / 2 - 3, H - 16, 6, 8);
    p.window(x + 4, y + 5); p.window(x + w - 7, y + 5);
    if (t >= 3) { p.window(x + 4, y + 13); p.window(x + w - 7, y + 13); }
    // mug sign
    p.vline(x + w, y + 2, 3, '#5a4030');
    p.sign(x + w - 3, y + 4, 8, 7, '#c8a040');
    p.rect(x + w - 1, y + 6, 3, 3, '#a07040'); p.hline(x + w - 1, y + 6, 3, '#fff8e0'); p.px(x + w + 2, y + 7, '#a07040');
    // barrels
    p.rect(x - 2, H - 14, 5, 6, '#8a5a30'); p.hline(x - 2, H - 12, 5, '#5a3a20'); p.hline(x - 2, H - 10, 5, '#5a3a20');
    if (t >= 1) { p.rect(x + w - 3, H - 14, 5, 6, '#8a5a30'); p.hline(x + w - 3, H - 12, 5, '#5a3a20'); }
    // chimney
    p.rect(x + w - 8, y - 14, 4, 8, '#7a6a6a');
    if (t >= 4) p.flag(W / 2, y - 24, '#f0c020');
  },
  smithy(p, W, H, t) {
    const x = 4, w = W - 14, y = H - 24, h = 16;
    house(p, x, y, w, h, '#7a7a8a', '#4a4a5a', { stone: true, seed: 5, roofH: 10 });
    p.rect(x + 3, H - 16, 8, 8, '#2a1a1a'); // forge opening
    p.rect(x + 4, H - 13, 6, 4, '#ff7a20'); p.hline(x + 4, H - 13, 6, '#ffd040');
    // chimney
    p.rect(x + w - 6, y - 18, 5, 12, '#5a5a6a'); p.hline(x + w - 7, y - 18, 7, '#4a4a5a');
    // anvil outside
    const ax = W - 9;
    p.rect(ax - 3, H - 13, 8, 2, '#3a3a4a'); p.rect(ax - 1, H - 11, 4, 3, '#3a3a4a'); p.rect(ax - 2, H - 8, 6, 1, '#2a2a3a'); p.px(ax + 4, H - 13, '#3a3a4a');
    // weapons rack
    p.vline(W - 3, H - 22, 14, '#8a5a30'); p.vline(W - 5, H - 20, 10, '#c8ccd8'); p.vline(W - 2, H - 19, 9, '#c8ccd8');
    if (t >= 2) { p.rect(W - 14, H - 9, 6, 2, '#c8ccd8'); }
    if (t >= 1) p.flag(x + 2, y - 18, '#3a6ac0');
    if (t >= 3) { p.rect(x, y - 2, w, 2, '#c8a040'); }
  },
  potion(p, W, H, t) {
    // purple tower with bubbling
    const tx = W / 2 - 8, tw = 16, ty = H - 34 - t * 3;
    p.bricks(tx, ty, tw, H - 8 - ty, '#7a5aa0');
    p.vline(tx, ty, H - 8 - ty, '#5a3a80'); p.vline(tx + tw - 1, ty, H - 8 - ty, '#5a3a80');
    // pointy roof
    for (let i = 0; i < 14; i++) p.hline(tx - 2 + Math.floor(i * 0.7), ty - 1 - i, tw + 4 - Math.floor(i * 1.4), i % 3 ? '#3a8a5a' : '#2a6a4a');
    p.px(W / 2 - 1, ty - 16, '#ffe060');
    p.door(W / 2 - 3, H - 16, 6, 8, '#4a2a6a');
    p.window(W / 2 - 1, ty + 5, 2, 3, '#7aff8a');
    // shop stall at side with potion bottles
    p.rect(2, H - 15, 10, 7, '#8a5a30'); p.hline(2, H - 15, 10, '#a07040');
    const cols = ['#ff5a8a', '#5af06a', '#5ac0ff', '#ffd040'];
    for (let i = 0; i < 4; i++) { p.rect(3 + i * 2 + (i > 1 ? 1 : 0), H - 18, 1, 3, cols[i]); }
    // cauldron right
    p.oval(W - 7, H - 11, 5, 3, '#2a2a2a'); p.oval(W - 7, H - 13, 4, 1, '#7aff8a');
    if (t >= 2) { p.oval(W / 2, ty - 18, 2, 2, '#c070ff'); }
    if (t >= 4) { p.hline(tx, ty + 2, tw, '#f0c020'); }
  },
  market(p, W, H, t) {
    // several stalls with striped awnings
    const cols = ['#e04a4a', '#3a8ae0', '#f0c020', '#4ac06a'];
    const n = 2 + Math.min(2, t);
    const sw = Math.floor((W - 6) / n);
    for (let i = 0; i < n; i++) {
      const x = 3 + i * sw, y = H - 22 - (i % 2) * 3;
      p.rect(x + 1, y + 4, sw - 3, H - 9 - (y + 4), '#8a5a30');
      p.vline(x + 1, y, H - 8 - y, '#5a3a20'); p.vline(x + sw - 3, y, H - 8 - y, '#5a3a20');
      for (let k = 0; k < sw - 1; k++) p.vline(x + k, y, 4, k % 4 < 2 ? cols[i % 4] : '#fff');
      p.hline(x, y + 4, sw - 1, shade(cols[i % 4], -0.3));
      // goods
      const R = rng(i + 9);
      for (let k = 0; k < 4; k++) p.rect(x + 3 + k * 3, y + 6, 2, 2, ['#f0c020', '#d83a3a', '#7ad04a', '#c8ccd8'][Math.floor(R() * 4)]);
    }
    p.rect(2, H - 10, W - 4, 2, '#a07040');
    if (t >= 1) p.flag(W - 6, H - 38, '#f0c020');
    if (t >= 3) { p.coinPile(4, H - 9, 7); p.coinPile(W - 12, H - 9, 7); }
  },
  casino(p, W, H, t) {
    const x = 3, w = W - 6, y = H - 30 - (t >= 3 ? 6 : 0), h = H - 8 - y;
    p.bricks(x, y, w, h, '#a0304a');
    p.vline(x, y, h, '#601a2a'); p.vline(x + w - 1, y, h, '#601a2a');
    // dome
    p.oval(W / 2, y, w / 2 - 2, 8, '#f0c020'); p.rect(x + 2, y, w - 4, 2, '#a0304a');
    p.oval(W / 2, y - 2, w / 2 - 6, 5, '#ffd860');
    p.px(W / 2, y - 9, '#ff3a6a'); p.px(W / 2, y - 10, '#fff');
    // lights
    for (let i = x + 1; i < x + w - 1; i += 2) p.px(i, y + 2, i % 4 === 1 ? '#ffe060' : '#ff6a8a');
    // giant dice sign
    p.rect(W / 2 - 4, y + 4, 8, 8, '#fff'); p.px(W / 2 - 2, y + 6, '#222'); p.px(W / 2 + 1, y + 9, '#222'); p.px(W / 2 - 1, y + 8, '#222');
    p.door(W / 2 - 4, H - 16, 8, 8, '#6a1a2a');
    p.window(x + 4, H - 20, 4, 4, '#ffe060'); p.window(x + w - 8, H - 20, 4, 4, '#ffe060');
    // rat statue
    p.rect(x + 1, H - 12, 4, 3, '#c8a040'); p.px(x, H - 12, '#c8a040'); p.px(x + 5, H - 11, '#c8a040');
    p.rect(x + w - 5, H - 12, 4, 3, '#c8a040'); p.px(x + w - 6, H - 12, '#c8a040');
  },
  thieves(p, W, H, t) {
    const x = 5, w = W - 10, y = H - 24, h = 16;
    house(p, x, y, w, h, '#4a4a5a', '#2a2a3a', { roofH: 11 });
    // crooked
    p.px(x + w, y - 3, '#2a2a3a');
    p.door(W / 2 - 3, H - 15, 6, 7, '#2a1a1a');
    p.window(x + 3, y + 4, 3, 2, '#c0ffa0');
    p.rect(x + w - 6, y + 4, 4, 3, '#1a1a1a');
    // sacks of loot
    p.oval(x - 1, H - 10, 3, 3, '#b09060'); p.px(x - 1, H - 13, '#5a4030');
    p.oval(x + w + 1, H - 10, 3, 3, '#b09060'); p.px(x + w + 1, H - 13, '#5a4030');
    if (t >= 2) p.coinPile(W / 2 - 4, H - 8, 8);
    // hanging dagger sign
    p.vline(x + 1, y - 1, 3, '#5a4030'); p.sign(x - 3, y + 1, 7, 5, '#3a3a4a'); p.hline(x - 2, y + 3, 5, '#c8ccd8');
    if (t >= 4) p.flag(W / 2, y - 20, '#1a1a1a');
  },
  bank(p, W, H, t) {
    const x = 4, w = W - 8, y = H - 28, h = 20;
    p.stones(x, y, w, h, '#c8c0b0', 11);
    // columns
    for (let cx = x + 2; cx < x + w - 2; cx += 6) { p.rect(cx, y + 3, 3, h - 3, '#e8e0d0'); p.vline(cx + 2, y + 3, h - 3, '#b8b0a0'); }
    // pediment
    for (let i = 0; i < 8; i++) p.hline(x - 2 + i * 2, y - i, w + 4 - i * 4, i % 2 ? '#d8d0c0' : '#c8c0b0');
    p.hline(x - 2, y + 1, w + 4, '#a8a090');
    p.rect(W / 2 - 3, y - 5, 6, 3, '#f0c020'); // coin emblem
    // vault door
    p.oval(W / 2, H - 13, 4, 4, '#7a7e90'); p.oval(W / 2, H - 13, 2, 2, '#c8ccd8'); p.px(W / 2, H - 13, '#3a3a4a');
    p.coinPile(x, H - 8, 6); p.coinPile(x + w - 6, H - 8, 6);
    if (t >= 2) p.coinPile(W / 2 - 8, H - 8, 5);
    if (t >= 3) { p.flag(x + 1, y - 14, '#f0c020'); p.flag(x + w - 2, y - 14, '#f0c020'); }
  },
  arena(p, W, H, t) {
    // round colosseum
    const cx = W / 2, cy = H - 18;
    p.oval(cx, cy, W / 2 - 2, 14, '#b8a080');
    p.oval(cx, cy - 2, W / 2 - 4, 12, '#c8b090');
    p.oval(cx, cy + 1, W / 2 - 10, 8, '#c8a060'); // sand floor
    // arches
    for (let a = 0; a < 10; a++) {
      const ang = Math.PI * (0.05 + a * 0.1);
      const ax = cx + Math.cos(ang) * (W / 2 - 4), ay = cy + Math.sin(ang) * 11;
      p.rect(ax - 1, ay - 2, 2, 3, '#5a4a3a');
    }
    p.hline(4, cy - 13, W - 8, '#a89070');
    // tiny fighters
    p.px(cx - 3, cy, '#6cbf45'); p.px(cx - 3, cy - 1, '#6cbf45'); p.px(cx + 3, cy, '#d83a3a'); p.px(cx + 3, cy - 1, '#d83a3a');
    p.px(cx, cy - 2, '#fff');
    // banners
    p.flag(6, cy - 24, '#c03030'); p.flag(W - 10, cy - 24, '#3a6ac0');
    if (t >= 2) p.flag(cx, cy - 28, '#f0c020');
  },
  alchemy(p, W, H, t) {
    const x = 6, w = W - 12, y = H - 26, h = 18;
    p.stones(x, y, w, h, '#5a6a5a', 13);
    // glass dome
    p.oval(W / 2, y, w / 2, 9, '#8ad8c0');
    p.oval(W / 2, y, w / 2 - 2, 7, '#aaf0d8');
    p.rect(x, y, w, 2, '#5a6a5a');
    p.px(W / 2 - 4, y - 5, '#fff'); p.px(W / 2 - 3, y - 6, '#fff');
    // tubes
    p.vline(x - 2, y - 4, h + 4, '#c8ccd8'); p.oval(x - 2, y - 5, 2, 2, '#7aff6a');
    p.vline(x + w + 1, y + 2, h - 2, '#c8ccd8'); p.oval(x + w + 1, y + 1, 2, 2, '#f0c020');
    p.door(W / 2 - 3, H - 15, 6, 7, '#2a3a2a');
    p.window(x + 3, y + 5, 3, 3, '#7aff6a'); p.window(x + w - 6, y + 5, 3, 3, '#7aff6a');
    // mud -> gold
    p.oval(x + 1, H - 9, 3, 2, '#5a3a20'); p.coinPile(x + w - 6, H - 8, 6);
  },
  hatchery(p, W, H, t) {
    // big nest with eggs, rocky volcano backdrop
    p.oval(W / 2, H - 22, W / 2 - 4, 16, '#5a3a3a');
    p.oval(W / 2, H - 26, W / 2 - 10, 10, '#6a4a4a');
    p.oval(W / 2, H - 34, 5, 3, '#ff6a20'); p.oval(W / 2, H - 35, 3, 1, '#ffd040');
    // nest
    p.oval(W / 2, H - 12, W / 2 - 6, 6, '#a07040');
    for (let i = 0; i < 20; i++) p.px(10 + (i * 11) % (W - 20), H - 15 + (i * 5) % 7, '#7a5030');
    // eggs
    const eggs = ['#e0a040', '#a040e0', '#40c0e0', '#e04060', '#f0f0f0'];
    for (let i = 0; i < 3 + Math.min(2, t); i++) {
      const ex = W / 2 - 12 + i * 6, ey = H - 15 - (i % 2);
      p.oval(ex, ey, 2, 3, eggs[i]); p.px(ex - 1, ey - 2, '#fff');
      p.px(ex + 1, ey + 1, shade(eggs[i], -0.3));
    }
    // baby dragon
    p.rect(W - 16, H - 14, 6, 4, '#d04a2a'); p.rect(W - 12, H - 17, 4, 3, '#d04a2a'); p.px(W - 10, H - 16, '#ffd040'); p.px(W - 14, H - 15, '#f08060'); p.px(W - 13, H - 16, '#f08060');
  },
  palace(p, W, H, t) {
    const x = 6, w = W - 12, y = H - 40, h = 32;
    p.bricks(x, y, w, h, '#e8d8b0');
    p.vline(x, y, h, '#b8a880'); p.vline(x + w - 1, y, h, '#b8a880');
    // gold trim
    p.hline(x, y, w, '#f0c020'); p.hline(x, y + 12, w, '#f0c020');
    // towers
    for (const tx of [x - 4, x + w - 4]) {
      p.bricks(tx, y - 10, 8, h + 10, '#e0d0a8');
      for (let i = 0; i < 10; i++) p.hline(tx - 1 + Math.floor(i / 2), y - 11 - i, 10 - Math.floor(i / 2) * 2, '#8a3aa0');
      p.px(tx + 3, y - 22, '#f0c020'); p.px(tx + 4, y - 22, '#f0c020');
      p.window(tx + 3, y, 2, 3, '#ffe060');
    }
    // central dome
    p.oval(W / 2, y - 2, 12, 10, '#f0c020');
    p.oval(W / 2 - 3, y - 6, 4, 3, '#ffe880');
    p.rect(W / 2 - 12, y - 2, 24, 3, '#e8d8b0');
    p.vline(W / 2, y - 16, 5, '#f0c020'); p.px(W / 2, y - 17, '#ff3a6a');
    // grand door
    p.oval(W / 2, H - 16, 5, 5, '#6a2a8a'); p.rect(W / 2 - 5, H - 16, 11, 8, '#6a2a8a'); p.vline(W / 2, H - 20, 12, '#4a1a6a');
    p.px(W / 2 - 2, H - 13, '#f0c020'); p.px(W / 2 + 2, H - 13, '#f0c020');
    for (let i = 0; i < 4; i++) p.window(x + 6 + i * ((w - 14) / 3), y + 5, 2, 4, '#ffe060');
    // stairs
    p.rect(W / 2 - 8, H - 8, 17, 2, '#d8c8a0');
    p.coinPile(x + 2, H - 8, 6); p.coinPile(x + w - 8, H - 8, 6);
    p.flag(W / 2 - 1, y - 28, '#f0c020');
  },
  cauldron(p, W, H, t) {
    // big bubbling cauldron on fire, with a rack
    const cx = W / 2, cy = H - 16;
    // fire
    p.oval(cx, H - 9, 9, 2, '#5a3a20');
    for (let i = -6; i <= 6; i += 3) { p.vline(cx + i, H - 12, 3, '#ff7a20'); p.px(cx + i, H - 13, '#ffd040'); }
    // pot
    p.oval(cx, cy, 13, 9, '#2a2a34');
    p.oval(cx - 3, cy + 2, 6, 3, '#3a3a48');
    p.hline(cx - 14, cy - 7, 29, '#4a4a5a');
    p.oval(cx, cy - 7, 12, 3, '#3a3a48');
    p.oval(cx, cy - 7, 11, 2, t >= 3 ? '#ff80ff' : '#6aff5a');
    p.px(cx - 4, cy - 8, '#d0ffd0'); p.px(cx + 3, cy - 7, '#d0ffd0'); p.px(cx + 7, cy - 8, '#d0ffd0');
    // legs
    p.rect(cx - 10, cy + 7, 2, 3, '#2a2a34'); p.rect(cx + 9, cy + 7, 2, 3, '#2a2a34');
    // rune circle
    if (t >= 2) for (let a = 0; a < 8; a++) p.px(cx + Math.cos(a * 0.785) * 18, H - 9 + Math.sin(a * 0.785) * 3, '#c070ff');
    // skull rack
    p.vline(4, H - 30, 22, '#5a4030'); p.hline(3, H - 30, 6, '#5a4030');
    p.rect(6, H - 28, 3, 3, '#f0e8d0'); p.px(6, H - 27, '#222'); p.px(8, H - 27, '#222');
  },
  huts(p, W, H, t) {
    // cluster of round mud huts, number grows with tier
    const spots = [[W / 2, H - 10, 10], [10, H - 14, 7], [W - 10, H - 14, 7], [W / 2 - 12, H - 22, 6], [W / 2 + 12, H - 22, 6]];
    const n = Math.min(spots.length, 2 + t);
    const order = spots.slice(0, n).sort((a, b) => a[1] - b[1]);
    for (const [x, y, r] of order) {
      p.oval(x, y - r / 2, r, r * 0.8, '#8a6a4a');
      p.oval(x - r / 3, y - r / 2 - 1, r / 2, r / 3, '#9a7a5a');
      // thatch top
      p.oval(x, y - r - 1, r * 0.8, r * 0.5, '#c8a050');
      p.px(x, y - r * 1.4, '#a08030');
      p.rect(x - 2, y - 4, 4, 4, '#3a2a1a');
    }
    // laundry line
    p.hline(4, H - 22, 12, '#5a4030');
    p.rect(6, H - 21, 2, 3, '#e04a4a'); p.rect(10, H - 21, 3, 2, '#4a8ae0');
  },
  lodge(p, W, H, t) {
    // big tent with flags and map board
    const cx = W / 2;
    for (let i = 0; i < 22; i++) {
      const ww = Math.round(i * 1.6) + 2;
      p.hline(cx - ww / 2, H - 30 + i, ww, i % 4 < 2 ? '#3a8a5a' : '#e8d8a0');
    }
    p.rect(cx - 3, H - 16, 6, 8, '#2a1a10');
    p.vline(cx, H - 36, 7, '#5a4030'); p.flag(cx, H - 38, '#e04a4a');
    // map board
    p.vline(W - 8, H - 20, 12, '#5a4030'); p.rect(W - 13, H - 22, 11, 8, '#f0e0b0');
    p.px(W - 11, H - 20, '#3a8a5a'); p.px(W - 8, H - 19, '#3a6ac0'); p.px(W - 6, H - 18, '#e04a4a'); p.hline(W - 11, H - 17, 6, '#a08060');
    // backpack
    p.rect(4, H - 13, 5, 5, '#8a5a30'); p.hline(4, H - 13, 5, '#a07040');
  },
  research(p, W, H, t) {
    const x = 5, w = W - 10, y = H - 24, h = 16;
    house(p, x, y, w, h, '#7a8a9a', '#3a5a8a', { roofH: 10 });
    p.door(x + 3, H - 15, 6, 7);
    p.window(x + w - 7, y + 4, 4, 3, '#a0e0ff');
    // gear on roof
    const gx = W / 2 + 4, gy = y - 6;
    p.oval(gx, gy, 4, 4, '#c8a040'); p.oval(gx, gy, 1, 1, '#5a4a2a');
    for (let a = 0; a < 8; a++) p.px(gx + Math.round(Math.cos(a * 0.785) * 5), gy + Math.round(Math.sin(a * 0.785) * 5), '#c8a040');
    // lightning rod
    p.vline(x + 4, y - 16, 10, '#c8ccd8'); p.px(x + 4, y - 17, '#ffe060');
    // junk pile
    p.rect(W - 8, H - 11, 5, 3, '#7a7e90'); p.px(W - 6, H - 12, '#c8a040'); p.px(W - 9, H - 9, '#8a5a30');
  },
  barracks(p, W, H, t) {
    // wooden palisade fort
    const x = 3, w = W - 6, y = H - 24;
    for (let i = x; i < x + w; i += 3) {
      p.rect(i, y, 3, H - 8 - y, '#8a5a30');
      p.px(i + 1, y - 1, '#8a5a30'); p.vline(i + 2, y, H - 8 - y, '#6a4020');
    }
    p.hline(x, y + 5, w, '#5a3a20'); p.hline(x, y + 12, w, '#5a3a20');
    // gate
    p.rect(W / 2 - 5, H - 18, 10, 10, '#4a2a10'); p.hline(W / 2 - 5, H - 18, 10, '#3a2010');
    p.vline(W / 2, H - 18, 10, '#3a2010');
    // tower top
    p.rect(W / 2 - 6, y - 8, 12, 8, '#7a5030'); p.hline(W / 2 - 7, y - 9, 14, '#5a3a20');
    p.window(W / 2 - 1, y - 6, 2, 2, '#ffd86a');
    // spears
    for (let i = 0; i < 3; i++) { p.vline(x + 1 + i * 2, y - 6, 6, '#c8ccd8'); }
    p.flag(W - 7, y - 12, '#c03030');
    if (t >= 2) { p.rect(x + w - 8, H - 12, 6, 4, '#7a7e90'); }
  },
  infirmary(p, W, H, t) {
    const x = 4, w = W - 8, y = H - 26 - (t >= 3 ? 6 : 0), h = H - 8 - y;
    house(p, x, y, w, h, '#e8e0d0', t >= 2 ? '#c03a3a' : '#a04a3a', { brick: true, roofH: 11 });
    p.door(W / 2 - 3, H - 16, 6, 8, '#8a6a4a');
    p.window(x + 4, y + 4, 3, 3, '#c8f0ff'); p.window(x + w - 7, y + 4, 3, 3, '#c8f0ff');
    if (t >= 3) { p.window(x + 4, y + 11, 3, 3, '#c8f0ff'); p.window(x + w - 7, y + 11, 3, 3, '#c8f0ff'); }
    // big red cross sign
    p.rect(W / 2 - 4, y - 9, 9, 9, '#ffffff'); p.rect(W / 2 - 1, y - 8, 3, 7, '#e02a3a'); p.rect(W / 2 - 3, y - 6, 7, 3, '#e02a3a');
    // beds outside
    p.rect(1, H - 12, 7, 3, '#ffffff'); p.rect(1, H - 13, 2, 2, '#f0d0d0'); p.vline(1, H - 9, 2, '#8a5a30'); p.vline(7, H - 9, 2, '#8a5a30');
    if (t >= 1) { p.rect(W - 8, H - 12, 7, 3, '#ffffff'); p.rect(W - 3, H - 13, 2, 2, '#f0d0d0'); p.vline(W - 8, H - 9, 2, '#8a5a30'); p.vline(W - 2, H - 9, 2, '#8a5a30'); }
    // herb pots
    p.rect(x + 1, H - 11, 3, 3, '#a05a30'); p.px(x + 2, H - 12, '#5ad04a'); p.px(x + 1, H - 13, '#5ad04a');
    if (t >= 4) p.flag(W / 2, y - 20, '#e02a3a');
  },
  dj(p, W, H, t) {
    // speakers, a little stage and the turntable desk (the DJ is drawn live on top)
    p.rect(2, H - 30, 7, 22, '#2a2a3a'); p.rect(W - 9, H - 30, 7, 22, '#2a2a3a');
    for (const sx of [5, W - 6]) { p.oval(sx, H - 24, 2, 2, '#5a5a6a'); p.px(sx, H - 24, '#1a1a1a'); p.oval(sx, H - 14, 3, 3, '#5a5a6a'); p.oval(sx, H - 14, 1, 1, '#1a1a1a'); }
    p.rect(1, H - 9, W - 2, 3, '#6a4a8a'); p.hline(1, H - 9, W - 2, '#9a6ac0');
    // desk
    p.rect(8, H - 17, W - 16, 9, '#3a2a4a'); p.hline(8, H - 17, W - 16, '#5a4a6a');
    p.oval(12, H - 18, 3, 1, '#1a1a1a'); p.oval(W - 12, H - 18, 3, 1, '#1a1a1a'); p.px(12, H - 18, '#e0306a'); p.px(W - 12, H - 18, '#30c0e0');
    for (let i = 0; i < 4; i++) p.px(14 + i * 1.5, H - 13, ['#ff5a5a', '#ffe060', '#5aff7a', '#5ac0ff'][i]);
    // light rig
    p.hline(2, H - 32, W - 4, '#4a4a5a');
    for (let i = 0; i < 4; i++) p.px(5 + i * 7, H - 31, ['#ff5aa0', '#5ac0ff', '#ffe060', '#7aff6a'][i]);
  },
  tower(p, W, H, t) {
    const tx = W / 2 - 6, tw = 12, ty = H - 44;
    p.stones(tx, ty, tw, H - 8 - ty, '#8a8a7a', 21);
    // battlements
    for (let i = 0; i < 4; i++) p.rect(tx - 2 + i * 4, ty - 4, 3, 4, '#9a9a8a');
    p.hline(tx - 2, ty, tw + 4, '#6a6a5a');
    p.window(W / 2 - 1, ty + 6, 2, 3); p.window(W / 2 - 1, ty + 18, 2, 3);
    p.door(W / 2 - 2, H - 15, 5, 7);
    p.flag(W / 2, ty - 14, '#3a6ac0');
    // spyglass goblin silhouette
    p.px(tx + 1, ty - 6, '#6cbf45'); p.px(tx + 2, ty - 6, '#c8a040');
    // wall segments
    p.stones(2, H - 16, tx - 3, 8, '#8a8a7a', 4); p.stones(tx + tw + 1, H - 16, W - tx - tw - 3, 8, '#8a8a7a', 6);
  },
};

// Decorations
const DECOR_DRAW = {
  // the Great Hoard on Hoard Hill: grows with your lifetime gold (tier 0-4)
  hoardmound(p, W, H, t) {
    const cx = W / 2, base = H - 6;
    const rw = 26 + t * 4, rh = 12 + t * 5;
    for (let i = 0; i < rh; i++) {
      const w = Math.round(rw * Math.sqrt(1 - Math.pow(i / rh, 1.6)));
      for (let x = -w; x <= w; x++) p.px(cx + x, base - i, ((x * 7 + i * 3) % 5 === 0) ? '#fff080' : ((x + i) % 3 === 0 ? '#d8a020' : '#f0c020'));
    }
    // coins rolling off the pile
    for (let k = 0; k < 10 + t * 4; k++) { const x = cx - rw - 4 + ((k * 23) % (rw * 2 + 8)), y = base - (k % 3); p.rect(x, y, 2, 1, '#e8b020'); }
    // gems & treasure poking out
    const gems = ['#e02a4a', '#2a8ae0', '#2ae08a', '#c050ff'];
    for (let k = 0; k < 4 + t * 2; k++) { const x = cx - rw + 6 + ((k * 17) % (rw * 2 - 12)), y = base - 2 - ((k * 5) % Math.max(3, rh - 4)); p.rect(x, y, 2, 2, gems[k % 4]); p.px(x, y, '#fff'); }
    // chest on the side
    p.rect(cx - rw - 2, base - 8, 9, 7, '#8a5a30'); p.hline(cx - rw - 2, base - 8, 9, '#a07040'); p.hline(cx - rw - 2, base - 5, 9, '#5a3a20'); p.px(cx - rw + 2, base - 5, '#f0c020');
    // dragon skull crowning the hoard
    const top = base - rh;
    p.rect(cx - 5, top - 7, 10, 6, '#f0e8d0'); p.rect(cx - 7, top - 4, 3, 2, '#f0e8d0'); p.rect(cx + 4, top - 4, 3, 2, '#f0e8d0');
    p.px(cx - 3, top - 5, '#1a1a1a'); p.px(cx + 2, top - 5, '#1a1a1a'); p.hline(cx - 3, top - 2, 6, '#c8c0b0');
    p.px(cx - 6, top - 9, '#f0e8d0'); p.px(cx - 7, top - 10, '#f0e8d0'); p.px(cx + 5, top - 9, '#f0e8d0'); p.px(cx + 6, top - 10, '#f0e8d0');
    if (t >= 2) { p.rect(cx - 3, top - 12, 6, 3, '#f0c020'); p.px(cx - 3, top - 13, '#f0c020'); p.px(cx, top - 13, '#f0c020'); p.px(cx + 2, top - 13, '#f0c020'); p.px(cx - 1, top - 11, '#e02a4a'); }
    if (t >= 4) { for (const [x, y] of [[cx - 14, top + 2], [cx + 12, top + 4], [cx + 2, top - 16]]) { p.px(x, y, '#fff'); p.px(x - 1, y, '#ffe060'); p.px(x + 1, y, '#ffe060'); p.px(x, y - 1, '#ffe060'); p.px(x, y + 1, '#ffe060'); } }
  },
  campfire(p, W, H) {
    p.oval(W / 2, H - 8, 7, 3, '#7a7a7a');
    p.oval(W / 2, H - 8, 5, 2, '#3a2a1a');
    p.hline(W / 2 - 5, H - 9, 10, '#8a5a30'); p.hline(W / 2 - 4, H - 8, 8, '#6a4020');
    // logs to sit on
    p.rect(2, H - 6, 6, 3, '#8a5a30'); p.rect(W - 8, H - 6, 6, 3, '#8a5a30');
  },
  chiefhut(p, W, H) {
    p.oval(W / 2, H - 14, 13, 10, '#8a6a4a');
    p.oval(W / 2, H - 24, 11, 7, '#c8a050');
    p.oval(W / 2, H - 28, 6, 4, '#d8b060');
    p.rect(W / 2 - 3, H - 14, 6, 8, '#3a2a1a');
    // skull on top
    p.rect(W / 2 - 1, H - 35, 3, 3, '#f0e8d0'); p.px(W / 2 - 1, H - 34, '#222'); p.px(W / 2 + 1, H - 34, '#222');
    p.vline(W / 2, H - 32, 2, '#5a4030');
    p.flag(W / 2 + 10, H - 30, '#6cbf45');
  },
  fountain(p, W, H) {
    p.oval(W / 2, H - 9, 13, 5, '#9a9a9a'); p.oval(W / 2, H - 9, 11, 4, '#4a9ae0');
    p.rect(W / 2 - 1, H - 22, 3, 12, '#b8b8b8');
    p.oval(W / 2, H - 22, 4, 2, '#9a9a9a');
    // goblin statue peeing water, classic
    p.rect(W / 2 - 1, H - 28, 3, 5, '#a8a8a8'); p.px(W / 2 - 2, H - 27, '#a8a8a8'); p.px(W / 2 + 2, H - 27, '#a8a8a8');
    p.px(W / 2 + 2, H - 24, '#8ad0ff'); p.px(W / 2 + 3, H - 22, '#8ad0ff'); p.px(W / 2 + 4, H - 19, '#8ad0ff'); p.px(W / 2 + 4, H - 16, '#8ad0ff');
  },
  statue(p, W, H) {
    p.rect(W / 2 - 6, H - 12, 12, 5, '#9a9a8a'); p.hline(W / 2 - 6, H - 12, 12, '#bababa');
    // goblin hero statue (gold)
    const g = '#d8b030', gd = '#a88020';
    p.rect(W / 2 - 3, H - 22, 6, 10, g); p.rect(W / 2 - 4, H - 30, 8, 7, g);
    p.px(W / 2 - 6, H - 28, g); p.px(W / 2 - 5, H - 27, g); p.px(W / 2 + 5, H - 28, g); p.px(W / 2 + 4, H - 27, g);
    p.vline(W / 2 + 4, H - 38, 14, gd); p.px(W / 2 + 4, H - 39, '#fff080');
    p.px(W / 2 - 2, H - 27, gd); p.px(W / 2 + 1, H - 27, gd);
  },
};

export function buildingSprite(id, w, h, tier = 0, isDecor = false) {
  const key = `b:${id}:${tier}`;
  if (cache.has(key)) return cache.get(key);
  const W = w * TILE, H = h * TILE + B_EXTRA;
  const c = makeCanvas(W, H);
  const p = P(c.getContext('2d'));
  const fn = (isDecor ? DECOR_DRAW : BUILD_DRAW)[id];
  const tmp = makeCanvas(W, H);
  const tp = P(tmp.getContext('2d'));
  if (fn) fn(tp, W, H, tier);
  if (!isDecor && tier >= 2) {
    // lantern posts flank upgraded buildings
    for (const lx of [1, W - 3]) {
      tp.vline(lx, H - 19, 12, '#4a3a2a'); tp.rect(lx - 1, H - 22, 3, 3, '#3a2a2a'); tp.px(lx, H - 21, '#ffd860');
    }
  }
  if (!isDecor && tier >= 3) { tp.coinPile(3, H - 6, 5); tp.coinPile(W - 8, H - 6, 5); }
  if (!isDecor && tier >= 4) outline(tmp, '#ffd860');
  outline(tmp);
  groundShadow(p, W, H);
  if (!isDecor && tier >= 1) {
    // stone foundation that grows fancier with tier
    const fc = tier >= 4 ? '#d8c890' : tier >= 2 ? '#a8a49a' : '#8a7a62';
    p.stones(3, H - 9, W - 6, 5, fc, 9 + tier);
    p.hline(3, H - 9, W - 6, shade(fc, 0.25));
  }
  c.getContext('2d').drawImage(tmp, 0, 0);
  if (tier >= 4 && !isDecor) {
    const p2 = P(c.getContext('2d'));
    for (const [sx, sy] of [[4, H - 30], [W - 6, H - 40], [W / 2 + 7, H - 46]]) { p2.px(sx, sy, '#fff8c0'); p2.px(sx - 1, sy, '#ffe060'); p2.px(sx + 1, sy, '#ffe060'); p2.px(sx, sy - 1, '#ffe060'); p2.px(sx, sy + 1, '#ffe060'); }
  }
  cache.set(key, c);
  return c;
}

export function scaffoldSprite(w, h) {
  const key = `scaf:${w}:${h}`;
  if (cache.has(key)) return cache.get(key);
  const W = w * TILE, H = h * TILE + B_EXTRA;
  const c = makeCanvas(W, H);
  const p = P(c.getContext('2d'));
  p.oval(W / 2, H - 10, W / 2 - 3, 6, '#7a5a34');
  const top = H - 34;
  for (let x = 6; x < W - 4; x += 8) p.vline(x, top, H - 8 - top, '#a07040');
  for (let y = top; y < H - 8; y += 7) p.hline(4, y, W - 8, '#8a5a30');
  for (let i = 0; i < 4; i++) p.px(8 + i * 5, top + 3 + i * 4, '#a07040');
  p.rect(W / 2 - 6, H - 14, 12, 6, '#c8a060'); // planks pile
  p.hline(W / 2 - 6, H - 12, 12, '#a07040');
  outline(c);
  cache.set(key, c);
  return c;
}

export function plotSprite(w, h) {
  const key = `plot:${w}:${h}`;
  if (cache.has(key)) return cache.get(key);
  const W = w * TILE, H = h * TILE + B_EXTRA;
  const c = makeCanvas(W, H);
  const p = P(c.getContext('2d'));
  // dirt plot with stakes and rope
  p.rect(4, H - 4 - (h * TILE - 10), W - 8, h * TILE - 12, 'rgba(110,80,50,0.55)');
  const top = H - 4 - (h * TILE - 10);
  for (const [x, y] of [[4, top], [W - 5, top], [4, H - 16], [W - 5, H - 16]]) { p.vline(x, y - 3, 6, '#8a5a30'); p.px(x, y - 3, '#a07040'); }
  for (let x = 5; x < W - 5; x += 2) { p.px(x, top - 1, '#e8d8a0'); p.px(x, H - 18, '#e8d8a0'); }
  // sign
  p.vline(W / 2, H - 26, 10, '#5a4030');
  p.sign(W / 2 - 7, H - 32, 14, 8, '#c8a060');
  p.hline(W / 2 - 5, H - 29, 10, '#5a4030'); p.hline(W / 2 - 4, H - 27, 6, '#5a4030');
  cache.set(key, c);
  return c;
}

// ================================================================ ENEMIES
export function enemySprite(kind, tint, boss) {
  const key = `e:${kind}:${tint}:${boss}`;
  if (cache.has(key)) return cache.get(key);
  const W = 32, H = 32;
  const c = makeCanvas(W, H);
  const p = P(c.getContext('2d'));
  const humanoid = (skin, body, opts = {}) => {
    const cx = 16;
    p.rect(cx - 3, 24, 2, 6, opts.legs || shade(body, -0.3)); p.rect(cx + 1, 24, 2, 6, opts.legs || shade(body, -0.3));
    p.rect(cx - 4, 30, 3, 1, '#3a2a2a'); p.rect(cx + 1, 30, 3, 1, '#3a2a2a');
    p.rect(cx - 5, 15, 10, 10, body); p.hline(cx - 5, 15, 10, shade(body, 0.2));
    p.rect(cx - 7, 16, 2, 7, opts.arms || skin); p.rect(cx + 5, 16, 2, 7, opts.arms || skin);
    p.rect(cx - 4, 6, 8, 9, skin); p.vline(cx + 3, 7, 7, shade(skin, -0.2));
    p.px(cx - 2, 10, opts.eye || '#1a1a1a'); p.px(cx + 1, 10, opts.eye || '#1a1a1a');
    return cx;
  };
  const quad = (body, opts = {}) => {
    p.rect(6, 16, 18, 8, body); p.hline(6, 16, 18, shade(body, 0.2));
    p.rect(7, 24, 3, 5, shade(body, -0.2)); p.rect(20, 24, 3, 5, shade(body, -0.2)); p.rect(12, 24, 2, 4, shade(body, -0.3)); p.rect(16, 24, 2, 4, shade(body, -0.3));
    p.rect(1, 12, 9, 7, body); // head (facing left)
    p.rect(0, 16, 4, 3, shade(body, -0.1)); // snout
    p.px(0, 16, '#1a1a1a');
    p.px(4, 14, opts.eye || '#ff3a3a');
    p.px(6, 10, body); p.px(7, 11, body); p.px(3, 10, body); p.px(4, 11, body); // ears
    p.rect(24, 14, 5, 2, body); p.px(29, 13, body); // tail
    p.px(1, 19, '#fff'); p.px(3, 19, '#fff');
  };
  const brute = (body, opts = {}) => {
    p.rect(8, 10, 16, 16, body); p.hline(8, 10, 16, shade(body, 0.2)); p.vline(23, 11, 15, shade(body, -0.2));
    p.rect(4, 12, 4, 12, body); p.rect(24, 12, 4, 12, body);
    p.rect(4, 24, 5, 3, shade(body, -0.15)); p.rect(23, 24, 5, 3, shade(body, -0.15));
    p.rect(10, 26, 4, 5, shade(body, -0.25)); p.rect(18, 26, 4, 5, shade(body, -0.25));
    p.rect(11, 3, 10, 9, opts.head || body);
    p.px(13, 7, opts.eye || '#ffe040'); p.px(18, 7, opts.eye || '#ffe040');
    p.hline(13, 10, 6, '#2a1a1a'); p.px(14, 10, '#fff'); p.px(17, 10, '#fff');
  };
  switch (kind) {
    case 'squirrel':
      p.oval(18, 14, 6, 8, '#c86a2a'); p.oval(18, 13, 4, 6, '#e08a4a');
      p.oval(12, 22, 5, 5, '#b85a2a'); p.rect(9, 15, 5, 5, '#b85a2a');
      p.px(10, 16, '#1a1a1a'); p.px(9, 14, '#b85a2a'); p.px(12, 13, '#b85a2a');
      p.rect(10, 27, 3, 2, '#8a4a2a'); p.rect(14, 27, 3, 2, '#8a4a2a');
      p.hline(8, 18, 2, '#fff'); // teeth
      p.px(9, 21, '#7a5030'); p.px(8, 21, '#7a5030'); // acorn
      break;
    case 'wolf': quad('#7a7a8a'); break;
    case 'icewolf': quad('#c8e0f0', { eye: '#3ac0ff' }); break;
    case 'treant':
      brute('#6a4a2a', { head: '#5a3a1a', eye: '#aaff4a' });
      p.oval(16, 4, 10, 5, '#4a8a3a'); p.oval(10, 6, 5, 4, '#3a7a2a'); p.oval(23, 5, 5, 4, '#5a9a4a');
      break;
    case 'bat':
      p.oval(16, 16, 4, 4, '#4a3a5a');
      for (let i = 0; i < 10; i++) { p.vline(11 - i, 12 + Math.floor(i / 2), 4 - Math.floor(i / 3), '#5a4a6a'); p.vline(21 + i, 12 + Math.floor(i / 2), 4 - Math.floor(i / 3), '#5a4a6a'); }
      p.px(14, 15, '#ff3a3a'); p.px(17, 15, '#ff3a3a'); p.px(15, 19, '#fff'); p.px(16, 19, '#fff');
      p.px(13, 11, '#4a3a5a'); p.px(18, 11, '#4a3a5a');
      break;
    case 'slime':
      p.oval(16, 22, 12, 9, tint || '#5ad05a'); p.oval(13, 19, 5, 3, shade(tint || '#5ad05a', 0.3));
      p.rect(4, 26, 24, 4, tint || '#5ad05a');
      p.rect(11, 19, 3, 4, '#fff'); p.rect(18, 19, 3, 4, '#fff'); p.px(12, 21, '#1a1a1a'); p.px(19, 21, '#1a1a1a');
      p.px(10, 15, '#fff');
      break;
    case 'troll': brute('#7a8a7a', { eye: '#ff6a3a' }); p.px(12, 12, '#fff'); p.px(19, 12, '#fff'); break;
    case 'yeti': brute('#e8f0f8', { head: '#d8e8f0', eye: '#3a6ac0' }); p.rect(13, 6, 6, 4, '#8ab0d0'); break;
    case 'golem':
      brute('#9a8a6a', { eye: '#4af0ff' });
      p.stones(8, 10, 16, 16, '#9a8a6a', 4); p.px(13, 7, '#4af0ff'); p.px(18, 7, '#4af0ff');
      p.px(15, 16, '#4af0ff'); p.px(16, 17, '#4af0ff');
      break;
    case 'peasant': {
      const cx = humanoid('#f0c8a0', '#8a6a3a', { legs: '#5a4a3a' });
      p.rect(cx - 4, 4, 8, 2, '#c8a040'); p.hline(cx - 6, 6, 12, '#c8a040');
      p.vline(cx + 7, 4, 22, '#8a5a30'); p.px(cx + 6, 3, '#c8ccd8'); p.px(cx + 8, 3, '#c8ccd8'); p.px(cx + 7, 2, '#c8ccd8');
      p.hline(cx - 2, 13, 4, '#7a3a2a');
      break;
    }
    case 'knight': {
      const cx = humanoid('#c8ccd8', '#a8acb8', { arms: '#a8acb8', eye: '#1a1a1a', legs: '#8a8e9a' });
      p.hline(cx - 4, 10, 8, '#3a3a4a'); p.px(cx - 2, 10, '#c8ccd8'); p.px(cx + 1, 10, '#c8ccd8');
      p.vline(cx, 2, 4, tint && boss ? '#f0c020' : '#c03030'); p.px(cx + 1, 3, '#c03030');
      p.rect(cx - 9, 16, 4, 8, '#3a6ac0'); p.hline(cx - 9, 19, 4, '#f0c020'); // shield
      p.vline(cx + 7, 8, 14, '#e8ecf8'); p.hline(cx + 5, 21, 5, '#a08030');
      if (boss) { p.rect(cx - 5, 15, 10, 2, '#f0c020'); p.px(cx - 3, 5, '#8a6a3a'); p.px(cx + 2, 5, '#8a6a3a'); p.rect(cx - 2, 14, 4, 2, '#8a6a3a'); }
      break;
    }
    case 'archer': {
      const cx = humanoid('#f0c8a0', '#3a7a3a', { legs: '#4a3a2a' });
      p.rect(cx - 5, 4, 10, 3, '#2a5a2a'); p.px(cx + 4, 3, '#c03030'); p.px(cx + 5, 2, '#c03030');
      for (let i = 0; i < 12; i++) p.px(cx - 9 + Math.round(Math.sin(i / 11 * Math.PI) * -2), 12 + i, '#8a5a30');
      p.vline(cx - 8, 12, 12, '#ddd');
      break;
    }
    case 'skeleton': {
      const cx = humanoid('#e8e0d0', '#d8d0c0', { arms: '#e8e0d0', legs: '#d8d0c0', eye: '#ff3a3a' });
      p.rect(cx - 5, 15, 10, 10, 'rgba(0,0,0,0)');
      for (let y = 16; y < 24; y += 2) p.hline(cx - 4, y, 8, '#8a8070');
      p.rect(cx - 3, 9, 2, 2, '#1a1a1a'); p.rect(cx + 1, 9, 2, 2, '#1a1a1a'); p.px(cx - 2, 10, '#ff3a3a'); p.px(cx + 2, 10, '#ff3a3a');
      p.hline(cx - 2, 13, 4, '#1a1a1a'); p.px(cx - 1, 13, '#e8e0d0'); p.px(cx + 1, 13, '#e8e0d0');
      p.vline(cx + 8, 10, 12, '#9a9aa8');
      break;
    }
    case 'mummy': {
      const cx = humanoid('#d8c8a0', '#d8c8a0', { legs: '#c8b890' });
      for (let y = 6; y < 30; y += 2) p.hline(cx - 5, y, 10, '#b8a880');
      p.px(cx - 2, 10, '#5aff5a'); p.px(cx + 1, 10, '#5aff5a');
      p.px(cx - 4, 7, '#6cbf45'); p.px(cx - 5, 8, '#6cbf45'); p.px(cx + 4, 8, '#6cbf45');
      break;
    }
    case 'rivalgob': {
      // goblin drawn with red-ish skin, reuse goblin
      const look = { skin: tint && boss ? '#a08a3a' : '#a0703a', hat: boss ? 'horns' : 'bandana', outfit: '#3a2a2a', tool: 'club', ears: 1, nose: 2, eyes: 1, teeth: 2, extra: boss ? 'warpaint' : null };
      const g = makeCanvas(GOB_W, GOB_H);
      drawGoblin(g.getContext('2d'), look, 0);
      c.getContext('2d').save(); c.getContext('2d').translate(29, 3); c.getContext('2d').scale(-1, 1);
      c.getContext('2d').drawImage(g, 0, 0); c.getContext('2d').restore();
      break;
    }
    case 'frog':
      p.oval(16, 22, 11, 7, '#4a9a3a'); p.oval(16, 24, 8, 4, '#c8e0a0');
      p.oval(10, 14, 4, 4, '#4a9a3a'); p.oval(22, 14, 4, 4, '#4a9a3a');
      p.oval(10, 14, 2, 2, '#fff'); p.oval(22, 14, 2, 2, '#fff'); p.px(10, 14, '#1a1a1a'); p.px(22, 14, '#1a1a1a');
      p.hline(9, 21, 14, '#2a5a1a');
      p.rect(4, 26, 6, 3, '#3a8a2a'); p.rect(22, 26, 6, 3, '#3a8a2a');
      if (boss) { p.rect(13, 7, 6, 3, '#f0c020'); p.px(13, 6, '#f0c020'); p.px(18, 6, '#f0c020'); }
      break;
    case 'kobold': {
      const cx = humanoid('#c86a3a', '#6a3a2a', { legs: '#8a4a2a', eye: '#ffe040' });
      p.rect(cx - 6, 9, 3, 4, '#c86a3a'); p.px(cx - 7, 11, '#1a1a1a'); // snout left
      p.px(cx - 2, 5, '#f0e8d0'); p.px(cx + 2, 5, '#f0e8d0');
      p.rect(cx + 3, 26, 5, 2, '#c86a3a');
      p.vline(cx + 8, 8, 14, '#8a5a30'); p.px(cx + 8, 7, '#c8ccd8');
      break;
    }
    case 'drake': case 'dragon': {
      const body = tint || (kind === 'dragon' ? '#d04a2a' : '#4a8a6a');
      // wings
      for (let i = 0; i < 12; i++) p.hline(12 + i, 2 + i, 12 - i, shade(body, -0.25));
      quad(body, { eye: '#ffe040' });
      p.rect(1, 10, 3, 2, '#f0e8d0'); // horns
      p.px(0, 9, '#f0e8d0');
      for (let x = 8; x < 24; x += 3) p.px(x, 15, shade(body, 0.35)); // spikes
      if (kind === 'dragon') { p.rect(7, 19, 14, 3, '#f0c060'); }
      break;
    }
    default: brute('#888');
  }
  if (boss && kind !== 'rivalgob' && kind !== 'knight' && kind !== 'frog') {
    // crown
    p.rect(12, 0, 8, 3, '#f0c020'); p.px(12, -1, '#f0c020'); p.px(15, 0, '#e02a4a');
  }
  outline(c);
  cache.set(key, c);
  return c;
}

// ================================================================ ICONS
// 10x10 string-art icons
const ICON_PAL = {
  '.': null, 'k': '#1c1424', 'y': '#f0c020', 'Y': '#fff080', 'o': '#c08010', 'r': '#d83a3a', 'R': '#ff8080', 'w': '#ffffff',
  'c': '#f0e8d0', 'g': '#6cbf45', 'G': '#3a8a2a', 'b': '#3a8ae0', 'B': '#9ad8ff', 'p': '#a050e0', 'P': '#e0a0ff',
  's': '#9aa0b0', 'S': '#d8dce8', 'd': '#5a5e70', 'n': '#8a5a30', 'N': '#c08850', 'm': '#5a3a20', 'e': '#20c0a0', 'E': '#a0ffe0',
  'f': '#ff7a20', 'F': '#ffd040', 'l': '#3a3a4a', 'v': '#7a2aa0',
};
const ICONS = {
  coin: ['..kkkkk...', '.kyyyyyk..', 'kyYYyyyok.', 'kyYyooyok.', 'kyyyoyyok.', 'kyyoyyyok.', 'kyyyooyok.', '.kyyyyok..', '..kkkkk...', '..........'],
  shroom: ['...kkkk...', '..krrwrk..', '.krwrrrrk.', 'krrrrwrrrk', 'kkkkkkkkkk', '...kcck...', '...kcck...', '...kcck...', '..kcccck..', '...kkkk...'],
  ore: ['..........', '...kkkk...', '..ksSssk..', '.ksSsdsdk.', '.kssdyssk.', 'ksdssssydk', 'ksyssdsssk', '.kdsssddk.', '..kkkkkk..', '..........'],
  gem: ['..........', '..kkkkkk..', '.kBBbbBBk.', 'kBBbbbbBBk', 'kbbbbbbbbk', '.kbbbbbbk.', '..kbbbbk..', '...kbbk...', '....kk....', '..........'],
  tooth: ['..........', '.kkk..kkk.', 'kYyyykyyyk', 'kYyyyyyyyk', 'kyyyyyyyok', '.kyyyyyok.', '.kyyokyok.', '.kyok.kok.', '..kk...kk.', '..........'],
  xp: ['....kk....', '...kYk....', '...kyyk...', 'kkkkyykkkk', 'kYyyyyyyyk', '.kyyyyyyk.', '..kyyyyk..', '.kyyokyyk.', '.kyk..kyk.', '.kk....kk.'],
  sword: ['........kk', '.......kSk', '......kSsk', '.....kSsk.', '.k..kSsk..', '.kkkSsk...', '..kosk....', '..koKk....'.replace('K', 'k'), '.koo.kk...', 'kok.......'],
  shield: ['.kkkkkkkk.', 'kbbbbbbbbk', 'kbbbyybbbk', 'kbbbyybbbk', 'kbyyyyyybk', 'kbbbyybbbk', '.kbbyybbk.', '.kbbbbbbk.', '..kbbbbk..', '...kkkk...'],
  map: ['.kkkkkkkk.', 'kcccNcccck', 'kccNccrcck', 'kcNcccrrck', 'kccNNcccck', 'kcccccNcck', 'kcgccNccck', 'kcggcccNck', 'kccccccccl', '.kkkkkkkk.'],
  scroll: ['.kkkkkkk..', 'kNcccccNk.', '.kcccccck.', '.kclllcck.', '.kcccccck.', '.kcllllck.', '.kcccccck.', '.kcllcck..', 'kNcccccNk.', '.kkkkkkk..'],
  chest: ['..........', '.kkkkkkkk.', 'knnnnnnnnk', 'knyyyyyynk', 'kkkkyykkkk', 'knnnkknnnk', 'knnnnnnnnk', 'knnnnnnnnk', 'kkkkkkkkkk', '..........'],
  crown: ['..........', 'k...kk...k', 'ky.kyyk.yk', 'kyykyykyyk', 'kyyyyyyyyk', 'kyryybyyrk', 'kyyyyyyyyk', 'kooooooook', '.kkkkkkkk.', '..........'],
  hammer: ['.kkkkkk...', 'kssSSssk..', 'kssssssk..', '.kkknkkk..', '...knk....', '...knk....', '...knk....', '...knk....', '...knk....', '...kkk....'],
  potion: ['...kkkk...', '...kNNk...', '....kk....', '...kSSk...', '..kSggSk..', '.kgggggGk.', '.kgwggggk.', '.kggggggk.', '..kGGGGk..', '...kkkk...'],
  dice: ['.kkkkkkkk.', 'kwwwwwwwwk', 'kwkwwwwwwk', 'kwwwwwwwwk', 'kwwwkkwwwk', 'kwwwkkwwwk', 'kwwwwwwwwk', 'kwwwwwwkwk', 'kwwwwwwwwk', '.kkkkkkkk.'],
  dagger: ['.......kk.', '......kSk.', '.....kSsk.', '....kSsk..', '...kSsk...', '.kkSsk....', '.kook.....', 'kook......', 'kkk.......', '..........'],
  pick: ['.kkkkkk...', 'kSsssssk..', '.kk.knkkk.', '....knk.kk', '...knk....', '..knk.....', '.knk......', 'knk.......', 'kk........', '..........'],
  mug: ['..........', '.kkkkkk...', 'kwwwwwwk..', 'knNnnnnkk.', 'knNnyynknk', 'knNnyynknk', 'knNnnnnkk.', 'knNnnnnk..', '.kkkkkk...', '..........'],
  bag: ['...kkk....', '..kmmmk...', '...kkk....', '..kNNNNk..', '.kNyyNNNk.', 'kNNyNNNNNk', 'kNNNyyNNNk', 'kNNNNNyNNk', '.kNNNNNNk.', '..kkkkkk..'],
  ticket: ['..........', 'kkkkkkkkkk', 'kyyyykyyyk', 'kyrryyyyyk', '.yrrrkyyk.', '.yrrrkyyk.', 'kyrryyyyyk', 'kyyyykyyyk', 'kkkkkkkkkk', '..........'],
  lock: ['...kkkk...', '..kk..kk..', '..k....k..', '..k....k..', '.kkkkkkkk.', '.kyyyyyyk.', '.kyykkyyk.', '.kyykkyyk.', '.kyyyyyyk.', '.kkkkkkkk.'],
  clock: ['..kkkkkk..', '.kwwwwwwk.', 'kwwwkwwwwk', 'kwwwkwwwwk', 'kwwwkkkwwk', 'kwwwwwwwwk', 'kwwwwwwwwk', '.kwwwwwwk.', '..kkkkkk..', '..........'],
  trophy: ['kkkkkkkkkk', 'kyyYyyyyok', '.kyYyyyok.', 'kkyyyyyokk', '..kyyyok..', '...kyok...', '....kk....', '...kyyk...', '..kooook..', '..kkkkkk..'],
  gear: ['...k..k...', '..kskksk..', '.kssssssk.', 'kssskksssk', '.kskddksk.', '.kskddksk.', 'kssskksssk', '.kssssssk.', '..kskksk..', '...k..k...'],
  house: ['....kk....', '...krrk...', '..krrrrk..', '.krrrrrrk.', 'kkkkkkkkkk', '.knnnnnnk.', '.knBnmmnk.', '.knnnmmnk.', '.knnnmmnk.', '.kkkkkkkk.'],
  flask: ['...kkkk...', '....kk....', '....kk....', '...kbbk...', '..kbbbbk..', '.kbBbbbbk.', 'kbbbbbbbbk', 'kbbbbbbbbk', '.kkkkkkkk.', '..........'],
  skull: ['..kkkkkk..', '.kccccccK.'.replace('K', 'k'), 'kccccccccw'.replace('w', 'k'), 'kckkcckkck', 'kckkcckkck', 'kccccccccw'.replace('w', 'k'), '.kccckcck.', '..kckckck.', '..kkkkkk..', '..........'],
  heart: ['..........', '.kk...kk..', 'krRk.krrk.', 'krrrkrrrk.', 'krrrrrrrk.', '.krrrrrk..', '..krrrk...', '...krk....', '....k.....', '..........'],
  fire: ['....k.....', '...kfk....', '...kfk.k..', '..kfFfkfk.', '.kfFFFfFk.', '.kfFYFFfk.', 'kfFYYYFfk.', 'kfFYYYFfk.', '.kfFFFfk..', '..kkkkk...'],
  star: ['....kk....', '...kyyk...', 'kkkkyykkkk', 'kyyyYyyyyk', '.kyyyyyyk.', '..kyyyyk..', '.kyyyyyyk.', '.kyykkyyk.', 'kyk....kyk', 'kk......kk'],
  goblin: ['..........', '..kkkkkk..', 'kkggggggkk', 'kggyggyggk', '.kggggggk.', '.kgkwwkgk.', '..kggggk..', '.knnnnnnk.', '.knnnnnnk.', '..kk..kk..'],
  bomb: ['......kfk.', '.....kk.F.', '...kkkk...', '..klllllk.', '.klwlllllk', '.kllllllk.', '.kllllllk.', '.kllllllk.', '..kllllk..', '...kkkk...'],
  arrowup: ['....kk....', '...kgGk...', '..kgggGk..', '.kgggggGk.', 'kkkgggGkkk', '...kggk...', '...kggk...', '...kggk...', '...kkkk...', '..........'],
  share: ['......kkk.', '.....kwwwk', '..kk.kwwwk', '.kwwkkkkk.', '.kwwk.....', '.kwwkkkkk.', '..kk.kwwwk', '.....kwwwk', '......kkk.', '..........'],
  music: ['....kkkkkk', '....kwwwwk', '....kkkkwk', '....k...wk', '....k...wk', '.kkkk.kkwk', 'kwwwkkwwwk', 'kwwwkkwwwk', '.kkk..kkk.', '..........'],
  sound: ['....k.....', '...kk..k..', 'kkkwk.k.k.', 'kwwwk...k.', 'kwwwk.k.k.', 'kwwwk.k.k.', 'kkkwk...k.', '...kk.k.k.', '....k...k.', '.......k..'],
  rat: ['..........', '..........', '.kk.......', 'kRsk.kkkk.', 'kssskssssk', '.kwsssssssk'.slice(0, 10), '..ksssssk.', '...kk.kkkk', '.........k', '..........'],
  castle: ['k.k.k..k.k', 'kkkkk..kkk', 'ksssk..ksk', 'ksssskkssk', 'kssssssssk', 'kssskksssk', 'ksskmmkssk', 'ksskmmkssk', 'kkkkkkkkkk', '..........'],
  hourglass: ['kkkkkkkkkk', '.knnnnnnk.', '.kyyyyyyk.', '..kyyyyk..', '...kyyk...', '...kccк...'.replace('к', 'k'), '..kcyycK..'.replace('K', 'k'), '.kcyyyyck.', '.knnnnnnk.', 'kkkkkkkkkk'],
};

const iconCache = {};
export function icon(name, scale = 3) {
  const k = name + scale;
  if (iconCache[k]) return iconCache[k];
  const art = ICONS[name] || ICONS.star;
  const c = makeCanvas(10 * scale, 10 * scale);
  const ctx = c.getContext('2d');
  for (let y = 0; y < 10; y++) for (let x = 0; x < 10; x++) {
    const ch = art[y]?.[x];
    const col = ICON_PAL[ch];
    if (!col) continue;
    ctx.fillStyle = col;
    ctx.fillRect(x * scale, y * scale, scale, scale);
  }
  iconCache[k] = c.toDataURL();
  return iconCache[k];
}
export function iconCanvas(name) {
  const k = 'c' + name;
  if (cache.has(k)) return cache.get(k);
  const art = ICONS[name] || ICONS.star;
  const c = makeCanvas(10, 10);
  const ctx = c.getContext('2d');
  for (let y = 0; y < 10; y++) for (let x = 0; x < 10; x++) {
    const col = ICON_PAL[art[y]?.[x]];
    if (!col) continue;
    ctx.fillStyle = col; ctx.fillRect(x, y, 1, 1);
  }
  cache.set(k, c);
  return c;
}
export function iconImg(name, cls = 'ic') { return `<img class="${cls}" src="${icon(name)}" alt="">`; }

// ================================================================ TERRAIN
export function grassColorAt(R) {
  const g = ['#5fa83e', '#58a038', '#64ae42', '#5aa43c'];
  return g[Math.floor(R() * g.length)];
}

export { P as painter, outline };
