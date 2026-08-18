import { SheetKind, Stage } from '../journeyConfig';

interface Props {
  stage: Stage;
  onBack: () => void;
  onView?: (opens: SheetKind) => void;
}

// צפייה בשלב שהושלם — היסטוריה בלבד. אינה מזיזה את המסע אחורה.
export function HistoricalStagePanel({ stage, onBack, onView }: Props) {
  return (
    <div className="stage-panel stage-panel-history" key={stage.id}>
      <div className="sp-icon sp-icon-done" aria-hidden>{stage.icon}</div>
      <div className="sp-name">{stage.name}</div>
      <span className="sp-pill sp-pill-done">✓ שלב שהושלם</span>
      {stage.historyText && <div className="sp-message">{stage.historyText}</div>}
      {stage.historyAsset && (
        <button
          className="sp-view"
          onClick={() => stage.historyOpens && onView?.(stage.historyOpens)}
        >
          {stage.historyAsset} — צפייה
        </button>
      )}
      <button className="sp-back" onClick={onBack}>חזרה לשלב הנוכחי ←</button>
    </div>
  );
}
