import { useEffect, useState } from 'react';

// "+ Новая локация" and "Новая локация" are the same button; so are "↻ Обновить" and "Обновить".
export function normalizeLabel(text) {
  return String(text ?? '').replace(/^[+↻\s]+/, '').replace(/\s+/g, ' ').trim().toLowerCase();
}

const BUTTON_SELECTOR = 'button, a, [role="button"]';
const defaultIsVisible = (element) => element.getClientRects().length > 0;

function sameSet(a, b) {
  if (a.size !== b.size) return false;
  for (const value of a) if (!b.has(value)) return false;
  return true;
}

/**
 * Normalised labels of the buttons/links currently *visible* inside `ref`'s element
 * (the page content, not the action bar and not portaled modals).
 *
 * Pages register their actions with the layout, and most of them also render the same
 * "Создать …" button in their own header. The action bar uses this set to show only what
 * the page does not already offer. Elements hidden by CSS (e.g. the header buttons that
 * PageHeader hides on mobile) do not count, so the bar takes over where the page gives up.
 */
export default function useVisibleButtonLabels(ref, { isVisible = defaultIsVisible } = {}) {
  const [labels, setLabels] = useState(() => new Set());

  useEffect(() => {
    const root = ref.current;
    if (!root) return undefined;

    const compute = () => {
      const next = new Set();
      root.querySelectorAll(BUTTON_SELECTOR).forEach((element) => {
        if (element.closest('[data-ui="page-action-bar"]')) return;
        if (!isVisible(element)) return;
        const label = normalizeLabel(element.textContent);
        if (label) next.add(label);
      });
      setLabels((current) => (sameSet(current, next) ? current : next));
    };

    let frame = 0;
    const schedule = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        compute();
      });
    };

    compute();
    const observer = new MutationObserver(schedule);
    observer.observe(root, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['class', 'hidden', 'style'] });
    window.addEventListener('resize', schedule);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', schedule);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [ref, isVisible]);

  return labels;
}
