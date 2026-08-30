// מפיק את גרסת ה-Artifact מתוך prototype-single.html.
// מסיר את מעטפת <!doctype>/<html>/<head>/<body> בלי להסתמך על מספרי
// שורות — זה בדיוק מה שנשבר כשגודל הבאנדל השתנה.
import { readFileSync, writeFileSync } from 'node:fs';

const src = readFileSync('prototype-single.html', 'utf8');
const head = src.slice(src.indexOf('<head>') + 6, src.indexOf('</head>'));
const bodyStart = src.indexOf('<body>') + 6;
const body = src.slice(bodyStart, src.indexOf('</body>'));

// meta charset/viewport מסופקים ע"י מעטפת ה-Artifact; הכותרת שלנו נשארת
const inner = head.replace(/\s*<meta[^>]*>/g, '');

const out = [
  '<title>מר יפן — Progress</title>',
  '<script>document.documentElement.lang="he";document.documentElement.dir="rtl";</script>',
  inner.trim(),
  body.trim(),
  '',
].join('\n');

const dest = process.argv[2] ?? 'artifact.html';
writeFileSync(dest, out);
console.log(`${dest} — ${(out.length / 1024).toFixed(0)}KB (מקור ${(src.length / 1024).toFixed(0)}KB)`);
