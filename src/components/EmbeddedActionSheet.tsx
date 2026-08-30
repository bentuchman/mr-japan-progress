import { useCallback, useEffect, useRef, useState } from 'react';
import { ActionContentRenderer, isFilloutUrl } from './ActionContentRenderer';

// גיליון פעולה מוטמע — הדפוס הכללי של "פעולת לקוח נפתחת בתוך מר יפן".
// הרכיב אינו יודע איזה תוכן הוא מציג: כותרת + כתובת אטומה, וזהו.
interface Props {
  title: string;
  url: string;
  filloutFormId?: string;     // נדרש טכנית ל-renderer של Fillout
  filloutDomain?: string;     // דומיין מותאם — אופציונלי
  onClose: () => void;
  onSubmitted?: () => void;   // אופציונלי: התוכן המוטמע דיווח על שליחה
}

export type EmbedState = 'loading' | 'loaded' | 'error';

// ===== זיהוי חסימת הטמעה — שני אותות בלתי תלויים =====
// הדפדפן לא מדווח על כישלון frame חוצה-מקור, ו-onload נורה גם על עמוד
// שגיאה. לכן משלבים שתי בדיקות, ואף אחת מהן אינה עוקפת אבטחה:
//
// (1) האם היעד בכלל נגיש? fetch ב-mode:'no-cors' מחזיר תשובה אטומה
//     כשהיעד נענה, ונכשל רק בכשל רשת אמיתי. כך מפרידים "לא הגענו
//     לשרת" מ"הגענו אבל לא מוצג".
// (2) האם ההטמעה נחסמה? frame שנחסם ב-X-Frame-Options / frame-ancestors
//     נשאר על about:blank — same-origin, ולכן location שלו *ניתן
//     לקריאה*. תוכן חוצה-מקור שנטען בהצלחה זורק SecurityError.
export async function reachable(url: string): Promise<boolean> {
  try {
    await fetch(url, { mode: 'no-cors', cache: 'no-store', redirect: 'follow' });
    return true;
  } catch {
    return false;
  }
}

export function frameShowsRemoteContent(frame: HTMLIFrameElement | null): boolean {
  if (!frame) return false;
  try {
    const href = frame.contentWindow?.location.href;
    return !(href === undefined || href === 'about:blank');
  } catch {
    return true;   // חסום לקריאה = תוכן חוצה-מקור נמצא שם
  }
}

// המסקנה המשולבת. 'loading' כל עוד אין מספיק מידע.
export function embedVerdict(reach: boolean | null, frame: HTMLIFrameElement | null,
                             frameLoaded: boolean): EmbedState {
  if (reach === false) return 'error';                 // לא הגענו ליעד
  if (!frameLoaded || reach === null) return 'loading';
  return frameShowsRemoteContent(frame) ? 'loaded' : 'error';
}

export function EmbeddedActionSheet({ title, url, filloutFormId, filloutDomain, onClose, onSubmitted }: Props) {
  const isFillout = isFilloutUrl(url) && !!filloutFormId;
  const [reach, setReach] = useState<boolean | null>(null);
  const [ready, setReady] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const frame = useRef<HTMLIFrameElement>(null);

  // ===== מתי מוכרז כישלון =====
  // Fillout: אך ורק לפי מחזור החיים של הספק (onInit). *אין* הכרזת
  // כישלון — לא על טיימר, לא לפי frame חוצה-מקור שאי אפשר לבדוק,
  // ולא לפי בדיקת נגישות (שהייתה נכשלת על דומיין מותאם גם כשההטמעה
  // עצמה תקינה). אם ההטמעה מתעכבת, מוצעת יציאה לחלון חדש לצד מצב
  // הטעינה — הצעה, לא הכרזת כישלון.
  // תוכן גנרי אחר: כמו קודם — נגישות + בדיקת ה-frame.
  const state: EmbedState = isFillout
    ? ready ? 'loaded' : 'loading'
    : embedVerdict(reach, frame.current, ready || timedOut);

  useEffect(() => {
    if (isFillout) return;   // ה-renderer של הספק אינו נשען על בדיקה זו
    reachable(url).then(setReach);
  }, [url, isFillout]);
  useEffect(() => {
    const t = window.setTimeout(() => setTimedOut(true), isFillout ? 15000 : 10000);
    return () => window.clearTimeout(t);
  }, [isFillout]);
  const onReady = useCallback(() => { setReady(true); }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fj-overlay eas-overlay" onClick={onClose}>
      <div className="eas-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={title}>
        <div className="eas-grip" aria-hidden />
        <div className="eas-head">
          <span className="eas-title">{title}</span>
          <button className="eas-close" onClick={onClose} aria-label="סגירה">✕</button>
        </div>

        <div className="eas-body">
          {/* בחירת ה-renderer לפי סוג התוכן — Fillout מקבל טיפול ייעודי */}
          <div className={`eas-content${state === 'loaded' ? ' on' : ''}`}>
            <ActionContentRenderer
              url={url}
              title={title}
              filloutFormId={filloutFormId}
              filloutDomain={filloutDomain}
              onReady={onReady}
              onSubmitted={onSubmitted}
              webFrameRef={frame}
            />
          </div>
          {state === 'loading' && (
            <div className="eas-state">
              <span>טוען…</span>
              {/* מתעכב? הצעה בלבד, בלי להכריז שההטמעה נכשלה */}
              {timedOut && (
                <a className="eas-fallback" href={url} target="_blank" rel="noopener noreferrer">
                  פתיחה בחלון חדש ↗
                </a>
              )}
            </div>
          )}
          {/* כישלון הטמעה — הודעה קצרה, והיציאה החוצה רק כאן וביוזמת הלקוח */}
          {state === 'error' && (
            <div className="eas-state">
              <b>לא הצלחנו להציג את התוכן בתוך האפליקציה.</b>
              <a className="eas-fallback" href={url} target="_blank" rel="noopener noreferrer">
                פתיחה בחלון חדש ↗
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
