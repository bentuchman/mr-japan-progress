import { useMemo } from 'react';
import { FilloutStandardEmbed } from '@fillout/react';

// ===== FilloutRenderer — הטמעה רשמית של טופס Fillout =====
// משתמש בחבילה הרשמית @fillout/react (FilloutStandardEmbed), ולא
// ב-iframe גנרי אל הכתובת. החבילה טוענת את סקריפט ההטמעה של הספק,
// מנהלת אתחול יחיד ומנקה את עצמה — אין הזרקת סקריפט ידנית ואין
// אתחול כפול ב-StrictMode.
//
// מה מגיע מהכתובת: אך ורק מה שנדרש טכנית להטמעה — הדומיין ומחרוזת
// השאילתה, שמומרת בשלמותה למפת פרמטרים ומועברת ל-prop הרשמי
// `parameters`. האפליקציה אינה קוראת אף ערך בודד, אינה גוזרת ממנו
// מצב עסקי ואינה מציגה אותו ב-UI.
interface Props {
  formId: string;
  url: string;            // הכתובת המלאה, אטומה
  // דומיין מותאם. לא מוגדר → ההטמעה רצה על משטח ההגשה הרגיל של הספק,
  // שהוא הנתיב הנתמך והסביר ביותר להצגה בתוך frame. מגדירים אותו רק
  // אם הטופס נשען על יכולות שקיימות רק בדומיין העצמי (למשל custom JS).
  domain?: string;
  onReady: () => void;    // onInit של הספק — סימן חיים אמיתי, לא טיימר
  onSubmitted?: () => void;
}

// המרה גורפת של מחרוזת השאילתה למפה. לא נקרא כאן שום מפתח ספציפי.
function paramsOf(url: string): Record<string, string> {
  const out: Record<string, string> = {};
  try {
    new URL(url).searchParams.forEach((v, k) => { out[k] = v; });
  } catch {
    /* כתובת לא תקינה — נשלח בלי פרמטרים */
  }
  return out;
}

export function FilloutRenderer({ formId, url, domain, onReady, onSubmitted }: Props) {
  // יציב בין רינדורים — אחרת ההטמעה הייתה מאותחלת מחדש בכל render
  const parameters = useMemo(() => paramsOf(url), [url]);
  return (
    <div className="fo-host">
      <FilloutStandardEmbed
        filloutId={formId}
        domain={domain}
        parameters={parameters}
        onInit={onReady}
        onSubmit={() => onSubmitted?.()}
      />
    </div>
  );
}
