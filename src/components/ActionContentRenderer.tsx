import { FilloutRenderer } from './FilloutRenderer';

// בוחר renderer לפי היעד של הפעולה. כל כתובת שמתארחת על fillout.com
// (כולל דומיין מותאם כמו mrjapan.fillout.com) מקבלת את ה-renderer של
// הספק — ורק אותו. אין נפילה ל-iframe גנרי על כתובת Fillout: כתובת
// השיתוף ללקוח אינה יעד הטמעה. ה-iframe הגנרי נשאר לספקים אחרים.
export function isFilloutUrl(url: string): boolean {
  try {
    return /(^|\.)fillout\.com$/.test(new URL(url).hostname);
  } catch {
    return false;
  }
}

interface Props {
  url: string;
  title: string;
  filloutFormId?: string;
  onReady: () => void;
  onFrameLoad?: () => void;
  onSubmitted?: () => void;
  webFrameRef: React.Ref<HTMLIFrameElement>;
}

export function ActionContentRenderer({ url, title, filloutFormId, onReady, onFrameLoad, onSubmitted, webFrameRef }: Props) {
  if (isFilloutUrl(url)) {
    // חסר מזהה טופס = תקלת קונפיג. הגיליון מציג מצב שגיאה קיים
    // (EmbeddedActionSheet) — לא iframe אל כתובת השיתוף.
    if (!filloutFormId) return null;
    return (
      <FilloutRenderer
        formId={filloutFormId}
        url={url}
        onReady={onReady}
        onFrameLoad={onFrameLoad}
        onSubmitted={onSubmitted}
      />
    );
  }
  // WebRenderer — תוכן חיצוני שאינו Fillout
  return (
    <iframe
      ref={webFrameRef}
      className="eas-frame"
      src={url}
      title={title}
      onLoad={onReady}
      allow="clipboard-write; fullscreen"
      referrerPolicy="no-referrer-when-downgrade"
    />
  );
}
