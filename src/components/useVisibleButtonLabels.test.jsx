import { act, render, screen, waitFor } from '@testing-library/react';
import { useRef, useState } from 'react';
import { describe, expect, it } from 'vitest';
import useVisibleButtonLabels, { normalizeLabel } from './useVisibleButtonLabels';

// jsdom has no layout: treat an element as visible unless it carries data-hidden.
const isVisible = (element) => !element.closest('[data-hidden]');

function Probe({ onLabels }) {
  const ref = useRef(null);
  const labels = useVisibleButtonLabels(ref, { isVisible });
  onLabels(labels);
  const [extra, setExtra] = useState(false);
  return (
    <div>
      <button type="button" onClick={() => setExtra(true)}>toggle</button>
      <div ref={ref}>
        <button type="button">+ Новая локация</button>
        <a href="/x">Открыть   сессии</a>
        <div data-hidden>
          <button type="button">Скрытая кнопка</button>
        </div>
        {extra && <button type="button">Добавлена позже</button>}
        <div data-ui="page-action-bar"><button type="button">Из панели</button></div>
      </div>
    </div>
  );
}

describe('normalizeLabel', () => {
  it('ignores leading symbols, case and repeated spaces', () => {
    expect(normalizeLabel('+ Новая локация')).toBe('новая локация');
    expect(normalizeLabel('↻ Обновить')).toBe('обновить');
    expect(normalizeLabel('  Создать   код ')).toBe('создать код');
    expect(normalizeLabel(null)).toBe('');
  });
});

describe('useVisibleButtonLabels', () => {
  it('collects visible buttons and links, skipping hidden ones and the action bar itself', () => {
    let seen = new Set();
    render(<Probe onLabels={(labels) => { seen = labels; }} />);
    expect(seen.has('новая локация')).toBe(true);
    expect(seen.has('открыть сессии')).toBe(true);
    expect(seen.has('скрытая кнопка')).toBe(false);
    expect(seen.has('из панели')).toBe(false);
  });

  it('notices buttons added later', async () => {
    let seen = new Set();
    render(<Probe onLabels={(labels) => { seen = labels; }} />);
    expect(seen.has('добавлена позже')).toBe(false);
    await act(async () => { screen.getByRole('button', { name: 'toggle' }).click(); });
    await waitFor(() => expect(seen.has('добавлена позже')).toBe(true));
  });
});
