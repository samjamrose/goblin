// Plays every soundtrack in a headless browser and measures its loudness (catches silent or clipping tracks).
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const p = await b.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => {
    // tap everything that reaches the speakers into an analyser
    const orig = AudioNode.prototype.connect;
    AudioNode.prototype.connect = function (dest, ...rest) {
      if (dest instanceof AudioDestinationNode) {
        const ctx = dest.context;
        if (!ctx.__an) { ctx.__an = ctx.createAnalyser(); ctx.__an.fftSize = 2048; window.__an = ctx.__an; }
        orig.call(this, ctx.__an);
      }
      return orig.call(this, dest, ...rest);
    };
  });
  await p.goto('http://localhost:8123/');
  await p.waitForTimeout(1200);
  await p.click('#m-start');
  const res = await p.evaluate(async () => {
    const A = await import('/src/audio.js');
    A.setSfx(false); A.setMusic(true); A.unlockAudio();
    const out = {};
    const measure = () => new Promise(r => {
      const an = window.__an, buf = new Float32Array(an.fftSize); let sum = 0, peak = 0, n = 0;
      const iv = setInterval(() => { an.getFloatTimeDomainData(buf); for (const v of buf) { sum += v * v; peak = Math.max(peak, Math.abs(v)); n++; } }, 50);
      setTimeout(() => { clearInterval(iv); r({ rms: Math.sqrt(sum / n), peak }); }, 4000);
    });
    for (const id of [...A.TOWN_TRACKS, 'battle', 'boss']) {
      if (id === 'battle' || id === 'boss') A.setMusicMode(id); else { A.setMusicMode('town'); A.setTownTrack(id); }
      await new Promise(r => setTimeout(r, 900));
      out[id] = await measure();
    }
    return out;
  });
  for (const [k, v] of Object.entries(res)) console.log(k.padEnd(12), 'rms', v.rms.toFixed(4), 'peak', v.peak.toFixed(3));
  console.log(errs.length ? 'ERRORS ' + errs.join('; ') : 'no errors');
  await b.close();
})();
