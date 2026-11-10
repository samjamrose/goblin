// End-to-end test: drives every screen & feature in a phone-sized browser and fails on any JS error.
// Usage: node tests/serve.mjs . 8123 &  node tests/e2e.cjs [url]
const { chromium, devices } = require('playwright');
const URL = process.argv[2] || 'http://localhost:8123/';
const SHOTS = process.env.SHOTS || null;

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices['iPhone 13'] });
  const p = await ctx.newPage();
  const errs = [];
  const fails = [];
  p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  p.on('pageerror', e => errs.push('PAGEERR ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 4).join('\n')));
  const check = (cond, msg) => { if (!cond) fails.push(msg); else process.stdout.write('.'); };
  const ev = (fn, arg) => p.evaluate(fn, arg);
  const wait = (ms) => p.waitForTimeout(ms);
  const shot = async (n) => { if (SHOTS) await p.screenshot({ path: `${SHOTS}/e2e-${n}.png` }); };
  const tab = async (t, sub) => { await ev(([t, sub]) => window.__game.ui.openTab(t, sub), [t, sub]); await wait(150); };
  const closeModals = () => ev(() => { const ui = window.__game.ui; for (let i = 0; i < 6; i++) { ui.modalQueue = []; ui.closeModal(); } });

  await p.goto(URL);
  await wait(1200);
  // ---- intro
  check(await p.isVisible('#m-start'), 'intro modal visible');
  await p.fill('#m-capname', 'Testopolis');
  await p.click('#m-start');
  await wait(300);
  check(await ev(() => window.__game.G.s.name) === 'Testopolis', 'capital named');

  // ---- build mushroom patch by tapping the plot on the map
  const tapWorld = async (wx, wy) => { const [sx, sy] = await ev(([x, y]) => window.__game.world.toScreen(x, y), [wx, wy]); await p.mouse.click(sx, sy); };
  await tapWorld(20.5 * 16, 19.5 * 16);
  await wait(300);
  check(await p.isVisible('#sheet.open'), 'building sheet opens on tap');
  await p.click('.sheet-body .btn.gold');
  await wait(3300);
  check(await ev(() => window.__game.G.isBuilt('shroom') && !window.__game.G.isConstructing('shroom')), 'shroom built');
  // story claim
  await p.click('#st-btn');
  await wait(200);
  check(await ev(() => window.__game.G.s.story) === 1, 'story quest 1 claimed');

  // ---- buy loop through the build tab
  await ev(() => { window.__game.G.s.gold = 2e4; });
  await tab('build');
  await wait(200);
  for (const a of ['10', '100', 'max', '1']) { await p.click(`.amt button[data-v="${a}"]`); await wait(80); }
  await p.click('[data-act=buy][data-id=shroom]');
  await p.click('[data-act=buy][data-id=mine]');
  await wait(2800);
  check(await ev(() => window.__game.G.s.buildings.mine.lvl) >= 1, 'mine built from list');
  await tab('build');
  for (const sub of ['util', 'research', 'districts', 'biz']) { await p.click(`.stab[data-sub=${sub}]`); await wait(120); }
  await shot('build');

  // ---- coin bubbles
  await ev(() => { const G = window.__game.G; G.s.timers.bubble = 0; });
  await p.click('.ibtn.close');
  await wait(400);
  const bubbles = await ev(() => window.__game.G.rt.bubbles.length);
  check(bubbles > 0, 'bubble spawned');
  if (bubbles) {
    const pos = await ev(() => { const w = window.__game.world, b = window.__game.G.rt.bubbles[0]; const [x, y] = w.bubblePos(b); w.focus(x, y, false); return w.toScreen(...w.bubblePos(b)); });
    await p.mouse.click(pos[0], pos[1]);
    await wait(200);
    check(await ev(() => window.__game.G.s.stats.bubbles) >= 1, 'bubble popped by tap');
  }

  // ---- recruit + assign
  await ev(() => { window.__game.G.s.mushrooms = 1e4; window.__game.G.s.gems = 1000; });
  await tab('goblins');
  await p.click('.stab[data-sub=recruit]');
  await p.click('[data-act=recruit][data-mode=basic]');
  await wait(1700);
  check(await p.isVisible('#modal.open .reveal'), 'recruit reveal shown');
  await shot('reveal');
  await p.click('#modal [data-act=recruit-again]');
  await wait(1700);
  await p.click('#modal [data-act=close-modal]').catch(() => {});
  await p.click('[data-act=recruit][data-mode=premium]');
  await wait(1800);
  await closeModals();
  check(await ev(() => window.__game.G.s.goblins.length) >= 4, 'goblins recruited');
  await p.click('.stab[data-sub=roster]');
  await wait(150);
  await p.click('[data-act=auto-all]');
  await wait(150);
  check(await ev(() => window.__game.G.s.goblins.filter(g => g.assign).length) >= 1, 'auto-assign works');
  // goblin modal: train, gear, assign
  await p.click('.gcard[data-act=goblin]');
  await wait(200);
  check(await p.isVisible('#modal.open'), 'goblin modal opens');
  const lvl0 = await ev(() => window.__game.G.s.goblins.reduce((t, g) => t + g.lvl, 0));
  await p.click('#modal [data-act=train][data-n="1"]');
  await wait(150);
  check(await ev(() => window.__game.G.s.goblins.reduce((t, g) => t + g.lvl, 0)) > lvl0, 'train goblin');
  await p.click('#modal [data-act=gear-pick][data-slot=w]');
  await wait(150);
  await p.click('#modal [data-act=goblin]');
  await wait(150);
  await p.click('#modal [data-act=assign-pick]');
  await wait(150);
  await p.click('#modal [data-act=assign-to]');
  await wait(150);
  await closeModals();
  for (const sub of ['codex', 'gear', 'treasures', 'roster']) { await p.click(`.stab[data-sub=${sub}]`); await wait(120); }
  await shot('roster');

  // ---- level up a lot (fast-forward) to unlock everything
  await ev(() => {
    const G = window.__game.G;
    G.s.gold = 1e9; G.s.ore = 1e5;
    for (let i = 0; i < 40 && G.s.level < 12; i++) G.addXp(1e6);
  });
  await wait(300);
  check(await ev(() => window.__game.G.s.level) >= 12, 'leveled to 12');
  await closeModals();
  // districts + utilities
  await tab('build');
  await p.click('.stab[data-sub=districts]');
  await wait(150);
  await p.click('[data-act=district][data-id=market]');
  await wait(500);
  check(await ev(() => window.__game.G.s.districts.market), 'market district unlocked via UI');
  await ev(() => { const G = window.__game.G; for (const id of ['lodge', 'research', 'barracks', 'tavern', 'smithy', 'potion', 'market']) G.buy(id, 1); G.s.buildings.lodge.built = 0; G.s.buildings.research.built = 0; G.s.buildings.barracks.built = 0; for (const id of ['tavern', 'smithy', 'potion', 'market']) G.s.buildings[id].built = 0; });
  await tab('build');
  await p.click('.stab[data-sub=research]');
  await wait(150);
  await p.click('[data-act=research]');
  await wait(150);
  check(await ev(() => Object.keys(window.__game.G.s.research).length) >= 1, 'research done via UI');
  // building detail pages for each built building
  for (const id of ['shroom', 'mine', 'tavern', 'cauldron', 'huts', 'lodge', 'research', 'barracks', 'smithy']) {
    await ev((id) => { window.__game.ui.openTab('build'); window.__game.ui.show({ tab: 'building', param: id }, true); }, id);
    await wait(100);
  }
  await ev(() => { window.__game.ui.show({ tab: 'building', param: 'mine' }, true); });
  await wait(100);
  await p.click('[data-act=assign-slot]').catch(() => {});
  await wait(150);
  await p.click('#modal .gcard').catch(() => {});
  await wait(150);
  await closeModals();
  await p.click('[data-act=back]').catch(() => {});

  // ---- expeditions
  await tab('explore');
  await p.click('.stab[data-sub=exped]');
  await wait(150);
  await p.click('[data-act=exp-start][data-m=scout]');
  await wait(200);
  await p.click('#m-ok');
  await wait(200);
  check(await ev(() => window.__game.G.s.expeditions.length) === 1, 'expedition started');
  await ev(() => { const G = window.__game.G; G.s.expeditions[0].end = G.now() - 1; });
  await wait(1200);
  await p.click('[data-act=claim-exp]');
  await wait(300);
  check(await p.isVisible('#modal.open'), 'expedition result shown');
  await shot('expedition');
  await closeModals();
  check(await ev(() => window.__game.G.s.stats.expeditions) === 1, 'expedition claimed');

  // ---- battle
  await tab('explore');
  await p.click('.stab[data-sub=regions]');
  await p.click('[data-act=region][data-id=woods]');
  await wait(150);
  await ev(() => { const G = window.__game.G; for (const g of G.s.goblins) g.lvl = 15; });
  await p.click('[data-act=fight]');
  await wait(800);
  check(await p.isVisible('#battle.show'), 'battle screen open');
  await p.click('#bt-speed'); await p.click('#bt-speed');
  for (let i = 0; i < 6; i++) await p.mouse.click(290, 560);
  await ev(() => { window.__game.battle.bombCharge = 1; });
  await p.click('#bt-bomb').catch(() => {});
  await p.waitForSelector('.bt-result.show', { timeout: 60000 });
  await shot('battle-result');
  const won = await ev(() => window.__game.G.s.stats.battlesWon);
  check(won >= 1, 'won a battle');
  await p.click('#bt-close');
  await wait(300);
  check(!(await p.isVisible('#battle.show')), 'battle closed');
  await ev(() => window.__game.ui.closeSheet());

  // ---- party picker
  await tab('explore');
  await p.click('[data-act=party]');
  await wait(150);
  await p.click('#m-ok');
  await ev(() => window.__game.ui.closeSheet());

  // ---- funny event
  await ev(() => { const G = window.__game.G; G.spawnEvent(); });
  await wait(300);
  await p.click('#side [data-act=event]', { force: true });
  await wait(200);
  await p.click('#modal [data-act=ev-choice]');
  await wait(200);
  check(await ev(() => window.__game.G.s.stats.events) === 1, 'event resolved');
  await closeModals();

  // ---- golden goblin
  await ev(() => { const w = window.__game.world; const orig = w.tap.bind(w); window.__taps = []; w.tap = (sx, sy) => { const [wx, wy] = w.toWorld(sx, sy); window.__taps.push({ sx: Math.round(sx), sy: Math.round(sy), wx: Math.round(wx), wy: Math.round(wy), golden: w.golden && [Math.round(w.golden.x), Math.round(w.golden.y)], bub: window.__game.G.rt.bubbles.length }); return orig(sx, sy); }; });
  await closeModals(); await ev(() => window.__game.ui.closeSheet());
  await ev(() => { const G = window.__game.G; G.rt.golden = { until: G.now() + 13000 }; });
  await wait(400);
  const gp = await ev(() => { const w = window.__game.world; w.camTarget = null; w.cam.vx = w.cam.vy = 0; if (!w.golden) return null; w.golden.vx = 0; w.golden.x = w.cam.x; return w.toScreen(w.golden.x, w.golden.y - 10); });
  check(!!gp, 'golden goblin visible');
  if (gp) {
    const g0 = await ev(() => window.__game.G.s.stats.golden);
    const el = await ev(([x, y]) => { const e = document.elementFromPoint(x, y); return e && (e.id || e.className); }, gp);
    await p.mouse.click(gp[0], gp[1]); await wait(200);
    check(await ev(() => window.__game.G.s.stats.golden) === g0 + 1, 'golden goblin caught (el=' + el + ', pt=' + gp.map(Math.round) + ')');
  }

  // ---- fire
  await ev(() => window.__game.G.spawnFire());
  await wait(500);
  const fireBid = await ev(() => { const G = window.__game.G, w = window.__game.world; const f = G.rt.fires[0]; if (!f) return null; w.focusBuilding(f.bid); w.cam.x = w.camTarget.x; w.cam.y = w.camTarget.y; w.camTarget = null; w.cam.vx = w.cam.vy = 0; w.clampCam(); return f.bid; });
  await wait(100); await ev(() => { const w = window.__game.world; w.camTarget = null; w.cam.vx = w.cam.vy = 0; });
  if (fireBid) {
    const pos = await ev((bid) => { const w = window.__game.world, d = window.__game.G.def(bid); return w.toScreen((d.tx + d.w / 2) * 16, (d.ty + d.h / 2) * 16); }, fireBid);
    for (let i = 0; i < 3; i++) { await p.mouse.click(pos[0], pos[1]); await wait(80); }
    check(await ev(() => window.__game.G.s.stats.fires) >= 1, 'fire extinguished');
  } else check(false, 'fire spawned');
  await ev(() => { window.__game.G.rt.fires = []; });

  // ---- rats
  await closeModals(); await ev(() => window.__game.ui.closeSheet());
  await ev(() => window.__game.G.spawnRats());
  await wait(300);
  const rat = await ev(() => { const w = window.__game.world; w.camTarget = null; w.cam.vx = w.cam.vy = 0; const [id, r] = [...w.ratsVis.entries()][0] || []; if (!r) return null; r.t = 99; r.tx = r.x; r.ty = r.y; return w.toScreen(r.x, r.y - 2); });
  if (rat) {
    const el = await ev(([x, y]) => { const e = document.elementFromPoint(x, y); return e && (e.id || e.className); }, rat);
    await p.mouse.click(rat[0], rat[1]); await wait(150);
    check(await ev(() => window.__game.G.s.stats.rats) >= 1, 'rat squashed (el=' + el + ', pt=' + rat.map(Math.round) + ')');
  } else check(false, 'rat visible');
  await ev(() => { window.__game.G.rt.rats = []; });

  // ---- invasion (fight manually)
  await closeModals(); await ev(() => window.__game.ui.closeSheet());
  await ev(() => { const G = window.__game.G; G.s.buildings.barracks.lvl = 2; for (const g of G.s.goblins.slice(0, 2)) G.assign(g.uid, { t: 'def' }); G.startInvasion(); });
  await wait(300);
  await p.click('#side [data-act=defend-side]', { force: true });
  await wait(150);
  await p.click('#modal [data-act=defend]');
  await wait(500);
  check(await p.isVisible('#battle.show'), 'defense battle open');
  await ev(() => { const b = window.__game.battle; b.speed = 3; });
  await p.waitForSelector('.bt-result.show', { timeout: 90000 });
  await p.click('#bt-close');
  check(await ev(() => !window.__game.G.rt.invasion), 'invasion resolved');
  // auto-defend path
  await ev(() => { const G = window.__game.G; G.startInvasion(); G.rt.invasion.until = G.now() - 1; });
  await wait(300);
  check(await ev(() => !window.__game.G.rt.invasion), 'invasion auto-resolved');

  // ---- quests tab
  await tab('quests');
  await wait(150);
  await p.click('[data-act=claim-login]').catch(() => {});
  for (const sub of ['achievements', 'stats', 'quests']) { await p.click(`.stab[data-sub=${sub}]`); await wait(120); }
  await shot('quests');

  // ---- more: merchant, warp, exchange, league, prestige, settings
  await ev(() => { const G = window.__game.G; G.s.gems = 2000; G.s.gold = 1e10; });
  await tab('more');
  await wait(200);
  await p.click('[data-act=buy-offer][data-i="1"]').catch(() => {});
  await wait(1700);
  await closeModals();
  await p.click('[data-act=reroll]');
  await wait(100);
  await p.click('[data-act=warp][data-h="1"]');
  await wait(100);
  await p.click('[data-act=exchange][data-k=gold2ore]');
  await shot('market');
  await p.click('.stab[data-sub=league]');
  await wait(150);
  check(await p.isVisible('.lb-row.me'), 'league shows player');
  await p.click('.stab[data-sub=prestige]');
  await wait(150);
  await ev(() => { window.__game.G.s.runGold = 5e10; });
  await wait(300);
  const goblinsBefore = await ev(() => window.__game.G.s.goblins.length);
  await p.click('[data-act=prestige]');
  await wait(150);
  await p.click('#m-yes');
  await wait(400);
  check(await ev(() => window.__game.G.s.teethEarned) > 0, 'prestige gave teeth');
  check(await ev(() => window.__game.G.s.goblins.length) === goblinsBefore, 'goblins kept after prestige');
  check(await ev(() => window.__game.G.s.buildings.mine.lvl) === 0, 'buildings reset after prestige');
  await closeModals();
  await tab('more');
  await p.click('.stab[data-sub=prestige]');
  await wait(150);
  await p.click('[data-act=perk][data-id=headstart]');
  check(await ev(() => window.__game.G.s.perks.headstart) === 1, 'perk bought');
  await p.click('.stab[data-sub=settings]');
  await wait(150);
  await p.click('[data-act=toggle][data-k=music]');
  await p.click('[data-act=toggle][data-k=music]');
  await p.click('[data-act=export]');
  await wait(150);
  const code = await p.inputValue('#m-code');
  check(code.length > 100, 'export save code');
  await closeModals();

  // ---- save / reload / offline
  await ev(() => { const G = window.__game.G; G.s.gold = 12345; G.save(); });
  const saved = await ev(() => JSON.parse(localStorage.getItem('goblin_capital_tycoon_v1')));
  check(saved && saved.name === 'Testopolis', 'save written');
  // pretend we were away for 2 hours
  await ev(() => { const s = JSON.parse(localStorage.getItem('goblin_capital_tycoon_v1')); s.lastSave -= 2 * 3600e3; localStorage.setItem('goblin_capital_tycoon_v1', JSON.stringify(s)); });
  await p.evaluate(() => { window.removeEventListener('pagehide', () => {}); window.__game.G.storage = null; });
  await p.reload();
  await wait(1500);
  check(await p.isVisible('#modal.open'), 'welcome back modal');
  await shot('offline');
  check(await ev(() => window.__game.G.s.name) === 'Testopolis', 'save loaded after reload');
  check(await ev(() => window.__game.G.s.teethEarned) > 0, 'teeth persisted');
  await closeModals();

  // ---- import save
  await ev((code) => { window.__importOk = window.__game.G.importSave(code); }, code);
  check(await ev(() => window.__importOk), 'import save works');

  // ---- share (fallback modal path)
  await ev(() => { navigator.share = undefined; navigator.canShare = undefined; });
  await tab('more');
  await p.click('.stab[data-sub=shop]');
  await p.click('[data-act=share]');
  await wait(500);
  check(await p.isVisible('#modal.open img'), 'share card rendered');
  await shot('share');
  await closeModals();

  // ---- sustained run: let the world simulate for a while
  await ev(() => window.__game.ui.closeSheet());
  await wait(4000);

  console.log('\n');
  if (errs.length) console.log('JS ERRORS:\n' + errs.join('\n'));
  if (fails.length) console.log('FAILED CHECKS:\n - ' + fails.join('\n - '));
  console.log(errs.length || fails.length ? 'E2E FAILED' : 'E2E PASSED');
  await browser.close();
  process.exit(errs.length || fails.length ? 1 : 0);
})().catch(e => { console.error('E2E CRASH', e); process.exit(1); });
