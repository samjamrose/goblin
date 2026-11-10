// Pure battle simulation (used by the battle screen and auto-resolve).
import { ENEMIES } from './data.js';

let UID = 1;

export function makeUnit(side, o) {
  return {
    id: UID++, side, name: o.name, kind: o.kind, look: o.look, gob: o.gob, boss: !!o.boss, tint: o.tint,
    maxHp: o.hp, hp: o.hpNow !== undefined ? Math.max(1, o.hpNow) : o.hp, atk: o.atk, spd: o.spd || 1, crit: o.crit || 0.05, splash: o.splash || 0,
    cd: 0.4 + Math.random() * 0.8, alive: true, anim: 0, hurt: 0, rarity: o.rarity,
  };
}

export function createBattle(team, enemies, opts = {}) {
  const units = [...team.map(u => makeUnit('g', u)), ...enemies.map(e => makeUnit('e', e))];
  return { units, t: 0, over: false, winner: null, fx: [], opts, timeLimit: opts.timeLimit || 90 };
}

function aliveOf(b, side) { return b.units.filter(u => u.side === side && u.alive); }

export function damage(b, target, dmg, src, isCrit) {
  if (!target.alive) return;
  dmg = Math.max(1, dmg);
  target.hp -= dmg;
  target.hurt = 0.25;
  b.fx.push({ type: 'dmg', unit: target.id, v: dmg, crit: !!isCrit, src });
  if (target.hp <= 0) { target.hp = 0; target.alive = false; b.fx.push({ type: 'die', unit: target.id }); }
}

export function stepBattle(b, dt) {
  if (b.over) return;
  b.t += dt;
  for (const u of b.units) {
    if (!u.alive) continue;
    u.anim = Math.max(0, u.anim - dt);
    u.hurt = Math.max(0, u.hurt - dt);
    u.cd -= dt;
    if (u.cd <= 0) {
      const foes = aliveOf(b, u.side === 'g' ? 'e' : 'g');
      if (!foes.length) break;
      // Attack the front-most (first) living foe; thieves pick the weakest
      let target = foes[0];
      if (u.crit > 0.3) target = foes.reduce((a, c) => (c.hp < a.hp ? c : a), foes[0]);
      const isCrit = Math.random() < u.crit;
      let dmg = u.atk * (0.85 + Math.random() * 0.3) * (isCrit ? 2.2 : 1);
      u.anim = 0.3;
      b.fx.push({ type: 'atk', unit: u.id, target: target.id });
      damage(b, target, dmg, u.id, isCrit);
      if (u.splash) for (const f of foes) if (f !== target) damage(b, f, dmg * u.splash, u.id, false);
      u.cd = u.spd * (0.9 + Math.random() * 0.2);
    }
  }
  const g = aliveOf(b, 'g').length, e = aliveOf(b, 'e').length;
  if (!e) { b.over = true; b.winner = 'g'; }
  else if (!g) { b.over = true; b.winner = 'e'; }
  else if (b.t > b.timeLimit) { b.over = true; b.winner = 'e'; b.timeout = true; }
}

export function resolveInstant(team, enemies) {
  const b = createBattle(team, enemies);
  let guard = 0;
  while (!b.over && guard++ < 5000) { stepBattle(b, 0.1); b.fx.length = 0; }
  return b;
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
