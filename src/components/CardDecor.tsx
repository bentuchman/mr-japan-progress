import cardBg from '../assets/card-bg.webp';

// רקע הכרטיס — נכס האקוורל הסופי (מצורף מהלקוח), כפי שהוא.
// שכבת תמונה + רעלת קרם עדינה לקריאות. אין שום נוף מצויר ב-CSS/SVG.
// pointer-events:none, z-index 0 — תמיד מאחורי כל התוכן, נחתך ברדיוס הכרטיס.
export function CardDecor() {
  return (
    <div className="deco" aria-hidden>
      <div className="deco-art" style={{ backgroundImage: `url(${cardBg})` }} />
      <div className="deco-veil" />
    </div>
  );
}
