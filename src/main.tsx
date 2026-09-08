import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { CompareView } from './components/CompareView';
import { JourneyValidationView } from './components/JourneyValidationView';
import { IPhoneDemoFrame } from './components/IPhoneDemoFrame';
import './styles.css';

type MrjWindow = { __mrjTogglePhone?: () => void; __mrjToggleCompare?: () => void; __mrjToggleValidate?: () => void };

// מצבי הצגה — מעטפות פרזנטציה בלבד; האפליקציה עצמה זהה וחיה:
//   ?phone=1   — iPhone יחיד (כפתור בפאנל ה-Demo)
//   ?compare=1 — שני תרחישי זמן-לטיול זה לצד זה, כל אחד עם state עצמאי
//   ?validate=1 — אימות מנוע המסע: מצבי דמה → המנוע → אותם שני טלפונים
function Root() {
  const [phone, setPhone] = useState(
    () => new URLSearchParams(window.location.search).get('phone') === '1',
  );
  const [compare, setCompare] = useState(
    () => new URLSearchParams(window.location.search).get('compare') === '1',
  );
  const [validate, setValidate] = useState(
    () => new URLSearchParams(window.location.search).get('validate') === '1',
  );
  useEffect(() => {
    document.documentElement.classList.toggle('phone-mode', phone || compare || validate);
    document.documentElement.classList.toggle('compare-mode', compare || validate);
  }, [phone, compare, validate]);
  useEffect(() => {
    const w = window as unknown as MrjWindow;
    w.__mrjTogglePhone = () => setPhone((p) => !p);
    w.__mrjToggleCompare = () => setCompare((c) => !c);
    w.__mrjToggleValidate = () => setValidate((v) => !v);
  }, []);
  if (validate) return <JourneyValidationView onExit={() => setValidate(false)} />;
  if (compare) return <CompareView onExit={() => setCompare(false)} />;
  return phone ? (
    <IPhoneDemoFrame onExit={() => setPhone(false)}>
      <App phoneDemo />
    </IPhoneDemoFrame>
  ) : (
    <App />
  );
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
