import { useCallback, useEffect, useRef } from 'react';

// Один общий document-listener на всё приложение + ссылка на «наведённую» рамку.
// hoveredPasteTarget = { token, cb } — cb получает вставленный File.
let hoveredPasteTarget = null;
let listenerAttached = false;

function ensurePasteListener() {
  if (listenerAttached || typeof document === 'undefined') return;
  listenerAttached = true;
  document.addEventListener('paste', (event) => {
    const target = hoveredPasteTarget;
    if (!target) return;

    const items = event.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i += 1) {
      const item = items[i];
      if (
        item &&
        item.kind === 'file' &&
        typeof item.type === 'string' &&
        item.type.startsWith('image/')
      ) {
        const file = item.getAsFile();
        if (file) {
          event.preventDefault();
          target.cb(file);
        }
        return;
      }
    }
  });
}

/**
 * Вставка изображения из буфера обмена по Ctrl+V, когда курсор наведён на рамку.
 *
 *   const paste = usePasteImageOnHover((file) => uploadFile(file));
 *   <div {...paste}> …рамка с фото… </div>
 *
 * onPasteImage получает File. Возвращает { onMouseEnter, onMouseLeave }.
 */
export function usePasteImageOnHover(onPasteImage, { disabled = false } = {}) {
  const cbRef = useRef(onPasteImage);
  cbRef.current = onPasteImage;
  const tokenRef = useRef({});

  useEffect(() => {
    ensurePasteListener();
    const token = tokenRef.current;
    return () => {
      if (hoveredPasteTarget && hoveredPasteTarget.token === token) {
        hoveredPasteTarget = null;
      }
    };
  }, []);

  const onMouseEnter = useCallback(() => {
    if (disabled) return;
    hoveredPasteTarget = {
      token: tokenRef.current,
      cb: (file) => cbRef.current?.(file),
    };
  }, [disabled]);

  const onMouseLeave = useCallback(() => {
    if (hoveredPasteTarget && hoveredPasteTarget.token === tokenRef.current) {
      hoveredPasteTarget = null;
    }
  }, []);

  return { onMouseEnter, onMouseLeave };
}
