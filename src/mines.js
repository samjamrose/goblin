// The Deep Mines: an underground cross-section where all gold is dug.
// Mixed into World. Each depth is a tunnel off the main lift shaft; every upgrade stage makes the
// tunnel longer and adds a new structure, so no two depths (or stages) look the same.
import { DEPTHS, MINE_STAGES, BIZ, SKINS, OUTFITS } from './data.js';
import { goblinSheet, GOB_W, GOB_H, makeCanvas, iconCanvas, shade } from './sprites.js';
import { rng, clamp, fmt } from './util.js';

export const MW = 320;          // mine width (world px)
const TOP = 112;                // surface cavern height
const BH = 84;                  // height of one depth band
const SHAFT_X = 14, SHAFT_W = 20, TUN_X = SHAFT_X + SHAFT_W;
const FLOOR = 64, CEIL = 16;    // tunnel floor / ceiling inside a band
const FONT = '"Pixelify Sans", "Trebuchet MS", sans-serif';

export const depthY = (i) => TOP + i * BH;
const tunnelEnd = (stage) => Math.min(MW + 8, TUN_X + 46 + stage * 24);
const slotX = (k) => TUN_X + 26 + k * 24;

export const MineMixin = {
  // ---------------------------------------------------------------- scene switching
  mineInit() {
    if (this.mineCam) return;
    this.mineCam = { x: MW / 2, y: 0, zoom: 2, vx: 0, vy: 0 };
    this.scene = 'town';
    this.mineFit = true;
  },
  travelTo(scene) {
    this.mineInit();
    if (this.trip || this.scene === scene) return false;
    this.trip = { t: 0, dur: 2.0, to: scene, switched: false };
    this.hooks.sfx && this.hooks.sfx('splash');
    return true;
  },
  switchScene(scene) {
    this.mineInit();
    if (scene === 'mine') {
      this.townCam = this.cam;
      this.cam = this.mineCam;
      this.scene = 'mine';
      this.mineFit = true;
      this.resizeMine();
      // arrive at the dock at the top
      this.cam.y = -9999; this.clampCam();
    } else {
      this.mineCam = this.cam;
      this.cam = this.townCam || this.cam;
      this.scene = 'town';
      this.resize();
    }
    this.camTarget = null; this.cam.vx = this.cam.vy = 0;
    this.particles = []; this.floats = [];
    this.hooks.onScene && this.hooks.onScene(scene);
  },
  inMine() { return this.scene === 'mine'; },
  resizeMine() {
    const fit = this.sw / MW;
    this.mineMinZoom = fit;
    if (this.mineFit) { this.cam.zoom = fit; this.mineFit = false; }
  },
  mineOpenCount() { let n = 0; while (n < DEPTHS.length && this.G.depthOpen(n)) n++; return n; },
  mineBands() { return Math.min(DEPTHS.length, this.mineOpenCount() + 1); },
  mineHeight() { return TOP + this.mineBands() * BH + (this.mineBands() < DEPTHS.length ? 40 : 10); },
  clampMineCam() {
    const z = this.cam.zoom = clamp(this.cam.zoom, this.mineMinZoom || 1, (this.mineMinZoom || 1) * 3);
    const hw = this.sw / z / 2, hh = this.sh / z / 2;
    this.cam.x = hw * 2 >= MW ? MW / 2 : clamp(this.cam.x, hw, MW - hw);
    const topPad = 175 / z, botPad = 100 / z, H = this.mineHeight();
    const lo = hh - topPad, hi = H - hh + botPad;
    this.cam.y = lo <= hi ? clamp(this.cam.y, lo, hi) : lo;
  },
  focusDepth(i) {
    this.focus(MW / 2, depthY(i) + BH / 2);
  },

  // ---------------------------------------------------------------- update
  updateTrip(dt) {
    const tr = this.trip; if (!tr) return;
    tr.t += dt;
    if (!tr.switched && tr.t >= tr.dur / 2) { tr.switched = true; this.switchScene(tr.to); }
    if (tr.t >= tr.dur) this.trip = null;
  },
  updateMine(dt) {
    const G = this.G;
    // ambient sparks/steam from structures
    const n = this.mineOpenCount();
    if (Math.random() < dt * 4 && n) {
      const i = Math.floor(Math.random() * n), st = G.depthStage(i), items = DEPTHS[i].items.slice(0, st);
      const k = Math.floor(Math.random() * items.length), it = items[k], x = slotX(k), y0 = depthY(i);
      if (it === 'forge' || it === 'lava') this.particles.push({ type: 'spark', x: x + (Math.random() - 0.5) * 10, y: y0 + FLOOR - 8, vx: (Math.random() - 0.5) * 20, vy: -30, t: 0, life: 0.8, color: '#ffb040', g: 40 });
      else if (it === 'drill' || it === 'pump') this.particles.push({ type: 'puff', x: x + 4, y: y0 + FLOOR - 22, vx: (Math.random() - 0.5) * 6, vy: -10, t: 0, life: 1.4, color: '#d8d8d8', r: 1.5, grow: 2 });
      else if (it === 'crystals' || it === 'orb' || it === 'mushrooms') this.particles.push({ type: 'spark', x: x + (Math.random() - 0.5) * 14, y: y0 + FLOOR - 6 - Math.random() * 16, vx: 0, vy: -6, t: 0, life: 1, color: DEPTHS[i].light });
    }
    // pickaxe chips at the tunnel faces
    for (let i = 0; i < n; i++) {
      if (Math.random() < dt * 1.5) {
        const ex = tunnelEnd(G.depthStage(i)) - 6, y = depthY(i) + FLOOR - 14;
        if (ex < MW) this.particles.push({ type: 'spark', x: ex, y: y + Math.random() * 10, vx: -20 - Math.random() * 20, vy: -20, t: 0, life: 0.4, color: DEPTHS[i].ore, g: 200 });
      }
    }
  },

  // ---------------------------------------------------------------- input
  tapMine(sx, sy) {
    const G = this.G, [wx, wy] = this.toWorld(sx, sy);
    const hitR = 14 / this.cam.zoom + 6;
    // coin bubbles
    for (const b of G.rt.bubbles) {
      const [bx, by] = this.bubblePos(b);
      if (Math.hypot(wx - bx, wy - by) < hitR + 4) {
        const v = G.popBubble(b.id);
        this.coinBurst(bx, by, 8, v);
        this.hooks.sfx('pop');
        this.hooks.haptic && this.hooks.haptic(8);
        return;
      }
    }
    // the boat home
    if (wy < TOP && wx > MW - 130 && wy > 40) { this.hooks.onDock && this.hooks.onDock(); return; }
    if (wy >= TOP) {
      const i = Math.floor((wy - TOP) / BH);
      if (i >= 0 && i < this.mineBands()) {
        this.mineBounce = { i, t: 0.3 };
        this.hooks.sfx('tap');
        this.hooks.onDepth && this.hooks.onDepth(i);
      }
    }
  },
  mineBubblePos(b) {
    const i = Math.max(0, BIZ.findIndex(x => x.id === b.bid));
    const end = Math.min(MW - 12, tunnelEnd(this.G.depthStage(i)) - 16);
    const f = (b.id * 7.31) % 1;
    const t = this.time + b.id * 10;
    return [TUN_X + 14 + f * Math.max(10, end - TUN_X - 14), depthY(i) + 30 + Math.sin(t * 2.5) * 2];
  },

  // ---------------------------------------------------------------- render
  renderMine() {
    const G = this.G, ctx = this.ctx, z = this.cam.zoom, dpr = this.dpr;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#120c14';
    ctx.fillRect(0, 0, this.cv.width, this.cv.height);
    let shx = 0, shy = 0;
    if (this.shakeT > 0) { this.shakeT -= 1 / 60; shx = (Math.random() - 0.5) * 4; shy = (Math.random() - 0.5) * 4; }
    const S = z * dpr;
    const ox = Math.round((-this.cam.x * z + this.sw / 2 + shx) * dpr), oy = Math.round((-this.cam.y * z + this.sh / 2 + shy) * dpr);
    ctx.setTransform(S, 0, 0, S, ox, oy);
    ctx.imageSmoothingEnabled = false;
    const v = this.viewRect();
    // surface cavern
    if (v.y0 < TOP + 4) this.drawMineSurface(ctx);
    // depth bands
    const bands = this.mineBands();
    for (let i = 0; i < bands; i++) {
      const y0 = depthY(i);
      if (y0 > v.y1 + 4 || y0 + BH < v.y0 - 4) continue;
      const open = G.depthOpen(i), st = G.depthStage(i);
      ctx.drawImage(this.bandTexture(i, open ? st : 0), 0, y0);
      if (open) this.drawDepthLife(ctx, i, y0, st);
      else this.drawDigSite(ctx, i, y0);
      if (this.mineBounce && this.mineBounce.i === i) { ctx.fillStyle = `rgba(255,240,180,${this.mineBounce.t * 0.5})`; ctx.fillRect(0, y0, MW, BH); }
    }
    // unexplored bedrock below
    const bottom = depthY(bands);
    if (bands < DEPTHS.length && bottom < v.y1) {
      ctx.fillStyle = '#1a1218'; ctx.fillRect(-40, bottom, MW + 80, 400);
      ctx.fillStyle = '#2a1e26';
      const R = rng(99);
      for (let k = 0; k < 40; k++) ctx.fillRect(Math.floor(R() * MW), bottom + Math.floor(R() * 60), 3, 2);
    }
    // lift shaft over everything
    this.drawShaft(ctx);
    // sides beyond the mine
    ctx.fillStyle = '#120c14'; ctx.fillRect(-200, -200, 200, 4000); ctx.fillRect(MW, -200, 200, 4000);
    // bubbles
    for (const b of G.rt.bubbles) {
      const [x, y] = this.bubblePos(b);
      const age = (G.now() - b.born) / 1000, sc = Math.min(1, age * 4);
      ctx.save(); ctx.translate(x, y); ctx.scale(sc, sc);
      ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.arc(0, 0, 9, 0, 7); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 1; ctx.stroke();
      ctx.drawImage(iconCanvas('coin'), -5, -5);
      ctx.restore();
    }
    // particles
    for (const p of this.particles) {
      const k = 1 - p.t / p.life;
      if (p.type === 'coin') ctx.drawImage(iconCanvas('coin'), p.x - 3, p.y - 3, 7, 7);
      else if (p.type === 'spark') { ctx.globalAlpha = k; ctx.fillStyle = p.color; ctx.fillRect(p.x, p.y, 2, 2); ctx.globalAlpha = 1; }
      else if (p.type === 'conf') { ctx.fillStyle = p.color; ctx.fillRect(p.x, p.y, Math.abs(Math.cos(p.rot)) * 3 + 1, 2); }
      else if (p.type === 'puff') { ctx.globalAlpha = k * 0.8; ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill(); ctx.globalAlpha = 1; }
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.renderMineLabels(ctx);
  },

  // static rock + carved tunnel for one band, cached per stage
  bandTexture(i, stage) {
    this.bandCache = this.bandCache || new Map();
    const key = i + ':' + stage;
    if (this.bandCache.has(key)) return this.bandCache.get(key);
    const D = DEPTHS[i], c = makeCanvas(MW, BH), x = c.getContext('2d'), R = rng(1000 + i * 77);
    // rock with strata
    x.fillStyle = D.rock; x.fillRect(0, 0, MW, BH);
    for (let s = 0; s < 5; s++) {
      const yy = 4 + s * 17 + Math.floor(R() * 6);
      x.fillStyle = shade(D.rock, s % 2 ? -0.12 : 0.08);
      for (let px = 0; px < MW; px += 4) x.fillRect(px, yy + Math.round(Math.sin(px * 0.05 + s * 2 + i) * 2), 4, 3 + (s % 3));
    }
    for (let k = 0; k < 140; k++) { x.fillStyle = R() < 0.5 ? shade(D.rock, -0.25) : shade(D.rock, 0.18); x.fillRect(Math.floor(R() * MW), Math.floor(R() * BH), 2, R() < 0.3 ? 2 : 1); }
    for (let k = 0; k < 22; k++) { x.fillStyle = D.ore; x.fillRect(Math.floor(R() * MW), Math.floor(R() * BH), 1, 1); }
    // band divider
    x.fillStyle = shade(D.rock, -0.4); x.fillRect(0, 0, MW, 2);
    if (stage > 0) {
      const end = tunnelEnd(stage);
      const ceil = (px) => CEIL + Math.round(Math.sin(px * 0.11 + i) * 3 + Math.sin(px * 0.037 + i * 3) * 3);
      // carved tunnel
      for (let px = TUN_X; px < Math.min(MW, end); px++) {
        let top = ceil(px), bot = FLOOR + 4;
        // rounded end face
        const dEnd = end - px;
        if (dEnd < 12) { const k = Math.sqrt(1 - Math.pow((12 - dEnd) / 12, 2)); top = Math.round(FLOOR - (FLOOR - top) * k); bot = Math.round(FLOOR + 4 - 0 * k); if (k < 0.15) continue; }
        x.fillStyle = D.wall; x.fillRect(px, top, 1, bot - top);
        x.fillStyle = shade(D.rock, -0.45); x.fillRect(px, top - 1, 1, 1);
      }
      // back-wall texture
      for (let k = 0; k < stage * 30; k++) {
        const px = TUN_X + Math.floor(R() * (Math.min(MW, end) - TUN_X - 6)), py = CEIL + 6 + Math.floor(R() * (FLOOR - CEIL - 8));
        x.fillStyle = R() < 0.6 ? shade(D.wall, 0.15) : shade(D.wall, -0.2); x.fillRect(px, py, 2, 1);
      }
      // rich ore at the face
      if (end < MW + 4) for (let k = 0; k < 40; k++) { x.fillStyle = R() < 0.7 ? D.ore : shade(D.ore, 0.4); x.fillRect(end - 6 + Math.floor(R() * 10), FLOOR - 40 + Math.floor(R() * 40), 2, 2); }
      // floor
      x.fillStyle = shade(D.rock, -0.3); x.fillRect(TUN_X, FLOOR, Math.min(MW, end) - TUN_X, 4);
      x.fillStyle = shade(D.rock, 0.1);
      for (let px = TUN_X; px < Math.min(MW, end); px += 3) if (R() < 0.5) x.fillRect(px, FLOOR, 2, 1);
    }
    this.bandCache.set(key, c);
    return c;
  },

  drawShaft(ctx) {
    const n = this.mineOpenCount();
    const bottom = depthY(Math.max(1, n)) - BH + FLOOR + 4;
    const top = 58;
    ctx.fillStyle = '#0e0a10'; ctx.fillRect(SHAFT_X, top, SHAFT_W, bottom - top);
    ctx.fillStyle = '#6a4a2a';
    ctx.fillRect(SHAFT_X, top, 2, bottom - top); ctx.fillRect(SHAFT_X + SHAFT_W - 2, top, 2, bottom - top);
    for (let y = top; y < bottom; y += 12) { ctx.fillStyle = '#5a3a20'; ctx.fillRect(SHAFT_X, y, SHAFT_W, 1); }
    // landings
    for (let i = 0; i < n; i++) { ctx.fillStyle = '#8a6a3a'; ctx.fillRect(SHAFT_X, depthY(i) + FLOOR, SHAFT_W + 4, 3); }
    // cable + cage moving up and down
    const span = Math.max(1, bottom - top - 22);
    const ph = (Math.sin(this.time * 0.6) + 1) / 2, cy = top + 4 + ph * span;
    ctx.fillStyle = '#c8c8c8'; ctx.fillRect(SHAFT_X + SHAFT_W / 2, top, 1, cy - top);
    ctx.fillStyle = '#7a5a3a'; ctx.fillRect(SHAFT_X + 3, cy, SHAFT_W - 6, 16);
    ctx.fillStyle = '#3a2a1a'; ctx.fillRect(SHAFT_X + 4, cy + 2, SHAFT_W - 8, 12);
    ctx.fillStyle = '#ffd040'; ctx.fillRect(SHAFT_X + 6, cy + 9, 8, 5); // ore going up
    ctx.fillStyle = '#ffe890'; ctx.fillRect(SHAFT_X + 7, cy + 9, 2, 1);
  },

  drawMineSurface(ctx) {
    const t = this.time;
    // cavern
    ctx.fillStyle = '#2a1e2a'; ctx.fillRect(-40, -300, MW + 80, TOP + 300);
    ctx.fillStyle = '#3a2a36';
    for (let k = 0; k < 18; k++) { const x = k * 19 + 4, h = 8 + (k * 37) % 18; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 6, h); ctx.lineTo(x + 12, 0); ctx.fill(); }
    ctx.fillStyle = '#1e1620'; ctx.fillRect(-40, -300, MW + 80, 300);
    // underground lake on the right (the boat dock)
    ctx.fillStyle = '#1c3a5a'; ctx.fillRect(MW - 130, 78, 140, TOP - 78);
    ctx.fillStyle = 'rgba(160,210,255,0.6)';
    for (let k = 0; k < 8; k++) ctx.fillRect(MW - 125 + ((k * 31 + t * 8) % 120), 84 + (k * 7) % 22, 4, 1);
    // dock planks
    ctx.fillStyle = '#7a5530'; ctx.fillRect(MW - 140, 84, 40, 6);
    ctx.fillStyle = '#5a3a20'; for (let px = MW - 140; px < MW - 100; px += 6) ctx.fillRect(px, 84, 1, 6);
    ctx.fillRect(MW - 136, 90, 2, 10); ctx.fillRect(MW - 106, 90, 2, 10);
    // the boat
    this.drawBoat(ctx, MW - 70, 92 + Math.sin(t * 2) * 1.2, 1, true);
    // ground on the left
    ctx.fillStyle = '#4a3428'; ctx.fillRect(-40, 84, MW - 100, TOP - 84);
    ctx.fillStyle = '#5a4030'; ctx.fillRect(-40, 84, MW - 100, 2);
    // headframe over the shaft with turning wheel
    ctx.fillStyle = '#6a4a2a';
    ctx.fillRect(SHAFT_X - 4, 30, 3, 56); ctx.fillRect(SHAFT_X + SHAFT_W + 1, 30, 3, 56); ctx.fillRect(SHAFT_X - 4, 30, SHAFT_W + 8, 3);
    ctx.save(); ctx.translate(SHAFT_X + SHAFT_W / 2, 26); ctx.rotate(t * 2);
    ctx.strokeStyle = '#9a7a4a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 8, 0, 7); ctx.stroke();
    for (let k = 0; k < 4; k++) { ctx.rotate(Math.PI / 4); ctx.fillStyle = '#9a7a4a'; ctx.fillRect(-8, -0.5, 16, 1); }
    ctx.restore();
    // sorting hut + gold pile that grows with income
    ctx.fillStyle = '#7a5530'; ctx.fillRect(48, 62, 34, 22); ctx.fillStyle = '#a03a2a'; ctx.beginPath(); ctx.moveTo(44, 63); ctx.lineTo(65, 50); ctx.lineTo(86, 63); ctx.fill();
    ctx.fillStyle = '#3a2418'; ctx.fillRect(60, 72, 8, 12);
    const inc = this.G.incomePerSec(false), ph = clamp(Math.log10(inc + 1) * 2.2, 3, 22);
    ctx.fillStyle = '#c89a20'; ctx.beginPath(); ctx.moveTo(92, 84); ctx.quadraticCurveTo(92 + ph * 1.4, 84 - ph * 1.6, 92 + ph * 2.8, 84); ctx.fill();
    ctx.fillStyle = '#ffd040'; ctx.beginPath(); ctx.moveTo(95, 84); ctx.quadraticCurveTo(92 + ph * 1.4, 84 - ph * 1.3, 89 + ph * 2.8, 84); ctx.fill();
    if (Math.random() < 0.05) this.particles.push({ type: 'spark', x: 92 + Math.random() * ph * 2.8, y: 84 - Math.random() * ph, vx: 0, vy: -6, t: 0, life: 0.6, color: '#fff8c0' });
    // lantern posts
    for (const lx of [40, 140]) { ctx.fillStyle = '#4a3020'; ctx.fillRect(lx, 64, 2, 20); this.glow(ctx, lx + 1, 63, '#ffb050', 16); ctx.fillStyle = '#ffe080'; ctx.fillRect(lx - 1, 61, 4, 4); }
  },

  drawBoat(ctx, x, y, dir = 1, rower = true) {
    ctx.fillStyle = '#6a4224'; ctx.beginPath(); ctx.moveTo(x - 16, y - 4); ctx.lineTo(x + 16, y - 4); ctx.lineTo(x + 11, y + 3); ctx.lineTo(x - 11, y + 3); ctx.fill();
    ctx.fillStyle = '#8a5a30'; ctx.fillRect(x - 16, y - 5, 32, 2);
    ctx.fillStyle = '#c8a040'; ctx.fillRect(x + 10 * dir, y - 9, 2, 5); // little flag pole
    ctx.fillStyle = '#e04040'; ctx.fillRect(x + 12 * dir - (dir < 0 ? 4 : 0), y - 9, 4, 3);
    if (rower) {
      const sh = goblinSheet({ skin: '#6cbf45', hat: 'bandana', outfit: '#4a5a3a', tool: 'none', ears: 1, nose: 1, eyes: 0, teeth: 1, extra: '' });
      ctx.drawImage(dir < 0 ? sh.flip : sh.sheet, 0, 0, GOB_W, GOB_H, Math.round(x - GOB_W / 2), Math.round(y - GOB_H + 1), GOB_W, GOB_H);
      const a = Math.sin(this.time * 3) * 0.5;
      ctx.save(); ctx.translate(x - 3 * dir, y - 6); ctx.rotate(0.9 * dir + a);
      ctx.fillStyle = '#9a7040'; ctx.fillRect(-1, 0, 2, 14); ctx.fillRect(-2, 12, 4, 4); ctx.restore();
    }
  },

  glow(ctx, x, y, color, r) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color + '66'); g.addColorStop(1, color + '00');
    ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
  },

  // the moving parts of an open depth: structures, rails, carts, miners
  drawDepthLife(ctx, i, y0, stage) {
    const D = DEPTHS[i], t = this.time, fy = y0 + FLOOR, end = tunnelEnd(stage);
    const items = D.items.slice(0, stage);
    const hasRails = items.includes('rails');
    if (hasRails) {
      ctx.fillStyle = '#5a3a20'; for (let px = TUN_X; px < Math.min(MW, end - 8); px += 5) ctx.fillRect(px, fy - 1, 3, 2);
      ctx.fillStyle = '#9a9aa8'; ctx.fillRect(TUN_X, fy - 2, Math.min(MW, end - 8) - TUN_X, 1);
    }
    for (let k = 0; k < items.length; k++) this.drawMineItem(ctx, items[k], slotX(k), fy, y0, i, k);
    if (hasRails) {
      const L = Math.min(MW, end - 16) - TUN_X - 12, ph = (Math.sin(t * 0.5 + i) + 1) / 2, cx = TUN_X + 6 + ph * L;
      ctx.fillStyle = '#4a4a56'; ctx.fillRect(cx - 7, fy - 9, 14, 7);
      ctx.fillStyle = '#6a6a7a'; ctx.fillRect(cx - 7, fy - 9, 14, 1);
      ctx.fillStyle = D.ore; ctx.fillRect(cx - 5, fy - 11, 10, 3); ctx.fillStyle = shade(D.ore, 0.4); ctx.fillRect(cx - 3, fy - 12, 3, 1);
      ctx.fillStyle = '#222'; ctx.fillRect(cx - 5, fy - 2, 3, 2); ctx.fillRect(cx + 2, fy - 2, 3, 2);
    }
    // miners: walk to the rock face, swing, carry ore back to the lift
    const workers = this.G.workers(BIZ[i].id).length;
    const nMin = Math.min(7, 1 + Math.ceil(stage / 2) + workers);
    const face = Math.min(MW - 10, end - 12), home = TUN_X + 6, dist = Math.max(20, face - home);
    for (let j = 0; j < nMin; j++) {
      const speed = 22 + (j * 5) % 9, walk = dist / speed, swing = 2.2, P = walk * 2 + swing + 0.6;
      let ph = ((t + j * 2.9 + i * 1.3) % P + P) % P, x, dir, f, carry = false;
      if (ph < walk) { x = home + (ph / walk) * dist; dir = 1; f = 2 + Math.floor(t * 8) % 4; }
      else if (ph < walk + swing) { x = face - (j % 3) * 6; dir = 1; f = Math.floor(t * 3.2 + j) % 2 ? 6 : 7; if (f === 7 && Math.random() < 0.05) this.particles.push({ type: 'spark', x: x + 9, y: fy - 6, vx: 20, vy: -20, t: 0, life: 0.3, color: D.ore }); }
      else if (ph < walk * 2 + swing) { x = face - ((ph - walk - swing) / walk) * dist; dir = -1; f = 2 + Math.floor(t * 8) % 4; carry = true; }
      else { x = home; dir = -1; f = 0; }
      const look = { skin: SKINS[(i * 3 + j) % SKINS.length], hat: j % 3 === 0 ? 'hardhat' : 'candlehelm', outfit: OUTFITS[(i + j * 2) % OUTFITS.length], tool: carry ? 'none' : 'pick', ears: j % 3, nose: (j + i) % 3, eyes: j % 2, teeth: (j + 1) % 3, extra: '' };
      const sh = goblinSheet(look);
      ctx.drawImage(dir < 0 ? sh.flip : sh.sheet, f * GOB_W, 0, GOB_W, GOB_H, Math.round(x - GOB_W / 2), Math.round(fy - GOB_H + 2), GOB_W, GOB_H);
      if (carry) { ctx.fillStyle = '#8a6a3a'; ctx.fillRect(Math.round(x + 1), Math.round(fy - 18), 6, 6); ctx.fillStyle = D.ore; ctx.fillRect(Math.round(x + 2), Math.round(fy - 19), 4, 2); }
    }
    // lantern light along the tunnel (always a couple of torches)
    for (let px = TUN_X + 8; px < Math.min(MW, end - 10); px += 60) { ctx.fillStyle = '#4a3020'; ctx.fillRect(px, y0 + 30, 2, 6); ctx.fillStyle = Math.sin(t * 9 + px) > 0 ? '#ffd060' : '#ff9a30'; ctx.fillRect(px, y0 + 27, 2, 3); this.glow(ctx, px + 1, y0 + 28, D.light, 18); }
  },

  drawMineItem(ctx, type, x, fy, y0, i, k) {
    const D = DEPTHS[i], t = this.time, R = (n) => ((Math.sin((i * 31 + k * 17 + n) * 12.9898) * 43758.5453) % 1 + 1) % 1;
    const wood = '#7a5530', woodD = '#5a3a20';
    const top = y0 + CEIL + 4;
    switch (type) {
      case 'beams':
        ctx.fillStyle = wood; ctx.fillRect(x - 9, top, 3, fy - top); ctx.fillRect(x + 6, top, 3, fy - top); ctx.fillRect(x - 11, top, 22, 3);
        ctx.fillStyle = woodD; ctx.fillRect(x - 9, top + 3, 1, fy - top - 3); ctx.fillRect(x + 6, top + 3, 1, fy - top - 3);
        break;
      case 'lantern': {
        const sw = Math.sin(t * 1.5 + k) * 2;
        ctx.fillStyle = '#3a2a1a'; ctx.fillRect(x, top - 2, 1, 10);
        this.glow(ctx, x + sw, top + 12, D.light, 26);
        ctx.fillStyle = '#2a2a2a'; ctx.fillRect(x - 2 + sw, top + 8, 5, 7); ctx.fillStyle = D.light; ctx.fillRect(x - 1 + sw, top + 9, 3, 5);
        break;
      }
      case 'crates':
        for (const [dx, dy, s] of [[-8, 0, 9], [1, 0, 9], [-4, -9, 9]]) { ctx.fillStyle = '#9a7040'; ctx.fillRect(x + dx, fy - s + dy, s, s); ctx.fillStyle = woodD; ctx.fillRect(x + dx, fy - s + dy, s, 1); ctx.fillRect(x + dx, fy - s + dy + 4, s, 1); ctx.fillRect(x + dx, fy - s + dy, 1, s); }
        break;
      case 'ladder':
        ctx.fillStyle = wood; ctx.fillRect(x - 4, top, 2, fy - top); ctx.fillRect(x + 3, top, 2, fy - top);
        for (let y = top + 3; y < fy; y += 5) ctx.fillRect(x - 4, y, 9, 1);
        break;
      case 'goldpile': {
        ctx.fillStyle = shade(D.ore, -0.25); ctx.beginPath(); ctx.moveTo(x - 11, fy); ctx.quadraticCurveTo(x, fy - 18, x + 11, fy); ctx.fill();
        ctx.fillStyle = D.ore; ctx.beginPath(); ctx.moveTo(x - 8, fy); ctx.quadraticCurveTo(x, fy - 14, x + 8, fy); ctx.fill();
        if (Math.sin(t * 4 + k) > 0.8) { ctx.fillStyle = '#fff'; ctx.fillRect(x - 2 + Math.round(R(1) * 4), fy - 9, 1, 1); }
        break;
      }
      case 'pump': {
        const p = Math.sin(t * 4 + k) * 3;
        ctx.fillStyle = '#6a6a7a'; ctx.fillRect(x - 6, fy - 12, 12, 12); ctx.fillStyle = '#4a4a56'; ctx.fillRect(x - 6, fy - 12, 12, 2);
        ctx.fillStyle = '#9a9aa8'; ctx.fillRect(x - 1, fy - 22 + p, 3, 10);
        ctx.fillStyle = '#5a5a66'; ctx.fillRect(x + 4, top, 3, fy - 12 - top);
        break;
      }
      case 'barrels':
        for (const dx of [-7, 2]) { ctx.fillStyle = '#8a5a30'; ctx.fillRect(x + dx, fy - 11, 8, 11); ctx.fillStyle = '#4a4a4a'; ctx.fillRect(x + dx, fy - 9, 8, 1); ctx.fillRect(x + dx, fy - 3, 8, 1); }
        ctx.fillStyle = '#e04030'; ctx.fillRect(x - 5, fy - 7, 3, 2);
        break;
      case 'crane': {
        ctx.fillStyle = '#c8a040'; ctx.fillRect(x - 1, top, 3, fy - top); ctx.fillRect(x - 1, top, 16, 2);
        const sw = Math.sin(t * 1.2 + k) * 3, hy = top + 12 + (Math.sin(t * 0.7 + k) + 1) * 8;
        ctx.fillStyle = '#ccc'; ctx.fillRect(x + 12 + sw / 2, top + 2, 1, hy - top - 2);
        ctx.fillStyle = D.ore; ctx.fillRect(x + 9 + sw, hy, 7, 5); ctx.fillStyle = '#6a6a7a'; ctx.fillRect(x + 9 + sw, hy - 1, 7, 1);
        break;
      }
      case 'drill': {
        ctx.fillStyle = '#5a5a66'; ctx.fillRect(x - 9, fy - 14, 14, 14); ctx.fillStyle = '#7a7a8a'; ctx.fillRect(x - 9, fy - 14, 14, 2);
        ctx.fillStyle = '#e0a020'; ctx.fillRect(x - 7, fy - 9, 4, 4);
        ctx.fillStyle = '#4a4a56'; ctx.fillRect(x - 5, fy - 22, 3, 8);
        const s = Math.floor(t * 16) % 3;
        ctx.fillStyle = '#b8b8c8'; ctx.beginPath(); ctx.moveTo(x + 5, fy - 12); ctx.lineTo(x + 14, fy - 7); ctx.lineTo(x + 5, fy - 2); ctx.fill();
        ctx.fillStyle = '#6a6a7a'; ctx.fillRect(x + 6 + s * 2, fy - 9, 1, 4);
        break;
      }
      case 'vein':
        ctx.strokeStyle = D.ore; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - 10, top + 6); ctx.lineTo(x - 2, top + 16); ctx.lineTo(x + 4, top + 12); ctx.lineTo(x + 10, top + 26); ctx.stroke();
        ctx.fillStyle = shade(D.ore, 0.5); if (Math.sin(t * 3 + k) > 0.6) ctx.fillRect(x + 3, top + 12, 2, 2);
        this.glow(ctx, x, top + 16, D.light, 14);
        break;
      case 'conveyor': {
        ctx.fillStyle = '#3a3a44'; ctx.fillRect(x - 12, fy - 8, 24, 5); ctx.fillStyle = '#5a5a66'; ctx.fillRect(x - 12, fy - 8, 24, 1);
        const off = (t * 12) % 6;
        ctx.fillStyle = '#7a7a8a'; for (let px = -12; px < 12; px += 6) ctx.fillRect(x + px + off, fy - 6, 2, 1);
        ctx.fillStyle = D.ore; ctx.fillRect(x - 10 + ((t * 12) % 20), fy - 11, 3, 3); ctx.fillRect(x - 10 + ((t * 12 + 10) % 20), fy - 11, 3, 3);
        ctx.fillStyle = '#4a4a56'; ctx.fillRect(x - 10, fy - 3, 2, 3); ctx.fillRect(x + 8, fy - 3, 2, 3);
        break;
      }
      case 'tent':
        ctx.fillStyle = '#a06a3a'; ctx.beginPath(); ctx.moveTo(x - 10, fy); ctx.lineTo(x, fy - 16); ctx.lineTo(x + 10, fy); ctx.fill();
        ctx.fillStyle = '#3a2418'; ctx.beginPath(); ctx.moveTo(x - 3, fy); ctx.lineTo(x, fy - 8); ctx.lineTo(x + 3, fy); ctx.fill();
        this.glow(ctx, x + 12, fy - 3, '#ff9a30', 10); ctx.fillStyle = Math.sin(t * 10) > 0 ? '#ffb040' : '#ff7020'; ctx.fillRect(x + 10, fy - 4, 3, 3);
        break;
      case 'ladderup':
        break;
      case 'statue':
        ctx.fillStyle = shade(D.ore, -0.2); ctx.fillRect(x - 6, fy - 4, 12, 4);
        ctx.fillStyle = '#d8b040'; ctx.fillRect(x - 3, fy - 18, 6, 14); ctx.fillRect(x - 4, fy - 22, 8, 5); ctx.fillRect(x - 6, fy - 21, 2, 3); ctx.fillRect(x + 4, fy - 21, 2, 3);
        ctx.fillStyle = '#fff0a0'; ctx.fillRect(x - 2, fy - 20, 1, 1); ctx.fillRect(x + 1, fy - 20, 1, 1);
        break;
      case 'mushrooms':
        for (let m = 0; m < 4; m++) {
          const mx = x - 9 + m * 6, mh = 5 + Math.round(R(m) * 8), pulse = 0.6 + Math.sin(t * 2 + m) * 0.4;
          ctx.fillStyle = '#d8d8b8'; ctx.fillRect(mx, fy - mh, 2, mh);
          ctx.globalAlpha = pulse; ctx.fillStyle = D.ore; ctx.fillRect(mx - 2, fy - mh - 3, 6, 3); ctx.globalAlpha = 1;
          this.glow(ctx, mx + 1, fy - mh - 2, D.light, 8);
        }
        break;
      case 'crystals':
        for (let m = 0; m < 3; m++) {
          const cx = x - 7 + m * 7, ch = 10 + Math.round(R(m + 3) * 10);
          ctx.fillStyle = shade(D.ore, -0.2); ctx.beginPath(); ctx.moveTo(cx - 3, fy); ctx.lineTo(cx, fy - ch); ctx.lineTo(cx + 3, fy); ctx.fill();
          ctx.fillStyle = shade(D.ore, 0.3); ctx.fillRect(cx - 1, fy - ch + 4, 1, ch - 6);
        }
        this.glow(ctx, x, fy - 8, D.light, 18);
        if (Math.sin(t * 2.5 + k) > 0.9) { ctx.fillStyle = '#fff'; ctx.fillRect(x, fy - 16, 1, 3); ctx.fillRect(x - 1, fy - 15, 3, 1); }
        break;
      case 'wheel': {
        ctx.fillStyle = 'rgba(120,200,255,0.7)'; ctx.fillRect(x - 1, top, 3, fy - top - 10);
        ctx.save(); ctx.translate(x, fy - 10); ctx.rotate(t * 1.5);
        ctx.strokeStyle = wood; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 9, 0, 7); ctx.stroke();
        ctx.fillStyle = wood; for (let s = 0; s < 4; s++) { ctx.rotate(Math.PI / 4); ctx.fillRect(-10, -1, 20, 2); }
        ctx.restore();
        ctx.fillStyle = 'rgba(120,200,255,0.5)'; ctx.fillRect(x - 12, fy - 2, 24, 2);
        break;
      }
      case 'bridge':
        ctx.fillStyle = '#0a0608'; ctx.fillRect(x - 11, fy, 22, 4);
        ctx.fillStyle = wood; for (let px = -11; px < 11; px += 3) ctx.fillRect(x + px, fy - 1 + Math.round(Math.sin((px + 11) / 22 * Math.PI) * 2), 2, 2);
        ctx.fillStyle = '#c8a878'; ctx.fillRect(x - 11, fy - 8, 22, 1);
        ctx.fillStyle = wood; ctx.fillRect(x - 12, fy - 9, 2, 9); ctx.fillRect(x + 10, fy - 9, 2, 9);
        break;
      case 'pillars':
        ctx.fillStyle = '#8a7a68'; ctx.fillRect(x - 5, top, 10, fy - top); ctx.fillStyle = '#a89880'; ctx.fillRect(x - 7, top, 14, 3); ctx.fillRect(x - 7, fy - 3, 14, 3);
        ctx.fillStyle = Math.sin(t * 1.5 + k) > 0 ? '#7ad8ff' : '#4a98bf'; ctx.fillRect(x - 1, top + 10, 2, 2); ctx.fillRect(x - 2, top + 16, 4, 1); ctx.fillRect(x - 1, top + 20, 2, 3);
        break;
      case 'forge':
        ctx.fillStyle = '#4a3a3a'; ctx.fillRect(x - 10, fy - 14, 12, 14); ctx.fillStyle = '#ff7a20'; ctx.fillRect(x - 7, fy - 9, 6, 5);
        this.glow(ctx, x - 4, fy - 7, '#ff9a30', 16);
        ctx.fillStyle = '#3a3a44'; ctx.fillRect(x + 3, fy - 6, 8, 3); ctx.fillRect(x + 5, fy - 3, 4, 3);
        ctx.fillStyle = '#4a3a3a'; ctx.fillRect(x - 7, top, 4, fy - 14 - top);
        break;
      case 'lava': {
        ctx.fillStyle = '#c03a10'; ctx.fillRect(x - 11, fy - 1, 22, 5);
        ctx.fillStyle = '#ff8a20'; for (let px = -10; px < 10; px += 4) ctx.fillRect(x + px, fy - 1 + Math.round(Math.sin(t * 3 + px) * 1), 3, 1);
        this.glow(ctx, x, fy, '#ff6a20', 22);
        if (Math.sin(t * 2 + k * 3) > 0.95) this.particles.push({ type: 'spark', x: x + (Math.random() - 0.5) * 16, y: fy - 2, vx: 0, vy: -30, t: 0, life: 0.6, color: '#ffb040', g: 60 });
        break;
      }
      case 'skull':
        ctx.fillStyle = '#e8e0d0'; ctx.fillRect(x - 10, fy - 10, 16, 10); ctx.fillRect(x + 4, fy - 6, 8, 6);
        ctx.fillStyle = '#2a1a1a'; ctx.fillRect(x - 6, fy - 8, 3, 3); ctx.fillRect(x + 6, fy - 3, 6, 1);
        ctx.fillStyle = '#e8e0d0'; ctx.fillRect(x - 12, fy - 14, 3, 5); ctx.fillRect(x + 1, fy - 14, 3, 5);
        break;
      case 'orb': {
        const b = Math.sin(t * 2 + k) * 2;
        this.glow(ctx, x, fy - 18 + b, D.light, 26);
        ctx.fillStyle = D.ore; ctx.beginPath(); ctx.arc(x, fy - 18 + b, 6, 0, 7); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.fillRect(x - 3, fy - 21 + b, 2, 2);
        ctx.fillStyle = '#5a4a5a'; ctx.fillRect(x - 6, fy - 4, 12, 4);
        break;
      }
    }
  },

  // rubble and a sign where the next depth can be dug
  drawDigSite(ctx, i, y0) {
    const G = this.G, fy = y0 + FLOOR, t = this.time;
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(0, y0, MW, BH);
    // crack and rubble at the bottom of the shaft
    ctx.fillStyle = '#2a1e1a';
    ctx.beginPath(); ctx.moveTo(TUN_X, fy - 26); ctx.lineTo(TUN_X + 40, fy - 30); ctx.lineTo(TUN_X + 52, fy); ctx.lineTo(TUN_X, fy + 4); ctx.fill();
    for (let k = 0; k < 9; k++) { ctx.fillStyle = k % 2 ? '#6a5a4a' : '#8a7a6a'; ctx.fillRect(TUN_X + 4 + (k * 13) % 44, fy - 6 - (k * 7) % 12, 6, 5); }
    const can = !G.depthLock(i), aff = can && G.s.gold >= G.depthCost(i, 1);
    // sign
    ctx.fillStyle = '#6a4a2a'; ctx.fillRect(TUN_X + 70, fy - 22, 2, 22);
    ctx.fillStyle = aff ? '#a07a3a' : '#7a6040'; ctx.fillRect(TUN_X + 58, fy - 32, 28, 12);
    ctx.fillStyle = aff ? '#ffe060' : '#d8c8a8'; ctx.fillRect(TUN_X + 62, fy - 28, 20, 2);
    if (aff) { const p = Math.abs(Math.sin(t * 3)); ctx.fillStyle = `rgba(255,224,96,${0.25 * p})`; ctx.fillRect(TUN_X, y0 + 6, MW - TUN_X, BH - 10); }
  },

  // screen-space text: depth names, levels, gold per second, dig prompts
  renderMineLabels(ctx) {
    const G = this.G;
    ctx.textBaseline = 'middle';
    const fs = Math.round(clamp(this.cam.zoom * 6, 11, 15));
    for (let i = 0; i < this.mineBands(); i++) {
      const [sx, sy] = this.toScreen(TUN_X + 4, depthY(i) + 8);
      if (sy < 120 || sy > this.sh - 80) continue;
      const open = G.depthOpen(i);
      let a, b, col = '#fff';
      if (open) { a = `${DEPTHS[i].name} · Lv ${G.depthLvl(i)}`; b = `+${fmt(G.depthIncome(i))}/s`; }
      else {
        const lock = G.depthLock(i);
        a = `⛏ Dig deeper: ${DEPTHS[i].name}`;
        if (lock) { b = '🔒 ' + lock; col = '#bbb'; }
        else { const c = G.depthCost(i, 1); b = `Tap to dig · ${fmt(c)} gold`; col = G.s.gold >= c ? '#7aff6a' : '#ffcf4a'; }
      }
      ctx.font = `600 ${fs}px ${FONT}`;
      ctx.textAlign = 'left';
      const w = Math.max(ctx.measureText(a).width, ctx.measureText(b).width) + 12;
      ctx.fillStyle = 'rgba(20,14,22,0.78)';
      roundRect(ctx, sx - 4, sy - fs * 0.8, w, fs * 2.3, 6); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.fillText(a, sx + 2, sy);
      ctx.fillStyle = open ? '#ffe060' : col; ctx.fillText(b, sx + 2, sy + fs * 1.1);
      // upgrade hint on the right when affordable
      if (open) {
        const c = G.depthCost(i, 1), ok = G.s.gold >= c;
        const [rx] = this.toScreen(MW - 6, 0);
        const txt = ok ? `▲ ${fmt(c)}` : fmt(c);
        ctx.font = `600 ${fs - 1}px ${FONT}`; ctx.textAlign = 'right';
        const tw = ctx.measureText(txt).width + 12;
        ctx.fillStyle = ok ? 'rgba(40,110,40,0.9)' : 'rgba(20,14,22,0.7)';
        roundRect(ctx, Math.min(rx, this.sw - 6) - tw, sy - fs * 0.8, tw, fs * 1.6, 6); ctx.fill();
        ctx.fillStyle = ok ? '#c8ffb0' : '#bbb'; ctx.fillText(txt, Math.min(rx, this.sw - 6) - 6, sy);
      }
    }
    // dock label
    const [dx, dy] = this.toScreen(MW - 70, 70);
    if (dy > 110 && dy < this.sh - 60) {
      ctx.font = `600 ${fs}px ${FONT}`; ctx.textAlign = 'center';
      const txt = '⛵ Boat to town'; const w = ctx.measureText(txt).width + 14;
      ctx.fillStyle = 'rgba(20,14,22,0.78)'; roundRect(ctx, dx - w / 2, dy - fs * 0.8, w, fs * 1.6, 6); ctx.fill();
      ctx.fillStyle = '#8ad8ff'; ctx.fillText(txt, dx, dy);
    }
    // floats
    for (const f of this.floats) {
      const [x, y] = this.toScreen(f.x, f.y - f.t * 18);
      ctx.globalAlpha = 1 - Math.pow(f.t / f.dur, 2);
      ctx.font = `700 ${Math.round(13 * f.size)}px ${FONT}`; ctx.textAlign = 'center';
      ctx.fillStyle = '#1c1424'; ctx.fillText(f.text, x + 1, y + 1);
      ctx.fillStyle = f.color; ctx.fillText(f.text, x, y);
      ctx.globalAlpha = 1;
    }
    if (this.mineBounce && (this.mineBounce.t -= 1 / 60) <= 0) this.mineBounce = null;
  },

  // full-screen boat ride between town and mines
  renderTrip() {
    const tr = this.trip; if (!tr) return;
    const ctx = this.ctx, dpr = this.dpr, W = this.sw, H = this.sh;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const k = tr.t / tr.dur, a = clamp(1 - Math.abs(k - 0.5) / 0.5, 0, 1);
    ctx.globalAlpha = clamp(a * 1.8, 0, 1);
    const toMine = tr.to === 'mine';
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, toMine ? '#1a1424' : '#3a6a9a'); g.addColorStop(1, toMine ? '#0a0810' : '#1a3a5a');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // cave mouth
    ctx.fillStyle = '#0a0608';
    ctx.beginPath(); ctx.ellipse(toMine ? W * 0.85 : W * 0.15, H * 0.52, W * 0.18, H * 0.16, 0, Math.PI, 0); ctx.fill();
    // water
    ctx.fillStyle = '#1c4a7a'; ctx.fillRect(0, H * 0.55, W, H * 0.45);
    ctx.fillStyle = 'rgba(160,210,255,0.6)';
    for (let n = 0; n < 24; n++) ctx.fillRect(((n * 67 + this.time * 40) % (W + 40)) - 20, H * 0.58 + (n * 29) % (H * 0.38), 10, 2);
    // boat crossing
    ctx.save();
    const bx = toMine ? -60 + k * (W + 120) : W + 60 - k * (W + 120);
    ctx.translate(bx, H * 0.56 + Math.sin(this.time * 3) * 3); ctx.scale(3, 3);
    ctx.imageSmoothingEnabled = false;
    this.drawBoat(ctx, 0, 0, toMine ? 1 : -1, true);
    ctx.restore();
    ctx.font = `700 22px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffe060'; ctx.fillText(toMine ? 'To the Deep Mines!' : 'Back to town!', W / 2, H * 0.36);
    ctx.globalAlpha = 1;
  },
};

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
