import { OWNERSHIP_PILL, OWNERSHIP_SHORT, Stage } from '../journeyConfig';

interface Props {
  stages: Stage[];           // המסע הגלוי לחבילה בלבד
  currentIndex: number;      // currentStage — המצב בפועל
  previewIndex: number | null;
  demoMode: boolean;
  actionRequired?: boolean;  // בשלב הנוכחי יש פעולה פתוחה של הלקוח
  onClose: () => void;
  onSelectStage: (index: number) => void;   // לקוח: היסטוריה · דמו: תצוגה מקדימה
}

// "כל שלבי המסע" — נפתח לפי דרישה כ-overlay (דסקטופ: מודאל,
// מובייל: bottom sheet). כאן — ורק כאן — מופיעים שמות כל השלבים.
// היררכיה: הושלם ✓ קומפקטי · נוכחי ● מודגש עם תג פעולה · עתידי ○ שקט.
export function JourneyFullView({ stages, currentIndex, previewIndex, demoMode, actionRequired, onClose, onSelectStage }: Props) {
  const previewActive = previewIndex !== null && previewIndex >= 0 && previewIndex !== currentIndex;
  return (
    <div className="fj-overlay" onClick={onClose}>
      <div className="fj-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="כל שלבי המסע">
        <div className="fj-head">
          <span className="fj-title">כל שלבי המסע</span>
          <button className="fj-close" onClick={onClose} aria-label="סגירה">✕</button>
        </div>
        <div className="full-journey">
          {stages.map((s, i) => {
            const state = i < currentIndex ? 'done' : i === currentIndex ? 'now' : 'todo';
            const previewed = previewActive && previewIndex === i;
            const clickable = demoMode ? i !== currentIndex : state === 'done';
            // הבעלות מגיעה מהקונפיג — תת-המצב הראשון של השלב.
            // עתידי מקבל ניסוח קצר ושקט; הנוכחי את הקופי המלא.
            const ownership = s.subStates[0].ownership;
            const owner = state === 'now' ? OWNERSHIP_PILL[ownership] : OWNERSHIP_SHORT[ownership];
            return (
              <div key={s.id} className={`fj-item fj-${state}${previewed ? ' fj-previewed' : ''}`}>
                <span className="fj-mark">{state === 'done' ? '✓' : state === 'now' ? '●' : '○'}</span>
                <div className="fj-main">
                  <div className="fj-name-row">
                    <span className="fj-icon" aria-hidden>{s.icon}</span>
                    <span className="fj-name">{s.name}</span>
                    {state === 'now' && actionRequired && <span className="fj-badge">נדרשת פעולה</span>}
                  </div>
                  {/* מטא-דאטה שקטה: הושלם — בלי הסבר · נוכחי/עתידי — בעלות בלבד */}
                  {(() => {
                    const cap = previewed ? 'בתצוגה כעת' : state === 'done' ? 'הושלם' : owner;
                    return cap ? <div className="fj-cap">{cap}</div> : null;
                  })()}
                </div>
                {clickable && (
                  <button className="fj-view" onClick={() => { onSelectStage(i); onClose(); }}>
                    {demoMode ? 'תצוגה' : 'צפייה'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
