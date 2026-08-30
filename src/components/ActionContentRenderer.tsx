import { FilloutRenderer } from './FilloutRenderer';

// בוחר renderer לפי ספק התוכן של הפעולה — ולא לפי המארח שבכתובת.
// action.provider הוא ההחלטה היחידה: 'fillout' → ה-renderer הרשמי,
// כל השאר → הטמעת web גנרית. כתובת השיתוף ללקוח אינה יעד הטמעה, ולכן
// טופס Fillout לעולם אינו נופל ל-iframe הגנרי.
import { ActionProvider } from '../journeyConfig';

interface Props {
  url: string;
  title: string;
  provider?: ActionProvider;
  filloutFormId?: string;
  onReady: () => void;
  onFrameLoad?: () => void;
  onSubmitted?: () => void;
  webFrameRef: React.Ref<HTMLIFrameElement>;
}

export function ActionContentRenderer({ url, title, provider, filloutFormId, onReady, onFrameLoad, onSubmitted, webFrameRef }: Props) {
  if (provider === 'fillout') {
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
  // WebRenderer — כל ספק שאינו Fillout (היום: Zite)
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
