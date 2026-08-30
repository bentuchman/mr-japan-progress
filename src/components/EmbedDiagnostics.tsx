import { useEffect, useRef, useState } from 'react';
import { DEMO_ACTION_LINKS } from '../journeyConfig';
import { EmbedState, embedVerdict, reachable } from './EmbeddedActionSheet';

// DEMO/DEV בלבד — לא חלק ממסך הלקוח.
// בודק בפועל, במכשיר שמריץ את הפרוטוטייפ, אילו מהקישורים האמיתיים
// מסכימים להיטען בתוך iframe. משתמש באותה בדיקה כמו הגיליון עצמו.
const TARGETS = [
  { id: 'fillout', label: 'טופס Fillout (בחירת מלונות)', url: DEMO_ACTION_LINKS.hotelSelection },
  { id: 'zite', label: 'עמוד Zite (טרם שויך לפעולה)', url: DEMO_ACTION_LINKS.unassignedZitePage },
];

function Probe({ label, url }: { label: string; url: string }) {
  const [reach, setReach] = useState<boolean | null>(null);
  const [frameLoaded, setFrameLoaded] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [, force] = useState(0);
  const frame = useRef<HTMLIFrameElement>(null);
  const state: EmbedState = embedVerdict(reach, frame.current, frameLoaded || timedOut);
  useEffect(() => { reachable(url).then(setReach); }, [url]);
  useEffect(() => {
    const t = window.setTimeout(() => setTimedOut(true), 12000);
    return () => window.clearTimeout(t);
  }, []);
  const check = () => { setFrameLoaded(true); window.setTimeout(() => force((n) => n + 1), 1200); }
  return (
    <div className="dg-row">
      <div className="dg-main">
        <div className="dg-label">{label}</div>
        <div className="dg-host">{new URL(url).hostname}</div>
      </div>
      <span className={`dg-state dg-${state}`}>
        {state === 'loading' ? '⏳ בודק…'
          : state === 'loaded' ? '✓ נטען בהטמעה'
          : reach === false ? '✗ היעד לא נגיש מכאן'
          : '✗ ההטמעה נחסמה'}
      </span>
      <iframe
        ref={frame}
        className="dg-frame"
        src={url}
        title={label}
        onLoad={check}
      />
    </div>
  );
}

export function EmbedDiagnostics({ onClose }: { onClose: () => void }) {
  return (
    <div className="fj-overlay" onClick={onClose}>
      <div className="fj-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="בדיקת הטמעה">
        <div className="sheet-body">
          <div className="sheet-title">בדיקת הטמעה של הקישורים</div>
          <div className="sheet-dev">DEV · לא חלק ממסך הלקוח</div>
          <div className="sheet-desc">
            הבדיקה רצה כאן, בדפדפן שלכם, על הקישורים האמיתיים. לפירוט המדויק של החסימה —
            פתחו את ה-Console של הדפדפן.
          </div>
          {TARGETS.map((t) => <Probe key={t.id} label={t.label} url={t.url} />)}
          <button className="sheet-secondary" onClick={onClose}>סגירה</button>
        </div>
      </div>
    </div>
  );
}
