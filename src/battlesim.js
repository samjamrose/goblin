// Pure battle simulation (used by the battle screen and auto-resolve).
import { ENEMIES, REGIONS } from './data.js';

let UID = 1;

// ---- Goblin attack buttons (one per goblin, by job) and enemy special attacks.
// Basic attacks still happen automatically; skills add a light layer of timing strategy.
export const SKILLS = {
  warrior: { name: 'Shield Bash', icon: 'shield', cd: 8, desc: 'Big hit on the front enemy and stuns it (cancels its special).', kind: 'hit', mult: 2.4, stun: 1.8 },
  thief: { name: 'Backstab', icon: 'dagger', cd: 7, desc: 'Huge hit on your target (or the weakest). Double damage on a stunned enemy!', kind: 'weak', mult: 3.5 },
  alchemist: { name: 'Boom Flask', icon: 'potion', cd: 9, desc: 'Splashes every enemy.', kind: 'all', mult: 1.5 },
  scout: { name: 'Volley', icon: 'map', cd: 6, desc: 'Three quick shots: your target first, then the others.', kind: 'volley', mult: 1, hits: 3 },
  miner: { name: 'Rock Slam', icon: 'pick', cd: 8, desc: 'Heavy hit that briefly stuns.', kind: 'hit', mult: 2.4, stun: 1 },
  smith: { name: 'Hot Iron', icon: 'hammer', cd: 8, desc: 'Searing hit on the front enemy.', kind: 'hit', mult: 3 },
  builder: { name: 'Barricade', icon: 'castle', cd: 12, desc: 'Shields the whole team for 5s. Use it before a big enemy attack!', kind: 'shield', mult: 2.5, dur: 5 },
  farmer: { name: 'Shroom Snack', icon: 'shroom', cd: 11, desc: 'Heals the most hurt goblin.', kind: 'heal', mult: 0.35 },
  brewer: { name: 'Grog Round', icon: 'mug', cd: 14, desc: 'Team attack +50% for 6s.', kind: 'rally', mult: 0.5, dur: 6 },
  merchant: { name: 'Coin Toss', icon: 'coin', cd: 8, desc: 'Pelts the front enemy with coins.', kind: 'hit', mult: 2.6 },
  gambler: { name: 'Hot Streak', icon: 'dice', cd: 7, desc: 'Hits harder every time you use it this battle (up to 5x).', kind: 'streak', mult: 1.5 },
  medic: { name: 'Patch Up', icon: 'heart', cd: 10, desc: 'Heals the most hurt goblin.', kind: 'heal', mult: 0.4 },
};
const ENEMY_SPECIAL = { cd: 11, windup: 1.8, mult: 3 };
let ORDER = 0;

export function makeUnit(side, o) {
  const u = {
    id: UID++, side, name: o.name, kind: o.kind, look: o.look, gob: o.gob, boss: !!o.boss, tint: o.tint, job: o.job,
    maxHp: o.hp, hp: o.hpNow !== undefined ? Math.max(1, o.hpNow) : o.hp, atk: o.atk, spd: o.spd || 1, crit: o.crit || 0.05, splash: o.splash || 0,
    cd: 0.5 + (ORDER % 4) * 0.17, alive: true, anim: 0, hurt: 0, rarity: o.rarity, stun: 0, hits: 0, streak: 0,
  };
  const order = ORDER++;
  if (side === 'g') { u.skill = SKILLS[o.job] || SKILLS.merchant; u.skillCd = u.skill.cd * 0.35; }
  else { u.spCd = ENEMY_SPECIAL.cd * (0.45 + (order % 4) * 0.18) * (o.boss ? 0.8 : 1); u.charge = 0; }
  return u;
}

export function createBattle(team, enemies, opts = {}) {
  ORDER = 0;
  const gs = team.map(u => makeUnit('g', u));
  ORDER = 0;
  const es = enemies.map(e => makeUnit('e', e));
  return { units: [...gs, ...es], t: 0, over: false, winner: null, fx: [], opts, timeLimit: opts.timeLimit || 90, shield: 0, shieldT: 0, rally: 0, focus: null };
}

function aliveOf(b, side) { return b.units.filter(u => u.side === side && u.alive); }

export function damage(b, target, dmg, src, isCrit) {
  if (!target.alive) return;
  dmg = Math.max(1, dmg);
  if (target.side === 'e' && target.stun > 0) dmg *= 1.5; // combo: stunned enemies take +50%
  if (target.side === 'g' && b.shield > 0) {
    const absorbed = Math.min(b.shield, dmg);
    b.shield -= absorbed; dmg -= absorbed;
    b.fx.push({ type: 'block', unit: target.id, v: absorbed });
    if (dmg <= 0) return;
  }
  target.hp -= dmg;
  target.hurt = 0.25;
  b.fx.push({ type: 'dmg', unit: target.id, v: dmg, crit: !!isCrit, src });
  if (target.hp <= 0) { target.hp = 0; target.alive = false; target.charge = 0; b.fx.push({ type: 'die', unit: target.id }); }
}

// the enemy the player has focused (tap an enemy), else the front-most one
export function focusTarget(b, foes) { const f = b.focus && foes.find(e => e.id === b.focus); return f || foes[0]; }
export function setFocus(b, unit) { if (unit && unit.side === 'e' && unit.alive) { b.focus = unit.id; b.fx.push({ type: 'focus', unit: unit.id }); } }

// Use a goblin's skill (from a button press or the auto-player). Returns true if it fired.
export function useSkill(b, u) {
  if (b.over || !u.alive || u.side !== 'g' || u.skillCd > 0 || u.stun > 0) return false;
  const S = u.skill, foes = aliveOf(b, 'e'), team = aliveOf(b, 'g');
  if (!foes.length) return false;
  const atk = u.atk * (b.rally > 0 ? 1.5 : 1);
  u.skillCd = S.cd; u.anim = 0.4;
  b.fx.push({ type: 'skill', unit: u.id, name: S.name, kind: S.kind });
  switch (S.kind) {
    case 'hit': {
      const t = focusTarget(b, foes); damage(b, t, atk * S.mult, u.id, true);
      if (S.stun && t.alive) {
        t.stun = Math.max(t.stun, S.stun);
        // combo: interrupting a wind-up refunds half the cooldown
        if (t.charge > 0) { t.charge = 0; t.spCd = ENEMY_SPECIAL.cd * 0.7; u.skillCd = S.cd * 0.5; b.fx.push({ type: 'interrupt', unit: t.id }); }
      }
      break;
    }
    case 'weak': { const t = b.focus && foes.find(e => e.id === b.focus) || foes.reduce((a, c) => (c.hp < a.hp ? c : a), foes[0]); damage(b, t, atk * S.mult * (t.stun > 0 ? 2 : 1), u.id, true); break; }
    case 'all': for (const f of foes) damage(b, f, atk * S.mult, u.id, false); break;
    case 'volley': { const first = focusTarget(b, foes); const order = [first, ...foes.filter(f => f !== first)]; for (let i = 0; i < S.hits; i++) { const live = order.filter(f => f.alive); if (!live.length) break; damage(b, live[i % live.length], atk * S.mult, u.id, false); } break; }
    case 'streak': { const m = Math.min(5, S.mult + u.streak * 0.75); u.streak++; damage(b, focusTarget(b, foes), atk * m, u.id, m >= 3); break; }
    case 'shield': b.shield = Math.max(b.shield, atk * S.mult * team.length); b.shieldT = S.dur; break;
    case 'rally': b.rally = S.dur; break;
    case 'heal': { const t = team.reduce((a, c) => (c.hp / c.maxHp < a.hp / a.maxHp ? c : a), team[0]); const v = t.maxHp * S.mult; t.hp = Math.min(t.maxHp, t.hp + v); b.fx.push({ type: 'heal', unit: t.id, v }); break; }
  }
  checkEnd(b);
  return true;
}

// simple auto-player: used for auto-battles, invasions and win-chance estimates
function autoSkills(b) {
  const foes = aliveOf(b, 'e');
  const chargingFoe = foes.find(e => e.charge > 0);
  const charging = !!chargingFoe;
  if (chargingFoe) b.focus = chargingFoe.id;
  for (const u of aliveOf(b, 'g')) {
    if (u.skillCd > 0) continue;
    const k = u.skill.kind;
    if (k === 'shield' && !charging) continue;
    if (u.skill.stun && !charging && foes.some(e => e.spCd < 3)) continue; // save stuns for the next wind-up
    if (k === 'heal' && !aliveOf(b, 'g').some(g => g.hp < g.maxHp * 0.6)) continue;
    useSkill(b, u);
  }
}

function checkEnd(b) {
  const g = aliveOf(b, 'g').length, e = aliveOf(b, 'e').length;
  if (!e) { b.over = true; b.winner = 'g'; }
  else if (!g) { b.over = true; b.winner = 'e'; }
  else if (b.t > b.timeLimit) { b.over = true; b.winner = 'e'; b.timeout = true; }
}

export function stepBattle(b, dt) {
  if (b.over) return;
  b.t += dt;
  if (b.shieldT > 0) { b.shieldT -= dt; if (b.shieldT <= 0) b.shield = 0; }
  if (b.rally > 0) b.rally -= dt;
  if (b.opts.autoSkills) autoSkills(b);
  for (const u of b.units) {
    if (!u.alive) continue;
    u.anim = Math.max(0, u.anim - dt);
    u.hurt = Math.max(0, u.hurt - dt);
    if (u.side === 'g' && u.skillCd > 0) u.skillCd = Math.max(0, u.skillCd - dt);
    if (u.stun > 0) { u.stun -= dt; continue; }
    // enemy special: wind up (telegraphed), then a heavy blow
    if (u.side === 'e') {
      if (u.charge > 0) {
        u.charge -= dt;
        if (u.charge <= 0) {
          const foes = aliveOf(b, 'g'); if (!foes.length) break;
          u.anim = 0.4;
          b.fx.push({ type: 'special', unit: u.id });
          if (u.boss) for (const f of foes) damage(b, f, u.atk * ENEMY_SPECIAL.mult * 0.55, u.id, true);
          else damage(b, foes[0], u.atk * ENEMY_SPECIAL.mult, u.id, true);
          u.spCd = ENEMY_SPECIAL.cd * (u.boss ? (u.hp < u.maxHp / 2 ? 0.5 : 0.8) : 1);
        }
        continue;
      }
      if (u.boss && !u.enraged && u.hp < u.maxHp / 2) { u.enraged = true; u.spCd = Math.min(u.spCd, 3); b.fx.push({ type: 'enrage', unit: u.id }); }
      u.spCd -= dt;
      if (u.spCd <= 0) { u.charge = ENEMY_SPECIAL.windup; b.fx.push({ type: 'charge', unit: u.id }); continue; }
    }
    u.cd -= dt;
    if (u.cd <= 0) {
      const foes = aliveOf(b, u.side === 'g' ? 'e' : 'g');
      if (!foes.length) break;
      // Attack the front-most (first) living foe; thieves pick the weakest
      let target = u.side === 'g' ? focusTarget(b, foes) : foes[0];
      if (u.side === 'g' && u.crit > 0.3 && !b.focus) target = foes.reduce((a, c) => (c.hp < a.hp ? c : a), foes[0]);
      u.hits++;
      const isCrit = u.crit > 0.3 && u.hits % 3 === 0; // no dice: thieves crit every 3rd hit
      let dmg = u.atk * (isCrit ? 2.2 : 1) * (u.side === 'g' && b.rally > 0 ? 1.5 : 1);
      u.anim = 0.3;
      b.fx.push({ type: 'atk', unit: u.id, target: target.id });
      damage(b, target, dmg, u.id, isCrit);
      if (u.splash) for (const f of foes) if (f !== target) damage(b, f, dmg * u.splash, u.id, false);
      u.cd = u.spd;
    }
  }
  checkEnd(b);
}

export function resolveInstant(team, enemies, opts = {}) {
  const b = createBattle(team, enemies, { autoSkills: true, ...opts });
  let guard = 0;
  const dt = opts.dt || 0.1;
  while (!b.over && guard++ < 5000) { stepBattle(b, dt); b.fx.length = 0; }
  return b;
}

// Battles have no dice, so instead of a chance we find the team strength (as a multiple of the
// current team) at which the fight is won with sensible play. < 1 means power to spare.
export function winMargin(team, enemies) {
  const scaled = (m) => team.map(u => ({ ...u, hp: u.hp * m, hpNow: u.hpNow !== undefined ? u.hpNow * m : undefined, atk: u.atk * m }));
  const wins = (m) => resolveInstant(scaled(m), enemies, { dt: 0.2 }).winner === 'g';
  let lo = 0.2, hi = 5;
  if (!wins(hi)) return Infinity;
  if (wins(lo)) return lo;
  for (let i = 0; i < 9; i++) { const mid = Math.sqrt(lo * hi); if (wins(mid)) hi = mid; else lo = mid; }
  return hi;
}
// estimated chance to win with sensible button use
export function winChance(team, enemies, n = 24) {
  let wins = 0;
  for (let i = 0; i < n; i++) if (resolveInstant(team, enemies, { dt: 0.2 }).winner === 'g') wins++;
  return wins / n;
}

// Build enemy stat blocks for a region stage
export function enemyTeam(region, stage, opts = {}) {
  const isBoss = stage >= 10 && !opts.noBoss;
  // later regions get a bit tougher to match how strong skill combos make late-game teams
  const ri = Math.max(0, REGIONS.findIndex(r => r.id === region.id));
  let total = region.power * Math.pow(1.24, stage - 1) * (opts.mult || 1) * (1 + 0.05 * ri);
  const list = [];
  if (isBoss) {
    total *= 1.35;
    const bt = ENEMIES[region.boss.type];
    const bp = total * 0.6;
    list.push({ name: region.boss.name, kind: region.boss.type, boss: true, tint: region.boss.tint, hp: bp * 9 * bt.hp, atk: bp * bt.atk * 0.9, spd: bt.spd });
    for (let i = 0; i < 2; i++) {
      const k = region.enemies[i];
      const et = ENEMIES[k];
      const p = total * 0.2;
      list.push({ name: et.name, kind: k, hp: p * 6 * et.hp, atk: p * et.atk, spd: et.spd });
    }
  } else {
    const n = stage < 3 ? 2 : stage < 6 ? 3 : 4;
    for (let i = 0; i < n; i++) {
      const k = region.enemies[(i + stage) % region.enemies.length];
      const et = ENEMIES[k];
      const p = total / n;
      list.push({ name: et.name, kind: k, hp: p * 6 * et.hp, atk: p * et.atk, spd: et.spd });
    }
  }
  // tanks in front
  list.sort((a, b) => (b.boss ? 1 : 0) - (a.boss ? 1 : 0));
  return list;
}
