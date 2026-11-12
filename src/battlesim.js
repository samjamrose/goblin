// Pure battle simulation (used by the battle screen and auto-resolve).
import { ENEMIES } from './data.js';

let UID = 1;

// ---- Goblin attack buttons (one per goblin, by job) and enemy special attacks.
// Basic attacks still happen automatically; skills add a light layer of timing strategy.
export const SKILLS = {
  warrior: { name: 'Shield Bash', icon: 'shield', cd: 8, desc: 'Big hit on the front enemy and stuns it (cancels its special).', kind: 'hit', mult: 2.4, stun: 1.8 },
  thief: { name: 'Backstab', icon: 'dagger', cd: 7, desc: 'Huge crit on the weakest enemy.', kind: 'weak', mult: 4 },
  alchemist: { name: 'Boom Flask', icon: 'potion', cd: 9, desc: 'Splashes every enemy.', kind: 'all', mult: 1.5 },
  scout: { name: 'Volley', icon: 'map', cd: 6, desc: 'Three quick shots at random enemies.', kind: 'volley', mult: 1, hits: 3 },
  miner: { name: 'Rock Slam', icon: 'pick', cd: 8, desc: 'Heavy hit that briefly stuns.', kind: 'hit', mult: 2.4, stun: 1 },
  smith: { name: 'Hot Iron', icon: 'hammer', cd: 8, desc: 'Searing hit on the front enemy.', kind: 'hit', mult: 3 },
  builder: { name: 'Barricade', icon: 'castle', cd: 12, desc: 'Shields the whole team for 5s. Use it before a big enemy attack!', kind: 'shield', mult: 2.5, dur: 5 },
  farmer: { name: 'Shroom Snack', icon: 'shroom', cd: 11, desc: 'Heals the most hurt goblin.', kind: 'heal', mult: 0.35 },
  brewer: { name: 'Grog Round', icon: 'mug', cd: 14, desc: 'Team attack +50% for 6s.', kind: 'rally', mult: 0.5, dur: 6 },
  merchant: { name: 'Coin Toss', icon: 'coin', cd: 8, desc: 'Pelts the front enemy with coins.', kind: 'hit', mult: 2.6 },
  gambler: { name: 'Lucky Roll', icon: 'dice', cd: 7, desc: 'Random damage: tiny... or ENORMOUS.', kind: 'gamble', mult: 1 },
  medic: { name: 'Patch Up', icon: 'heart', cd: 10, desc: 'Heals the most hurt goblin.', kind: 'heal', mult: 0.4 },
};
const ENEMY_SPECIAL = { cd: 11, windup: 1.6, mult: 3 };

export function makeUnit(side, o) {
  const u = {
    id: UID++, side, name: o.name, kind: o.kind, look: o.look, gob: o.gob, boss: !!o.boss, tint: o.tint, job: o.job,
    maxHp: o.hp, hp: o.hpNow !== undefined ? Math.max(1, o.hpNow) : o.hp, atk: o.atk, spd: o.spd || 1, crit: o.crit || 0.05, splash: o.splash || 0,
    cd: 0.4 + Math.random() * 0.8, alive: true, anim: 0, hurt: 0, rarity: o.rarity, stun: 0,
  };
  if (side === 'g') { u.skill = SKILLS[o.job] || SKILLS.merchant; u.skillCd = u.skill.cd * 0.35; }
  else { u.spCd = ENEMY_SPECIAL.cd * (0.45 + Math.random() * 0.4) * (o.boss ? 0.8 : 1); u.charge = 0; }
  return u;
}

export function createBattle(team, enemies, opts = {}) {
  const units = [...team.map(u => makeUnit('g', u)), ...enemies.map(e => makeUnit('e', e))];
  return { units, t: 0, over: false, winner: null, fx: [], opts, timeLimit: opts.timeLimit || 90, shield: 0, shieldT: 0, rally: 0 };
}

function aliveOf(b, side) { return b.units.filter(u => u.side === side && u.alive); }

export function damage(b, target, dmg, src, isCrit) {
  if (!target.alive) return;
  dmg = Math.max(1, dmg);
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

// Use a goblin's skill (from a button press or the auto-player). Returns true if it fired.
export function useSkill(b, u) {
  if (b.over || !u.alive || u.side !== 'g' || u.skillCd > 0 || u.stun > 0) return false;
  const S = u.skill, foes = aliveOf(b, 'e'), team = aliveOf(b, 'g');
  if (!foes.length) return false;
  const atk = u.atk * (b.rally > 0 ? 1.5 : 1);
  u.skillCd = S.cd; u.anim = 0.4;
  b.fx.push({ type: 'skill', unit: u.id, name: S.name, kind: S.kind });
  switch (S.kind) {
    case 'hit': { const t = foes[0]; damage(b, t, atk * S.mult, u.id, true); if (S.stun && t.alive) { t.stun = Math.max(t.stun, S.stun); if (t.charge > 0) { t.charge = 0; b.fx.push({ type: 'interrupt', unit: t.id }); } } break; }
    case 'weak': { const t = foes.reduce((a, c) => (c.hp < a.hp ? c : a), foes[0]); damage(b, t, atk * S.mult, u.id, true); break; }
    case 'all': for (const f of foes) damage(b, f, atk * S.mult, u.id, false); break;
    case 'volley': for (let i = 0; i < S.hits; i++) { const live = aliveOf(b, 'e'); if (!live.length) break; damage(b, live[Math.floor(Math.random() * live.length)], atk * S.mult, u.id, false); } break;
    case 'gamble': { const r = Math.random(); const m = r < 0.25 ? 0.4 : r < 0.75 ? 2 : r < 0.95 ? 4 : 8; damage(b, foes[0], atk * m, u.id, m >= 4); break; }
    case 'shield': b.shield = Math.max(b.shield, atk * S.mult * team.length); b.shieldT = S.dur; break;
    case 'rally': b.rally = S.dur; break;
    case 'heal': { const t = team.reduce((a, c) => (c.hp / c.maxHp < a.hp / a.maxHp ? c : a), team[0]); const v = t.maxHp * S.mult; t.hp = Math.min(t.maxHp, t.hp + v); b.fx.push({ type: 'heal', unit: t.id, v }); break; }
  }
  checkEnd(b);
  return true;
}

// simple auto-player: used for auto-battles, invasions and win-chance estimates
function autoSkills(b) {
  const charging = aliveOf(b, 'e').some(e => e.charge > 0);
  for (const u of aliveOf(b, 'g')) {
    if (u.skillCd > 0) continue;
    const k = u.skill.kind;
    if (k === 'shield' && !charging) continue;
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
          u.spCd = ENEMY_SPECIAL.cd * (0.85 + Math.random() * 0.3) * (u.boss ? 0.8 : 1);
        }
        continue;
      }
      u.spCd -= dt;
      if (u.spCd <= 0) { u.charge = ENEMY_SPECIAL.windup; b.fx.push({ type: 'charge', unit: u.id }); continue; }
    }
    u.cd -= dt;
    if (u.cd <= 0) {
      const foes = aliveOf(b, u.side === 'g' ? 'e' : 'g');
      if (!foes.length) break;
      // Attack the front-most (first) living foe; thieves pick the weakest
      let target = foes[0];
      if (u.crit > 0.3) target = foes.reduce((a, c) => (c.hp < a.hp ? c : a), foes[0]);
      const isCrit = Math.random() < u.crit;
      let dmg = u.atk * (0.85 + Math.random() * 0.3) * (isCrit ? 2.2 : 1) * (u.side === 'g' && b.rally > 0 ? 1.5 : 1);
      u.anim = 0.3;
      b.fx.push({ type: 'atk', unit: u.id, target: target.id });
      damage(b, target, dmg, u.id, isCrit);
      if (u.splash) for (const f of foes) if (f !== target) damage(b, f, dmg * u.splash, u.id, false);
      u.cd = u.spd * (0.9 + Math.random() * 0.2);
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

// estimated chance to win with sensible button use
export function winChance(team, enemies, n = 24) {
  let wins = 0;
  for (let i = 0; i < n; i++) if (resolveInstant(team, enemies, { dt: 0.2 }).winner === 'g') wins++;
  return wins / n;
}

// Build enemy stat blocks for a region stage
export function enemyTeam(region, stage, opts = {}) {
  const isBoss = stage >= 10 && !opts.noBoss;
  let total = region.power * Math.pow(1.24, stage - 1) * (opts.mult || 1);
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
