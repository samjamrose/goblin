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
fs.mkdirSync('dist', { recursive: true });
fs.writeFileSync('dist/index.html', html);
console.log(`dist/index.html written (${(html.length / 1024).toFixed(1)} KB)`);
