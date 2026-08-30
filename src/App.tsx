import { PointerEvent as ReactPointerEvent, useEffect, useMemo, useRef, useState } from 'react';
import mascot from './assets/mascot.png';
import {
  ActionProvider,
  ActionStatus,
  PackageId,
  SCENARIO,
  SheetKind,
  SubState,
  TimeToTripScenario,
  actionById,
  relevantStages,
  relevantSubStates,
  stageActions,
} from './journeyConfig';
import { JourneyPath } from './components/JourneyPath';
import { ActionRow, CurrentStagePanel } from './components/CurrentStagePanel';
import { HistoricalStagePanel } from './components/HistoricalStagePanel';
import { JourneyFullView } from './components/JourneyFullView';
import { BottomSheet } from './components/BottomSheet';
import { EmbeddedActionSheet } from './components/EmbeddedActionSheet';
import { LinkDiagnostics } from './components/LinkDiagnostics';
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
  // פעולה שנפתחת מוטמעת בתוך האפליקציה (כתובת אטומה מהקונפיג).
  // מצב תצוגה בלבד — אינו נוגע ב-currentStage/previewStage ובהתקדמות.
  const [embedded, setEmbedded] = useState<
    { id: string; title: string; url: string; provider: ActionProvider; filloutFormId?: string } | null
  >(null);
  // DEV — פעולה שאי אפשר לפתוח כרגע. שתי סיבות שונות, והמסך אומר איזו:
  //   awaitingVerification — יש כתובת, אבל טרם אומת מה היא עושה
  //   אחרת                 — עדיין אין כתובת אמיתית לפעולה
  const [unlinked, setUnlinked] =
    useState<{ title: string; awaitingVerification: boolean } | null>(null);
  const [diagnostics, setDiagnostics] = useState(false);   // DEV בלבד
  // ברירת מחדל בפרוטוטייפ: מצב דמו פעיל — כל התחנות לחיצות מיד.
  // מצב לקוח (עתידי נעול) נבדק ידנית דרך המתג בפאנל ה-Demo.
  const [demoMode, setDemoMode] = useState(true);
  const [scenarioIndex, setScenarioIndex] = useState(2); // ברירת מחדל: פגישה

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
  const selectionRows: ActionRow[] = stageActions('selections', attractionsAvailable).map((a) => ({
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
        autoAdvance: true,
      }
    : {
        // האחריות: כל עוד יש פעולה פתוחה — הכדור אצל הלקוח; אחרת הצוות מטפל
        id: selectionsPending ? 'sel-open' : 'sel-waiting',
        demoLabel: 'פעולות',
        ownership: selectionsPending ? 'client' : 'team',
      };
  // תתי-מצב מפורשים מה-Advanced controls ('all-ready' לבסיסי) גוברים על הסינתזה
  const selectionsView =
    dispStage.id === 'selections' && !['all-ready'].includes(subSel['selections'] ?? '');
  const dispSub = selectionsView ? selectionsSub : configSub;
  // פעולות השלב המוצג — מזהים מהקונפיג, הגדרות מהרישום המרכזי.
  // שלב יכול להחזיק אפס, אחת או כמה פעולות; אין כאן שום ידע על שלב מסוים.
  const dispActions: ActionRow[] = selectionsView
    ? selectionRows
    : (dispSub.actions ?? [])
        .map(actionById)
        .filter((a): a is NonNullable<typeof a> => !!a)
        .map((a) => ({ ...a, status: 'pending' as ActionStatus }));
  const dispNext = dispIndex < stages.length - 1 ? stages[dispIndex + 1] : null;

  // ניתוב לפי ספק התוכן של הפעולה. אין כאן if לפי stageId ואין יעדים
  // מקודדים — ההתנהגות מגיעה מנתוני הפעולה בלבד. פתיחת פעולה לעולם
  // אינה מזיזה את המסע: כאן נפתח רק גיליון/מסך, ומצב המסע נשלט בנפרד.
  function handleAction(action: ActionRow) {
    // webhook של אוטומציה: לא מוטמע, לא נפתח, ולא נקרא. הבדיקה הזו
    // קודמת לכל שימוש ב-url, כדי שהכתובת לא תיגע בשום מסלול תצוגה
    // כל עוד לא אומת מה היא בכלל מחזירה.
    if (action.provider === 'make-webhook' && !action.verifiedDisplayTarget) {
      setUnlinked({ title: action.title, awaitingVerification: true });
      return;
    }
    // פעולה עם כתובת חיצונית מאומתת (fillout/zite) כלל אינה מגיעה לכאן:
    // ה-CTA שלה מרונדר כעוגן <a href> והדפדפן מנווט בעצמו.
    if (action.url && action.openMode === 'external') {
      window.open(action.url, '_blank', 'noopener,noreferrer');
      return;
    }
    if (action.openMode === 'sheet' && action.opens && action.opens !== 'none') {
      setSheet(action.opens);
      return;
    }
    // openMode null, או מצב שאין לו עדיין כתובת מאומתת — ה-CTA נשאר
    // גלוי אך מציג מצב "טרם חובר" (DEV). לא מוצג תוכן מומצא.
    setUnlinked({ title: action.title, awaitingVerification: false });
  }

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
  // הלקוח סיים את חלקו. זו אינה התקדמות במסע: המשימה עוברת ל"נשלח"
  // בלבד, וההשלמה תגיע מהתהליך הפנימי. משמש גם את הטופס המוטמע.
  function markHotelsSent() {
    setHotelTaskStatus('waitingForTeam');
    setSheet('none');
  }
  // דמו: הלקוח השלים את תשלום האטרקציות (אין עדיין קישור אמיתי)
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
    setSheet('none');
  }

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
            onAction={handleAction}
            onOpenSheet={(kind) => { if (kind !== 'none') setSheet(kind); }}
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

      {/* DEV — פעולה שאי אפשר לפתוח כרגע. לא מוצג ללקוח בפרודקשן. */}
      {unlinked && (
        <BottomSheet title={unlinked.title} onClose={() => setUnlinked(null)}>
          <div className="sheet-body">
            <div className="sheet-title">{unlinked.title}</div>
            <div className="sheet-dev">
              DEV · {unlinked.awaitingVerification
                ? 'הקישור חובר, אך אופן הפעולה שלו עדיין דורש אימות'
                : 'הקישור לפעולה זו טרם חובר'}
            </div>
            <div className="sheet-desc">
              הקישור האמיתי יגיע מהעמודה המתאימה ב-Monday. עד אז לא מוצג כאן תוכן מדומה.
            </div>
            <button className="sheet-secondary" onClick={() => setUnlinked(null)}>סגירה</button>
          </div>
        </BottomSheet>
      )}

      {/* פעולת לקוח שנפתחת בתוך מר יפן — הלקוח לא עוזב את האפליקציה */}
      {embedded && (
        <EmbeddedActionSheet
          title={embedded.title}
          url={embedded.url}
          provider={embedded.provider}
          filloutFormId={embedded.filloutFormId}
          onClose={() => setEmbedded(null)}
          onSubmitted={() => {
            // דיווח שליחה מהתוכן המוטמע — רק לפעולת המלונות יש כרגע
            // מצב לקוח מנוהל. אינו מזיז את המסע.
            if (embedded.id === 'hotels') markHotelsSent();
            setEmbedded(null);
          }}
        />
      )}

      {diagnostics && <LinkDiagnostics onClose={() => setDiagnostics(false)} />}

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
        onHotelsSent={markHotelsSent}
        onDiagnostics={() => setDiagnostics(true)}
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
