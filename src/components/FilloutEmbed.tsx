import { useEffect, useRef, useState } from 'react';

// ===== הטמעת טופס Fillout =====
// לא מרנדרים את הכתובת כעמוד אינטרנט גנרי. Fillout מגיש טפסים להטמעה
// משתי דרכים נתמכות, ושתיהן ממומשות כאן:
//
//   'iframe' (ברירת מחדל) — משטח ההטמעה הקנוני של הספק:
//        https://forms.fillout.com/t/<formId>?<query מקורי מילה במילה>
//        מזהה הטופס מגיע מהקונפיג, ומחרוזת השאילתה מועברת *שלמה* בלי
//        לפרק אותה, בלי לקרוא ערכים ובלי להציג אותם ב-UI.
//
//   'script' — סקריפט ההטמעה הרשמי (server.fillout.com/embed/v1/) עם
//        div נושא data-fillout-id. הוא בונה את ה-iframe בעצמו.
//
// למה זו ברירת המחדל: הכתובת שנמסרה יושבת על דומיין מותאם
// (mrjapan.fillout.com). דומיין מותאם נוטה לחסום הצגה בתוך frame, בעוד
// משטח ההטמעה הקנוני נועד לכך. זו ההשערה המובילה לכישלון הקודם —
// ראו הדוח; לא ניתן היה לאמת אותה מסביבת הפיתוח החסומה.
export type FilloutMode = 'iframe' | 'script';

const EMBED_HOST = 'https://forms.fillout.com/t/';
const EMBED_SCRIPT = 'https://server.fillout.com/embed/v1/';

interface Props {
  formId: string;
  url: string;                 // הכתובת המלאה, אטומה
  mode?: FilloutMode;
  title: string;
  onReady: () => void;
  onFail: () => void;
}

// מחרוזת השאילתה מועברת כמקשה אחת. אין כאן קריאה של פרמטר בודד.
function queryOf(url: string): string {
  try {
    return new URL(url).search;
  } catch {
    return '';
  }
}

let scriptPromise: Promise<void> | null = null;
function loadEmbedScript(): Promise<void> {
  if (scriptPromise) return scriptPromise;            // אין אתחול כפול
  scriptPromise = new Promise((res, rej) => {
    const el = document.createElement('script');
    el.src = EMBED_SCRIPT;
    el.async = true;
    el.onload = () => res();
    el.onerror = () => rej(new Error('fillout embed script failed'));
    document.head.appendChild(el);
  });
  return scriptPromise;
}

// הכתובת שנטענת בפועל — כדי שבדיקת הנגישות תתייחס אליה ולא לכתובת
// המקורית בדומיין המותאם.
export function filloutEmbedSrc(formId: string, url: string): string {
  return `${EMBED_HOST}${formId}${queryOf(url)}`;
}

export function FilloutEmbed({ formId, url, mode = 'iframe', title, onReady, onFail }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const [scriptFailed, setScriptFailed] = useState(false);
  const src = filloutEmbedSrc(formId, url);

  // מסלול הסקריפט הרשמי: הסקריפט מזריק iframe לתוך ה-div. ממתינים
  // להופעתו במקום להסתמך על טיימר שרירותי.
  useEffect(() => {
    if (mode !== 'script' || !host.current) return;
    let done = false;
    const node = host.current;
    const obs = new MutationObserver(() => {
      if (!done && node.querySelector('iframe')) { done = true; obs.disconnect(); onReady(); }
    });
    obs.observe(node, { childList: true, subtree: true });
    loadEmbedScript().catch(() => { setScriptFailed(true); onFail(); });
    return () => { obs.disconnect(); node.replaceChildren(); };   // ניקוי בסגירה
  }, [mode, formId, onReady, onFail]);

  if (mode === 'script' && !scriptFailed) {
    return (
      <div
        ref={host}
        className="fo-host"
        data-fillout-id={formId}
        data-fillout-embed-type="standard"
        data-fillout-inherit-parameters=""
        data-fillout-dynamic-resize=""
      />
    );
  }

  return (
    <iframe
      className="fo-frame"
      src={src}
      title={title}
      onLoad={onReady}
      allow="clipboard-write; fullscreen"
      referrerPolicy="no-referrer-when-downgrade"
    />
  );
}
