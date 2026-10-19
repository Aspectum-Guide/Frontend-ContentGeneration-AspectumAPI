import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import MediaResultCard from './MediaResultCard';

describe('MediaResultCard UI primitive', () => {
  it('renders media metadata and source badge', () => {
    render(
      <MediaResultCard
        title="Кремль"
        thumb="/kremlin.jpg"
        author="Автор"
        license="CC BY"
        badge="WC"
        onSelect={vi.fn()}
      />
    );

    expect(screen.getByRole('img', { name: 'Кремль' }).getAttribute('src')).toBe('/kremlin.jpg');
    expect(screen.getByText('Автор: Автор')).toBeTruthy();
    expect(screen.getByText('Лицензия: CC BY')).toBeTruthy();
    expect(screen.getByText('WC')).toBeTruthy();
  });

  it('uses a native button and respects its disabled state', () => {
    const onSelect = vi.fn();
    const { rerender } = render(<MediaResultCard title="Фото" onSelect={onSelect} />);
    const card = screen.getByRole('button', { name: 'Выбрать изображение' });
    fireEvent.click(card);
    expect(onSelect).toHaveBeenCalledTimes(1);

    rerender(<MediaResultCard title="Фото" onSelect={onSelect} disabled />);
    fireEvent.click(screen.getByRole('button', { name: 'Выбрать изображение' }));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });
});
