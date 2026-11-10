// The capital map: terrain, buildings, wandering goblins, effects, camera & input.
import { TILE, MAP_W, MAP_H, BUILDINGS, BUILDING_BY_ID, DISTRICTS, DECOR, DECOR_SIZE, ROADS, PERSONALITY_LINES, JOB_LINES, GENERIC_LINES, BIZ } from './data.js';
import { goblinSheet, GOB_W, GOB_H, buildingSprite, scaffoldSprite, plotSprite, B_EXTRA, makeCanvas, iconCanvas, shade, enemySprite } from './sprites.js';
import { rng, pick, clamp, fmt, hashStr } from './util.js';

const WW = MAP_W * TILE, WH = MAP_H * TILE;
const FONT = '"Pixelify Sans", "Trebuchet MS", sans-serif';

export class World {
  constructor(canvas, G, hooks) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
    this.G = G;
    this.hooks = hooks;
    this.cam = { x: 28 * TILE, y: 21 * TILE, zoom: 2.5, vx: 0, vy: 0 };
    this.time = 0;
    this.agents = new Map();
    this.particles = [];
    this.floats = [];
    this.bubbleTalk = [];
    this.bounce = {};
    this.flash = {};
    this.ratsVis = new Map();
    this.fireVis = new Map();
    this.golden = null;
    this.invaders = [];
    this.shakeT = 0;
    this.terrainDirty = true;
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.dayLen = 480;
    this.buildGrid();
    this.resize();
    this.bindInput();
  }

  // ------------------------------------------------------------ map grid
  districtAt(tx, ty) {
    for (const d of DISTRICTS) if (tx >= d.x && tx < d.x + d.w && ty >= d.y && ty < d.y + d.h) return d;
    return null;
  }
  buildGrid() {
    const g = this.grid = [];
    for (let y = 0; y < MAP_H; y++) { g.push([]); for (let x = 0; x < MAP_W; x++) g[y].push({ t: 'grass', solid: false, road: false }); }
    for (const [x1, y1, x2, y2] of ROADS) for (let y = y1; y <= y2; y++) for (let x = x1; x <= x2; x++) if (g[y] && g[y][x]) g[y][x].road = true;
    for (let x = 0; x < MAP_W; x++) for (const y of [35, 36]) { g[y][x].t = 'water'; g[y][x].solid = true; }
    for (let x = 26; x <= 28; x++) for (const y of [35, 36]) { g[y][x].t = 'bridge'; g[y][x].solid = false; g[y][x].road = true; }
    // default building plots stay clear of trees (stable scenery)
    for (const b of BUILDINGS) for (let y = b.ty; y <= b.ty + b.h; y++) for (let x = b.tx; x < b.tx + b.w; x++) if (g[y]?.[x]) g[y][x].res = true;
    for (const d of DECOR) { const [w, h] = DECOR_SIZE[d.type]; for (let y = d.ty; y < d.ty + h; y++) for (let x = d.tx; x < d.tx + w; x++) { g[y][x].solid = true; g[y][x].decor = true; } }
    // trees (static scenery) — placed where nothing else is
    const R = rng(42);
    this.trees = [];
    for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
      const c = g[y][x];
      if (c.solid || c.road || c.res || c.t !== 'grass') continue;
      // keep clear near roads and buildings
      let near = false;
      for (let dy = -1; dy <= 1 && !near; dy++) for (let dx = -1; dx <= 1; dx++) { const n = g[y + dy]?.[x + dx]; if (n && (n.road || n.res || n.decor)) near = true; }
      if (near) continue;
      const d = this.districtAt(x, y);
      let p = d ? 0.07 : 0.32;
      if (y >= 37) p = 0.45;
      if (y <= 2) p = 0.05;
      if (d && d.id === 'dragon') p = 0.04;
      if (R() < p) { this.trees.push({ x: x * TILE + 8 + (R() * 6 - 3), y: y * TILE + 14 + (R() * 4 - 2), kind: d && d.id === 'dragon' ? 'dead' : d && d.id === 'hoard' ? 'pine' : R() < 0.3 ? 'pine' : 'oak', s: R() }); c.tree = true; c.solid = true; }
    }
    // crop fields in the outskirts
    this.fields = [[3, 31, 8, 3], [36, 31, 10, 3], [13, 39, 9, 3], [40, 39, 8, 3]];
    for (const [fx, fy, fw, fh] of this.fields) for (let y = fy; y < fy + fh; y++) for (let x = fx; x < fx + fw; x++) if (g[y]?.[x] && !g[y][x].road) { g[y][x].t = 'field'; if (g[y][x].tree) { g[y][x].tree = false; g[y][x].solid = false; } }
    this.trees = this.trees.filter(t => g[Math.floor(t.y / TILE)][Math.floor(t.x / TILE)].tree);
    this.placeVer = -1;
    this.applyPlacements();
  }

  // mark built buildings as solid at their current (player-chosen) spots; clear trees under them
  applyPlacements() {
    const G = this.G, g = this.grid;
    const key = G.placeVer + ':' + G.posAll().map(b => G.s.buildings[b.id].lvl > 0 ? 1 : 0).join('');
    if (this.placeVer === key) return;
    this.placeVer = key;
    for (const row of g) for (const c of row) if (c.bld) { c.bld = null; if (!c.tree && c.t !== 'water') c.solid = false; }
    let cleared = false;
    for (const b of G.posAll()) {
      if (G.s.buildings[b.id].lvl <= 0) continue;
      for (let y = b.ty; y <= b.ty + b.h; y++) for (let x = b.tx; x < b.tx + b.w; x++) {
        const c = g[y]?.[x]; if (!c) continue;
        if (c.tree) { c.tree = false; c.solid = false; cleared = true; }
        if (y < b.ty + b.h) { c.solid = true; c.bld = b.id; }
      }
    }
    if (cleared) { this.trees = this.trees.filter(t => g[Math.floor(t.y / TILE)][Math.floor(t.x / TILE)].tree); }
    this.regKey = null;
    this.terrainDirty = true;
  }

  // a building is drawn if built (wherever placed), or as a "suggested plot" at its default spot when that spot is free
  shown(b) {
    const G = this.G;
    if (G.s.buildings[b.id].lvl > 0) return true;
    return !!(this.plotOk && this.plotOk[b.id]);
  }
  refreshPlots() {
    const G = this.G, key = this.placeVer + '|' + Object.keys(G.s.districts).join(',') + '|' + G.s.level;
    if (this.plotKey === key) return;
    this.plotKey = key; this.plotOk = {};
    for (const b of BUILDINGS) if (G.s.buildings[b.id].lvl <= 0) this.plotOk[b.id] = G.canPlace(b.id, b.tx, b.ty);
  }
  // ---- placement mode
  startPlacing(id, mode, onDone) {
    const G = this.G, d = G.def(id);
    const cur = G.pos(id);
    const near = mode === 'move' ? { tx: cur.tx, ty: cur.ty } : G.findSpot(id, d.tx, d.ty) || G.findSpot(id, 27, 30);
    if (!near) return false;
    this.placing = { id, mode, tx: near.tx, ty: near.ty, onDone };
    this.focus((near.tx + d.w / 2) * TILE, (near.ty + d.h / 2) * TILE);
    return true;
  }
  placeValid() { const p = this.placing; return p && this.G.canPlace(p.id, p.tx, p.ty); }
  walkable(x, y) {
    const c = this.grid[y]?.[x];
    if (!c || c.solid) return false;
    const d = this.districtAt(x, y);
    if (d && !this.G.districtOpen(d.id)) return false;
    return true;
  }

  // A* over tiles, roads are cheaper
  // connected walkable regions, recomputed when the set of open districts changes
  regions() {
    const key = Object.keys(this.G.s.districts).sort().join(',') + '|' + this.placeVer;
    if (this.regKey === key) return this.reg;
    const reg = new Int32Array(MAP_W * MAP_H).fill(-1);
    let id = 0;
    for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
      if (reg[y * MAP_W + x] >= 0 || !this.walkable(x, y)) continue;
      const q = [[x, y]]; reg[y * MAP_W + x] = id;
      while (q.length) {
        const [cx, cy] = q.pop();
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = cx + dx, ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= MAP_W || ny >= MAP_H || reg[ny * MAP_W + nx] >= 0 || !this.walkable(nx, ny)) continue;
          reg[ny * MAP_W + nx] = id; q.push([nx, ny]);
        }
      }
      id++;
    }
    this.regKey = key; this.reg = reg;
    return reg;
  }
  findPath(sx, sy, tx, ty) {
    if (!this.walkable(tx, ty)) return null;
    const reg = this.regions();
    if (this.walkable(sx, sy) && reg[sy * MAP_W + sx] !== reg[ty * MAP_W + tx]) return null;
    const W = MAP_W, key = (x, y) => y * W + x;
    const open = [[0, sx, sy]], g = new Map([[key(sx, sy), 0]]), from = new Map();
    let iter = 0;
    while (open.length && iter++ < 4000) {
      let bi = 0; for (let i = 1; i < open.length; i++) if (open[i][0] < open[bi][0]) bi = i;
      const [f, x, y] = open.splice(bi, 1)[0];
      if (f - Math.abs(tx - x) - Math.abs(ty - y) > g.get(key(x, y)) + 1e-9) continue; // stale entry
      if (x === tx && y === ty) {
        const path = []; let k = key(x, y);
        while (k !== undefined) { path.push([k % W, Math.floor(k / W)]); k = from.get(k); }
        return path.reverse();
      }
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (!this.walkable(nx, ny)) continue;
        const cost = g.get(key(x, y)) + (this.grid[ny][nx].road ? 1 : 2.5);
        const nk = key(nx, ny);
        if (cost < (g.get(nk) ?? Infinity)) { g.set(nk, cost); from.set(nk, key(x, y)); open.push([cost + Math.abs(tx - nx) + Math.abs(ty - ny), nx, ny]); }
      }
    }
    return null;
  }

  // ------------------------------------------------------------ terrain
  buildTerrain() {
    const c = this.terrain || (this.terrain = makeCanvas(WW, WH));
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(WW, WH);
    const D = img.data;
    const R = rng(7);
    const hash = (x, y) => { let h = (x * 374761393 + y * 668265263) ^ 0x5bd1e995; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
    const noise = (x, y, s) => {
      const fx = x / s, fy = y / s, ix = Math.floor(fx), iy = Math.floor(fy), ax = fx - ix, ay = fy - iy;
      const a = hash(ix, iy), b = hash(ix + 1, iy), cc = hash(ix, iy + 1), d = hash(ix + 1, iy + 1);
      const sx = ax * ax * (3 - 2 * ax), sy = ay * ay * (3 - 2 * ay);
      return a + (b - a) * sx + (cc - a) * sy + (a - b - cc + d) * sx * sy;
    };
    const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
    const pal = {
      grass: ['#5fa83e', '#58a038', '#66b044', '#4f9634'].map(hex),
      grassDark: ['#4a8a34', '#447f2f', '#508f38', '#3f7a2c'].map(hex),
      grassGold: ['#8aa83e', '#80a038', '#94ae44', '#7a9634'].map(hex),
      mud: ['#7a6a3a', '#6e5e34', '#84724a', '#706040'].map(hex),
      dirt: ['#b89060', '#a8824f', '#c09a68', '#a07a4a'].map(hex),
      cobble: ['#a8a090', '#989080', '#b8b0a0', '#8a8272'].map(hex),
      dcob: ['#6a6078', '#5e5470', '#766c84', '#544a64'].map(hex),
      rock: ['#6a5a52', '#5e5048', '#76665c', '#54463e'].map(hex),
      sroad: ['#a89a8a', '#9a8c7c', '#b4a696', '#8e8070'].map(hex),
      water: ['#3a8ad0', '#3480c4', '#4494da', '#2e78b8'].map(hex),
      sand: ['#d8c088', '#d0b880'].map(hex),
      bridge: ['#a07040', '#8a6034', '#b0804c'].map(hex),
      field: ['#8a6a3a', '#7a5a30'].map(hex),
      crop: ['#9ac03a', '#b0d050', '#c8c040'].map(hex),
    };
    const grid = this.grid;
    for (let py = 0; py < WH; py++) {
      const ty = Math.floor(py / TILE);
      for (let px = 0; px < WW; px++) {
        const tx = Math.floor(px / TILE);
        const cell = grid[ty][tx];
        const d = this.districtAt(tx, ty);
        const n = noise(px, py, 9), n2 = hash(px, py);
        let col;
        const vi = Math.min(3, Math.floor(n * 3.2 + n2 * 0.9));
        if (cell.t === 'water') {
          const edge = (py % TILE) < 2 && ty === 35 || (py % TILE) > 13 && ty === 36;
          col = edge ? pal.sand[(n2 * 2) | 0] : pal.water[Math.min(3, (noise(px, py * 2, 6) * 4) | 0)];
          if (!edge && hash(px >> 2, py) > 0.985) col = [180, 220, 255];
        } else if (cell.t === 'bridge') {
          col = pal.bridge[(py % 4 === 0) ? 1 : (n2 < 0.1 ? 2 : 0)];
          if (px % TILE === 0 && tx === 26 || px % TILE === 15 && tx === 28) col = [90, 60, 30];
        } else if (cell.road) {
          let rp = pal.dirt;
          if (d && d.ground === 'cobble') rp = pal.cobble;
          else if (d && d.ground === 'dark') rp = pal.dcob;
          else if (d && (d.ground === 'gold' || d.ground === 'rock')) rp = pal.sroad;
          col = rp[vi];
          if (rp !== pal.dirt) {
            const cx = (px + (Math.floor(py / 4) % 2) * 2) % 4, cy = py % 4;
            if (cx === 0 || cy === 0) col = rp[3].map(v => v * 0.85);
          } else if (n2 > 0.97) col = [140, 110, 80];
          // soft edges against grass
          const lx = px % TILE, ly = py % TILE;
          const edgeN = (lx < 2 && !grid[ty][tx - 1]?.road) || (lx > 13 && !grid[ty][tx + 1]?.road) || (ly < 2 && !grid[ty - 1]?.[tx]?.road) || (ly > 13 && !grid[ty + 1]?.[tx]?.road);
          if (edgeN && n2 < 0.55) col = pal.grass[vi];
        } else if (cell.t === 'field') {
          col = (py % 4 < 2) ? pal.field[(n2 * 2) | 0] : pal.crop[Math.min(2, (n * 3) | 0)];
          if (py % 4 === 0 && n2 > 0.6) col = [120, 170, 50];
        } else {
          let gp = pal.grass;
          if (!d) gp = n > 0.55 ? pal.grassDark : pal.grass;
          else if (d.ground === 'mud') gp = n > 0.68 ? pal.mud : pal.grass;
          else if (d.ground === 'dark') gp = pal.grassDark;
          else if (d.ground === 'gold') gp = n > 0.5 ? pal.grassGold : pal.grass;
          else if (d.ground === 'rock') gp = n > 0.35 ? pal.rock : pal.grassDark;
          col = gp[vi];
          if (n2 > 0.997) col = [[240, 240, 240], [255, 220, 80], [230, 110, 160], [160, 140, 255]][(n2 * 1000 | 0) % 4];
          else if (n2 > 0.95 && gp !== pal.rock && gp !== pal.mud) col = gp[3].map(v => v * 0.85);
          if (d && d.ground === 'rock' && n2 > 0.985) col = [255, 120, 40];
          if (d && d.ground === 'gold' && n2 > 0.993) col = [255, 230, 120];
          if (cell.bld) col = col.map(v => v * 0.9);
        }
        const i = (py * WW + px) * 4;
        D[i] = col[0]; D[i + 1] = col[1]; D[i + 2] = col[2]; D[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    // mountains along the top (backdrop)
    for (let x = -10; x < WW + 20; x += 22) {
      const h = 22 + hash(x, 3) * 26;
      const d = this.districtAt(Math.floor(Math.max(0, x) / TILE), 0);
      const base = d && d.id === 'dragon' ? '#5a4a52' : '#7a8a9a';
      ctx.fillStyle = base;
      ctx.beginPath(); ctx.moveTo(x - 20, 30); ctx.lineTo(x + 6, 30 - h); ctx.lineTo(x + 32, 30); ctx.fill();
      ctx.fillStyle = shade(base, -0.2);
      ctx.beginPath(); ctx.moveTo(x + 6, 30 - h); ctx.lineTo(x + 32, 30); ctx.lineTo(x + 12, 30); ctx.fill();
      ctx.fillStyle = d && d.id === 'dragon' ? '#ff7a30' : '#f0f4f8';
      ctx.beginPath(); ctx.moveTo(x + 6, 30 - h); ctx.lineTo(x + 1, 30 - h + 8); ctx.lineTo(x + 11, 30 - h + 8); ctx.fill();
    }
    // fences around fields
    ctx.fillStyle = '#8a5a30';
    for (const [fx, fy, fw, fh] of this.fields) {
      ctx.fillRect(fx * TILE, fy * TILE, fw * TILE, 1);
      ctx.fillRect(fx * TILE, (fy + fh) * TILE - 1, fw * TILE, 1);
      for (let x = fx * TILE; x <= (fx + fw) * TILE; x += 6) { ctx.fillRect(x, fy * TILE - 2, 1, 4); ctx.fillRect(x, (fy + fh) * TILE - 3, 1, 4); }
    }
    // rocks & bushes
    for (let i = 0; i < 160; i++) {
      const x = Math.floor(R() * MAP_W), y = Math.floor(R() * MAP_H);
      const cell = grid[y][x]; if (cell.solid || cell.road || cell.t !== 'grass') continue;
      const px = x * TILE + R() * 12, py = y * TILE + R() * 12;
      if (R() < 0.5) { ctx.fillStyle = '#8a8a8a'; ctx.fillRect(px, py, 4, 3); ctx.fillStyle = '#aaaaaa'; ctx.fillRect(px, py, 3, 1); ctx.fillStyle = '#5a5a5a'; ctx.fillRect(px, py + 3, 4, 1); }
      else { ctx.fillStyle = '#3a7a2a'; ctx.beginPath(); ctx.arc(px + 3, py + 3, 3.5, 0, 7); ctx.fill(); ctx.fillStyle = '#4a9a3a'; ctx.fillRect(px + 1, py + 1, 2, 2); if (R() < 0.4) { ctx.fillStyle = '#e04a4a'; ctx.fillRect(px + 4, py + 2, 1, 1); } }
    }
    // gate at the bottom
    ctx.fillStyle = '#6a4a2a'; ctx.fillRect(25 * TILE, 41 * TILE, 4, 24); ctx.fillRect(29 * TILE - 4, 41 * TILE, 4, 24);
    ctx.fillRect(25 * TILE, 41 * TILE, 4 * TILE, 4);
    // tree sprites baked in (they are static)
    this.treeSprites = this.treeSprites || {};
    const sorted = this.trees.slice().sort((a, b) => a.y - b.y);
    for (const t of sorted) this.drawTree(ctx, t);
    this.terrainDirty = false;
  }

  drawTree(ctx, t) {
    const x = Math.round(t.x), y = Math.round(t.y);
    ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.beginPath(); ctx.ellipse(x, y, 7, 3, 0, 0, 7); ctx.fill();
    if (t.kind === 'pine') {
      ctx.fillStyle = '#5a3a20'; ctx.fillRect(x - 1, y - 5, 3, 5);
      const g1 = t.s > 0.5 ? '#2f6a3a' : '#2a5a32', g2 = shade(g1, 0.2);
      for (let i = 0; i < 4; i++) {
        const w = 10 - i * 2, yy = y - 6 - i * 5;
        ctx.fillStyle = '#1c1424'; ctx.fillRect(x - w / 2 - 1, yy - 1, w + 2, 6);
        ctx.fillStyle = g1; ctx.fillRect(x - w / 2, yy, w, 5);
        ctx.fillStyle = g2; ctx.fillRect(x - w / 2, yy, w / 2, 2);
      }
    } else if (t.kind === 'dead') {
      ctx.fillStyle = '#3a2a2a'; ctx.fillRect(x - 1, y - 14, 3, 14); ctx.fillRect(x - 5, y - 12, 5, 2); ctx.fillRect(x + 2, y - 9, 5, 2); ctx.fillRect(x - 5, y - 15, 2, 4);
    } else {
      ctx.fillStyle = '#5a3a20'; ctx.fillRect(x - 1, y - 7, 3, 7);
      const g1 = t.s > 0.6 ? '#3e8a34' : t.s > 0.3 ? '#47963a' : '#3a8030';
      ctx.fillStyle = '#1c1424'; ctx.beginPath(); ctx.arc(x, y - 13, 9, 0, 7); ctx.fill();
      ctx.fillStyle = g1; ctx.beginPath(); ctx.arc(x, y - 13, 8, 0, 7); ctx.fill();
      ctx.fillStyle = shade(g1, 0.2); ctx.beginPath(); ctx.arc(x - 3, y - 16, 4, 0, 7); ctx.fill();
      ctx.fillStyle = shade(g1, -0.2); ctx.fillRect(x + 2, y - 9, 4, 2);
      if (t.s > 0.85) { ctx.fillStyle = '#e04a4a'; ctx.fillRect(x - 4, y - 12, 2, 2); ctx.fillRect(x + 3, y - 15, 2, 2); }
    }
  }

  // ------------------------------------------------------------ camera
  resize() {
    const r = this.cv.getBoundingClientRect();
    this.sw = r.width; this.sh = r.height;
    this.cv.width = Math.round(r.width * this.dpr);
    this.cv.height = Math.round(r.height * this.dpr);
    if (!this.zoomSet) { this.cam.zoom = clamp(this.sw / (15 * TILE), 1.7, 3.4); this.zoomSet = true; }
    this.minZoom = Math.max(1.1, Math.max(this.sw / WW, this.sh / WH) * 1.02);
    this.clampCam();
  }
  clampCam() {
    const z = this.cam.zoom = clamp(this.cam.zoom, this.minZoom || 1.2, 5);
    const hw = this.sw / z / 2, hh = this.sh / z / 2;
    this.cam.x = clamp(this.cam.x, hw - 8, WW - hw + 8);
    this.cam.y = clamp(this.cam.y, hh - 8, WH - hh + 8);
  }
  toScreen(wx, wy) { return [(wx - this.cam.x) * this.cam.zoom + this.sw / 2, (wy - this.cam.y) * this.cam.zoom + this.sh / 2]; }
  toWorld(sx, sy) { return [(sx - this.sw / 2) / this.cam.zoom + this.cam.x, (sy - this.sh / 2) / this.cam.zoom + this.cam.y]; }
  focus(wx, wy, smooth = true) { this.camTarget = smooth ? { x: wx, y: wy } : null; if (!smooth) { this.cam.x = wx; this.cam.y = wy; this.clampCam(); } }
  focusBuilding(id) { const b = this.G.pos(id); this.focus((b.tx + b.w / 2) * TILE, (b.ty + b.h / 2) * TILE + 10); }
  viewRect() { const [x0, y0] = this.toWorld(0, 0), [x1, y1] = this.toWorld(this.sw, this.sh); return { x0, y0, x1, y1 }; }
  // visible area not covered by the HUD (top) and nav/ticker (bottom)
  safeView() { const [x0, y0] = this.toWorld(12, 175), [x1, y1] = this.toWorld(this.sw - 12, this.sh - 100); return { x0, y0, x1: Math.max(x0 + 20, x1), y1: Math.max(y0 + 20, y1) }; }

  bindInput() {
    const cv = this.cv;
    const ptrs = new Map();
    let down = null, pinch = null, moved = 0, lastMove = 0;
    cv.addEventListener('pointerdown', e => {
      if (e.isPrimary) { ptrs.clear(); pinch = null; }
      try { cv.setPointerCapture(e.pointerId); } catch (err) { }
      ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (ptrs.size === 1) { down = { x: e.clientX, y: e.clientY, t: performance.now() }; moved = 0; this.cam.vx = this.cam.vy = 0; this.camTarget = null; }
      if (ptrs.size === 2) {
        const [a, b] = [...ptrs.values()];
        pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), z: this.cam.zoom };
      }
    });
    cv.addEventListener('pointermove', e => {
      const p = ptrs.get(e.pointerId); if (!p) return;
      const dx = e.clientX - p.x, dy = e.clientY - p.y;
      p.x = e.clientX; p.y = e.clientY;
      if (ptrs.size === 2 && pinch) {
        const [a, b] = [...ptrs.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        const r = cv.getBoundingClientRect();
        const mx = (a.x + b.x) / 2 - r.left, my = (a.y + b.y) / 2 - r.top;
        this.zoomAt(mx, my, pinch.z * d / pinch.d);
        moved = 99;
        return;
      }
      if (ptrs.size === 1) {
        moved += Math.abs(dx) + Math.abs(dy);
        if (moved > 6) {
          this.cam.x -= dx / this.cam.zoom; this.cam.y -= dy / this.cam.zoom;
          const now = performance.now(), dt = Math.max(1, now - lastMove) / 1000; lastMove = now;
          this.cam.vx = -dx / this.cam.zoom / dt * 0.6 + this.cam.vx * 0.4; this.cam.vy = -dy / this.cam.zoom / dt * 0.6 + this.cam.vy * 0.4;
          this.clampCam();
        }
      }
    });
    const up = e => {
      if (!ptrs.has(e.pointerId)) return;
      ptrs.delete(e.pointerId);
      if (ptrs.size < 2) pinch = null;
      if (ptrs.size === 0) {
        if (down && moved <= 6) {
          const r = cv.getBoundingClientRect();
          this.tap(e.clientX - r.left, e.clientY - r.top);
          this.cam.vx = this.cam.vy = 0;
        }
        if (performance.now() - lastMove > 80) { this.cam.vx = this.cam.vy = 0; }
        down = null;
      }
    };
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', e => { ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch = null; if (!ptrs.size) down = null; });
    cv.addEventListener('lostpointercapture', e => { if (ptrs.has(e.pointerId)) { ptrs.delete(e.pointerId); if (!ptrs.size) down = null; } });
    cv.addEventListener('wheel', e => {
      e.preventDefault();
      const r = cv.getBoundingClientRect();
      this.zoomAt(e.clientX - r.left, e.clientY - r.top, this.cam.zoom * (e.deltaY < 0 ? 1.12 : 1 / 1.12));
    }, { passive: false });
  }
  zoomAt(sx, sy, z) {
    const [wx, wy] = this.toWorld(sx, sy);
    this.cam.zoom = clamp(z, this.minZoom || 1.2, 5);
    const [nx, ny] = this.toWorld(sx, sy);
    this.cam.x += wx - nx; this.cam.y += wy - ny;
    this.clampCam();
  }

  // ------------------------------------------------------------ tap handling
  tap(sx, sy) {
    const [wx, wy] = this.toWorld(sx, sy);
    const G = this.G;
    if (this.placing) {
      const d = G.def(this.placing.id);
      this.placing.tx = clamp(Math.round(wx / TILE - d.w / 2), 0, MAP_W - d.w);
      this.placing.ty = clamp(Math.round(wy / TILE - d.h / 2 - 0.3), 0, MAP_H - d.h - 1);
      this.hooks.sfx(this.placeValid() ? 'tap' : 'error');
      this.hooks.onPlaceMove && this.hooks.onPlaceMove();
      return;
    }
    const hitR = 14 / this.cam.zoom + 6;
    // golden goblin
    if (this.golden && Math.hypot(wx - this.golden.x, wy - (this.golden.y - 10)) < hitR + 8) {
      const res = G.catchGolden();
      if (res) {
        this.sparkle(this.golden.x, this.golden.y - 10, 30, '#ffe060');
        this.addFloat(this.golden.x, this.golden.y - 24, res.text, '#ffe060', 2.5, 1.3);
        this.hooks.sfx('golden');
        this.hooks.haptic && this.hooks.haptic(30);
      }
      this.golden = null;
      return;
    }
    // bubbles
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
    // rats
    for (const [id, r] of this.ratsVis) {
      if (Math.hypot(wx - r.x, wy - r.y) < hitR + 2) {
        const v = G.squashRat(id);
        if (v) { this.puff(r.x, r.y, '#ddd', 8); this.addFloat(r.x, r.y - 8, 'Squeak! +' + fmt(v) + ' 🍄'.replace(' 🍄', ' shrooms'), '#fff'); this.hooks.sfx('squeak'); }
        this.ratsVis.delete(id);
        return;
      }
    }
    // fires
    for (const f of G.rt.fires) {
      const b = this.G.pos(f.bid);
      const fx = (b.tx + b.w / 2) * TILE, fy = (b.ty + b.h / 2) * TILE;
      if (Math.abs(wx - fx) < b.w * 8 && Math.abs(wy - fy) < b.h * 8 + 8) {
        G.tapFire(f.id);
        this.splash(fx + (Math.random() - 0.5) * 16, fy - 6);
        this.hooks.sfx('splash');
        if (!G.rt.fires.includes(f)) { this.addFloat(fx, fy - 20, 'Fire out!', '#8ad8ff'); this.puff(fx, fy - 8, '#ccc', 14); }
        return;
      }
    }
    // goblins
    let best = null, bd = 1e9;
    for (const a of this.agents.values()) {
      const d = Math.hypot(wx - a.x, wy - (a.y - 10));
      if (d < Math.max(10, hitR) && d < bd) { bd = d; best = a; }
    }
    if (best) {
      best.jump = 0.35;
      this.say(best, this.lineFor(best), 2.5);
      this.hooks.sfx('gob');
      this.hooks.onGoblin(best.uid);
      return;
    }
    // buildings / plots
    for (const b of this.G.posAll()) {
      if (!this.shown(b)) continue;
      const x0 = b.tx * TILE, y0 = b.ty * TILE - B_EXTRA + 6, x1 = (b.tx + b.w) * TILE, y1 = (b.ty + b.h) * TILE;
      if (wx >= x0 && wx < x1 && wy >= y0 && wy < y1) {
        this.bounce[b.id] = 0.3;
        this.hooks.sfx('tap');
        this.hooks.onBuilding(b.id);
        return;
      }
    }
    // locked districts
    const d = this.districtAt(Math.floor(wx / TILE), Math.floor(wy / TILE));
    if (d && !G.districtOpen(d.id)) { this.hooks.onDistrict(d.id); return; }
  }

  // ------------------------------------------------------------ agents
  syncAgents() {
    const G = this.G;
    const live = new Set();
    for (const g of G.s.goblins) {
      if (g.assign && g.assign.t === 'exp') continue;
      live.add(g.uid);
      if (!this.agents.has(g.uid)) {
        const spawn = this.randomRoadTile(true) || [27, 22];
        this.agents.set(g.uid, { uid: g.uid, x: spawn[0] * TILE + 8, y: spawn[1] * TILE + 12, path: null, state: 'idle', timer: Math.random() * 2, dir: 1, f: 0, anim: Math.random() * 10, jump: 0, speed: 18 + Math.random() * 8 });
      }
    }
    for (const uid of [...this.agents.keys()]) if (!live.has(uid)) this.agents.delete(uid);
  }
  randomRoadTile(visibleFirst) {
    const cands = [];
    const v = this.viewRect();
    for (let i = 0; i < 60; i++) {
      const x = Math.floor(Math.random() * MAP_W), y = Math.floor(Math.random() * MAP_H);
      const c = this.grid[y][x];
      if (!(c.road) || !this.walkable(x, y)) continue;
      if (visibleFirst && (x * TILE < v.x0 || x * TILE > v.x1 || y * TILE < v.y0 || y * TILE > v.y1)) { cands.push([x, y, 1]); continue; }
      return [x, y];
    }
    return cands[0] || null;
  }
  workSpot(a, g) {
    if (g.assign?.t === 'b') {
      const b = this.G.pos(g.assign.id);
      const n = this.G.workers(b.id).indexOf(g);
      const offs = [0, -1, 1, -2];
      const tx = clamp(b.tx + Math.floor(b.w / 2) + offs[Math.max(0, n)], b.tx, b.tx + b.w - 1);
      return [tx, b.ty + b.h];
    }
    if (g.assign?.t === 'med') {
      if (this.G.isBuilt('infirmary')) { const b = this.G.pos('infirmary'); return [b.tx + (g.uid % b.w), b.ty + b.h]; }
      return [29 + (g.uid % 3), 27];
    }
    if (g.assign?.t === 'def') { const b = this.G.pos('barracks'); return [b.tx + Math.floor(Math.random() * b.w), b.ty + b.h]; }
    return null;
  }
  lineFor(a) {
    const g = this.G.gob(a.uid); if (!g) return 'Hm?';
    const r = Math.random();
    if (r < 0.35 && PERSONALITY_LINES[g.trait]) return pick(PERSONALITY_LINES[g.trait]);
    if (r < 0.65 && JOB_LINES[g.job]) return pick(JOB_LINES[g.job]);
    return pick(GENERIC_LINES);
  }
  say(a, text, dur = 3) {
    this.bubbleTalk = this.bubbleTalk.filter(b => b.a !== a);
    this.bubbleTalk.push({ a, text, t: dur });
    if (this.bubbleTalk.length > 4) this.bubbleTalk.shift();
  }

  updateAgents(dt) {
    const G = this.G;
    for (const a of this.agents.values()) {
      const g = G.gob(a.uid); if (!g) continue;
      a.anim += dt;
      a.jump = Math.max(0, a.jump - dt);
      if (a.state === 'walk' && a.path) {
        const [tx, ty] = a.path[0];
        const gx = tx * TILE + 8, gy = ty * TILE + 12;
        const dx = gx - a.x, dy = gy - a.y, d = Math.hypot(dx, dy);
        const sp = a.speed * (g.assign?.t === 'b' ? 1.2 : 1) * (a.run ? 2 : 1) * (g.assign?.t === 'med' ? 0.45 : 1);
        if (d < sp * dt + 0.5) { a.x = gx; a.y = gy; a.path.shift(); if (!a.path.length) { a.path = null; a.state = a.goal || 'idle'; a.timer = a.state === 'work' ? 6 + Math.random() * 10 : 1.5 + Math.random() * 4; a.run = false; } }
        else { a.x += dx / d * sp * dt; a.y += dy / d * sp * dt; if (Math.abs(dx) > 0.3) a.dir = dx > 0 ? 1 : -1; }
        continue;
      }
      a.timer -= dt;
      if (a.state === 'argue') { if (a.timer <= 0) { a.state = 'idle'; a.timer = 1; } continue; }
      if (a.timer > 0) continue;
      // decide next action
      const spot = this.workSpot(a, g);
      const here = [Math.floor(a.x / TILE), Math.floor(a.y / TILE)];
      if (spot && (here[0] !== spot[0] || here[1] !== spot[1]) && (a.state !== 'work' || Math.random() < 0.7)) {
        if (a.state === 'work' && Math.random() < 0.3) { // short wander from work
          this.wander(a, here, 3);
        } else {
          const p = this.findPath(here[0], here[1], spot[0], spot[1]);
          if (p && p.length > 1) { a.path = p.slice(1); a.state = 'walk'; a.goal = g.assign?.t === 'b' ? 'work' : 'idle'; }
          else { a.state = spot ? 'work' : 'idle'; a.timer = 3; if (!p) { a.x = spot[0] * TILE + 8; a.y = spot[1] * TILE + 12; } }
        }
      } else if (spot && a.state !== 'work') {
        a.state = 'work'; a.timer = 6 + Math.random() * 8;
        a.dir = Math.random() < 0.5 ? 1 : -1;
      } else if (!spot) {
        const r = Math.random();
        if (r < 0.65) this.wander(a, here, 8);
        else { a.state = 'idle'; a.timer = 2 + Math.random() * 4; if (Math.random() < 0.25) this.say(a, this.lineFor(a), 2.6); }
      } else { a.timer = 3 + Math.random() * 6; }
    }
    // occasional arguments between idle goblins near each other
    if (Math.random() < dt * 0.06) {
      const idle = [...this.agents.values()].filter(a => a.state === 'idle');
      for (let i = 0; i < idle.length; i++) for (let j = i + 1; j < idle.length; j++) {
        const A = idle[i], B = idle[j];
        if (Math.hypot(A.x - B.x, A.y - B.y) < 40) {
          A.state = B.state = 'argue'; A.timer = B.timer = 4;
          A.dir = B.x > A.x ? 1 : -1; B.dir = -A.dir;
          this.say(A, pick(['Mine!', 'You smell!', 'No, YOU smell!', '@#$%!', 'That\'s MY rock!', 'Spoon thief!']), 2);
          setTimeout(() => this.say(B, pick(['Make me!', '*bonk*', 'Says who?!', '!!!', 'Your hat is ugly!']), 2), 900);
          this.argueCloud = { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 - 8, t: 3.5 };
          return;
        }
      }
    }
    // random chatter
    if (Math.random() < dt * 0.25 && this.agents.size) {
      const v = this.viewRect();
      const vis = [...this.agents.values()].filter(a => a.x > v.x0 && a.x < v.x1 && a.y > v.y0 && a.y < v.y1 && a.state !== 'walk');
      if (vis.length) this.say(pick(vis), this.lineFor(pick(vis)), 2.6);
    }
  }
  wander(a, here, r) {
    for (let k = 0; k < 6; k++) {
      const tx = here[0] + Math.round((Math.random() - 0.5) * 2 * r), ty = here[1] + Math.round((Math.random() - 0.5) * 2 * r);
      if (!this.walkable(tx, ty) || !(this.grid[ty][tx].road || Math.random() < 0.3)) continue;
      const p = this.findPath(here[0], here[1], tx, ty);
      if (p && p.length > 1) { a.path = p.slice(1, 14); a.state = 'walk'; a.goal = 'idle'; return; }
    }
    a.state = 'idle'; a.timer = 2;
  }

  // ------------------------------------------------------------ effects
  bubblePos(b) {
    const d = this.G.pos(b.bid);
    const t = this.time + (b.id * 10);
    return [(d.tx + d.w / 2) * TILE, d.ty * TILE - B_EXTRA + 4 + Math.sin(t * 2.5) * 2];
  }
  addFloat(x, y, text, color = '#fff', dur = 1.4, size = 1) { this.floats.push({ x, y, text, color, t: 0, dur, size }); }
  coinBurst(x, y, n, value) {
    for (let i = 0; i < n; i++) this.particles.push({ type: 'coin', x, y, vx: (Math.random() - 0.5) * 70, vy: -40 - Math.random() * 60, t: 0, life: 0.6 + Math.random() * 0.3, fly: true });
    if (value !== undefined) this.addFloat(x, y - 10, '+' + fmt(value), '#ffe060');
  }
  sparkle(x, y, n, color = '#fff8c0') {
    for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, s = 20 + Math.random() * 60; this.particles.push({ type: 'spark', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: 0, life: 0.5 + Math.random() * 0.6, color }); }
  }
  confetti(x, y, n = 40) {
    const cols = ['#ff5a5a', '#ffe060', '#5ad0ff', '#7aff6a', '#ff80ff', '#ffffff'];
    for (let i = 0; i < n; i++) this.particles.push({ type: 'conf', x, y, vx: (Math.random() - 0.5) * 140, vy: -60 - Math.random() * 100, t: 0, life: 1.4 + Math.random(), color: pick(cols), rot: Math.random() * 6 });
  }
  puff(x, y, color = '#ddd', n = 8) {
    for (let i = 0; i < n; i++) this.particles.push({ type: 'puff', x: x + (Math.random() - 0.5) * 10, y: y + (Math.random() - 0.5) * 6, vx: (Math.random() - 0.5) * 30, vy: -10 - Math.random() * 20, t: 0, life: 0.6 + Math.random() * 0.5, color, r: 2 + Math.random() * 3 });
  }
  splash(x, y) {
    for (let i = 0; i < 10; i++) this.particles.push({ type: 'spark', x, y, vx: (Math.random() - 0.5) * 60, vy: -30 - Math.random() * 50, t: 0, life: 0.5, color: '#8ad8ff', g: 200 });
  }
  smoke(x, y, dark) { this.particles.push({ type: 'puff', x, y, vx: (Math.random() - 0.5) * 6, vy: -8 - Math.random() * 6, t: 0, life: 2 + Math.random(), color: dark ? '#4a4a4a' : '#c8c8c8', r: 1.5 + Math.random() * 1.5, grow: 1.5 }); }
  shake(t = 0.3) { this.shakeT = t; }

  onBuild(id) { const b = this.G.pos(id); this.focusBuilding(id); this.puff((b.tx + b.w / 2) * TILE, (b.ty + b.h) * TILE - 6, '#c8a878', 16); }
  onBuilt(id) { const b = this.G.pos(id); const x = (b.tx + b.w / 2) * TILE, y = (b.ty + b.h / 2) * TILE; this.confetti(x, y - 10, 50); this.puff(x, y + 10, '#d8c8a8', 20); this.flash[id] = 0.5; this.bounce[id] = 0.5; this.addFloat(x, y - 30, 'BUILT!', '#7aff6a', 1.8, 1.4); }
  onUpgrade(id, n) { const b = this.G.pos(id); const x = (b.tx + b.w / 2) * TILE, y = b.ty * TILE; this.bounce[id] = 0.35; this.sparkle(x, y, 10, '#ffe060'); this.addFloat(x, y - 6, n > 1 ? `+${n} levels` : 'Level up!', '#ffe060', 1.1); }
  onMilestone(id, lvl) { const b = this.G.pos(id); const x = (b.tx + b.w / 2) * TILE, y = b.ty * TILE; this.confetti(x, y, 70); this.flash[id] = 0.7; this.bounce[id] = 0.6; this.addFloat(x, y - 14, `LEVEL ${lvl}! INCOME ×2`, '#ff80ff', 2.4, 1.3); this.shake(0.25); }

  // ------------------------------------------------------------ update
  update(dt) {
    const G = this.G;
    this.time += dt;
    if (this.terrainDirty) this.buildTerrain();
    // camera inertia & smooth focus
    if (this.camTarget) {
      this.cam.x += (this.camTarget.x - this.cam.x) * Math.min(1, dt * 5);
      this.cam.y += (this.camTarget.y - this.cam.y) * Math.min(1, dt * 5);
      if (Math.hypot(this.camTarget.x - this.cam.x, this.camTarget.y - this.cam.y) < 1) this.camTarget = null;
      this.clampCam();
    } else if (this.cam.vx || this.cam.vy) {
      this.cam.x += this.cam.vx * dt; this.cam.y += this.cam.vy * dt;
      this.cam.vx *= Math.pow(0.02, dt); this.cam.vy *= Math.pow(0.02, dt);
      if (Math.abs(this.cam.vx) < 2 && Math.abs(this.cam.vy) < 2) this.cam.vx = this.cam.vy = 0;
      this.clampCam();
    }
    this.applyPlacements();
    this.refreshPlots();
    this.syncAgents();
    this.updateAgents(dt);
    for (const k in this.bounce) { this.bounce[k] -= dt; if (this.bounce[k] <= 0) delete this.bounce[k]; }
    for (const k in this.flash) { this.flash[k] -= dt; if (this.flash[k] <= 0) delete this.flash[k]; }
    this.bubbleTalk = this.bubbleTalk.filter(b => (b.t -= dt) > 0);
    if (this.argueCloud && (this.argueCloud.t -= dt) <= 0) this.argueCloud = null;
    // particles
    for (const p of this.particles) {
      p.t += dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.type === 'coin' || p.type === 'conf' || p.g) p.vy += (p.g || 220) * dt;
      if (p.type === 'conf') { p.vx *= 0.98; p.rot += dt * 8; }
      if (p.type === 'puff') { p.vx *= 0.95; p.r += (p.grow || 3) * dt; }
    }
    this.particles = this.particles.filter(p => p.t < p.life);
    if (this.particles.length > 600) this.particles.splice(0, this.particles.length - 600);
    this.floats = this.floats.filter(f => (f.t += dt) < f.dur);
    // building ambient smoke etc
    if (Math.random() < dt * 3) {
      const opts = ['tavern', 'smithy', 'potion', 'cauldron', 'alchemy', 'hatchery'].filter(id => G.isBuilt(id) && !G.isConstructing(id));
      if (opts.length) {
        const id = pick(opts), b = this.G.pos(id);
        const sx = { tavern: b.w * TILE - 10, smithy: b.w * TILE - 18, potion: b.w * TILE / 2, cauldron: b.w * TILE / 2, alchemy: b.w * TILE / 2, hatchery: b.w * TILE / 2 }[id];
        const sy = { tavern: -26, smithy: -24, potion: -36, cauldron: -10, alchemy: -26, hatchery: -40 }[id];
        if (id === 'cauldron' || id === 'potion' || id === 'alchemy') this.particles.push({ type: 'spark', x: b.tx * TILE + sx + (Math.random() - 0.5) * 12, y: (b.ty + b.h) * TILE + sy, vx: 0, vy: -12, t: 0, life: 1, color: id === 'potion' ? '#e0a0ff' : '#a0ffa0', g: -2 });
        else this.smoke(b.tx * TILE + sx, (b.ty + b.h) * TILE + sy, id === 'hatchery');
      }
    }
    for (const id in G.s.damaged) { if (Math.random() < dt * 2) { const b = this.G.pos(id); this.smoke((b.tx + Math.random() * b.w) * TILE, b.ty * TILE, true); } }
    // construction
    for (const b of this.G.posAll()) {
      const st = G.s.buildings[b.id];
      if (st.built > G.now()) {
        if (Math.random() < dt * 6) this.puff((b.tx + Math.random() * b.w) * TILE, (b.ty + b.h) * TILE - 4, '#c8b088', 1);
        this.constructing = this.constructing || {};
        this.constructing[b.id] = true;
      } else if (this.constructing && this.constructing[b.id]) {
        delete this.constructing[b.id];
        this.onBuilt(b.id);
        this.hooks.onBuilt && this.hooks.onBuilt(b.id);
      }
    }
    // golden goblin
    if (G.rt.golden && !this.golden) {
      const v = this.safeView();
      const y = v.y0 + 24 + Math.random() * Math.max(1, v.y1 - v.y0 - 24);
      const fromLeft = Math.random() < 0.5;
      this.golden = { x: fromLeft ? v.x0 - 10 : v.x1 + 10, y, vx: (fromLeft ? 1 : -1) * (v.x1 - v.x0 + 40) / 12, hop: 0 };
      this.hooks.sfx('sparkle');
    }
    if (this.golden) {
      this.golden.x += this.golden.vx * dt;
      this.golden.hop += dt;
      if (Math.random() < dt * 20) this.particles.push({ type: 'spark', x: this.golden.x, y: this.golden.y - 10, vx: (Math.random() - 0.5) * 10, vy: -10, t: 0, life: 0.7, color: '#ffe060' });
      if (!G.rt.golden) this.golden = null;
    }
    // rats
    for (const r of G.rt.rats) {
      if (!this.ratsVis.has(r.id)) {
        const v = this.safeView();
        const x = v.x0 + Math.random() * (v.x1 - v.x0), y = v.y0 + 8 + Math.random() * Math.max(1, v.y1 - v.y0 - 8);
        this.ratsVis.set(r.id, { x, y, tx: x, ty: y, t: 0 });
      }
    }
    for (const [id, r] of this.ratsVis) {
      if (!G.rt.rats.find(x => x.id === id)) { this.ratsVis.delete(id); continue; }
      r.t -= dt;
      if (r.t <= 0) { r.tx = r.x + (Math.random() - 0.5) * 80; r.ty = r.y + (Math.random() - 0.5) * 50; r.t = 0.5 + Math.random(); const v = this.safeView(); r.tx = clamp(r.tx, v.x0, v.x1); r.ty = clamp(r.ty, v.y0 + 8, v.y1); }
      const dx = r.tx - r.x, dy = r.ty - r.y, d = Math.hypot(dx, dy);
      if (d > 1) { r.x += dx / d * 55 * dt; r.y += dy / d * 55 * dt; r.dir = dx > 0 ? 1 : -1; }
    }
    // invaders marching
    const inv = G.rt.invasion;
    if (inv && !this.invaders.length) {
      this.invaders = inv.enemies.map((e, i) => ({ kind: e.kind, x: 27 * TILE + 8 + (i - inv.enemies.length / 2) * 12, y: 43 * TILE + i * 6 }));
    }
    if (!inv) this.invaders = [];
    else {
      const left = Math.max(0, (inv.until - G.now()) / 45000);
      for (const [i, u] of this.invaders.entries()) { u.y = 29 * TILE + (14 * TILE) * left + i * 6; u.x += Math.sin(this.time * 3 + i) * 0.1; }
    }
  }

  // ------------------------------------------------------------ render
  render() {
    const G = this.G, ctx = this.ctx, z = this.cam.zoom, dpr = this.dpr;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#2a4a24';
    ctx.fillRect(0, 0, this.cv.width, this.cv.height);
    if (!this.terrain) return;
    let shx = 0, shy = 0;
    if (this.shakeT > 0) { this.shakeT -= 1 / 60; shx = (Math.random() - 0.5) * 4; shy = (Math.random() - 0.5) * 4; }
    const S = z * dpr;
    const ox = Math.round((-this.cam.x * z + this.sw / 2 + shx) * dpr), oy = Math.round((-this.cam.y * z + this.sh / 2 + shy) * dpr);
    ctx.setTransform(S, 0, 0, S, ox, oy);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.terrain, 0, 0);
    const v = this.viewRect();
    // water shimmer
    ctx.fillStyle = 'rgba(200,235,255,0.7)';
    for (let i = 0; i < 14; i++) {
      const x = ((i * 97 + this.time * 14 * (i % 2 ? 1 : -0.6)) % WW + WW) % WW;
      ctx.fillRect(Math.floor(x), 35 * TILE + 4 + (i * 7) % 22, 3, 1);
    }
    // drawables
    const items = [];
    for (const b of this.G.posAll()) {
      if (!this.shown(b) || (this.placing && this.placing.id === b.id && this.placing.mode === 'move')) continue;
      const by = (b.ty + b.h) * TILE;
      if ((b.tx + b.w) * TILE < v.x0 - 20 || b.tx * TILE > v.x1 + 20 || by < v.y0 - 10 || by - b.h * TILE - B_EXTRA > v.y1) continue;
      items.push({ y: by, draw: () => this.drawBuilding(b) });
    }
    for (const d of DECOR) {
      const [w, h] = DECOR_SIZE[d.type];
      const dd = this.districtAt(d.tx, d.ty);
      if (dd && !G.districtOpen(dd.id)) continue;
      items.push({ y: (d.ty + h) * TILE, draw: () => { ctx.drawImage(buildingSprite(d.type, w, h, 0, true), d.tx * TILE, (d.ty + h) * TILE - h * TILE - B_EXTRA); if (d.type === 'campfire') this.drawFire((d.tx + 1) * TILE, (d.ty + h) * TILE - 9, 1); } });
    }
    for (const a of this.agents.values()) {
      if (a.x < v.x0 - 20 || a.x > v.x1 + 20 || a.y < v.y0 - 10 || a.y > v.y1 + 30) continue;
      items.push({ y: a.y, draw: () => this.drawAgent(a) });
    }
    for (const [, r] of this.ratsVis) items.push({ y: r.y, draw: () => this.drawRat(r) });
    for (const u of this.invaders) items.push({ y: u.y, draw: () => { const sp = enemySprite(u.kind); ctx.drawImage(sp, Math.round(u.x - 12), Math.round(u.y - 22 + Math.abs(Math.sin(this.time * 6 + u.x)) * -2), 24, 24); } });
    if (this.golden) items.push({ y: this.golden.y, draw: () => this.drawGolden() });
    items.sort((a, b) => a.y - b.y);
    for (const it of items) it.draw();
    // placement ghost
    if (this.placing) {
      const p = this.placing, d = G.def(p.id), ok = this.placeValid();
      ctx.fillStyle = ok ? 'rgba(122,255,106,0.35)' : 'rgba(255,80,80,0.4)';
      ctx.fillRect(p.tx * TILE, p.ty * TILE, d.w * TILE, d.h * TILE);
      ctx.fillStyle = ok ? 'rgba(122,255,106,0.6)' : 'rgba(255,80,80,0.6)';
      ctx.fillRect((p.tx + Math.floor(d.w / 2)) * TILE + 4, (p.ty + d.h) * TILE + 4, 8, 8); // door
      const spr = buildingSprite(p.id, d.w, d.h, G.isBuilt(p.id) ? G.tier(p.id) : 0);
      ctx.globalAlpha = 0.55 + Math.sin(this.time * 6) * 0.15;
      ctx.drawImage(spr, p.tx * TILE, (p.ty + d.h) * TILE - spr.height);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = ok ? '#7aff6a' : '#ff5a5a'; ctx.lineWidth = 1; ctx.setLineDash([2, 2]);
      ctx.strokeRect(p.tx * TILE + 0.5, p.ty * TILE + 0.5, d.w * TILE - 1, d.h * TILE - 1); ctx.setLineDash([]);
    }
    // fires on top
    for (const f of G.rt.fires) {
      const b = this.G.pos(f.bid);
      for (let i = 0; i < Math.max(1, f.hp); i++) this.drawFire((b.tx + 0.6 + i * (b.w - 1.2) / 2) * TILE, (b.ty + b.h) * TILE - 12 - (i % 2) * 10, 1.4);
      if (Math.random() < 0.3) this.smoke((b.tx + Math.random() * b.w) * TILE, b.ty * TILE - 8, true);
    }
    // unexplored land is hidden under drifting fog
    this.renderFog(ctx);
    // argue cloud
    if (this.argueCloud) {
      const c = this.argueCloud;
      ctx.fillStyle = 'rgba(230,220,200,0.85)';
      for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.arc(c.x + Math.cos(this.time * 9 + i) * 8, c.y + Math.sin(this.time * 7 + i * 2) * 4, 5, 0, 7); ctx.fill(); }
      ctx.fillStyle = '#ffe060'; ctx.fillRect(c.x - 9 + Math.sin(this.time * 12) * 3, c.y - 10, 2, 2); ctx.fillRect(c.x + 7, c.y - 8 + Math.cos(this.time * 10) * 3, 2, 2);
    }
    // bubbles
    for (const b of G.rt.bubbles) {
      const [x, y] = this.bubblePos(b);
      const age = (G.now() - b.born) / 1000;
      const sc = Math.min(1, age * 4);
      ctx.save(); ctx.translate(x, y); ctx.scale(sc, sc);
      ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.arc(0, 0, 9, 0, 7); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 1; ctx.stroke();
      ctx.drawImage(iconCanvas('coin'), -5, -5);
      ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fillRect(-6, -6, 2, 2);
      ctx.restore();
    }
    // particles
    for (const p of this.particles) {
      const k = 1 - p.t / p.life;
      if (p.type === 'coin') { ctx.drawImage(iconCanvas('coin'), p.x - 3, p.y - 3, 7, 7); }
      else if (p.type === 'spark') { ctx.globalAlpha = k; ctx.fillStyle = p.color; ctx.fillRect(p.x, p.y, 2, 2); ctx.globalAlpha = 1; }
      else if (p.type === 'conf') { ctx.fillStyle = p.color; ctx.fillRect(p.x, p.y, Math.abs(Math.cos(p.rot)) * 3 + 1, 2); }
      else if (p.type === 'puff') { ctx.globalAlpha = k * 0.8; ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill(); ctx.globalAlpha = 1; }
    }
    // night
    this.renderNight(ctx, S, ox, oy);
    // screen-space overlays
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.renderLabels(ctx);
  }

  fogTexture() {
    if (this.fogTex) return this.fogTex;
    // tileable soft noise
    const N = 128, c = makeCanvas(N, N), x = c.getContext('2d'), img = x.createImageData(N, N);
    const h = (i, j) => { i = ((i % 16) + 16) % 16; j = ((j % 16) + 16) % 16; let v = (i * 374761393 + j * 668265263) ^ 1442695041; v = Math.imul(v ^ (v >>> 13), 1274126177); return ((v ^ (v >>> 16)) >>> 0) / 4294967296; };
    const noise = (u, v, f) => {
      const fx = u * f, fy = v * f, ix = Math.floor(fx), iy = Math.floor(fy), ax = fx - ix, ay = fy - iy;
      const sx = ax * ax * (3 - 2 * ax), sy = ay * ay * (3 - 2 * ay);
      const g = (i, j) => h(i % f, j % f);
      const a = g(ix, iy), b = g(ix + 1, iy), cc = g(ix, iy + 1), d = g(ix + 1, iy + 1);
      return a + (b - a) * sx + (cc - a) * sy + (a - b - cc + d) * sx * sy;
    };
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const u = i / N, v = j / N;
      const n = noise(u, v, 4) * 0.55 + noise(u, v, 8) * 0.3 + noise(u, v, 16) * 0.15;
      const k = (j * N + i) * 4;
      img.data[k] = 236; img.data[k + 1] = 240; img.data[k + 2] = 246;
      img.data[k + 3] = Math.max(0, Math.min(255, (n - 0.25) * 420));
    }
    x.putImageData(img, 0, 0);
    return (this.fogTex = c);
  }
  renderFog(ctx) {
    const G = this.G, locked = DISTRICTS.filter(d => !G.districtOpen(d.id));
    if (!locked.length) return;
    // fog is painted at half resolution on its own layer, then scaled up smoothly
    const R = 2, fc = this.fogLayer || (this.fogLayer = makeCanvas(WW / R, WH / R));
    const f = fc.getContext('2d');
    f.setTransform(1, 0, 0, 1, 0, 0);
    f.clearRect(0, 0, fc.width, fc.height);
    f.setTransform(1 / R, 0, 0, 1 / R, 0, 0);
    const FE = 22; // feather width (world px) where fog meets open land
    const openSide = (d, side) => {
      const probe = { l: [d.x - 1, d.y + d.h / 2], r: [d.x + d.w, d.y + d.h / 2], t: [d.x + d.w / 2, d.y - 1], b: [d.x + d.w / 2, d.y + d.h] }[side];
      const [x, y] = probe.map(Math.floor);
      if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) return false;
      return G.tileOpen(x, y);
    };
    const rects = locked.map(d => {
      const e = { l: openSide(d, 'l'), r: openSide(d, 'r'), t: openSide(d, 't'), b: openSide(d, 'b') };
      return { d, e, x: d.x * TILE - (e.l ? FE / 2 : 0), y: d.y * TILE - (e.t ? FE / 2 : 0), w: d.w * TILE + (e.l ? FE / 2 : 0) + (e.r ? FE / 2 : 0), h: d.h * TILE + (e.t ? FE / 2 : 0) + (e.b ? FE / 2 : 0) };
    });
    // misty base
    f.fillStyle = 'rgba(206,214,226,0.72)';
    for (const r of rects) f.fillRect(r.x, r.y, r.w, r.h);
    // billowing layers drifting at different speeds
    const tex = this.fogTexture();
    if (!this.fogPat) this.fogPat = f.createPattern(tex, 'repeat');
    const pat = this.fogPat;
    for (const [alpha, vx, vy, scale] of [[0.95, 5, 1.5, 2.6], [0.75, -8, 3, 1.7], [0.5, 2, -4, 4]]) {
      if (pat.setTransform) pat.setTransform(new DOMMatrix().translateSelf((this.time * vx) % (128 * scale), (this.time * vy) % (128 * scale)).scaleSelf(scale, scale));
      f.globalAlpha = alpha; f.fillStyle = pat;
      for (const r of rects) f.fillRect(r.x, r.y, r.w, r.h);
    }
    f.globalAlpha = 1;
    // feather the edges that face explored land
    f.globalCompositeOperation = 'destination-out';
    for (const r of rects) {
      const { e } = r;
      const grad = (x0, y0, x1, y1, gx, gy, gw, gh) => { const g = f.createLinearGradient(x0, y0, x1, y1); g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)'); f.fillStyle = g; f.fillRect(gx, gy, gw, gh); };
      if (e.l) grad(r.x, 0, r.x + FE, 0, r.x, r.y, FE, r.h);
      if (e.r) grad(r.x + r.w, 0, r.x + r.w - FE, 0, r.x + r.w - FE, r.y, FE, r.h);
      if (e.t) grad(0, r.y, 0, r.y + FE, r.x, r.y, r.w, FE);
      if (e.b) grad(0, r.y + r.h, 0, r.y + r.h - FE, r.x, r.y + r.h - FE, r.w, FE);
    }
    f.globalCompositeOperation = 'source-over';
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(fc, 0, 0, WW, WH);
    ctx.restore();
  }
  dayPhase() { return (this.time / this.dayLen + 0.15) % 1; }
  darkness() {
    const p = this.dayPhase();
    // 0..0.55 day, 0.55..0.65 dusk, 0.65..0.9 night, 0.9..1 dawn
    if (p < 0.55) return 0;
    if (p < 0.65) return (p - 0.55) / 0.1;
    if (p < 0.9) return 1;
    return 1 - (p - 0.9) / 0.1;
  }
  renderNight(ctx, S, ox, oy) {
    const dk = this.darkness();
    if (dk <= 0.01) return;
    const lc = this.lightCanvas || (this.lightCanvas = makeCanvas(1, 1));
    if (lc.width !== this.cv.width || lc.height !== this.cv.height) { lc.width = this.cv.width; lc.height = this.cv.height; }
    const l = lc.getContext('2d');
    l.setTransform(1, 0, 0, 1, 0, 0);
    l.globalCompositeOperation = 'source-over';
    l.clearRect(0, 0, lc.width, lc.height);
    l.fillStyle = `rgba(16,18,58,${0.5 * dk})`;
    l.fillRect(0, 0, lc.width, lc.height);
    l.setTransform(S, 0, 0, S, ox, oy);
    l.globalCompositeOperation = 'destination-out';
    const lights = [];
    for (const b of this.G.posAll()) if (this.G.isBuilt(b.id)) lights.push([(b.tx + b.w / 2) * TILE, (b.ty + b.h) * TILE - 12, 30]);
    for (const d of DECOR) if (d.type === 'campfire' || d.type === 'fountain') lights.push([(d.tx + 1) * TILE, (d.ty + 1.5) * TILE, 44]);
    if (this.golden) lights.push([this.golden.x, this.golden.y - 10, 30]);
    for (const [x, y, r] of lights) {
      const g = l.createRadialGradient(x, y, 2, x, y, r);
      g.addColorStop(0, 'rgba(0,0,0,0.95)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      l.fillStyle = g; l.beginPath(); l.arc(x, y, r, 0, 7); l.fill();
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(lc, 0, 0);
    // warm glow
    ctx.setTransform(S, 0, 0, S, ox, oy);
    ctx.globalCompositeOperation = 'lighter';
    for (const [x, y, r] of lights) {
      const g = ctx.createRadialGradient(x, y, 1, x, y, r * 0.6);
      g.addColorStop(0, `rgba(255,170,60,${0.22 * dk})`); g.addColorStop(1, 'rgba(255,170,60,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 0.6, 0, 7); ctx.fill();
    }
    // fireflies
    ctx.fillStyle = `rgba(220,255,120,${0.8 * dk})`;
    const v = this.viewRect();
    for (let i = 0; i < 20; i++) {
      const x = v.x0 + ((i * 73.3 + Math.sin(this.time * 0.7 + i) * 20) % (v.x1 - v.x0) + (v.x1 - v.x0)) % (v.x1 - v.x0);
      const y = v.y0 + ((i * 41.7 + Math.cos(this.time * 0.5 + i * 2) * 15) % (v.y1 - v.y0) + (v.y1 - v.y0)) % (v.y1 - v.y0);
      if (Math.sin(this.time * 3 + i * 1.7) > 0.2) ctx.fillRect(x, y, 1, 1);
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  drawFire(x, y, s = 1) {
    const ctx = this.ctx, t = this.time;
    const f = Math.floor(t * 10) % 3;
    const h = (6 + f) * s;
    ctx.fillStyle = '#ff5a20'; ctx.beginPath(); ctx.moveTo(x - 4 * s, y); ctx.quadraticCurveTo(x - 3 * s, y - h, x + (f - 1) * s, y - h - 3 * s); ctx.quadraticCurveTo(x + 3 * s, y - h, x + 4 * s, y); ctx.fill();
    ctx.fillStyle = '#ffd040'; ctx.beginPath(); ctx.moveTo(x - 2 * s, y); ctx.quadraticCurveTo(x - 1 * s, y - h * 0.6, x + (1 - f) * s * 0.5, y - h * 0.8); ctx.quadraticCurveTo(x + 2 * s, y - h * 0.5, x + 2 * s, y); ctx.fill();
  }

  drawBuilding(b) {
    const G = this.G, ctx = this.ctx;
    const st = G.s.buildings[b.id];
    const x = b.tx * TILE, yb = (b.ty + b.h) * TILE;
    let spr;
    if (st.lvl <= 0) {
      if (!G.canBuildHere(b.id)) { spr = plotSprite(b.w, b.h); ctx.globalAlpha = 0.6; ctx.drawImage(spr, x, yb - spr.height); ctx.globalAlpha = 1; return; }
      spr = plotSprite(b.w, b.h);
      ctx.drawImage(spr, x, yb - spr.height);
      // glowing "+" when affordable
      const cost = b.kind === 'biz' ? G.bizCost(b.id, 1) : G.utilCost(b.id);
      if (G.s.gold >= cost) {
        const p = 0.6 + Math.sin(this.time * 4) * 0.4;
        ctx.fillStyle = `rgba(122,255,106,${p})`;
        const cx = x + b.w * 8, cy = yb - b.h * 8 - 2;
        ctx.fillRect(cx - 5, cy - 1, 11, 3); ctx.fillRect(cx - 1, cy - 5, 3, 11);
      }
      return;
    }
    if (st.built > G.now()) {
      spr = scaffoldSprite(b.w, b.h);
      ctx.drawImage(spr, x, yb - spr.height);
      // builder goblins hammering
      const look = { skin: '#6cbf45', hat: 'hardhat', outfit: '#c08030', tool: 'hammer' };
      const sh = goblinSheet(look);
      const f = Math.floor(this.time * 6) % 2 ? 6 : 7;
      ctx.drawImage(sh.sheet, f * GOB_W, 0, GOB_W, GOB_H, x - 6, yb - GOB_H, GOB_W, GOB_H);
      ctx.drawImage(sh.flip, f * GOB_W, 0, GOB_W, GOB_H, x + b.w * TILE - GOB_W + 6, yb - GOB_H, GOB_W, GOB_H);
      // progress bar
      const p = 1 - (st.built - G.now()) / 3000;
      ctx.fillStyle = '#1c1424'; ctx.fillRect(x + 6, yb - b.h * TILE - 8, b.w * TILE - 12, 4);
      ctx.fillStyle = '#7aff6a'; ctx.fillRect(x + 7, yb - b.h * TILE - 7, (b.w * TILE - 14) * clamp(p, 0, 1), 2);
      return;
    }
    spr = buildingSprite(b.id, b.w, b.h, G.tier(b.id));
    const bo = this.bounce[b.id] || 0;
    const sy = 1 - Math.sin(bo * 20) * bo * 0.25, sx = 1 + Math.sin(bo * 20) * bo * 0.15;
    ctx.save();
    ctx.translate(x + spr.width / 2, yb);
    ctx.scale(sx, sy);
    if (G.s.damaged[b.id]) ctx.filter = 'brightness(0.6) sepia(0.4)';
    ctx.drawImage(spr, -spr.width / 2, -spr.height);
    ctx.filter = 'none';
    if (this.flash[b.id]) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = this.flash[b.id]; ctx.drawImage(spr, -spr.width / 2, -spr.height); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
    ctx.restore();
    // casino lights blink
    if (b.id === 'casino' && Math.floor(this.time * 3) % 2) { ctx.fillStyle = '#ffe060'; ctx.fillRect(x + b.w * 8 - 1, yb - spr.height + 7, 2, 2); }
  }

  drawAgent(a) {
    const g = this.G.gob(a.uid); if (!g) return;
    const ctx = this.ctx;
    const sh = goblinSheet(g.look);
    let f = 0;
    if (a.state === 'walk') f = 2 + Math.floor(a.anim * 8) % 4;
    else if (a.state === 'work') f = Math.floor(a.anim * 3.2) % 2 ? 6 : 7;
    else if (a.state === 'argue') f = Math.floor(a.anim * 6) % 2 ? 8 : 0;
    else f = (a.anim % 4) < 0.15 ? 1 : 0;
    const jy = a.jump > 0 ? -Math.sin(a.jump / 0.35 * Math.PI) * 6 : 0;
    const x = Math.round(a.x - GOB_W / 2), y = Math.round(a.y - GOB_H + 2 + jy);
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(Math.round(a.x - 5), Math.round(a.y), 10, 2);
    const ri = this.G.rarityIdx(g.rarity);
    if (ri >= 3) {
      ctx.globalAlpha = 0.35 + Math.sin(this.time * 4) * 0.15;
      ctx.fillStyle = ri === 4 ? '#ff7aa8' : '#ffcf4a';
      ctx.beginPath(); ctx.ellipse(a.x, a.y - 9, 9, 12, 0, 0, 7); ctx.fill();
      ctx.globalAlpha = 1;
      if (Math.random() < 0.05) this.particles.push({ type: 'spark', x: a.x + (Math.random() - 0.5) * 14, y: a.y - 10 - Math.random() * 10, vx: 0, vy: -8, t: 0, life: 0.8, color: ri === 4 ? '#ffb0d0' : '#fff0a0' });
    }
    const hurt = g.assign?.t === 'med';
    if (hurt && a.state === 'work') {
      // lying in a sick bed
      ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.round(a.x - 12), Math.round(a.y - 7), 24, 6);
      ctx.fillStyle = '#8a5a30'; ctx.fillRect(Math.round(a.x - 12), Math.round(a.y - 1), 2, 3); ctx.fillRect(Math.round(a.x + 10), Math.round(a.y - 1), 2, 3);
      ctx.save(); ctx.translate(Math.round(a.x), Math.round(a.y - 6)); ctx.rotate(-Math.PI / 2);
      ctx.drawImage(sh.sheet, GOB_W, 0, GOB_W, GOB_H, -GOB_H + 4, -GOB_W / 2, GOB_W, GOB_H);
      ctx.restore();
      ctx.fillStyle = '#e8f0ff'; ctx.fillRect(Math.round(a.x - 2), Math.round(a.y - 12), 14, 6);
      if (Math.floor(this.time * 1.5 + a.uid) % 3 === 0) { ctx.fillStyle = '#fff'; ctx.font = '6px sans-serif'; ctx.fillText('z', a.x + 8, a.y - 16 - (this.time * 4 % 4)); }
    } else ctx.drawImage(a.dir < 0 ? sh.flip : sh.sheet, f * GOB_W, 0, GOB_W, GOB_H, x, y, GOB_W, GOB_H);
    if (hurt) {
      // red cross badge + heal progress
      const bx = Math.round(a.x - 3), by = Math.round(a.y - (a.state === 'work' ? 22 : GOB_H + 4));
      ctx.fillStyle = '#1c1424'; ctx.fillRect(bx - 1, by - 1, 9, 9); ctx.fillStyle = '#fff'; ctx.fillRect(bx, by, 7, 7);
      ctx.fillStyle = '#e02a3a'; ctx.fillRect(bx + 3, by + 1, 1, 5); ctx.fillRect(bx + 1, by + 3, 5, 1);
      if (g.inj && g.inj.end) {
        const k = clamp((this.G.now() - g.inj.start) / (g.inj.end - g.inj.start), 0, 1);
        ctx.fillStyle = '#1c1424'; ctx.fillRect(bx - 5, by + 9, 17, 3); ctx.fillStyle = '#7aff6a'; ctx.fillRect(bx - 4, by + 10, 15 * k, 1);
      }
    }
    if (a.state === 'work' && f === 7 && Math.random() < 0.04) this.particles.push({ type: 'spark', x: a.x + a.dir * 9, y: a.y - 5, vx: a.dir * 20, vy: -20, t: 0, life: 0.3, color: '#fff' });
  }

  drawRat(r) {
    const ctx = this.ctx;
    const x = Math.round(r.x), y = Math.round(r.y), d = r.dir || 1;
    const leg = Math.floor(this.time * 14) % 2;
    ctx.fillStyle = '#1c1424'; ctx.fillRect(x - 5, y - 5, 10, 5);
    ctx.fillStyle = '#8a8a8a'; ctx.fillRect(x - 4, y - 4, 8, 3);
    ctx.fillStyle = '#aaaaaa'; ctx.fillRect(x - 3, y - 4, 5, 1);
    ctx.fillStyle = '#8a8a8a'; ctx.fillRect(x + d * 4, y - 4, 2, 2);
    ctx.fillStyle = '#ffb0b0'; ctx.fillRect(x + d * 6, y - 3, 1, 1); ctx.fillRect(x - d * 6 - (d < 0 ? 0 : 3), y - 2, 4, 1);
    ctx.fillStyle = '#1c1424'; ctx.fillRect(x + d * 4 + (d > 0 ? 1 : 0), y - 4, 1, 1);
    ctx.fillStyle = '#5a5a5a'; ctx.fillRect(x - 3 + leg, y - 1, 1, 1); ctx.fillRect(x + 2 - leg, y - 1, 1, 1);
  }

  drawGolden() {
    const ctx = this.ctx, g = this.golden;
    const look = { skin: '#ffd040', hat: 'crown', outfit: '#f0a020', tool: 'bag', extra: 'cape_red', ears: 2, nose: 1, eyes: 2, teeth: 1 };
    const sh = goblinSheet(look);
    const f = 2 + Math.floor(this.time * 12) % 4;
    const hop = Math.abs(Math.sin(g.hop * 9)) * -4;
    ctx.globalAlpha = 0.5 + Math.sin(this.time * 8) * 0.2;
    ctx.fillStyle = '#fff0a0'; ctx.beginPath(); ctx.ellipse(g.x, g.y - 10, 14, 16, 0, 0, 7); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.drawImage(g.vx < 0 ? sh.flip : sh.sheet, f * GOB_W, 0, GOB_W, GOB_H, Math.round(g.x - GOB_W / 2), Math.round(g.y - GOB_H + hop), GOB_W, GOB_H);
  }

  renderLabels(ctx) {
    const G = this.G, z = this.cam.zoom;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // building level badges
    if (z >= 1.6) {
      ctx.font = `600 ${Math.round(clamp(z * 4.2, 10, 14))}px ${FONT}`;
      for (const b of this.G.posAll()) {
        if (!this.shown(b)) continue;
        const st = G.s.buildings[b.id];
        const [sx, sy] = this.toScreen((b.tx + b.w / 2) * TILE, (b.ty + b.h) * TILE + 5);
        if (sx < -60 || sx > this.sw + 60 || sy < -20 || sy > this.sh + 40) continue;
        let txt, col = '#fff', bg = 'rgba(28,20,36,0.78)';
        if (st.lvl <= 0) {
          if (!G.canBuildHere(b.id)) { txt = `🔒 Lv ${b.unlock}`; col = '#bbb'; }
          else { const c = b.kind === 'biz' ? G.bizCost(b.id, 1) : G.utilCost(b.id); txt = `Build ${b.name.split(' ')[0]} · ${fmt(c)}`; col = G.s.gold >= c ? '#7aff6a' : '#ffcf4a'; }
        } else if (st.built > G.now()) txt = 'Building...';
        else {
          txt = b.kind === 'biz' ? `Lv ${st.lvl}` : (b.maxLvl === 1 ? b.name.split(' ')[0] : `Lv ${st.lvl}`);
          if (G.s.damaged[b.id]) { txt += ' 🔥'; col = '#ff8a6a'; }
          if (b.kind === 'biz') {
            const c = G.bizCost(b.id, 1);
            if (G.s.gold >= c) { col = '#7aff6a'; txt = '▲ ' + txt; }
          }
        }
        const w = ctx.measureText(txt).width + 10;
        ctx.fillStyle = bg;
        roundRect(ctx, sx - w / 2, sy - 8, w, 16, 5); ctx.fill();
        ctx.fillStyle = col; ctx.fillText(txt, sx, sy + 1);
      }
    }
    // locked district signs
    ctx.font = `700 13px ${FONT}`;
    for (const d of DISTRICTS) {
      if (G.districtOpen(d.id)) continue;
      const [sx, sy] = this.toScreen((d.x + d.w / 2) * TILE, (d.y + d.h / 2) * TILE);
      if (sx < -100 || sx > this.sw + 100 || sy < -40 || sy > this.sh + 40) continue;
      const canLvl = G.s.level >= d.unlock;
      const l1 = '🔒 ' + d.name, l2 = canLvl ? `Unlock: ${fmt(G.districtCost(d.id))} gold` : `Requires Capital Lv ${d.unlock}`;
      const w = Math.max(ctx.measureText(l1).width, ctx.measureText(l2).width) + 20;
      ctx.fillStyle = 'rgba(28,20,36,0.85)'; roundRect(ctx, sx - w / 2, sy - 20, w, 40, 8); ctx.fill();
      ctx.strokeStyle = canLvl && G.s.gold >= G.districtCost(d.id) ? '#7aff6a' : '#ffcf4a'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.fillText(l1, sx, sy - 7);
      ctx.fillStyle = canLvl ? '#ffe060' : '#bbb'; ctx.font = `600 11px ${FONT}`; ctx.fillText(l2, sx, sy + 9); ctx.font = `700 13px ${FONT}`;
    }
    // speech bubbles
    ctx.font = `600 12px ${FONT}`;
    for (const sb of this.bubbleTalk) {
      const a = sb.a;
      const [sx, sy] = this.toScreen(a.x, a.y - GOB_H - 2);
      if (sx < -80 || sx > this.sw + 80 || sy < -20 || sy > this.sh + 20) continue;
      const w = Math.min(180, ctx.measureText(sb.text).width + 14);
      const al = Math.min(1, sb.t * 3);
      ctx.globalAlpha = al;
      ctx.fillStyle = '#fffdf0'; roundRect(ctx, sx - w / 2, sy - 22, w, 20, 7); ctx.fill();
      ctx.strokeStyle = '#1c1424'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(sx - 4, sy - 3); ctx.lineTo(sx, sy + 3); ctx.lineTo(sx + 4, sy - 3); ctx.fill();
      ctx.fillStyle = '#1c1424'; ctx.fillText(fitText(ctx, sb.text, w - 10), sx, sy - 11);
      ctx.globalAlpha = 1;
    }
    // floating texts
    for (const f of this.floats) {
      const k = f.t / f.dur;
      const [sx, sy] = this.toScreen(f.x, f.y);
      const size = Math.round(15 * f.size);
      ctx.font = `700 ${size}px ${FONT}`;
      ctx.globalAlpha = k > 0.7 ? (1 - k) / 0.3 : 1;
      const yy = sy - k * 34;
      ctx.lineWidth = 4; ctx.strokeStyle = '#1c1424'; ctx.strokeText(f.text, sx, yy);
      ctx.fillStyle = f.color; ctx.fillText(f.text, sx, yy);
      ctx.globalAlpha = 1;
    }
    // tutorial pointer
    if (this.pointer) {
      const [sx, sy] = this.toScreen(this.pointer.x, this.pointer.y);
      const bob = Math.sin(this.time * 6) * 6;
      ctx.fillStyle = '#ffe060'; ctx.strokeStyle = '#1c1424'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(sx, sy - 6 + bob); ctx.lineTo(sx - 12, sy - 26 + bob); ctx.lineTo(sx - 4, sy - 26 + bob); ctx.lineTo(sx - 4, sy - 42 + bob); ctx.lineTo(sx + 4, sy - 42 + bob); ctx.lineTo(sx + 4, sy - 26 + bob); ctx.lineTo(sx + 12, sy - 26 + bob); ctx.closePath();
      ctx.stroke(); ctx.fill();
    }
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
function fitText(ctx, t, w) {
  if (ctx.measureText(t).width <= w) return t;
  while (t.length > 3 && ctx.measureText(t + '…').width > w) t = t.slice(0, -1);
  return t + '…';
}
