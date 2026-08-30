import { FilloutRenderer } from './FilloutRenderer';

// בוחר renderer לפי היעד של הפעולה. כל כתובת שמתארחת על fillout.com
// (כולל דומיין מותאם כמו mrjapan.fillout.com) מקבלת את ה-renderer של
// הספק; כל השאר — הטמעת web גנרית.
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
  if (isFilloutUrl(url) && filloutFormId) {
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
  // WebRenderer — תוכן חיצוני שאינו של ספק מוכר
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
