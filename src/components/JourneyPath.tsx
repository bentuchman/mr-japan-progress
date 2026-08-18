import { Stage } from '../journeyConfig';

interface Props {
  stages: Stage[];                 // המסע הגלוי לחבילה בלבד
  currentIndex: number;            // currentStage — המצב בפועל
  previewIndex: number | null;     // previewStage — מה מודגם כרגע (null = כמו בפועל)
  demoMode: boolean;               // דמו: כל תחנה לחיצה · לקוח: עתידי נעול
  onSelectNode: (index: number) => void;
  onOpenFull: () => void;
}

// פס ההתקדמות: ✓ טאופ הושלם · מספר בעיגול כתום מלא = השלב בפועל ·
// ○ אפור חם עתידי · טבעת כתומה חלולה = שלב בתצוגה מקדימה (דמו).
// ה-preview לעולם לא נראה "הושלם" — ההבחנה בין בפועל לתצוגה נשמרת.
export function JourneyPath({ stages, currentIndex, previewIndex, demoMode, onSelectNode, onOpenFull }: Props) {
  const previewActive = previewIndex !== null && previewIndex >= 0 && previewIndex !== currentIndex;
  return (
    <div className="jwrap">
      <div className="jpath" role="progressbar" aria-valuenow={currentIndex + 1} aria-valuemin={1} aria-valuemax={stages.length} aria-label={`שלב ${currentIndex + 1} מתוך ${stages.length}`}>
        {stages.map((s, i) => {
          const state = i < currentIndex ? 'done' : i === currentIndex ? 'now' : 'todo';
          const previewed = previewActive && previewIndex === i;
          const clickable = demoMode || state !== 'todo';
          const label = demoMode
            ? `תצוגה מקדימה — שלב ${i + 1}: ${s.name}`
            : state === 'done'
              ? `צפייה בשלב שהושלם: ${s.name}`
              : state === 'now'
                ? `השלב הנוכחי: ${s.name}`
                : `שלב עתידי: ${s.name}`;
          return (
            <div key={s.id} className={`jp-step jp-${state}${previewed ? ' jp-previewed' : ''}`}>
              {i > 0 && <span className={`jp-line ${i <= currentIndex ? 'filled' : ''}`} aria-hidden />}
              <button
                className="jp-node"
                disabled={!clickable}
                title={s.name}
                aria-label={label}
                aria-current={state === 'now' ? 'step' : undefined}
                onClick={() => onSelectNode(i)}
              >
                {state === 'done' ? '✓' : state === 'now' || previewed ? String(i + 1) : ''}
              </button>
            </div>
          );
        })}
      </div>
      {/* שפת לקוח בלבד — מונחי דמו (בפועל/מציג) חיים רק בפאנל ה-Demo.
          ללא מקרא — הוויזואליה של הפס מדברת בעד עצמה. */}
      <div className="jp-count">
        שלב {(previewActive ? previewIndex! : currentIndex) + 1} מתוך {stages.length}
        <span className="jp-sep">·</span>
        <button className="jp-all" onClick={onOpenFull}>כל שלבי המסע ←</button>
      </div>
    </div>
  );
}
