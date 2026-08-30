import { useEffect, useRef, useState } from 'react';

// גיליון פעולה מוטמע — הדפוס הכללי של "פעולת לקוח נפתחת בתוך מר יפן".
// לא מיוחד למלונות: אותו רכיב ישמש גם לטופס שינויים, פידבק וכל קישור
// פעולה אחר. הרכיב מקבל כתובת אטומה ואינו יודע דבר על מבנה ה-URL.
interface Props {
  title: string;
  url: string;
  onClose: () => void;
  onSubmitted?: () => void;   // אופציונלי: הטופס דיווח על שליחה
}

// דיווח שליחה מהטופס המוטמע — best-effort. אם ההודעה לא מגיעה, לא קורה
// כלום: אנחנו לא מדמים סנכרון פרודקשן שלא קיים.
function isSubmitMessage(e: MessageEvent): boolean {
  if (!/(^|\.)fillout\.com$/.test(new URL(e.origin).hostname)) return false;
  const d = e.data as unknown;
  const raw = typeof d === 'string' ? d : typeof d === 'object' && d ? JSON.stringify(d) : '';
  return /submit/i.test(raw);
}

export function EmbeddedActionSheet({ title, url, onClose, onSubmitted }: Props) {
  const [loaded, setLoaded] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const frame = useRef<HTMLIFrameElement>(null);

  // חסימת הטמעה (CSP / X-Frame-Options / מדיניות דפדפן) אינה נעקפת.
  // הדפדפן אינו מדווח על כישלון של frame חוצה-מקור בצורה אמינה, ולכן:
  // (1) אם onload לא נורה כלל תוך 6 שניות — מציגים הסבר בתוך הגיליון;
  // (2) בכל מקרה יש קישור גיבוי גלוי בכותרת, ביוזמת הלקוח בלבד.
  useEffect(() => {
    const t = window.setTimeout(() => setBlocked((b) => (loaded ? b : true)), 6000);
    return () => window.clearTimeout(t);
  }, [loaded]);

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      try {
        if (isSubmitMessage(e)) onSubmitted?.();
      } catch {
        /* origin לא תקין — מתעלמים */
      }
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [onSubmitted]);

  // Esc סוגר; הרקע מעומעם ונשאר במקומו מאחור
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
          <span className="eas-head-end">
            {/* גיבוי ביוזמת הלקוח — אם הטופס אינו נטען בדפדפן שלו */}
            <a className="eas-out" href={url} target="_blank" rel="noopener noreferrer">
              פתיחה בחלון חדש ↗
            </a>
            <button className="eas-close" onClick={onClose} aria-label="סגירה">✕</button>
          </span>
        </div>
        <div className="eas-body">
          {!loaded && !blocked && <div className="eas-state">טוען…</div>}
          {blocked && (
            <div className="eas-state eas-blocked">
              <b>הטופס לא נטען כאן</b>
              <span>ייתכן שהאתר של הטופס אינו מתיר הטמעה בדפדפן הזה.</span>
              <a className="eas-fallback" href={url} target="_blank" rel="noopener noreferrer">
                פתיחת הטופס בחלון חדש ←
              </a>
            </div>
          )}
          <iframe
            ref={frame}
            className={`eas-frame${loaded ? ' on' : ''}`}
            src={url}
            title={title}
            onLoad={() => { setLoaded(true); setBlocked(false); }}
            allow="clipboard-write; fullscreen"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
      </div>
    </div>
  );
}
