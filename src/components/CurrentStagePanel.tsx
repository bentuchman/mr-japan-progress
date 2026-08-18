import { OWNERSHIP_PILL, SheetKind, Stage, SubState } from '../journeyConfig';

// משימה בתוך מצב-לקוח אחד (למשל: בחירת מלונות + תשלום אטרקציות).
// שלושה מצבים שאסור לבלבל ביניהם:
//   actionRequired — הלקוח עוד צריך לפעול (הכדור אצלו)
//   waitingForTeam — הלקוח סיים את חלקו; צוות מר יפן מטפל
//   completed      — מור אישרה V ב-Monday — הושלם סופית
export type TaskRowStatus = 'actionRequired' | 'waitingForTeam' | 'completed';
export interface TaskRow {
  icon: string;
  title: string;
  desc: string;
  ctaLabel: string;     // תווית קצרה לפיל הפעולה ("לבחירה"/"לתשלום")
  waitingText: string;  // שורת המשנה במצב המתנה ("נשלח לצוות מר יפן")
  status: TaskRowStatus;
  opens: SheetKind;
}

interface Props {
  stage: Stage;
  sub: SubState;
  nextStage: Stage | null;
  summaryOverride?: string[];   // סיכום דינמי (למשל ספירת הבחירות שנשלחו בפועל)
  tasks?: TaskRow[];            // שתי משימות עצמאיות במקום CTA יחיד
  onCta: (opens: SubState['ctaOpens']) => void;
}

// תוכן השלב המוצג בכרטיס הבית — היררכיה אחידה בכל שלב:
// שם ← בעלות ← מה קורה ← פעולה (אם יש) ← אישורים ← השלב הבא.
export function CurrentStagePanel({ stage, sub, nextStage, summaryOverride, tasks, onCta }: Props) {
  const pill = sub.pill ?? OWNERSHIP_PILL[sub.ownership];
  const summary = summaryOverride ?? sub.summary;
  // "השלב הבא" — שכבת ציפייה: תווית קטנה + שם מודגש (לא לחיץ, לא כרטיס)
  const nextName = sub.nextLabel ?? nextStage?.name ?? null;
  const nextIcon = sub.nextLabel ? null : nextStage?.icon ?? null;
  return (
    <div className="stage-body" key={`${stage.id}-${sub.id}`}>
      <div className="sp-name">
        {sub.jpLine && (
          // דגל יפן כ-SVG — אמוג'י 🇯🇵 מוצג כ"JP" טקסטואלי ב-Chrome על Windows
          <span className="sp-flag" aria-hidden>
            <svg viewBox="0 0 24 17">
              <rect x=".5" y=".5" width="23" height="16" rx="3" fill="#fff" stroke="#e8e0d2" />
              <circle cx="12" cy="8.5" r="4.7" fill="#d64550" />
            </svg>
          </span>
        )}
        {stage.name}
      </div>
      {sub.jpLine && <div className="sp-jp" lang="ja">{sub.jpLine}</div>}
      {sub.dateLine && <div className="sp-date">📅 {sub.dateLine}</div>}
      <span className={`sp-pill sp-pill-${sub.ownership}`}>{pill}</span>
      {sub.message && <div className="sp-message">{sub.message}</div>}
      {/* שורות משימות — שתי פעולות של אותו מצב, כל אחת עם השלמה משלה.
          ✓ + שינוי טקסט (לא צבע בלבד) מסמנים השלמה. */}
      {/* קבוצת משימות קומפקטית: פעולה נדרשת = כל השורה לחיצה + פיל CTA
          קומפקטי כ-affordance ויזואלי (לא כפתור מקונן); המתנה/הושלם =
          צ'יפ סטטוס בקצה השורה, בלי מראה של פעולה. אין עיגולי רדיו. */}
      {tasks && (
        <div className="sp-tasks">
          {tasks.map((t) => {
            const cls = t.status === 'completed' ? ' done' : t.status === 'waitingForTeam' ? ' waiting' : '';
            const inner = (
              <>
                <div className="sp-task-main">
                  <div className="sp-task-title">
                    <span className="sp-task-ic" aria-hidden>{t.icon}</span>
                    {t.title}
                  </div>
                  {t.status === 'actionRequired' && <div className="sp-task-desc">{t.desc}</div>}
                  {t.status === 'waitingForTeam' && <div className="sp-task-desc">{t.waitingText}</div>}
                </div>
                {t.status === 'actionRequired' && (
                  <span className="sp-task-go">{t.ctaLabel} ←</span>
                )}
                {t.status === 'waitingForTeam' && (
                  <span className="sp-task-status waiting">◷ ממתינים לצוות</span>
                )}
                {t.status === 'completed' && (
                  <span className="sp-task-status done">✓ הושלם</span>
                )}
              </>
            );
            return t.status === 'actionRequired' ? (
              <button key={t.title} className="sp-task actionable" onClick={() => onCta(t.opens)}>
                {inner}
              </button>
            ) : (
              <div key={t.title} className={`sp-task${cls}`}>{inner}</div>
            );
          })}
        </div>
      )}
      {sub.confirms?.map((c) => (
        <div key={c} className="sp-confirm">✓ {c}</div>
      ))}
      {summary && (
        <div className="sp-summary">
          {summary.map((line) => <div key={line}>{line}</div>)}
        </div>
      )}
      {sub.detail && <div className="sp-detail">{sub.detail}</div>}
      {sub.cta && (
        <button className="sp-cta" onClick={() => onCta(sub.ctaOpens)}>{sub.cta} ←</button>
      )}
      {sub.secondary && <div className="sp-secondary">{sub.secondary}</div>}
      {sub.viewLabel && (
        <button className="sp-view" onClick={() => sub.viewOpens && onCta(sub.viewOpens)}>
          {sub.viewLabel} ←
        </button>
      )}
      {nextName && (
        <div className="sp-next">
          <div className="sp-next-label">השלב הבא</div>
          <div className="sp-next-name">
            {nextIcon && <span className="sp-next-ic" aria-hidden>{nextIcon}</span>}
            {nextName}
          </div>
        </div>
      )}
    </div>
  );
}
