// Hiccups! A goblin catches the hiccups and every "HIC!" is a tiny explosion that scares
// everyone nearby. Tap the hiccuping goblin to give them a fright and cure them.
// Plus the Hiccup Concert at the DJ stand: the whole tribe hiccups a song on the beat.
import { TILE } from './data.js';
import { pick, clamp, fmt } from './util.js';
import { hic } from './audio.js';

const SCREAMS = ['AAAH!', 'EEK!', 'My ears!', 'RUN!', 'Not again!', 'Mommy!', 'BOOM?!', 'Hide the cheese!', 'What was THAT?!', 'I dropped my snack!'];
const HIC_LINES = ['*HIC!*', 'Hic! Sorry!', '*hic* ...oops', 'Somebody scare me! *HIC!*', 'I drank the fizzy grog. *HIC!*', '*HIC!* Not again!'];
const CURED = ['AAAH! ...hey, they stopped!', 'You scared it right out of me!', 'Cured! Never doing that again.', 'My hiccups! They\'re gone!'];
// "Ode to Burps" — the tribe's favourite song, in hiccup form (Hz, 0 = rest)
const SONG = [523, 659, 784, 659, 523, 0, 392, 0, 440, 523, 587, 523, 440, 0, 392, 0, 523, 659, 784, 1047, 784, 659, 523, 0, 587, 523, 494, 440, 392, 0, 392, 0];

export const HiccupMixin = {
  hicInit() {
    this.hiccups = new Map();
    this.concert = null;
  },

  // ---------------------------------------------------------------- hiccups
  startHiccups(uid) {
    if (!this.hiccups) this.hicInit();
    const pool = [...this.agents.values()].filter(a => a.state !== 'concert' && !this.hiccups.has(a.uid) && this.G.gob(a.uid)?.assign?.t !== 'med');
    if (!pool.length) return null;
    const v = this.safeView();
    const vis = pool.filter(a => a.x > v.x0 && a.x < v.x1 && a.y > v.y0 && a.y < v.y1);
    const a = uid ? pool.find(x => x.uid === uid) : pick(vis.length ? vis : pool);
    if (!a) return null;
    this.hiccups.set(a.uid, { until: this.time + 22 + Math.random() * 10, next: 0.6, n: 0 });
    this.say(a, '*hic!* Uh oh...', 2.4);
    return a.uid;
  },
  updateHiccups(dt) {
    if (!this.hiccups) this.hicInit();
    for (const [uid, h] of this.hiccups) {
      const a = this.agents.get(uid);
      if (!a) { this.hiccups.delete(uid); continue; }
      if (this.time > h.until) { this.hiccups.delete(uid); this.say(a, 'Phew... they stopped.', 2.4); continue; }
      h.next -= dt;
      if (h.next > 0) continue;
      h.n++;
      h.next = 1.2 + Math.random() * 1.6;
      const big = h.n % 4 === 0 || Math.random() < 0.15;
      this.hicPop(a, big);
    }
  },
  // one hiccup: a little explosion right where the goblin stands
  hicPop(a, big, color) {
    a.jump = 0.35;
    const x = a.x, y = a.y - 12;
    hic(big ? 330 + Math.random() * 60 : 560 + Math.random() * 220, big);
    const cols = color ? [color, '#ffffff'] : ['#ffb040', '#ffe060', '#ff6a30'];
    for (let i = 0; i < (big ? 22 : 10); i++) {
      const ang = Math.random() * 6.28, sp = (big ? 50 : 30) + Math.random() * 40;
      this.particles.push({ type: 'spark', x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 10, t: 0, life: 0.35 + Math.random() * 0.3, color: pick(cols) });
    }
    this.puff(x, y, big ? '#a8a0a0' : '#d8d0c8', big ? 10 : 4);
    this.addFloat(x, y - 6, big ? 'HIC-BOOM!' : 'HIC!', color || (big ? '#ff8a40' : '#ffe060'), 0.9, big ? 1.2 : 0.9);
    if (big) this.shake(0.15);
    if (!color) this.scareAround(a, big ? 64 : 44);
  },
  // everyone near the blast jumps, screams and runs away
  scareAround(src, r) {
    let n = 0;
    for (const b of this.agents.values()) {
      if (b === src || b.state === 'concert' || this.G.gob(b.uid)?.assign?.t === 'med') continue;
      const dx = b.x - src.x, dy = b.y - src.y, d = Math.hypot(dx, dy);
      if (d > r) continue;
      b.jump = 0.35;
      if (n++ < 2 || Math.random() < 0.3) this.say(b, pick(SCREAMS), 1.6);
      // flee a few tiles directly away from the hiccup
      const k = 5 / Math.max(1, d / TILE);
      const fx = clamp(Math.round((b.x + (dx || Math.random() - 0.5) * k) / TILE), 1, 999), fy = Math.round((b.y + (dy || Math.random() - 0.5) * k) / TILE);
      const here = [Math.floor(b.x / TILE), Math.floor(b.y / TILE)];
      for (const [tx, ty] of [[fx, fy], [fx + 1, fy], [fx, fy + 1], [fx - 1, fy], [fx, fy - 1]]) {
        if (!this.walkable(tx, ty)) continue;
        const p = this.findPath(here[0], here[1], tx, ty);
        if (p && p.length > 1) { b.path = p.slice(1, 10); b.state = 'walk'; b.goal = 'idle'; b.run = true; b.dir = dx >= 0 ? 1 : -1; break; }
      }
    }
  },
  // tap a hiccuping goblin: BOO! (scaring them cures it)
  tapHiccup(a) {
    if (!this.hiccups || !this.hiccups.has(a.uid)) return false;
    this.hiccups.delete(a.uid);
    a.jump = 0.5;
    this.addFloat(a.x, a.y - 30, 'BOO!', '#ff5aa0', 1.4, 1.4);
    this.say(a, pick(CURED), 2.6);
    this.sparkle(a.x, a.y - 12, 16, '#ffe060');
    const v = this.G.cureHiccups();
    if (v) this.coinBurst(a.x, a.y - 14, 8, v);
    this.hooks.sfx('golden');
    return true;
  },
  hasHiccups(uid) { return !!(this.hiccups && this.hiccups.has(uid)); },

  // ---------------------------------------------------------------- the Hiccup Concert
  concertSeats() {
    const d = this.G.pos('dj'), out = [];
    const cx = d.tx + d.w / 2, front = d.ty + d.h;
    for (let ty = front; ty <= front + 4; ty++) for (let tx = Math.floor(cx) - 5; tx <= Math.ceil(cx) + 4; tx++) if (this.walkable(tx, ty)) out.push([tx, ty]);
    out.sort((p, q) => (Math.abs(p[0] + 0.5 - cx) + (p[1] - front) * 1.4) - (Math.abs(q[0] + 0.5 - cx) + (q[1] - front) * 1.4));
    return out;
  },
  startConcertVis() {
    if (!this.hiccups) this.hicInit();
    this.hiccups.clear();
    const seats = this.concertSeats();
    const d = this.G.pos('dj');
    const near = [...this.agents.values()].filter(a => this.G.gob(a.uid)?.assign?.t !== 'med')
      .sort((p, q) => Math.hypot(p.x - (d.tx + 1) * TILE, p.y - (d.ty + 2) * TILE) - Math.hypot(q.x - (d.tx + 1) * TILE, q.y - (d.ty + 2) * TILE))
      .slice(0, Math.min(12, seats.length));
    this.concert = { t: 0, beat: -4, singers: near.map((a, i) => ({ uid: a.uid, seat: seats[i] })) };
    for (const s of this.concert.singers) {
      const a = this.agents.get(s.uid);
      const here = [Math.floor(a.x / TILE), Math.floor(a.y / TILE)];
      const p = this.findPath(here[0], here[1], s.seat[0], s.seat[1]);
      if (p && p.length > 1) { a.path = p.slice(1); a.state = 'walk'; a.goal = 'concert'; a.run = true; }
      else { a.x = s.seat[0] * TILE + 8; a.y = s.seat[1] * TILE + 12; a.path = null; a.state = 'concert'; }
      this.say(a, pick(['Concert time!', 'I warmed up my hiccups!', 'Front row!', 'Woooo!', '*drinks fizzy grog*']), 2);
    }
    this.focusBuilding('dj');
  },
  updateConcert(dt) {
    const c = this.concert; if (!c) return;
    const G = this.G;
    if (!G.rt.concert) { this.endConcertVis(); return; }
    c.t += dt;
    const d = G.pos('dj');
    const stageX = (d.tx + d.w / 2) * TILE, stageY = (d.ty + d.h) * TILE - 30;
    for (const s of c.singers) {
      const a = this.agents.get(s.uid); if (!a) continue;
      if (a.state === 'walk' && a.path) continue;
      a.state = 'concert'; a.path = null; a.timer = 99;
      a.dir = a.x < stageX ? 1 : -1;
    }
    // the beat: 0.42s per note, singers hiccup the song in turn
    const BEAT = 0.42, b = Math.floor(c.t / BEAT) - 4;
    if (b > c.beat) {
      c.beat = b;
      if (b < 0) { this.addFloat(stageX, stageY - 20, ['4', '3', '2', '1'][b + 4] || '', '#ffe060', 0.4, 1.6); hic(300, false); return; }
      const f = SONG[b % SONG.length];
      const ready = c.singers.map(s => this.agents.get(s.uid)).filter(a => a && a.state === 'concert');
      if (f && ready.length) {
        const a = ready[b % ready.length];
        const cols = ['#ff5aa0', '#5ac0ff', '#ffe060', '#7aff6a', '#c080ff'];
        const col = cols[b % cols.length];
        hic(f, false, true);
        this.hicPop(a, false, col);
        this.particles.push({ type: 'note', x: a.x, y: a.y - 22, vx: (Math.random() - 0.5) * 10, vy: -16, t: 0, life: 1.6, color: col });
      }
      // every bar: a firework pop over the stage, and the crowd bounces
      if (b % 8 === 0) {
        const fx = stageX + (Math.random() - 0.5) * 50, fy = stageY - 30 - Math.random() * 20;
        hic(220, true);
        for (let i = 0; i < 26; i++) { const ang = i / 26 * 6.28; this.particles.push({ type: 'spark', x: fx, y: fy, vx: Math.cos(ang) * 50, vy: Math.sin(ang) * 50, t: 0, life: 0.8, color: pick(['#ff5aa0', '#ffe060', '#5ac0ff', '#ffffff']), g: 40 }); }
        for (const a of ready) if (Math.random() < 0.6) a.jump = 0.35;
      }
    }
    // stage lights sweeping + notes from the DJ
    if (Math.random() < dt * 6) this.particles.push({ type: 'note', x: stageX + (Math.random() - 0.5) * 30, y: stageY, vx: (Math.random() - 0.5) * 14, vy: -14, t: 0, life: 2, color: pick(['#ff5aa0', '#5ac0ff', '#ffe060', '#7aff6a']) });
  },
  endConcertVis() {
    const c = this.concert; if (!c) return;
    this.concert = null;
    const d = this.G.pos('dj');
    this.confetti((d.tx + d.w / 2) * TILE, (d.ty + d.h) * TILE - 20, 90);
    for (const s of c.singers) {
      const a = this.agents.get(s.uid); if (!a) continue;
      if (a.state === 'concert') { a.state = 'idle'; a.timer = 1 + Math.random() * 2; }
      if (a.goal === 'concert') a.goal = 'idle';
      a.jump = 0.4;
    }
    const first = c.singers.map(s => this.agents.get(s.uid)).filter(Boolean);
    if (first[0]) this.say(first[0], 'ENCORE! *hic*', 2.5);
    if (first[1]) this.say(first[1], 'Best. Concert. Ever.', 2.5);
  },
  // crowd members bounce to the beat while the concert plays
  concertBob(a) {
    if (a.state !== 'concert' || !this.concert) return 0;
    return Math.round(Math.abs(Math.sin(this.concert.t / 0.42 * Math.PI)) * -2);
  },
};
