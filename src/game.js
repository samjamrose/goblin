// Core game state + logic. No DOM access here (so it can be tested in Node).
import {
  RARITIES, JOBS, JOB_COMBAT, TRAITS, BUILDINGS, BUILDING_BY_ID, BIZ, MILESTONES, DISTRICTS, DISTRICT_BY_ID,
  xpForLevel, RANKS, NAME_A, NAME_B, NAME_C, SKINS, RARE_SKINS, OUTFITS, HATS, JOB_TOOL, NAMED, NAMED_BY_ID,
  REGIONS, REGION_BY_ID, STAGES_PER_REGION, MISSIONS, TREASURES, TREASURE_SETS, RESEARCH, RESEARCH_BY_ID,
  PERKS, PERK_BY_ID, PRESTIGE_MIN_GOLD, teethFor, ITEM_WEAPONS, ITEM_TRINKETS, ITEM_ADJ, ITEM_OF, FUNNY_EVENTS,
  AMBIENT_EVENTS, DAILY_TEMPLATES, STORY, ACHIEVEMENTS, RIVAL_NAMES, LOGIN_REWARDS, ENEMIES,
  MAP_W, MAP_H, ROADS, DECOR, DECOR_SIZE, HEAL_MS, MEDIC_NAMES, RECOVER_MS,
} from './data.js';
import { rng, pick, ri, clamp, weighted, dayKey, weekKey, hashStr, fmt, shuffle } from './util.js';
import { enemyTeam, resolveInstant } from './battlesim.js';

const SAVE_KEY = 'goblin_capital_tycoon_v1';
const listeners = {};

export const G = {
  s: null,
  rt: { bubbles: [], golden: null, fires: [], rats: [], invasion: null, event: null, log: [], casinoMult: 1, casinoPhase: 0, frenzy: 0 },
  storage: null,
  now: () => Date.now(),

  on(evt, fn) { (listeners[evt] = listeners[evt] || []).push(fn); },
  emit(evt, ...args) { (listeners[evt] || []).forEach(fn => fn(...args)); },
  toast(text, kind = 'info') { this.emit('toast', text, kind); },

  // ------------------------------------------------------------- State
  newState() {
    const now = this.now();
    const s = {
      v: 1, name: 'Gobtropolis', created: now, lastSave: now, lastTick: now,
      gold: 10, mushrooms: 30, ore: 0, gems: 25, teeth: 0, teethEarned: 0, tickets: 0,
      runGold: 0, pastRunGold: 0, lifetimeGold: 0, weekGold: 0,
      xp: 0, level: 1,
      buildings: {}, districts: { muck: true }, research: {},
      goblins: [], nextUid: 1, items: [], treasures: {}, codex: {},
      regions: {}, expeditions: [], perks: {},
      stats: { taps: 0, bubbles: 0, golden: 0, recruits: 0, battlesWon: 0, battlesLost: 0, bosses: 0, expeditions: 0, expSent: 0,
        fires: 0, rats: 0, invasionsWon: 0, invasionsLost: 0, events: 0, upgrades: 0, prestiges: 0, trains: 0, pokes: 0,
        trades: 0, forges: 0, leagueWins: 0, playTime: 0, premiumPulls: 0 },
      achievements: {},
      daily: { day: null, quests: [], streak: 0, lastLogin: null, loginClaimed: true, loginDay: 0 },
      story: 0, storyDone: false,
      league: null, leaguePending: null,
      buffs: [], damaged: {},
      timers: { golden: now + 90e3, event: now + 150e3, invasion: now + 600e3, disaster: now + 300e3, bubble: now + 5e3, ambient: now + 20e3 },
      merchant: null, pity: { basic: 0, premium: 0 },
      settings: { sound: true, music: true, haptics: true },
      tut: {}, forgeCount: 0, invasionsSeen: 0, place: {}, firstMedic: false, medicsEarned: 0, mig2: true,
    };
    for (const b of BUILDINGS) s.buildings[b.id] = { lvl: b.startBuilt ? 1 : 0, built: 0 };
    this.s = s;
    // Starter goblins
    const a = this.makeGoblin(0, { job: 'farmer', name: 'Grubnose', trait: 'optimist', hat: 'none' });
    const b = this.makeGoblin(0, { job: 'miner', name: 'Snik', trait: 'greedy', hat: 'candlehelm' });
    s.goblins.push(a, b);
    return s;
  },

  init(storage) {
    this.storage = storage;
    let loaded = null;
    try {
      const raw = storage && storage.getItem(SAVE_KEY);
      if (raw) loaded = JSON.parse(raw);
    } catch (e) { console.warn('Save load failed', e); }
    if (loaded && loaded.v === 1) {
      this.s = this.migrate(loaded);
      return this.applyOffline();
    }
    this.newState();
    return null;
  },

  migrate(s) {
    const needsMig2 = !s.mig2;
    const fresh = this.newState();
    // deep-ish merge defaults for new fields
    for (const k in fresh) if (s[k] === undefined) s[k] = fresh[k];
    for (const k in fresh.stats) if (s.stats[k] === undefined) s.stats[k] = 0;
    for (const k in fresh.timers) if (s.timers[k] === undefined) s.timers[k] = fresh.timers[k];
    for (const b of BUILDINGS) if (!s.buildings[b.id]) s.buildings[b.id] = { lvl: b.startBuilt ? 1 : 0, built: 0 };
    for (const k in fresh.settings) if (s.settings[k] === undefined) s.settings[k] = fresh.settings[k];
    if (needsMig2) {
      // v2 update: a story quest (Build the Infirmary) was inserted at index 13
      const idx = STORY.findIndex(q => q.goal.build === 'infirmary');
      if (s.story >= idx) s.story++;
      s.mig2 = true;
    }
    if (!s.place) s.place = {};
    this.placeVer = (this.placeVer || 0) + 1;
    return s;
  },

  save() {
    this.s.lastSave = this.now();
    if (this.storage) try { this.storage.setItem(SAVE_KEY, JSON.stringify(this.s)); } catch (e) { console.warn('save failed', e); }
    this.emit('saved');
  },

  exportSave() {
    this.s.lastSave = this.now();
    const json = JSON.stringify(this.s);
    return btoa(unescape(encodeURIComponent(json)));
  },

  importSave(str) {
    try {
      const json = decodeURIComponent(escape(atob(str.trim())));
      const s = JSON.parse(json);
      if (!s || s.v !== 1 || !s.buildings) throw new Error('bad');
      this.s = this.migrate(s);
      this.save();
      try { this.storage && this.storage.setItem('gct_keep_local', '1'); } catch (e) { }
      return true;
    } catch (e) { return false; }
  },

  hardReset() {
    try { this.storage && this.storage.removeItem(SAVE_KEY); } catch (e) { }
    this.newState();
    this.save();
    try { this.storage && this.storage.setItem('gct_keep_local', '1'); } catch (e) { }
  },

  // ------------------------------------------------------------- Helpers
  b(id) { return this.s.buildings[id]; },
  def(id) { return BUILDING_BY_ID[id]; },
  isBuilt(id) { return this.s.buildings[id].lvl > 0; },
  isConstructing(id) { return this.s.buildings[id].built > this.now(); },
  gob(uid) { return this.s.goblins.find(g => g.uid === uid); },
  rarityIdx(r) { return RARITIES.findIndex(x => x.id === r); },
  bestRarity() { return this.s.goblins.reduce((m, g) => Math.max(m, this.rarityIdx(g.rarity)), -1); },
  maxBuildingLvl() { return BIZ.reduce((m, b) => Math.max(m, this.s.buildings[b.id].lvl), 0); },
  rankName(l = this.s.level) { let n = RANKS[0][1]; for (const [lv, name] of RANKS) if (l >= lv) n = name; return n; },
  milestonesReached(lvl) { return MILESTONES.filter(m => lvl >= m).length; },
  nextMilestone(lvl) { return MILESTONES.find(m => lvl < m) || null; },
  tier(id) {
    const l = this.s.buildings[id].lvl, d = this.def(id);
    if (d.kind === 'util') return d.maxLvl > 1 ? Math.max(0, Math.min(4, Math.floor((l - 1) * 5 / d.maxLvl))) : 0;
    return Math.min(4, this.milestonesReached(l));
  },
  milestoneMult(lvl) {
    let m = 1;
    const mult = { 25: 2, 50: 2, 100: 3, 200: 2, 300: 2, 400: 3, 500: 2, 600: 2, 800: 3, 1000: 4 };
    for (const ms of MILESTONES) if (lvl >= ms) m *= mult[ms];
    return m;
  },
  districtOpen(id) { return !!this.s.districts[id]; },
  canBuildHere(id) { return this.s.level >= this.def(id).unlock; },
  // ---- free placement: buildings can go anywhere on open land
  pos(id) {
    if (this._posVer !== this.placeVer || this._posFor !== this.s) {
      this._pos = {}; this._posVer = this.placeVer; this._posFor = this.s;
      for (const b of BUILDINGS) { const p = this.s.place && this.s.place[b.id]; this._pos[b.id] = p ? { ...b, tx: p.tx, ty: p.ty, placed: true } : b; }
      this._posAll = BUILDINGS.map(b => this._pos[b.id]);
    }
    return this._pos[id];
  },
  posAll() { this.pos('shroom'); return this._posAll; },
  districtAtTile(tx, ty) { return DISTRICTS.find(d => tx >= d.x && tx < d.x + d.w && ty >= d.y && ty < d.y + d.h) || null; },
  tileOpen(tx, ty) { const d = this.districtAtTile(tx, ty); return !d || !!this.s.districts[d.id]; },
  roadSet() {
    if (this._roads) return this._roads;
    const r = new Set();
    for (const [x1, y1, x2, y2] of ROADS) for (let y = y1; y <= y2; y++) for (let x = x1; x <= x2; x++) r.add(y * MAP_W + x);
    return (this._roads = r);
  },
  // is the footprint of building `id` at (tx,ty) free? `ignore` = building being moved
  canPlace(id, tx, ty) {
    const d = this.def(id), roads = this.roadSet();
    if (tx < 0 || ty < 3 || tx + d.w > MAP_W || ty + d.h + 1 > MAP_H) return false;
    const blocked = (x, y, door) => {
      if (!door && roads.has(y * MAP_W + x)) return true;
      if (y === 35 || y === 36) return true; // river
      if (!this.tileOpen(x, y)) return true;
      for (const b of this.posAll()) if (b.id !== id && (this.s.buildings[b.id].lvl > 0 || !b.placed && false) && x >= b.tx && x < b.tx + b.w && y >= b.ty && y < b.ty + b.h) return true;
      for (const dc of DECOR) { const [w, h] = DECOR_SIZE[dc.type]; if (x >= dc.tx && x < dc.tx + w && y >= dc.ty && y < dc.ty + h) return true; }
      return false;
    };
    for (let y = ty; y < ty + d.h; y++) for (let x = tx; x < tx + d.w; x++) if (blocked(x, y, false)) return false;
    // the door tile in front must stay reachable
    if (blocked(tx + Math.floor(d.w / 2), ty + d.h, true)) return false;
    return true;
  },
  // nearest free spot to the building's suggested area
  findSpot(id, nearX, nearY) {
    const d = this.def(id);
    const sx = nearX ?? d.tx, sy = nearY ?? d.ty;
    if (this.canPlace(id, sx, sy)) return { tx: sx, ty: sy };
    for (let r = 1; r < 40; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      if (this.canPlace(id, sx + dx, sy + dy)) return { tx: sx + dx, ty: sy + dy };
    }
    return null;
  },
  setPlace(id, tx, ty) { this.s.place[id] = { tx, ty }; this.placeVer = (this.placeVer || 0) + 1; this.emit('placed', id); },
  moveBuilding(id, tx, ty) {
    if (!this.isBuilt(id) || !this.canPlace(id, tx, ty)) return false;
    this.setPlace(id, tx, ty);
    return true;
  },

  researchSum(key) {
    let t = 0;
    for (const id in this.s.research) { const r = RESEARCH_BY_ID[id]; if (r && r.eff[key]) t += r.eff[key]; }
    return t;
  },
  // ability sum across owned named goblins (abilities work from anywhere)
  abilitySum(type, target) {
    let t = 0;
    for (const g of this.s.goblins) {
      if (!g.named) continue;
      const a = NAMED_BY_ID[g.named]?.ability;
      if (a && a.type === type && (!target || a.target === target)) t += a.v * (1 + 0.25 * (g.stars || 0));
    }
    return t;
  },
  setBonus(key) {
    let t = 0;
    for (const sid in TREASURE_SETS) if (this.setComplete(sid) && TREASURE_SETS[sid].bonus[key]) t += TREASURE_SETS[sid].bonus[key];
    return t;
  },
  setComplete(sid) { return Object.keys(TREASURES).filter(k => TREASURES[k].set === sid).every(k => (this.s.treasures[k] || 0) > 0); },
  completedSets() { return Object.keys(TREASURE_SETS).filter(s => this.setComplete(s)).length; },
  regionBonus(key) {
    let t = 0;
    for (const r of REGIONS) if ((this.s.regions[r.id]?.stage || 0) >= STAGES_PER_REGION && r.reward[key]) t += r.reward[key];
    return t;
  },
  perk(id) { return this.s.perks[id] || 0; },
  buffMult(kind) {
    let m = 1; const now = this.now();
    for (const b of this.s.buffs) if (b.until > now && b.kind === kind) m *= b.mult;
    return m;
  },

  // ------------------------------------------------------------- Economy
  globalMult() {
    const s = this.s;
    let m = 1 + 0.02 * s.teethEarned;
    m *= 1 + this.researchSum('gold');
    m *= 1 + this.abilitySum('gold');
    m *= 1 + this.setBonus('gold');
    m *= 1 + this.regionBonus('gold');
    m *= 1 + 0.01 * Object.keys(s.achievements).length;
    m *= 1 + 0.1 * (Object.keys(s.districts).length - 1); // each extra district: +10%
    m *= this.buffMult('gold');
    return m;
  },

  workerBonus(g, bdef) {
    const r = RARITIES[this.rarityIdx(g.rarity)];
    const tr = TRAITS[g.trait] || {};
    let v = r.prod * (1 + 0.15 * (g.lvl - 1)) * (1 + 0.25 * (g.stars || 0)) * (1 + (tr.prod || 0));
    if (g.job !== bdef.job) v *= 0.4;
    const it = g.gear && g.gear.t ? this.item(g.gear.t) : null;
    if (it) v *= 1 + (it.prod || 0);
    return Math.max(0, v);
  },

  workers(id) { return this.s.goblins.filter(g => g.assign && g.assign.t === 'b' && g.assign.id === id); },
  workerSlots(id) {
    const l = this.s.buildings[id].lvl;
    const d = this.def(id);
    if (id === 'infirmary') return l <= 0 ? 0 : l;
    if (d.kind === 'util') return 0;
    return l <= 0 ? 0 : 1 + (l >= 25 ? 1 : 0) + (l >= 50 ? 1 : 0) + (l >= 100 ? 1 : 0);
  },
  workerMult(id) {
    const d = this.def(id);
    let sum = 0;
    for (const g of this.workers(id)) sum += this.workerBonus(g, d);
    return 1 + sum * (1 + this.researchSum('worker'));
  },

  buildingBaseIncome(id) {
    const d = this.def(id), b = this.s.buildings[id];
    if (d.kind !== 'biz' || b.lvl <= 0) return 0;
    let v = d.income * b.lvl * this.milestoneMult(b.lvl);
    let rm = 1;
    for (const rid in this.s.research) { const r = RESEARCH_BY_ID[rid]; if (r && r.eff.b === id) rm *= r.eff.m; }
    v *= rm;
    v *= this.workerMult(id);
    v *= 1 + this.abilitySum('bmult', id);
    v *= this.buffMult('b:' + id);
    if (this.s.damaged[id]) v *= 0.5;
    return v;
  },
  buildingIncome(id, withVariance = true) {
    if (this.isConstructing(id)) return 0;
    let v = this.buildingBaseIncome(id) * this.globalMult();
    if (withVariance && this.def(id).variance) v *= this.rt.casinoMult;
    return v;
  },
  incomePerSec(withFrenzy = true) {
    let t = 0;
    for (const b of BIZ) t += this.buildingIncome(b.id, withFrenzy);
    if (withFrenzy && this.rt.frenzy > this.now()) t *= 7;
    return t;
  },
  mushroomRate() {
    const b = this.s.buildings.shroom;
    if (b.lvl <= 0 || this.isConstructing('shroom')) return 0;
    let v = 0.15 * b.lvl * (1 + 0.5 * this.milestonesReached(b.lvl));
    v *= Math.sqrt(this.workerMult('shroom'));
    v *= 1 + this.researchSum('mush') + this.abilitySum('mushrooms') + this.regionBonus('mushrooms') + 0.5 * this.perk('mushrooms');
    v *= this.buffMult('b:shroom') > 1 ? 2 : 1;
    if (this.s.buildings.hatchery.lvl > 0) v *= 1.5;
    return v;
  },
  oreRate() {
    let v = 0;
    for (const id of ['mine', 'smithy']) {
      const b = this.s.buildings[id], d = this.def(id);
      if (b.lvl <= 0 || this.isConstructing(id)) continue;
      v += d.res.ore * b.lvl * (1 + 0.5 * this.milestonesReached(b.lvl)) * Math.sqrt(this.workerMult(id));
    }
    v *= 1 + this.regionBonus('ore') + this.setBonus('ore');
    return v;
  },

  addGold(v, earned = true) {
    this.s.gold += v;
    if (earned && v > 0) { this.s.runGold += v; this.s.lifetimeGold += v; this.s.weekGold += v; }
  },
  spend(res, v) {
    if (this.s[res] < v - 1e-9) return false;
    this.s[res] -= v;
    return true;
  },
  grant(reward, mult = 1) {
    const out = [];
    if (!reward) return out;
    if (reward.gold) { this.addGold(reward.gold * mult); out.push(fmt(reward.gold * mult) + ' gold'); }
    if (reward.mushrooms) { this.s.mushrooms += reward.mushrooms * mult; out.push(fmt(reward.mushrooms * mult) + ' mushrooms'); }
    if (reward.ore) { this.s.ore += reward.ore * mult; out.push(fmt(reward.ore * mult) + ' ore'); }
    if (reward.gems) { this.s.gems += Math.round(reward.gems * mult); out.push(Math.round(reward.gems * mult) + ' gems'); }
    if (reward.ticket) { this.s.tickets += reward.ticket; out.push(reward.ticket + ' Golden Recruit Ticket'); }
    if (reward.xp) { this.addXp(reward.xp * mult); }
    return out;
  },

  discount() {
    return 1 - Math.min(0.5, this.abilitySum('discount'));
  },
  bizCost(id, n = 1, fromLvl) {
    const d = this.def(id);
    const l = fromLvl !== undefined ? fromLvl : this.s.buildings[id].lvl;
    const g = d.growth;
    return d.baseCost * Math.pow(g, l) * (Math.pow(g, n) - 1) / (g - 1) * this.discount();
  },
  maxAffordable(id) {
    const d = this.def(id); const l = this.s.buildings[id].lvl; const g = d.growth;
    const c0 = d.baseCost * Math.pow(g, l) * this.discount();
    if (this.s.gold < c0) return 0;
    return Math.max(1, Math.floor(Math.log(this.s.gold * (g - 1) / c0 + 1) / Math.log(g)));
  },
  utilCost(id) {
    const d = this.def(id); const l = this.s.buildings[id].lvl;
    if (l <= 0) return d.baseCost;
    return d.upCost * Math.pow(d.growth, l - 1);
  },

  buy(id, n = 1, place) {
    const d = this.def(id), b = this.s.buildings[id];
    if (!this.canBuildHere(id)) return false;
    if (b.lvl === 0 && place && !this.canPlace(id, place.tx, place.ty)) return false;
    if (d.kind === 'util') {
      if (d.maxLvl && b.lvl >= d.maxLvl) return false;
      const c = this.utilCost(id);
      if (!this.spend('gold', c)) return false;
      const first = b.lvl === 0;
      if (first && place) this.setPlace(id, place.tx, place.ty);
      b.lvl++;
      this.s.stats.upgrades++;
      this.addXp(3 + Math.pow(c, 0.42));
      if (first) { b.built = this.now() + 3000; this.emit('build', id); if (id === 'infirmary') this.giveFirstMedic(); } else this.emit('upgrade', id, 1);
      return true;
    }
    if (n === 'max') n = this.maxAffordable(id);
    if (n <= 0) return false;
    const c = this.bizCost(id, n);
    if (!this.spend('gold', c)) return false;
    const before = b.lvl;
    if (before === 0 && place) this.setPlace(id, place.tx, place.ty);
    b.lvl += n;
    this.s.stats.upgrades += n;
    const idx = BIZ.indexOf(d);
    this.addXp(n * Math.pow(c / n, 0.42));
    if (before === 0) { b.built = this.now() + 2500; this.emit('build', id); }
    else this.emit('upgrade', id, n);
    const msBefore = this.milestonesReached(before), msAfter = this.milestonesReached(b.lvl);
    if (msAfter > msBefore) {
      this.emit('milestone', id, b.lvl);
      this.addXp(this.xpFrac(0.05) * (msAfter - msBefore));
    }
    return true;
  },

  repair(id) {
    const c = this.repairCost(id);
    if (!this.spend('gold', c)) return false;
    delete this.s.damaged[id];
    this.emit('repaired', id);
    return true;
  },
  repairCost(id) { return Math.max(50, this.buildingBaseIncome(id) * 2 * this.globalMult() * 30); },

  // ------------------------------------------------------------- XP & levels
  xpFrac(f) { return xpForLevel(this.s.level) * f; },
  addXp(v) {
    const s = this.s;
    s.xp += v;
    let leveled = false;
    while (s.xp >= xpForLevel(s.level)) {
      s.xp -= xpForLevel(s.level);
      s.level++;
      leveled = true;
      const gems = 5 + Math.floor(s.level / 2);
      s.gems += gems;
      s.mushrooms += 5 * s.level;
      this.emit('levelup', s.level, gems);
    }
    return leveled;
  },

  // ------------------------------------------------------------- Districts
  districtCost(id) {
    const d = DISTRICT_BY_ID[id];
    return d.cost * (this.perk('districts') ? 0.25 : 1);
  },
  unlockDistrict(id) {
    const d = DISTRICT_BY_ID[id];
    if (this.s.districts[id] || this.s.level < d.unlock) return false;
    if (!this.spend('gold', this.districtCost(id))) return false;
    this.s.districts[id] = true;
    this.addXp(this.xpFrac(0.25));
    this.emit('district', id);
    return true;
  },

  // ------------------------------------------------------------- Goblins
  housing() {
    return 4 + 2 * this.s.buildings.huts.lvl + this.researchSum('housing');
  },
  luck() {
    return this.researchSum('luck') + 0.15 * this.perk('luck') + 0.08 * (this.s.buildings.cauldron.lvl - 1);
  },
  recruitCost() {
    return Math.floor(25 * Math.pow(1.3, Math.min(this.housed(), this.housing())));
  },
  premiumCost() { return 100; },

  makeGoblin(rIdx, opts = {}) {
    const s = this.s;
    const r = RARITIES[rIdx];
    if (rIdx >= 2 && !opts.job) {
      // named goblin
      const pool = NAMED.filter(n => this.rarityIdx(n.rarity) === rIdx && (!n.prestigeOnly || s.stats.prestiges > 0));
      const n = opts.named ? NAMED_BY_ID[opts.named] : pick(pool);
      return {
        uid: s.nextUid++, named: n.id, name: n.name, rarity: n.rarity, job: n.job, trait: n.trait,
        look: { ...n.look }, lvl: 1 + 3 * this.perk('veteran'), stars: 0, gear: { w: null, t: null }, assign: null, prev: null,
      };
    }
    const seed = Math.floor(Math.random() * 1e9);
    const R = rng(seed);
    const job = opts.job || pick(Object.keys(JOBS).filter(j => j !== 'medic'), R);
    const name = opts.name || (pick(NAME_A, R) + pick(NAME_B, R) + (R() < 0.35 ? ' ' + pick(NAME_C, R) : '')).trim();
    const trait = opts.trait || pick(Object.keys(TRAITS), R);
    let hat = opts.hat || pick(HATS, R);
    if (rIdx >= 1 && hat === 'none') hat = pick(HATS.slice(2), R);
    const look = {
      skin: rIdx >= 1 && R() < 0.6 ? pick(RARE_SKINS, R) : pick(SKINS, R),
      hat, outfit: pick(OUTFITS, R), tool: JOB_TOOL[job],
      ears: Math.floor(R() * 3), nose: Math.floor(R() * 3), eyes: Math.floor(R() * 3), teeth: Math.floor(R() * 3),
      extra: rIdx >= 1 && R() < 0.5 ? pick(['scarf', 'earrings', 'beard', 'eyepatch', 'belly', 'glasses'], R) : (R() < 0.15 ? pick(['beard', 'belly', 'earrings'], R) : null),
    };
    return {
      uid: s.nextUid++, named: null, name, rarity: r.id, job, trait, look,
      lvl: 1 + 3 * this.perk('veteran'), stars: 0, gear: { w: null, t: null }, assign: null, prev: null, seed,
    };
  },

  rollRarity(premium) {
    const L = this.luck();
    const s = this.s;
    let w = premium ? [0, 60, 30, 8.5, 1.5] : [70, 24, 5, 0.9, 0.1];
    w = w.map((x, i) => i === 0 ? x : x * (1 + L * (premium ? 0.5 : 1) * (i >= 3 ? 1.5 : 1)));
    let r = weighted(w.map((x, i) => [i, x]));
    const key = premium ? 'premium' : 'basic';
    s.pity[key] = (s.pity[key] || 0) + 1;
    const limit = premium ? 25 : 120;
    if (r >= 3) s.pity[key] = 0;
    else if (s.pity[key] >= limit) { r = 3; s.pity[key] = 0; }
    return r;
  },

  housed() { return this.s.goblins.filter(g => !g.named && g.job !== 'medic').length; },
  canRecruit() { return this.housed() < this.housing(); },

  recruit(mode = 'basic') {
    const s = this.s;
    if (mode === 'basic') { if (!this.spend('mushrooms', this.recruitCost())) return null; }
    else if (mode === 'ticket') { if (s.tickets <= 0) return null; s.tickets--; }
    else if (mode === 'premium') { if (!this.spend('gems', this.premiumCost())) return null; s.stats.premiumPulls++; }
    else if (mode === 'epicplus') { /* merchant: guaranteed epic+ */ }
    let rIdx = mode === 'epicplus' ? weighted([[2, 75], [3, 21], [4, 4]]) : this.rollRarity(mode !== 'basic');
    if (mode === 'ticket' && rIdx < 3) rIdx = 3;
    return this.addRecruit(rIdx, mode);
  },

  addRecruit(rIdx, src, named) {
    const s = this.s;
    s.stats.recruits++;
    this.addXp(this.xpFrac(0.01 + rIdx * 0.01));
    const g = this.makeGoblin(rIdx, named ? { named } : {});
    if (g.named) {
      const existing = s.goblins.find(x => x.named === g.named);
      const isNew = !s.codex[g.named];
      s.codex[g.named] = true;
      if (existing) {
        s.nextUid--;
        if ((existing.stars || 0) < 5) {
          existing.stars = (existing.stars || 0) + 1;
          this.emit('recruit', existing, { dup: true, star: existing.stars, src });
          return existing;
        }
        const gems = 30 * rIdx;
        s.gems += gems;
        this.emit('recruit', existing, { dup: true, maxed: true, gems, src });
        return existing;
      }
      s.goblins.push(g);
      this.emit('recruit', g, { isNew, src });
      return g;
    }
    if (!this.canRecruit()) {
      // No bed for a common/rare: they leave, but tip you
      s.nextUid--;
      let tip, tipRes = 'mushrooms';
      if (src === 'premium') { tip = Math.floor(this.premiumCost() * 0.5); tipRes = 'gems'; s.gems += tip; }
      else { tip = Math.floor(this.recruitCost() * 0.5); s.mushrooms += tip; }
      this.emit('recruit', g, { left: true, tip, tipRes, src });
      return null;
    }
    s.goblins.push(g);
    this.emit('recruit', g, { isNew: true, src });
    return g;
  },

  goblinPower(g, ctx = {}) {
    const r = RARITIES[this.rarityIdx(g.rarity)];
    const tr = TRAITS[g.trait] || {};
    let p = r.power * Math.pow(1.1, g.lvl - 1) * (1 + 0.25 * (g.stars || 0));
    p *= 1 + ((tr.atk || 0) + (tr.hp || 0)) / 2;
    const w = g.gear && g.gear.w ? this.item(g.gear.w) : null;
    if (w) p *= 1 + ((w.atk || 0) + (w.hp || 0)) / 2;
    p *= this.combatMult();
    return p;
  },
  combatMult() {
    return (1 + this.abilitySum('combat')) * (1 + this.setBonus('combat')) * (1 + (this.researchSum('atk') + this.researchSum('hp')) / 2);
  },
  goblinCombat(g, defense = false) {
    const r = RARITIES[this.rarityIdx(g.rarity)];
    const tr = TRAITS[g.trait] || {};
    const jc = JOB_COMBAT[g.job] || JOB_COMBAT.default;
    const base = r.power * Math.pow(1.1, g.lvl - 1) * (1 + 0.25 * (g.stars || 0));
    const w = g.gear && g.gear.w ? this.item(g.gear.w) : null;
    const cm = (1 + this.abilitySum('combat')) * (1 + this.setBonus('combat'));
    let hp = base * 6 * jc.hp * (1 + (tr.hp || 0)) * (1 + this.researchSum('hp')) * (1 + (w ? w.hp || 0 : 0)) * cm;
    let atk = base * jc.atk * (1 + (tr.atk || 0)) * (1 + this.researchSum('atk')) * (1 + (w ? w.atk || 0 : 0)) * cm;
    if (defense) {
      const dm = this.defenseMult();
      hp *= dm.hp; atk *= dm.atk;
    }
    return { name: g.name, kind: 'goblin', look: g.look, gob: g.uid, rarity: g.rarity, hp, hpNow: hp * this.hpFrac(g), atk, spd: jc.spd, crit: jc.crit || 0.08, splash: jc.splash || 0 };
  },
  trainCost(g) {
    const ri = this.rarityIdx(g.rarity);
    return Math.floor(12 * (1 + ri) * Math.pow(1.17, g.lvl - 1) * (1 - this.researchSum('train')));
  },
  maxLvl(g) { return RARITIES[this.rarityIdx(g.rarity)].maxLvl + 5 * (g.stars || 0); },
  train(uid, times = 1) {
    const g = this.gob(uid);
    let n = 0;
    while (n < times && g.lvl < this.maxLvl(g) && this.spend('mushrooms', this.trainCost(g))) { g.lvl++; n++; this.s.stats.trains++; }
    if (n) { this.addXp(this.xpFrac(0.002) * n); this.emit('train', g, n); }
    return n;
  },
  dismiss(uid) {
    const g = this.gob(uid);
    if (!g || g.assign && (g.assign.t === 'exp' || g.assign.t === 'med')) return false;
    this.unequipAll(g);
    const refund = Math.floor(this.recruitCost() * 0.25 + this.trainCost(g) * 0.5);
    this.s.mushrooms += refund;
    this.s.goblins = this.s.goblins.filter(x => x !== g);
    this.emit('dismiss', g, refund);
    return refund;
  },

  assign(uid, target) {
    // target: {t:'b', id} | {t:'def'} | null
    const g = this.gob(uid);
    if (!g) return false;
    if (g.assign && (g.assign.t === 'exp' || g.assign.t === 'med')) return false;
    if (target && target.t === 'def' && g.job === 'medic') return false;
    if (target && target.t === 'b') {
      if (this.workers(target.id).length >= this.workerSlots(target.id)) return false;
    }
    if (target && target.t === 'def') {
      if (this.defenders().length >= this.defenderSlots()) return false;
    }
    g.assign = target;
    this.emit('assign', g);
    return true;
  },
  autoAssign(id) {
    const d = this.def(id);
    const free = this.s.goblins.filter(g => !g.assign && (id === 'infirmary' ? g.job === 'medic' : g.job !== 'medic'));
    free.sort((a, b) => this.workerBonus(b, d) - this.workerBonus(a, d));
    let n = 0;
    while (this.workers(id).length < this.workerSlots(id) && free.length) { this.assign(free.shift().uid, { t: 'b', id }); n++; }
    return n;
  },
  defenders() { return this.s.goblins.filter(g => g.assign && g.assign.t === 'def'); },
  defenderSlots() { return Math.min(4, this.s.buildings.barracks.lvl); },
  defenseMult() {
    const bl = this.s.buildings.barracks.lvl, tl = this.s.buildings.tower.lvl;
    const r = this.researchSum('defense');
    return { atk: (1 + 0.15 * bl) * (1 + r), hp: (1 + 0.15 * bl) * (1 + 0.1 * tl) * (1 + r) };
  },

  // ------------------------------------------------------------- Items
  item(uid) { return this.s.items.find(i => i.uid === uid); },
  makeItem(rIdx, slot) {
    slot = slot || (Math.random() < 0.5 ? 'w' : 't');
    const r = RARITIES[rIdx];
    const base = [0.1, 0.2, 0.35, 0.6, 1.0][rIdx];
    const noun = slot === 'w' ? pick(ITEM_WEAPONS) : pick(ITEM_TRINKETS);
    const name = pick(ITEM_ADJ) + ' ' + noun + (rIdx >= 2 ? ' ' + pick(ITEM_OF) : '');
    const it = { uid: this.s.nextUid++, slot, rarity: r.id, name, noun };
    const j = 0.85 + Math.random() * 0.3;
    if (slot === 'w') { it.atk = +(base * j).toFixed(2); it.hp = +(base * 0.5 * (0.85 + Math.random() * 0.3)).toFixed(2); }
    else { it.prod = +(base * 0.6 * j).toFixed(2); it.luck = +(base * 0.3).toFixed(2); }
    return it;
  },
  addItem(it) { this.s.items.push(it); this.emit('item', it); return it; },
  equip(uid, itemUid) {
    const g = this.gob(uid), it = this.item(itemUid);
    if (!g || !it) return false;
    if (it.owner) { const o = this.gob(it.owner); if (o) o.gear[it.slot] = null; }
    if (g.gear[it.slot]) { const old = this.item(g.gear[it.slot]); if (old) old.owner = null; }
    g.gear[it.slot] = it.uid; it.owner = g.uid;
    return true;
  },
  unequip(uid, slot) {
    const g = this.gob(uid); if (!g || !g.gear[slot]) return;
    const it = this.item(g.gear[slot]); if (it) it.owner = null;
    g.gear[slot] = null;
  },
  unequipAll(g) { this.unequip(g.uid, 'w'); this.unequip(g.uid, 't'); },
  sellItem(itemUid) {
    const it = this.item(itemUid); if (!it) return 0;
    if (it.owner) { const g = this.gob(it.owner); if (g) g.gear[it.slot] = null; }
    const v = [10, 30, 80, 200, 600][this.rarityIdx(it.rarity)];
    this.s.ore += v;
    this.s.items = this.s.items.filter(i => i !== it);
    return v;
  },
  forgeCost() { return Math.floor(40 * Math.pow(1.12, Math.min(this.s.forgeCount, 40))); },
  forge() {
    if (!this.isBuilt('smithy')) return null;
    if (!this.spend('ore', this.forgeCost())) return null;
    this.s.forgeCount++; this.s.stats.forges++;
    const lvlBoost = Math.min(1.5, this.s.buildings.smithy.lvl / 100);
    const r = weighted([[0, 50], [1, 32 + 10 * lvlBoost], [2, 13 + 8 * lvlBoost], [3, 4 + 3 * lvlBoost], [4, 0.6 + lvlBoost]]);
    return this.addItem(this.makeItem(r));
  },

  // ------------------------------------------------------------- Research
  researchCost(r) {
    const m = (1 - Math.min(0.6, this.regionBonus('research') + this.abilitySum('research'))) * Math.pow(0.75, this.perk('wisdom'));
    return { gold: r.cost * m, ore: Math.ceil(r.ore * m) };
  },
  doResearch(id) {
    const r = RESEARCH_BY_ID[id];
    if (!r || this.s.research[id] || !this.isBuilt('research') || this.s.level < r.lvl) return false;
    const c = this.researchCost(r);
    if (this.s.gold < c.gold || this.s.ore < c.ore) return false;
    this.s.gold -= c.gold; this.s.ore -= c.ore;
    this.s.research[id] = true;
    this.addXp(this.xpFrac(0.1));
    this.emit('research', r);
    return true;
  },

  // ------------------------------------------------------------- Regions / battles
  regionOpen(r) { return this.s.level >= r.unlock; },
  regionStage(id) { return this.s.regions[id]?.stage || 0; },
  battleSetup(regionId, stage) {
    const r = REGION_BY_ID[regionId];
    return enemyTeam(r, stage);
  },
  canFight(g) { return g && g.job !== 'medic' && !(g.assign && (g.assign.t === 'exp' || g.assign.t === 'med')); },
  battleTeam() {
    // up to 4 strongest non-expedition goblins (party chosen by player overrides)
    const s = this.s;
    let party = (s.party || []).map(u => this.gob(u)).filter(g => g && this.canFight(g));
    if (!party.length) {
      party = s.goblins.filter(g => this.canFight(g)).sort((a, b) => this.goblinPower(b) - this.goblinPower(a)).slice(0, 4);
    }
    return party.slice(0, 4);
  },
  battleReward(regionId, stage, first) {
    const ri = REGIONS.findIndex(r => r.id === regionId);
    const inc = this.incomePerSec(false);
    const boss = stage >= STAGES_PER_REGION;
    const gold = Math.max(40 * Math.pow(4, ri) * stage, inc * (25 + 4 * stage)) * (first ? 1 : 0.4) * (boss ? 3 : 1);
    const rw = {
      gold, ore: Math.floor((5 + 2 * stage) * Math.pow(2.2, ri) * (first ? 1 : 0.5)),
      mushrooms: Math.floor((10 + 4 * stage) * Math.pow(2, ri) * (first ? 1 : 0.5)), xp: this.xpFrac(first ? 0.06 : 0.02),
    };
    if (first && boss) rw.gems = 30 * (ri + 1);
    else if (first && stage % 3 === 0) rw.gems = 5 + ri * 2;
    return rw;
  },
  finishBattle(regionId, stage, won, pokes = 0, injured = []) {
    const s = this.s;
    s.stats.pokes += pokes;
    const hurt = this.injure(injured);
    if (!won) { s.stats.battlesLost++; return { lost: true, injured: hurt }; }
    s.stats.battlesWon++;
    const reg = s.regions[regionId] = s.regions[regionId] || { stage: 0 };
    const first = stage > reg.stage;
    const rw = this.battleReward(regionId, stage, first);
    const got = this.grant(rw);
    const res = { reward: rw, got, first, injured: hurt };
    if (first) reg.stage = stage;
    const boss = stage >= STAGES_PER_REGION;
    if (boss && first) {
      s.stats.bosses++;
      const R = REGION_BY_ID[regionId];
      res.conquered = R.reward.text;
      this.emit('conquer', R);
      res.medic = this.addMedic('boss');
    }
    const ri = REGIONS.findIndex(r => r.id === regionId);
    if (Math.random() < (boss ? 1 : 0.15)) {
      const r = weighted([[0, 40], [1, 35 + ri * 3], [2, 18 + ri * 3], [3, 5 + ri * 1.5 + (boss ? 10 : 0)], [4, 0.5 + ri * 0.5 + (boss ? 3 : 0)]]);
      res.item = this.addItem(this.makeItem(r));
    }
    if (boss && first && Math.random() < 0.6) {
      const k = pick(REGION_BY_ID[regionId].treasures);
      s.treasures[k] = (s.treasures[k] || 0) + 1;
      res.treasure = k;
    }
    return res;
  },

  // ------------------------------------------------------------- Injuries & medics
  // ---- battle wounds: health carries into the next fight and recovers slowly in town
  hpFrac(g) {
    if (!g || g.hpf === undefined || g.hpf >= 1) return 1;
    return Math.min(1, g.hpf + (this.now() - (g.hpAt || 0)) / RECOVER_MS);
  },
  recordWounds(b) {
    for (const u of b.units) {
      if (u.side !== 'g' || !u.gob || !u.alive) continue;
      const g = this.gob(u.gob); if (!g) continue;
      g.hpf = Math.max(0.01, Math.min(1, u.hp / u.maxHp)); g.hpAt = this.now();
    }
  },
  // goblins (uids) who fell in battle; returns the list actually injured
  casualties(b) { return b.units.filter(u => u.side === 'g' && !u.alive && u.gob).map(u => u.gob); },
  injure(uids) {
    const out = [];
    for (const u of uids) {
      const g = this.gob(u);
      if (!g || (g.assign && (g.assign.t === 'med' || g.assign.t === 'exp'))) continue;
      g.prev = g.assign && (g.assign.t === 'b' || g.assign.t === 'def') ? g.assign : null;
      g.assign = { t: 'med' };
      g.inj = { at: this.now() + out.length, start: 0, end: 0 };
      out.push(g);
    }
    if (out.length) { this.s.party = (this.s.party || []).filter(u => !out.find(g => g.uid === u)); this.processHealing(this.now()); this.emit('injured', out); }
    return out;
  },
  injured() { return this.s.goblins.filter(g => g.assign && g.assign.t === 'med'); },
  medics() { return this.workers('infirmary').filter(g => g.job === 'medic'); },
  healSlots() { return this.isBuilt('infirmary') && !this.isConstructing('infirmary') ? this.medics().length : 0; },
  healGoblin(g) {
    g.inj = null; g.hpf = 1; g.hpAt = this.now();
    const p = g.prev; g.prev = null; g.assign = null;
    if (p && this.validAssign(p)) g.assign = p;
    this.emit('healed', g);
  },
  processHealing(now) {
    const cap = this.healSlots();
    for (let guard = 0; guard < 1000; guard++) {
      const list = this.injured();
      const active = list.filter(g => g.inj && g.inj.end);
      const done = active.filter(g => g.inj.end <= now).sort((a, b) => a.inj.end - b.inj.end);
      if (done.length) { const t = done[0].inj.end; this.healGoblin(done[0]); this.startHeal(t, cap); continue; }
      if (active.length < cap && this.startHeal(now, cap)) continue;
      break;
    }
  },
  startHeal(t, cap) {
    const list = this.injured();
    if (list.filter(g => g.inj && g.inj.end).length >= cap) return false;
    const q = list.filter(g => g.inj && !g.inj.end).sort((a, b) => a.inj.at - b.inj.at);
    if (!q.length) return false;
    const g = q[0];
    g.inj.start = Math.max(t, g.inj.at); g.inj.end = g.inj.start + HEAL_MS;
    return true;
  },
  healRushCost(g) { return g.inj && g.inj.end ? Math.max(1, Math.ceil((g.inj.end - this.now()) / 60000) * 2) : 6; },
  rushHeal(uid) {
    const g = this.gob(uid); if (!g || !g.inj) return false;
    if (!this.spend('gems', this.healRushCost(g))) return false;
    this.healGoblin(g); this.processHealing(this.now());
    return true;
  },
  addMedic(src) {
    const s = this.s;
    // the infirmary has at most 6 beds; extra medic rewards become gems
    if (s.goblins.filter(g => g.job === 'medic').length >= 6) { s.gems += 25; this.emit('medicGems', 25); return null; }
    const used = new Set(s.goblins.map(g => g.name));
    const name = MEDIC_NAMES.find(n => !used.has(n)) || ('Medic ' + pick(NAME_A));
    const r = src === 'boss' ? 1 : 0;
    const g = this.makeGoblin(r, { job: 'medic', name, hat: 'nurse', trait: pick(['optimist', 'genius', 'paranoid', 'loud']) });
    g.look.tool = 'medkit';
    g.named = null; g.medic = true;
    s.goblins.push(g);
    s.medicsEarned++;
    if (this.isBuilt('infirmary')) this.assign(g.uid, { t: 'b', id: 'infirmary' });
    this.processHealing(this.now());
    this.emit('medic', g, src);
    return g;
  },
  giveFirstMedic() { if (this.s.firstMedic) return; this.s.firstMedic = true; this.addMedic('infirmary'); },

  // ------------------------------------------------------------- Expeditions
  expSlots() { return this.s.buildings.lodge.lvl + this.perk('party'); },
  activeExpeditions() { return this.s.expeditions.filter(e => !e.claimed); },
  expDifficulty(regionId, missionId) {
    const R = REGION_BY_ID[regionId], M = MISSIONS.find(m => m.id === missionId);
    return R.power * 2.4 * M.diff;
  },
  partyPower(uids) { return uids.reduce((t, u) => { const g = this.gob(u); return t + (g ? this.goblinPower(g) : 0); }, 0); },
  expChance(regionId, missionId, uids) {
    const P = this.partyPower(uids), D = this.expDifficulty(regionId, missionId);
    return clamp(0.75 * Math.pow(P / D, 1.5), 0.05, 0.97);
  },
  expDuration(missionId, uids) {
    const M = MISSIONS.find(m => m.id === missionId);
    let sp = this.researchSum('expspeed') + this.abilitySum('expspeed');
    for (const u of uids) { const g = this.gob(u); if (g && TRAITS[g.trait]?.speed) sp += TRAITS[g.trait].speed / uids.length; if (g && g.job === 'scout') sp += 0.1 / uids.length; }
    return Math.max(10, M.dur * Math.max(0.3, 1 - sp));
  },
  lootMult(uids) {
    let m = 1 + 0.1 * (this.s.buildings.lodge.lvl - 1) + this.abilitySum('loot') + this.setBonus('loot');
    for (const u of uids) {
      const g = this.gob(u); if (!g) continue;
      m += (TRAITS[g.trait]?.luck || 0) / 2;
      const t = g.gear.t ? this.item(g.gear.t) : null; if (t) m += (t.luck || 0) / 2;
    }
    return m;
  },
  startExpedition(regionId, missionId, uids) {
    const s = this.s;
    if (this.activeExpeditions().length >= this.expSlots()) return false;
    if (!uids.length || uids.length > 3) return false;
    for (const u of uids) { const g = this.gob(u); if (!this.canFight(g)) return false; }
    const now = this.now();
    const e = {
      id: s.nextUid++, region: regionId, mission: missionId, party: uids.slice(),
      start: now, end: now + this.expDuration(missionId, uids) * 1000,
      chance: this.expChance(regionId, missionId, uids), loot: this.lootMult(uids),
    };
    for (const u of uids) { const g = this.gob(u); g.prev = g.assign && g.assign.t !== 'exp' ? g.assign : null; g.assign = { t: 'exp', id: e.id }; }
    s.expeditions.push(e);
    s.stats.expSent++;
    this.emit('expStart', e);
    return e;
  },
  claimExpedition(eid) {
    const s = this.s;
    const e = s.expeditions.find(x => x.id === eid);
    if (!e || e.claimed || this.now() < e.end) return null;
    e.claimed = true;
    const R = REGION_BY_ID[e.region], M = MISSIONS.find(m => m.id === e.mission);
    const ri = REGIONS.indexOf(R);
    const ok = Math.random() < e.chance;
    const L = e.loot * (ok ? 1 : 0.25);
    const inc = this.incomePerSec(false);
    const rw = {
      gold: Math.max(120 * Math.pow(4, ri), inc * M.dur * 0.35) * Math.pow(M.loot, 0.35) * L,
      ore: Math.floor(8 * M.loot * Math.pow(2, ri) * L),
      mushrooms: Math.floor(15 * M.loot * Math.pow(1.8, ri) * L),
      xp: this.xpFrac(0.015 * Math.sqrt(M.loot)),
    };
    if (ok && Math.random() < 0.25 * Math.sqrt(M.loot)) rw.gems = Math.round((3 + 2 * M.loot) * (1 + ri * 0.2));
    const res = { ok, reward: rw, got: this.grant(rw), region: R, mission: M };
    if (ok && Math.random() < Math.min(0.9, 0.2 * Math.sqrt(M.loot) * e.loot)) {
      const r = weighted([[0, 45], [1, 32 + ri * 3], [2, 15 + ri * 3 + M.loot], [3, 3 + ri + M.loot * 0.5], [4, 0.3 + ri * 0.3 + M.loot * 0.15]]);
      res.item = this.addItem(this.makeItem(r));
    }
    if (ok && Math.random() < Math.min(0.75, 0.035 * M.loot * e.loot)) {
      const k = pick(R.treasures);
      s.treasures[k] = (s.treasures[k] || 0) + 1;
      res.treasure = k;
      this.emit('treasure', k);
    }
    if (ok && Math.random() < Math.min(0.5, 0.03 * M.loot)) {
      const r = weighted([[0, 50], [1, 35], [2, 11 + M.loot / 2], [3, 3 + M.loot / 4], [4, 0.4 + M.loot / 20]]);
      res.goblin = this.addRecruit(r, 'expedition');
    }
    if (ok && M.loot >= 9 && Math.random() < (M.loot >= 20 ? 0.25 : 0.12)) res.medic = this.addMedic('expedition');
    res.log = this.expLog(e, ok);
    // return goblins
    for (const u of e.party) { const g = this.gob(u); if (g) { g.assign = g.prev && this.validAssign(g.prev) ? g.prev : null; g.prev = null; } }
    s.stats.expeditions++;
    s.expeditions = s.expeditions.filter(x => !x.claimed);
    this.emit('expClaim', res);
    return res;
  },
  validAssign(a) {
    if (a.t === 'b') return this.isBuilt(a.id) && this.workers(a.id).length < this.workerSlots(a.id);
    if (a.t === 'def') return this.defenders().length < this.defenderSlots();
    return false;
  },
  expLog(e, ok) {
    const names = e.party.map(u => this.gob(u)?.name.split(' ')[0] || 'Someone');
    const a = names[0], b = names[1] || names[0];
    const R = REGION_BY_ID[e.region];
    const lines = [
      `${a} insisted they knew the way to ${R.name}. They did not.`,
      `${b} got distracted by a shiny rock for 40 minutes.`,
      `${a} made friends with a ${ENEMIES[R.enemies[0]].name.toLowerCase()}. Briefly.`,
      `The party argued about lunch. ${b} ate everyone's lunch.`,
      `${a} fell into a hole. The hole had snacks.`,
      `${b} tried to bribe a ${ENEMIES[R.enemies[1]].name.toLowerCase()} with a sock.`,
      `${a} drew a map. It is mostly doodles of ${a}.`,
      `${b} found a "secret passage". It was a closet.`,
    ];
    const good = [`Victory! The party returns with pockets bulging.`, `Success! ${a} is already bragging about it.`, `They came back rich and smelling worse than ever.`];
    const bad = [`Failure. The party ran home screaming. They kept some loot, though.`, `${a} lost a shoe and most of the treasure.`, `Retreat! ${b} blames ${a}. ${a} blames the weather.`];
    shuffle(lines);
    return [lines[0], lines[1], ok ? pick(good) : pick(bad)];
  },

  // ------------------------------------------------------------- Defense
  invasionPower() { return 16 * Math.pow(1.2, clamp(this.s.level, 7, 45) - 7); },
  invasionEnemies() {
    const lvl = this.s.level;
    const kinds = lvl < 14 ? ['knight', 'peasant', 'archer'] : lvl < 22 ? ['rivalgob', 'knight', 'troll'] : lvl < 30 ? ['troll', 'yeti', 'knight'] : ['drake', 'kobold', 'troll'];
    const names = lvl < 14 ? 'Sir Reginald\'s Squires' : lvl < 22 ? 'Snaggletooth Raiders' : lvl < 30 ? 'The Troll Toll Collectors' : 'Dragon Cultists';
    const P = this.invasionPower();
    const n = lvl < 12 ? 2 : lvl < 20 ? 3 : 4;
    const list = [];
    for (let i = 0; i < n; i++) {
      const k = kinds[i % kinds.length]; const et = ENEMIES[k];
      list.push({ name: et.name, kind: k, hp: P / n * 6 * et.hp, atk: P / n * et.atk, spd: et.spd });
    }
    return { name: names, enemies: list };
  },
  startInvasion() {
    const inv = this.invasionEnemies();
    this.rt.invasion = { ...inv, until: this.now() + 45000 };
    this.s.invasionsSeen++;
    this.emit('invasion', this.rt.invasion);
    return this.rt.invasion;
  },
  resolveInvasion(won, injured = []) {
    const s = this.s;
    const hurt = this.injure(injured);
    const inc = this.incomePerSec(false);
    this.rt.invasion = null;
    if (won) {
      s.stats.invasionsWon++;
      const rw = { gold: Math.max(200, inc * 120), ore: Math.floor(10 + s.level * 4), xp: this.xpFrac(0.08) };
      const got = this.grant(rw);
      this.emit('invasionResult', { won, got, injured: hurt });
      return { won, got, injured: hurt };
    }
    s.stats.invasionsLost++;
    const lost = Math.min(s.gold * 0.1, inc * 300);
    s.gold -= lost;
    const built = BIZ.filter(b => this.isBuilt(b.id) && !s.damaged[b.id]);
    let dmg = null;
    if (built.length) { dmg = pick(built).id; s.damaged[dmg] = this.now() + 300e3; }
    this.emit('invasionResult', { won, lost, damaged: dmg, injured: hurt });
    return { won, lost, damaged: dmg, injured: hurt };
  },
  autoDefend() {
    const team = this.defenders().map(g => this.goblinCombat(g, true));
    if (!team.length) return this.resolveInvasion(false);
    const b = resolveInstant(team, this.rt.invasion.enemies);
    this.recordWounds(b);
    return this.resolveInvasion(b.winner === 'g', this.casualties(b));
  },

  // ------------------------------------------------------------- Prestige
  teethGain() {
    const total = Math.floor(teethFor(this.s.pastRunGold + this.s.runGold) * (1 + this.abilitySum('teeth')));
    return Math.max(0, total - this.s.teethEarned);
  },
  canPrestige() { return this.s.runGold >= PRESTIGE_MIN_GOLD && this.teethGain() >= 1; },
  prestige() {
    if (!this.canPrestige()) return false;
    const s = this.s;
    const gain = this.teethGain();
    s.teeth += gain; s.teethEarned += gain;
    s.stats.prestiges++;
    s.pastRunGold += s.runGold;
    const hs = [0, 1e3, 1e6, 1e9, 1e12][this.perk('headstart')];
    s.gold = 10 + hs; s.mushrooms = Math.max(50, s.mushrooms * 0.1); s.ore = Math.min(s.ore, 100);
    s.runGold = 0; s.xp = 0; s.level = 1;
    for (const b of BUILDINGS) {
      if (b.id === 'huts' || b.id === 'cauldron' || b.id === 'infirmary') continue;
      s.buildings[b.id] = { lvl: b.startBuilt ? 1 : 0, built: 0 };
      delete s.place[b.id];
    }
    s.districts = { muck: true };
    for (const id of ['huts', 'cauldron', 'infirmary']) {
      const p = s.place[id]; if (!p) continue;
      const d = this.def(id); let ok = true;
      for (let y = p.ty; y <= p.ty + d.h; y++) for (let x = p.tx; x < p.tx + d.w; x++) if (!this.tileOpen(x, y)) ok = false;
      if (!ok) delete s.place[id];
    }
    this.placeVer = (this.placeVer || 0) + 1;
    s.research = {};
    s.damaged = {};
    s.buffs = [];
    for (const g of s.goblins) { if (g.assign && g.assign.t === 'med') { g.prev = null; continue; } if (g.assign && g.assign.t !== 'exp') g.assign = null; g.prev = null; if (g.job === 'medic' && this.isBuilt('infirmary')) this.assign(g.uid, { t: 'b', id: 'infirmary' }); }
    this.rt.bubbles = []; this.rt.fires = []; this.rt.rats = []; this.rt.invasion = null;
    if (this.merchantOpen()) this.refreshMerchant(true); else s.merchant = null;
    this.emit('prestige', gain);
    this.save();
    return gain;
  },
  buyPerk(id) {
    const p = PERK_BY_ID[id]; const l = this.perk(id);
    if (l >= p.max) return false;
    if (!this.spend('teeth', p.cost[l])) return false;
    this.s.perks[id] = l + 1;
    this.emit('perk', p);
    return true;
  },

  // ------------------------------------------------------------- Special: bubbles, golden, events
  spawnBubble() {
    const built = BIZ.filter(b => this.isBuilt(b.id) && !this.isConstructing(b.id));
    if (!built.length || this.rt.bubbles.length >= 3) return;
    const b = pick(built);
    if (this.rt.bubbles.find(x => x.bid === b.id)) return;
    const value = Math.max(2, this.buildingIncome(b.id, false) * 20);
    const bub = { id: Math.random(), bid: b.id, value, born: this.now() };
    this.rt.bubbles.push(bub);
    this.emit('bubble', bub);
  },
  popBubble(id) {
    const i = this.rt.bubbles.findIndex(b => b.id === id);
    if (i < 0) return 0;
    const bub = this.rt.bubbles[i];
    this.rt.bubbles.splice(i, 1);
    this.addGold(bub.value);
    this.s.stats.bubbles++;
    this.addXp(this.xpFrac(0.004));
    this.emit('pop', bub);
    return bub.value;
  },
  goldenInterval() {
    const f = 1 + this.abilitySum('golden') + this.researchSum('golden') + 0.2 * this.perk('golden') + 0.05 * this.s.buildings.tower.lvl;
    return (100 + Math.random() * 160) * 1000 / f;
  },
  catchGolden() {
    if (!this.rt.golden) return null;
    this.rt.golden = null;
    this.s.stats.golden++;
    const inc = Math.max(1, this.incomePerSec(false));
    const kind = weighted([['lucky', 45], ['frenzy', 30], ['gems', 15], ['mush', 10]]);
    let text;
    if (kind === 'lucky') {
      const v = Math.max(25, inc * 150 + Math.min(this.s.gold * 0.1, inc * 600));
      this.addGold(v); text = `Lucky! +${fmt(v)} gold`;
    } else if (kind === 'frenzy') {
      this.rt.frenzy = this.now() + 30000; text = 'GOLD FRENZY! Income ×7 for 30s!';
    } else if (kind === 'gems') {
      const v = ri(5, 15); this.s.gems += v; text = `+${v} gems!`;
    } else {
      const v = Math.max(50, this.mushroomRate() * 300); this.s.mushrooms += v; text = `Mushroom shower! +${fmt(v)} mushrooms`;
    }
    this.addXp(this.xpFrac(0.04));
    this.emit('goldenCaught', kind, text);
    return { kind, text };
  },

  pickNames(n) {
    const pool = this.s.goblins.filter(g => !(g.assign && g.assign.t === 'exp'));
    shuffle(pool);
    const out = pool.slice(0, n).map(g => g.name.split(' ')[0]);
    while (out.length < n) out.push(pick(['Snik', 'Grub', 'Mog', 'Some guy']));
    return out;
  },
  fill(text, vars) { return text.replace(/\{(\w+)\}/g, (m, k) => vars[k] !== undefined ? vars[k] : m); },
  spawnEvent() {
    const ev = pick(FUNNY_EVENTS);
    const [a, b] = this.pickNames(2);
    this.rt.event = { def: ev, a, b, until: this.now() + 120000 };
    this.emit('eventSpawn', this.rt.event);
  },
  resolveEvent(choiceIdx) {
    const e = this.rt.event; if (!e) return null;
    this.rt.event = null;
    const ch = e.def.choices[choiceIdx];
    const [_, key, text] = weighted(ch.o.map(o => [o, o[0]]));
    const inc = Math.max(1, this.incomePerSec(false));
    const vars = { a: e.a, b: e.b };
    switch (key) {
      case 'gold_s': vars.gold = fmt(Math.max(50, inc * 60)); this.addGold(Math.max(50, inc * 60)); break;
      case 'gold_m': vars.gold = fmt(Math.max(150, inc * 180)); this.addGold(Math.max(150, inc * 180)); break;
      case 'gold_cost': { const v = Math.min(this.s.gold, inc * 30); vars.gold = fmt(v); this.s.gold -= v; this.addXp(this.xpFrac(0.05)); break; }
      case 'mush': { const v = Math.floor(20 + this.mushroomRate() * 90); vars.mush = fmt(v); this.s.mushrooms += v; break; }
      case 'mush_cost': { const v = Math.floor(Math.min(this.s.mushrooms, 10 + this.mushroomRate() * 30)); vars.mush = fmt(v); this.s.mushrooms -= v; this.buff('gold', 1.5, 60); break; }
      case 'ore': { const v = Math.floor(10 + this.oreRate() * 180); vars.ore = fmt(v); this.s.ore += v; break; }
      case 'gems': { const v = ri(3, 8); vars.gems = v; this.s.gems += v; break; }
      case 'xp': { const v = Math.ceil(xpForLevel(this.s.level) * 0.12); vars.xp = fmt(v); this.addXp(v); break; }
      case 'buff_gold': this.buff('gold', 2, 60); break;
      case 'buff_tavern': this.buff('b:tavern', 3, 120); break;
      case 'buff_shroom': this.buff('b:shroom', 5, 120); break;
    }
    this.s.stats.events++;
    this.addXp(this.xpFrac(0.02));
    const out = this.fill(text, vars);
    this.emit('eventResolved', out);
    return out;
  },
  buff(kind, mult, sec) {
    this.s.buffs.push({ kind, mult, until: this.now() + sec * 1000 });
    this.emit('buff', kind, mult, sec);
  },

  ambient() {
    const [a, b] = this.pickNames(2);
    const text = this.fill(pick(AMBIENT_EVENTS), { a, b });
    this.pushLog(text);
    this.emit('ambient', text);
  },
  pushLog(text) {
    this.rt.log.unshift({ t: this.now(), text });
    if (this.rt.log.length > 30) this.rt.log.length = 30;
    this.emit('log', text);
  },

  // Disasters
  spawnFire() {
    const built = BIZ.filter(b => this.isBuilt(b.id) && !this.s.damaged[b.id] && !this.rt.fires.find(f => f.bid === b.id));
    if (!built.length) return;
    shuffle(built);
    const n = Math.min(built.length, 1 + Math.floor(Math.random() * 3));
    for (let i = 0; i < n; i++) this.rt.fires.push({ id: Math.random(), bid: built[i].id, until: this.now() + 25000, hp: 3 });
    this.emit('disaster', 'fire');
  },
  tapFire(id) {
    const f = this.rt.fires.find(x => x.id === id);
    if (!f) return false;
    f.hp--;
    if (f.hp <= 0) {
      this.rt.fires = this.rt.fires.filter(x => x !== f);
      this.s.stats.fires++;
      const v = Math.max(10, this.buildingIncome(f.bid, false) * 10);
      this.addGold(v);
      this.emit('fireOut', f, v);
    }
    return true;
  },
  spawnRats() {
    const n = 5 + Math.floor(Math.random() * 6);
    for (let i = 0; i < n; i++) this.rt.rats.push({ id: Math.random(), until: this.now() + 22000 });
    this.emit('disaster', 'rats', n);
  },
  squashRat(id) {
    const r = this.rt.rats.find(x => x.id === id);
    if (!r) return 0;
    this.rt.rats = this.rt.rats.filter(x => x !== r);
    this.s.stats.rats++;
    const v = Math.max(3, this.mushroomRate() * 8 + 2);
    this.s.mushrooms += v;
    if (this.abilitySum('offline') > 0 && this.s.goblins.find(g => g.named === 'rattigan')) this.addGold(this.incomePerSec(false) * 5);
    this.emit('ratSquashed', r, v);
    return v;
  },

  // ------------------------------------------------------------- Merchant / trading
  merchantOpen() { return this.s.level >= 8; },
  refreshMerchant(force) {
    const s = this.s; const now = this.now();
    if (!force && s.merchant && s.merchant.refresh > now) return;
    const inc = Math.max(10, this.incomePerSec(false));
    const offers = [];
    offers.push({ id: 'epicgob', name: 'Mystery Goblin Crate', desc: 'Guaranteed Epic or better goblin!', cost: { gems: 220 }, give: { epicplus: 1 } });
    offers.push({ id: 'ore', name: 'Crate of Ore', desc: 'Freshly "found" ore.', cost: { gold: inc * 240 }, give: { ore: Math.floor(60 + this.oreRate() * 600 + s.level * 20) } });
    offers.push({ id: 'mush', name: 'Sack of Mushrooms', desc: 'Probably edible.', cost: { gold: inc * 200 }, give: { mushrooms: Math.floor(100 + this.mushroomRate() * 600 + s.level * 30) } });
    offers.push({ id: 'gems', name: 'Shiny Gems', desc: 'Trade ore for gems.', cost: { ore: Math.floor(150 + s.level * 25) }, give: { gems: 25 } });
    const r = weighted([[2, 60], [3, 32], [4, 8]]);
    offers.push({ id: 'item', name: 'Fancy Gear', desc: RARITIES[r].name + ' equipment piece', cost: { gems: [0, 0, 60, 150, 400][r] }, give: { item: r } });
    const missing = NAMED.filter(n => !s.codex[n.id] && !n.prestigeOnly && n.rarity !== 'mythical');
    if (missing.length) {
      const n = pick(missing);
      offers.push({ id: 'wanted', name: 'Wanted Poster: ' + n.name, desc: 'Hire this ' + RARITIES[this.rarityIdx(n.rarity)].name + ' goblin directly!', cost: { gems: n.rarity === 'epic' ? 350 : 900 }, give: { named: n.id } });
    }
    const missT = Object.keys(TREASURES).filter(k => !s.treasures[k] && this.regionOpen(REGION_BY_ID[TREASURES[k].set]));
    if (missT.length) {
      const k = pick(missT);
      offers.push({ id: 'treasure', name: TREASURES[k].name, desc: 'A missing treasure for your collection.', cost: { gems: 180 }, give: { treasure: k } });
    }
    s.merchant = { offers: offers.map(o => ({ ...o, sold: false })), refresh: now + 3 * 3600e3 };
  },
  buyOffer(i) {
    const s = this.s; const o = s.merchant?.offers[i];
    if (!o || o.sold) return null;
    for (const k in o.cost) if (s[k] < o.cost[k]) return null;
    for (const k in o.cost) s[k] -= o.cost[k];
    o.sold = true;
    s.stats.trades++;
    let res = null;
    if (o.give.epicplus) res = this.recruit('epicplus');
    else if (o.give.named) res = this.addRecruit(this.rarityIdx(NAMED_BY_ID[o.give.named].rarity), 'merchant', o.give.named);
    else if (o.give.item !== undefined) res = this.addItem(this.makeItem(o.give.item));
    else if (o.give.treasure) { s.treasures[o.give.treasure] = (s.treasures[o.give.treasure] || 0) + 1; res = o.give.treasure; this.emit('treasure', o.give.treasure); }
    else this.grant(o.give);
    this.emit('trade', o);
    return res || true;
  },
  // Gem sinks
  warpCost(hours) { return hours === 1 ? 40 : hours === 4 ? 130 : 280; },
  timeWarp(hours) {
    if (!this.spend('gems', this.warpCost(hours))) return null;
    const sec = hours * 3600;
    const gold = this.incomePerSec(false) * sec, mush = this.mushroomRate() * sec, ore = this.oreRate() * sec;
    this.addGold(gold); this.s.mushrooms += mush; this.s.ore += ore;
    this.emit('warp', hours, gold);
    return { gold, mush, ore };
  },
  rushCost(e) { return Math.max(1, Math.ceil((e.end - this.now()) / 600000) * 4); },
  rushExpedition(eid) {
    const e = this.s.expeditions.find(x => x.id === eid);
    if (!e || e.claimed || this.now() >= e.end) return false;
    if (!this.spend('gems', this.rushCost(e))) return false;
    e.end = this.now();
    return true;
  },
  rerollMerchant() {
    if (!this.spend('gems', 20)) return false;
    this.refreshMerchant(true);
    return true;
  },
  sellTreasure(k) {
    if ((this.s.treasures[k] || 0) < 2) return false;
    this.s.treasures[k]--;
    this.s.gems += 15;
    this.s.stats.trades++;
    return true;
  },
  exchange(kind) {
    // simple resource exchange at the market
    const s = this.s;
    const inc = Math.max(5, this.incomePerSec(false));
    // buy price = 2.5x the sell price, so round trips always lose gold
    const oreN = Math.floor(20 + s.level * 3), mushN = Math.floor(40 + s.level * 8);
    if (kind === 'ore2gold') { const n = Math.min(s.ore, 50); if (n < 1) return false; s.ore -= n; this.addGold(n * inc * 1.5, false); }
    else if (kind === 'mush2gold') { const n = Math.min(s.mushrooms, 100); if (n < 1) return false; s.mushrooms -= n; this.addGold(n * inc * 0.5, false); }
    else if (kind === 'gold2ore') { const c = oreN * inc * 1.5 * 2.5; if (!this.spend('gold', c)) return false; s.ore += oreN; }
    else if (kind === 'gold2mush') { const c = mushN * inc * 0.5 * 2.5; if (!this.spend('gold', c)) return false; s.mushrooms += mushN; }
    s.stats.trades++;
    return true;
  },

  // ------------------------------------------------------------- Daily, story, achievements, league
  checkDaily() {
    const s = this.s; const today = dayKey(this.now());
    if (s.daily.day === today) return false;
    const d0 = new Date(this.now()); const yest = dayKey(new Date(d0.getFullYear(), d0.getMonth(), d0.getDate() - 1, 12).getTime());
    s.daily.streak = s.daily.lastLogin === yest ? s.daily.streak + 1 : 1;
    s.daily.lastLogin = today;
    s.daily.day = today;
    s.daily.loginClaimed = false;
    s.daily.loginDay = (s.daily.streak - 1) % 7;
    const R = rng(hashStr(today + s.created));
    const avail = DAILY_TEMPLATES.filter(t => !t.needs || (t.needs === 'combat' && s.level >= 4) || (t.needs === 'explore' && s.buildings.lodge.lvl > 0));
    const chosen = shuffle(avail.slice(), R).slice(0, 3);
    const tierIdx = s.level < 8 ? 0 : s.level < 18 ? 1 : 2;
    s.daily.quests = chosen.map(t => ({ id: t.id, n: t.n[tierIdx], base: s.stats[t.stat] || 0, claimed: false }));
    s.daily.bonusClaimed = false;
    this.emit('newDay');
    return true;
  },
  dailyProgress(q) {
    const t = DAILY_TEMPLATES.find(x => x.id === q.id);
    if (!t) return 0;
    return Math.min(q.n, (this.s.stats[t.stat] || 0) - q.base);
  },
  claimDaily(i) {
    const q = this.s.daily.quests[i]; if (!q || q.claimed) return false;
    if (this.dailyProgress(q) < q.n) return false;
    q.claimed = true;
    const t = DAILY_TEMPLATES.find(x => x.id === q.id);
    this.grant(t.reward);
    this.s.mushrooms += 20 + this.s.level * 5;
    return true;
  },
  claimDailyBonus() {
    const d = this.s.daily;
    if (d.bonusClaimed || !d.quests.every(q => q.claimed)) return false;
    d.bonusClaimed = true;
    this.s.tickets += 0; this.s.gems += 40;
    return true;
  },
  claimLogin() {
    const d = this.s.daily; if (d.loginClaimed) return null;
    d.loginClaimed = true;
    const rw = LOGIN_REWARDS[d.loginDay];
    return this.grant(rw);
  },

  storyQuest() { return STORY[this.s.story] || null; },
  storyProgress(q = this.storyQuest()) {
    if (!q) return 0;
    const s = this.s, g = q.goal;
    if (g.build) return this.isBuilt(g.build) ? 1 : 0;
    if (g.blvl) return Math.min(1, s.buildings[g.blvl[0]].lvl / g.blvl[1]);
    if (g.stat) return Math.min(1, (s.stats[g.stat[0]] || 0) / g.stat[1]);
    if (g.assigned) return Math.min(1, s.goblins.filter(x => x.assign && x.assign.t === 'b').length / g.assigned);
    if (g.level) return Math.min(1, s.level / g.level);
    if (g.district) return s.districts[g.district] ? 1 : 0;
    if (g.goblins) return Math.min(1, s.goblins.length / g.goblins);
    if (g.research) return Math.min(1, Object.keys(s.research).length / g.research);
    if (g.boss) return Math.min(1, this.regionStage(g.boss) / STAGES_PER_REGION);
    if (g.anyLvl) return Math.min(1, this.maxBuildingLvl() / g.anyLvl);
    if (g.runGold) return Math.min(1, s.runGold / g.runGold);
    if (g.rarity) return this.bestRarity() >= g.rarity ? 1 : 0;
    if (g.sets) return Math.min(1, this.completedSets() / g.sets);
    return 0;
  },
  claimStory() {
    const q = this.storyQuest();
    if (!q || this.storyProgress(q) < 1) return null;
    const got = this.grant(q.reward);
    this.s.story++;
    this.addXp(this.xpFrac(0.05));
    this.emit('storyClaim', q, got);
    return got;
  },

  checkAchievements() {
    const s = this.s;
    for (const a of ACHIEVEMENTS) {
      if (s.achievements[a.id]) continue;
      let ok = false;
      try { ok = a.check(s, this); } catch (e) { ok = false; }
      if (ok) { s.achievements[a.id] = this.now(); s.gems += a.gems; this.emit('achievement', a); }
    }
  },

  checkLeague() {
    const s = this.s; const wk = weekKey(this.now());
    if (s.league && s.league.week === wk) return;
    if (s.league) {
      const rank = this.leagueRank();
      const gems = rank === 1 ? 300 : rank <= 3 ? 150 : rank <= 10 ? 60 : 20;
      if (rank === 1) s.stats.leagueWins++;
      s.leaguePending = { rank, gems };
    }
    const inc = Math.max(1, this.incomePerSec(false));
    const est = Math.max(5e4, inc * 3600 * 25) * (s.lifetimeGold < 1e5 ? 0.3 : 1);
    const R = rng(hashStr('L' + wk + s.created));
    const names = shuffle(RIVAL_NAMES.slice(), R).slice(0, 19);
    s.league = {
      week: wk, start: this.now(),
      rivals: names.map((n, i) => ({ name: n, target: est * Math.pow(10, -1.3 + 2.6 * (i / 18)) * (0.8 + R() * 0.4), curve: 1.4 + R() * 1.2 })),
    };
    s.weekGold = 0;
  },
  leagueBoard() {
    const s = this.s; if (!s.league) return [];
    const p = clamp((this.now() - s.league.week) / (7 * 86400e3), 0, 1);
    const rows = s.league.rivals.map(r => ({ name: r.name, score: r.target * Math.pow(p, r.curve), me: false }));
    rows.push({ name: s.name + ' (You)', score: s.weekGold, me: true });
    rows.sort((a, b) => b.score - a.score);
    return rows;
  },
  leagueRank() { return this.leagueBoard().findIndex(r => r.me) + 1; },
  claimLeague() {
    const p = this.s.leaguePending; if (!p) return null;
    this.s.gems += p.gems; this.s.leaguePending = null; return p;
  },

  // ------------------------------------------------------------- Offline
  offlineCapHours() { return 4 + 4 * this.perk('pockets') + this.researchSum('offcap'); },
  offlineMult() { return 0.6 * (1 + this.researchSum('offline') + this.abilitySum('offline') + this.setBonus('offline')); },
  applyOffline() {
    const s = this.s;
    const now = this.now();
    const away = Math.max(0, (now - s.lastSave) / 1000);
    if (away < 30) { s.lastTick = now; s.lastSave = now; return null; }
    const dt = Math.min(away, this.offlineCapHours() * 3600);
    const saveFrenzy = this.rt.frenzy; this.rt.frenzy = 0;
    const gold = this.incomePerSec(false) * dt * this.offlineMult();
    const mush = this.mushroomRate() * dt * this.offlineMult();
    const ore = this.oreRate() * dt * this.offlineMult();
    this.rt.frenzy = saveFrenzy;
    s.lastSave = now;
    // don't let every timed event fire at once on return
    for (const k in s.timers) if (s.timers[k] < now) s.timers[k] = now + 20e3 + Math.random() * 60e3;
    this.addGold(gold);
    s.mushrooms += mush; s.ore += ore;
    s.lastTick = now;
    // clean up damaged that expired
    for (const id in s.damaged) if (s.damaged[id] < now) delete s.damaged[id];
    const expReady = s.expeditions.filter(e => !e.claimed && e.end <= now).length;
    return { away, dt, gold, mush, ore, expReady, capped: away > dt };
  },

  // ------------------------------------------------------------- Tick
  tick(dt) {
    const s = this.s;
    const now = this.now();
    dt = Math.min(dt, 5);
    s.stats.playTime += dt;
    // casino variance random walk
    this.rt.casinoPhase += dt;
    const target = 1.25 + Math.sin(this.rt.casinoPhase * 0.21) * 0.9 + Math.sin(this.rt.casinoPhase * 0.53) * 0.6;
    this.rt.casinoMult = clamp(target, 0.15, 3.2);

    const inc = this.incomePerSec();
    this.addGold(inc * dt);
    s.mushrooms += this.mushroomRate() * dt;
    s.ore += this.oreRate() * dt;

    // buffs/damage cleanup
    if (s.buffs.length && s.buffs.some(b => b.until <= now)) s.buffs = s.buffs.filter(b => b.until > now);
    for (const id in s.damaged) if (s.damaged[id] < now) { delete s.damaged[id]; this.emit('repaired', id); }

    const T = s.timers;
    if (now > T.bubble) {
      T.bubble = now + (5 + Math.random() * 7) * 1000;
      this.spawnBubble();
    }
    if (this.perk('autobubble')) for (const b of this.rt.bubbles.slice()) if (now - b.born > 2500) this.popBubble(b.id);
    // expire old bubbles
    this.rt.bubbles = this.rt.bubbles.filter(b => now - b.born < 40000 || this.emit('bubbleExpire', b));

    if (now > T.golden) {
      T.golden = now + this.goldenInterval();
      if (!this.rt.golden && s.level >= 2) { this.rt.golden = { until: now + 13000 }; this.emit('golden'); }
    }
    if (this.rt.golden && now > this.rt.golden.until) { this.rt.golden = null; this.emit('goldenEscaped'); }

    if (now > T.event) {
      T.event = now + (80 + Math.random() * 100) * 1000;
      if (!this.rt.event && s.level >= 3) this.spawnEvent();
    }
    if (this.rt.event && now > this.rt.event.until) { this.rt.event = null; this.emit('eventExpired'); }

    if (now > T.ambient) {
      T.ambient = now + (14 + Math.random() * 20) * 1000;
      this.ambient();
    }

    if (now > T.disaster) {
      T.disaster = now + (200 + Math.random() * 200) * 1000;
      if (s.level >= 3 && !this.rt.fires.length && !this.rt.rats.length) {
        if (Math.random() < 0.5 && BIZ.filter(b => this.isBuilt(b.id)).length >= 2) this.spawnFire(); else this.spawnRats();
      }
    }
    // fires burning out => damage
    for (const f of this.rt.fires.slice()) {
      if (now > f.until) {
        this.rt.fires = this.rt.fires.filter(x => x !== f);
        s.damaged[f.bid] = now + 300e3;
        this.emit('burned', f.bid);
      }
    }
    for (const r of this.rt.rats.slice()) {
      if (now > r.until) {
        this.rt.rats = this.rt.rats.filter(x => x !== r);
        const lost = Math.min(s.mushrooms, Math.max(2, this.mushroomRate() * 5));
        s.mushrooms -= lost;
        this.emit('ratEscaped', r, lost);
      }
    }

    if (now > T.invasion) {
      T.invasion = now + (420 + Math.random() * 360) * 1000;
      if (this.isBuilt('barracks') && !this.isConstructing('barracks') && !this.rt.invasion) this.startInvasion();
    }
    if (this.rt.invasion && !this.rt.invasion.fighting && now > this.rt.invasion.until) this.autoDefend();

    if (this.injured().length) this.processHealing(now);
    // expeditions done notification
    for (const e of s.expeditions) if (!e.claimed && !e.notified && now >= e.end) { e.notified = true; this.emit('expDone', e); }

    s.lastTick = now;
  },

  slowTick() {
    this.checkAchievements();
    this.checkDaily();
    this.checkLeague();
    if (this.merchantOpen()) this.refreshMerchant();
  },
};

export default G;
