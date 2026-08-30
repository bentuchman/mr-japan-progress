import { Stage } from '../journeyConfig';

interface Props {
  stages: Stage[];                 // המסע הגלוי לחבילה בלבד
  currentIndex: number;            // currentStage — המצב בפועל
  previewIndex: number | null;     // previewStage — מה מודגם כרגע (null = כמו בפועל)
  demoMode: boolean;               // דמו: כל תחנה לחיצה · לקוח: עתידי נעול
  onSelectNode: (index: number) => void;
  onOpenFull: () => void;
}

// פס ההתקדמות — שפת הפס של טפסי מר יפן: מונה שבר קטן משמאל, ולצדו
// מקטעים קצרים ומעוגלים, אחד לכל שלב במסע. בלי עיגולים, בלי ✓,
// בלי מספרים בתוך המקטעים. המקטעים נשארים לחיצים בדיוק כמו קודם.
export function JourneyPath({ stages, currentIndex, previewIndex, demoMode, onSelectNode, onOpenFull }: Props) {
  const previewActive = previewIndex !== null && previewIndex >= 0 && previewIndex !== currentIndex;
  // המונה והמילוי מציגים את אותו שלב שמוצג בשורה שמתחת — אחרת השניים
  // היו סותרים זה את זה. זו בדיוק ההתנהגות של שורת "שלב X מתוך Y".
  const shownIndex = previewActive ? previewIndex! : currentIndex;
  return (
    <div className="jwrap">
      <div className="jp-bar">
        <div
          className="jp-track"
          role="progressbar"
          aria-valuenow={currentIndex + 1}
          aria-valuemin={1}
          aria-valuemax={stages.length}
          aria-label={`שלב ${currentIndex + 1} מתוך ${stages.length}`}
        >
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
              <button
                key={s.id}
                className={`jp-seg${i <= shownIndex ? ' filled' : ''}${previewed ? ' previewed' : ''}`}
                disabled={!clickable}
                title={s.name}
                aria-label={label}
                aria-current={state === 'now' ? 'step' : undefined}
                onClick={() => onSelectNode(i)}
              />
            );
          })}
        </div>
        {/* המונה בספרות לטיניות — נשמר כשבר גם בתוך עמוד RTL */}
        <span className="jp-frac" dir="ltr">{shownIndex + 1}/{stages.length}</span>
      </div>
      {/* שפת לקוח בלבד — מונחי דמו (בפועל/מציג) חיים רק בפאנל ה-Demo.
          ללא מקרא — הוויזואליה של הפס מדברת בעד עצמה. */}
      <div className="jp-count">
        שלב {shownIndex + 1} מתוך {stages.length}
        <span className="jp-sep">·</span>
        <button className="jp-all" onClick={onOpenFull}>כל שלבי המסע ←</button>
      </div>
    </div>
  );
}
