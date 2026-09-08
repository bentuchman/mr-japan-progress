// ============================================================
// שלב 1 של אינטגרציית Monday — שליפה ונרמול בלבד.
//
//   מזהה האייטם של הלקוח ב-Monday
//     → BENS WORKSPACE (שער קריאה בלבד)
//     → אייטם הלקוח בלוח Clients
//     → אייטם התשלומים המקושר (board relation — לא לפי שם!)
//     → CustomerJourneyData מנורמל
//
// המודול הזה *אינו* מחובר ל-UI של המסע. החיבור — בשלב הבא, אחרי
// סקירת התוצאה. אין כאן אף מזהה לקוח אמיתי ואף כתובת של לקוח.
// ============================================================

import { mondayQuery } from './gateway.ts';
import type { MondayResult, MondayError } from './gateway.ts';

// ===== המבנה המאומת (רישום קריאה בלבד מול החשבון האמיתי) =====
export const CLIENTS_BOARD_ID = '3573104071';
export const PAYMENTS_BOARD_ID = '18241802903';

export const CLIENTS_COLUMNS = {
  itemId: 'item_id__1',                    // item_id
  startTrip: 'date2',                      // date
  endTrip: 'date3',                        // date — End Trip
  createdAt: 'date38__1',                  // date
  internalStatus: 'dup__of_internal_status__1',  // status — מצב תפעולי (Abroad/Archive/…)
  hotelsBooked: 'dup__of_skeleton__1',     // checkbox — הצוות סימן שהמלונות הוזמנו
  attractionsReservations: 'status__1',    // status — Attractions Reservations (מצב עבודת ההזמנות, *לא* תשלום)
  plan: 'status8',                         // status — Plan: Basic/Standard/Advanced (מקור החבילה; לא status1)
  paymentStageInternal: 'color_mm145w28',  // status — payment-stage-internal: מקור האמת לתשלומים
  zoomMeetingId: 'text2__1',               // text
  zoomMeetingDateTime: 'date_mkkb5x8a',    // date
  meetingLink: 'link_mkkc5hf3',            // link
  hotelsSelectionLink: 'text37__1',        // text
  feedbackFormLink: 'formula_mkqsm1n3',    // formula
  meetingRescheduleLink: 'formula_mkrs2ca0',        // formula
  meetingRescheduleLinkMaster: 'formula_mkxr13vp',  // formula
  planChangesForm: 'link_mkyr785r',        // link
  planApproval: 'color_mkym5k62',          // status — מקור האמת למעבר 4→5→6 (אישור מור)
  paymentsRelation: 'board_relation_mkx3224n',      // board_relation
} as const;

export const PAYMENTS_COLUMNS = {
  serviceStatus: 'status',                 // status
  servicePaidAt: 'date_mm45fm8c',          // date
  serviceLink: 'link_mkwz73ze',            // link
  serviceReceipt: 'link_mkwzhc8x',         // link
  advStatus: 'color_mkx33ksf',             // status
  advLink: 'link_mkx3zd4',                 // link
  advReceipt: 'link_mkx3wqha',             // link
  advPaidAt: 'date_mm4zjj26',              // date
} as const;

// ===== המודל המנורמל — מה שהאפליקציה תקבל ללקוח אחד =====
// כל שדה יכול להיות null: עמודה ריקה/חסרה לעולם אינה מפילה כלום.
export interface PaymentInfo {
  status: string | null;       // התווית הגולמית מ-Monday (למשל "Paid") — בלי פרשנות בשלב זה
  paymentUrl: string | null;
  paidAt: string | null;       // ISO
  receiptUrl: string | null;
}

export interface CustomerJourneyData {
  clientMondayItemId: string;
  paymentsMondayItemId: string | null;   // null = אין קישור ללוח התשלומים
  trip: {
    startDate: string | null;            // Start Trip — לצורך חוק 3 החודשים (שלב הבא)
    endDate: string | null;              // End Trip — כפי שנשמר ב-Monday (YYYY-MM-DD)
    createdAt: string | null;            // Created at
  };
  // אותות תפעוליים גולמיים — תוויות/סימונים כפי שהם ב-Monday, בלי
  // פרשנות עסקית בשכבה הזו. הפירוש (וההבחנה "לא ידוע" ≠ "לא") חי
  // ב-customerActions בלבד.
  operations: {
    internalStatus: string | null;               // Internal Status — התווית המדויקת
    hotelsBooked: boolean | null;                // checkbox: true/false מפורשים, null = לא ידוע
    attractionsReservationsStatus: string | null; // Attractions Reservations — התווית המדויקת
    plan: string | null;                         // Plan (status8) — Basic/Standard/Advanced
    paymentStageInternal: string | null;         // payment-stage-internal — מקור האמת לתשלומים
  };
  meeting: {
    zoomMeetingId: string | null;
    scheduledAt: string | null;
    meetingUrl: string | null;
    rescheduleUrl: string | null;        // Meeting reschedule link
    rescheduleUrlMaster: string | null;  // (MASTER) — עד שיוכרע מי מהם המקור
  };
  forms: {
    hotelSelectionUrl: string | null;
    planChangesUrl: string | null;
    feedbackUrl: string | null;
  };
  // Plan Approval — התווית הגולמית מ-Monday, ללא פרשנות בשכבה הזו.
  // המשמעות העסקית (מור): 'Changes form submitted' = שלב 5 פעיל;
  // 'Approved' = שלב 5 הסתיים. הפירוש חי ב-customerActions בלבד.
  planApprovalStatus: string | null;
  payments: {
    service: PaymentInfo;
    attractions: PaymentInfo;
  };
}

export type CustomerJourneyResult =
  | { ok: true; data: CustomerJourneyData }
  | { ok: false; error: MondayError | { kind: 'client-not-found' } };

// ===== פירוק ערכי עמודה — לפי טיפוס העמודה ב-Monday =====
interface RawColumnValue {
  id: string;
  type?: string;
  text?: string | null;
  value?: string | null;            // JSON גולמי של Monday
  display_value?: string | null;    // FormulaValue
  linked_item_ids?: string[] | null; // BoardRelationValue
}

function parseValueJson(cv: RawColumnValue | undefined): Record<string, unknown> | null {
  if (!cv?.value) return null;
  try {
    const v = JSON.parse(cv.value);
    return v && typeof v === 'object' ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

const clean = (s: unknown): string | null =>
  typeof s === 'string' && s.trim() !== '' ? s.trim() : null;

// עמודת link: הכתובת האמיתית מ-value.url — לא טקסט התצוגה
function linkUrl(cv: RawColumnValue | undefined): string | null {
  return clean(parseValueJson(cv)?.url) ?? null;
}

// עמודת text שמחזיקה כתובת (Hotels selection link)
function textValue(cv: RawColumnValue | undefined): string | null {
  return clean(cv?.text);
}

// עמודת formula: display_value (API מודרני), עם נסיגה ל-text
function formulaValue(cv: RawColumnValue | undefined): string | null {
  return clean(cv?.display_value) ?? clean(cv?.text);
}

// עמודת date: value = {"date":"YYYY-MM-DD","time":"HH:mm:ss"|null}
function dateValue(cv: RawColumnValue | undefined): string | null {
  const v = parseValueJson(cv);
  const date = clean(v?.date);
  if (!date) return clean(cv?.text);
  const time = clean(v?.time);
  return time ? `${date}T${time}` : date;
}

// עמודת status: התווית כפי שהיא ("Paid" וכו')
function statusLabel(cv: RawColumnValue | undefined): string | null {
  return clean(cv?.text);
}

// עמודת checkbox: value = {"checked": true|false} (גרסאות API ישנות
// מחזירות "true"/"false" כמחרוזת). אך ורק הערך המובנה — לא הטקסט
// ("v"/"") שהוא ייצוג תצוגה. חסר/שבור → null, ולעולם לא false:
// "לא ידוע" אינו "לא מסומן".
function checkboxValue(cv: RawColumnValue | undefined): boolean | null {
  const checked = parseValueJson(cv)?.checked;
  if (checked === true || checked === 'true') return true;
  if (checked === false || checked === 'false') return false;
  return null;
}

// board_relation: מזהי האייטמים המקושרים. שני מסלולים —
// linked_item_ids (fragment מודרני) או value.linkedPulseIds (קלאסי).
function linkedItemIds(cv: RawColumnValue | undefined): string[] {
  if (Array.isArray(cv?.linked_item_ids) && cv.linked_item_ids.length > 0) {
    return cv.linked_item_ids.map(String);
  }
  const raw = parseValueJson(cv)?.linkedPulseIds;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((e) => (e && typeof e === 'object' ? (e as { linkedPulseId?: unknown }).linkedPulseId : null))
    .filter((x): x is number | string => typeof x === 'number' || typeof x === 'string')
    .map(String);
}

const byId = (cols: RawColumnValue[]): Map<string, RawColumnValue> =>
  new Map(cols.map((c) => [c.id, c]));

// ===== השאילתות — query בלבד, עמודות נדרשות בלבד, אייטם אחד בלבד =====
interface ItemsData {
  items: Array<{ id: string; column_values: RawColumnValue[] }> | null;
}

export const CLIENT_ITEM_QUERY = `
query ($itemId: [ID!], $columnIds: [String!]) {
  items (ids: $itemId) {
    id
    column_values (ids: $columnIds) {
      id
      type
      text
      value
      ... on FormulaValue { display_value }
      ... on BoardRelationValue { linked_item_ids }
    }
  }
}`;

export const PAYMENT_ITEM_QUERY = `
query ($itemId: [ID!], $columnIds: [String!]) {
  items (ids: $itemId) {
    id
    column_values (ids: $columnIds) {
      id
      type
      text
      value
    }
  }
}`;

const emptyPayment = (): PaymentInfo =>
  ({ status: null, paymentUrl: null, paidAt: null, receiptUrl: null });

// ===== לוח המשובים — הוכחת הגשת משוב =====
// משוב "הוגש" ⇔ קיים אייטם בלוח Feedbacks שה-relation שלו מצביע על
// אייטם הלקוח (linkedPulseId). לא לפי שם, לא לפי מחרוזות, ולא לפי
// Archive. נשלפת אך ורק עמודת ה-relation (מזהים אטומים) — לא שמות ולא
// תוכן משוב. כישלון/חריגה → null: "לא ידוע" לעולם אינו "הוגש".
export const FEEDBACKS_BOARD_ID = '9107032141';
export const FEEDBACKS_COLUMNS = {
  clientsRelation: 'board_relation_mkqs44fs',   // Clients 😀 — board_relation
} as const;

export const FEEDBACKS_PAGE_QUERY = `
query ($boardId: [ID!], $columnIds: [String!], $cursor: String) {
  boards (ids: $boardId) {
    items_page (limit: 100, cursor: $cursor) {
      cursor
      items {
        id
        column_values (ids: $columnIds) {
          id
          value
          ... on BoardRelationValue { linked_item_ids }
        }
      }
    }
  }
}`;

interface FeedbackItemsPage {
  cursor: string | null;
  items: Array<{ id: string; column_values: RawColumnValue[] }>;
}

interface FeedbackPageData {
  boards: Array<{ items_page: FeedbackItemsPage | null }> | null;
}

// טהור ובדיק: האם אחד מאייטמי המשוב מקושר ללקוח הזה. אייטם בלי relation
// לעולם אינו תואם אף לקוח (מסונן מעצם בדיקת החברות).
export function feedbackLinkedToClient(
  items: Array<{ column_values?: RawColumnValue[] }>,
  clientMondayItemId: string,
): boolean {
  return items.some((item) =>
    linkedItemIds(item.column_values?.find((cv) => cv.id === FEEDBACKS_COLUMNS.clientsRelation))
      .includes(String(clientMondayItemId)),
  );
}

const MAX_FEEDBACK_PAGES = 30;   // תקרת בטיחות — מעבר לה: "לא ידוע", לא ניחוש

export async function getFeedbackSubmitted(
  clientMondayItemId: string,
): Promise<boolean | null> {
  let cursor: string | null = null;
  for (let page = 0; page < MAX_FEEDBACK_PAGES; page++) {
    const res: MondayResult<FeedbackPageData> = await mondayQuery<FeedbackPageData>(
      FEEDBACKS_PAGE_QUERY,
      { boardId: [FEEDBACKS_BOARD_ID], columnIds: [FEEDBACKS_COLUMNS.clientsRelation], cursor },
    );
    if (!res.ok) return null;
    const pageData: FeedbackItemsPage | null | undefined = res.data.boards?.[0]?.items_page;
    if (!pageData) return null;
    if (feedbackLinkedToClient(pageData.items ?? [], clientMondayItemId)) return true;
    cursor = pageData.cursor;
    if (cursor === null) return false;   // כל הלוח נסרק — אין קישור
  }
  return null;   // הלוח גדול מהתקרה — לא ידוע, לא "לא הוגש"
}

// ===== הכניסה הראשית: לקוח אחד, לפי מזהה — לעולם לא לפי שם =====
export async function getCustomerJourneyData(
  clientMondayItemId: string,
): Promise<CustomerJourneyResult> {
  // --- 1. אייטם הלקוח בלוח Clients ---
  const clientRes: MondayResult<ItemsData> = await mondayQuery<ItemsData>(CLIENT_ITEM_QUERY, {
    itemId: [clientMondayItemId],
    columnIds: Object.values(CLIENTS_COLUMNS),
  });
  if (!clientRes.ok) return clientRes;
  const clientItem = clientRes.data.items?.[0];
  if (!clientItem) return { ok: false, error: { kind: 'client-not-found' } };
  const c = byId(clientItem.column_values ?? []);

  // --- 2. פתרון הקשר ללוח התשלומים — דרך ה-board relation בלבד ---
  const paymentIds = linkedItemIds(c.get(CLIENTS_COLUMNS.paymentsRelation));
  const paymentsMondayItemId = paymentIds[0] ?? null;

  // --- 3. אייטם התשלומים המקושר (אם קיים) ---
  let p = new Map<string, RawColumnValue>();
  if (paymentsMondayItemId) {
    const payRes = await mondayQuery<ItemsData>(PAYMENT_ITEM_QUERY, {
      itemId: [paymentsMondayItemId],
      columnIds: Object.values(PAYMENTS_COLUMNS),
    });
    // אייטם תשלומים חסר/שגוי אינו מפיל את הלקוח — נשארים עם ערכי null
    if (payRes.ok) p = byId(payRes.data.items?.[0]?.column_values ?? []);
  }

  // --- 4. נרמול ---
  return {
    ok: true,
    data: {
      clientMondayItemId: clientItem.id,
      paymentsMondayItemId,
      trip: {
        startDate: dateValue(c.get(CLIENTS_COLUMNS.startTrip)),
        endDate: dateValue(c.get(CLIENTS_COLUMNS.endTrip)),
        createdAt: dateValue(c.get(CLIENTS_COLUMNS.createdAt)),
      },
      operations: {
        internalStatus: statusLabel(c.get(CLIENTS_COLUMNS.internalStatus)),
        hotelsBooked: checkboxValue(c.get(CLIENTS_COLUMNS.hotelsBooked)),
        attractionsReservationsStatus: statusLabel(c.get(CLIENTS_COLUMNS.attractionsReservations)),
        plan: statusLabel(c.get(CLIENTS_COLUMNS.plan)),
        paymentStageInternal: statusLabel(c.get(CLIENTS_COLUMNS.paymentStageInternal)),
      },
      meeting: {
        zoomMeetingId: textValue(c.get(CLIENTS_COLUMNS.zoomMeetingId)),
        scheduledAt: dateValue(c.get(CLIENTS_COLUMNS.zoomMeetingDateTime)),
        meetingUrl: linkUrl(c.get(CLIENTS_COLUMNS.meetingLink)),
        rescheduleUrl: formulaValue(c.get(CLIENTS_COLUMNS.meetingRescheduleLink)),
        rescheduleUrlMaster: formulaValue(c.get(CLIENTS_COLUMNS.meetingRescheduleLinkMaster)),
      },
      forms: {
        hotelSelectionUrl: textValue(c.get(CLIENTS_COLUMNS.hotelsSelectionLink)),
        planChangesUrl: linkUrl(c.get(CLIENTS_COLUMNS.planChangesForm)),
        feedbackUrl: formulaValue(c.get(CLIENTS_COLUMNS.feedbackFormLink)),
      },
      planApprovalStatus: statusLabel(c.get(CLIENTS_COLUMNS.planApproval)),
      payments: {
        service: paymentsMondayItemId
          ? {
              status: statusLabel(p.get(PAYMENTS_COLUMNS.serviceStatus)),
              paymentUrl: linkUrl(p.get(PAYMENTS_COLUMNS.serviceLink)),
              paidAt: dateValue(p.get(PAYMENTS_COLUMNS.servicePaidAt)),
              receiptUrl: linkUrl(p.get(PAYMENTS_COLUMNS.serviceReceipt)),
            }
          : emptyPayment(),
        attractions: paymentsMondayItemId
          ? {
              status: statusLabel(p.get(PAYMENTS_COLUMNS.advStatus)),
              paymentUrl: linkUrl(p.get(PAYMENTS_COLUMNS.advLink)),
              paidAt: dateValue(p.get(PAYMENTS_COLUMNS.advPaidAt)),
              receiptUrl: linkUrl(p.get(PAYMENTS_COLUMNS.advReceipt)),
            }
          : emptyPayment(),
      },
    },
  };
}
