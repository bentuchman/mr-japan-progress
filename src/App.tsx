import { PointerEvent as ReactPointerEvent, useEffect, useMemo, useRef, useState } from 'react';
import mascot from './assets/mascot.png';
import {
  ATTRACTIONS_PAYMENT,
  ActionStatus,
  MEETING_DETAILS,
  PAYMENT_DETAILS,
  SELECTIONS_MOCK,
  PackageId,
  SCENARIO,
  SheetKind,
  SubState,
  TimeToTripScenario,
  activeSelectionActions,
  relevantStages,
  relevantSubStates,
} from './journeyConfig';
import { JourneyPath } from './components/JourneyPath';
import { ActionRow, CurrentStagePanel } from './components/CurrentStagePanel';
import { HistoricalStagePanel } from './components/HistoricalStagePanel';
import { JourneyFullView } from './components/JourneyFullView';
import { BottomSheet } from './components/BottomSheet';
import { CardDecor } from './components/CardDecor';
import { DemoControls } from './components/DemoControls';

// הבית הקיים של מר יפן — נשמר (מקור אמת ויזואלי)
const NAV_CARDS = [
  { icon: '🚄', label: 'מסלול הטיול' },
  { icon: '🧾', label: 'הזמנות' },
  { icon: '🍜', label: 'טעים וקרוב' },
  { icon: '⛩️', label: 'אטרקציות לידך' },
  { icon: '📖', label: 'מילון מונחים' },
  { icon: '💡', label: 'מרכז מידע' },
];

const TAB_BAR = [
  { icon: '☰', label: 'עוד' },
  { icon: '💬', label: 'הודעות' },
  { icon: '🏠', label: 'בית', active: true },
  { icon: '♡', label: 'מועדפים' },
  { icon: '👤', label: 'פרופיל' },
];

const TRIP = { title: 'המסע ליפן', start: '15/10/26', end: '28/10/26', daysLeft: 64 };

type SheetOpen = SheetKind | 'full';

// משוב ברירת מחדל לצפייה כשמדלגים לתת-מצב "נשלח" בלי למלא (דמו)
const FALLBACK_FEEDBACK = { rating: 5, text: 'הטיול היה חלומי — תודה על הליווי לאורך כל הדרך! 🇯🇵' };

// הלקוח בוחר מלונות בלבד — עבור אטרקציות הפעולה היא תשלום, לא בחירה
const ALL_HOTELS = SELECTIONS_MOCK.hotels.map((h) => h.name);

// רשימת בחירת המלונות לקריאה בלבד — לסיכום לפני שליחה ולצפייה אחריה
function SelectionsList({ selected }: { selected: string[] }) {
  const hotels = SELECTIONS_MOCK.hotels.filter((h) => selected.includes(h.name));
  return (
    <>
      <div className="sheet-list-title">🏨 מלונות</div>
      <div className="sheet-list">
        {hotels.map((h) => (
          <div key={h.name} className="sheet-li">
            <span className="en"><b>{h.city}</b> — {h.name}</span>
          </div>
        ))}
      </div>
    </>
  );
}

// דירוג כוכבים — אינטראקטיבי בטופס, קריאה בלבד בצפייה
function Stars({ value, onRate }: { value: number; onRate?: (v: number) => void }) {
  return (
    <div className={`stars${onRate ? '' : ' readonly'}`} role={onRate ? 'radiogroup' : undefined} aria-label="דירוג">
      {[1, 2, 3, 4, 5].map((v) => (
        <button
          key={v}
          type="button"
          className={`star${v <= value ? ' on' : ''}`}
          disabled={!onRate}
          aria-label={`${v} כוכבים`}
          onClick={() => onRate?.(v)}
        >
          {v <= value ? '★' : '☆'}
        </button>
      ))}
    </div>
  );
}

// phoneDemo: מצב הצגת iPhone — ניווט תצוגה במחוות (swipe/drag/edge-tap).
// fixedTimeScenario: תצוגת ההשוואה מקבעת את תרחיש הזמן למופע (state עצמאי לכל מופע).
// initialStageId: שלב הפתיחה של המופע (בהשוואה: השלב האדפטיבי).
interface AppProps {
  phoneDemo?: boolean;
  fixedTimeScenario?: TimeToTripScenario;
  initialStageId?: string;
}

export default function App({ phoneDemo = false, fixedTimeScenario, initialStageId }: AppProps) {
  const [pkg, setPkg] = useState<PackageId>('advanced');
  // currentStage — היכן הלקוח נמצא בפועל. לעולם לא משתנה מלחיצה על תחנה.
  const [currentStageId, setCurrentStageId] = useState(initialStageId ?? 'meeting');
  // previewStage — איזה שלב מודגם כרגע (null = מציגים את השלב בפועל).
  const [previewStageId, setPreviewStageId] = useState<string | null>(null);
  const [subSel, setSubSel] = useState<Record<string, string>>({});
  const [sheet, setSheet] = useState<SheetOpen>('none');
  // ברירת מחדל בפרוטוטייפ: מצב דמו פעיל — כל התחנות לחיצות מיד.
  // מצב לקוח (עתידי נעול) נבדק ידנית דרך המתג בפאנל ה-Demo.
  const [demoMode, setDemoMode] = useState(true);
  const [scenarioIndex, setScenarioIndex] = useState(2); // ברירת מחדל: פגישה

  // המשוב שנשלח (דמו) + טיוטת הטופס
  const [feedback, setFeedback] = useState<{ rating: number; text: string } | null>(null);
  const [fbRating, setFbRating] = useState(0);
  const [fbText, setFbText] = useState('');

  // בחירת מלונות: טיוטה (נשמרת בין הטופס לסיכום) + מה שנשלח (קריאה בלבד)
  const [chosen, setChosen] = useState<string[]>([]);
  const [submittedSel, setSubmittedSel] = useState<string[] | null>(null);

  // ===== תרחיש זמן-לטיול (הכלל העסקי: "3 חודשים לפני הטיול") =====
  // דגל תרחיש דמו — במימוש אמיתי ייגזר מתאריכי הטיול/Monday.
  const [timeScenario, setTimeScenario] = useState<TimeToTripScenario>(
    fixedTimeScenario ?? 'moreThanThreeMonths',
  );
  // דמו בלבד: הדמיית כניסה לחלון 3 החודשים בתוך תרחיש A
  const [windowOpened, setWindowOpened] = useState(false);
  // ===== מודל סטטוס פעולה — שלושה מצבים, לא בוליאני =====
  // פעולת לקוח אינה השלמה סופית: ההשלמה נקבעת כשמור/הצוות מסמנים
  // V ב-Monday. כל פעולה עצמאית; לא מקודד בתוך currentStageId.
  const [hotelTaskStatus, setHotelTaskStatus] = useState<ActionStatus>('pending');
  const [attractionsTaskStatus, setAttractionsTaskStatus] = useState<ActionStatus>('pending');
  const attractionsAvailable = timeScenario === 'lessThanThreeMonths' || windowOpened;

  // שם השלב האדפטיבי נגזר מהקונפיג + מצב חלון התשלום
  const stages = useMemo(() => {
    const base = relevantStages(pkg);
    return base.map((s) =>
      s.id === 'selections' && attractionsAvailable
        ? { ...s, name: 'בחירת מלונות ותשלום אטרקציות' }
        : s,
    );
  }, [pkg, attractionsAvailable]);
  const currentIndex = Math.max(0, stages.findIndex((s) => s.id === currentStageId));
  const previewIndex = previewStageId ? stages.findIndex((s) => s.id === previewStageId) : -1;
  const previewActive = previewIndex >= 0 && previewIndex !== currentIndex;

  // השלב המוצג בכרטיס: ה-preview אם פעיל, אחרת השלב בפועל
  const dispIndex = previewActive ? previewIndex : currentIndex;
  const dispStage = stages[dispIndex];
  const dispSubs = relevantSubStates(dispStage, pkg);
  const configSub = dispSubs.find((ss) => ss.id === subSel[dispStage.id]) ?? dispSubs[0];

  // ===== השלב האדפטיבי (selections) — נגזר מהקונפיג, לא מ-JSX מותנה =====
  // activeSelectionActions מחזירה את הפעולות הנדרשות כרגע. כשחלון תשלום
  // האטרקציות נפתח (הכניסה ל-3 חודשים), הפעולה נוספת לרשימה והשלב חוזר
  // להיות פעיל — גם אם בחירת המלונות כבר אושרה. אין "הושלם לתמיד".
  const selectionStatus: Record<string, ActionStatus> = {
    hotels: hotelTaskStatus,
    attractions: attractionsTaskStatus,
  };
  const selectionRows: ActionRow[] = activeSelectionActions(attractionsAvailable).map((a) => ({
    ...a,
    status: selectionStatus[a.id] ?? 'pending',
  }));
  // השלב מושלם רק כשכל הפעולות שנדרשות *כרגע* אושרו ב-Monday
  const selectionsDone = selectionRows.every((r) => r.status === 'completed');
  const selectionsPending = selectionRows.some((r) => r.status === 'pending');
  const selectionsSub: SubState = selectionsDone
    ? {
        id: 'sel-done', demoLabel: 'הושלם', ownership: 'none',
        confirms: [selectionRows.length > 1 ? 'הפעולות הושלמו' : 'בחירת המלונות הושלמה'],
        viewLabel: 'צפייה בבחירות', viewOpens: 'selections-view',
        autoAdvance: true,
      }
    : {
        // האחריות: כל עוד יש פעולה פתוחה — הכדור אצל הלקוח; אחרת הצוות מטפל
        id: selectionsPending ? 'sel-open' : 'sel-waiting',
        demoLabel: 'פעולות',
        ownership: selectionsPending ? 'client' : 'team',
        afterNote: selectionsPending ? 'לאחר השליחה, צוות מר יפן ימשיך מכאן.' : undefined,
      };
  // תתי-מצב מפורשים מה-Advanced controls ('all-ready' לבסיסי) גוברים על הסינתזה
  const selectionsView =
    dispStage.id === 'selections' && !['all-ready'].includes(subSel['selections'] ?? '');
  const dispSub = selectionsView ? selectionsSub : configSub;
  const dispActions = selectionsView ? selectionRows : undefined;
  const dispNext = dispIndex < stages.length - 1 ? stages[dispIndex + 1] : null;

  // האם בשלב מסוים יש פעולה פתוחה של הלקוח — נגזר מהקונפיג בלבד.
  // משמש את "כל שלבי המסע" כדי לסמן את השלב הנוכחי כדורש פעולה.
  function stageNeedsAction(stageId: string): boolean {
    if (stageId === 'selections') return selectionsPending;
    const st = stages.find((x) => x.id === stageId);
    if (!st) return false;
    const subs = relevantSubStates(st, pkg);
    const ss = subs.find((x) => x.id === subSel[stageId]) ?? subs[0];
    return ss.ownership === 'client' && !!ss.actions?.length;
  }

  // מצב לקוח: שלב שהושלם נצפה כהיסטוריה לקריאה בלבד.
  // מצב דמו: כל שלב מוצג "חי" — כאילו הלקוח פתח את האפליקציה באותו רגע.
  const historyView = previewActive && !demoMode && previewIndex < currentIndex;

  // תת-מצב אישור זמני (תשלום/טופס נשלח) מתגלגל אוטומטית לשלב הבא —
  // בתוך ההקשר שבו הוא קרה: preview מתקדם ב-preview, המצב בפועל במצב בפועל.
  useEffect(() => {
    if (historyView || !dispSub.autoAdvance || !dispNext) return;
    const t = window.setTimeout(() => {
      if (previewActive) setPreviewStageId(dispNext.id);
      else setCurrentStageId(dispNext.id);
    }, 2200);
    return () => window.clearTimeout(t);
  }, [dispSub, dispNext, previewActive, historyView]);

  // ===== מחוות פרזנטציה (phoneDemo בלבד) — ניווט תצוגה בלי פקדים גלויים =====
  // swipe/גרירה אופקית או טאפ בקצה, על אזורים לא-אינטראקטיביים בלבד.
  // משנה אך ורק את previewStageId; אנכי נשאר גלילה רגילה.
  const [dragX, setDragX] = useState(0);
  const [trans, setTrans] = useState<{ phase: 'out' | 'in'; dir: 1 | -1 } | null>(null);
  const gesture = useRef<{ x: number; y: number; id: number; intent: 'h' | 'v' | null } | null>(null);

  function navPreview(dir: 1 | -1) {
    if (sheet !== 'none' || trans) return;
    const t = dispIndex + dir;
    if (t < 0 || t >= stages.length) return;
    if (!demoMode && t > currentIndex) return; // מצב לקוח: עתידי נעול
    setTrans({ phase: 'out', dir });
    window.setTimeout(() => {
      selectNode(t);
      setTrans({ phase: 'in', dir });
      window.setTimeout(() => setTrans(null), 210);
    }, 150);
  }

  const INTERACTIVE = 'button, a, input, textarea, select, label, .fj-overlay, .demo';
  const gestureProps = phoneDemo
    ? {
        onPointerDown: (e: ReactPointerEvent<HTMLDivElement>) => {
          if ((e.target as Element).closest(INTERACTIVE)) { gesture.current = null; return; }
          gesture.current = { x: e.clientX, y: e.clientY, id: e.pointerId, intent: null };
        },
        onPointerMove: (e: ReactPointerEvent<HTMLDivElement>) => {
          const g = gesture.current;
          if (!g || e.pointerId !== g.id) return;
          const dx = e.clientX - g.x;
          const dy = e.clientY - g.y;
          if (!g.intent) {
            if (Math.abs(dx) > 14 && Math.abs(dx) > Math.abs(dy) * 1.3) {
              g.intent = 'h';
              (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
            } else if (Math.abs(dy) > 14) {
              g.intent = 'v'; // גלילה רגילה — לא ניווט
            }
          }
          if (g.intent === 'h') setDragX(Math.max(-30, Math.min(30, dx * 0.35)));
        },
        onPointerUp: (e: ReactPointerEvent<HTMLDivElement>) => {
          const g = gesture.current;
          gesture.current = null;
          setDragX(0);
          if (!g) return;
          const dx = e.clientX - g.x;
          const dy = e.clientY - g.y;
          // RTL: השלב הבא נמצא משמאל — גרירה ימינה מקדמת
          if (g.intent === 'h' && Math.abs(dx) > 60) { navPreview(dx > 0 ? 1 : -1); return; }
          // טאפ נקי בקצה המסך (על אזור לא-אינטראקטיבי): שמאל=קדימה, ימין=אחורה
          if (!g.intent && Math.hypot(dx, dy) < 8) {
            const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
            const edge = r.width * 0.1;
            if (e.clientX < r.left + edge) navPreview(1);
            else if (e.clientX > r.right - edge) navPreview(-1);
          }
        },
        onPointerCancel: () => { gesture.current = null; setDragX(0); },
      }
    : {};

  // לחיצה על תחנה בפס — משנה previewStage בלבד, לעולם לא את currentStage
  function selectNode(i: number) {
    const s = stages[i];
    setSheet('none');
    if (!demoMode && i > currentIndex) return; // לקוח: עתידי נעול
    if (i === currentIndex) { setPreviewStageId(null); return; }
    setSubSel((m) => { const { [s.id]: _drop, ...rest } = m; return rest; }); // תצוגה נקייה של ברירת המחדל
    setPreviewStageId(s.id);
  }

  // שינוי המצב בפועל (Demo controls / תרחיש) — מאפס את ה-preview
  function setActualStage(id: string, subId?: string) {
    setCurrentStageId(id);
    setSubSel((m) => {
      if (subId) return { ...m, [id]: subId };
      const { [id]: _drop, ...rest } = m;
      return rest;
    });
    setPreviewStageId(null);
    setSheet('none');
  }

  function setPreview(id: string | null) {
    setSheet('none');
    if (!id || id === currentStageId) { setPreviewStageId(null); return; }
    if (!demoMode) setDemoMode(true); // בחירת preview מהפאנל היא פעולת דמו
    setPreviewStageId(id);
  }

  function handleDemoMode(v: boolean) {
    setDemoMode(v);
    // חזרה למצב לקוח: שלב עתידי אינו נגיש — סוגרים את ה-preview
    if (!v && previewIndex > currentIndex) setPreviewStageId(null);
  }

  function stepScenario(dir: 1 | -1) {
    const next = Math.min(SCENARIO.length - 1, Math.max(0, scenarioIndex + dir));
    const step = SCENARIO[next];
    setScenarioIndex(next);
    setPkg('advanced'); // התרחיש מסופר על לקוח מתקדם
    setActualStage(step.stageId, step.subId);
  }

  function handlePackage(p: PackageId) {
    setPkg(p);
    setPreviewStageId(null);
    const next = relevantStages(p);
    if (!next.some((s) => s.id === currentStageId)) {
      const order = relevantStages('advanced');
      const idx = order.findIndex((s) => s.id === currentStageId);
      const fallback = next.find((s) => order.findIndex((x) => x.id === s.id) >= idx) ?? next[next.length - 1];
      setCurrentStageId(fallback.id);
    }
  }

  // סימולציות (mock) — משנות את תת-המצב של השלב שבו הן קרו
  function submitForm() {
    setSheet('none');
    setSubSel((m) => ({ ...m, 'changes-form': 'submitted' }));
  }
  function submitPayment() {
    setSheet('none');
    setSubSel((m) => ({ ...m, 'service-payment': 'paid' }));
  }
  // בחירה בטופס (טיוטה) — נשמרת גם כשחוזרים מהסיכום לטופס
  function toggleChoice(name: string) {
    setChosen((c) => (c.includes(name) ? c.filter((x) => x !== name) : [...c, name]));
  }
  // אישור ושליחת בחירת המלונות — פעולת הלקוח הסתיימה, אך זו אינה
  // השלמה סופית: המשימה עוברת ל"ממתינה לצוות" עד V ב-Monday.
  function submitSelections() {
    setSubmittedSel(chosen);
    setHotelTaskStatus('waitingForTeam');
    setSheet('none');
  }
  // תשלום אטרקציות (סימולציה) — עובר ל"ממתינה לצוות", לא ל"הושלם"
  function payAttractions() {
    setAttractionsTaskStatus('waitingForTeam');
    setSheet('none');
  }
  // דמו בלבד: הדמיית סימון V ב-Monday ע"י מור/הצוות — ההשלמה הסופית
  function simulateMondayV(task: 'hotels' | 'attractions') {
    if (task === 'hotels') setHotelTaskStatus('completed');
    else setAttractionsTaskStatus('completed');
  }
  // החלפת תרחיש זמן-לטיול (דמו): מאפסת את מצב המשימות להצגה נקייה.
  // לא נוגעת ב-currentStageId — עמדת הלקוח במסע אינה מושחתת.
  function handleTimeScenario(s: TimeToTripScenario) {
    setTimeScenario(s);
    setWindowOpened(false);
    setHotelTaskStatus('pending');
    setAttractionsTaskStatus('pending');
    setSubmittedSel(null);
    setChosen([]);
    setSheet('none');
  }
  function submitFeedback() {
    setFeedback({
      rating: fbRating || FALLBACK_FEEDBACK.rating,
      text: fbText.trim() || FALLBACK_FEEDBACK.text,
    });
    setSheet('none');
    setSubSel((m) => ({ ...m, feedback: 'submitted' }));
  }

  const shownFeedback = feedback ?? FALLBACK_FEEDBACK;
  // בצפייה: מה שנשלח בפועל; fallback לכל המלונות כשמדלגים ישירות בדמו
  const shownSelections = submittedSel ?? ALL_HOTELS;

  return (
    <div className="page" {...gestureProps}>
      {/* הדגמת iPhone: הדר תואם למוצר האמיתי — מזג אוויר משמאל, תפריט מימין,
          כותרת "המדריך האישי" ותאריכים, בלי ספירה לאחור. RTL: ילד ראשון = ימין. */}
      <header className="topbar">
        {phoneDemo ? (
          <>
            <button className="kebab" aria-label="תפריט">⋮</button>
            <span className="weather">☁️ 27°</span>
          </>
        ) : (
          <>
            <span className="weather">☁️ 27°</span>
            <button className="kebab" aria-label="תפריט">⋮</button>
          </>
        )}
      </header>

      <div className="trip-head">
        <h1>{phoneDemo ? 'המדריך האישי של דוגמה' : TRIP.title}</h1>
        <div className="dates">{TRIP.start} - {TRIP.end}</div>
        {!phoneDemo && (
          <div>
            <span className="countdown">נותרו {TRIP.daysLeft} ימים!</span>
          </div>
        )}
        <img className="mascot" src={mascot} alt="מר יפן" draggable={false} />
      </div>

      {/* ===== כרטיס המסע ===== */}
      <section
        className={`journey${trans ? ` j-${trans.phase}-${trans.dir > 0 ? 'f' : 'b'}` : ''}`}
        style={dragX ? { transform: `translateX(${dragX}px)` } : undefined}
        aria-label="המסע שלכם ליפן"
      >
        <CardDecor />
        {/* שכבה 1 — התמצאות: איפה אני במסע. פס דק בראש הכרטיס. */}
        <JourneyPath
          stages={stages}
          currentIndex={currentIndex}
          previewIndex={previewActive ? previewIndex : null}
          demoMode={demoMode}
          onSelectNode={selectNode}
          onOpenFull={() => setSheet('full')}
        />

        {/* שכבה 2 — מה קורה עכשיו: כרטיס אחד לשלב המוצג בלבד */}
        {historyView ? (
          <HistoricalStagePanel
            stage={dispStage}
            onBack={() => setPreviewStageId(null)}
            onView={(opens) => setSheet(opens)}
          />
        ) : (
          <CurrentStagePanel
            stage={dispStage}
            sub={dispSub}
            actions={dispActions}
            onCta={(opens) => { if (opens !== 'none') setSheet(opens); }}
          />
        )}
      </section>

      {/* ===== הניווט הקיים ===== */}
      <nav className="navgrid">
        {NAV_CARDS.map((c) => (
          <button key={c.label} className="navcard">
            <span className="ic">{c.icon}</span> {c.label}
          </button>
        ))}
      </nav>

      {/* ===== טאב-בר תחתון (כמו במוצר) — מוסתר בהדגמת ה-iPhone ===== */}
      {!phoneDemo && (
        <nav className="tabbar" aria-label="ניווט ראשי">
          {TAB_BAR.map((t) => (
            <button key={t.label} className={`tab${t.active ? ' active' : ''}`}>
              <span className="tab-ic">{t.icon}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </nav>
      )}

      {/* ===== Bottom Sheets ===== */}
      {sheet === 'meeting' && (
        <BottomSheet title={MEETING_DETAILS.title} onClose={() => setSheet('none')}>
          <div className="sheet-body">
            <div className="sheet-title">{MEETING_DETAILS.title}</div>
            <div className="sheet-sub">שלב {dispIndex + 1} מתוך {stages.length}</div>
            <div className="sheet-line">📅 <b>{MEETING_DETAILS.date}</b> · {MEETING_DETAILS.time}</div>
            <div className="sheet-line">📍 {MEETING_DETAILS.location}</div>
            <div className="sheet-desc">{MEETING_DETAILS.description}</div>
            <button className="sp-cta sheet-cta">{MEETING_DETAILS.cta} ←</button>
            <div className="sheet-after">{MEETING_DETAILS.afterNote}</div>
          </div>
        </BottomSheet>
      )}

      {sheet === 'form' && (
        <BottomSheet title="טופס שינויים" onClose={() => setSheet('none')}>
          <div className="sheet-body">
            <div className="sheet-title">מילוי טופס שינויים</div>
            <div className="sheet-sub">פתוח עד 18/08 · לאחר השליחה הטופס זמין לצפייה בלבד</div>
            <div className="sheet-desc">ספרו לנו מה תרצו לשנות בתוכנית — מסלול, קצב, לינה או כל דבר אחר.</div>
            <textarea className="sheet-textarea" placeholder="הבקשות שלכם..." rows={4} />
            <button className="sp-cta sheet-cta" onClick={submitForm}>שליחת הטופס ←</button>
          </div>
        </BottomSheet>
      )}

      {sheet === 'payment' && (
        <BottomSheet title={PAYMENT_DETAILS.title} onClose={() => setSheet('none')}>
          <div className="sheet-body">
            <div className="sheet-title">{PAYMENT_DETAILS.title}</div>
            <div className="sheet-sub">שלב {dispIndex + 1} מתוך {stages.length}</div>
            <div className="sheet-desc">{PAYMENT_DETAILS.description}</div>
            <div className="sheet-line">{PAYMENT_DETAILS.line}</div>
            <button className="sp-cta sheet-cta" onClick={submitPayment}>{PAYMENT_DETAILS.cta} ←</button>
          </div>
        </BottomSheet>
      )}

      {/* טופס בחירת המלונות (בחירה חיה בפרוטוטייפ; מלונות בלבד) */}
      {sheet === 'selections-form' && (
        <BottomSheet title="בחירת מלונות" onClose={() => setSheet('none')}>
          <div className="sheet-body">
            <div className="sheet-title">בחירת מלונות</div>
            <div className="sheet-desc">בחרו את המלונות המתאימים לכם.</div>
            <div className="sheet-list-title">🏨 מלונות</div>
            <div className="picks">
              {SELECTIONS_MOCK.hotels.map((h) => (
                <label key={h.name} className={`pick${chosen.includes(h.name) ? ' on' : ''}`}>
                  <input
                    type="checkbox"
                    checked={chosen.includes(h.name)}
                    onChange={() => toggleChoice(h.name)}
                  />
                  <span className="en"><b>{h.city}</b> — {h.name}</span>
                </label>
              ))}
            </div>
            <button
              className="sp-cta sheet-cta"
              disabled={chosen.length === 0}
              onClick={() => setSheet('selections-review')}
            >
              סקירת הבחירות ←
            </button>
            <button className="sheet-secondary" onClick={() => setSheet('none')}>ביטול</button>
          </div>
        </BottomSheet>
      )}

      {/* סיכום בחירת המלונות לפני שליחה — אישור, לא עוד טופס */}
      {sheet === 'selections-review' && (
        <BottomSheet title="סיכום הבחירות שלכם" onClose={() => setSheet('none')}>
          <div className="sheet-body">
            <div className="sheet-title">סיכום הבחירות שלכם</div>
            <SelectionsList selected={chosen} />
            <div className="sheet-warn">
              <b>לפני שממשיכים, כדאי לוודא שהכול נכון</b>
              <span>לאחר השליחה הבחירות יועברו לצוות מר יפן ויהיו זמינות לצפייה בלבד.</span>
            </div>
            <button className="sp-cta sheet-cta" onClick={submitSelections}>אישור ושליחת הבחירות ←</button>
            <button className="sheet-secondary" onClick={() => setSheet('selections-form')}>חזרה לבחירות</button>
          </div>
        </BottomSheet>
      )}

      {/* צפייה בבחירה שנשלחה — קריאה בלבד, ללא עריכה/מחיקה/שליחה מחדש */}
      {sheet === 'selections-view' && (
        <BottomSheet title="הבחירות שלכם" onClose={() => setSheet('none')}>
          <div className="sheet-body">
            <div className="sheet-title">הבחירות שלכם</div>
            <div className="sheet-sent">✓ הבחירות נשלחו לצוות מר יפן</div>
            <SelectionsList selected={shownSelections} />
            <button className="sheet-secondary" onClick={() => setSheet('none')}>סגירה</button>
          </div>
        </BottomSheet>
      )}

      {/* תשלום אטרקציות — סימולציית דמו; המנגנון בפועל יוגדר לפי התהליך הקיים */}
      {sheet === 'attractions-pay' && (
        <BottomSheet title={ATTRACTIONS_PAYMENT.title} onClose={() => setSheet('none')}>
          <div className="sheet-body">
            <div className="sheet-title">{ATTRACTIONS_PAYMENT.title}</div>
            <div className="sheet-desc">{ATTRACTIONS_PAYMENT.description}</div>
            <div className="sheet-note">{ATTRACTIONS_PAYMENT.note}</div>
            <button className="sp-cta sheet-cta" onClick={payAttractions}>{ATTRACTIONS_PAYMENT.cta} ←</button>
            <button className="sheet-secondary" onClick={() => setSheet('none')}>סגירה</button>
          </div>
        </BottomSheet>
      )}

      {/* טופס משוב (דמו) */}
      {sheet === 'feedback' && (
        <BottomSheet title="משוב" onClose={() => setSheet('none')}>
          <div className="sheet-body">
            <div className="sheet-title">נשמח לשמוע איך היה 🇯🇵</div>
            <div className="sheet-desc">איך הייתה החוויה שלכם עם מר יפן?</div>
            <Stars value={fbRating} onRate={setFbRating} />
            <div className="sheet-label">ספרו לנו קצת על החוויה שלכם</div>
            <textarea
              className="sheet-textarea"
              placeholder="מה אהבתם? מה אפשר לשפר?"
              rows={4}
              value={fbText}
              onChange={(e) => setFbText(e.target.value)}
            />
            <button className="sp-cta sheet-cta" onClick={submitFeedback}>שליחת המשוב ←</button>
            <button className="sheet-secondary" onClick={() => setSheet('none')}>אולי אחר כך</button>
          </div>
        </BottomSheet>
      )}

      {/* צפייה במשוב שנשלח — קריאה בלבד */}
      {sheet === 'feedback-view' && (
        <BottomSheet title="המשוב שלכם" onClose={() => setSheet('none')}>
          <div className="sheet-body">
            <div className="sheet-title">המשוב שלכם</div>
            <div className="sheet-sent">✓ המשוב נשלח לצוות מר יפן</div>
            <Stars value={shownFeedback.rating} />
            <div className="sheet-quote">{shownFeedback.text}</div>
            <button className="sheet-secondary" onClick={() => setSheet('none')}>סגירה</button>
          </div>
        </BottomSheet>
      )}

      {sheet === 'full' && (
        <JourneyFullView
          stages={stages}
          currentIndex={currentIndex}
          previewIndex={previewActive ? previewIndex : null}
          demoMode={demoMode}
          actionRequired={stageNeedsAction(currentStageId)}
          onClose={() => setSheet('none')}
          onSelectStage={(i) => selectNode(i)}
        />
      )}

      <DemoControls
        pkg={pkg}
        stages={stages}
        subStates={dispSubs}
        currentStageId={currentStageId}
        currentIndex={currentIndex}
        previewStageId={previewActive ? previewStageId : null}
        previewIndex={previewActive ? previewIndex : null}
        subStateId={configSub.id}
        scenarioIndex={scenarioIndex}
        demoMode={demoMode}
        timeScenario={timeScenario}
        windowOpened={windowOpened}
        fixedScenario={!!fixedTimeScenario}
        hotelTaskStatus={hotelTaskStatus}
        attractionsTaskStatus={attractionsTaskStatus}
        attractionsAvailable={attractionsAvailable}
        onMondayV={simulateMondayV}
        onTimeScenario={handleTimeScenario}
        onOpenWindow={() => setWindowOpened(true)}
        onDemoMode={handleDemoMode}
        onScenarioStep={stepScenario}
        onPackage={handlePackage}
        onStage={(id) => setActualStage(id)}
        onPreview={setPreview}
        onSubState={(id) => setSubSel((m) => ({ ...m, [dispStage.id]: id }))}
      />
    </div>
  );
}
