import { useCallback, useEffect, useRef, useState } from 'react';
import { FilloutStandardEmbed } from '@fillout/react';
import { DEMO_ACTION_LINKS, UNASSIGNED_LINKS, AUTOMATION_WEBHOOKS } from '../journeyConfig';
import { reachable, frameShowsRemoteContent } from './EmbeddedActionSheet';

// ============================================================
// DEV בלבד — מפעל בדיקות לקישורים האמיתיים.
// לא מופיע בניווט הלקוח, לא נוגע במסע ולא משנה מיפוי פעולות.
// רץ בדפדפן שמריץ את הפרוטוטייפ, ולכן נותן את התשובות שסביבת הפיתוח
// (עם חסימת רשת יוצאת) אינה יכולה לתת.
//
// webhooks של Make אינם מופעלים אוטומטית: קריאה אליהם עלולה להריץ
// אוטומציה ולשנות נתונים. הם נבדקים רק בלחיצה מפורשת, פעם אחת.
// ============================================================
type Kind = 'fillout' | 'web' | 'webhook';
type Result = 'pending' | 'ok' | 'blocked' | 'unreachable' | 'skipped';

interface Target {
  id: string;
  label: string;
  kind: Kind;
  url: string;
  formId?: string;
}

const TARGETS: Target[] = [
  { id: 'A', label: 'Fillout A — משויך לבחירת מלונות', kind: 'fillout',
    url: DEMO_ACTION_LINKS.hotelSelection, formId: 'ohzZe7sCBrus' },
  { id: 'B', label: 'Fillout B — טרם שויך', kind: 'fillout',
    url: UNASSIGNED_LINKS.filloutUnknown, formId: 'vYY9mWeMQsus' },
  { id: 'C', label: 'Zite — טרם שויך', kind: 'web', url: UNASSIGNED_LINKS.zitePage },
  { id: 'D', label: 'Make webhook A', kind: 'webhook', url: AUTOMATION_WEBHOOKS.makeA },
  { id: 'E', label: 'Make webhook B', kind: 'webhook', url: AUTOMATION_WEBHOOKS.makeB },
];

const LABEL: Record<Result, string> = {
  pending: '⏳ בודק…',
  ok: '✓ נטען בהטמעה',
  blocked: '✗ ההטמעה נחסמה',
  unreachable: '✗ היעד לא נגיש',
  skipped: '⏸ לא הופעל',
};

// מציגים host+path בלבד — לעולם לא את מחרוזת השאילתה (שמות/מזהי לקוח)
function safeRef(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname + u.pathname;
  } catch {
    return '—';
  }
}

type Report = (id: string, r: Result) => void;

// --- Fillout: הטמעה רשמית, onInit הוא סימן החיים ---
function FilloutProbe({ t, report }: { t: Target; report: Report }) {
  const [r, setR] = useState<Result>('pending');
  const params = useRef<Record<string, string>>({});
  if (!Object.keys(params.current).length) {
    try { new URL(t.url).searchParams.forEach((v, k) => { params.current[k] = v; }); } catch { /* noop */ }
  }
  // מבדיל בין "לא הגענו לשרת" ל"הגענו אך ההטמעה נחסמה"
  useEffect(() => {
    reachable('https://embed.fillout.com/t/' + t.formId).then((up) => {
      if (!up) setR((p) => (p === 'ok' ? p : 'unreachable'));
    });
    const to = window.setTimeout(() => setR((p) => (p === 'pending' ? 'blocked' : p)), 15000);
    return () => window.clearTimeout(to);
  }, [t.formId]);
  useEffect(() => { report(t.id, r); }, [t.id, r, report]);
  return (
    <div className="dg-frame">
      <FilloutStandardEmbed
        filloutId={t.formId!}
        parameters={params.current}
        onInit={() => setR('ok')}
      />
    </div>
  );
}

// --- אתר גנרי: נגישות + האם ה-frame מציג תוכן חוצה-מקור ---
function WebProbe({ t, report }: { t: Target; report: Report }) {
  const [r, setR] = useState<Result>('pending');
  const frame = useRef<HTMLIFrameElement>(null);
  useEffect(() => {
    reachable(t.url).then((ok) => { if (!ok) setR('unreachable'); });
    const to = window.setTimeout(() => setR((p) => (p === 'pending' ? 'blocked' : p)), 15000);
    return () => window.clearTimeout(to);
  }, [t.url]);
  useEffect(() => { report(t.id, r); }, [t.id, r, report]);
  return (
    <iframe
      ref={frame}
      className="dg-frame"
      src={t.url}
      title={t.label}
      onLoad={() => window.setTimeout(
        () => setR((p) => (p === 'unreachable' ? p : frameShowsRemoteContent(frame.current) ? 'ok' : 'blocked')),
        1200,
      )}
    />
  );
}

// --- Make: לא מופעל אלא בלחיצה מפורשת, ופעם אחת בלבד ---
function WebhookProbe({ t, report }: { t: Target; report: Report }) {
  const [fired, setFired] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  useEffect(() => { report(t.id, 'skipped'); }, [t.id, report]);
  async function fireOnce() {
    setFired(true);
    setNote('שולח…');
    try {
      await fetch(t.url, { mode: 'no-cors', cache: 'no-store' });
      setNote('הבקשה נשלחה. התגובה אטומה (no-cors) — יש לבדוק ב-Make מה הופעל.');
    } catch {
      setNote('הבקשה נכשלה ברמת הרשת.');
    }
  }
  return (
    <div className="dg-hook">
      <span>לא מופעל אוטומטית — קריאה עלולה להריץ אוטומציה ולשנות נתונים.</span>
      <button className="dg-fire" disabled={fired} onClick={fireOnce}>
        {fired ? 'הופעל פעם אחת' : 'הפעלה חד-פעמית (באחריותך)'}
      </button>
      {note && <span className="dg-note">{note}</span>}
    </div>
  );
}

export function LinkDiagnostics({ onClose }: { onClose: () => void }) {
  const [results, setResults] = useState<Record<string, Result>>({});
  const record = useCallback<Report>((id, r) => {
    setResults((m) => (m[id] === r ? m : { ...m, [id]: r }));
  }, []);

  const summary = TARGETS.map((t) =>
    `${t.id} · ${t.label} · ${safeRef(t.url)} → ${LABEL[results[t.id] ?? 'pending']}`,
  ).join('\n');

  return (
    <div className="fj-overlay" onClick={onClose}>
      <div className="fj-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="בדיקת קישורים">
        <div className="sheet-body">
          <div className="sheet-title">בדיקת הקישורים האמיתיים</div>
          <div className="sheet-dev">DEV · לא חלק ממסך הלקוח</div>
          <div className="sheet-desc">
            הבדיקה רצה כאן, בדפדפן שלכם. לפירוט מדויק של חסימה — פתחו את ה-Console.
          </div>
          {TARGETS.map((t) => (
            <div key={t.id} className="dg-row">
              <div className="dg-main">
                <div className="dg-label">{t.id} · {t.label}</div>
                <div className="dg-host">{safeRef(t.url)}</div>
                {t.kind === 'webhook' && (
                  <WebhookProbe t={t} report={record} />
                )}
              </div>
              <span className={`dg-state dg-${results[t.id] ?? 'pending'}`}>
                {LABEL[results[t.id] ?? 'pending']}
              </span>
              {t.kind === 'fillout' && <FilloutProbe t={t} report={record} />}
              {t.kind === 'web' && <WebProbe t={t} report={record} />}
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
