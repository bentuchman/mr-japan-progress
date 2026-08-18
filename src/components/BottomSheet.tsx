import { ReactNode } from 'react';

interface Props {
  title?: string;
  onClose: () => void;
  children: ReactNode;
}

// Bottom Sheet כללי — מובייל: נגלל מלמטה; דסקטופ: מודאל ממורכז.
export function BottomSheet({ title, onClose, children }: Props) {
  return (
    <div className="fj-overlay" onClick={onClose}>
      <div className="fj-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={title}>
        <button className="sheet-close" onClick={onClose} aria-label="סגירה">✕</button>
        {children}
      </div>
    </div>
  );
}
