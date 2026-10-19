import { useCallback, useEffect, useRef, useState } from 'react';

const DEFAULT_DURATION_MS = 3500;

export default function useToast(durationMs = DEFAULT_DURATION_MS) {
  const [note, setNote] = useState(null);
  const timerRef = useRef(null);

  const dismissNote = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    setNote(null);
  }, []);

  const showNote = useCallback(
    (msg, type = 'info') => {
      if (timerRef.current) clearTimeout(timerRef.current);
      setNote({ msg, type });
      timerRef.current = setTimeout(dismissNote, durationMs);
    },
    [durationMs, dismissNote]
  );

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    []
  );

  return { note, showNote, dismissNote };
}
