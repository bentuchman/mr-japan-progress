// ============================================================
// מצבי אימות המסע (Phase 2) — נתוני דמה מקומיים בלבד.
//
//   fixture סינתטי (אותות Monday מאומתים, אפס נתוני אמת)
//     → deriveJourneyRuntimeState (המנוע האמיתי)
//     → שלב + תת-מצב שה-UI המאושר של ה-iPhone מציג
//
// אין כאן אף קריאת רשת, אף מזהה לקוח אמיתי ואף כתובת של לקוח.
// ============================================================

import type { CustomerJourneyData } from './monday/customerJourneyData.ts';
import type { JourneyRuntimeExtras } from './journeyRuntime.ts';
import { DEMO_ACTION_LINKS } from './journeyConfig.ts';

const emptyPayment = () =>
  ({ status: null, paymentUrl: null, paidAt: null, receiptUrl: null });

// עמוד מוטמע מדומה (data:) — מפעיל את מסלול ההטמעה הגנרי הקיים (zite/iframe)
// בלי אף בקשת רשת. מסומן במפורש כסביבת אימות; אינו עמוד תשלום אמיתי.
const mockEmbeddedPage = (title: string): string =>
  'data:text/html;charset=utf-8,' + encodeURIComponent(
    `<!doctype html><html dir="rtl" lang="he"><body style="margin:0;font-family:-apple-system,sans-serif;display:grid;place-items:center;min-height:96vh;background:#faf9f5;color:#33342e">`
    + `<div style="text-align:center;padding:24px"><div style="font-size:34px">🧪</div><h2 style="margin:10px 0 6px">${title}</h2>`
    + `<p style="color:#8a8f9c;margin:0">עמוד מדומה — סביבת אימות בלבד. אין כאן פעולה אמיתית.</p></div><\/body><\/html>`,
  );

// יעד ה-Zoom המדומה: עמוד הבדיקה הציבורי הרשמי של Zoom — גנרי, ללא
// לקוח וללא פגישה אמיתית; רק מדגים את התנהגות הפתיחה החיצונית הקיימת.
const MOCK_ZOOM_URL = 'https://zoom.us/test';

interface FixtureOverrides {
  plan?: string;
  internalStatus?: string | null;
  paymentStageInternal?: string | null;
  planApprovalStatus?: string | null;
  hotelsBooked?: boolean | null;
  attractionsReservationsStatus?: string | null;
  scheduledAt?: string | null;
  startDate?: string | null;
}

// לקוח סינתטי מלא — חבילת Advanced (המסע המלא), הכול null כברירת מחדל
function fixture(o: FixtureOverrides): CustomerJourneyData {
  return {
    clientMondayItemId: '000000-validation',
    paymentsMondayItemId: null,
    trip: { startDate: o.startDate ?? null, endDate: null, createdAt: null },
    meeting: {
      zoomMeetingId: null,
      scheduledAt: o.scheduledAt ?? null,
      meetingUrl: MOCK_ZOOM_URL,                                 // פתיחה חיצונית קיימת
      rescheduleUrl: DEMO_ACTION_LINKS.consultationReschedule,   // כתובות הדמו הנקיות —
      rescheduleUrlMaster: null,                                 // אינן ספציפיות ללקוח
    },
    forms: {
      hotelSelectionUrl: DEMO_ACTION_LINKS.hotelSelection,
      // טופס השינויים האמיתי טרם אומת (בפרודקשן העמודה מחזיקה webhook,
      // שנחסם); לאימות המסלול המוטמע משמש טופס Fillout נקי כ-placeholder
      planChangesUrl: DEMO_ACTION_LINKS.consultationReschedule,
      feedbackUrl: DEMO_ACTION_LINKS.feedback,
    },
    planApprovalStatus: o.planApprovalStatus ?? null,
    operations: {
      internalStatus: o.internalStatus ?? null,
      hotelsBooked: o.hotelsBooked ?? null,
      attractionsReservationsStatus: o.attractionsReservationsStatus ?? null,
      plan: o.plan ?? 'Advanced',
      paymentStageInternal: o.paymentStageInternal ?? null,
    },
    payments: {
      service: { ...emptyPayment(), paymentUrl: mockEmbeddedPage('תשלום דמי השירות') },
      attractions: { ...emptyPayment(), paymentUrl: mockEmbeddedPage('תשלום אטרקציות') },
    },
  };
}

const addDays = (todayIso: string, days: number): string => {
  const m = todayIso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return todayIso;
  const t = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + days);
  return new Date(t).toISOString().slice(0, 10);
};

export interface ValidationState {
  id: string;
  label: string;                                     // תווית בורר התרחישים (מחוץ לטלפונים)
  group: string;                                     // קבוצת תרחישים — לא ציר זמן קבוע
  build: (today: string) => CustomerJourneyData;     // ה-fixture, יחסית ל"היום"
  extras?: JourneyRuntimeExtras;                     // ראיות חיצוניות (הגשת משוב)
}

// תרחישי QA — לא 14 שלבי מסע ולא רצף ליניארי: בקבוצת הבחירות
// וההזמנות אלו מצבים מקבילים/וריאנטים (למשל: בקשת תשלום אטרקציות
// יכולה להיות פעילה במקביל לבחירת המלונות). כל תרחיש בנוי אך ורק
// מהאותות שאומתו מול פרודקשן.
const G1 = 'תוכנית ותשלום';
const G2 = 'פגישה ושינויים';
const G3 = 'בחירות והזמנות — תרחישים מקבילים, לא רצף';
const G4 = 'בטיול ואחרי';
export const VALIDATION_STATES: ValidationState[] = [
  { id: 'plan-building', label: '1 · תוכנית בבנייה', group: G1,
    build: () => fixture({}) },
  { id: 'service-due', label: '2 · תשלום שירות נדרש', group: G1,
    build: () => fixture({ paymentStageInternal: 'service-sent' }) },
  { id: 'meeting', label: '3 · שולם — פגישה נקבעה', group: G2,
    build: (today) => fixture({
      paymentStageInternal: 'service-paid',
      internalStatus: 'Waiting for meeting',
      scheduledAt: `${addDays(today, 3)}T19:00:00`,
    }) },
  { id: 'changes-window', label: '4 · חלון השינויים פתוח', group: G2,
    build: () => fixture({ paymentStageInternal: 'service-paid', internalStatus: 'Changes window open' }) },
  { id: 'hotels-selection', label: '5 · בחירת מלונות (אין בקשת תשלום)', group: G3,
    build: (today) => fixture({
      planApprovalStatus: 'Approved', internalStatus: 'Hotels catalog',
      hotelsBooked: false, startDate: addDays(today, 60),
    }) },
  { id: 'hotels-reservations', label: '6 · מלונות בהזמנה (צוות)', group: G3,
    build: (today) => fixture({
      planApprovalStatus: 'Approved', internalStatus: 'Hotels Reservations',
      hotelsBooked: false, startDate: addDays(today, 55),
    }) },
  { id: 'attractions-due-during', label: '7א · advance-sent בזמן הבחירות (6/10, שתי פעולות)', group: G3,
    build: (today) => fixture({
      planApprovalStatus: 'Approved', internalStatus: 'Hotels catalog',
      hotelsBooked: false,
      paymentStageInternal: 'advance-sent', startDate: addDays(today, 50),
    }) },
  { id: 'attractions-due-after', label: '7ב · advance-sent אחרי שהמלונות התקדמו (נשאר 7/10)', group: G3,
    build: (today) => fixture({
      planApprovalStatus: 'Approved', hotelsBooked: true,
      paymentStageInternal: 'advance-sent', startDate: addDays(today, 50),
    }) },
  { id: 'attractions-queued', label: '8 · שולם — ממתין לטיפול (Yet to start)', group: G3,
    build: (today) => fixture({
      planApprovalStatus: 'Approved', hotelsBooked: true,
      paymentStageInternal: 'advance-paid', attractionsReservationsStatus: 'Yet to start',
      startDate: addDays(today, 45),
    }) },
  { id: 'attractions-working', label: '9 · שולם — בביצוע (In Progress)', group: G3,
    build: (today) => fixture({
      planApprovalStatus: 'Approved', hotelsBooked: true,
      paymentStageInternal: 'advance-paid', attractionsReservationsStatus: 'In Progress',
      startDate: addDays(today, 40),
    }) },
  { id: 'all-ready', label: '10 · הכול הוזמן — מוכן לטיול', group: G3,
    build: (today) => fixture({
      planApprovalStatus: 'Approved', hotelsBooked: true,
      paymentStageInternal: 'advance-paid', attractionsReservationsStatus: 'Completed',
      startDate: addDays(today, 30),
    }) },
  { id: 'all-ready-basic', label: '11 · הכול מוכן — חבילת בסיס', group: G3,
    build: (today) => fixture({
      plan: 'Basic',
      planApprovalStatus: 'Approved', hotelsBooked: true,
      paymentStageInternal: 'advance-paid', attractionsReservationsStatus: 'Completed',
      startDate: addDays(today, 7),
    }) },
  { id: 'in-japan', label: '12 · ביפן', group: G4,
    build: () => fixture({ internalStatus: 'Abroad' }) },
  { id: 'feedback-open', label: '13 · משוב פתוח', group: G4,
    build: () => fixture({ internalStatus: 'Archive' }) },
  { id: 'feedback-submitted', label: '14 · המשוב הוגש', group: G4,
    build: () => fixture({ internalStatus: 'Archive' }),
    extras: { feedbackSubmitted: true } },
];
