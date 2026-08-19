import { useState } from 'react';
import { ActionStatus, PACKAGES, PackageId, SCENARIO, Stage, SubState, TimeToTripScenario } from '../journeyConfig';

interface Props {
  pkg: PackageId;
  stages: Stage[];
  subStates: SubState[];          // תתי-המצב של השלב המוצג כרגע
  currentStageId: string;         // currentStage — המצב בפועל
  currentIndex: number;
  previewStageId: string | null;  // previewStage — מה מודגם (null = כמו בפועל)
  previewIndex: number | null;
  subStateId: string;
  scenarioIndex: number;
  demoMode: boolean;
  timeScenario: TimeToTripScenario;   // תרחיש זמן-לטיול (דמו בלבד)
  windowOpened: boolean;              // הדמיית כניסה לחלון 3 החודשים (תרחיש A)
  fixedScenario?: boolean;            // תצוגת השוואה: התרחיש מקובע למופע
  hotelTaskStatus: ActionStatus;
  attractionsTaskStatus: ActionStatus;
  attractionsAvailable: boolean;
  onMondayV: (task: 'hotels' | 'attractions') => void;
  onTimeScenario: (s: TimeToTripScenario) => void;
  onOpenWindow: () => void;
  onDemoMode: (v: boolean) => void;
  onScenarioStep: (dir: 1 | -1) => void;
  onPackage: (p: PackageId) => void;
  onStage: (id: string) => void;
  onPreview: (id: string | null) => void;
  onSubState: (id: string) => void;
}

// DEMO — לא חלק מהמוצר. ברירת מחדל: צ'יפ מכווץ (כמו במוצר האמיתי).
export function DemoControls(props: Props) {
  const [open, setOpen] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  if (!open) {
    return (
      <button className="demo-chip" onClick={() => setOpen(true)}>
        Demo ⚙ · {props.demoMode ? 'מצב דמו' : 'מצב לקוח'}
      </button>
    );
  }
  const atStart = props.scenarioIndex <= 0;
  const atEnd = props.scenarioIndex >= SCENARIO.length - 1;
  const dispIdx = props.previewIndex ?? props.currentIndex;
  return (
    <aside className="demo" aria-label="Demo controls (not part of the product)">
      <h4>
        DEMO — לא חלק מהמוצר
        <button className="collapse-btn" onClick={() => setOpen(false)}>—</button>
      </h4>

      <div className="demo-mode-row">
        <button className={`dbtn${!props.demoMode ? ' active' : ''}`} onClick={() => props.onDemoMode(false)}>מצב לקוח</button>
        <button className={`dbtn${props.demoMode ? ' active' : ''}`} onClick={() => props.onDemoMode(true)}>מצב דמו</button>
      </div>
      <div className="demo-hint">
        {props.demoMode
          ? 'כל תחנה בפס לחיצה — תצוגה מקדימה בלבד, השלב בפועל לא זז'
          : 'כמו אצל הלקוח: עתידי נעול, הושלם נצפה לקריאה בלבד'}
      </div>

      {/* מעטפות פרזנטציה — לא רלוונטיות בתוך תצוגת ההשוואה (התרחיש מקובע) */}
      {!props.fixedScenario && (
        <>
          <button
            className="dbtn demo-mobile-btn"
            onClick={() => (window as unknown as { __mrjTogglePhone?: () => void }).__mrjTogglePhone?.()}
          >
            {typeof document !== 'undefined' && document.documentElement.classList.contains('phone-mode')
              ? 'יציאה מהדגמת iPhone'
              : '📱 הדגמת iPhone'}
          </button>
          <button
            className="dbtn demo-mobile-btn"
            onClick={() => (window as unknown as { __mrjToggleCompare?: () => void }).__mrjToggleCompare?.()}
          >
            📱 השוואת תרחישים
          </button>
        </>
      )}

      {/* מונחי בפועל/מוצג חיים רק כאן — לא ב-UI הלקוח */}
      <div className="demo-status">
        <span>השלב בפועל: <b>{props.currentIndex + 1}</b></span>
        <span>השלב המוצג: <b>{dispIdx + 1}</b></span>
      </div>
      <div className="row" style={{ marginTop: 4 }}>
        <button
          className="dbtn"
          disabled={dispIdx <= 0}
          onClick={() => props.onPreview(props.stages[dispIdx - 1].id)}
        >
          ‹ הצג קודם
        </button>
        <button
          className="dbtn"
          disabled={dispIdx >= props.stages.length - 1}
          onClick={() => props.onPreview(props.stages[dispIdx + 1].id)}
        >
          הצג הבא ›
        </button>
      </div>

      {/* תרחיש זמן-לטיול — הכלל העסקי "3 חודשים"; ללקוח זה נגזר מתאריכי הטיול.
          בתצוגת ההשוואה התרחיש מקובע לכל מופע — הבורר הידני מוסתר. */}
      {!props.fixedScenario && (
        <>
          <div className="demo-scenario-label">תרחיש זמן לטיול</div>
          <div className="row" style={{ marginTop: 4 }}>
            <button
              className={`dbtn${props.timeScenario === 'moreThanThreeMonths' ? ' active' : ''}`}
              onClick={() => props.onTimeScenario('moreThanThreeMonths')}
            >
              יותר מ־3 חודשים
            </button>
            <button
              className={`dbtn${props.timeScenario === 'lessThanThreeMonths' ? ' active' : ''}`}
              onClick={() => props.onTimeScenario('lessThanThreeMonths')}
            >
              פחות מ־3 חודשים
            </button>
          </div>
        </>
      )}
      {props.timeScenario === 'moreThanThreeMonths' && (
        <button
          className="dbtn demo-window-btn"
          disabled={props.windowOpened}
          onClick={props.onOpenWindow}
        >
          {props.windowOpened ? '✓ חלון 3 החודשים פעיל' : '⏱ הדמיית כניסה לחלון 3 חודשים'}
        </button>
      )}

      {/* סימולציית עדכון Monday — פנימי/דמו בלבד. ממחיש את השרשרת:
          הלקוח מבצע פעולה → הלקוח רואה "✓ נשלח" → הצוות מעדכן ב-Monday →
          מערכת ה-Progress מתעדכנת. הלקוח לעולם אינו רואה את המנגנון הזה. */}
      {props.attractionsAvailable && (
        <>
          <button
            className="dbtn demo-window-btn"
            disabled={props.hotelTaskStatus !== 'waitingForTeam'}
            onClick={() => props.onMondayV('hotels')}
          >
            {props.hotelTaskStatus === 'completed' ? '✓ Monday עודכן — מלונות' : 'סימולציית עדכון Monday — מלונות'}
          </button>
          <button
            className="dbtn demo-window-btn"
            disabled={props.attractionsTaskStatus !== 'waitingForTeam'}
            onClick={() => props.onMondayV('attractions')}
          >
            {props.attractionsTaskStatus === 'completed' ? '✓ Monday עודכן — אטרקציות' : 'סימולציית עדכון Monday — אטרקציות'}
          </button>
        </>
      )}

      <div className="demo-scenario-label" style={{ marginTop: 10 }}>תרחיש: לקוח מתקדם · {props.scenarioIndex + 1}/{SCENARIO.length}</div>
      <div className="row" style={{ marginTop: 4 }}>
        <button className="dbtn" disabled={atStart} onClick={() => props.onScenarioStep(-1)}>הקודם</button>
        <button className="dbtn primary" disabled={atEnd} onClick={() => props.onScenarioStep(1)}>המשך בתרחיש ←</button>
      </div>

      <button className="demo-adv-toggle" onClick={() => setAdvanced((v) => !v)}>
        {advanced ? '▾' : '◂'} Advanced Demo Controls
      </button>

      {advanced && (
        <div className="demo-adv">
          <label>חבילת לקוח</label>
          <div className="row" style={{ marginTop: 0 }}>
            {PACKAGES.map((p) => (
              <button
                key={p.id}
                className={`dbtn${props.pkg === p.id ? ' active' : ''}`}
                onClick={() => props.onPackage(p.id)}
              >
                {p.label}
              </button>
            ))}
          </div>

          <label>שלב בפועל · currentStage</label>
          <select value={props.currentStageId} onChange={(e) => props.onStage(e.target.value)}>
            {props.stages.map((s, i) => (
              <option key={s.id} value={s.id}>{i + 1} · {s.name}</option>
            ))}
          </select>

          <label>שלב בתצוגה · previewStage</label>
          <select value={props.previewStageId ?? ''} onChange={(e) => props.onPreview(e.target.value || null)}>
            <option value="">— כמו השלב בפועל —</option>
            {props.stages.map((s, i) => (
              <option key={s.id} value={s.id}>{i + 1} · {s.name}</option>
            ))}
          </select>

          {props.subStates.length > 1 && (
            <>
              <label>תת-מצב (של השלב המוצג)</label>
              <select value={props.subStateId} onChange={(e) => props.onSubState(e.target.value)}>
                {props.subStates.map((ss) => (
                  <option key={ss.id} value={ss.id}>{ss.demoLabel}</option>
                ))}
              </select>
            </>
          )}
        </div>
      )}
    </aside>
  );
}
