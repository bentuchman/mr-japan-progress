// ============================================================
// שער Monday — תעבורה בלבד, דרך אינטגרציית BENS WORKSPACE ב-Make.
//
// עקרונות שאינם ניתנים למשא ומתן:
//   · טוקן Monday לעולם אינו כאן — הוא חי בתוך Make בלבד.
//   · כתובת ה-webhook אינה כתובה בקוד ואינה נארזת לבאנדל: לפרויקט אין
//     שכבת שרת, ולכן עד שתהיה — הכתובת מוזרקת בזמן ריצה בלבד
//     (configureMondayGateway). בלי הזרקה השער פשוט אינו מוגדר,
//     והאפליקציה ממשיכה לעבוד על נתוני הדמו.
//   · קריאה בלבד: שאילתות GraphQL מסוג query. mutation נחסם כאן,
//     לפני שהבקשה נשלחת.
//   · אפס לוגים של תוכן: לא שמות, לא כתובות, לא תגובות Monday.
// ============================================================

export interface MondayGatewayConfig {
  endpoint: string;            // כתובת ה-webhook של BENS WORKSPACE
  // צורת המעטפת של גוף הבקשה. ברירת המחדל נגזרת מהודעת השגיאה של
  // התרחיש ("Missing value of required parameter 'queryBody'").
  // אם בדיקת ה-Postman העובדת השתמשה במפתח אחר — משנים כאן בלבד.
  bodyKey?: string;
}

let config: MondayGatewayConfig | null = null;

export function configureMondayGateway(next: MondayGatewayConfig): void {
  config = next;
}

export function mondayGatewayConfigured(): boolean {
  return config !== null;
}

// ===== תוצאה טיפוסית — כישלון הוא ערך, לא חריגה =====
export type MondayResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: MondayError };

export type MondayError =
  | { kind: 'gateway-not-configured' }
  | { kind: 'mutation-refused' }
  | { kind: 'network'; status?: number }
  | { kind: 'bad-response' }                       // לא JSON / צורה לא צפויה
  | { kind: 'monday-error'; messages: string[] };  // שגיאות GraphQL מהשרת

// שאילתת קריאה חוקית: אחרי הסרת הערות, חייבת להיפתח ב-'query' או '{'.
// כל דבר אחר (בפרט mutation) נדחה לפני שליחה.
function isReadOnlyQuery(query: string): boolean {
  const stripped = query.replace(/#[^\n]*/g, '').trim();
  return /^(query\b|\{)/.test(stripped) && !/^\s*mutation\b/i.test(stripped);
}

export async function mondayQuery<T = unknown>(
  query: string,
  variables?: Record<string, unknown>,
): Promise<MondayResult<T>> {
  if (!config) return { ok: false, error: { kind: 'gateway-not-configured' } };
  if (!isReadOnlyQuery(query)) return { ok: false, error: { kind: 'mutation-refused' } };

  let res: Response;
  try {
    res = await fetch(config.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        [config.bodyKey ?? 'queryBody']: query,
        ...(variables ? { variables } : {}),
      }),
    });
  } catch {
    return { ok: false, error: { kind: 'network' } };
  }
  if (!res.ok) return { ok: false, error: { kind: 'network', status: res.status } };

  let payload: unknown;
  try {
    payload = await res.json();
  } catch {
    return { ok: false, error: { kind: 'bad-response' } };
  }

  const p = payload as { data?: T; errors?: Array<{ message?: string }> };
  if (Array.isArray(p?.errors) && p.errors.length > 0) {
    // הודעות שגיאה של GraphQL — טכניות, בלי נתוני לקוח
    return {
      ok: false,
      error: { kind: 'monday-error', messages: p.errors.map((e) => e?.message ?? 'unknown') },
    };
  }
  if (!p || typeof p !== 'object' || p.data === undefined) {
    return { ok: false, error: { kind: 'bad-response' } };
  }
  return { ok: true, data: p.data };
}
