import { createContext, useContext, useEffect, useState } from 'react';
import { ADMIN, STUDIO, probeAppMode } from './appMode';
import { setWorkspace } from '../utils/workspace';

const AppModeContext = createContext(STUDIO);

export function AppModeProvider({ children }) {
  const [mode, setMode] = useState(null);

  useEffect(() => {
    let cancelled = false;
    probeAppMode().then((next) => {
      if (cancelled) return;
      if (next === ADMIN) setWorkspace('');
      setMode(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!mode) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-gray-500">
        Определяем режим панели…
      </div>
    );
  }

  return (
    <AppModeContext.Provider value={mode}>
      {children}
    </AppModeContext.Provider>
  );
}

export function useAppMode() {
  return useContext(AppModeContext);
}
