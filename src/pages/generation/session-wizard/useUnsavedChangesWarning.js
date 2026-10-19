import { useEffect } from 'react';

export default function useUnsavedChangesWarning(hasUnsavedChangesRef) {
  useEffect(() => {
    const handler = (event) => {
      if (!hasUnsavedChangesRef.current) return;
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasUnsavedChangesRef]);
}
