// ============================================================
// זהות הלקוח הנוכחי — החוליה בין שכבת הנתונים (שלב 1) ל-UI.
//
// אין כאן מזהה לקוח קבוע: את מזהה ה-Monday מזריקים מבחוץ —
//   loadCustomerJourney(id)  — שליפה אמיתית דרך BENS WORKSPACE
//   setCustomerJourney(data) — הזרקת נתונים מוכנים (בדיקות/דמו)
//
// כשאין לקוח טעון (ברירת המחדל) האפליקציה מתנהגת בדיוק כדמו הקיים.
// חיווט הזהות בפרודקשן (מי הלקוח המחובר) עדיין חסר במוצר — מדווח
// כפער; המודול הזה מוכן לקבל אותו מכל מקור עתידי בלי שינוי UI.
// ============================================================

import { useSyncExternalStore } from 'react';
import { getCustomerJourneyData } from './monday/customerJourneyData.ts';
import type { CustomerJourneyData, CustomerJourneyResult } from './monday/customerJourneyData.ts';

let current: CustomerJourneyData | null = null;
const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((l) => l());
}

export function setCustomerJourney(data: CustomerJourneyData | null): void {
  current = data;
  emit();
}

// שליפה אמיתית. כישלון אינו נוגע במצב הקיים — הדמו ממשיך כרגיל,
// ולעולם לא נשארת "חצי טעינה" של לקוח אחר.
export async function loadCustomerJourney(clientMondayItemId: string): Promise<CustomerJourneyResult> {
  const res = await getCustomerJourneyData(clientMondayItemId);
  if (res.ok) setCustomerJourney(res.data);
  return res;
}

export function useCustomerJourney(): CustomerJourneyData | null {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => current,
    () => current,
  );
}

// ===== DEV בלבד — הזרקה ידנית מהקונסול / מבדיקות =====
// לא קיים בבאנדל פרודקשן. אינו מדפיס דבר מתוכן הלקוח.
if (import.meta.env.DEV && typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).__mrjCustomer = {
    load: loadCustomerJourney,
    set: setCustomerJourney,
    clear: () => setCustomerJourney(null),
  };
}
