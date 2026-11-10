// Bundles the game into a single self-contained file: dist/index.html
// Usage: npm run build
import { build } from 'esbuild';
import fs from 'fs';

const res = await build({
  entryPoints: ['src/main.js'],
  bundle: true,
  minify: true,
  format: 'iife',
  target: ['es2020'],
  write: false,
  legalComments: 'none',
});
const js = res.outputFiles[0].text;
const css = fs.readFileSync('src/style.css', 'utf8');
let html = fs.readFileSync('index.html', 'utf8');
html = html.replace('<link rel="stylesheet" href="src/style.css">', () => `<style>${css}</style>`);
html = html.replace('<script type="module" src="src/main.js"></script>', () => `<script>${js.replace(/<\/script/g, '<\\/script')}</script>`);
// inline the icon so the single file stays self-contained
const iconData = 'data:image/png;base64,' + fs.readFileSync('icons/icon-192.png').toString('base64');
html = html.replace('<link rel="manifest" href="manifest.webmanifest">\n', '');
html = html.split('href="icons/icon-192.png"').join(`href="${iconData}"`);
fs.mkdirSync('dist', { recursive: true });
fs.writeFileSync('dist/index.html', html);
console.log(`dist/index.html written (${(html.length / 1024).toFixed(1)} KB)`);

// Variant for embedding in hosts that supply their own <html>/<head>/<body> shell
const inner = html
  .replace(/<!doctype html>\s*/i, '')
  .replace(/<html[^>]*>\s*/i, '').replace(/<\/html>\s*/i, '')
  .replace(/<head>\s*/i, '').replace(/<\/head>\s*/i, '')
  .replace(/<body>\s*/i, '').replace(/<\/body>\s*/i, '')
  .replace(/<meta charset="utf-8">\s*/i, '');
fs.writeFileSync('dist/embed.html', inner);
