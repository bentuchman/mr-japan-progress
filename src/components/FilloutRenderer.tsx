import { useEffect, useMemo, useRef } from 'react';
import { FilloutStandardEmbed } from '@fillout/react';

// ===== FilloutRenderer — הטמעה רשמית של טופס Fillout =====
// משתמש בחבילה הרשמית @fillout/react (FilloutStandardEmbed), ולא
// ב-iframe גנרי אל הכתובת. החבילה טוענת את סקריפט ההטמעה של הספק,
// מנהלת אתחול יחיד ומנקה את עצמה — אין הזרקת סקריפט ידנית ואין
// אתחול כפול ב-StrictMode.
//
// יעד ההטמעה הוא תשתית ההטמעה הייעודית של הספק. הדומיין המותאם של
// מר יפן הוא כתובת השיתוף ללקוח — לא משטח הטמעה — ולכן אינו נמסר כאן
// כלל: אין prop של domain, ואי אפשר לכוון את ההטמעה אליו.
//
// מה מגיע מהכתובת: אך ורק מחרוזת השאילתה, שמומרת בשלמותה למפת
// פרמטרים ומועברת ל-prop הרשמי `parameters`. האפליקציה אינה קוראת אף
// ערך בודד, אינה גוזרת ממנו מצב עסקי ואינה מציגה אותו ב-UI.
//
// dynamicResize — הספק קובע את גובה ה-iframe לפי גובה התוכן. המכל
// שמעליו גולל אנכית, כך שטופס ארוך אינו נחתך.
interface Props {
  formId: string;
  url: string;            // הכתובת המלאה, אטומה
  onReady: () => void;      // onInit של הספק — אישור מלא
  // ה-iframe שהספק הזריק סיים להיטען. אות חלש יותר מ-onInit, אבל מספיק
  // כדי להפסיק להסתיר את התוכן: אחרת מסך טעינה אטום מכסה טופס תקין.
  onFrameLoad?: () => void;
  onSubmitted?: () => void;
}

// המרה גורפת של מחרוזת השאילתה למפה. לא נקרא כאן שום מפתח ספציפי.
function paramsOf(url: string): Record<string, string> {
  const out: Record<string, string> = {};
  try {
    new URL(url).searchParams.forEach((v, k) => { out[k] = v; });
  } catch {
    /* כתובת לא תקינה — נשלח בלי פרמטרים */
  }
  return out;
}

export function FilloutRenderer({ formId, url, onReady, onFrameLoad, onSubmitted }: Props) {
  // יציב בין רינדורים — אחרת ההטמעה הייתה מאותחלת מחדש בכל render
  const parameters = useMemo(() => paramsOf(url), [url]);
  const host = useRef<HTMLDivElement>(null);

  // הספק מזריק iframe משלו; מאזינים ל-load שלו כדי לדעת שיש תוכן
  useEffect(() => {
    const node = host.current;
    if (!node || !onFrameLoad) return;
    let frame: HTMLIFrameElement | null = null;
    const attach = () => {
      const f = node.querySelector('iframe');
      if (f && f !== frame) { frame = f; f.addEventListener('load', onFrameLoad); }
    };
    attach();
    const obs = new MutationObserver(attach);
    obs.observe(node, { childList: true, subtree: true });
    return () => { obs.disconnect(); frame?.removeEventListener('load', onFrameLoad); };
  }, [onFrameLoad]);

  return (
    <div className="fo-host" ref={host}>
      <FilloutStandardEmbed
        filloutId={formId}
        parameters={parameters}
        dynamicResize
        onInit={onReady}
        onSubmit={() => onSubmitted?.()}
      />
    </div>
  );
}
