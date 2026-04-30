/* eslint-disable react-refresh/only-export-components */
import { createContext, useMemo, useState } from 'react';

export const LayoutActionsContext = createContext({
  mobileActions: [],
  setMobileActions: () => { },
});

export function LayoutActionsProvider({ children }) {
  const [mobileActions, setMobileActions] = useState([]);
  const value = useMemo(() => ({ mobileActions, setMobileActions }), [mobileActions]);

  return (
    <LayoutActionsContext.Provider value={value}>
      {children}
    </LayoutActionsContext.Provider>
  );
}
