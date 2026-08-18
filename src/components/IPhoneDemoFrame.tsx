import { ReactNode } from 'react';

// ===== מסגרת iPhone להצגה — קוד פרזנטציה בלבד, לא חלק מהמוצר =====
// המסך (iphone-screen) הוא transformed ancestor: כל אלמנט position:fixed
// של האפליקציה (טאב-בר, Bottom Sheets, פאנל דמו) נעגן בתוכו — והתוכן
// (iphone-content) נגלל בפנים כמו viewport אמיתי. האפליקציה חיה לחלוטין.

interface Props {
  onExit: () => void;
  children: ReactNode;
}

export function IPhoneDemoFrame({ onExit, children }: Props) {
  return (
    <div className="iphone-stage">
      <button className="iphone-exit" onClick={onExit}>✕ יציאה מתצוגת iPhone</button>
      <div className="iphone-device">
        {/* כפתורי צד — ריאליזם עדין */}
        <span className="ib ib-action" aria-hidden />
        <span className="ib ib-volup" aria-hidden />
        <span className="ib ib-voldn" aria-hidden />
        <span className="ib ib-power" aria-hidden />
        <div className="iphone-screen">
          {/* שכבת סטטוס — כרום תצוגה בלבד, שקופה ללחיצות */}
          <div className="iphone-status" aria-hidden>
            <span className="ist-time">9:41</span>
            <div className="iphone-island" />
            <span className="ist-icons">
              {/* אנטנה */}
              <svg viewBox="0 0 18 12" width="18" height="12"><g fill="#2b2b33"><rect x="0" y="8" width="3" height="4" rx="1" /><rect x="5" y="6" width="3" height="6" rx="1" /><rect x="10" y="3.5" width="3" height="8.5" rx="1" /><rect x="15" y="1" width="3" height="11" rx="1" /></g></svg>
              {/* Wi-Fi */}
              <svg viewBox="0 0 16 12" width="16" height="12"><g fill="none" stroke="#2b2b33" strokeWidth="1.7" strokeLinecap="round"><path d="M1.5 4.2C5.2.6 10.8.6 14.5 4.2" /><path d="M4 7C6.3 4.9 9.7 4.9 12 7" /></g><circle cx="8" cy="10" r="1.6" fill="#2b2b33" /></svg>
              {/* סוללה */}
              <svg viewBox="0 0 25 12" width="25" height="12"><rect x=".5" y=".5" width="21" height="11" rx="3.5" fill="none" stroke="#2b2b33" strokeOpacity=".4" /><rect x="2" y="2" width="15" height="8" rx="2" fill="#2b2b33" /><path d="M23 4v4a2.2 2.2 0 0 0 0-4Z" fill="#2b2b33" fillOpacity=".4" /></svg>
            </span>
          </div>
          <div className="iphone-content">{children}</div>
        </div>
      </div>
    </div>
  );
}
