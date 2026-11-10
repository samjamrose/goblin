// Generates the app icons (icons/icon-192.png, icons/icon-512.png) from the game's own sprite code.
const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  await p.goto('http://localhost:8123/');
  await p.waitForTimeout(1200);
  const urls = await p.evaluate(async () => {
    const S = await import('/src/sprites.js');
    const look = { skin: '#6cbf45', hat: 'crown', outfit: '#8a3a2a', tool: 'bag', ears: 2, nose: 2, eyes: 0, teeth: 2 };
    const out = {};
    for (const size of [192, 512]) {
      const c = document.createElement('canvas'); c.width = c.height = size;
      const ctx = c.getContext('2d'); ctx.imageSmoothingEnabled = false;
      const g = ctx.createRadialGradient(size / 2, size * 0.45, size * 0.1, size / 2, size / 2, size * 0.7);
      g.addColorStop(0, '#ffd860'); g.addColorStop(1, '#c87a10');
      ctx.fillStyle = '#1c1424'; ctx.fillRect(0, 0, size, size);
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(size / 2, size / 2, size * 0.46, 0, 7); ctx.fill();
      const sh = S.goblinSheet(look);
      const sc = Math.floor(size / 32);
      ctx.drawImage(sh.sheet, 8 * S.GOB_W, 0, S.GOB_W, S.GOB_H, (size - S.GOB_W * sc) / 2, (size - S.GOB_H * sc) / 2 + sc, S.GOB_W * sc, S.GOB_H * sc);
      out[size] = c.toDataURL('image/png');
    }
    return out;
  });
  fs.mkdirSync('icons', { recursive: true });
  for (const s in urls) fs.writeFileSync(`icons/icon-${s}.png`, Buffer.from(urls[s].split(',')[1], 'base64'));
  console.log('icons written');
  await b.close();
})();
