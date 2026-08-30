import { useCallback, useEffect, useRef, useState } from 'react';
import { FilloutStandardEmbed } from '@fillout/react';
import { DEV_LINK_INVENTORY, DevLink } from '../journeyConfig';
import { reachable, frameShowsRemoteContent } from './EmbeddedActionSheet';

// ============================================================
// DEV בלבד — בדיקת הקישורים האמיתיים. מחוץ לממשק הלקוח, אינו נוגע
// במסע, בשלבים או במיפוי הפעולות.
//
// טפסי Fillout נבדקים אך ורק דרך ההטמעה הרשמית (@fillout/react),
// בדיוק כמו מסלול הלקוח. הווריאציות שכיוונו iframe אל כתובת השיתוף
// ואל הדומיין המותאם הוסרו — זו אינה תצורה שנרצה להריץ.
//
// Make webhook אינו מופעל אוטומטית — קריאה עלולה להריץ אוטומציה.
// שמות, אימיילים ומזהים לעולם אינם מוצגים: host+path בלבד.
// ============================================================
type Verdict = 'pending' | 'init' | 'frame' | 'blocked' | 'unreachable' | 'skipped';

const TEXT: Record<Verdict, string> = {
  pending: '⏳ בודק…',
  init: '✓ onInit — הטופס אותחל',
  frame: '◐ iframe נטען, onInit לא נורה',
  blocked: '✗ לא נטען',
  unreachable: '✗ היעד לא נגיש',
  skipped: '⏸ לא הופעל',
};

function safeRef(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname + u.pathname;
  } catch {
    return '—';
  }
}
function paramsOf(url: string): Record<string, string> {
  const out: Record<string, string> = {};
  try { new URL(url).searchParams.forEach((v, k) => { out[k] = v; }); } catch { /* noop */ }
  return out;
}

type Report = (key: string, v: Verdict) => void;

// --- iframe ישיר: לספקים שאינם Fillout (Zite) בלבד ---
function DirectProbe({ id, url, report }: { id: string; url: string; report: Report }) {
  const [v, setV] = useState<Verdict>('pending');
  const frame = useRef<HTMLIFrameElement>(null);
  useEffect(() => {
    reachable(url).then((up) => { if (!up) setV((p) => (p === 'init' ? p : 'unreachable')); });
    const to = window.setTimeout(() => setV((p) => (p === 'pending' ? 'blocked' : p)), 15000);
    return () => window.clearTimeout(to);
  }, [url]);
  useEffect(() => { report(id, v); }, [id, v, report]);
  return (
    <iframe
      ref={frame} className="dg-frame" src={url} title={id}
      onLoad={() => window.setTimeout(() => setV((p) =>
        p === 'unreachable' ? p : frameShowsRemoteContent(frame.current) ? 'frame' : 'blocked'), 1200)}
    />
  );
}

// --- ההטמעה הרשמית של Fillout — הדרך היחידה שנבדקת לטופס ---
function EmbedProbe({ id, link, report }: { id: string; link: DevLink; report: Report }) {
  const [v, setV] = useState<Verdict>('pending');
  const host = useRef<HTMLDivElement>(null);
  const params = useRef(paramsOf(link.url));
  useEffect(() => {
    reachable(`https://embed.fillout.com/t/${link.filloutId}`)
      .then((up) => { if (!up) setV((p) => (p === 'init' ? p : 'unreachable')); });
    const to = window.setTimeout(() => setV((p) => (p === 'pending' ? 'blocked' : p)), 15000);
    // גם אם onInit לא נורה — נדע אם ה-iframe בכלל נטען
    const node = host.current;
    const attach = () => {
      const f = node?.querySelector('iframe');
      // 'unreachable' ו-'init' חזקים מ-'frame': עמוד שגיאה של הדפדפן גם
      // הוא מפעיל load, ואסור שייקרא כהצלחה.
      if (f) f.addEventListener('load',
        () => setV((p) => (p === 'init' || p === 'unreachable' ? p : 'frame')), { once: true });
    };
    attach();
    const obs = node ? new MutationObserver(attach) : null;
    obs?.observe(node!, { childList: true, subtree: true });
    return () => { window.clearTimeout(to); obs?.disconnect(); };
  }, [link.filloutId]);
  useEffect(() => { report(id, v); }, [id, v, report]);
  return (
    <div className="dg-frame" ref={host}>
      <FilloutStandardEmbed
        filloutId={link.filloutId!}
        parameters={params.current}
        dynamicResize
        onInit={() => setV('init')}
      />
    </div>
  );
}

// --- Make: לעולם לא אוטומטי ---
function MakeProbe({ id, url, report }: { id: string; url: string; report: Report }) {
  const [fired, setFired] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  useEffect(() => { report(id, 'skipped'); }, [id, report]);
  return (
    <div className="dg-hook">
      <span>לא מופעל אוטומטית — קריאה עלולה להריץ אוטומציה ולשנות נתונים.</span>
      <button
        className="dg-fire"
        disabled={fired}
        onClick={async () => {
          setFired(true); setNote('שולח…');
          try {
            await fetch(url, { mode: 'no-cors', cache: 'no-store' });
            setNote('נשלח. התגובה אטומה — יש לבדוק ב-Make מה הופעל.');
          } catch { setNote('נכשל ברמת הרשת.'); }
        }}
      >
        {fired ? 'הופעל פעם אחת' : 'הפעלה חד-פעמית (באחריותך)'}
      </button>
      {note && <span className="dg-note">{note}</span>}
    </div>
  );
}

export function LinkDiagnostics({ onClose }: { onClose: () => void }) {
  const [res, setRes] = useState<Record<string, Verdict>>({});
  const report = useCallback<Report>((key, v) => {
    setRes((m) => (m[key] === v ? m : { ...m, [key]: v }));
  }, []);
  // אוסף — אחרת הרצת טופס שני הייתה מבטלת את הראשון
  const [run, setRun] = useState<Set<string>>(new Set());

  const forms = DEV_LINK_INVENTORY.filter((l) => l.provider === 'fillout');
  const others = DEV_LINK_INVENTORY.filter((l) => l.provider !== 'fillout');

  const summary = [
    ...forms.map((l) =>
      `${l.id} (${l.filloutId}) · הטמעה רשמית → ${TEXT[res[l.id] ?? 'pending']}`),
    ...others.map((l) => `${l.id} · ${safeRef(l.url)} → ${TEXT[res[l.id] ?? 'pending']}`),
  ].join('\n');

  return (
    <div className="fj-overlay" onClick={onClose}>
      <div className="fj-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="בדיקת קישורים">
        <div className="sheet-body">
          <div className="sheet-title">בדיקת הקישורים האמיתיים</div>
          <div className="sheet-dev">DEV · לא חלק ממסך הלקוח</div>
          <div className="sheet-desc">
            טפסי Fillout נבדקים דרך ההטמעה הרשמית בלבד — אותו מסלול שהלקוח רואה.
            לפירוט חסימות — ה-Console של הדפדפן.
          </div>

          {forms.map((l, i) => (
            <div key={l.id} className="dg-block">
              <div className="dg-label">TEST FILLOUT {i + 1} · <span className="dg-host">{safeRef(l.url)}</span></div>
              {run.has(l.id) ? (
                <div className="dg-row">
                  <div className="dg-main">הטמעה רשמית (@fillout/react)</div>
                  <span className={`dg-state dg-${res[l.id] ?? 'pending'}`}>{TEXT[res[l.id] ?? 'pending']}</span>
                  <EmbedProbe id={l.id} link={l} report={report} />
                </div>
              ) : (
                <button className="dg-fire" onClick={() => setRun((s) => new Set(s).add(l.id))}>
                  הרצת הבדיקה
                </button>
              )}
            </div>
          ))}

          {others.map((l) => (
            <div key={l.id} className="dg-block">
              <div className="dg-label">
                {l.provider === 'zite' ? 'TEST ZITE' : 'MAKE WEBHOOK'} · <span className="dg-host">{safeRef(l.url)}</span>
              </div>
              <div className="dg-row">
                <div className="dg-main">{l.provider === 'zite' ? 'iframe ישיר' : 'לא נבדק אוטומטית'}</div>
                <span className={`dg-state dg-${res[l.id] ?? 'pending'}`}>{TEXT[res[l.id] ?? 'pending']}</span>
                {l.provider === 'zite' && <DirectProbe id={l.id} url={l.url} report={report} />}
              </div>
              {l.provider === 'make' && <MakeProbe id={l.id} url={l.url} report={report} />}
            </div>
          ))}

          <button
            className="sheet-secondary"
            onClick={() => navigator.clipboard?.writeText(summary).catch(() => undefined)}
          >
            העתקת התוצאות
          </button>
          <button className="sheet-secondary" onClick={onClose}>סגירה</button>
        </div>
      </div>
    </div>
  );
}
