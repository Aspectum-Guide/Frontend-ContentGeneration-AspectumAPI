import { useEffect, useRef } from 'react';

/**
 * Немедленный сейв несохранённых правок при уходе.
 *
 * Debounce-автосейвы шагов визарда при unmount просто отменяли таймер —
 * «вставил текст → переключился на другую страницу → правка пропала».
 * Хук вызывает flushFn (обычно saveXxxIfDirty({silent:true}) — она сама
 * проверяет dirty и ждёт idle) в трёх случаях:
 *  - unmount (SPA-переход внутри админки) — axios-запрос переживает unmount;
 *  - visibilitychange → hidden (переключение вкладки браузера);
 *  - pagehide (закрытие вкладки — best effort).
 * Ошибки глотаются: уход со страницы блокировать нельзя.
 */
export default function useFlushOnLeave(flushFn) {
  const ref = useRef(flushFn);
  ref.current = flushFn;

  useEffect(() => {
    const fire = () => {
      try {
        const p = ref.current?.();
        if (p && typeof p.catch === 'function') p.catch(() => {});
      } catch { /* best effort */ }
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') fire();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', fire);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', fire);
      fire(); // unmount: SPA-переход на другую страницу админки
    };
  }, []);
}
