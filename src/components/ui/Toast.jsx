import { useCallback, useEffect, useRef, useState } from 'react';

const DEFAULT_DURATION_MS = 3500;

const colorMap = {
  success: 'bg-green-600',
  error: 'bg-red-600',
  info: 'bg-blue-600',
  warning: 'bg-yellow-500',
};

export function useToast(durationMs = DEFAULT_DURATION_MS) {
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

export default function Toast({ note, className = '' }) {
  if (!note) return null;

  return (
    <div
      className={`fixed top-5 right-5 z-50 px-4 py-3 rounded-lg text-white text-sm shadow-lg transition-all ${colorMap[note.type] || colorMap.info} ${className}`.trim()}
    >
      {note.msg}
    </div>
  );
}
