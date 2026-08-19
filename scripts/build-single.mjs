// בונה את prototype-single.html — קובץ יחיד עצמאי מתוך dist/.
// שימוש: npm run build:single  (מריץ vite build ואז את הסקריפט הזה)
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';

const dir = 'dist/assets';
const files = readdirSync(dir);
const js = readFileSync(`${dir}/${files.find((f) => f.endsWith('.js'))}`, 'utf8');
const css = readFileSync(`${dir}/${files.find((f) => f.endsWith('.css'))}`, 'utf8');

let html = readFileSync('index.html', 'utf8');
html = html.replace(/\s*<script type="module" src="[^"]*"><\/script>/, '');
// replacer כפונקציה — מחרוזת החלפה הייתה מפרשת רצפי $ שקיימים בבאנדל
html = html.replace(
  '</head>',
  () => `    <script type="module">${js}</script>\n    <style>${css}</style>\n  </head>`,
);
writeFileSync('prototype-single.html', html);
console.log(`prototype-single.html — ${(html.length / 1024).toFixed(0)}KB`);
