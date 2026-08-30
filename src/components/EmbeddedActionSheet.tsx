import { useEffect, useRef, useState } from 'react';

// גיליון פעולה מוטמע — הדפוס הכללי של "פעולת לקוח נפתחת בתוך מר יפן".
// הרכיב אינו יודע איזה תוכן הוא מציג: כותרת + כתובת אטומה, וזהו.
interface Props {
  title: string;
  url: string;
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

export function EmbeddedActionSheet({ title, url, onClose, onSubmitted }: Props) {
  const [reach, setReach] = useState<boolean | null>(null);
  const [frameLoaded, setFrameLoaded] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const frame = useRef<HTMLIFrameElement>(null);
  const [, force] = useState(0);
  const state: EmbedState = timedOut
    ? embedVerdict(reach, frame.current, true)
    : embedVerdict(reach, frame.current, frameLoaded);

  useEffect(() => { reachable(url).then(setReach); }, [url]);
  useEffect(() => {
    const t = window.setTimeout(() => setTimedOut(true), 10000);
    return () => window.clearTimeout(t);
  }, []);
  // בדיקה חוזרת אחרי onload — הספק עשוי לבצע הפניה פנימית
  function check() { setFrameLoaded(true); window.setTimeout(() => force((n) => n + 1), 900); }

  // דיווח שליחה מהטופס המוטמע — best-effort, ורק ממקור fillout.
  // אם ההודעה לא מגיעה, לא קורה כלום: לא מדמים סנכרון שאינו קיים.
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      try {
        if (!/(^|\.)fillout\.com$/.test(new URL(e.origin).hostname)) return;
        const d = e.data as unknown;
        const raw = typeof d === 'string' ? d : typeof d === 'object' && d ? JSON.stringify(d) : '';
        if (/submit/i.test(raw)) onSubmitted?.();
      } catch {
        /* origin לא תקין — מתעלמים */
      }
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [onSubmitted]);

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
          <iframe
            ref={frame}
            className={`eas-frame${state === 'loaded' ? ' on' : ''}`}
            src={url}
            title={title}
            onLoad={check}
            allow="clipboard-write; fullscreen"
            referrerPolicy="no-referrer-when-downgrade"
          />
          {state === 'loading' && <div className="eas-state">טוען…</div>}
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
