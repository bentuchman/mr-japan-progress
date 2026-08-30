import { useEffect, useState } from 'react';

// גיליון פעולה מוטמע — הדפוס הכללי של "פעולת לקוח נפתחת בתוך מר יפן".
// הרכיב אינו יודע איזה תוכן הוא מציג (מלונות / טופס שינויים / פידבק):
// הוא מקבל כותרת וכתובת אטומה, ומרנדר אותן.
interface Props {
  title: string;
  url: string;
  onClose: () => void;
  onSubmitted?: () => void;   // אופציונלי: התוכן המוטמע דיווח על שליחה
}

// דיווח שליחה מהטופס המוטמע — best-effort. אם ההודעה לא מגיעה, לא קורה
// כלום: אנחנו לא מדמים סנכרון שאינו קיים.
function isSubmitMessage(e: MessageEvent): boolean {
  if (!/(^|\.)fillout\.com$/.test(new URL(e.origin).hostname)) return false;
  const d = e.data as unknown;
  const raw = typeof d === 'string' ? d : typeof d === 'object' && d ? JSON.stringify(d) : '';
  return /submit/i.test(raw);
}

export function EmbeddedActionSheet({ title, url, onClose, onSubmitted }: Props) {
  const [loaded, setLoaded] = useState(false);
  const [stalled, setStalled] = useState(false);

  // הדפדפן אינו חושף אם frame חוצה-מקור נחסם (X-Frame-Options /
  // frame-ancestors) או פשוט נכשל: onload נורה גם על עמוד שגיאה, ואי
  // אפשר לקרוא את תוכנו. לכן לא מנחשים:
  //   • כל עוד לא נורה onload — מצב טעינה, ואחרי 8 שניות הסבר.
  //   • תמיד יש שורת גיבוי גלויה בתחתית הגיליון, ביוזמת הלקוח בלבד.
  // כך הגיליון לעולם אינו נשאר מסך לבן בלי הסבר. אין עקיפת אבטחה.
  useEffect(() => {
    if (loaded) return;
    const t = window.setTimeout(() => setStalled(true), 8000);
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
            className={`eas-frame${loaded ? ' on' : ''}`}
            src={url}
            title={title}
            onLoad={() => setLoaded(true)}
            allow="clipboard-write; fullscreen"
            referrerPolicy="no-referrer-when-downgrade"
          />
          {!loaded && (
            <div className="eas-state">
              {stalled ? (
                <>
                  <b>הטופס מתעכב בטעינה</b>
                  <span>אפשר לפתוח אותו בחלון נפרד ולהמשיך משם.</span>
                </>
              ) : (
                'טוען…'
              )}
            </div>
          )}
        </div>

        {/* שורת גיבוי קבועה — תמיד גלויה, לעולם לא הפניה אוטומטית.
            מבטיחה שגם אם התוכן אינו נטען, אין מסך לבן ללא מוצא. */}
        <div className="eas-foot">
          <span>לא רואים את הטופס?</span>
          <a className="eas-out" href={url} target="_blank" rel="noopener noreferrer">
            פתיחה בחלון חדש ↗
          </a>
        </div>
      </div>
    </div>
  );
}
