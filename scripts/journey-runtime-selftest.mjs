// בדיקות טהורות של מנוע מצב המסע (Phase 2) — נתונים סינתטיים בלבד.
// הרצה: node --experimental-strip-types scripts/journey-runtime-selftest.mjs
// אפס רשת, אפס Monday, אפס UI. המנוע חייב להיות דטרמיניסטי ולכשול-בטוח.
import assert from 'node:assert/strict';

const { deriveJourneyRuntimeState } = await import('../src/journeyRuntime.ts');
const { attractionsReservationsPhase, isoDatePassed } = await import('../src/customerActions.ts');
const { STAGES, relevantSubStates } = await import('../src/journeyConfig.ts');

const TODAY = '2099-06-01';

// ===== בונה לקוח סינתטי — ברירת מחדל: הכול null (שום ראיה) =====
function customer(overrides = {}) {
  const base = {
    clientMondayItemId: 'syn-1', paymentsMondayItemId: 'syn-p1',
    trip: { startDate: null, endDate: null, createdAt: null },
    meeting: { zoomMeetingId: null, scheduledAt: null, meetingUrl: null, rescheduleUrl: null, rescheduleUrlMaster: null },
    forms: { hotelSelectionUrl: null, planChangesUrl: null, feedbackUrl: null },
    planApprovalStatus: null,
    operations: { internalStatus: null, hotelsBooked: null, attractionsReservationsStatus: null, plan: null, paymentStageInternal: null },
    payments: { service: { status: null, paymentUrl: null, paidAt: null, receiptUrl: null },
                attractions: { status: null, paymentUrl: null, paidAt: null, receiptUrl: null } },
  };
  return {
    ...base, ...overrides,
    trip: { ...base.trip, ...(overrides.trip ?? {}) },
    meeting: { ...base.meeting, ...(overrides.meeting ?? {}) },
    forms: { ...base.forms, ...(overrides.forms ?? {}) },
    operations: { ...base.operations, ...(overrides.operations ?? {}) },
    payments: {
      service: { ...base.payments.service, ...(overrides.payments?.service ?? {}) },
      attractions: { ...base.payments.attractions, ...(overrides.payments?.attractions ?? {}) },
    },
  };
}

const derive = (c, pkg = 'advanced', today = TODAY) => deriveJourneyRuntimeState(c, today, pkg);
const expectStage = (state, stageId, substateId, label) => {
  assert.equal(state.kind, 'resolved', `${label}: ציפינו resolved, התקבל ${state.kind} (${state.reason})`);
  assert.equal(state.currentStageId, stageId, `${label}: שלב`);
  assert.equal(state.currentSubstateId, substateId, `${label}: תת-מצב`);
};
const expectUnknown = (state, label) =>
  assert.equal(state.kind, 'unknown', `${label}: ציפינו unknown, התקבל ${JSON.stringify(state)}`);

// ===== 1. מצב סופני — Cancelled גובר על הכול =====
{
  const c = customer({ operations: { internalStatus: 'Cancelled' } });
  const s = derive(c);
  assert.equal(s.kind, 'terminal');
  assert.equal(s.terminalState, 'cancelled');
  // גם עם כתובת משוב, ארכיון-לכאורה בנתונים אחרים ותשלומים — עדיין סופני
  const rich = customer({
    operations: { internalStatus: 'Cancelled', hotelsBooked: true, attractionsReservationsStatus: 'Completed' },
    forms: { feedbackUrl: 'https://example.invalid/fb' },
    planApprovalStatus: 'Approved',
    payments: { service: { status: 'Paid' } },
  });
  assert.equal(derive(rich).kind, 'terminal');
  // רישיות שונה אינה התווית המאומתת → לא סופני (נופל להמשך הסולם)
  assert.notEqual(derive(customer({ operations: { internalStatus: 'cancelled' } })).kind, 'terminal');
  console.log('runtime: Cancelled סופני ✓');
}

// ===== 2. מחזור חיים — Abroad / Archive =====
{
  expectStage(derive(customer({ operations: { internalStatus: 'Abroad' } })), 'in-japan', 'traveling', 'Abroad');
  // Abroad גובר גם כשאותות מוקדמים חסרים/סותרים
  expectStage(derive(customer({ operations: { internalStatus: 'Abroad' }, planApprovalStatus: 'Changes form submitted' })),
    'in-japan', 'traveling', 'Abroad над plan');
  // Archive → משוב פתוח — לעולם לא submitted (אין אות הגשה מאומת ברשות המנוע)
  const arch = derive(customer({ operations: { internalStatus: 'Archive' }, forms: { feedbackUrl: 'https://example.invalid/fb' } }));
  expectStage(arch, 'feedback', 'open', 'Archive');
  // Archive בלי כתובת משוב — עדיין open (זמינות ה-CTA היא עניין של שכבת הפעולה)
  expectStage(derive(customer({ operations: { internalStatus: 'Archive' } })), 'feedback', 'open', 'Archive ללא URL');
  // תווית תפעולית לא ממופה אינה קובעת עמדה — ממשיכים לסולם טרום-הטיול
  const other = derive(customer({ operations: { internalStatus: 'Final QA', paymentStageInternal: 'service-sent' } }));
  expectStage(other, 'service-payment', 'due', 'Final QA נופל לטרום-טיול');
  console.log('runtime: Abroad/Archive/other ✓');
}

// ===== 3. שלבים 1–4 — payment-stage-internal כמקור האמת =====
{
  const withPay = (paymentStageInternal, extra = {}) =>
    customer({ operations: { paymentStageInternal }, ...extra });
  // עמודה ריקה = טרם נשלחה בקשת תשלום → התוכנית בהכנה (שלב 1, אומת)
  expectStage(derive(customer()), 'plan-building', 'working', 'ללא בקשת תשלום → שלב 1');
  // CASE A: service-sent → תשלום השירות נדרש
  expectStage(derive(withPay('service-sent')), 'service-payment', 'due', 'CASE A: service-sent');
  // CASE B: service-paid → שלב 2 הושלם, ממשיכים לפגישה
  expectStage(derive(withPay('service-paid')), 'meeting', 'upcoming', 'CASE B: service-paid');
  // שלב מאוחר מוכיח את המוקדמים: advance-sent פירושו שהשירות שולם
  expectStage(derive(customer({ operations: { paymentStageInternal: 'advance-sent' }, planApprovalStatus: null })),
    'meeting', 'upcoming', 'advance-sent מוכיח תשלום שירות');
  // עמודה ריקה אך לוח התשלומים מוכיח Paid (לקוח ותיק) → לא חוזרים לשלב 1
  expectStage(derive(customer({ payments: { service: { status: 'Paid' } } })), 'meeting', 'upcoming', 'נסיגת עבר: Paid');
  // תווית תשלום לא מוכרת → נסיגה ללוח התשלומים בלבד
  expectStage(derive(withPay('weird-label', { payments: { service: { status: 'Pending' } } })),
    'service-payment', 'due', 'תווית לא מוכרת + Pending');
  expectUnknown(derive(withPay('weird-label')), 'תווית לא מוכרת בלי מקור עבר');
  // פגישה עתידית / היום → נקבעה
  expectStage(derive(withPay('service-paid', { meeting: { scheduledAt: '2099-06-10T19:00:00' } })),
    'meeting', 'scheduled', 'פגישה עתידית');
  expectStage(derive(withPay('service-paid', { meeting: { scheduledAt: TODAY } })),
    'meeting', 'scheduled', 'פגישה היום');
  // מועד הפגישה חלף בלי תווית אזור → מעבר 3↔4 לא מוכרע → unknown
  expectUnknown(derive(withPay('service-paid', { meeting: { scheduledAt: '2099-05-01T19:00:00' } })),
    'פגישה שחלפה');
  // מועד פגישה שבור → unknown
  expectUnknown(derive(withPay('service-paid', { meeting: { scheduledAt: 'מחר בערב' } })),
    'מועד שבור');
  console.log('runtime: שלבים 1–4 (payment-stage-internal) ✓');
}

// ===== 3ב. גבול שלב 3↔4 — תוויות האזור המאומתות ב-Internal Status =====
{
  // Waiting for meeting: פגישה עתידית/היום → scheduled; אחרת → upcoming
  expectStage(derive(customer({ operations: { internalStatus: 'Waiting for meeting' }, meeting: { scheduledAt: '2099-06-10T19:00:00' } })),
    'meeting', 'scheduled', 'Waiting for meeting + מועד עתידי');
  expectStage(derive(customer({ operations: { internalStatus: 'Waiting for meeting' }, meeting: { scheduledAt: TODAY } })),
    'meeting', 'scheduled', 'Waiting for meeting + היום');
  expectStage(derive(customer({ operations: { internalStatus: 'Waiting for meeting' } })),
    'meeting', 'upcoming', 'Waiting for meeting בלי מועד');
  expectStage(derive(customer({ operations: { internalStatus: 'Waiting for meeting' }, meeting: { scheduledAt: '2099-05-01' } })),
    'meeting', 'upcoming', 'Waiting for meeting + מועד שחלף → נדרש תיאום');
  // התווית קובעת את האזור גם כשאותות מוקדמים חסרים (תשלום לא ידוע)
  expectStage(derive(customer({ operations: { internalStatus: 'Waiting for meeting' }, payments: { service: { status: 'Pending' } } })),
    'meeting', 'upcoming', 'Waiting for meeting גובר על סולם התשלום');

  // Changes window open → שלב 4 פתוח
  expectStage(derive(customer({ operations: { internalStatus: 'Changes window open' } })),
    'changes-form', 'open', 'Changes window open');
  // מועד פגישה שחלף *בלי* התווית → נשאר unknown (לא ממציאים שלב 4)
  expectUnknown(derive(customer({ payments: { service: { status: 'Paid' } }, meeting: { scheduledAt: '2099-05-01T19:00:00' } })),
    'מועד חלף בלי Changes window open');
  // Plan Approval המאוחר גובר על תווית אזור שנשארה מאחור
  expectStage(derive(customer({ operations: { internalStatus: 'Changes window open' }, planApprovalStatus: 'Changes form submitted' })),
    'changes-processing', 'working', 'הגשה גוברת על תווית אזור');
  expectStage(derive(customer({ operations: { internalStatus: 'Waiting for meeting' }, planApprovalStatus: 'Approved', trip: { startDate: '2099-06-20' } })),
    'selections', 'open', 'אישור גובר על תווית אזור');
  // 'Sent for review' אינו מפורש — לא שלב 5 ולא קידום אחר
  const sent = derive(customer({ operations: { internalStatus: 'Changes window open' }, planApprovalStatus: 'Sent for review' }));
  expectStage(sent, 'changes-form', 'open', 'Sent for review אינו שלב 5');
  // לבדו (בלי שום אות אחר): נופל לסולם המוקדם — לא changes-processing
  const sentAlone = derive(customer({ planApprovalStatus: 'Sent for review' }));
  assert.ok(!(sentAlone.kind === 'resolved' && sentAlone.currentStageId === 'changes-processing'),
    'Sent for review לבדו אינו שלב 5');
  console.log('runtime: גבול 3↔4 לפי Internal Status ✓');
}

// ===== 4. שלב 5 — Plan Approval של מור =====
{
  expectStage(derive(customer({ planApprovalStatus: 'Changes form submitted' })), 'changes-processing', 'working', 'שלב 5');
  // תווית Plan Approval לא מוכרת → אינה מקדמת; נופל לשלבים 1–4
  expectStage(derive(customer({ planApprovalStatus: 'Working on it', operations: { paymentStageInternal: 'service-sent' } })),
    'service-payment', 'due', 'plan לא מוכר');
  // CASE 'Sent for review' — אינו מפורש: אינו שלב 5 ואינו מקדם
  expectStage(derive(customer({ planApprovalStatus: 'Sent for review', operations: { paymentStageInternal: 'service-sent' } })),
    'service-payment', 'due', 'Sent for review אינו מקדם');
  console.log('runtime: שלב 5 ✓');
}

// ===== 5. אזור 6–8 — אחרי אישור מור =====
{
  const approved = (extra = {}) => customer({ planApprovalStatus: 'Approved', ...extra });

  // הכול הוזמן → הכול מוכן לטיול
  expectStage(derive(approved({ operations: { hotelsBooked: true, attractionsReservationsStatus: 'Completed' } })),
    'attractions-booking', 'all-ready', 'all-ready מתקדם');
  // בחבילת בסיס — תת-המצב הייעודי בשלב הבחירות
  expectStage(derive(approved({ operations: { hotelsBooked: true, attractionsReservationsStatus: 'Completed' } }), 'basic'),
    'selections', 'all-ready', 'all-ready בסיסי');

  // ===== שלב 8 — advance-paid (מקור האמת) + מצב עבודת ההזמנות =====
  // CASE H: advance-paid + Yet to start → שולם, ההזמנה בתור הצוות → שלב 8
  expectStage(derive(approved({
    operations: { hotelsBooked: true, attractionsReservationsStatus: 'Yet to start', paymentStageInternal: 'advance-paid' },
  })), 'attractions-booking', 'working', 'CASE H: advance-paid + Yet to start');
  // CASE I: advance-paid + In Progress → הצוות עובד על ההזמנות
  expectStage(derive(approved({
    operations: { hotelsBooked: true, attractionsReservationsStatus: 'In Progress', paymentStageInternal: 'advance-paid' },
  })), 'attractions-booking', 'working', 'CASE I: advance-paid + In Progress');
  // CASE J: advance-paid + Completed (+ מלונות) → הכול מוכן
  expectStage(derive(approved({
    operations: { hotelsBooked: true, attractionsReservationsStatus: 'Completed', paymentStageInternal: 'advance-paid' },
  })), 'attractions-booking', 'all-ready', 'CASE J: advance-paid + Completed');
  // advance-sent → תשלום האטרקציות נדרש מהלקוח (עדות ישירה, בלי חישוב חלון)
  expectStage(derive(approved({
    operations: { hotelsBooked: true, paymentStageInternal: 'advance-sent' },
  })), 'selections', 'open', 'advance-sent → תשלום נדרש');
  // In Progress *לבדו* (בלי advance-paid) נדחה בפרודקשן כאות הפעלה → עצירה בטוחה
  expectUnknown(derive(approved({
    operations: { hotelsBooked: true, attractionsReservationsStatus: 'In Progress' },
  })), 'In Progress לבדו → לא working');
  // חבילת בסיס: אין שלב attractions-booking → unknown מפורש, לא המצאה
  expectUnknown(derive(approved({
    operations: { hotelsBooked: true, attractionsReservationsStatus: 'In Progress', paymentStageInternal: 'advance-paid' },
  }), 'basic'), 'basic ללא שלב הזמנת אטרקציות');

  // מקורות עבר בלבד (לוח התשלומים) אינם מקדמים לשלב 8 — עצירה בטוחה
  for (const attrRes of ['Yet to start', null]) {
    expectUnknown(derive(approved({
      operations: { hotelsBooked: true, attractionsReservationsStatus: attrRes },
      payments: { attractions: { status: 'Paid' } },
    })), `Paid ישן + ${attrRes} → לא working`);
  }
  // 'Paid' בעוקב ההזמנות אינו אמת-תשלום ואינו מעבר לשלב 8
  expectUnknown(derive(approved({
    operations: { hotelsBooked: true, attractionsReservationsStatus: 'Paid' },
  })), 'Attractions Reservations = Paid → לא working');
  // advance-paid אך עוקב ההזמנות ריק/לא מוכר → אין שלב מאומת
  expectUnknown(derive(approved({
    operations: { hotelsBooked: true, paymentStageInternal: 'advance-paid' },
  })), 'advance-paid בלי מצב הזמנות');

  // מלונות הוזמנו, תשלום אטרקציות פתוח — לפי חלון 90 הימים
  const openWin = { trip: { startDate: '2099-08-15' } };   // 75 ימים → פתוח
  expectStage(derive(approved({ operations: { hotelsBooked: true }, ...openWin })),
    'selections', 'open', 'תשלום אטרקציות פתוח בחלון');
  // בדיוק 90 ימים → פתוח; 91 → סגור (שימוש חוזר ב-paymentWindowOpen)
  expectStage(derive(approved({ operations: { hotelsBooked: true }, trip: { startDate: '2099-08-30' } })),
    'selections', 'open', '90 ימים בדיוק');
  expectUnknown(derive(approved({ operations: { hotelsBooked: true }, trip: { startDate: '2099-08-31' } })),
    '91 ימים — תקופת המתנה ללא שלב מאומת');
  // תאריך התחלה חסר → unknown
  expectUnknown(derive(approved({ operations: { hotelsBooked: true } })), 'חלון בלי תאריך');

  // הצוות סימן במפורש שהמלונות לא הוזמנו → הבחירות פתוחות
  expectStage(derive(approved({ operations: { hotelsBooked: false } })), 'selections', 'open', 'מלונות false');

  // checkbox חסר (null): אם יש פעולה מאומתת פתוחה (אטרקציות בחלון) → selections
  expectStage(derive(approved({ ...openWin })), 'selections', 'open', 'מלונות null + אטרקציות פתוחות');
  // checkbox חסר ואין פעולה מאומתת פתוחה → unknown, null אינו הופך ל-false
  expectUnknown(derive(approved({ payments: { attractions: { status: 'Paid' } } })), 'מלונות null + שולם');

  // ===== גבול 6↔7 — תוויות אזור המלונות (אימות פרודקשן, Advanced) =====
  const hotelsCat = (hotelsBooked = false) =>
    approved({ operations: { internalStatus: 'Hotels catalog', hotelsBooked } });
  const hotelsRes = (hotelsBooked = false) =>
    approved({ operations: { internalStatus: 'Hotels Reservations', hotelsBooked } });
  expectStage(derive(hotelsCat(false)), 'selections', 'open', 'Hotels catalog + לא הוזמן');
  expectStage(derive(hotelsRes(false)), 'hotels-booking', 'working', 'Hotels Reservations + לא הוזמן');
  expectStage(derive(hotelsRes(null)), 'hotels-booking', 'working', 'Hotels Reservations + checkbox חסר');
  // התווית אינה ממופה לחבילות בלי שלב הזמנת מלונות — לעולם לא hotels-booking
  for (const p of ['standard', 'basic']) {
    const s = derive(hotelsRes(false), p);
    assert.notEqual(s.kind === 'resolved' && s.currentStageId, 'hotels-booking', `${p}: לא hotels-booking`);
    expectUnknown(s, `${p} + Hotels Reservations`);
  }
  // checkbox true לבדו אינו מפעיל שלב 7 — הוא אות השלמה במורד הזרם
  expectStage(derive(approved({
    operations: { hotelsBooked: true, attractionsReservationsStatus: 'In Progress', paymentStageInternal: 'advance-paid' },
  })), 'attractions-booking', 'working', 'הוזמן → שלב 8, לא שלב 7');
  // תווית Hotels Reservations ישנה אינה מושכת אחורה לקוח שהתקדם:
  // המלונות כבר הוזמנו → האות במורד הזרם גובר
  expectStage(derive(approved({
    operations: { internalStatus: 'Hotels Reservations', hotelsBooked: true, attractionsReservationsStatus: 'Completed' },
  })), 'attractions-booking', 'all-ready', 'תווית ישנה מול all-ready');
  expectStage(derive(approved({
    operations: { internalStatus: 'Hotels Reservations', hotelsBooked: true, attractionsReservationsStatus: 'In Progress', paymentStageInternal: 'advance-paid' },
  })), 'attractions-booking', 'working', 'תווית ישנה מול שלב 8 פעיל');
  // המיפוי חי רק תחת Approved: בלי אישור מור התווית אינה מקדמת לשלב 7
  const noApproval = derive(customer({ operations: { internalStatus: 'Hotels Reservations' } }));
  assert.ok(!(noApproval.kind === 'resolved' && noApproval.currentStageId === 'hotels-booking'),
    'Hotels Reservations בלי Approved אינו שלב 7');
  console.log('runtime: אזור 6–8 + גבול 6↔7 ✓');
}

// ===== 5ב. חבילה מ-Plan (status8) — CASE G =====
{
  const { packageFromPlan } = await import('../src/customerActions.ts');
  assert.equal(packageFromPlan(customer({ operations: { plan: 'Advanced' } })), 'advanced');
  assert.equal(packageFromPlan(customer({ operations: { plan: 'Standard' } })), 'standard');
  assert.equal(packageFromPlan(customer({ operations: { plan: 'Basic' } })), 'basic');
  assert.equal(packageFromPlan(customer({ operations: { plan: 'סטנדרטי' } })), null);   // לא ממופה עד הכרעה
  assert.equal(packageFromPlan(customer({ operations: { plan: 'advanced' } })), null);  // רישיות ≠ תווית
  assert.equal(packageFromPlan(customer()), null);
  // המנוע גוזר את החבילה מ-Plan כשלא סופקה דריסה:
  // לקוח Basic שהכול הוזמן לו → all-ready של מסלול הבסיס, בלי pkg מפורש
  const basicReady = deriveJourneyRuntimeState(customer({
    operations: { plan: 'Basic', hotelsBooked: true, attractionsReservationsStatus: 'Completed' },
    planApprovalStatus: 'Approved',
  }), TODAY);
  assert.equal(basicReady.kind, 'resolved');
  assert.equal(basicReady.currentStageId, 'selections');
  assert.equal(basicReady.currentSubstateId, 'all-ready');
  // CASE G: Plan = Advanced → מסע מלא (שלב 7 קיים)
  const advRes = deriveJourneyRuntimeState(customer({
    operations: { plan: 'Advanced', internalStatus: 'Hotels Reservations', hotelsBooked: false },
    planApprovalStatus: 'Approved',
  }), TODAY);
  assert.equal(advRes.kind, 'resolved');
  assert.equal(advRes.currentStageId, 'hotels-booking');
  console.log('runtime: חבילה מ-Plan ✓');
}

// ===== 5ג. משוב — הוכחת הגשה דרך ה-relation בלוח ה-Feedbacks =====
{
  const { feedbackLinkedToClient, FEEDBACKS_COLUMNS } = await import('../src/monday/customerJourneyData.ts');
  const rel = (ids) => ({ column_values: [{ id: FEEDBACKS_COLUMNS.clientsRelation, value: null, linked_item_ids: ids }] });
  const relClassic = (ids) => ({ column_values: [{ id: FEEDBACKS_COLUMNS.clientsRelation,
    value: JSON.stringify({ linkedPulseIds: ids.map((x) => ({ linkedPulseId: Number(x) })) }) }] });
  // CASE K: אייטם משוב מקושר ללקוח → הוגש (בשני ייצוגי ה-relation)
  assert.equal(feedbackLinkedToClient([rel(['555000111'])], '555000111'), true);
  assert.equal(feedbackLinkedToClient([relClassic(['555000111'])], '555000111'), true);
  // CASE L: אין קישור תואם → לא הוגש; אייטם בלי relation לעולם אינו תואם
  assert.equal(feedbackLinkedToClient([rel(['999888777'])], '555000111'), false);
  assert.equal(feedbackLinkedToClient([{ column_values: [] }, {}], '555000111'), false);
  assert.equal(feedbackLinkedToClient([], '555000111'), false);

  // במנוע: Archive + הוכחת הגשה → submitted; בלי הוכחה → open
  const arch = customer({ operations: { internalStatus: 'Archive' } });
  expectStage(deriveJourneyRuntimeState(arch, TODAY, 'advanced', { feedbackSubmitted: true }),
    'feedback', 'submitted', 'CASE K: הגשה מוכחת');
  expectStage(deriveJourneyRuntimeState(arch, TODAY, 'advanced', { feedbackSubmitted: false }),
    'feedback', 'open', 'CASE L: אין הגשה');
  expectStage(deriveJourneyRuntimeState(arch, TODAY, 'advanced', { feedbackSubmitted: null }),
    'feedback', 'open', 'הגשה לא ידועה → פתוח');
  expectStage(deriveJourneyRuntimeState(arch, TODAY, 'advanced'), 'feedback', 'open', 'לא נבדק → פתוח');
  // הוכחת הגשה לעולם אינה עוקפת ביטול
  assert.equal(deriveJourneyRuntimeState(customer({ operations: { internalStatus: 'Cancelled' } }),
    TODAY, 'advanced', { feedbackSubmitted: true }).kind, 'terminal');
  console.log('runtime: משוב לפי relation ✓');
}

// ===== 5ד. פרשן payment-stage-internal + סטטוס פעולות =====
{
  const { paymentStagePhase, paymentStageServicePaid, paymentStageAdvancePaid, customerActionStatus } =
    await import('../src/customerActions.ts');
  const withPay = (v) => customer({ operations: { paymentStageInternal: v } });
  assert.equal(paymentStagePhase(withPay(null)), 'notRequested');
  assert.equal(paymentStagePhase(withPay('service-sent')), 'serviceSent');
  assert.equal(paymentStagePhase(withPay('service-paid')), 'servicePaid');
  assert.equal(paymentStagePhase(withPay('advance-sent')), 'advanceSent');
  assert.equal(paymentStagePhase(withPay('advance-paid')), 'advancePaid');
  assert.equal(paymentStagePhase(withPay('consolidation-sent')), 'consolidationSent');
  assert.equal(paymentStagePhase(withPay('consolidation-done')), 'consolidationDone');
  assert.equal(paymentStagePhase(withPay('Service-Sent')), 'unknown');   // רישיות ≠ תווית
  assert.equal(paymentStagePhase(withPay('debt')), 'unknown');
  assert.equal(paymentStageServicePaid('serviceSent'), false);
  assert.equal(paymentStageServicePaid('advanceSent'), true);            // שלב מאוחר מוכיח מוקדם
  assert.equal(paymentStageAdvancePaid('advanceSent'), false);
  assert.equal(paymentStageAdvancePaid('consolidationDone'), true);
  // סטטוס פעולות: A/B/H דרך מקור האמת; נסיגה ללוח התשלומים רק בתווית לא מוכרת
  assert.equal(customerActionStatus('servicePayment', withPay('service-sent')), 'pending');
  assert.equal(customerActionStatus('servicePayment', withPay('service-paid')), 'completed');
  assert.equal(customerActionStatus('attractionsPayment', withPay('advance-sent')), 'pending');
  assert.equal(customerActionStatus('attractionsPayment', withPay('advance-paid')), 'completed');
  // מקור האמת גובר על לוח התשלומים כשהוא מוכר
  assert.equal(customerActionStatus('attractionsPayment', customer({
    operations: { paymentStageInternal: 'advance-sent' },
    payments: { attractions: { status: 'Paid' } },
  })), 'pending');
  // תווית לא מוכרת → נסיגה ללוח התשלומים
  assert.equal(customerActionStatus('servicePayment', customer({
    operations: { paymentStageInternal: 'debt' },
    payments: { service: { status: 'Paid' } },
  })), 'completed');
  console.log('paymentStagePhase + customerActionStatus ✓');
}

// ===== 6. דטרמיניזם + תקפות כל תוצאה מול journeyConfig =====
{
  const cases = [];
  for (const internalStatus of [null, 'Abroad', 'Archive', 'Cancelled', 'Final QA', 'Waiting for meeting', 'Changes window open', 'Hotels catalog', 'Hotels Reservations'])
    for (const plan of [null, 'Changes form submitted', 'Approved', 'Sent for review'])
      for (const hotels of [null, true, false])
        for (const service of [null, 'Paid', 'Pending'])
          for (const payStage of [null, 'service-sent', 'advance-paid'])
            for (const startDate of [null, '2099-06-20'])
              cases.push(customer({
                planApprovalStatus: plan,
                operations: { internalStatus, hotelsBooked: hotels, paymentStageInternal: payStage },
                payments: { service: { status: service } },
                trip: { startDate },
              }));
  for (const pkg of ['basic', 'standard', 'advanced']) {
    for (const c of cases) {
      const a = derive(c, pkg);
      const b = derive(c, pkg);
      assert.deepEqual(a, b, 'דטרמיניזם');
      assert.ok(typeof a.reason === 'string' && a.reason.length > 0, 'לכל תוצאה יש סיבה');
      if (a.kind === 'resolved') {
        const stage = STAGES.find((s) => s.id === a.currentStageId);
        assert.ok(stage && stage.packages.includes(pkg), `שלב קיים לחבילה: ${a.currentStageId}/${pkg}`);
        assert.ok(relevantSubStates(stage, pkg).some((ss) => ss.id === a.currentSubstateId),
          `תת-מצב קיים: ${a.currentStageId}/${a.currentSubstateId}/${pkg}`);
        // המנוע לעולם אינו טוען שהמשוב הוגש — אין לו אות הגשה מאומת
        assert.ok(!(a.currentStageId === 'feedback' && a.currentSubstateId === 'submitted'),
          'feedback/submitted נשאר דמו-בלבד');
      }
    }
  }
  console.log(`runtime: דטרמיניזם + תקפות config על ${cases.length}×3 קלטים ✓`);
}

// ===== 7. פרשנים חדשים (Phase 1 home) =====
{
  const withAttr = (label) => customer({ operations: { attractionsReservationsStatus: label } });
  // ארבע התוויות המאומתות מהגדרת העמודה החיה
  assert.equal(attractionsReservationsPhase(withAttr('Yet to start')), 'notStarted');
  assert.equal(attractionsReservationsPhase(withAttr('Paid')), 'paid');
  assert.equal(attractionsReservationsPhase(withAttr('In Progress')), 'inProgress');
  assert.equal(attractionsReservationsPhase(withAttr('Completed')), 'completed');
  // רישיות/נוסח שונים אינם התווית המאומתת
  assert.equal(attractionsReservationsPhase(withAttr('paid')), 'other');
  assert.equal(attractionsReservationsPhase(withAttr('PAID')), 'other');
  assert.equal(attractionsReservationsPhase(withAttr('in progress')), 'other');
  assert.equal(attractionsReservationsPhase(withAttr('Complete')), 'other');
  assert.equal(attractionsReservationsPhase(withAttr('completed')), 'other');
  assert.equal(attractionsReservationsPhase(withAttr('Something else')), 'other');
  assert.equal(attractionsReservationsPhase(withAttr(null)), 'unknown');
  assert.equal(attractionsReservationsPhase(null), 'unknown');

  assert.equal(isoDatePassed('2099-06-01', '2099-05-31'), true);
  assert.equal(isoDatePassed('2099-06-01', '2099-06-01'), false);   // "היום" לא חלף
  assert.equal(isoDatePassed('2099-06-01', '2099-06-02'), false);
  assert.equal(isoDatePassed('2099-06-01', '2099-05-31T23:00:00'), true);   // רכיב התאריך בלבד
  assert.equal(isoDatePassed('2099-06-01', null), null);
  assert.equal(isoDatePassed('2099-06-01', 'שבור'), null);
  assert.equal(isoDatePassed('שבור', '2099-06-01'), null);
  console.log('attractionsReservationsPhase + isoDatePassed ✓');
}

console.log('journey-runtime-selftest: כל הבדיקות עברו ✓');
