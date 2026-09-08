import { useEffect, useMemo, useState } from 'react';
import App from '../App';
import { IPhoneDemoFrame } from './IPhoneDemoFrame';
import { deriveJourneyRuntimeState } from '../journeyRuntime';
import { packageFromPlan } from '../customerActions';
import { setCustomerJourney } from '../customerSession';
import { VALIDATION_STATES } from '../journeyValidationStates';

// ===== אימות חזותי של מנוע המסע (Phase 2) — על גבי ה-UI המאושר =====
// אותה תצוגת שני iPhone מאושרת של ההשוואה — לא מסך דמו/דיבאג חדש:
//   מצב דמה מקומי → המנוע האמיתי → שלב+תת-מצב → הטלפונים הקיימים
// בורר המצבים חי *מחוץ* לטלפונים; בתוך הטלפון — המוצר המאושר בלבד.
// אפס רשת: ה-fixtures מקומיים והשער כלל אינו מוגדר במצב הזה.
export function JourneyValidationView({ onExit }: { onExit: () => void }) {
  const [stateId, setStateId] = useState(VALIDATION_STATES[0].id);
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const current = VALIDATION_STATES.find((s) => s.id === stateId) ?? VALIDATION_STATES[0];
  const fixture = useMemo(() => current.build(today), [current, today]);
  const derived = useMemo(
    () => deriveJourneyRuntimeState(fixture, today, undefined, current.extras),
    [fixture, today, current],
  );

  // ה-fixture נטען כ"לקוח הנוכחי" דרך המסלול הקיים (customerSession) —
  // כך מסך הפגישה מציג את מועד ה-scheduledAt המדומה דרך אותו UI קיים
  // בדיוק, והפעולות שואבות את הכתובות מנתוני הלקוח כמו בפרודקשן.
  // ביציאה מהאימות המצב מנוקה — הדמו הרגיל אינו מושפע.
  useEffect(() => {
    setCustomerJourney(fixture);
    return () => setCustomerJourney(null);
  }, [fixture]);
  const stageId = derived.kind === 'resolved' ? derived.currentStageId : undefined;
  const substateId = derived.kind === 'resolved' ? derived.currentSubstateId : undefined;
  // חבילת הטלפונים נגזרת מ-Plan של ה-fixture — כמו במנוע עצמו
  const phonePkg = packageFromPlan(fixture) ?? 'advanced';
  const groups = [...new Set(VALIDATION_STATES.map((s) => s.group))];

  return (
    <div className="compare-canvas">
      <button className="compare-exit" onClick={onExit}>✕ יציאה מאימות המסע</button>

      {/* בורר תרחישי QA — פקדי אימות מחוץ ל-UI של הלקוח. אלו תרחישי
          בדיקה מקובצים, לא 14 שלבי מסע ולא ציר זמן קבוע. */}
      <div className="validate-note" dir="rtl">
        תרחישי בדיקה של מנוע המסע — קבוצת "בחירות והזמנות" מכילה מצבים
        מקבילים (למשל: בקשת תשלום אטרקציות יכולה להיות פעילה במקביל לבחירת המלונות)
      </div>
      {groups.map((g) => (
        <div key={g} className="validate-group" role="toolbar" aria-label={g} dir="rtl">
          <span className="validate-group-title">{g}</span>
          {VALIDATION_STATES.filter((s) => s.group === g).map((s) => (
            <button
              key={s.id}
              className={`validate-btn${s.id === stateId ? ' active' : ''}`}
              onClick={() => setStateId(s.id)}
            >
              {s.label}
            </button>
          ))}
        </div>
      ))}
      <div className="validate-reason" dir="rtl">
        {derived.kind === 'resolved'
          ? `המנוע: ${derived.currentStageId} / ${derived.currentSubstateId} — ${derived.reason}`
          : `המנוע: ${derived.kind} — ${derived.reason}`}
      </div>

      <div className="compare-grid">
        <div className="compare-col">
          <div className="compare-label">
            <span>תרחיש 1</span>
            <b>הטיול בעוד יותר מ־3 חודשים</b>
          </div>
          <IPhoneDemoFrame onExit={onExit}>
            <App
              key={`a-${current.id}`}
              phoneDemo
              fixedTimeScenario="moreThanThreeMonths"
              initialStageId={stageId}
              initialSubstateId={substateId}
              initialPackage={phonePkg}
            />
          </IPhoneDemoFrame>
        </div>
        <div className="compare-col">
          <div className="compare-label">
            <span>תרחיש 2</span>
            <b>הטיול בעוד פחות מ־3 חודשים</b>
          </div>
          <IPhoneDemoFrame onExit={onExit}>
            <App
              key={`b-${current.id}`}
              phoneDemo
              fixedTimeScenario="lessThanThreeMonths"
              initialStageId={stageId}
              initialSubstateId={substateId}
              initialPackage={phonePkg}
            />
          </IPhoneDemoFrame>
        </div>
      </div>
    </div>
  );
}
