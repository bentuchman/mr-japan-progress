import { useCallback, useEffect, useRef, useState } from 'react';
import { FilloutStandardEmbed } from '@fillout/react';
import { DEV_LINK_INVENTORY, DevLink } from '../journeyConfig';
import { reachable, frameShowsRemoteContent } from './EmbeddedActionSheet';

// ============================================================
// DEV בלבד — בדיקת הקישורים האמיתיים. מחוץ לממשק הלקוח, אינו נוגע
// במסע, בשלבים או במיפוי הפעולות.
//
// לכל טופס Fillout מורצות שלוש וריאציות באותו renderer:
//   A · הכתובת המקורית ב-iframe ישיר (mrjapan.fillout.com)
//   B · @fillout/react ללא domain (משטח ההטמעה של הספק)
//   C · @fillout/react עם domain="mrjapan.fillout.com"
// כך רואים איזו דרך באמת מציגה את הטופס, בלי לשייך אותו לשום שלב.
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

// --- וריאציה A: iframe ישיר אל הכתובת המקורית ---
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

// --- וריאציות B/C: ההטמעה הרשמית, עם/בלי דומיין מותאם ---
function EmbedProbe({ id, link, domain, report }: {
  id: string; link: DevLink; domain?: string; report: Report;
}) {
  const [v, setV] = useState<Verdict>('pending');
  const host = useRef<HTMLDivElement>(null);
  const params = useRef(paramsOf(link.url));
  useEffect(() => {
    reachable(`https://${domain ?? 'embed.fillout.com'}/t/${link.filloutId}`)
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
  }, [link.filloutId, domain]);
  useEffect(() => { report(id, v); }, [id, v, report]);
  return (
    <div className="dg-frame" ref={host}>
      <FilloutStandardEmbed
        filloutId={link.filloutId!}
        domain={domain}
        parameters={params.current}
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
  const [run, setRun] = useState<string | null>(null);   // בודקים טופס אחד בכל פעם

  const forms = DEV_LINK_INVENTORY.filter((l) => l.provider === 'fillout');
  const others = DEV_LINK_INVENTORY.filter((l) => l.provider !== 'fillout');

  const summary = [
    ...forms.flatMap((l) => ['A', 'B', 'C'].map((k) =>
      `${l.id} (${l.filloutId}) · ${k} → ${TEXT[res[`${l.id}:${k}`] ?? 'pending']}`)),
    ...others.map((l) => `${l.id} · ${safeRef(l.url)} → ${TEXT[res[l.id] ?? 'pending']}`),
  ].join('\n');

  return (
    <div className="fj-overlay" onClick={onClose}>
      <div className="fj-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="בדיקת קישורים">
        <div className="sheet-body">
          <div className="sheet-title">בדיקת הקישורים האמיתיים</div>
          <div className="sheet-dev">DEV · לא חלק ממסך הלקוח</div>
          <div className="sheet-desc">
            כל טופס נבדק בשלוש דרכים: A כתובת ישירה · B הטמעה רשמית · C הטמעה רשמית עם דומיין מותאם.
            לפירוט חסימות — ה-Console של הדפדפן.
          </div>

          {forms.map((l, i) => (
            <div key={l.id} className="dg-block">
              <div className="dg-label">TEST FILLOUT {i + 1} · <span className="dg-host">{safeRef(l.url)}</span></div>
              {run === l.id ? (
                <>
                  {(['A', 'B', 'C'] as const).map((k) => (
                    <div key={k} className="dg-row">
                      <div className="dg-main">
                        {k === 'A' ? 'A · כתובת ישירה' : k === 'B' ? 'B · הטמעה רשמית' : 'C · הטמעה + דומיין מותאם'}
                      </div>
                      <span className={`dg-state dg-${res[`${l.id}:${k}`] ?? 'pending'}`}>
                        {TEXT[res[`${l.id}:${k}`] ?? 'pending']}
                      </span>
                      {k === 'A' && <DirectProbe id={`${l.id}:A`} url={l.url} report={report} />}
                      {k === 'B' && <EmbedProbe id={`${l.id}:B`} link={l} report={report} />}
                      {k === 'C' && <EmbedProbe id={`${l.id}:C`} link={l} domain="mrjapan.fillout.com" report={report} />}
                    </div>
                  ))}
                </>
              ) : (
                <button className="dg-fire" onClick={() => setRun(l.id)}>הרצת הבדיקה</button>
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
