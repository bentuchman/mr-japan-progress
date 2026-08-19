// רקע כרטיס ה-Progress — שנהב חם ונקי, עם רמז יפני אחד בלבד:
// צללית פוג'י כווטרמרק אטמוספרי בתחתית הכרטיס. בלי סאקורה/שמש/פגודה/גלים,
// בלי מסקוט ובלי לוגו — הכרטיס כבר חי בתוך המוצר של מר יפן.
// pointer-events:none, z-index 0 — תמיד מאחורי כל התוכן, נחתך ברדיוס הכרטיס.
export function CardDecor() {
  return (
    <div className="deco" aria-hidden>
      <svg className="deco-fuji" viewBox="0 0 320 72" preserveAspectRatio="none">
        {/* צללית אחת, מדרונות קעורים עדינים — פרופיל פוג'י מזוהה בלי פירוט */}
        <path d="M0 72 C58 66 96 40 128 14 C133 9 139 9 144 14 C176 40 214 66 272 72 Z" />
      </svg>
    </div>
  );
}
