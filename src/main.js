// Entry point: boot the game, wire systems together, run the loop.
import { G } from './game.js';
import { World } from './world.js';
import { BattleScreen } from './battle.js';
import { UI } from './ui.js';
import { sfx, setSfx, setMusic, unlockAudio, setTownTrack, setMusicMode, TRACKS } from './audio.js';
import { createCloud } from './cloud.js';
import { BUILDING_BY_ID, TILE, TREASURES, REGION_BY_ID } from './data.js';
import { fmt } from './util.js';
import { goblinPortrait, icon } from './sprites.js';

const store = (() => { try { const k = '__t'; localStorage.setItem(k, '1'); localStorage.removeItem(k); return localStorage; } catch (e) { return null; } })();

function haptic(ms) { if (G.s?.settings.haptics && navigator.vibrate) try { navigator.vibrate(ms); } catch (e) { } }

async function boot() {
  try { await Promise.race([document.fonts?.load('600 14px "Pixelify Sans"'), new Promise(r => setTimeout(r, 1500))]); } catch (e) { }
  const offline = G.init(store);
  setSfx(G.s.settings.sound);
  setMusic(G.s.settings.music);
  G.checkTracks();
  setTownTrack(G.s.tracks && G.s.tracks[G.s.settings.track] ? G.s.settings.track : 'mudlight');

  let ui;
  const world = new World(document.getElementById('world'), G, {
    sfx, haptic,
    onBuilding: (id) => { ui.openTab('build'); ui.show({ tab: 'building', param: id }, true); },
    onGoblin: () => { },
    onDistrict: (id) => { ui.openTab('build', 'districts'); },
    onBuilt: (id) => { sfx('built'); },
  });
  const battle = new BattleScreen(document.getElementById('battle'), { sfx, haptic, music: setMusicMode });
  ui = new UI(G, world, battle);
  ui.init();
  // ---------------- cloud save (claude.ai): survives updates, app restarts and devices
  const cloud = createCloud(G, (remote) => {
    G.s = G.migrate(remote);
    G.fixDjSpot();
    G.save();
    const off = G.applyOffline();
    world.buildGrid(); world.agents.clear(); world.terrainDirty = true;
    setSfx(G.s.settings.sound); setMusic(G.s.settings.music); setTownTrack(G.s.settings.track || 'mudlight');
    ui.modalQueue = []; ui.closeModal(); ui.closeSheet();
    ui.toast(`☁️ Loaded your saved capital: ${G.s.name}`, 'good', 'house');
    if (off) ui.showOffline(off);
  });
  G.on('saved', () => cloud.push(false));
  window.__game = { G, world, ui, battle, cloud };

  // ---------------- event wiring
  G.on('toast', (t, k) => ui.toast(t, k));
  G.on('build', (id) => { world.onBuild(id); sfx('build'); });
  G.on('upgrade', (id, n) => world.onUpgrade(id, n));
  G.on('milestone', (id, lvl) => { world.onMilestone(id, lvl); sfx('milestone'); ui.toast(`${BUILDING_BY_ID[id].name} reached Lv ${lvl}! Income ×2!`, 'good', 'star'); haptic(20); });
  G.on('levelup', (lvl, gems) => { ui.showLevelUp(lvl, gems); haptic(40); });
  G.on('recruit', (g, info) => ui.showRecruit(g, info));
  G.on('achievement', a => { sfx('achieve'); ui.toast(`🏆 ${a.name} (+${a.gems} gems)`, 'ach', 'trophy'); });
  G.on('district', () => { world.terrainDirty = true; });
  G.on('pop', (b) => {
    const d = G.pos(b.bid);
    const [sx, sy] = world.toScreen((d.tx + d.w / 2) * TILE, d.ty * TILE - 16);
    ui.flyCoins(sx, sy, 5);
  });
  G.on('golden', () => { ui.toast('✨ A Golden Goblin appeared! Catch it!', 'good', 'coin'); });
  G.on('goldenCaught', (kind, text) => { ui.toast(text, 'good', 'coin'); if (kind === 'lucky') ui.flyCoins(innerWidth / 2, innerHeight / 2, 12); });
  G.on('eventSpawn', () => { sfx('event'); });
  G.on('ambient', (t) => { document.getElementById('ticker-txt').textContent = t; });
  G.on('log', (t) => { document.getElementById('ticker-txt').textContent = t; });
  G.on('disaster', (type, n) => {
    if (type === 'fire') { sfx('fire'); sfx('alarm'); ui.toast('🔥 FIRE! Tap the burning buildings to put it out!', 'bad', 'fire'); const f = G.rt.fires[0]; if (f) world.focusBuilding(f.bid); }
    else { sfx('squeak'); ui.toast(`🐀 ${n} rats are raiding the mushrooms! Tap them!`, 'bad', 'rat'); }
    haptic([30, 40, 30]);
  });
  G.on('burned', (id) => { ui.toast(`The ${BUILDING_BY_ID[id].name} burned! Income halved for a while.`, 'bad', 'fire'); });
  G.on('ratEscaped', (r, lost) => { });
  G.on('invasion', (inv) => { sfx('alarm'); ui.toast(`⚔️ ${inv.name} are invading! 45s until they arrive!`, 'bad', 'castle'); haptic([50, 50, 50]); });
  G.on('invasionResult', (r) => {
    if (battle.active) return;
    if (r.injured && r.injured.length) setTimeout(() => ui.toast(`🩹 ${r.injured.length} defender(s) went to the Infirmary.`, 'bad', 'heart'), 1500);
    if (r.won) { sfx('victory'); ui.toast('🛡️ Your defenders repelled the invaders! ' + r.got.join(', '), 'good', 'shield'); }
    else { sfx('defeat'); ui.toast(`The invaders stole ${fmt(r.lost)} gold${r.damaged ? ' and wrecked the ' + BUILDING_BY_ID[r.damaged].name : ''}!`, 'bad', 'castle'); }
  });
  G.on('expDone', (e) => { sfx('sparkle'); ui.toast('An expedition has returned from ' + REGION_BY_ID[e.region].name + '!', 'good', 'chest'); });
  G.on('conquer', (r) => { ui.toast(`👑 ${r.name} CONQUERED! ${r.reward.text}`, 'ach', 'crown'); });
  G.on('treasure', (k) => { });
  G.on('storyClaim', () => { });
  G.on('newDay', () => { if (G.s.tut.intro) ui.toast('A new day! Fresh daily quests & login reward.', 'good', 'scroll'); });
  G.on('item', () => { });
  G.on('repaired', (id) => { });
  G.on('medic', (g, src) => { sfx('achieve'); ui.toast(src === 'infirmary' ? `🩺 ${g.name} reports for duty at the Infirmary!` : `🩺 New medic earned: ${g.name}!`, 'good', 'heart'); });
  G.on('trackUnlocked', (id) => { sfx('achieve'); ui.toast(`🎵 New track at the DJ Stand: ${TRACKS[id].name}!`, 'ach', 'music'); });
  G.on('medicGems', (n) => ui.toast(`Your infirmary is fully staffed: a medic reward became ${n} gems!`, 'good', 'gem'));
  G.on('healed', (g) => { if (!battle.active) ui.toast(`${g.name} is healed and back to work!`, 'good', 'heart'); });
  G.on('placed', () => { world.terrainDirty = true; });

  // ---------------- first launch intro / offline
  G.slowTick();
  const isNew = !G.s.tut.intro;
  document.getElementById('loading').classList.add('hide');
  world.focusBuilding('shroom');
  world.cam.y += 10;
  if (isNew) {
    ui.modal(`<img src="${goblinPortrait({ skin: '#6cbf45', hat: 'crown', outfit: '#8a3a2a', tool: 'scepter', ears: 2, nose: 2, eyes: 0, teeth: 2, extra: 'beard' }, 5)}" style="width:110px">
      <h2>Welcome, Boss!</h2>
      <p>I'm Grubnose, your loyal advisor. Your tribe has a muddy camp, two goblins, and a dream: <b>the greatest goblin capital ever!</b></p>
      <p class="small muted">Build businesses, recruit goblins, explore, fight, and get stupidly rich.</p>
      <p><b>Name your capital:</b></p>
      <input class="txt" id="m-capname" maxlength="22" value="Gobtropolis">
      <div class="modal-actions"><button class="btn gold" id="m-start">Let's get rich!</button></div>`, { dismissable: false });
    document.getElementById('m-start').onclick = () => {
      unlockAudio();
      const v = document.getElementById('m-capname').value.trim().slice(0, 22);
      if (v) G.s.name = v;
      G.s.tut.intro = true;
      G.save();
      ui.closeModal();
      sfx('levelup');
      ui.toast('Open Build (red dot) and build a Mushroom Patch!', 'info', 'shroom');
    };
  } else {
    ui.showOffline(offline);
  }
  // first shroom patch is free so the player can start immediately
  if (!G.isBuilt('shroom') && G.s.gold >= G.bizCost('shroom', 1) && isNew) { }

  // ---------------- loop
  let last = performance.now(), acc1 = 0, accSave = 0, accUi = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    try { step(now); } catch (e) { console.error(e); }
  }
  function step(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    G.tick(dt);
    acc1 += dt; accSave += dt; accUi += dt;
    if (acc1 >= 1) { acc1 = 0; G.slowTick(); ui.badges(); ui.flushQueue(); }
    if (accSave >= 5) { accSave = 0; G.save(); }
    if (battle.active) { battle.update(dt); battle.render(); }
    else { world.update(dt); world.render(); }
    ui.hud();
    if (accUi >= 0.25) { accUi = 0; ui.refresh(); }
  }
  requestAnimationFrame(frame);

  window.addEventListener('resize', () => { world.resize(); if (battle.active) battle.resize(); });
  // never let the app container scroll (focus/scrollIntoView or the mobile keyboard can shift it)
  const app = document.getElementById('app');
  app.addEventListener('scroll', () => { if (app.scrollTop || app.scrollLeft) { app.scrollTop = 0; app.scrollLeft = 0; } });
  window.addEventListener('scroll', () => { if (window.scrollY || window.scrollX) window.scrollTo(0, 0); });
  document.addEventListener('focusout', () => setTimeout(() => { app.scrollTop = 0; window.scrollTo(0, 0); }, 50));
  document.addEventListener('visibilitychange', () => { if (document.hidden) G.save(); else { const r = G.applyOffline(); if (r && r.away > 60) ui.showOffline(r); } });
  window.addEventListener('pagehide', () => { G.save(); cloud.push(true); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) cloud.push(true); });
  // an imported or reset game should replace the cloud copy, not be replaced by it
  let keepLocal = false;
  try { keepLocal = store && store.getItem('gct_keep_local') === '1'; if (keepLocal) store.removeItem('gct_keep_local'); } catch (e) { }
  cloud.connect(keepLocal);
  window.addEventListener('pointerdown', unlockAudio, { once: true });
}

// Offline support when hosted as a website (not inside claude.ai, which runs the game in a frame)
try {
  const hosted = location.protocol === 'https:' || location.hostname === 'localhost';
  if ('serviceWorker' in navigator && hosted && window.top === window && !window.claude) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => { }));
  }
} catch (e) { }

boot().catch(e => {
  console.error(e);
  const l = document.getElementById('loading');
  if (l) l.innerHTML = `<div class="ld-title">Oops!</div><div class="ld-sub">A goblin chewed through the code: ${String(e.message || e)}</div>`;
});
