// בדיקה עצמית של שכבת הנתונים — fetch מדומה, נתונים סינתטיים בלבד.
// הרצה: node --experimental-strip-types scripts/monday-phase1-selftest.mjs
// אפס רשת, אפס Monday, אפס נתוני לקוח אמיתיים.
import assert from 'node:assert/strict';

const { configureMondayGateway, mondayQuery } = await import('../src/monday/gateway.ts');
const { getCustomerJourneyData, CLIENTS_COLUMNS, PAYMENTS_COLUMNS } =
  await import('../src/monday/customerJourneyData.ts');

// ===== נתוני דמה — מזהים וכתובות מומצאים בעליל =====
const FAKE_CLIENT = '999000111';
const FAKE_PAYMENT = '888000222';
const sent = [];

const clientColumns = [
  { id: CLIENTS_COLUMNS.startTrip, type: 'date', text: '2099-12-24', value: '{"date":"2099-12-24"}' },
  { id: CLIENTS_COLUMNS.createdAt, type: 'date', text: '2099-01-02', value: '{"date":"2099-01-02"}' },
  { id: CLIENTS_COLUMNS.zoomMeetingId, type: 'text', text: 'FAKE-ZOOM-1', value: '"FAKE-ZOOM-1"' },
  { id: CLIENTS_COLUMNS.zoomMeetingDateTime, type: 'date', text: '', value: '{"date":"2099-02-03","time":"19:00:00"}' },
  { id: CLIENTS_COLUMNS.meetingLink, type: 'link', text: 'להצטרפות', value: '{"url":"https://example.invalid/meet","text":"להצטרפות"}' },
  { id: CLIENTS_COLUMNS.hotelsSelectionLink, type: 'text', text: 'https://example.invalid/hotels', value: null },
  { id: CLIENTS_COLUMNS.feedbackFormLink, type: 'formula', text: '', value: null, display_value: 'https://example.invalid/feedback' },
  { id: CLIENTS_COLUMNS.meetingRescheduleLink, type: 'formula', text: '', value: null, display_value: '' },       // ריק בכוונה
  { id: CLIENTS_COLUMNS.planChangesForm, type: 'link', text: 'טופס', value: '{"url":"https://example.invalid/changes","text":"טופס"}' },
  { id: CLIENTS_COLUMNS.planApproval, type: 'status', text: 'Changes form submitted', value: '{"index":3}' },
  { id: CLIENTS_COLUMNS.paymentsRelation, type: 'board_relation', text: '', value: null, linked_item_ids: [FAKE_PAYMENT] },
  // meetingRescheduleLinkMaster חסרה לגמרי — בכוונה
];
const paymentColumns = [
  { id: PAYMENTS_COLUMNS.serviceStatus, type: 'status', text: 'Paid', value: '{"index":1}' },
  { id: PAYMENTS_COLUMNS.servicePaidAt, type: 'date', text: '2099-01-05', value: '{"date":"2099-01-05"}' },
  { id: PAYMENTS_COLUMNS.serviceLink, type: 'link', text: 'תשלום', value: '{"url":"https://example.invalid/pay-service"}' },
  { id: PAYMENTS_COLUMNS.serviceReceipt, type: 'link', text: '', value: null },      // אין קבלה עדיין
  { id: PAYMENTS_COLUMNS.advStatus, type: 'status', text: '', value: null },         // טרם נקבע
  { id: PAYMENTS_COLUMNS.advLink, type: 'link', text: '', value: '{"url":""}' },     // url ריק
];

globalThis.fetch = async (url, init) => {
  const body = JSON.parse(init.body);
  sent.push(body);
  const q = body.queryBody;
  assert.ok(typeof q === 'string' && /^\s*query\b/.test(q), 'רק query נשלחות');
  const ids = body.variables.itemId;
  const items =
    ids[0] === FAKE_CLIENT ? [{ id: FAKE_CLIENT, column_values: clientColumns }]
    : ids[0] === FAKE_PAYMENT ? [{ id: FAKE_PAYMENT, column_values: paymentColumns }]
    : [];
  return new Response(JSON.stringify({ data: { items } }), { status: 200 });
};

// 1. שער לא מוגדר → שגיאה רכה, בלי רשת
{
  const r = await getCustomerJourneyData(FAKE_CLIENT);
  assert.equal(r.ok, false);
  assert.equal(r.error.kind, 'gateway-not-configured');
  assert.equal(sent.length, 0);
}

configureMondayGateway({ endpoint: 'https://gateway.invalid/webhook' });

// 2. mutation נחסם לפני שליחה
{
  const r = await mondayQuery('mutation { delete_item (item_id: 1) { id } }');
  assert.equal(r.ok, false);
  assert.equal(r.error.kind, 'mutation-refused');
  assert.equal(sent.length, 0);
}

// 3. לקוח מלא: שתי שאילתות, נרמול נכון, קשר דרך ה-relation
{
  const r = await getCustomerJourneyData(FAKE_CLIENT);
  assert.equal(r.ok, true);
  const d = r.data;
  assert.equal(sent.length, 2);
  assert.deepEqual(sent[1].variables.itemId, [FAKE_PAYMENT]);
  assert.equal(d.clientMondayItemId, FAKE_CLIENT);
  assert.equal(d.paymentsMondayItemId, FAKE_PAYMENT);
  assert.equal(d.trip.startDate, '2099-12-24');
  assert.equal(d.meeting.scheduledAt, '2099-02-03T19:00:00');
  assert.equal(d.meeting.meetingUrl, 'https://example.invalid/meet');     // value.url, לא טקסט התצוגה
  assert.equal(d.meeting.rescheduleUrl, null);                            // display_value ריק → null
  assert.equal(d.meeting.rescheduleUrlMaster, null);                      // עמודה חסרה → null
  assert.equal(d.forms.hotelSelectionUrl, 'https://example.invalid/hotels');
  assert.equal(d.forms.feedbackUrl, 'https://example.invalid/feedback');
  assert.equal(d.forms.planChangesUrl, 'https://example.invalid/changes');
  assert.equal(d.planApprovalStatus, 'Changes form submitted');            // תווית גולמית נשמרת
  assert.equal(d.payments.service.status, 'Paid');                        // תווית גולמית, בלי פרשנות
  assert.equal(d.payments.service.paymentUrl, 'https://example.invalid/pay-service');
  assert.equal(d.payments.service.receiptUrl, null);
  assert.equal(d.payments.attractions.status, null);
  assert.equal(d.payments.attractions.paymentUrl, null);                  // url ריק → null
  assert.equal(d.payments.attractions.paidAt, null);                      // עמודה חסרה → null
}

// 4. מזהה אחר → אותו קוד, בלי שום קיבוע ללקוח מסוים
{
  const r = await getCustomerJourneyData('123123123');
  assert.equal(r.ok, false);
  assert.equal(r.error.kind, 'client-not-found');
}

// 5. לקוח בלי קישור ל-Payments → תשלומים ריקים, בלי שאילתה שנייה ובלי קריסה
{
  const noRel = clientColumns.filter((c) => c.id !== CLIENTS_COLUMNS.paymentsRelation);
  const before = sent.length;
  globalThis.fetch = async (url, init) => {
    sent.push(JSON.parse(init.body));
    return new Response(JSON.stringify({ data: { items: [{ id: FAKE_CLIENT, column_values: noRel }] } }), { status: 200 });
  };
  const r = await getCustomerJourneyData(FAKE_CLIENT);
  assert.equal(r.ok, true);
  assert.equal(r.data.paymentsMondayItemId, null);
  assert.equal(r.data.payments.service.status, null);
  assert.equal(sent.length, before + 1);   // שאילתה אחת בלבד
}

// 6. שגיאת Monday ותגובה שבורה → שגיאות רכות
{
  globalThis.fetch = async () => new Response(JSON.stringify({ errors: [{ message: 'boom' }] }), { status: 200 });
  const r = await getCustomerJourneyData(FAKE_CLIENT);
  assert.equal(r.ok, false);
  assert.equal(r.error.kind, 'monday-error');

  globalThis.fetch = async () => new Response('not json', { status: 200 });
  const r2 = await getCustomerJourneyData(FAKE_CLIENT);
  assert.equal(r2.ok, false);
  assert.equal(r2.error.kind, 'bad-response');

  globalThis.fetch = async () => new Response('', { status: 500 });
  const r3 = await getCustomerJourneyData(FAKE_CLIENT);
  assert.equal(r3.ok, false);
  assert.equal(r3.error.kind, 'network');
}

console.log('monday-phase1-selftest: כל הבדיקות עברו ✓');

// ===== שלב 2 — פתרון פעולות סמנטיות (טעון באותו הרץ) =====
{
  const { resolveCustomerAction, isPaid, rendererForUrl } = await import('../src/customerActions.ts');
  const base = {
    clientMondayItemId: 'syn', paymentsMondayItemId: 'syn-p',
    trip: { startDate: null, createdAt: null },
    meeting: { zoomMeetingId: null, scheduledAt: null, meetingUrl: null,
               rescheduleUrl: 'https://a.example.invalid/r', rescheduleUrlMaster: null },
    forms: { hotelSelectionUrl: null, planChangesUrl: 'https://hook.eu2.make.com/fake-hook', feedbackUrl: null },
    payments: { service: { status: 'Paid', paymentUrl: null, paidAt: null, receiptUrl: null },
                attractions: { status: 'pending-something', paymentUrl: null, paidAt: null, receiptUrl: null } },
  };
  // שינוי/ביטול: רק כתובת Fillout פונת-לקוח כשרה.
  // מועמד שאינו Fillout — נפסל; אין אף מועמד כשר → כישלון בטוח.
  assert.deepEqual(resolveCustomerAction('meetingReschedule', base), { url: null, reason: 'missing' });
  // מועמד Fillout יחיד → נבחר (גם כשהשני אינו Fillout)
  const f1 = { ...base, meeting: { ...base.meeting, rescheduleUrlMaster: 'https://mrjapan.fillout.com/t/FAKEr1' } };
  assert.equal(resolveCustomerAction('meetingReschedule', f1).url, 'https://mrjapan.fillout.com/t/FAKEr1');
  // שני מועמדי Fillout שונים → עצירה בטוחה, בלי ניחוש
  const amb = { ...base, meeting: { ...base.meeting,
    rescheduleUrl: 'https://mrjapan.fillout.com/t/FAKEr1', rescheduleUrlMaster: 'https://mrjapan.fillout.com/t/FAKEr2' } };
  assert.deepEqual(resolveCustomerAction('meetingReschedule', amb), { url: null, reason: 'ambiguous' });
  // שניהם זהים → אין דו-משמעות
  const same = { ...base, meeting: { ...base.meeting,
    rescheduleUrl: 'https://mrjapan.fillout.com/t/FAKEr1', rescheduleUrlMaster: 'https://mrjapan.fillout.com/t/FAKEr1' } };
  assert.equal(resolveCustomerAction('meetingReschedule', same).url, 'https://mrjapan.fillout.com/t/FAKEr1');
  // מקרה D: מועמד שהוא webhook של Make — לעולם לא נפתח ולא משמש כנסיגה
  const mk2 = { ...base, meeting: { ...base.meeting, rescheduleUrl: 'https://hook.eu2.make.com/fake-hook' } };
  assert.deepEqual(resolveCustomerAction('meetingReschedule', mk2), { url: null, reason: 'missing' });
  // מארח אוטומציה בעמודת קישור → לעולם לא נפתח
  assert.deepEqual(resolveCustomerAction('planChanges', base), { url: null, reason: 'blocked-host' });
  // כתובת קביעת פגישה — מיפוי לא מאומת, תמיד עצירה בטוחה
  assert.equal(resolveCustomerAction('meetingSchedule', base).reason, 'unverified-mapping');
  // סטטוסים: רק Paid (בלי תלות רישיות) נחשב שולם
  assert.equal(isPaid('Paid'), true);
  assert.equal(isPaid('paid '), true);
  assert.equal(isPaid('Pending'), false);
  assert.equal(isPaid(null), false);
  // בחירת renderer: fillout ציבורי → הטמעה רשמית; אחר → iframe
  assert.deepEqual(rendererForUrl('https://mrjapan.fillout.com/t/AbC123'), { provider: 'fillout', filloutFormId: 'AbC123' });
  assert.deepEqual(rendererForUrl('https://pay.example.invalid/x'), { provider: 'zite' });
  console.log('customerActions selftest: עבר ✓');
}

// ===== מעבר 4→5→6 — Plan Approval כמקור אמת (אישור מור) =====
{
  const { planChangesPhase } = await import('../src/customerActions.ts');
  const withStatus = (planApprovalStatus) => ({
    clientMondayItemId: 'syn', paymentsMondayItemId: null,
    trip: { startDate: null, createdAt: null },
    meeting: { zoomMeetingId: null, scheduledAt: null, meetingUrl: null, rescheduleUrl: null, rescheduleUrlMaster: null },
    forms: { hotelSelectionUrl: null, planChangesUrl: null, feedbackUrl: null },
    planApprovalStatus,
    payments: { service: { status: null, paymentUrl: null, paidAt: null, receiptUrl: null },
                attractions: { status: null, paymentUrl: null, paidAt: null, receiptUrl: null } },
  });
  // 1. הלקוח שלח ומור מטפלת → שלב 5 פעיל
  assert.equal(planChangesPhase(withStatus('Changes form submitted')), 'inProgress');
  // 2. מור אישרה → שלב 5 הסתיים, מותר להמשיך ל-6
  assert.equal(planChangesPhase(withStatus('Approved')), 'approved');
  // 3. ערך לא מוכר / ריק / חסר → unknown, בלי ניחוש
  assert.equal(planChangesPhase(withStatus('Working on it')), 'unknown');
  assert.equal(planChangesPhase(withStatus(null)), 'unknown');
  assert.equal(planChangesPhase(null), 'unknown');
  // 4. לקוחות שונים — כל אחד מהנתונים שלו בלבד
  const a = withStatus('Changes form submitted'), b = withStatus('Approved');
  assert.equal(planChangesPhase(a), 'inProgress');
  assert.equal(planChangesPhase(b), 'approved');
  assert.equal(planChangesPhase(a), 'inProgress');   // b לא השפיע על a
  console.log('planChangesPhase selftest: עבר ✓');
}
