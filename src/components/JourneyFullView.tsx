import { Stage } from '../journeyConfig';

interface Props {
  stages: Stage[];           // המסע הגלוי לחבילה בלבד
  currentIndex: number;      // currentStage — המצב בפועל
  previewIndex: number | null;
  demoMode: boolean;
  onClose: () => void;
  onSelectStage: (index: number) => void;   // לקוח: היסטוריה · דמו: תצוגה מקדימה
}

// "כל שלבי המסע" — נפתח לפי דרישה כ-overlay (דסקטופ: מודאל,
// מובייל: bottom sheet). כאן — ורק כאן — מופיעים שמות כל השלבים.
export function JourneyFullView({ stages, currentIndex, previewIndex, demoMode, onClose, onSelectStage }: Props) {
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
            return (
              <div key={s.id} className={`fj-item fj-${state}${previewed ? ' fj-previewed' : ''}`}>
                <span className="fj-mark">{state === 'done' ? '✓' : state === 'now' ? '●' : ''}</span>
                <div className="fj-main">
                  <div className="fj-name-row">
                    <span className="fj-icon" aria-hidden>{s.icon}</span>
                    <span className="fj-name">{s.name}</span>
                  </div>
                  {previewed && <div className="fj-cap fj-cap-preview">בתצוגה כעת</div>}
                  {!previewed && state === 'done' && <div className="fj-cap">הושלם</div>}
                  {!previewed && state === 'now' && <div className="fj-cap fj-cap-now">אתם כאן</div>}
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
