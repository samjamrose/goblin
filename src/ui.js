// DOM user interface: HUD, bottom sheet panels, modals, toasts.
import {
  RARITIES, JOBS, TRAITS, BUILDINGS, BUILDING_BY_ID, BIZ, DISTRICTS, DISTRICT_BY_ID, REGIONS, REGION_BY_ID, STAGES_PER_REGION,
  MISSIONS, TREASURES, TREASURE_SETS, RESEARCH, PERKS, NAMED, NAMED_BY_ID, ABILITY_TEXT, DAILY_TEMPLATES, STORY, ACHIEVEMENTS,
  LOGIN_REWARDS, PRESTIGE_MIN_GOLD, xpForLevel, ENEMIES, MILESTONES, RANKS, TILE,
} from './data.js';
import { fmt, fmtTime, clamp, pct } from './util.js';
import { icon, iconImg, goblinPortrait, buildingSprite, enemySprite, makeCanvas, GOB_W, GOB_H, goblinSheet } from './sprites.js';
import { sfx, setSfx, setMusic, unlockAudio } from './audio.js';

const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const RES_ICON = { gold: 'coin', mushrooms: 'shroom', ore: 'ore', gems: 'gem', teeth: 'tooth' };
const JOB_ICON = { miner: 'pick', farmer: 'shroom', brewer: 'mug', smith: 'hammer', alchemist: 'potion', merchant: 'bag', gambler: 'dice', thief: 'dagger', warrior: 'sword', builder: 'hammer', scout: 'map' };

const thumbCache = {};
function bThumb(id, tier) {
  const k = id + tier;
  if (thumbCache[k]) return thumbCache[k];
  const b = BUILDING_BY_ID[id];
  const spr = buildingSprite(id, b.w, b.h, tier);
  // crop to the drawn pixels so the thumbnail fills its box
  const d = spr.getContext('2d').getImageData(0, 0, spr.width, spr.height).data;
  let x0 = spr.width, y0 = spr.height, x1 = 0, y1 = 0;
  for (let y = 0; y < spr.height; y++) for (let x = 0; x < spr.width; x++) if (d[(y * spr.width + x) * 4 + 3] > 40) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 < x0) { x0 = 0; y0 = 0; x1 = spr.width - 1; y1 = spr.height - 1; }
  const w = x1 - x0 + 1, h = y1 - y0 + 1, side = Math.max(w, h) + 2;
  const c = makeCanvas(side * 3, side * 3);
  const ctx = c.getContext('2d'); ctx.imageSmoothingEnabled = false;
  ctx.drawImage(spr, x0, y0, w, h, (side - w) / 2 * 3, (side - h) * 3 - 3, w * 3, h * 3);
  return (thumbCache[k] = c.toDataURL());
}
const enemyThumbCache = {};
function eThumb(kind, tint, boss) {
  const k = kind + tint + boss;
  if (enemyThumbCache[k]) return enemyThumbCache[k];
  const s = enemySprite(kind, tint, boss);
  const c = makeCanvas(64, 64); const ctx = c.getContext('2d'); ctx.imageSmoothingEnabled = false;
  ctx.drawImage(s, 0, 0, 64, 64);
  return (enemyThumbCache[k] = c.toDataURL());
}
function costHtml(cost, have) {
  return Object.entries(cost).map(([k, v]) => `<span class="${have && have[k] < v ? 'red-t' : ''}">${iconImg(RES_ICON[k] || 'coin')} ${fmt(v)}</span>`).join(' ');
}

export class UI {
  constructor(G, world, battle) {
    this.G = G; this.world = world; this.battle = battle;
    this.sheet = $('#sheet'); this.body = $('#sheet-body'); this.tabsEl = $('#sheet-tabs'); this.titleEl = $('#sheet-title');
    this.modalEl = $('#modal'); this.modalBox = $('#modal-box');
    this.view = null;
    this.stack = [];
    this.binds = new Map(); this.bindId = 0;
    this.buyAmt = 1;
    this.rosterSort = 'power';
    this.modalQueue = [];
    this.lastHud = {};
  }

  init() {
    document.querySelectorAll('img[data-icon]').forEach(img => { img.src = icon(img.dataset.icon); });
    $('#h-gear').innerHTML = `<img src="${icon('gear')}">`;
    document.querySelectorAll('#nav button').forEach(b => b.addEventListener('click', () => {
      unlockAudio(); sfx('tap');
      if (this.view && this.view.tab === b.dataset.tab && this.sheet.classList.contains('open')) this.closeSheet();
      else this.openTab(b.dataset.tab);
    }));
    document.addEventListener('click', e => {
      const el = e.target.closest('[data-act]');
      if (!el) return;
      unlockAudio();
      const fn = this.acts[el.dataset.act];
      if (fn) { e.stopPropagation(); fn.call(this, el, e); }
    });
    $('#st-btn').addEventListener('click', () => this.storyGo());
    $('#modal .modal-back').addEventListener('click', () => { if (this.modalDismissable) this.closeModal(); });
    // swipe down to close sheet
    let sy = null;
    $('.sheet-head').addEventListener('pointerdown', e => { sy = e.clientY; });
    window.addEventListener('pointerup', e => { if (sy !== null && e.clientY - sy > 60) this.closeSheet(); sy = null; });
  }

  // ------------------------------------------------------------ binding helpers
  b(fn) { const id = 'b' + (++this.bindId); this.binds.set(id, fn); return `data-b="${id}"`; }
  refresh() {
    if (!this.sheet.classList.contains('open') && !this.modalEl.classList.contains('open')) return;
    for (const el of document.querySelectorAll('[data-b]')) {
      const fn = this.binds.get(el.dataset.b);
      if (fn) try { fn(el); } catch (e) { console.warn(e); }
    }
  }
  pruneBinds() {
    const live = new Set([...document.querySelectorAll('[data-b]')].map(el => el.dataset.b));
    for (const k of [...this.binds.keys()]) if (!live.has(k)) this.binds.delete(k);
  }
  setBody(html) {
    const st = this.body.scrollTop;
    this.body.innerHTML = html;
    this.body.scrollTop = this.keepScroll ? st : 0;
    this.keepScroll = false;
    this.pruneBinds();
    this.refresh();
  }

  // ------------------------------------------------------------ sheet / navigation
  openTab(tab, sub, param) {
    this.stack = [];
    this.show({ tab, sub, param });
    document.querySelectorAll('#nav button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
  }
  show(v, push) {
    if (push && this.view) this.stack.push(this.view);
    this.view = v;
    this.sheet.classList.add('open');
    document.getElementById('app').classList.add('sheet-open');
    this.sheet.setAttribute('aria-hidden', 'false');
    this.render();
  }
  back() { const v = this.stack.pop(); if (v) { this.view = v; this.render(); } else this.closeSheet(); }
  closeSheet() {
    this.sheet.classList.remove('open');
    document.getElementById('app').classList.remove('sheet-open');
    this.sheet.setAttribute('aria-hidden', 'true');
    document.querySelectorAll('#nav button').forEach(b => b.classList.remove('on'));
    this.world.pointer = null;
    this.view = null;
  }
  rerender(keep = true) { if (this.view && this.sheet.classList.contains('open')) { this.keepScroll = keep; this.render(); } }
  tabs(list, cur, tab) {
    this.tabsEl.innerHTML = list.map(([id, label, dot]) => `<button class="stab ${id === cur ? 'on' : ''}" data-act="sub" data-tab="${tab}" data-sub="${id}">${label}${dot ? '<i class="dot"></i>' : ''}</button>`).join('');
  }
  title(t) {
    this.titleEl.innerHTML = (this.stack.length ? `<button class="ibtn close" data-act="back" style="display:inline-grid;margin-right:6px;vertical-align:middle">‹</button>` : '') + t;
  }
  render() {
    const v = this.view; if (!v) return;
    const fn = {
      build: this.pBuild, building: this.pBuilding, goblins: this.pGoblins, explore: this.pExplore, region: this.pRegion,
      quests: this.pQuests, more: this.pMore,
    }[v.tab];
    if (fn) fn.call(this, v.sub, v.param);
  }

  // ------------------------------------------------------------ BUILD
  pBuild(sub = 'biz') {
    const G = this.G;
    this.title('Build & Upgrade');
    const resDot = G.isBuilt('research') && RESEARCH.some(r => !G.s.research[r.id] && G.s.level >= r.lvl && G.s.gold >= G.researchCost(r).gold && G.s.ore >= G.researchCost(r).ore);
    const distDot = DISTRICTS.some(d => !G.s.districts[d.id] && G.s.level >= d.unlock && G.s.gold >= G.districtCost(d.id));
    this.tabs([['biz', 'Businesses'], ['util', 'Utilities'], ['research', 'Research', resDot], ['districts', 'Districts', distDot]], sub, 'build');
    if (sub === 'research') return this.pResearch();
    if (sub === 'districts') return this.pDistricts();
    let h = '';
    if (sub === 'biz') {
      h += `<div class="amt">${[1, 10, 100, 'max'].map(a => `<button class="${this.buyAmt === a ? 'on' : ''}" data-act="amt" data-v="${a}">${a === 'max' ? 'MAX' : '×' + a}</button>`).join('')}</div>`;
      h += `<div class="small muted center" style="margin:-2px 0 8px">Every milestone level (${MILESTONES.slice(0, 4).join(', ')}...) doubles a building's income!</div>`;
      for (const b of BIZ) h += this.bizCard(b);
    } else {
      for (const b of BUILDINGS.filter(b => b.kind === 'util')) h += this.utilCard(b);
    }
    this.setBody(h);
  }
  bizCard(b) {
    const G = this.G, st = G.s.buildings[b.id];
    const open = G.districtOpen(b.district), lvlOk = G.s.level >= b.unlock;
    if (!open || !lvlOk) {
      return `<div class="card lock row"><div class="thumb"><img src="${bThumb(b.id, 0)}" style="filter:brightness(.3)"></div><div class="grow"><div class="bname">${b.name}</div>
        <div class="bsub">${!lvlOk ? `🔒 Requires Capital Level ${b.unlock}` : `🔒 Unlock the ${DISTRICT_BY_ID[b.district].name} district`}</div></div></div>`;
    }
    const nm = G.nextMilestone(st.lvl);
    const prevM = [0, ...MILESTONES].filter(m => m <= st.lvl).pop() || 0;
    return `<div class="card row" data-act="open-building" data-id="${b.id}">
      <div class="thumb"><img src="${bThumb(b.id, G.tier(b.id))}"></div>
      <div class="grow">
        <div class="bname">${b.name} <span class="tag">Lv ${st.lvl}</span></div>
        <div class="bsub" ${this.b(el => { el.innerHTML = st.lvl ? `${iconImg('coin')} ${fmt(G.buildingIncome(b.id))}/s · ${G.workers(b.id).length}/${G.workerSlots(b.id)} ${iconImg('goblin')}${G.s.damaged[b.id] ? ' · <span class="red-t">Damaged!</span>' : ''}` : `Earns ${fmt(b.income * G.globalMult())}/s at Lv 1`; })}></div>
        ${nm ? `<div class="pb"><i style="width:${((st.lvl - prevM) / (nm - prevM) * 100).toFixed(0)}%"></i></div><div class="small muted">Next ×2 at Lv ${nm}</div>` : ''}
      </div>
      <button class="btn buybtn" data-act="buy" data-id="${b.id}" ${this.b(el => this.buyBtn(el, b))}></button>
    </div>`;
  }
  buyBtn(el, b) {
    const G = this.G, st = G.s.buildings[b.id];
    if (G.isConstructing(b.id)) { el.className = 'btn buybtn off'; el.innerHTML = 'Building...'; return; }
    let n = this.buyAmt === 'max' ? Math.max(1, G.maxAffordable(b.id)) : this.buyAmt;
    if (st.lvl === 0) n = 1;
    const c = G.bizCost(b.id, n);
    const ok = G.s.gold >= c;
    el.className = 'btn buybtn' + (ok ? '' : ' no');
    el.dataset.n = n;
    el.innerHTML = `${st.lvl === 0 ? 'BUILD' : 'UP ×' + n}<small>${iconImg('coin')}${fmt(c)}</small>`;
  }
  utilCard(b) {
    const G = this.G, st = G.s.buildings[b.id];
    const open = G.districtOpen(b.district), lvlOk = G.s.level >= b.unlock;
    if (!open || !lvlOk) return `<div class="card lock row"><div class="thumb"><img src="${bThumb(b.id, 0)}" style="filter:brightness(.3)"></div><div class="grow"><div class="bname">${b.name}</div><div class="bsub">${!lvlOk ? `🔒 Requires Capital Level ${b.unlock}` : `🔒 Unlock ${DISTRICT_BY_ID[b.district].name}`}</div></div></div>`;
    const max = b.maxLvl && st.lvl >= b.maxLvl;
    return `<div class="card row" data-act="open-building" data-id="${b.id}">
      <div class="thumb"><img src="${bThumb(b.id, G.tier(b.id))}"></div>
      <div class="grow"><div class="bname">${b.name} ${st.lvl ? `<span class="tag">Lv ${st.lvl}${b.maxLvl ? '/' + b.maxLvl : ''}</span>` : ''}</div><div class="bsub">${this.utilEffect(b.id)}</div></div>
      ${max ? '<span class="tag">MAX</span>' : `<button class="btn buybtn" data-act="buy" data-id="${b.id}" ${this.b(el => { const c = G.utilCost(b.id); el.className = 'btn buybtn' + (G.s.gold >= c ? '' : ' no') + (G.isConstructing(b.id) ? ' off' : ''); el.innerHTML = `${st.lvl ? 'UPGRADE' : 'BUILD'}<small>${iconImg('coin')}${fmt(c)}</small>`; })}></button>`}
    </div>`;
  }
  utilEffect(id) {
    const G = this.G, l = G.s.buildings[id].lvl;
    switch (id) {
      case 'cauldron': return `Recruit goblins. Luck bonus: +${Math.round(G.luck() * 100)}%`;
      case 'huts': return `Housing: ${G.housed()}/${G.housing()} goblins (named heroes bring their own tents)`;
      case 'lodge': return l ? `${G.expSlots()} expedition slot(s), +${(l - 1) * 10}% loot` : 'Unlocks Expeditions';
      case 'research': return l ? `${Object.keys(G.s.research).length}/${RESEARCH.length} researched` : 'Unlocks Research';
      case 'barracks': return l ? `${G.defenderSlots()} defender slots · +${l * 15}% defense` : 'Defend against invasions';
      case 'tower': return l ? `+${l * 10}% defense HP · +${l * 5}% golden goblins` : 'Spot invaders, attract gold';
    }
    return '';
  }

  pResearch() {
    const G = this.G;
    if (!G.isBuilt('research')) return this.setBody(`<div class="card paper center"><p>Build the <b>Tinker Shed</b> in the Market Ward (Capital Lv 6) to unlock goblin science!</p></div>`);
    let h = `<p class="small muted center">Goblin science: permanent upgrades for this run. ${iconImg('ore')} Ore comes from the Gold Mine and Smithy.</p>`;
    const list = RESEARCH.slice().sort((a, b) => (!!G.s.research[a.id] - !!G.s.research[b.id]) || a.lvl - b.lvl);
    for (const r of list) {
      const done = G.s.research[r.id], c = G.researchCost(r), lock = G.s.level < r.lvl;
      h += `<div class="card row ${done ? 'lock' : ''}"><div class="thumb" style="width:44px;height:44px"><img src="${icon('flask')}" style="width:30px"></div>
        <div class="grow"><div class="bname" style="font-size:14px">${r.name}</div><div class="bsub">${r.desc}</div></div>
        ${done ? '<span class="tag green-t">DONE</span>' : lock ? `<span class="tag">Lv ${r.lvl}</span>` :
        `<button class="btn buybtn small" data-act="research" data-id="${r.id}" ${this.b(el => { el.className = 'btn buybtn small' + (G.s.gold >= c.gold && G.s.ore >= c.ore ? '' : ' no'); })}>RESEARCH<small>${costHtml({ gold: c.gold })}</small><small>${costHtml({ ore: c.ore })}</small></button>`}
      </div>`;
    }
    this.setBody(h);
  }
  pDistricts() {
    const G = this.G;
    let h = `<p class="small muted center">Expand your capital! New districts hold new buildings.</p>`;
    for (const d of DISTRICTS) {
      const open = G.s.districts[d.id];
      const blds = BUILDINGS.filter(b => b.district === d.id).map(b => b.name).join(', ');
      h += `<div class="card ${open ? '' : ''}"><div class="row"><div class="grow"><div class="bname">${open ? '' : '🔒 '}${d.name}</div><div class="bsub">${d.desc}</div><div class="small" style="margin-top:4px">${blds}</div></div>
        ${open ? `<button class="btn small ghost" data-act="goto" data-x="${d.x + d.w / 2}" data-y="${d.y + d.h / 2}">View</button>` : G.s.level < d.unlock ? `<span class="tag">Lv ${d.unlock}</span>` :
        `<button class="btn buybtn" data-act="district" data-id="${d.id}" ${this.b(el => el.classList.toggle('no', G.s.gold < G.districtCost(d.id)))}>UNLOCK<small>${iconImg('coin')}${fmt(G.districtCost(d.id))}</small></button>`}
      </div></div>`;
    }
    this.setBody(h);
  }

  // ------------------------------------------------------------ BUILDING DETAIL
  pBuilding(_, id) {
    const G = this.G, b = BUILDING_BY_ID[id], st = G.s.buildings[id];
    this.title(b.name);
    this.tabsEl.innerHTML = '';
    let h = `<div class="row" style="align-items:flex-start"><div class="thumb" style="width:96px;height:96px"><img src="${bThumb(id, G.tier(id))}"></div>
      <div class="grow"><p class="small" style="margin-top:0">${b.desc}</p>
      ${st.lvl ? `<span class="tag">Level ${st.lvl}</span> ` : ''}${b.job ? `<span class="tag">${iconImg(JOB_ICON[b.job])} Best job: ${JOBS[b.job].name}</span>` : ''}</div></div>`;
    if (G.s.damaged[id]) h += `<div class="card" style="background:#5a2a2a"><div class="row"><div class="grow">🔥 <b>Damaged!</b> Income halved. Auto-repairs in ${fmtTime((G.s.damaged[id] - G.now()) / 1000)}.</div><button class="btn small" data-act="repair" data-id="${id}">Repair ${iconImg('coin')}${fmt(G.repairCost(id))}</button></div></div>`;
    if (b.kind === 'biz') {
      if (st.lvl === 0) {
        if (!G.canBuildHere(id)) h += `<div class="card paper center">🔒 Requires Capital Level ${b.unlock} and the ${DISTRICT_BY_ID[b.district].name}.</div>`;
        else h += `<div class="card center"><p>Build it to start earning <b class="gold-t">${fmt(b.income * G.globalMult())}/s</b>!</p><button class="btn gold wide" data-act="buy" data-id="${id}" data-n="1" ${this.b(el => el.classList.toggle('no', G.s.gold < G.bizCost(id, 1)))}>BUILD · ${iconImg('coin')}${fmt(G.bizCost(id, 1))}</button></div>`;
      } else {
        const nm = G.nextMilestone(st.lvl);
        h += `<div class="stat-grid">
          <div class="stat">Income<b ${this.b(el => el.textContent = fmt(G.buildingIncome(id)) + '/s')}></b></div>
          <div class="stat">Workers bonus<b ${this.b(el => el.textContent = '×' + G.workerMult(id).toFixed(2))}></b></div>
          <div class="stat">Milestone bonus<b>×${fmt(G.milestoneMult(st.lvl))}</b></div>
          <div class="stat">Next milestone<b>${nm ? 'Lv ' + nm : 'MAX'}</b></div>
          ${b.res ? `<div class="stat">Also produces<b>${b.res.mushrooms ? fmt(G.mushroomRate()) + ' 🍄/s' : fmt(G.oreRate()) + ' ore/s (total)'}</b></div>` : ''}
          ${b.variance ? `<div class="stat">Luck right now<b ${this.b(el => el.textContent = '×' + G.rt.casinoMult.toFixed(2))}></b></div>` : ''}
        </div>`;
        h += `<h3>Upgrade</h3><div class="row">${[1, 10, 'max'].map(n => `<button class="btn grow buybtn" data-act="buy" data-id="${id}" data-n="${n}" ${this.b(el => {
          const k = n === 'max' ? Math.max(1, G.maxAffordable(id)) : n; const c = G.bizCost(id, k); el.classList.toggle('no', G.s.gold < c);
          el.innerHTML = `${n === 'max' ? 'MAX ×' + k : '×' + n}<small>${iconImg('coin')}${fmt(c)}</small>`;
        })}></button>`).join('')}</div>`;
        h += this.workerSlotsHtml(id);
      }
    } else {
      h += this.utilDetail(id);
    }
    this.setBody(h);
  }
  workerSlotsHtml(id) {
    const G = this.G, b = BUILDING_BY_ID[id];
    const slots = G.workerSlots(id), ws = G.workers(id);
    let h = `<h3>Workers (${ws.length}/${slots})</h3><p class="small muted" style="margin-top:0">${JOBS[b.job].name}s work best here (full bonus). Others give 40%. More slots at Lv 25, 50, 100.</p><div class="slots">`;
    for (let i = 0; i < 4; i++) {
      const g = ws[i];
      if (i >= slots) { h += `<div class="slot" style="opacity:.35">🔒<small>Lv ${[1, 25, 50, 100][i]}</small></div>`; continue; }
      if (g) h += `<div class="slot r-${g.rarity}" data-act="unassign" data-uid="${g.uid}" style="box-shadow:inset 0 0 0 2px var(--rc)"><img src="${goblinPortrait(g.look, 2)}"><span class="x">✕</span><small>+${Math.round(G.workerBonus(g, b) * 100)}%</small></div>`;
      else h += `<div class="slot" data-act="assign-slot" data-id="${id}">+<small>Assign</small></div>`;
    }
    h += `</div>`;
    if (ws.length < slots && G.s.goblins.some(g => !g.assign)) h += `<button class="btn small blue" style="margin-top:8px" data-act="auto-assign" data-id="${id}">Auto-assign best idle goblin</button>`;
    return h;
  }
  utilDetail(id) {
    const G = this.G, b = BUILDING_BY_ID[id], st = G.s.buildings[id];
    let h = `<div class="card"><div class="bsub">${this.utilEffect(id)}</div></div>`;
    if (!G.canBuildHere(id)) return h + `<div class="card paper center">🔒 Requires Capital Level ${b.unlock} and the ${DISTRICT_BY_ID[b.district].name}.</div>`;
    if (!(b.maxLvl && st.lvl >= b.maxLvl)) {
      h += `<button class="btn gold wide" data-act="buy" data-id="${id}" ${this.b(el => { const c = G.utilCost(id); el.classList.toggle('no', G.s.gold < c); el.innerHTML = `${st.lvl ? 'UPGRADE to Lv ' + (st.lvl + 1) : 'BUILD'} · ${iconImg('coin')}${fmt(c)}`; })}></button>`;
    }
    if (!st.lvl) return h;
    if (id === 'cauldron') h += `<div style="margin-top:10px"><button class="btn purple wide" data-act="tab" data-tab="goblins" data-sub="recruit">${iconImg('goblin')} Recruit Goblins</button></div>`;
    if (id === 'lodge') h += `<div style="margin-top:10px"><button class="btn blue wide" data-act="tab" data-tab="explore" data-sub="exped">${iconImg('map')} Plan Expeditions</button></div>`;
    if (id === 'research') h += `<div style="margin-top:10px"><button class="btn blue wide" data-act="tab" data-tab="build" data-sub="research">${iconImg('flask')} Open Research</button></div>`;
    if (id === 'barracks' || id === 'tower') h += `<div style="margin-top:10px"><button class="btn red wide" data-act="tab" data-tab="explore" data-sub="defense">${iconImg('shield')} Manage Defense</button></div>`;
    return h;
  }

  // ------------------------------------------------------------ GOBLINS
  pGoblins(sub = 'roster') {
    const G = this.G;
    this.title(`Goblins <span class="small muted">${G.housed()}/${G.housing()} housed</span>`);
    const canRec = G.s.mushrooms >= G.recruitCost() || G.s.tickets > 0;
    this.tabs([['roster', 'Roster'], ['recruit', 'Recruit', canRec], ['codex', 'Codex'], ['gear', 'Gear'], ['treasures', 'Treasures']], sub, 'goblins');
    if (sub === 'recruit') return this.pRecruit();
    if (sub === 'codex') return this.pCodex();
    if (sub === 'gear') return this.pGear();
    if (sub === 'treasures') return this.pTreasures();
    const sorts = { power: (a, b) => G.goblinPower(b) - G.goblinPower(a), rarity: (a, b) => G.rarityIdx(b.rarity) - G.rarityIdx(a.rarity) || b.lvl - a.lvl, level: (a, b) => b.lvl - a.lvl, idle: (a, b) => (!!a.assign - !!b.assign) };
    const list = G.s.goblins.slice().sort(sorts[this.rosterSort]);
    let h = `<div class="amt">${Object.keys(sorts).map(k => `<button class="${this.rosterSort === k ? 'on' : ''}" data-act="sort" data-v="${k}">${k[0].toUpperCase() + k.slice(1)}</button>`).join('')}</div>`;
    const idle = G.s.goblins.filter(g => !g.assign).length;
    if (idle) h += `<div class="card paper small center" style="padding:6px">${idle} idle goblin${idle > 1 ? 's' : ''} — assign them to buildings to boost income! <button class="btn tiny blue" data-act="auto-all">Auto-assign all</button></div>`;
    h += `<div class="gcards">${list.map(g => this.gcard(g)).join('')}</div>`;
    this.setBody(h);
  }
  assignLabel(g) {
    if (!g.assign) return '<span class="st">Idle</span>';
    if (g.assign.t === 'b') return `<span class="st work">${BUILDING_BY_ID[g.assign.id].name.split(' ').slice(-1)[0]}</span>`;
    if (g.assign.t === 'def') return '<span class="st work">Defending</span>';
    if (g.assign.t === 'exp') return '<span class="st" style="color:var(--blue)">Exploring</span>';
    return '';
  }
  gcard(g, act = 'goblin', extra = '') {
    const ri = this.G.rarityIdx(g.rarity);
    return `<div class="gcard r-${g.rarity} ${ri >= 3 ? 'myth-glow' : ''} ${extra}" data-act="${act}" data-uid="${g.uid}">
      <span class="lv">${g.lvl}</span><img class="job" src="${icon(JOB_ICON[g.job])}">
      <img class="por" src="${goblinPortrait(g.look, 3)}">
      <div class="stars">${'★'.repeat(g.stars || 0)}</div>
      <div class="nm">${esc(g.name)}</div>${this.assignLabel(g)}</div>`;
  }

  goblinModal(uid) {
    const G = this.G, g = G.gob(uid); if (!g) return;
    const R = RARITIES[G.rarityIdx(g.rarity)], tr = TRAITS[g.trait], named = g.named ? NAMED_BY_ID[g.named] : null;
    const cost = G.trainCost(g), max = G.maxLvl(g);
    const w = g.gear.w ? G.item(g.gear.w) : null, t = g.gear.t ? G.item(g.gear.t) : null;
    let assignTxt = 'Idle';
    if (g.assign?.t === 'b') assignTxt = 'Working at ' + BUILDING_BY_ID[g.assign.id].name;
    if (g.assign?.t === 'def') assignTxt = 'Defending the capital';
    if (g.assign?.t === 'exp') assignTxt = 'Away on an expedition';
    const h = `<div class="r-${g.rarity}">
      <img class="big-por" src="${goblinPortrait(g.look, 6)}" style="width:120px;height:130px">
      <div class="rt">${R.name.toUpperCase()} ${'★'.repeat(g.stars || 0)}</div>
      <h2 style="margin:2px 0">${esc(g.name)}</h2>
      <div class="small muted">${JOBS[g.job].name} · ${tr.name} · Level ${g.lvl}/${max}</div>
      ${named ? `<p class="small"><i>"${named.bio}"</i></p><div class="card small"><b>Ability:</b> ${ABILITY_TEXT[named.ability.type](named.ability)}${g.stars ? ` (+${g.stars * 25}% from stars)` : ''}</div>` : ''}
      <div class="card small">${tr.desc}</div>
      <div class="stat-grid">
        <div class="stat">Power<b>${fmt(G.goblinPower(g))}</b></div>
        <div class="stat">Work bonus<b>+${Math.round(G.workerBonus(g, { job: g.job }) * 100)}%</b></div>
      </div>
      <p class="small"><b>${assignTxt}</b></p>
      ${g.lvl < max ? `<div class="row"><button class="btn grow" data-act="train" data-uid="${uid}" data-n="1" ${this.b(el => { const c = G.trainCost(g); el.classList.toggle('no', G.s.mushrooms < c); el.innerHTML = `Train ${iconImg('shroom')}${fmt(c)}`; })}></button>
        <button class="btn grow" data-act="train" data-uid="${uid}" data-n="10">Train ×10</button></div>` : '<p class="green-t"><b>Max level!</b> Duplicates add stars (+5 max level).</p>'}
      <h3>Gear</h3>
      <div class="row">
        <div class="card grow small" data-act="gear-pick" data-uid="${uid}" data-slot="w" style="margin:0">${iconImg('sword')} ${w ? `<span class="rt r-${w.rarity}">${esc(w.name)}</span><br>+${pct(w.atk)} atk +${pct(w.hp)} hp` : '<span class="muted">Weapon: none</span>'}</div>
        <div class="card grow small" data-act="gear-pick" data-uid="${uid}" data-slot="t" style="margin:0">${iconImg('star')} ${t ? `<span class="rt r-${t.rarity}">${esc(t.name)}</span><br>+${pct(t.prod)} work +${pct(t.luck)} luck` : '<span class="muted">Trinket: none</span>'}</div>
      </div>
      <h3>Job</h3>
      <div class="row wrap" style="justify-content:center">
        ${g.assign?.t === 'exp' ? '<span class="muted small">Busy exploring.</span>' : `
        <button class="btn small blue" data-act="assign-pick" data-uid="${uid}">Assign to building</button>
        ${G.isBuilt('barracks') ? `<button class="btn small red" data-act="assign-def" data-uid="${uid}">Defend</button>` : ''}
        ${g.assign ? `<button class="btn small ghost" data-act="unassign" data-uid="${uid}">Make idle</button>` : ''}`}
      </div>
      <div class="modal-actions"><button class="btn ghost" data-act="close-modal">Close</button>${g.assign?.t !== 'exp' && G.s.goblins.length > 1 ? `<button class="btn small red" data-act="dismiss" data-uid="${uid}">Dismiss</button>` : ''}</div>
    </div>`;
    this.modal(h, { dark: true, dismissable: true, keep: 'goblin:' + uid });
  }

  pRecruit() {
    const G = this.G;
    const full = !G.canRecruit();
    const R = RARITIES;
    const L = G.luck();
    let h = `<div class="card center" style="background:linear-gradient(#3a2a4a,#2a1a30)">
      <img src="${bThumb('cauldron', G.tier('cauldron'))}" style="width:130px">
      <p class="small">Toss stuff in the Summoning Cauldron. Goblins come out. Nobody knows why.</p>
      ${full ? `<p class="small red-t">Housing full! New Common/Rare goblins will leave (with a tip). Named Epic+ heroes always stay. Upgrade the Mud Huts!</p>` : ''}
      <div class="row" style="margin-top:8px">
        <button class="btn grow buybtn" data-act="recruit" data-mode="basic" ${this.b(el => { const c = G.recruitCost(); el.classList.toggle('no', G.s.mushrooms < c); el.innerHTML = `Mushroom Recruit<small>${iconImg('shroom')}${fmt(c)}</small>`; })}></button>
        <button class="btn purple grow buybtn" data-act="recruit" data-mode="premium" ${this.b(el => el.classList.toggle('no', G.s.gems < G.premiumCost()))}>Gem Recruit<small>${iconImg('gem')}${G.premiumCost()} · Rare+</small></button>
      </div>
      ${G.s.tickets > 0 ? `<button class="btn gold wide" style="margin-top:8px" data-act="recruit" data-mode="ticket">${iconImg('ticket')} Use Golden Ticket (${G.s.tickets}) · Legendary+!</button>` : ''}
      <p class="small muted">Luck bonus +${Math.round(L * 100)}% · Legendary guaranteed within ${120 - (G.s.pity.basic || 0)} mushroom / ${25 - (G.s.pity.premium || 0)} gem recruits</p>
    </div>
    <h3>Odds (Mushroom)</h3><div class="row wrap small">${[70, 24, 5, 0.9, 0.1].map((w, i) => `<span class="tag r-${R[i].id}"><span class="rt">${R[i].name}</span> ${w}%</span>`).join(' ')}</div>
    <h3>Odds (Gems)</h3><div class="row wrap small">${[0, 60, 30, 8.5, 1.5].map((w, i) => w ? `<span class="tag r-${R[i].id}"><span class="rt">${R[i].name}</span> ${w}%</span>` : '').join(' ')}</div>
    <p class="small muted">Epic, Legendary and Mythical goblins are unique named heroes with special abilities. Duplicates give them stars!</p>`;
    this.setBody(h);
  }
  pCodex() {
    const G = this.G;
    const found = NAMED.filter(n => G.s.codex[n.id]).length;
    let h = `<p class="center small">Discovered <b class="gold-t">${found}/${NAMED.length}</b> legendary goblins</p><div class="gcards">`;
    for (const n of NAMED) {
      const has = G.s.codex[n.id];
      const own = G.s.goblins.find(g => g.named === n.id);
      h += `<div class="gcard r-${n.rarity} ${has ? '' : 'sil'}" data-act="${has ? 'codex' : ''}" data-id="${n.id}"><img class="por" src="${goblinPortrait(n.look, 3)}"><div class="stars">${own ? '★'.repeat(own.stars || 0) : ''}</div><div class="nm">${has ? esc(n.name) : '???'}</div><div class="st rt">${RARITIES[G.rarityIdx(n.rarity)].name}</div></div>`;
    }
    this.setBody(h + '</div>');
  }
  pGear() {
    const G = this.G;
    let h = `<p class="small muted center">Weapons boost combat. Trinkets boost work and loot luck. Equip from a goblin's profile. Forge new gear at the Scrap Smithy!</p>`;
    if (G.isBuilt('smithy')) h += `<button class="btn gold wide" data-act="forge" ${this.b(el => { const c = G.forgeCost(); el.classList.toggle('no', G.s.ore < c); el.innerHTML = `${iconImg('hammer')} Forge random gear · ${iconImg('ore')}${fmt(c)}`; })}></button>`;
    if (!G.s.items.length) h += `<div class="card paper center" style="margin-top:8px">No gear yet. Win battles, go on expeditions, or forge some!</div>`;
    const items = G.s.items.slice().sort((a, b) => G.rarityIdx(b.rarity) - G.rarityIdx(a.rarity));
    for (const it of items) {
      const owner = it.owner ? G.gob(it.owner) : null;
      h += `<div class="list-item r-${it.rarity}" style="margin-top:6px">${iconImg(it.slot === 'w' ? 'sword' : 'star', 'ic b')}<div class="grow"><div class="rt">${esc(it.name)}</div><div class="small muted">${it.slot === 'w' ? `+${pct(it.atk)} atk, +${pct(it.hp)} hp` : `+${pct(it.prod)} work, +${pct(it.luck)} luck`}${owner ? ' · on ' + esc(owner.name) : ''}</div></div>
        <button class="btn tiny ghost" data-act="sell-item" data-id="${it.uid}">Sell</button></div>`;
    }
    this.setBody(h);
  }
  pTreasures() {
    const G = this.G;
    let h = `<p class="small muted center">Rare treasures found on expeditions. Complete a set for a permanent bonus! Duplicates sell for gems.</p>`;
    for (const sid in TREASURE_SETS) {
      const set = TREASURE_SETS[sid], done = G.setComplete(sid);
      const keys = Object.keys(TREASURES).filter(k => TREASURES[k].set === sid);
      h += `<div class="card ${done ? 'hl' : ''}"><div class="row"><div class="grow"><div class="bname">${set.name} ${done ? '✅' : ''}</div><div class="small ${done ? 'green-t' : 'muted'}">Set bonus: ${set.text} · from ${REGION_BY_ID[sid].name}</div></div></div>
        ${keys.map(k => { const n = G.s.treasures[k] || 0; return `<div class="list-item ${n ? '' : 'done'}" style="margin:6px 0 0">${iconImg(n ? 'chest' : 'lock')}<div class="grow small">${n ? TREASURES[k].name : '???'} ${n > 1 ? `<b>×${n}</b>` : ''}</div>${n > 1 ? `<button class="btn tiny" data-act="sell-treasure" data-id="${k}">Sell dupe ${iconImg('gem')}15</button>` : ''}</div>`; }).join('')}
      </div>`;
    }
    this.setBody(h);
  }

  // ------------------------------------------------------------ EXPLORE
  pExplore(sub = 'regions') {
    const G = this.G;
    this.title('Explore & Conquer');
    const ready = G.s.expeditions.filter(e => !e.claimed && G.now() >= e.end).length;
    this.tabs([['regions', 'Regions'], ['exped', 'Expeditions', ready > 0], ['defense', 'Defense', !!G.rt.invasion]], sub, 'explore');
    if (sub === 'exped') return this.pExped();
    if (sub === 'defense') return this.pDefense();
    let h = `<p class="small muted center">Battle through regions to conquer them for permanent bonuses. Your strongest 4 goblins fight (change in party).</p>`;
    h += `<div class="card row"><div class="grow small"><b>Battle party</b><br>${G.battleTeam().map(g => esc(g.name.split(' ')[0])).join(', ') || 'No goblins'}<br><span class="muted">Power ${fmt(G.battleTeam().reduce((t, g) => t + G.goblinPower(g), 0))}</span></div><button class="btn small blue" data-act="party">Change</button></div>`;
    for (const r of REGIONS) {
      const open = G.regionOpen(r), st = G.regionStage(r.id);
      h += `<div class="card region ${open ? '' : 'lock'}" data-act="${open ? 'region' : ''}" data-id="${r.id}">
        <div class="rbg" style="background:linear-gradient(${r.sky[0]},${r.sky[1]} 60%,${r.ground} 60%)"><h4>${open ? '' : '🔒 '}${r.name}</h4><img src="${eThumb(r.boss.type, r.boss.tint, true)}" style="width:52px;height:52px;margin-bottom:-6px"></div>
        <div class="rbody">${open ? `<div class="stage-dots">${Array.from({ length: STAGES_PER_REGION }, (_, i) => `<i class="${i < st ? 'on' : ''} ${i === STAGES_PER_REGION - 1 ? 'boss' : ''}"></i>`).join('')}</div>
          <div class="small" style="margin-top:4px">${st >= STAGES_PER_REGION ? `<span class="green-t">✅ Conquered! ${r.reward.text}</span>` : `Stage ${st + 1}/${STAGES_PER_REGION} · Conquer reward: <span class="gold-t">${r.reward.text}</span>`}</div>`
          : `<div class="small muted">Requires Capital Level ${r.unlock}. ${r.desc}</div>`}</div></div>`;
    }
    this.setBody(h);
  }
  pRegion(_, id) {
    const G = this.G, r = REGION_BY_ID[id];
    this.title(r.name);
    this.tabsEl.innerHTML = '';
    const st = G.regionStage(id);
    const next = Math.min(STAGES_PER_REGION, st + 1);
    const team = G.battleTeam();
    const tp = team.reduce((t, g) => t + G.goblinPower(g), 0);
    let h = `<p class="small center muted"><i>${r.desc}</i></p>`;
    const stage = st >= STAGES_PER_REGION ? STAGES_PER_REGION : next;
    const enemies = G.battleSetup(id, stage);
    const ep = enemies.reduce((t, e) => t + (e.hp / 6 + e.atk) / 2, 0);
    const ratio = tp / ep;
    h += `<div class="card"><div class="bname center">${stage >= STAGES_PER_REGION ? '👑 BOSS: ' + r.boss.name : 'Stage ' + stage}</div>
      <div class="row" style="justify-content:center;gap:4px;margin:6px 0">${enemies.map(e => `<img src="${eThumb(e.kind, e.tint, e.boss)}" style="width:${e.boss ? 64 : 44}px">`).join('')}</div>
      <div class="vs"><span>Your team<br><span class="pw green-t">${fmt(tp)}</span></span><span style="font-size:22px">VS</span><span style="text-align:right">Enemies<br><span class="pw red-t">${fmt(ep)}</span></span></div>
      <div class="small center" style="margin-top:4px">${ratio > 1.4 ? '<span class="green-t">Easy win</span>' : ratio > 1 ? '<span class="gold-t">Should win</span>' : ratio > 0.75 ? '<span class="gold-t">Risky — tap and bomb a lot!</span>' : '<span class="red-t">Very dangerous — train your goblins!</span>'}</div>
      <button class="btn gold wide" style="margin-top:8px" data-act="fight" data-id="${id}" data-stage="${stage}">${iconImg('sword')} ${st >= STAGES_PER_REGION ? 'Re-fight Boss (farm)' : 'FIGHT!'}</button></div>`;
    h += `<div class="card row"><div class="grow small"><b>Party:</b> ${team.map(g => esc(g.name.split(' ')[0])).join(', ')}</div><button class="btn small blue" data-act="party">Change</button></div>`;
    if (st > 0) {
      h += `<h3>Replay cleared stages</h3><div class="row wrap">${Array.from({ length: Math.min(st, STAGES_PER_REGION) }, (_, i) => `<button class="btn tiny ghost" data-act="fight" data-id="${id}" data-stage="${i + 1}">${i + 1 === STAGES_PER_REGION ? 'Boss' : i + 1}</button>`).join('')}</div>`;
    }
    h += `<h3>Treasures here</h3><div class="small">${r.treasures.map(k => G.s.treasures[k] ? '✅ ' + TREASURES[k].name : '❔ ???').join('<br>')}</div>`;
    h += `<div style="margin-top:10px"><button class="btn blue wide" data-act="exped-region" data-id="${id}">${iconImg('map')} Send an expedition here</button></div>`;
    this.setBody(h);
  }
  pExped() {
    const G = this.G;
    if (!G.isBuilt('lodge')) return this.setBody(`<div class="card paper center"><p>Build the <b>Expedition Lodge</b> in the Market Ward (Capital Lv 4) to send goblins exploring!</p><button class="btn small" data-act="tab" data-tab="build" data-sub="util">Go to Utilities</button></div>`);
    let h = `<p class="small center">Slots: <b>${G.activeExpeditions().length}/${G.expSlots()}</b> · Expeditions keep going while you're away!</p>`;
    for (const e of G.s.expeditions) {
      const R = REGION_BY_ID[e.region], M = MISSIONS.find(m => m.id === e.mission);
      h += `<div class="card"><div class="row"><div class="grow"><div class="bname" style="font-size:14px">${M.name} · ${R.name}</div><div class="small muted">${e.party.map(u => esc(G.gob(u)?.name.split(' ')[0] || '?')).join(', ')} · ${Math.round(e.chance * 100)}% success</div></div>
        <span ${this.b(el => { const left = (e.end - G.now()) / 1000; el.innerHTML = left > 0 ? `<button class="btn tiny purple" data-act="rush" data-id="${e.id}">⏩ ${G.rushCost(e)}${iconImg('gem')}</button> <b>${fmtTime(left)}</b>` : `<button class="btn small gold" data-act="claim-exp" data-id="${e.id}">Collect!</button>`; })}></span></div>
        <div class="pb b"><i ${this.b(el => el.style.width = clamp((G.now() - e.start) / (e.end - e.start) * 100, 0, 100) + '%')}></i></div></div>`;
    }
    h += `<h3>New Expedition</h3>`;
    const regs = REGIONS.filter(r => G.regionOpen(r));
    if (!regs.length) h += `<div class="card paper center">Reach Capital Level 4 to discover the Whispering Woods.</div>`;
    const sel = this.expRegion && G.regionOpen(REGION_BY_ID[this.expRegion]) ? this.expRegion : regs[regs.length - 1]?.id;
    if (sel) {
      h += `<div class="sheet-tabs" style="padding:0 0 8px">${regs.map(r => `<button class="stab ${r.id === sel ? 'on' : ''}" data-act="exp-reg" data-id="${r.id}">${r.name.split(' (')[0]}</button>`).join('')}</div>`;
      for (const m of MISSIONS) {
        const d = G.expDifficulty(sel, m.id);
        h += `<div class="card row">${iconImg(m.icon, 'ic b')}<div class="grow"><div class="bname" style="font-size:14px">${m.name}</div><div class="small muted">${fmtTime(m.dur)} · Difficulty ${fmt(d)} · Loot ×${m.loot}</div></div>
          <button class="btn small" data-act="exp-start" data-id="${sel}" data-m="${m.id}" ${this.b(el => el.classList.toggle('no', G.activeExpeditions().length >= G.expSlots()))}>Send</button></div>`;
      }
    }
    this.setBody(h);
  }
  pDefense() {
    const G = this.G;
    if (!G.isBuilt('barracks')) return this.setBody(`<div class="card paper center"><p>Build the <b>Bonk Barracks</b> (Capital Lv 7) to defend against invasions. Until then, the knights don't think you're worth attacking. Rude.</p></div>`);
    const dm = G.defenseMult();
    const defs = G.defenders();
    const inv = G.rt.invasion;
    let h = '';
    if (inv) h += `<div class="card" style="background:#6a2020"><div class="bname">⚔️ ${inv.name} are attacking!</div><p class="small">They arrive in <b ${this.b(el => el.textContent = fmtTime((inv.until - G.now()) / 1000))}></b>. Fight them yourself, or your defenders will auto-battle when they arrive.</p><button class="btn gold wide" data-act="defend">FIGHT NOW</button></div>`;
    h += `<div class="stat-grid"><div class="stat">Defense attack<b>×${dm.atk.toFixed(2)}</b></div><div class="stat">Defense HP<b>×${dm.hp.toFixed(2)}</b></div><div class="stat">Invasion strength<b>${fmt(G.invasionPower())}</b></div><div class="stat">Your defense<b>${fmt(defs.reduce((t, g) => t + G.goblinPower(g), 0) * (dm.atk + dm.hp) / 2)}</b></div></div>`;
    h += `<h3>Defenders (${defs.length}/${G.defenderSlots()})</h3><div class="slots">`;
    for (let i = 0; i < 4; i++) {
      const g = defs[i];
      if (i >= G.defenderSlots()) h += `<div class="slot" style="opacity:.35">🔒<small>Barracks ${i + 1}</small></div>`;
      else if (g) h += `<div class="slot r-${g.rarity}" data-act="unassign" data-uid="${g.uid}" style="box-shadow:inset 0 0 0 2px var(--rc)"><img src="${goblinPortrait(g.look, 2)}"><span class="x">✕</span><small>${fmt(G.goblinPower(g))}</small></div>`;
      else h += `<div class="slot" data-act="def-slot">+<small>Assign</small></div>`;
    }
    h += `</div><p class="small muted">Warriors are the best defenders. Upgrade the Barracks and Squint Tower to boost defense. Lost invasions cost gold and damage a building.</p>`;
    h += `<p class="small">Record: <b class="green-t">${G.s.stats.invasionsWon} won</b> · <b class="red-t">${G.s.stats.invasionsLost} lost</b></p>`;
    this.setBody(h);
  }

  // ------------------------------------------------------------ QUESTS
  pQuests(sub = 'quests') {
    const G = this.G;
    this.title('Quests & Glory');
    const dCl = G.s.daily.quests.some(q => !q.claimed && G.dailyProgress(q) >= q.n) || !G.s.daily.loginClaimed;
    this.tabs([['quests', 'Quests', dCl], ['achievements', 'Achievements'], ['stats', 'Stats']], sub, 'quests');
    if (sub === 'achievements') return this.pAchievements();
    if (sub === 'stats') return this.pStats();
    const d = G.s.daily;
    let h = '';
    // login
    h += `<h3>Daily Login · Streak ${d.streak} 🔥</h3><div class="row" style="gap:4px">${LOGIN_REWARDS.map((r, i) => {
      const k = Object.keys(r)[0];
      const cur = i === d.loginDay, past = i < d.loginDay || (cur && d.loginClaimed);
      return `<div class="stat center grow" style="padding:4px 2px;${cur && !d.loginClaimed ? 'box-shadow:0 0 0 2px var(--gold)' : ''};${past ? 'opacity:.5' : ''}"><span class="small">D${i + 1}</span><br>${iconImg(r.ticket ? 'ticket' : RES_ICON[k])}<br><span class="small">${r.ticket ? '+🎟' : fmt(r[k])}</span></div>`;
    }).join('')}</div>`;
    if (!d.loginClaimed) h += `<button class="btn gold wide" style="margin-top:6px" data-act="claim-login">Claim Day ${d.loginDay + 1} Reward!</button>`;
    // story
    const q = G.storyQuest();
    if (q) {
      const p = G.storyProgress(q);
      h += `<h3>Story Quest (${G.s.story + 1}/${STORY.length})</h3><div class="card ${p >= 1 ? 'hl' : ''}"><div class="bname" style="font-size:14px">${q.text}</div>${q.hint ? `<div class="small muted">${q.hint}</div>` : ''}<div class="pb g"><i style="width:${p * 100}%"></i></div>
        <div class="row" style="margin-top:6px"><div class="grow small">Reward: ${costHtml(q.reward)}</div>${p >= 1 ? '<button class="btn small gold" data-act="claim-story">Claim</button>' : ''}</div></div>`;
    }
    // daily
    h += `<h3>Daily Quests <span class="small muted" ${this.b(el => { const t = new Date(); const m = new Date(t.getFullYear(), t.getMonth(), t.getDate() + 1); el.textContent = '· resets in ' + fmtTime((m - t) / 1000); })}></span></h3>`;
    d.quests.forEach((dq, i) => {
      const t = DAILY_TEMPLATES.find(x => x.id === dq.id), p = G.dailyProgress(dq);
      h += `<div class="list-item ${dq.claimed ? 'done' : ''}"><div class="grow"><div class="small"><b>${t.text.replace('{n}', dq.n)}</b></div><div class="pb g"><i style="width:${p / dq.n * 100}%"></i></div><div class="small muted">${p}/${dq.n} · ${costHtml(t.reward)}</div></div>
        ${dq.claimed ? '✅' : p >= dq.n ? `<button class="btn small gold" data-act="claim-daily" data-i="${i}">Claim</button>` : ''}</div>`;
    });
    if (d.quests.every(q => q.claimed) && !d.bonusClaimed) h += `<button class="btn gold wide" data-act="claim-bonus">All dailies done! Claim bonus ${iconImg('gem')} 40</button>`;
    this.setBody(h);
  }
  pAchievements() {
    const G = this.G;
    const n = Object.keys(G.s.achievements).length;
    let h = `<p class="center small">Unlocked <b class="gold-t">${n}/${ACHIEVEMENTS.length}</b> · Each gives +1% all income!</p>`;
    const list = ACHIEVEMENTS.slice().sort((a, b) => (!!G.s.achievements[b.id]) - (!!G.s.achievements[a.id]));
    for (const a of list) {
      const has = G.s.achievements[a.id];
      h += `<div class="list-item ${has ? '' : 'done'}">${iconImg(has ? 'trophy' : 'lock', 'ic b')}<div class="grow"><b class="small">${a.name}</b><div class="small muted">${a.desc}</div></div><span class="small">${iconImg('gem')}${a.gems}</span></div>`;
    }
    this.setBody(h);
  }
  pStats() {
    const G = this.G, s = G.s;
    const rows = [
      ['Capital founded', new Date(s.created).toLocaleDateString()], ['Play time', fmtTime(s.stats.playTime)], ['Gold earned (all time)', fmt(s.lifetimeGold)],
      ['Gold earned (this run)', fmt(s.runGold)], ['Prestiges', s.stats.prestiges], ['Golden Teeth earned', fmt(s.teethEarned)],
      ['Goblins recruited', s.stats.recruits], ['Building upgrades', fmt(s.stats.upgrades)], ['Battles won / lost', `${s.stats.battlesWon} / ${s.stats.battlesLost}`],
      ['Bosses defeated', s.stats.bosses], ['Expeditions', s.stats.expeditions], ['Golden Goblins caught', s.stats.golden], ['Coin bubbles popped', s.stats.bubbles],
      ['Fires put out', s.stats.fires], ['Rats squashed', s.stats.rats], ['Invasions repelled', s.stats.invasionsWon], ['Incidents handled', s.stats.events], ['Trades', s.stats.trades],
    ];
    this.setBody(rows.map(([k, v]) => `<div class="list-item"><span class="grow small">${k}</span><b class="gold-t">${v}</b></div>`).join(''));
  }

  // ------------------------------------------------------------ MORE
  pMore(sub = 'shop') {
    const G = this.G;
    this.title('More');
    const pDot = G.canPrestige() && G.teethGain() >= Math.max(10, G.s.teethEarned * 0.5);
    this.tabs([['shop', 'Market'], ['prestige', 'Prestige', pDot], ['league', 'Rankings', !!G.s.leaguePending], ['settings', 'Settings']], sub, 'more');
    if (sub === 'prestige') return this.pPrestige();
    if (sub === 'league') return this.pLeague();
    if (sub === 'settings') return this.pSettings();
    let h = '';
    // merchant
    if (G.merchantOpen()) {
      G.refreshMerchant();
      const m = G.s.merchant;
      h += `<div class="card row" style="background:linear-gradient(#4a3a1a,#3a2a10)"><img src="${goblinPortrait({ skin: '#8fbf3a', hat: 'turban', outfit: '#6a3a8a', tool: 'bag', nose: 3, extra: 'earrings', ears: 2, teeth: 2 }, 2)}" style="width:52px"><div class="grow small"><b>Gribble the Wandering Trader</b><br><i>"Everything legit! Mostly! No refunds!"</i><br><span class="muted" ${this.b(el => el.textContent = 'New stock in ' + fmtTime((m.refresh - G.now()) / 1000))}></span></div><button class="btn tiny purple" data-act="reroll">Restock ${iconImg('gem')}20</button></div>`;
      m.offers.forEach((o, i) => {
        h += `<div class="list-item ${o.sold ? 'done' : ''}"><div class="grow"><b class="small">${esc(o.name)}</b><div class="small muted">${o.desc}</div></div>
          ${o.sold ? '<span class="tag">SOLD</span>' : `<button class="btn small buybtn" data-act="buy-offer" data-i="${i}" ${this.b(el => el.classList.toggle('no', Object.entries(o.cost).some(([k, v]) => G.s[k] < v)))}>Buy<small>${costHtml(o.cost)}</small></button>`}</div>`;
      });
    } else h += `<div class="card paper center small">A shady merchant visits capitals of Level 8 or higher. Keep growing!</div>`;
    h += `<h3>Time Warp (gems → instant income)</h3><div class="row">${[1, 4, 12].map(hh => `<button class="btn purple grow buybtn small" data-act="warp" data-h="${hh}" ${this.b(el => { el.classList.toggle('no', G.s.gems < G.warpCost(hh)); el.innerHTML = `${hh}h<small>${iconImg('gem')}${G.warpCost(hh)}</small><small>${iconImg('coin')}${fmt(G.incomePerSec(false) * hh * 3600)}</small>`; })}></button>`).join('')}</div>`;
    if (G.isBuilt('market')) {
      h += `<h3>Bazaar Exchange</h3><div class="row wrap">
        <button class="btn small grow" data-act="exchange" data-k="ore2gold">50 ${iconImg('ore')} → ${iconImg('coin')}</button>
        <button class="btn small grow" data-act="exchange" data-k="mush2gold">100 ${iconImg('shroom')} → ${iconImg('coin')}</button>
        <button class="btn small grow" data-act="exchange" data-k="gold2ore">${iconImg('coin')} → ${iconImg('ore')}</button>
        <button class="btn small grow" data-act="exchange" data-k="gold2mush">${iconImg('coin')} → ${iconImg('shroom')}</button></div>`;
    }
    h += `<h3>Brag</h3><button class="btn blue wide" data-act="share">${iconImg('share')} Share my capital</button>`;
    this.setBody(h);
  }
  pPrestige() {
    const G = this.G, s = G.s;
    const gain = G.teethGain();
    let h = `<div class="card center" style="background:linear-gradient(#5a4a10,#3a2a08)">
      <img src="${icon('tooth', 6)}" style="width:60px"><div class="bname">Pack Up the Capital</div>
      <p class="small">Your goblins grab everything that isn't nailed down (and the nails), and move to a fresh swamp. You keep your <b>goblins, gear, treasures, gems, region conquests</b>, Mud Huts and Cauldron. Buildings, gold, districts and research reset.</p>
      <p>Golden Teeth: <b class="gold-t">${fmt(s.teethEarned)}</b> (+${fmt(s.teethEarned * 2)}% income)</p>
      <p>Moving now earns: <b class="gold-t" ${this.b(el => el.textContent = '+' + fmt(G.teethGain()) + ' teeth')}></b></p>
      ${s.runGold < PRESTIGE_MIN_GOLD ? `<p class="small muted">Earn ${fmt(PRESTIGE_MIN_GOLD)} gold in one run to unlock (now ${fmt(s.runGold)}).</p>` : ''}
      <button class="btn gold wide" data-act="prestige" ${this.b(el => el.classList.toggle('no', !G.canPrestige()))}>Pack Up & Move!</button>
      <p class="small muted">Tip: teeth grow slower than gold — move when you'd gain roughly as many as you have.</p></div>`;
    h += `<h3>Tooth Shrine · ${iconImg('tooth')} ${fmt(s.teeth)} to spend</h3><p class="small muted">Spending teeth does NOT reduce your income bonus.</p>`;
    for (const p of PERKS) {
      const l = G.perk(p.id), max = l >= p.max;
      h += `<div class="list-item"><div class="grow"><b class="small">${p.name} <span class="tag">${l}/${p.max}</span></b><div class="small muted">${p.desc}</div></div>
        ${max ? '<span class="tag green-t">MAX</span>' : `<button class="btn small gold buybtn" data-act="perk" data-id="${p.id}" ${this.b(el => el.classList.toggle('no', s.teeth < p.cost[l]))}>Buy<small>${iconImg('tooth')}${fmt(p.cost[l])}</small></button>`}</div>`;
    }
    this.setBody(h);
  }
  pLeague() {
    const G = this.G;
    G.checkLeague();
    const rows = G.leagueBoard();
    const end = G.s.league.week + 7 * 86400e3;
    let h = '';
    if (G.s.leaguePending) h += `<div class="card hl center"><p>Last week you finished <b>#${G.s.leaguePending.rank}</b>!</p><button class="btn gold" data-act="claim-league">Claim ${iconImg('gem')} ${G.s.leaguePending.gems}</button></div>`;
    h += `<div class="card paper center small"><b>Weekly Tribal League</b> — gold earned this week vs. rival goblin chiefs. Ends in <b ${this.b(el => el.textContent = fmtTime((end - G.now()) / 1000))}></b>.<br>Rewards: #1 ${iconImg('gem')}300 · Top 3 ${iconImg('gem')}150 · Top 10 ${iconImg('gem')}60</div>`;
    rows.forEach((r, i) => {
      h += `<div class="lb-row ${r.me ? 'me' : ''} ${i < 3 ? 'top' : ''}"><span class="rk">${i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1}</span><span class="grow">${esc(r.name)}</span><span class="sc">${fmt(r.score)}</span></div>`;
    });
    this.setBody(h);
  }
  pSettings() {
    const G = this.G, st = G.s.settings;
    const tg = (k, label) => `<div class="list-item"><span class="grow">${label}</span><button class="toggle ${st[k] ? 'on' : ''}" data-act="toggle" data-k="${k}"></button></div>`;
    let h = tg('sound', 'Sound effects') + tg('music', 'Music') + tg('haptics', 'Vibration');
    h += `<h3>Capital</h3><div class="row"><input class="txt grow" id="cap-name" maxlength="22" value="${esc(G.s.name)}"><button class="btn small" data-act="rename">Rename</button></div>`;
    h += `<h3>Save</h3><p class="small muted">Your game saves automatically on this device. Copy your save code to move it elsewhere.</p>
      <div class="row wrap"><button class="btn small blue" data-act="save-now">Save now</button><button class="btn small" data-act="export">Export save</button><button class="btn small ghost" data-act="import">Import save</button></div>`;
    h += `<h3>Danger zone</h3><button class="btn small red" data-act="reset">Delete save & restart</button>`;
    h += `<h3>About</h3><p class="small muted">Goblin Capital Tycoon — every pixel drawn by code, every goblin questionable. Made with mud and love.</p>`;
    this.setBody(h);
  }

  // ------------------------------------------------------------ modals
  modal(html, opts = {}) {
    this.modalBox.className = 'modal-box' + (opts.dark ? ' dark' : '');
    this.modalBox.innerHTML = html;
    this.modalEl.classList.add('open');
    this.modalEl.setAttribute('aria-hidden', 'false');
    this.modalDismissable = opts.dismissable !== false;
    this.modalKeep = opts.keep || null;
    this.modalOnClose = opts.onClose || null;
    this.pruneBinds();
    this.refresh();
  }
  closeModal() {
    this.modalEl.classList.remove('open');
    this.modalEl.setAttribute('aria-hidden', 'true');
    this.modalKeep = null;
    const cb = this.modalOnClose; this.modalOnClose = null;
    if (cb) cb();
    if (this.modalQueue.length && !this.battle.active) { const next = this.modalQueue.shift(); setTimeout(() => this.queueModal(next), 150); }
  }
  queueModal(fn) {
    if (this.modalEl.classList.contains('open') || this.battle.active) this.modalQueue.push(fn); else fn();
  }
  flushQueue() {
    if (this.battle.active || this.modalEl.classList.contains('open') || !this.modalQueue.length) return;
    const next = this.modalQueue.shift(); next();
  }
  confirm(title, text, yes, onYes, cls = 'red') {
    this.modal(`<h2>${title}</h2><p>${text}</p><div class="modal-actions"><button class="btn ghost" data-act="close-modal">Cancel</button><button class="btn ${cls}" id="m-yes">${yes}</button></div>`);
    $('#m-yes').onclick = () => { this.closeModal(); onYes(); };
  }
  toast(text, kind = 'info', ic) {
    const el = document.createElement('div');
    el.className = 'toast ' + kind;
    el.innerHTML = (ic ? `<img src="${icon(ic)}">` : '') + `<span>${text}</span>`;
    const box = $('#toasts');
    box.appendChild(el);
    while (box.children.length > 3) box.firstChild.remove();
    setTimeout(() => el.remove(), 3000);
  }
  flyCoins(sx, sy, n = 6, ic = 'coin', target = '.res.gold') {
    const t = $(target); if (!t) return;
    const tr = t.getBoundingClientRect();
    const box = $('#flycoins');
    for (let i = 0; i < n; i++) {
      const img = document.createElement('img');
      img.className = 'fly'; img.src = icon(ic);
      img.style.left = (sx - 9 + (Math.random() - 0.5) * 30) + 'px'; img.style.top = (sy - 9 + (Math.random() - 0.5) * 30) + 'px';
      box.appendChild(img);
      setTimeout(() => { img.style.transform = `translate(${tr.left + 14 - parseFloat(img.style.left)}px, ${tr.top + 10 - parseFloat(img.style.top)}px) scale(.7)`; img.style.opacity = '0.4'; }, 20 + i * 40);
      setTimeout(() => { img.remove(); t.classList.remove('bump'); void t.offsetWidth; t.classList.add('bump'); }, 760 + i * 40);
    }
  }

  showRecruit(g, info) {
    const G = this.G;
    if (info.left) {
      this.toast(`${esc(g.name)} (${g.rarity}) found no bed and left... but tipped ${fmt(info.tip)} ${info.tipRes}. Upgrade the Mud Huts!`, 'bad', 'house');
      return;
    }
    const ri = G.rarityIdx(g.rarity), R = RARITIES[ri];
    const named = g.named ? NAMED_BY_ID[g.named] : null;
    const reveal = () => {
      sfx(ri >= 3 ? 'epic' : 'reveal');
      if (ri >= 2) this.world.confetti(this.world.cam.x, this.world.cam.y, 60);
      const again = info.src === 'basic' || info.src === 'premium';
      this.modal(`<div class="reveal r-${g.rarity}"><div class="rays"></div>
        <div class="rlabel">${R.name.toUpperCase()}${info.isNew && g.named ? ' · NEW!' : ''}</div>
        <img class="big-por" src="${goblinPortrait(g.look, 6, 8)}">
        <h2>${esc(g.name)}</h2>
        ${info.dup ? (info.maxed ? `<p>Already maxed! Converted to <b>${info.gems} gems</b>.</p>` : `<p class="green-t"><b>Duplicate! ★${info.star}</b> — stronger and +5 max level!</p>`) : ''}
        <p class="small muted">${JOBS[g.job].name} · ${TRAITS[g.trait].name}</p>
        ${named ? `<p class="small"><i>"${named.bio}"</i></p><p class="small"><b>${ABILITY_TEXT[named.ability.type](named.ability)}</b></p>` : `<p class="small"><i>"${this.world.lineFor({ uid: g.uid })}"</i></p>`}
        <div class="modal-actions">
          ${again ? `<button class="btn ${info.src === 'premium' ? 'purple' : ''}" data-act="recruit-again" data-mode="${info.src}">Again!</button>` : ''}
          ${!info.dup && !g.assign ? `<button class="btn blue" data-act="assign-pick" data-uid="${g.uid}">Assign job</button>` : ''}
          <button class="btn ghost" data-act="close-modal">Nice!</button>
        </div></div>`, { dark: true });
    };
    if (info.src === 'basic' || info.src === 'premium' || info.src === 'ticket' || info.src === 'merchant') {
      this.modal(`<h2>Summoning...</h2><img class="cauldron-anim" src="${bThumb('cauldron', 2)}"><p class="small muted">*bubble bubble* *suspicious noises*</p>`, { dark: true, dismissable: false });
      sfx('recruit');
      setTimeout(reveal, ri >= 3 ? 1400 : 900);
    } else this.queueModal(reveal);
  }

  showEvent() {
    const G = this.G, e = G.rt.event; if (!e) return;
    const fill = (t) => esc(G.fill(t, { a: e.a, b: e.b }));
    this.modal(`<img src="${icon('scroll', 5)}" style="width:50px"><h2>${esc(e.def.title)}</h2><p>${fill(e.def.text)}</p>
      <div class="ev-choices">${e.def.choices.map((c, i) => `<button class="btn ${i ? 'blue' : ''}" data-act="ev-choice" data-i="${i}">${fill(c.t)}</button>`).join('')}</div>`, { dismissable: true });
  }

  showOffline(r) {
    if (!r) return;
    this.queueModal(() => this.modal(`<h2>Welcome back, Boss!</h2><p class="small muted">You were away for ${fmtTime(r.away)}${r.capped ? ` (earnings capped at ${fmtTime(r.dt)} — upgrade the cap with prestige perks!)` : ''}. Your goblins kept working... mostly.</p>
      <div class="loot"><span>${iconImg('coin')} +${fmt(r.gold)}</span><span>${iconImg('shroom')} +${fmt(r.mush)}</span>${r.ore >= 1 ? `<span>${iconImg('ore')} +${fmt(r.ore)}</span>` : ''}</div>
      ${r.expReady ? `<p class="green-t"><b>${r.expReady} expedition(s) returned!</b></p>` : ''}
      <div class="modal-actions"><button class="btn gold" data-act="close-modal">Collect!</button></div>`, { onClose: () => { sfx('coin'); this.flyCoins(innerWidth / 2, innerHeight / 2, 10); } }));
  }

  showLevelUp(lvl, gems) {
    const G = this.G;
    const unlocks = [];
    for (const b of BUILDINGS) if (b.unlock === lvl) unlocks.push(b.name);
    for (const d of DISTRICTS) if (d.unlock === lvl) unlocks.push('District: ' + d.name);
    for (const r of REGIONS) if (r.unlock === lvl) unlocks.push('Region: ' + r.name);
    if (lvl === 3) unlocks.push('Goblin incidents & disasters');
    if (lvl === 8) unlocks.push('The Wandering Merchant');
    const rankUp = RANKS.find(r => r[0] === lvl);
    // deferred so a recruit/battle screen opened by the same action shows first
    setTimeout(() => this.queueModal(() => {
      sfx('levelup');
      this.world.confetti(this.world.cam.x, this.world.cam.y - 20, 80);
      this.modal(`<div style="font-size:14px" class="gold-t"><b>CAPITAL LEVEL UP!</b></div><div style="font-size:64px;font-weight:700;line-height:1;color:#e8a020;text-shadow:0 4px 0 #7a4a10">${lvl}</div>
        ${rankUp ? `<p>Your capital is now a <b>${rankUp[1]}</b>!</p>` : ''}
        <div class="loot"><span>${iconImg('gem')} +${gems}</span><span>${iconImg('shroom')} +${5 * lvl}</span></div>
        ${unlocks.length ? `<h3>Unlocked!</h3>${unlocks.map(u => `<div class="list-item small">✨ ${u}</div>`).join('')}` : ''}
        <div class="modal-actions"><button class="btn gold" data-act="close-modal">Hooray!</button></div>`);
    }), 0);
  }

  showExpResult(res) {
    const G = this.G;
    sfx(res.ok ? 'victory' : 'defeat');
    this.modal(`<h2>${res.ok ? '🎉 Expedition Success!' : '😬 Expedition... Kinda Failed'}</h2><p class="small muted">${res.mission.name} · ${res.region.name}</p>
      <div class="card small" style="text-align:left">${res.log.map(l => `<p>• ${esc(l)}</p>`).join('')}</div>
      <div class="loot">${res.got.map(g => `<span>${g}</span>`).join('')}</div>
      ${res.item ? `<p>Found gear: <b class="rt r-${res.item.rarity}">${esc(res.item.name)}</b></p>` : ''}
      ${res.treasure ? `<p>💎 Treasure: <b>${TREASURES[res.treasure].name}</b>!</p>` : ''}
      ${res.goblin ? `<p>A goblin followed them home: <b class="rt r-${res.goblin.rarity}">${esc(res.goblin.name)}</b>!</p>` : ''}
      <div class="modal-actions"><button class="btn gold" data-act="close-modal">Great!</button></div>`);
  }

  pickGoblins({ title, max = 1, filter = () => true, selected = [], info, onDone, sortBy }) {
    const G = this.G;
    let sel = selected.slice();
    const list = G.s.goblins.filter(filter).sort(sortBy || ((a, b) => G.goblinPower(b) - G.goblinPower(a)));
    const draw = () => {
      this.modal(`<h2 style="font-size:18px">${title}</h2>${max > 1 ? `<p class="small muted">Pick up to ${max}. Selected ${sel.length}/${max}</p>` : ''}
        ${info ? `<div class="card small">${info(sel)}</div>` : ''}
        <div class="gcards" style="max-height:50vh;overflow-y:auto;padding:4px">${list.length ? list.map(g => this.gcard(g, 'pick-g', sel.includes(g.uid) ? 'sel' : '')).join('') : '<p class="muted small">No available goblins.</p>'}</div>
        <div class="modal-actions"><button class="btn ghost" data-act="close-modal">Cancel</button>${max > 1 ? '<button class="btn" id="m-ok">Confirm</button>' : ''}</div>`, { dark: true });
      const ok = $('#m-ok'); if (ok) ok.onclick = () => { this.closeModal(); onDone(sel); };
    };
    this.pickHandler = (uid) => {
      if (max === 1) { this.closeModal(); onDone([uid]); return; }
      if (sel.includes(uid)) sel = sel.filter(u => u !== uid); else if (sel.length < max) sel.push(uid); else { sel.shift(); sel.push(uid); }
      const sc = this.modalBox.querySelector('.gcards')?.scrollTop || 0;
      draw();
      const gc = this.modalBox.querySelector('.gcards'); if (gc) gc.scrollTop = sc;
    };
    draw();
  }

  // ------------------------------------------------------------ battles
  startBattle(regionId, stage) {
    const G = this.G, R = REGION_BY_ID[regionId];
    const team = G.battleTeam();
    if (!team.length) { this.toast('No goblins available to fight!', 'bad'); return; }
    this.closeSheet();
    this.battle.open({
      title: `${R.name} · ${stage >= STAGES_PER_REGION ? 'BOSS' : 'Stage ' + stage}`,
      team: team.map(g => G.goblinCombat(g)), enemies: G.battleSetup(regionId, stage), region: R,
      bombMult: 1 + G.researchSum('bomb'),
      onEnd: (won, pokes) => {
        const res = G.finishBattle(regionId, stage, won, pokes);
        if (!won) return { html: `<p>Your goblins got bonked.</p><p class="small">Tips: train goblins (${iconImg('shroom')}), equip weapons, recruit stronger heroes, and use the Goblin Bomb!</p>` };
        let html = `<div class="loot">${res.got.map(g => `<span>${g}</span>`).join('')}</div>`;
        if (res.conquered) html += `<p class="green-t"><b>👑 REGION CONQUERED!</b><br>${res.conquered}</p>`;
        if (res.item) html += `<p>Loot: <b class="rt r-${res.item.rarity}">${esc(res.item.name)}</b></p>`;
        if (res.treasure) html += `<p>💎 Treasure: <b>${TREASURES[res.treasure].name}</b></p>`;
        const nextStage = G.regionStage(regionId) + 1;
        return { html, next: nextStage <= STAGES_PER_REGION && stage < STAGES_PER_REGION ? () => this.startBattle(regionId, nextStage) : null };
      },
      onClose: () => { this.openTab('explore'); this.show({ tab: 'region', param: regionId }, true); },
    });
  }
  startDefense() {
    const G = this.G, inv = G.rt.invasion;
    if (!inv) return;
    const defs = G.defenders();
    if (!defs.length) { this.toast('Assign defenders at the Barracks first!', 'bad'); this.openTab('explore', 'defense'); return; }
    inv.fighting = true;
    this.closeSheet();
    this.modalEl.classList.remove('open');
    this.battle.open({
      title: '⚔️ Defend the Capital!',
      team: defs.map(g => G.goblinCombat(g, true)), enemies: inv.enemies, region: { sky: ['#ffb070', '#ffe0a0'], ground: '#5fa83e', props: 'fences' },
      bombMult: 1 + G.researchSum('bomb'),
      onEnd: (won, pokes) => {
        G.s.stats.pokes += pokes;
        const r = G.resolveInvasion(won);
        if (won) return { html: `<p>The invaders flee in shame!</p><div class="loot">${r.got.map(g => `<span>${g}</span>`).join('')}</div>` };
        return { html: `<p>The invaders looted <b>${fmt(r.lost)}</b> gold${r.damaged ? ` and damaged the ${BUILDING_BY_ID[r.damaged].name}` : ''}.</p>` };
      },
    });
  }

  storyGo() {
    const G = this.G, q = G.storyQuest(); if (!q) return;
    unlockAudio();
    if (G.storyProgress(q) >= 1) { this.acts['claim-story'].call(this); return; }
    const g = q.goal;
    const focusB = (id) => { const b = BUILDING_BY_ID[id]; this.closeSheet(); this.world.focusBuilding(id); this.world.pointer = { x: (b.tx + b.w / 2) * TILE, y: b.ty * TILE - 12 }; setTimeout(() => { this.world.pointer = null; }, 6000); };
    if (g.build) { if (G.canBuildHere(g.build)) focusB(g.build); else if (!G.districtOpen(BUILDING_BY_ID[g.build].district)) this.openTab('build', 'districts'); else this.openTab('build', BUILDING_BY_ID[g.build].kind === 'biz' ? 'biz' : 'util'); }
    else if (g.blvl) { this.openTab('build', 'biz'); }
    else if (g.stat && g.stat[0] === 'recruits') this.openTab('goblins', 'recruit');
    else if (g.assigned) this.openTab('goblins', 'roster');
    else if (g.stat && g.stat[0] === 'bubbles') { this.closeSheet(); this.toast('Tap the floating coin bubbles above your buildings!', 'info', 'coin'); }
    else if (g.district) this.openTab('build', 'districts');
    else if (g.stat && (g.stat[0] === 'battlesWon')) this.openTab('explore');
    else if (g.stat && g.stat[0] === 'expSent') this.openTab('explore', 'exped');
    else if (g.boss) this.openTab('explore');
    else if (g.research) this.openTab('build', 'research');
    else if (g.goblins || g.rarity) this.openTab('goblins', 'recruit');
    else if (g.stat && g.stat[0] === 'prestiges') this.openTab('more', 'prestige');
    else if (g.sets) this.openTab('goblins', 'treasures');
    else this.openTab('build', 'biz');
  }

  // ------------------------------------------------------------ share
  async share() {
    const G = this.G, s = G.s;
    const c = makeCanvas(600, 340), ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    const g = ctx.createLinearGradient(0, 0, 0, 340); g.addColorStop(0, '#3a2a4a'); g.addColorStop(1, '#1c1424');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 600, 340);
    ctx.fillStyle = '#ffcf4a'; ctx.fillRect(0, 0, 600, 6); ctx.fillRect(0, 334, 600, 6);
    if (this.world.terrain) { ctx.globalAlpha = 0.25; ctx.drawImage(this.world.terrain, 18 * TILE, 14 * TILE, 20 * TILE, 12 * TILE, 0, 0, 600, 360); ctx.globalAlpha = 1; }
    const best = s.goblins.slice().sort((a, b) => G.rarityIdx(b.rarity) - G.rarityIdx(a.rarity) || b.lvl - a.lvl)[0];
    if (best) { const sh = goblinSheet(best.look); ctx.drawImage(sh.sheet, 8 * GOB_W, 0, GOB_W, GOB_H, 420, 90, GOB_W * 6, GOB_H * 6); }
    ctx.font = '700 34px "Pixelify Sans", sans-serif'; ctx.fillStyle = '#fff'; ctx.fillText(s.name, 28, 60);
    ctx.font = '600 20px "Pixelify Sans", sans-serif'; ctx.fillStyle = '#ffcf4a'; ctx.fillText(`${G.rankName()} · Capital Level ${s.level}`, 28, 92);
    ctx.fillStyle = '#fff7e6'; ctx.font = '600 22px "Pixelify Sans", sans-serif';
    const lines = [`💰 ${fmt(G.incomePerSec(false))} gold / sec`, `👺 ${s.goblins.length} goblins (${Object.keys(s.codex).length} heroes)`, `⚔️ ${s.stats.bosses} bosses defeated`, `🦷 ${fmt(s.teethEarned)} golden teeth`];
    lines.forEach((l, i) => ctx.fillText(l, 28, 140 + i * 36));
    if (best) { ctx.font = '600 16px "Pixelify Sans", sans-serif'; ctx.fillStyle = RARITIES[G.rarityIdx(best.rarity)].color; ctx.fillText(best.name.slice(0, 24), 410, 290); }
    ctx.fillStyle = '#7aff6a'; ctx.font = '700 18px "Pixelify Sans", sans-serif'; ctx.fillText('GOBLIN CAPITAL TYCOON', 28, 318);
    const text = `My goblin capital "${s.name}" is a level ${s.level} ${G.rankName()} making ${fmt(G.incomePerSec(false))} gold/sec with ${s.goblins.length} goblins! Can your goblins beat that? #GoblinCapitalTycoon`;
    try {
      const blob = await new Promise(r => c.toBlob(r, 'image/png'));
      const file = new File([blob], 'my-goblin-capital.png', { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], text, title: 'Goblin Capital Tycoon' }); return; }
      if (navigator.share) { await navigator.share({ text, title: 'Goblin Capital Tycoon', url: location.href }); return; }
    } catch (e) { if (e && e.name === 'AbortError') return; }
    this.modal(`<h2>Brag Card</h2><img src="${c.toDataURL()}" style="width:100%;border-radius:8px"><p class="small">${esc(text)}</p><div class="modal-actions"><a class="btn" download="my-goblin-capital.png" href="${c.toDataURL()}">Download</a><button class="btn blue" id="m-copy">Copy text</button><button class="btn ghost" data-act="close-modal">Close</button></div>`);
    $('#m-copy').onclick = () => { navigator.clipboard?.writeText(text); this.toast('Copied!', 'good'); };
  }

  // ------------------------------------------------------------ HUD
  hud() {
    const G = this.G, s = G.s;
    const set = (id, v) => { if (this.lastHud[id] !== v) { this.lastHud[id] = v; const el = document.getElementById(id); if (el) el.textContent = v; } };
    set('r-gold', fmt(s.gold));
    const gps = G.incomePerSec();
    set('r-gps', '+' + fmt(gps) + '/s');
    set('r-mush', fmt(s.mushrooms));
    set('r-ore', fmt(s.ore));
    set('r-gems', fmt(s.gems));
    set('h-lvl', String(s.level));
    set('h-name', s.name);
    set('h-rank', G.rankName());
    const xpw = Math.min(100, s.xp / xpForLevel(s.level) * 100).toFixed(1) + '%';
    if (this.lastHud.xp !== xpw) { this.lastHud.xp = xpw; $('#h-xp').style.width = xpw; }
    if (s.teethEarned > 0) { $('#r-teeth-wrap').hidden = false; set('r-teeth', fmt(s.teeth)); }
    // buffs
    const now = G.now();
    let bh = '';
    if (G.rt.frenzy > now) bh += `<span class="buff frenzy">⚡ FRENZY ×7 · ${Math.ceil((G.rt.frenzy - now) / 1000)}s</span>`;
    for (const b of s.buffs) if (b.until > now) bh += `<span class="buff">${b.kind === 'gold' ? 'Income' : BUILDING_BY_ID[b.kind.slice(2)]?.name.split(' ').pop()} ×${b.mult} · ${Math.ceil((b.until - now) / 1000)}s</span>`;
    if (bh !== this.lastHud.buffs) { this.lastHud.buffs = bh; $('#buffs').innerHTML = bh; $('#story').classList.toggle('has-buffs', !!bh); }
    // story
    const q = G.storyQuest();
    const storyEl = $('#story');
    if (q && !this.battle.active) {
      storyEl.hidden = false;
      const p = G.storyProgress(q);
      set('st-text', q.text);
      $('#st-bar').style.width = (p * 100) + '%';
      storyEl.classList.toggle('ready', p >= 1);
      const bt = p >= 1 ? 'Claim!' : 'Go';
      if ($('#st-btn').textContent !== bt) { $('#st-btn').textContent = bt; $('#st-btn').className = 'btn small ' + (p >= 1 ? 'gold' : ''); }
    } else storyEl.hidden = true;
    // side buttons (updated in place so taps never land on a replaced element)
    const want = [];
    if (G.rt.invasion && !G.rt.invasion.fighting) want.push({ k: 'inv', cls: 'alert', act: 'defend-side', ic: 'castle', t: `Invaders! ${Math.ceil((G.rt.invasion.until - now) / 1000)}s` });
    if (G.rt.event) want.push({ k: 'ev', cls: 'event', act: 'event', ic: 'scroll', t: `Incident! ${Math.ceil((G.rt.event.until - now) / 1000)}s` });
    const ready = s.expeditions.filter(e => !e.claimed && now >= e.end).length;
    if (ready) want.push({ k: 'exp', cls: 'gold', act: 'tab', ic: 'chest', t: `${ready} back!`, data: { tab: 'explore', sub: 'exped' } });
    if (G.rt.fires.length) want.push({ k: 'fire', cls: 'alert', act: 'goto-fire', ic: 'fire', t: 'FIRE! Tap it!' });
    if (G.rt.rats.length) want.push({ k: 'rats', cls: '', act: 'noop', ic: 'rat', t: `Rats! Squash ${G.rt.rats.length}` });
    const side = $('#side');
    const keys = new Set(want.map(w => w.k));
    for (const el of [...side.children]) if (!keys.has(el.dataset.key)) el.remove();
    want.forEach((w, i) => {
      let el = side.querySelector(`[data-key="${w.k}"]`);
      if (!el) {
        el = document.createElement('button');
        el.className = 'side-btn ' + w.cls; el.dataset.key = w.k; el.dataset.act = w.act;
        if (w.data) for (const d in w.data) el.dataset[d] = w.data[d];
        el.innerHTML = `<img src="${icon(w.ic)}"><span></span>`;
      }
      if (side.children[i] !== el) side.insertBefore(el, side.children[i] || null);
      const sp = el.querySelector('span'); if (sp.textContent !== w.t) sp.textContent = w.t;
    });
  }
  badges() {
    const G = this.G, s = G.s;
    const setB = (id, n) => { const el = document.getElementById(id); const v = n ? (n === true ? '!' : String(n)) : ''; if (el.textContent !== v) { el.textContent = v; el.classList.toggle('show', !!v); } };
    const newBuild = BUILDINGS.some(b => b.kind === 'biz' && !G.isBuilt(b.id) && G.canBuildHere(b.id) && s.gold >= G.bizCost(b.id, 1)) || DISTRICTS.some(d => !s.districts[d.id] && s.level >= d.unlock && s.gold >= G.districtCost(d.id));
    setB('b-build', newBuild);
    setB('b-goblins', (G.canRecruit() && s.mushrooms >= G.recruitCost()) || s.tickets > 0 ? true : 0);
    setB('b-explore', s.expeditions.filter(e => !e.claimed && G.now() >= e.end).length);
    const qn = s.daily.quests.filter(q => !q.claimed && G.dailyProgress(q) >= q.n).length + (s.daily.loginClaimed ? 0 : 1) + (G.storyQuest() && G.storyProgress() >= 1 ? 1 : 0);
    setB('b-quests', qn);
    setB('b-more', s.leaguePending || (G.canPrestige() && G.teethGain() >= Math.max(10, s.teethEarned * 0.5)) ? true : 0);
  }
}

// ------------------------------------------------------------ actions
UI.prototype.acts = {
  'close-sheet'() { this.closeSheet(); },
  'back'() { this.back(); },
  'close-modal'() { this.closeModal(); },
  'noop'() { },
  'sub'(el) { this.show({ tab: el.dataset.tab, sub: el.dataset.sub }); this.stack = []; },
  'tab'(el) { this.closeModal(); this.openTab(el.dataset.tab, el.dataset.sub); },
  'settings'() { this.openTab('more', 'settings'); },
  'open-quests'() { this.openTab('quests'); },
  'amt'(el) { this.buyAmt = el.dataset.v === 'max' ? 'max' : +el.dataset.v; this.rerender(); },
  'sort'(el) { this.rosterSort = el.dataset.v; this.rerender(); },
  'buy'(el) {
    const G = this.G, id = el.dataset.id;
    let n = el.dataset.n === 'max' ? 'max' : +(el.dataset.n || 1);
    if (BUILDING_BY_ID[id].kind === 'util') n = 1;
    const wasBuilt = G.isBuilt(id);
    if (G.buy(id, n)) {
      sfx(wasBuilt ? 'buy' : 'build');
      const r = el.getBoundingClientRect();
      this.world.sparkle && null;
      if (!wasBuilt) { this.closeSheet(); }
      else this.rerender();
      void r;
    } else { sfx('error'); el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
  },
  'open-building'(el, e) { if (e.target.closest('button')) return; this.show({ tab: 'building', param: el.dataset.id }, true); },
  'research'(el) { if (this.G.doResearch(el.dataset.id)) { sfx('milestone'); this.toast('Research complete!', 'good', 'flask'); this.rerender(); } else sfx('error'); },
  'district'(el) {
    if (this.G.unlockDistrict(el.dataset.id)) {
      sfx('milestone');
      const d = DISTRICT_BY_ID[el.dataset.id];
      this.closeSheet();
      this.world.focus((d.x + d.w / 2) * TILE, (d.y + d.h / 2) * TILE);
      this.world.terrainDirty = true;
      setTimeout(() => this.world.confetti((d.x + d.w / 2) * TILE, (d.y + d.h / 2) * TILE, 100), 400);
    } else sfx('error');
  },
  'goto'(el) { this.closeSheet(); this.world.focus(+el.dataset.x * TILE, +el.dataset.y * TILE); },
  'repair'(el) { if (this.G.repair(el.dataset.id)) { sfx('built'); this.rerender(); } else sfx('error'); },
  'assign-slot'(el) {
    const G = this.G, id = el.dataset.id, b = BUILDING_BY_ID[id];
    this.pickGoblins({
      title: `Assign to ${b.name}`, filter: g => !(g.assign && (g.assign.t === 'exp' || (g.assign.t === 'b' && g.assign.id === id))),
      sortBy: (x, y) => G.workerBonus(y, b) - G.workerBonus(x, b) || (!!x.assign - !!y.assign),
      onDone: ([uid]) => { G.assign(uid, { t: 'b', id }); sfx('gob'); this.rerender(); },
    });
  },
  'auto-assign'(el) { const n = this.G.autoAssign(el.dataset.id); if (n) sfx('gob'); this.rerender(); },
  'auto-all'() {
    const G = this.G; let n = 0;
    const blds = BIZ.filter(b => G.isBuilt(b.id)).sort((a, b) => G.buildingBaseIncome(b.id) - G.buildingBaseIncome(a.id));
    for (const b of blds) n += G.autoAssign(b.id);
    this.toast(n ? `Assigned ${n} goblin${n > 1 ? 's' : ''} to work!` : 'No free worker slots. Level up buildings for more!', n ? 'good' : 'bad');
    this.rerender();
  },
  'unassign'(el) { this.G.assign(+el.dataset.uid, null); sfx('tap'); if (this.modalKeep) this.goblinModal(+el.dataset.uid); this.rerender(); },
  'goblin'(el) { sfx('gob'); this.goblinModal(+el.dataset.uid); },
  'pick-g'(el) { this.pickHandler && this.pickHandler(+el.dataset.uid); },
  'assign-pick'(el) {
    const G = this.G, uid = +el.dataset.uid, g = G.gob(uid);
    const opts = BIZ.filter(b => G.isBuilt(b.id));
    const rows = opts.map(b => {
      const full = G.workers(b.id).length >= G.workerSlots(b.id);
      return `<div class="list-item"><img src="${bThumb(b.id, G.tier(b.id))}" style="width:40px"><div class="grow small"><b>${b.name}</b><br>${b.job === g.job ? '<span class="green-t">★ Perfect job!</span>' : '<span class="muted">40% effective</span>'} · +${Math.round(G.workerBonus(g, b) * 100)}% · ${G.workers(b.id).length}/${G.workerSlots(b.id)}</div>
        <button class="btn tiny ${full ? 'no' : ''}" data-act="assign-to" data-uid="${uid}" data-id="${b.id}">${full ? 'Full' : 'Assign'}</button></div>`;
    }).join('');
    this.modal(`<h2 style="font-size:18px">Assign ${esc(g.name)}</h2><div style="max-height:55vh;overflow-y:auto;text-align:left">${rows || '<p>No buildings yet!</p>'}</div><div class="modal-actions"><button class="btn ghost" data-act="close-modal">Cancel</button></div>`, { dark: true });
  },
  'assign-to'(el) {
    const G = this.G, uid = +el.dataset.uid, id = el.dataset.id, g0 = G.gob(uid);
    if (g0.assign?.t === 'b' && g0.assign.id === id) { this.closeModal(); return; }
    if (G.workers(id).length >= G.workerSlots(id)) {
      // swap out the weakest worker
      const ws = G.workers(id).sort((a, b) => G.workerBonus(a, BUILDING_BY_ID[id]) - G.workerBonus(b, BUILDING_BY_ID[id]));
      if (ws.length) G.assign(ws[0].uid, null); else return;
    }
    if (G.assign(uid, { t: 'b', id })) { sfx('gob'); this.toast(`${esc(G.gob(uid).name)} now works at the ${BUILDING_BY_ID[id].name}!`, 'good', 'goblin'); }
    this.closeModal(); this.rerender();
  },
  'assign-def'(el) {
    const G = this.G, uid = +el.dataset.uid;
    if (G.defenders().length >= G.defenderSlots()) { this.toast('Defender slots full! Upgrade the Barracks.', 'bad'); return; }
    G.assign(uid, { t: 'def' }); sfx('gob'); this.goblinModal(uid); this.rerender();
  },
  'def-slot'() {
    const G = this.G;
    this.pickGoblins({ title: 'Choose a defender', filter: g => !(g.assign && (g.assign.t === 'exp' || g.assign.t === 'def')), onDone: ([uid]) => { G.assign(uid, { t: 'def' }); sfx('gob'); this.rerender(); } });
  },
  'train'(el) {
    const G = this.G, uid = +el.dataset.uid, n = G.train(uid, +el.dataset.n);
    if (n) { sfx('buy'); this.goblinModal(uid); } else { sfx('error'); this.toast('Not enough mushrooms!', 'bad', 'shroom'); }
  },
  'dismiss'(el) {
    const G = this.G, uid = +el.dataset.uid, g = G.gob(uid);
    this.confirm('Dismiss goblin?', `${esc(g.name)} will pack their sock and leave forever. You get some mushrooms back.`, 'Dismiss', () => {
      const r = G.dismiss(uid); if (r !== false) { this.toast(`${esc(g.name)} left. +${fmt(r)} mushrooms`, 'info', 'shroom'); this.rerender(); }
    });
  },
  'gear-pick'(el) {
    const G = this.G, uid = +el.dataset.uid, slot = el.dataset.slot;
    const items = G.s.items.filter(i => i.slot === slot).sort((a, b) => G.rarityIdx(b.rarity) - G.rarityIdx(a.rarity));
    const cur = G.gob(uid).gear[slot];
    const rows = items.map(it => `<div class="list-item r-${it.rarity}"><div class="grow small"><span class="rt">${esc(it.name)}</span><br>${slot === 'w' ? `+${pct(it.atk)} atk +${pct(it.hp)} hp` : `+${pct(it.prod)} work +${pct(it.luck)} luck`}${it.owner && it.owner !== uid ? ` <span class="muted">(on ${esc(G.gob(it.owner)?.name.split(' ')[0])})</span>` : ''}</div>
      ${it.uid === cur ? '<span class="tag">Equipped</span>' : `<button class="btn tiny" data-act="equip" data-uid="${uid}" data-id="${it.uid}">Equip</button>`}</div>`).join('');
    this.modal(`<h2 style="font-size:18px">${slot === 'w' ? 'Weapons' : 'Trinkets'}</h2><div style="max-height:55vh;overflow-y:auto;text-align:left">${rows || '<p class="muted">None yet! Win battles, explore, or forge at the Smithy.</p>'}</div>
      <div class="modal-actions">${cur ? `<button class="btn small red" data-act="unequip" data-uid="${uid}" data-slot="${slot}">Unequip</button>` : ''}<button class="btn ghost" data-act="goblin" data-uid="${uid}">Back</button></div>`, { dark: true });
  },
  'equip'(el) { this.G.equip(+el.dataset.uid, +el.dataset.id); sfx('buy'); this.goblinModal(+el.dataset.uid); },
  'unequip'(el) { this.G.unequip(+el.dataset.uid, el.dataset.slot); this.goblinModal(+el.dataset.uid); },
  'sell-item'(el) { const v = this.G.sellItem(+el.dataset.id); if (v) { sfx('coin'); this.toast(`Sold for ${v} ore`, 'good', 'ore'); this.rerender(); } },
  'sell-treasure'(el) { if (this.G.sellTreasure(el.dataset.id)) { sfx('coin'); this.rerender(); } },
  'forge'() {
    const it = this.G.forge();
    if (!it) { sfx('error'); return; }
    sfx(this.G.rarityIdx(it.rarity) >= 3 ? 'epic' : 'built');
    this.toast(`Forged: <span class="rt r-${it.rarity}">${esc(it.name)}</span>`, 'good', it.slot === 'w' ? 'sword' : 'star');
    this.rerender();
  },
  'recruit'(el) {
    const G = this.G, mode = el.dataset.mode;
    const ok = mode === 'basic' ? G.s.mushrooms >= G.recruitCost() : mode === 'premium' ? G.s.gems >= G.premiumCost() : G.s.tickets > 0;
    if (!ok) { sfx('error'); this.toast(mode === 'basic' ? 'Not enough mushrooms! Upgrade the Mushroom Patch.' : 'Not enough gems!', 'bad'); return; }
    G.recruit(mode);
    this.rerender();
  },
  'recruit-again'(el) { this.closeModal(); setTimeout(() => this.acts.recruit.call(this, el), 50); },
  'codex'(el) { const n = NAMED_BY_ID[el.dataset.id]; this.modal(`<div class="r-${n.rarity}"><img class="big-por" src="${goblinPortrait(n.look, 6)}" style="width:120px;height:130px"><div class="rt">${RARITIES[this.G.rarityIdx(n.rarity)].name.toUpperCase()}</div><h2>${n.name}</h2><p class="small"><i>"${n.bio}"</i></p><p class="small">${JOBS[n.job].name} · ${TRAITS[n.trait].name}</p><div class="card small"><b>${ABILITY_TEXT[n.ability.type](n.ability)}</b></div><div class="modal-actions"><button class="btn ghost" data-act="close-modal">Close</button></div></div>`, { dark: true }); },
  'region'(el) { this.show({ tab: 'region', param: el.dataset.id }, true); },
  'party'() {
    const G = this.G;
    this.pickGoblins({
      title: 'Battle Party', max: 4, filter: g => !(g.assign && g.assign.t === 'exp'), selected: G.battleTeam().map(g => g.uid),
      info: (sel) => `Team power: <b>${fmt(sel.reduce((t, u) => t + G.goblinPower(G.gob(u)), 0))}</b> · Warriors tank, Thieves crit, Alchemists splash, Scouts attack fast.`,
      onDone: (sel) => { G.s.party = sel; this.rerender(); },
    });
  },
  'fight'(el) { sfx('battle'); this.startBattle(el.dataset.id, +el.dataset.stage); },
  'exped-region'(el) { this.expRegion = el.dataset.id; this.openTab('explore', 'exped'); },
  'exp-reg'(el) { this.expRegion = el.dataset.id; this.rerender(); },
  'exp-start'(el) {
    const G = this.G, rid = el.dataset.id, mid = el.dataset.m;
    if (G.activeExpeditions().length >= G.expSlots()) { this.toast('All expedition slots busy! Upgrade the Lodge.', 'bad'); return; }
    const avail = (g) => !(g.assign && (g.assign.t === 'exp'));
    const party = new Set(G.battleTeam().map(g => g.uid));
    const suggestion = G.s.goblins.filter(avail).sort((a, b) => (party.has(a.uid) - party.has(b.uid)) || G.goblinPower(b) - G.goblinPower(a)).slice(0, 3).map(g => g.uid);
    this.pickGoblins({
      title: `${MISSIONS.find(m => m.id === mid).name} · ${REGION_BY_ID[rid].name}`, max: 3, filter: avail, selected: suggestion,
      info: (sel) => sel.length ? `Success chance: <b class="${G.expChance(rid, mid, sel) > 0.6 ? 'green-t' : 'red-t'}">${Math.round(G.expChance(rid, mid, sel) * 100)}%</b> · Time: <b>${fmtTime(G.expDuration(mid, sel))}</b><br><span class="muted">Workers sent away stop working until they return.</span>` : 'Pick up to 3 goblins.',
      onDone: (sel) => { if (sel.length && G.startExpedition(rid, mid, sel)) { sfx('whoosh'); this.toast('Expedition departed!', 'good', 'map'); this.rerender(); } },
    });
  },
  'claim-exp'(el) { const r = this.G.claimExpedition(+el.dataset.id); if (r) { this.showExpResult(r); this.rerender(); } },
  'rush'(el) { if (this.G.rushExpedition(+el.dataset.id)) { sfx('whoosh'); this.rerender(); } else sfx('error'); },
  'defend'() { this.startDefense(); },
  'defend-side'() {
    const G = this.G, inv = G.rt.invasion; if (!inv) return;
    this.modal(`<img src="${icon('castle', 5)}" style="width:50px"><h2>${esc(inv.name)} attack!</h2><p>Enemies: ${inv.enemies.map(e => e.name).join(', ')}</p><p class="small muted">Strength ${fmt(this.G.invasionPower())}. If you don't fight, your defenders auto-battle when they arrive.</p>
      <div class="row" style="justify-content:center;gap:4px">${inv.enemies.map(e => `<img src="${eThumb(e.kind)}" style="width:44px">`).join('')}</div>
      <div class="modal-actions"><button class="btn red" data-act="defend">⚔️ Fight now!</button><button class="btn ghost" data-act="tab" data-tab="explore" data-sub="defense">Defenders</button></div>`);
  },
  'event'() { sfx('event'); this.showEvent(); },
  'ev-choice'(el) {
    const out = this.G.resolveEvent(+el.dataset.i);
    if (out) { sfx('coin'); this.modal(`<h2>Outcome</h2><p>${esc(out)}</p><div class="modal-actions"><button class="btn" data-act="close-modal">Ha!</button></div>`); this.G.pushLog(out); }
  },
  'goto-fire'() { const f = this.G.rt.fires[0]; if (f) { this.closeSheet(); this.world.focusBuilding(f.bid); } },
  'claim-login'() { const got = this.G.claimLogin(); if (got) { sfx('achieve'); this.toast('Login reward: ' + got.join(', '), 'good', 'gem'); this.rerender(); } },
  'claim-story'() {
    const got = this.G.claimStory();
    if (got) { sfx('achieve'); this.toast('Quest complete! ' + got.join(', '), 'good', 'scroll'); this.flyCoins(innerWidth / 2, 120, 8); this.rerender(); }
  },
  'claim-daily'(el) { if (this.G.claimDaily(+el.dataset.i)) { sfx('achieve'); this.rerender(); } },
  'claim-bonus'() { if (this.G.claimDailyBonus()) { sfx('achieve'); this.toast('+40 gems!', 'good', 'gem'); this.rerender(); } },
  'claim-league'() { const p = this.G.claimLeague(); if (p) { sfx('achieve'); this.toast(`+${p.gems} gems!`, 'good', 'trophy'); this.rerender(); } },
  'perk'(el) { if (this.G.buyPerk(el.dataset.id)) { sfx('milestone'); this.rerender(); } else sfx('error'); },
  'prestige'() {
    const G = this.G;
    if (!G.canPrestige()) { sfx('error'); return; }
    this.confirm('Pack up the capital?', `You'll gain <b>${fmt(G.teethGain())} Golden Teeth</b> (+${fmt(G.teethGain() * 2)}% income forever). Buildings, gold, districts and research reset. Goblins, gear, treasures, gems & conquests stay.`, 'Move!', () => {
      const n = G.prestige();
      this.closeSheet();
      this.world.terrainDirty = true;
      this.world.focusBuilding('shroom');
      sfx('levelup');
      this.modal(`<img src="${icon('tooth', 6)}" style="width:60px"><h2>New Capital, Same Goblins!</h2><p>Your goblins hauled everything to a fresh swamp, complaining the whole way.</p><p class="gold-t"><b>+${fmt(n)} Golden Teeth!</b></p><p class="small">Spend teeth in the Tooth Shrine (More → Prestige).</p><div class="modal-actions"><button class="btn gold" data-act="close-modal">Let's go!</button></div>`);
    }, 'gold');
  },
  'reroll'() { if (this.G.rerollMerchant()) { sfx('coin'); this.rerender(); } else sfx('error'); },
  'buy-offer'(el) {
    const r = this.G.buyOffer(+el.dataset.i);
    if (r) { sfx('coin'); if (typeof r === 'object' && r.slot) this.toast(`Got: <span class="rt r-${r.rarity}">${esc(r.name)}</span>`, 'good'); else if (typeof r === 'string') this.toast('Treasure acquired: ' + TREASURES[r].name, 'good', 'chest'); this.rerender(); }
    else sfx('error');
  },
  'warp'(el) {
    const r = this.G.timeWarp(+el.dataset.h);
    if (r) { sfx('golden'); this.toast(`Time warp! +${fmt(r.gold)} gold`, 'good', 'hourglass'); this.flyCoins(innerWidth / 2, innerHeight / 2, 12); this.rerender(); } else sfx('error');
  },
  'exchange'(el) { if (this.G.exchange(el.dataset.k)) { sfx('coin'); } else sfx('error'); },
  'share'() { this.share(); },
  'toggle'(el) {
    const s = this.G.s.settings, k = el.dataset.k;
    s[k] = !s[k];
    if (k === 'sound') setSfx(s.sound);
    if (k === 'music') setMusic(s.music);
    this.rerender();
  },
  'rename'() { const v = $('#cap-name').value.trim().slice(0, 22); if (v) { this.G.s.name = v; this.toast('Capital renamed to ' + esc(v), 'good'); this.G.save(); } },
  'save-now'() { this.G.save(); this.toast('Saved!', 'good'); },
  'export'() {
    const code = this.G.exportSave();
    this.modal(`<h2>Save Code</h2><p class="small">Copy this somewhere safe. Paste it into "Import save" on any device.</p><textarea class="txt" readonly id="m-code">${code}</textarea><div class="modal-actions"><button class="btn" id="m-copy">Copy</button><button class="btn ghost" data-act="close-modal">Close</button></div>`);
    $('#m-copy').onclick = () => { const t = $('#m-code'); t.select(); navigator.clipboard?.writeText(code).then(() => this.toast('Copied!', 'good')).catch(() => document.execCommand('copy')); };
  },
  'import'() {
    this.modal(`<h2>Import Save</h2><p class="small">Paste a save code. This replaces your current game!</p><textarea class="txt" id="m-code"></textarea><div class="modal-actions"><button class="btn red" id="m-imp">Import</button><button class="btn ghost" data-act="close-modal">Cancel</button></div>`);
    $('#m-imp').onclick = () => { if (this.G.importSave($('#m-code').value)) { location.reload(); } else this.toast('That save code looks broken.', 'bad'); };
  },
  'reset'() { this.confirm('Delete everything?', 'This permanently deletes your capital, goblins and all progress.', 'Delete', () => { this.G.hardReset(); location.reload(); }); },
};
