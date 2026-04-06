import { createContext, useContext, useMemo, useState } from 'react';

const LayoutActionsContext = createContext({
  mobileActions: [],
  setMobileActions: () => {},
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

export function useLayoutActions() {
  return useContext(LayoutActionsContext);
}

export default LayoutActionsContext;
