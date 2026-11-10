// Battle screen: renders a battlesim with juicy feedback and tap interactions.
import { createBattle, stepBattle, damage } from './battlesim.js';
import { goblinSheet, GOB_W, GOB_H, enemySprite, iconCanvas, shade } from './sprites.js';
import { fmt, clamp } from './util.js';

const FONT = '"Pixelify Sans", "Trebuchet MS", sans-serif';

export class BattleScreen {
  constructor(root, hooks) {
    this.root = root;
    this.hooks = hooks;
    this.cv = root.querySelector('canvas');
    this.ctx = this.cv.getContext('2d');
    this.active = false;
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.cv.addEventListener('pointerdown', e => this.onTap(e));
    root.querySelector('#bt-bomb').addEventListener('click', () => this.bomb());
    root.querySelector('#bt-speed').addEventListener('click', () => { this.speed = this.speed === 1 ? 2 : this.speed === 2 ? 3 : 1; root.querySelector('#bt-speed').textContent = '×' + this.speed; });
    root.querySelector('#bt-flee').addEventListener('click', () => { if (this.b && !this.b.over) { this.b.over = true; this.b.winner = 'e'; this.fled = true; } });
  }

  open(cfg) {
    this.cfg = cfg;
    this.b = createBattle(cfg.team, cfg.enemies, { timeLimit: 90 });
    this.active = true;
    this.fx = [];
    this.parts = [];
    this.pokes = 0;
    this.bombCharge = 0.4;
    this.bombMult = cfg.bombMult || 1;
    this.speed = this.speed || 1;
    this.t = 0;
    this.endT = 0;
    this.fled = false;
    this.shakeT = 0;
    this.flying = [];
    this.root.classList.add('show');
    this.root.querySelector('#bt-title').textContent = cfg.title;
    this.root.querySelector('#bt-speed').textContent = '×' + this.speed;
    this.root.querySelector('.bt-result').classList.remove('show');
    this.resize();
    // layout positions
    const gs = this.b.units.filter(u => u.side === 'g'), es = this.b.units.filter(u => u.side === 'e');
    const place = (list, side) => {
      // front column holds the first two units, back column the rest
      const front = list.slice(0, Math.min(2, list.length)), back = list.slice(2);
      const rows = (n) => n === 1 ? [0.5] : n === 2 ? [0.28, 0.72] : [0.15, 0.5, 0.85];
      const fx = side === 'g' ? 0.33 : 0.67, bx = side === 'g' ? 0.14 : 0.86;
      front.forEach((u, i) => { u.hx = fx; u.hy = rows(front.length)[i]; });
      back.forEach((u, i) => { u.hx = bx; u.hy = rows(back.length)[i] + 0.12; });
      const boss = list.find(u => u.boss);
      if (boss) { boss.hx = side === 'g' ? 0.3 : 0.68; boss.hy = 0.5; list.filter(u => u !== boss).forEach((u, i) => { u.hx = side === 'g' ? 0.12 : 0.9; u.hy = [0.2, 0.85][i] ?? 0.5; }); }
    };
    place(gs, 'g'); place(es, 'e');
    for (const u of this.b.units) { u.ox = 0; u.oy = 0; u.flash = 0; u.dead = 0; }
    this.hooks.sfx('battle');
    this.hooks.music && this.hooks.music(cfg.music || 'battle');
  }

  close() {
    this.active = false;
    this.hooks.music && this.hooks.music('town');
    this.root.classList.remove('show');
  }

  resize() {
    const r = this.cv.getBoundingClientRect();
    this.w = r.width; this.h = r.height;
    this.cv.width = Math.round(r.width * this.dpr); this.cv.height = Math.round(r.height * this.dpr);
    this.unitScale = clamp(Math.min(this.w / 170, this.h / 150), 1.8, 4.5);
  }

  pos(u) {
    const top = this.h * 0.5, bottom = this.h * 0.9;
    const y = top + u.hy * (bottom - top);
    return [u.hx * this.w + u.ox, y + u.oy];
  }

  onTap(e) {
    if (!this.b || this.b.over) return;
    const r = this.cv.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    let best = null, bd = 1e9;
    for (const u of this.b.units) {
      if (u.side !== 'e' || !u.alive) continue;
      const [ux, uy] = this.pos(u);
      const d = Math.hypot(x - ux, y - (uy - 12 * this.unitScale));
      if (d < bd) { bd = d; best = u; }
    }
    if (best && bd < 40 * this.unitScale) {
      const team = this.b.units.filter(u => u.side === 'g');
      const atk = team.reduce((t, u) => t + u.atk, 0);
      damage(this.b, best, atk * 0.06, null, false);
      this.pokes++;
      this.bombCharge = Math.min(1, this.bombCharge + 0.015);
      best.ox += 6;
      this.spark(x, y, '#fff', 6);
      this.hooks.sfx('poke');
      this.hooks.haptic && this.hooks.haptic(5);
    }
  }

  bomb() {
    if (!this.b || this.b.over || this.bombCharge < 1) return;
    this.bombCharge = 0;
    const team = this.b.units.filter(u => u.side === 'g');
    const avg = team.reduce((t, u) => t + u.atk, 0) / Math.max(1, team.length);
    const foes = this.b.units.filter(u => u.side === 'e' && u.alive);
    const [sx, sy] = [this.w * 0.2, this.h * 0.4];
    const tx = this.w * 0.78, ty = this.h * 0.55;
    this.flying.push({ x: sx, y: sy, sx, sy, tx, ty, t: 0, dur: 0.55, onHit: () => {
      for (const f of foes) damage(this.b, f, avg * 2.2 * this.bombMult, null, false);
      this.boom(tx, ty);
    } });
    this.hooks.sfx('throw');
  }

  boom(x, y) {
    this.shakeT = 0.4;
    for (let i = 0; i < 40; i++) {
      const a = Math.random() * 6.28, s = 60 + Math.random() * 200;
      this.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 60, t: 0, life: 0.6 + Math.random() * 0.4, c: ['#ffd040', '#ff7a20', '#ff4a20', '#fff'][i % 4], r: 3 + Math.random() * 5 });
    }
    this.hooks.sfx('boom');
    this.hooks.haptic && this.hooks.haptic(40);
  }

  spark(x, y, c, n) {
    for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, s = 40 + Math.random() * 100; this.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: 0, life: 0.3 + Math.random() * 0.3, c, r: 2 }); }
  }

  update(dt) {
    if (!this.active) return;
    const b = this.b;
    this.t += dt;
    const sdt = dt * this.speed;
    if (!b.over) {
      stepBattle(b, sdt);
      this.bombCharge = Math.min(1, this.bombCharge + sdt / 7);
    }
    // consume fx
    for (const f of b.fx) {
      const u = b.units.find(x => x.id === f.unit);
      if (!u) continue;
      const [x, y] = this.pos(u);
      if (f.type === 'atk') {
        u.ox += (u.side === 'g' ? 1 : -1) * 18;
        if (Math.random() < 0.5) this.hooks.sfx('hit');
      } else if (f.type === 'dmg') {
        u.flash = 0.15;
        u.ox += (u.side === 'g' ? -1 : 1) * 5;
        this.fx.push({ x: x + (Math.random() - 0.5) * 20, y: y - 26 * this.unitScale, text: fmt(f.v), t: 0, crit: f.crit, c: u.side === 'g' ? '#ff6a6a' : f.crit ? '#ffe060' : '#fff' });
        if (f.crit) this.spark(x, y - 10 * this.unitScale, '#ffe060', 8);
      } else if (f.type === 'die') {
        this.spark(x, y - 10 * this.unitScale, u.side === 'g' ? '#7aff6a' : '#ddd', 16);
        this.hooks.sfx(u.side === 'g' ? 'ouch' : 'ko');
      }
    }
    b.fx.length = 0;
    for (const u of b.units) {
      u.ox *= Math.pow(0.002, dt); u.oy *= Math.pow(0.002, dt);
      u.flash = Math.max(0, u.flash - dt);
      if (!u.alive) u.dead = Math.min(1, u.dead + dt * 2);
    }
    for (const fl of this.flying) { fl.t += dt; if (fl.t >= fl.dur && !fl.done) { fl.done = true; fl.onHit(); } }
    this.flying = this.flying.filter(f => !f.done);
    for (const p of this.parts) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 300 * dt; }
    this.parts = this.parts.filter(p => p.t < p.life);
    this.fx = this.fx.filter(f => (f.t += dt) < 0.9);
    if (b.over && !this.ended) {
      this.endT += dt;
      if (this.endT > 0.9) { this.ended = true; this.finish(); }
    }
    const bombBtn = this.root.querySelector('#bt-bomb');
    bombBtn.style.setProperty('--charge', (this.bombCharge * 100).toFixed(0) + '%');
    bombBtn.classList.toggle('ready', this.bombCharge >= 1);
  }

  finish() {
    const won = this.b.winner === 'g';
    const res = this.cfg.onEnd(won, this.pokes, this.fled, this.b);
    const el = this.root.querySelector('.bt-result');
    el.querySelector('h2').textContent = won ? 'VICTORY!' : this.fled ? 'RETREAT!' : this.b.timeout ? 'TIME UP!' : 'DEFEAT...';
    el.querySelector('h2').className = won ? 'win' : 'lose';
    el.querySelector('.bt-body').innerHTML = res?.html || (won ? '' : '<p>Train your goblins with mushrooms, equip gear, or recruit stronger ones!</p>');
    const next = el.querySelector('#bt-next');
    next.style.display = res?.next ? '' : 'none';
    next.onclick = () => { this.ended = false; res.next(); };
    el.querySelector('#bt-close').onclick = () => { this.ended = false; this.close(); this.cfg.onClose && this.cfg.onClose(); };
    el.classList.add('show');
    this.hooks.sfx(won ? 'victory' : 'defeat');
    this.ended = true;
  }

  render() {
    if (!this.active) return;
    const ctx = this.ctx, w = this.w, h = this.h, s = this.unitScale;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    let shx = 0, shy = 0;
    if (this.shakeT > 0) { this.shakeT -= 1 / 60; shx = (Math.random() - 0.5) * 10; shy = (Math.random() - 0.5) * 10; }
    ctx.save(); ctx.translate(shx, shy);
    const R = this.cfg.region || { sky: ['#8fd3ff', '#cdeccf'], ground: '#4f8a3a', props: 'trees' };
    const g = ctx.createLinearGradient(0, 0, 0, h * 0.45);
    g.addColorStop(0, R.sky[0]); g.addColorStop(1, R.sky[1]);
    ctx.fillStyle = g; ctx.fillRect(-20, -20, w + 40, h * 0.45 + 20);
    // distant hills
    ctx.fillStyle = shade(R.ground, -0.15);
    ctx.beginPath(); ctx.moveTo(-20, h * 0.45);
    for (let x = -20; x <= w + 20; x += 20) ctx.lineTo(x, h * 0.36 + Math.sin(x * 0.02) * 14 + Math.sin(x * 0.051) * 8);
    ctx.lineTo(w + 20, h * 0.45); ctx.fill();
    ctx.fillStyle = R.ground; ctx.fillRect(-20, h * 0.42, w + 40, h * 0.6);
    ctx.fillStyle = shade(R.ground, -0.08);
    for (let i = 0; i < 40; i++) ctx.fillRect((i * 97) % w, h * 0.45 + (i * 53) % (h * 0.5), 6, 2);
    this.props(ctx, R.props, w, h);
    // units sorted by y
    const units = this.b.units.slice().sort((a, b) => this.pos(a)[1] - this.pos(b)[1]);
    for (const u of units) this.drawUnit(ctx, u, s);
    // flying bomb
    for (const fl of this.flying) {
      const k = fl.t / fl.dur;
      const x = fl.sx + (fl.tx - fl.sx) * k, y = fl.sy + (fl.ty - fl.sy) * k - Math.sin(k * Math.PI) * h * 0.25;
      ctx.save(); ctx.translate(x, y); ctx.rotate(k * 10);
      ctx.drawImage(iconCanvas('bomb'), -5 * 3, -5 * 3, 30, 30); ctx.restore();
    }
    for (const p of this.parts) { ctx.globalAlpha = 1 - p.t / p.life; ctx.fillStyle = p.c; ctx.fillRect(p.x - p.r / 2, p.y - p.r / 2, p.r, p.r); }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const f of this.fx) {
      const k = f.t / 0.9;
      ctx.font = `700 ${f.crit ? 22 : 16}px ${FONT}`;
      ctx.globalAlpha = 1 - k * k;
      ctx.lineWidth = 4; ctx.strokeStyle = '#1c1424'; ctx.strokeText((f.crit ? 'CRIT ' : '') + f.text, f.x, f.y - k * 30);
      ctx.fillStyle = f.c; ctx.fillText((f.crit ? 'CRIT ' : '') + f.text, f.x, f.y - k * 30);
    }
    ctx.globalAlpha = 1;
    // timer
    const tl = Math.max(0, this.b.timeLimit - this.b.t);
    ctx.font = `700 14px ${FONT}`; ctx.fillStyle = tl < 15 ? '#ff6a6a' : '#fff'; ctx.strokeStyle = '#1c1424'; ctx.lineWidth = 3;
    ctx.strokeText('⏱ ' + Math.ceil(tl) + 's', w / 2, 16); ctx.fillText('⏱ ' + Math.ceil(tl) + 's', w / 2, 16);
    if (this.t < 2.5 && this.pokes === 0) {
      ctx.globalAlpha = Math.min(1, (2.5 - this.t) * 2);
      ctx.font = `700 15px ${FONT}`;
      ctx.strokeText('Tap enemies to poke them!', w / 2, h * 0.88); ctx.fillStyle = '#ffe060'; ctx.fillText('Tap enemies to poke them!', w / 2, h * 0.88);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  props(ctx, kind, w, h) {
    const y0 = h * 0.42;
    for (let i = 0; i < 7; i++) {
      const x = ((i * 137) % (w + 40)) - 20, y = y0 - 2 + (i % 2) * 4;
      const sc = 2.5;
      if (kind === 'trees') { ctx.fillStyle = '#5a3a20'; ctx.fillRect(x - 3, y - 18, 6, 18); ctx.fillStyle = '#2f6a2a'; ctx.beginPath(); ctx.arc(x, y - 28, 16, 0, 7); ctx.fill(); ctx.fillStyle = '#3e8a34'; ctx.beginPath(); ctx.arc(x - 5, y - 33, 8, 0, 7); ctx.fill(); }
      else if (kind === 'crystals') { ctx.fillStyle = i % 2 ? '#8a5ae0' : '#4ad0e0'; ctx.beginPath(); ctx.moveTo(x - 8, y); ctx.lineTo(x, y - 30); ctx.lineTo(x + 8, y); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(x - 2, y - 22, 2, 14); }
      else if (kind === 'fences') { ctx.fillStyle = '#a07040'; for (let k = 0; k < 4; k++) ctx.fillRect(x + k * 8, y - 14, 3, 14); ctx.fillRect(x, y - 11, 28, 2); ctx.fillRect(x, y - 5, 28, 2); }
      else if (kind === 'pillars') { ctx.fillStyle = '#d8c8a0'; ctx.fillRect(x - 6, y - 40, 12, 40); ctx.fillStyle = '#b8a880'; ctx.fillRect(x - 8, y - 44, 16, 5); ctx.fillRect(x + 3, y - 40, 3, 40); }
      else if (kind === 'reeds') { ctx.fillStyle = '#5a7a3a'; for (let k = 0; k < 5; k++) ctx.fillRect(x + k * 3, y - 16 - (k % 3) * 4, 2, 16 + (k % 3) * 4); ctx.fillStyle = '#7a4a2a'; ctx.fillRect(x + 3, y - 22, 3, 6); }
      else if (kind === 'snow') { ctx.fillStyle = '#e8f0f8'; ctx.beginPath(); ctx.moveTo(x - 20, y); ctx.lineTo(x, y - 34); ctx.lineTo(x + 20, y); ctx.fill(); ctx.fillStyle = '#c0d0e0'; ctx.beginPath(); ctx.moveTo(x, y - 34); ctx.lineTo(x + 20, y); ctx.lineTo(x + 6, y); ctx.fill(); }
      else if (kind === 'lava') { ctx.fillStyle = '#3a2020'; ctx.beginPath(); ctx.moveTo(x - 18, y); ctx.lineTo(x - 4, y - 30); ctx.lineTo(x + 4, y - 30); ctx.lineTo(x + 18, y); ctx.fill(); ctx.fillStyle = '#ff6a20'; ctx.fillRect(x - 3, y - 31, 6, 3); }
      void sc;
    }
    if (kind === 'snow') { ctx.fillStyle = 'rgba(255,255,255,0.8)'; for (let i = 0; i < 30; i++) ctx.fillRect((i * 61 + this.t * 20) % w, (i * 37 + this.t * 40) % h, 2, 2); }
    if (kind === 'lava') { ctx.fillStyle = '#ff7a20'; for (let i = 0; i < 6; i++) ctx.fillRect((i * 131) % w, h * 0.55 + (i * 47) % (h * 0.35), 30, 3); }
  }

  drawUnit(ctx, u, s) {
    const [x, y] = this.pos(u);
    const alpha = 1 - u.dead;
    if (alpha <= 0) return;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(x, y, 9 * s, 2.5 * s, 0, 0, 7); ctx.fill();
    const bob = u.alive ? Math.sin(this.t * 6 + u.id) * s : 0;
    let sprite, sw, sh, frameX = 0, sc = s;
    if (u.side === 'g') {
      const sheet = goblinSheet(u.look);
      const f = !u.alive ? 0 : u.anim > 0 ? 6 : Math.floor(this.t * 4 + u.id) % 4 === 0 ? 7 : 0;
      sprite = sheet.sheet; frameX = f * GOB_W; sw = GOB_W; sh = GOB_H;
      if (this.b.over && this.b.winner === 'g' && u.alive) { frameX = (Math.floor(this.t * 5) % 2 ? 8 : 0) * GOB_W; }
    } else {
      sprite = enemySprite(u.kind, u.tint, u.boss); sw = 32; sh = 32;
      sc = s * (u.boss ? 1.6 : 0.95);
    }
    const dw = sw * sc, dh = sh * sc;
    ctx.save();
    ctx.translate(x, y + bob - (u.dead ? -u.dead * 10 : 0));
    if (u.dead) ctx.rotate(u.dead * (u.side === 'g' ? -1.4 : 1.4));
    ctx.drawImage(sprite, frameX, 0, sw, sh, -dw / 2, -dh, dw, dh);
    if (u.flash > 0) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = u.flash * 5 * alpha; ctx.drawImage(sprite, frameX, 0, sw, sh, -dw / 2, -dh, dw, dh); ctx.globalCompositeOperation = 'source-over'; }
    ctx.restore();
    ctx.globalAlpha = alpha;
    // hp bar
    if (u.alive) {
      const bw = Math.max(26, 14 * s), by = y - dh - 8;
      ctx.fillStyle = '#1c1424'; ctx.fillRect(x - bw / 2 - 1, by - 1, bw + 2, 7);
      ctx.fillStyle = '#3a2a3a'; ctx.fillRect(x - bw / 2, by, bw, 5);
      ctx.fillStyle = u.side === 'g' ? '#7aff6a' : u.boss ? '#ff4a8a' : '#ff6a4a';
      ctx.fillRect(x - bw / 2, by, bw * (u.hp / u.maxHp), 5);
      if (u.boss) {
        ctx.font = `600 11px ${FONT}`; ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.strokeStyle = '#1c1424'; ctx.lineWidth = 3;
        const nm = u.name.length > 18 ? u.name.slice(0, 17) + '…' : u.name;
        ctx.strokeText(nm, x, by - 8); ctx.fillText(nm, x, by - 8);
      }
    }
    ctx.globalAlpha = 1;
  }
}
