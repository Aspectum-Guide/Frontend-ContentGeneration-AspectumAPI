import { useEffect } from 'react';

/**
 * Блокирует прокрутку страницы (body + main) пока открыта модалка.
 */
export function useModalScrollLock(open) {
  useEffect(() => {
    if (!open) return;

    const html = document.documentElement;
    const { body } = document;
    const main = document.querySelector('main');

    const prevHtmlOverflow = html.style.overflow;
    const prevBodyOverflow = body.style.overflow;
    const prevMainOverflow = main?.style.overflow ?? '';

    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    if (main) main.style.overflow = 'hidden';

    return () => {
      html.style.overflow = prevHtmlOverflow;
      body.style.overflow = prevBodyOverflow;
      if (main) main.style.overflow = prevMainOverflow;
    };
  }, [open]);
}
