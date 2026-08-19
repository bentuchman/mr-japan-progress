import { ActionStatus, OWNERSHIP_PILL, SheetKind, Stage, StageAction, SubState } from '../journeyConfig';

// פעולת לקוח עם המצב שלה. שלושה מצבים שאסור לבלבל ביניהם:
//   pending        — הלקוח עוד צריך לפעול (הכדור אצלו)
//   waitingForTeam — הלקוח סיים את חלקו; צוות מר יפן מטפל
//   completed      — אושר ב-Monday — הושלם סופית
export interface ActionRow extends StageAction {
  status: ActionStatus;
}

interface Props {
  stage: Stage;
  sub: SubState;
  actions?: ActionRow[];        // פעולות עם מצב חי (גוברות על sub.actions)
  summaryOverride?: string[];   // סיכום דינמי (למשל ספירת הבחירות שנשלחו בפועל)
  onCta: (opens: SheetKind) => void;
}

// שורת פעולה קומפקטית — כל השורה לחיצה; ה-CTA בקצה הוא ה-affordance.
// שורה אחת בגובה ~46px, בלי טקסט הסבר — התיאור חי בתוך ה-Sheet.
function ActionRowView({ row, onCta }: { row: ActionRow; onCta: Props['onCta'] }) {
  const inner = (
    <>
      <span className="sp-act-ic" aria-hidden>{row.icon}</span>
      <span className="sp-act-title">{row.title}</span>
      {row.status === 'pending' && <span className="sp-act-go">{row.cta} ←</span>}
      {row.status === 'waitingForTeam' && <span className="sp-act-state waiting">◷ ממתינים לצוות</span>}
      {row.status === 'completed' && <span className="sp-act-state done">✓ הושלם</span>}
    </>
  );
  return row.status === 'pending' ? (
    <button className="sp-act actionable" onClick={() => onCta(row.opens)} aria-label={`${row.title} — ${row.cta}`}>
      {inner}
    </button>
  ) : (
    <div className={`sp-act ${row.status === 'completed' ? 'done' : 'waiting'}`}>{inner}</div>
  );
}

// תוכן השלב המוצג בכרטיס הבית — היררכיה אחת בכל שלב:
// שם ← שורת מצב (נדרשת פעולה · בעלות · מועד) ← משפט תומך אחד לכל היותר
// ← פעולות ← אישורים ← שורת עזר שקטה. אין כרטיס "השלב הבא" — הפס מספר זאת.
export function CurrentStagePanel({ stage, sub, actions, summaryOverride, onCta }: Props) {
  const rows: ActionRow[] =
    actions ?? (sub.actions ?? []).map((a) => ({ ...a, status: 'pending' as ActionStatus }));
  const summary = summaryOverride ?? sub.summary;
  const pending = rows.filter((r) => r.status === 'pending');
  // "נדרשת פעולה" — סטטוס, לא כפתור: רק כשהכדור אצל הלקוח ויש פעולה פתוחה
  const actionRequired = sub.ownership === 'client' && pending.length > 0;
  // שורת הקשר אחת בלבד בכרטיס: כשיש פעולה פתוחה, שורת "מה קורה אחרי"
  // גוברת על משפט הפתיחה — שתיהן יחד היו שתי שורות תומכות לאותו תפקיד.
  const showMessage = !!sub.message && !(pending.length > 0 && sub.afterNote);
  return (
    <div className="stage-body" key={`${stage.id}-${sub.id}`}>
      {/* אייקון קטן לצד הכותרת — מידע תומך, לא בלוק אנכי משלו */}
      <div className="sp-name">
        {sub.jpLine ? (
          // דגל יפן כ-SVG — אמוג'י 🇯🇵 מוצג כ"JP" טקסטואלי ב-Chrome על Windows
          <span className="sp-flag" aria-hidden>
            <svg viewBox="0 0 24 17">
              <rect x=".5" y=".5" width="23" height="16" rx="3" fill="#fff" stroke="#e8e0d2" />
              <circle cx="12" cy="8.5" r="4.7" fill="#d64550" />
            </svg>
          </span>
        ) : (
          <span className="sp-ic" aria-hidden>{stage.icon}</span>
        )}
        {stage.name}
      </div>
      {sub.jpLine && <div className="sp-jp" lang="ja">{sub.jpLine}</div>}
      {/* שורת מצב אחת: תג הפעולה (אם נדרשת), בעלות, ומועד — במקום שלוש שורות */}
      <div className="sp-meta">
        {actionRequired && <span className="sp-badge">נדרשת פעולה</span>}
        <span className={`sp-pill sp-pill-${sub.ownership}`}>{sub.pill ?? OWNERSHIP_PILL[sub.ownership]}</span>
        {sub.dateLine && <span className="sp-date">📅 {sub.dateLine}</span>}
      </div>
      {showMessage && <div className="sp-message">{sub.message}</div>}
      {/* אזור הפעולות — מוצג רק כשיש פעולה אמיתית. אין CTA מומצא. */}
      {rows.length > 0 && (
        <div className="sp-acts">
          {rows.map((r) => <ActionRowView key={r.id} row={r} onCta={onCta} />)}
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
      {sub.viewLabel && (
        <button className="sp-view" onClick={() => sub.viewOpens && onCta(sub.viewOpens)}>
          {sub.viewLabel} ←
        </button>
      )}
      {/* שורת עזר אחת, שקטה — מה קורה אחרי הפעולה. לא כרטיס, לא כותרת. */}
      {sub.afterNote && <div className="sp-after">{sub.afterNote}</div>}
    </div>
  );
}
