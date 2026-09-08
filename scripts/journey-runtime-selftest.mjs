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
    operations: { internalStatus: null, hotelsBooked: null, attractionsReservationsStatus: null },
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
  const other = derive(customer({ operations: { internalStatus: 'Final QA' }, payments: { service: { status: 'Pending' } } }));
  expectStage(other, 'service-payment', 'due', 'Final QA נופל לטרום-טיול');
  console.log('runtime: Abroad/Archive/other ✓');
}

// ===== 3. שלבים 2–4 =====
{
  // אין שום ראיה → unknown, לא ניחוש
  expectUnknown(derive(customer()), 'ללא ראיות');
  // תשלום שירות פתוח (תווית שאינה Paid)
  expectStage(derive(customer({ payments: { service: { status: 'Pending' } } })), 'service-payment', 'due', 'לא שולם');
  // שולם; אין פגישה → טרם נקבעה
  expectStage(derive(customer({ payments: { service: { status: 'Paid' } } })), 'meeting', 'upcoming', 'שולם בלי פגישה');
  // שולם; פגישה עתידית / היום → נקבעה
  expectStage(derive(customer({ payments: { service: { status: 'Paid' } }, meeting: { scheduledAt: '2099-06-10T19:00:00' } })),
    'meeting', 'scheduled', 'פגישה עתידית');
  expectStage(derive(customer({ payments: { service: { status: 'Paid' } }, meeting: { scheduledAt: TODAY } })),
    'meeting', 'scheduled', 'פגישה היום');
  // מועד הפגישה חלף וטופס השינויים טרם נקלט → מעבר 3→4 לא נפתר → unknown
  expectUnknown(derive(customer({ payments: { service: { status: 'Paid' } }, meeting: { scheduledAt: '2099-05-01T19:00:00' } })),
    'פגישה שחלפה');
  // מועד פגישה שבור → unknown
  expectUnknown(derive(customer({ payments: { service: { status: 'Paid' } }, meeting: { scheduledAt: 'מחר בערב' } })),
    'מועד שבור');
  console.log('runtime: שלבים 2–4 ✓');
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
  expectUnknown(derive(customer({ planApprovalStatus: 'Sent for review' })), 'Sent for review לבדו');
  console.log('runtime: גבול 3↔4 לפי Internal Status ✓');
}

// ===== 4. שלב 5 — Plan Approval של מור =====
{
  expectStage(derive(customer({ planApprovalStatus: 'Changes form submitted' })), 'changes-processing', 'working', 'שלב 5');
  // תווית Plan Approval לא מוכרת → אינה מקדמת; נופל לשלבים 2–4
  expectStage(derive(customer({ planApprovalStatus: 'Working on it', payments: { service: { status: 'Pending' } } })),
    'service-payment', 'due', 'plan לא מוכר');
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

  // שלב 8 פעיל רק על האות הישיר: הזמנת האטרקציות In Progress
  expectStage(derive(approved({
    operations: { hotelsBooked: true, attractionsReservationsStatus: 'In Progress' },
  })), 'attractions-booking', 'working', 'In Progress → בביצוע');
  // חבילת בסיס: אין שלב attractions-booking → unknown מפורש, לא המצאה
  expectUnknown(derive(approved({
    operations: { hotelsBooked: true, attractionsReservationsStatus: 'In Progress' },
  }), 'basic'), 'basic ללא שלב הזמנת אטרקציות');

  // תשלום בלוח התשלומים לבדו *אינו* מקדם לשלב 8 — ההנחה הקודמת בוטלה,
  // המעבר טעון אימות עסקי → עצירה בטוחה
  for (const attrRes of ['Yet to start', null]) {
    expectUnknown(derive(approved({
      operations: { hotelsBooked: true, attractionsReservationsStatus: attrRes },
      payments: { attractions: { status: 'Paid' } },
    })), `שולם + ${attrRes} → לא working`);
  }
  // גם התווית החדשה 'Paid' בעוקב ההזמנות לבדה אינה מעבר מאומת לשלב 8
  expectUnknown(derive(approved({
    operations: { hotelsBooked: true, attractionsReservationsStatus: 'Paid' },
  })), 'Attractions Reservations = Paid → לא working');

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
    operations: { hotelsBooked: true, attractionsReservationsStatus: 'In Progress' },
  })), 'attractions-booking', 'working', 'הוזמן → שלב 8, לא שלב 7');
  // תווית Hotels Reservations ישנה אינה מושכת אחורה לקוח שהתקדם:
  // המלונות כבר הוזמנו → האות במורד הזרם גובר
  expectStage(derive(approved({
    operations: { internalStatus: 'Hotels Reservations', hotelsBooked: true, attractionsReservationsStatus: 'Completed' },
  })), 'attractions-booking', 'all-ready', 'תווית ישנה מול all-ready');
  expectStage(derive(approved({
    operations: { internalStatus: 'Hotels Reservations', hotelsBooked: true, attractionsReservationsStatus: 'In Progress' },
  })), 'attractions-booking', 'working', 'תווית ישנה מול שלב 8 פעיל');
  // המיפוי חי רק תחת Approved: בלי אישור מור התווית אינה מקדמת לשלב 7
  const noApproval = derive(customer({ operations: { internalStatus: 'Hotels Reservations' } }));
  assert.ok(!(noApproval.kind === 'resolved' && noApproval.currentStageId === 'hotels-booking'),
    'Hotels Reservations בלי Approved אינו שלב 7');
  console.log('runtime: אזור 6–8 + גבול 6↔7 ✓');
}

// ===== 6. דטרמיניזם + תקפות כל תוצאה מול journeyConfig =====
{
  const cases = [];
  for (const internalStatus of [null, 'Abroad', 'Archive', 'Cancelled', 'Final QA', 'Waiting for meeting', 'Changes window open', 'Hotels catalog', 'Hotels Reservations'])
    for (const plan of [null, 'Changes form submitted', 'Approved', 'Sent for review'])
      for (const hotels of [null, true, false])
        for (const service of [null, 'Paid', 'Pending'])
          for (const startDate of [null, '2099-06-20', '2099-12-01'])
            cases.push(customer({
              planApprovalStatus: plan,
              operations: { internalStatus, hotelsBooked: hotels },
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
