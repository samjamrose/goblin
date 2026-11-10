// Headless balance simulation: a greedy bot plays the game in fast-forward.
import { G } from '../src/game.js';
import { BIZ, BUILDINGS, DISTRICTS, RESEARCH, REGIONS, MISSIONS, STAGES_PER_REGION, PERKS } from '../src/data.js';
import { resolveInstant } from '../src/battlesim.js';
import { fmt, fmtTime } from '../src/util.js';

let T = Date.now();
G.now = () => T;
G.init(null);
const s = G.s;
const HOURS = +(process.argv[2] || 8);
const PRESTIGE = process.argv[3] !== 'noprestige';
const events = [];
const log = (m) => events.push(`[${fmtTime((T - start) / 1000)}] ${m}`);
const start = T;
G.on('levelup', l => { if (l <= 12 || l % 5 === 0) log(`Level ${l} | inc ${fmt(G.incomePerSec())}/s gold ${fmt(s.gold)} gobs ${s.goblins.length}`); });
G.on('build', id => log(`Built ${id}`));
G.on('district', id => log(`District ${id}`));
G.on('conquer', r => log(`CONQUERED ${r.id}`));
G.on('prestige', n => log(`PRESTIGE +${n} teeth (total ${s.teethEarned})`));
G.on('recruit', (g, info) => { if (G.rarityIdx(g.rarity) >= 2 && !info.dup) log(`Recruited ${g.rarity} ${g.name}`); });

function bestBuy() {
  let best = null;
  for (const b of BIZ) {
    if (!G.canBuildHere(b.id)) continue;
    const c = G.bizCost(b.id, 1);
    if (c > s.gold) continue;
    const before = G.buildingIncome(b.id, false);
    const lv = s.buildings[b.id].lvl;
    let after = before === 0 ? b.income * G.globalMult() : before * (lv + 1) / lv * G.milestoneMult(lv + 1) / G.milestoneMult(lv);
    const roi = (after - before + 1e-9) / c;
    if (!best || roi > best.roi) best = { id: b.id, roi };
  }
  return best;
}

let lastBattle = 0;
const totalSec = HOURS * 3600;
for (let sec = 0; sec < totalSec; sec++) {
  T += 1000;
  G.tick(1);
  if (sec % 5 === 0) G.slowTick();
  // pop bubbles (active player ~ 60%)
  for (const b of G.rt.bubbles.slice()) if (Math.random() < 0.15) G.popBubble(b.id);
  if (G.rt.golden && Math.random() < 0.1) G.catchGolden();
  if (G.rt.event) G.resolveEvent(Math.random() < 0.5 ? 0 : 1);
  for (const f of G.rt.fires.slice()) if (Math.random() < 0.3) { G.tapFire(f.id); G.tapFire(f.id); G.tapFire(f.id); }
  for (const r of G.rt.rats.slice()) if (Math.random() < 0.2) G.squashRat(r.id);
  if (G.rt.invasion && Math.random() < 0.05) G.autoDefend();
  // story
  while (G.storyQuest() && G.storyProgress() >= 1) G.claimStory();
  // districts
  for (const d of DISTRICTS) if (!s.districts[d.id] && s.level >= d.unlock && s.gold >= G.districtCost(d.id) * 1) G.unlockDistrict(d.id);
  // utils
  for (const b of BUILDINGS.filter(b => b.kind === 'util')) {
    if (!G.canBuildHere(b.id)) continue;
    const want = b.id === 'huts' ? G.housed() >= G.housing() - 1 : b.id === 'cauldron' ? s.buildings.cauldron.lvl < 5 : true;
    if (want && G.utilCost(b.id) < s.gold * 0.3) G.buy(b.id);
  }
  // research
  for (const r of RESEARCH) { if (!s.research[r.id]) G.doResearch(r.id); }
  // buy businesses
  for (let k = 0; k < 50; k++) { const bb = bestBuy(); if (!bb) break; G.buy(bb.id, 1); }
  // recruit & assign & train
  if (G.canRecruit() && s.mushrooms >= G.recruitCost()) G.recruit('basic');
  if (s.buildings.barracks.lvl > 0) { for (const g of G.defenders()) G.assign(g.uid, null); }
  if (s.gems >= 300) G.recruit('premium');
  for (const b of BIZ) if (G.isBuilt(b.id)) G.autoAssign(b.id);
  if (sec % 10 === 0) {
    const gobs = s.goblins.slice().sort((a, b) => G.goblinPower(b) - G.goblinPower(a)).slice(0, 6);
    for (const g of gobs) if (s.mushrooms > G.trainCost(g) * 3) G.train(g.uid, 1);
  }
  if (s.buildings.barracks.lvl > 0) {
    const free = s.goblins.filter(g => !g.assign).sort((a, b) => G.goblinPower(b) - G.goblinPower(a));
    while (G.defenders().length < G.defenderSlots() && free.length) G.assign(free.shift().uid, { t: 'def' });
  }
  // expeditions
  for (const e of s.expeditions.slice()) if (T >= e.end && !e.claimed) G.claimExpedition(e.id);
  if (s.buildings.lodge.lvl > 0 && G.activeExpeditions().length < G.expSlots()) {
    const open = REGIONS.filter(r => G.regionOpen(r));
    if (open.length) {
      const free = s.goblins.filter(g => !g.assign || g.assign.t !== 'exp').sort((a, b) => G.goblinPower(b) - G.goblinPower(a)).slice(4, 7);
      if (free.length) {
        let best = null;
        for (const r of open) for (const m of MISSIONS.slice(0, 3)) {
          const ch = G.expChance(r.id, m.id, free.map(g => g.uid));
          if (ch > 0.6 && (!best || m.loot * (REGIONS.indexOf(r) + 1) > best.v)) best = { r: r.id, m: m.id, v: m.loot * (REGIONS.indexOf(r) + 1) };
        }
        if (best) G.startExpedition(best.r, best.m, free.map(g => g.uid));
      }
    }
  }
  // battles every 20s
  if (sec - lastBattle > 20) {
    lastBattle = sec;
    for (const r of REGIONS) {
      if (!G.regionOpen(r)) continue;
      const st = G.regionStage(r.id);
      if (st >= STAGES_PER_REGION) continue;
      const team = G.battleTeam().map(g => G.goblinCombat(g));
      const b = resolveInstant(team, G.battleSetup(r.id, st + 1));
      // player taps/bombs add ~25%
      const team2 = team.map(u => ({ ...u, atk: u.atk * 1.25 }));
      const b2 = resolveInstant(team2, G.battleSetup(r.id, st + 1));
      G.finishBattle(r.id, st + 1, b2.winner === 'g');
      if (b2.winner === 'g' && (st + 1) % 5 === 0) log(`Cleared ${r.id} stage ${st + 1} (team power ${fmt(G.battleTeam().reduce((t, g) => t + G.goblinPower(g), 0))})`);
      break;
    }
  }
  // prestige when gain >= 50% of earned or big
  if (PRESTIGE && G.canPrestige() && G.teethGain() >= Math.max(30, s.teethEarned * 1.0)) {
    G.prestige();
    for (const p of PERKS) while (G.buyPerk(p.id)) { }
  }
  if (process.env.DBG && [30, 60, 90, 120, 180, 300, 600].includes(sec)) log(`t${sec} L${s.level} gm ${G.globalMult().toFixed(2)} ` + BIZ.filter(b => G.isBuilt(b.id)).map(b => `${b.id}:${s.buildings[b.id].lvl} inc ${fmt(G.buildingIncome(b.id))} wm ${G.workerMult(b.id).toFixed(2)} ab ${G.abilitySum('bmult', b.id)}`).join(' | ') + ` research ${Object.keys(s.research)} gobs ${s.goblins.map(g => g.rarity[0] + g.lvl).join(',')} buffs ${s.buffs.map(b => b.kind + b.mult)}`);
  if (sec % 3600 === 0 && sec > 0) log(`== hour ${sec / 3600}: level ${s.level}, inc ${fmt(G.incomePerSec())}/s, gobs ${s.goblins.length}, best ${G.bestRarity()}, teeth ${s.teethEarned}, gems ${s.gems}, mush ${fmt(s.mushrooms)} ore ${fmt(s.ore)} research ${Object.keys(s.research).length}, regions ${REGIONS.map(r => G.regionStage(r.id)).join(',')}, inv ${s.stats.invasionsWon}/${s.stats.invasionsLost}`);
}
console.log(events.join('\n'));
console.log('Buildings:', BIZ.map(b => b.id + ':' + s.buildings[b.id].lvl).join(' '));
console.log('Achievements', Object.keys(s.achievements).length, 'story', s.story);
