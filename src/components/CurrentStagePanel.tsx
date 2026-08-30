import { ActionStatus, OWNERSHIP_PILL, SheetKind, Stage, StageAction, SubState } from '../journeyConfig';

// פעולת לקוח עם המצב שלה. שלושה מצבים שאסור לבלבל ביניהם:
//   pending        — הלקוח עוד צריך לפעול
//   waitingForTeam — הלקוח ביצע את חלקו ("✓ נשלח"); זו אינה התקדמות במסע
//   completed      — התהליך הפנימי עודכן, והמסע מציג את המצב החדש
export interface ActionRow extends StageAction {
  status: ActionStatus;
}

interface Props {
  stage: Stage;
  sub: SubState;
  actions?: ActionRow[];        // פעולות עם מצב חי (גוברות על sub.actions)
  summaryOverride?: string[];   // סיכום דינמי (למשל ספירת הבחירות שנשלחו בפועל)
  // מקבל את הפעולה כולה: אם יש לה url — App פותח אותה מוטמעת באפליקציה
  onCta: (opens: SheetKind, action?: StageAction) => void;
}

// שורת פעולה קומפקטית — כל השורה לחיצה, ופיל ה-CTA בקצה הוא ה-affordance
// (לא חץ בלבד). בלי תיאור מתחת לשם: "בחירת מלונות" מובן מעצמו.
function ActionRowView({ row, onCta }: { row: ActionRow; onCta: Props['onCta'] }) {
  const inner = (
    <>
      <span className="sp-act-ic" aria-hidden>{row.icon}</span>
      <span className="sp-act-title">{row.title}</span>
      {row.status === 'pending' && <span className="sp-act-go">{row.cta} ←</span>}
      {/* הלקוח סיים את חלקו — אישור קבלה, לא השלמת שלב */}
      {row.status === 'waitingForTeam' && <span className="sp-act-state sent">✓ נשלח</span>}
      {row.status === 'completed' && <span className="sp-act-state done">✓ הושלם</span>}
    </>
  );
  return row.status === 'pending' ? (
    <button className="sp-act actionable" onClick={() => onCta(row.opens, row)} aria-label={`${row.title} — ${row.cta}`}>
      {inner}
    </button>
  ) : (
    <div className={`sp-act ${row.status === 'completed' ? 'done' : 'sent'}`}>{inner}</div>
  );
}

// תוכן השלב המוצג בכרטיס — היררכיה אחת בכל שלב:
// שם השלב ← סטטוס ("נדרשת פעולה" / בעלות) ← משפט תומך אם באמת צריך ←
// הפעולה. פעולה אחת = CTA ראשי; כמה פעולות במקביל = שורות קומפקטיות.
export function CurrentStagePanel({ stage, sub, actions, summaryOverride, onCta }: Props) {
  const rows: ActionRow[] =
    actions ?? (sub.actions ?? []).map((a) => ({ ...a, status: 'pending' as ActionStatus }));
  const summary = summaryOverride ?? sub.summary;
  const pending = rows.filter((r) => r.status === 'pending');
  // "נדרשת פעולה" — סטטוס שמחליף את קופי הבעלות כשהכדור אצל הלקוח
  const actionRequired = sub.ownership === 'client' && pending.length > 0;
  // פעולה בודדת פתוחה = CTA ראשי חזק (שם הפעולה כבר בכותרת השלב)
  const soloCta = rows.length === 1 && rows[0].status === 'pending' ? rows[0] : null;
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
      {/* שורת סטטוס אחת: "נדרשת פעולה" מחליף את הבעלות כשהיא אצל הלקוח */}
      <div className="sp-meta">
        {actionRequired ? (
          <span className="sp-badge">נדרשת פעולה</span>
        ) : (
          <span className={`sp-pill sp-pill-${sub.ownership}`}>{sub.pill ?? OWNERSHIP_PILL[sub.ownership]}</span>
        )}
        {/* בלי אמוג'י יומן — אייקון השלב שבכותרת כבר נושא את התפקיד הזה */}
        {sub.dateLine && <span className="sp-date">{sub.dateLine}</span>}
      </div>
      {sub.message && <div className="sp-message">{sub.message}</div>}
      {/* פעולה אחת → CTA ראשי · כמה פעולות → שורות · אין פעולה → כלום */}
      {soloCta ? (
        <button className="sp-cta" onClick={() => onCta(soloCta.opens, soloCta)}>{soloCta.ctaFull ?? soloCta.cta} ←</button>
      ) : rows.length > 0 ? (
        <div className="sp-acts">
          {rows.map((r) => <ActionRowView key={r.id} row={r} onCta={onCta} />)}
        </div>
      ) : null}
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
    </div>
  );
}
