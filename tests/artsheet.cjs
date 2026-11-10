// Renders a contact sheet of all buildings (tiers 0-4), named goblins and enemies for visual review.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1400, height: 2100 } });
  await p.goto('http://localhost:8123/');
  await p.waitForTimeout(1500);
  await p.evaluate(async () => {
    const S = await import('/src/sprites.js');
    const D = await import('/src/data.js');
    const c = document.createElement('canvas');
    c.width = 1400; c.height = 2100;
    c.style.cssText = 'position:fixed;inset:0;z-index:999;background:#4f8a3a;image-rendering:pixelated';
    document.body.appendChild(c);
    const ctx = c.getContext('2d'); ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#5fa83e'; ctx.fillRect(0, 0, 1400, 2100);
    let x = 10, y = 10;
    const sc = 2;
    for (const bd of D.BUILDINGS) {
      for (let t = 0; t < 5; t++) {
        const spr = S.buildingSprite(bd.id, bd.w, bd.h, t);
        ctx.drawImage(spr, x + t * (spr.width * sc + 6), y, spr.width * sc, spr.height * sc);
      }
      const spr = S.buildingSprite(bd.id, bd.w, bd.h, 0);
      ctx.fillStyle = '#000'; ctx.font = '12px sans-serif'; ctx.fillText(bd.id, x, y + spr.height * sc + 10);
      x += 5 * (spr.width * sc + 6) + 20;
      if (x > 1000) { x = 10; y += 175; }
    }
    y += 190; x = 10;
    for (const n of D.NAMED) {
      const sh = S.goblinSheet(n.look);
      ctx.drawImage(sh.sheet, 0, 0, S.GOB_W, S.GOB_H, x, y, S.GOB_W * 3, S.GOB_H * 3);
      x += S.GOB_W * 3 + 4;
      if (x > 1300) { x = 10; y += S.GOB_H * 3 + 6; }
    }
    y += S.GOB_H * 3 + 10; x = 10;
    for (const k of Object.keys(D.ENEMIES)) {
      ctx.drawImage(S.enemySprite(k), x, y, 64, 64);
      x += 70;
    }
    x = 10; y += 80;
    for (const r of D.REGIONS) { ctx.drawImage(S.enemySprite(r.boss.type, r.boss.tint, true), x, y, 96, 96); x += 100; }
  });
  await p.waitForTimeout(300);
  await p.screenshot({ path: (process.env.SHOTS || '/tmp/claude-0/shots') + '/artsheet.png' });
  await b.close();
})();
