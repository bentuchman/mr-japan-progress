// אימות חי (קריאה בלבד) של הוכחת הגשת המשוב — להרצה *מקומית בלבד*, על
// מכונה עם גישה ל-hook.eu2.make.com (סביבת הפיתוח המרוחקת חסומה לרשת).
//
//   BENS_WORKSPACE_URL="https://hook.eu2.make.com/..." \
//   node --experimental-strip-types scripts/feedback-check.mjs \
//     <clientIdWithFeedback1> <clientIdWithFeedback2> [clientIdWithout]
//
// מריץ את getFeedbackSubmitted האמיתי דרך השער הקיים, ובנוסף מדפיס
// אבחון של עמודת ה-relation עצמה: אם ה-API מחזיר null לאייטם משוב
// שידוע שהוגש — זה מדווח כאן במפורש, לא מוסתר מאחורי בדיקות יחידה.
// הפלט מצונזר: מזהים שהמפעיל סיפק, בוליאנים וספירות בלבד — בלי שמות,
// בלי כתובות ובלי תוכן משוב.
const endpoint = process.env.BENS_WORKSPACE_URL;
const clientIds = process.argv.slice(2);
if (!endpoint || clientIds.length === 0) {
  console.error('שימוש: BENS_WORKSPACE_URL=... node --experimental-strip-types scripts/feedback-check.mjs <clientId> [clientId...]');
  process.exit(1);
}

const { configureMondayGateway, mondayQuery } = await import('../src/monday/gateway.ts');
const {
  getFeedbackSubmitted, FEEDBACKS_BOARD_ID, FEEDBACKS_COLUMNS, FEEDBACKS_PAGE_QUERY,
} = await import('../src/monday/customerJourneyData.ts');

configureMondayGateway({ endpoint });

// --- 1. הפונקציה האמיתית, ללקוח-לקוח ---
for (const id of clientIds) {
  const r = await getFeedbackSubmitted(id);
  console.log(`getFeedbackSubmitted(${id}) →`, r === null ? 'null (לא ידוע — ראו אבחון)' : r);
}

// --- 2. אבחון עמודת ה-relation: איך ה-API באמת מחזיר אותה ---
const r = await mondayQuery(FEEDBACKS_PAGE_QUERY, {
  boardId: [FEEDBACKS_BOARD_ID],
  columnIds: [FEEDBACKS_COLUMNS.clientsRelation],
  cursor: null,
});
if (!r.ok) {
  console.log('אבחון: קריאת עמוד המשובים נכשלה:', JSON.stringify(r.error));
  process.exit(2);
}
const page = r.data?.boards?.[0]?.items_page;
const items = page?.items ?? [];
let viaFragment = 0, viaClassic = 0, bothNull = 0, noColumn = 0;
for (const item of items) {
  const cv = item.column_values?.find((c) => c.id === FEEDBACKS_COLUMNS.clientsRelation);
  if (!cv) { noColumn++; continue; }
  const frag = Array.isArray(cv.linked_item_ids) && cv.linked_item_ids.length > 0;
  let classic = false;
  try { classic = (JSON.parse(cv.value ?? 'null')?.linkedPulseIds ?? []).length > 0; } catch { /* שבור */ }
  if (frag) viaFragment++;
  else if (classic) viaClassic++;
  else bothNull++;
}
console.log('--- אבחון עמוד ראשון של לוח המשובים ---');
console.log('אייטמים בעמוד            :', items.length, page?.cursor === null ? '(הלוח כולו)' : '(יש עמודים נוספים)');
console.log('relation דרך linked_item_ids :', viaFragment);
console.log('relation דרך linkedPulseIds  :', viaClassic);
console.log('relation ריק/null            :', bothNull, bothNull > 0 ? '← אם ידוע שחלקם הוגשו — ה-API אינו חושף את הקישור, לדווח!' : '');
console.log('העמודה לא הוחזרה כלל         :', noColumn, noColumn > 0 ? '← ייתכן שהשער מסנן עמודות — לדווח!' : '');
