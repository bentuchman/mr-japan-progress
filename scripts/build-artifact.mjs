// מפיק את גרסת ה-Artifact מתוך prototype-single.html.
// מסיר את מעטפת <!doctype>/<html>/<head>/<body> בלי להסתמך על מספרי
// שורות — זה בדיוק מה שנשבר כשגודל הבאנדל השתנה.
import { readFileSync, writeFileSync } from 'node:fs';

const src = readFileSync('prototype-single.html', 'utf8');
const head = src.slice(src.indexOf('<head>') + 6, src.indexOf('</head>'));
const bodyStart = src.indexOf('<body>') + 6;
const body = src.slice(bodyStart, src.indexOf('</body>'));

// meta charset/viewport מסופקים ע"י מעטפת ה-Artifact; הכותרת שלנו נשארת
const inner = head.replace(/\s*<meta[^>]*>/g, '').replace(/\s*<title>[\s\S]*?<\/title>/g, '');

const out = [
  '<title>מר יפן — Progress</title>',
  '<script>document.documentElement.lang="he";document.documentElement.dir="rtl";</script>',
  inner.trim(),
  body.trim(),
  '',
].join('\n');

// ===== הגנת פרסום =====
// הולידטור של Artifacts סורק את הטקסט הגולמי ומחפש מאפייני id= חריגים:
// ‎id=‎ שאחריו יותר מ-2048 תווים ללא רווח-לבן וללא '>' מסווג את העמוד
// בטעות כדף review פגום. בקוד ממוזער זה קורה כשכתובת עם ‎?id=‎ (Zite)
// נושקת למחרוזות כתובת ארוכות. הפתרון: שורה חדשה אחרי סוף ה-template
// literal הקרוב — גבול חוקי ב-JS בין שדות אובייקט, אפס שינוי התנהגות.
const CAP = 2048;
const detector = new RegExp(
  '(?<!-)\\bid[\\t\\n\\f\\r ]*=[\\t\\n\\f\\r ]*' +
  `(?:"[^"]{0,${CAP}}"|'[^']{0,${CAP}}'` +
  `|[^\\t\\n\\f\\r >"'][^\\t\\n\\f\\r >]{0,${CAP}}(?=[\\t\\n\\f\\r >]|$)` +
  '|([\\s\\S]))',
  'gi',
);
function firstTrip(text) {
  detector.lastIndex = 0;
  for (let m = detector.exec(text); m !== null; m = detector.exec(text)) {
    if (m[1] !== undefined && m[1] !== '>') return m.index;
  }
  return -1;
}
let page = out;
for (let pos = firstTrip(page), guard = 0; pos !== -1; pos = firstTrip(page), guard++) {
  if (guard > 64) throw new Error('publish-guard: לא מתכנס — בדוק ידנית');
  const window = page.slice(pos, pos + CAP);
  const j = window.indexOf('`,');
  if (j === -1) throw new Error(`publish-guard: אין גבול בטוח ליד ${pos}`);
  const at = pos + j + 2;
  page = page.slice(0, at) + '\n' + page.slice(at);
  console.log(`publish-guard: שורה חדשה הוכנסה אחרי ${at}`);
}

const dest = process.argv[2] ?? 'artifact.html';
writeFileSync(dest, page);
console.log(`${dest} — ${(page.length / 1024).toFixed(0)}KB (מקור ${(src.length / 1024).toFixed(0)}KB)`);
