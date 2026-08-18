import App from '../App';
import { IPhoneDemoFrame } from './IPhoneDemoFrame';

// ===== תצוגת השוואה — קנבס פרזנטציה בלבד (בסגנון Figma) =====
// שני מופעים חיים ועצמאיים של אותו פרוטוטייפ, זה לצד זה:
// כל <App> מחזיק state משלו (useState פנימי) — אינטראקציה בטלפון אחד
// לעולם לא משפיעה על השני. אלו שני תרחישי לקוח של אותו מוצר, לא שתי גרסאות.
export function CompareView({ onExit }: { onExit: () => void }) {
  return (
    <div className="compare-canvas">
      <button className="compare-exit" onClick={onExit}>✕ יציאה מהשוואת התרחישים</button>
      <div className="compare-grid">
        <div className="compare-col">
          <div className="compare-label">
            <span>תרחיש 1</span>
            <b>הטיול בעוד יותר מ־3 חודשים</b>
          </div>
          <IPhoneDemoFrame onExit={onExit}>
            <App phoneDemo fixedTimeScenario="moreThanThreeMonths" initialStageId="selections" />
          </IPhoneDemoFrame>
        </div>
        <div className="compare-col">
          <div className="compare-label">
            <span>תרחיש 2</span>
            <b>הטיול בעוד פחות מ־3 חודשים</b>
          </div>
          <IPhoneDemoFrame onExit={onExit}>
            <App phoneDemo fixedTimeScenario="lessThanThreeMonths" initialStageId="selections" />
          </IPhoneDemoFrame>
        </div>
      </div>
    </div>
  );
}
