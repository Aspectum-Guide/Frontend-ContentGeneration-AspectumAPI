import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import ProgressBar from './ProgressBar';

describe('ProgressBar', () => {
  it('exposes progress semantics and calculated width', () => {
    render(<ProgressBar value={25} max={50} label="Загрузка" />);

    const progress = screen.getByRole('progressbar', { name: 'Загрузка' });
    expect(progress.getAttribute('aria-valuemin')).toBe('0');
    expect(progress.getAttribute('aria-valuemax')).toBe('50');
    expect(progress.getAttribute('aria-valuenow')).toBe('25');
    expect(progress.firstElementChild.style.width).toBe('50%');
  });

  it('clamps invalid and out-of-range values', () => {
    const { rerender } = render(<ProgressBar value={150} />);
    const progress = screen.getByRole('progressbar');
    expect(progress.getAttribute('aria-valuenow')).toBe('100');
    expect(progress.firstElementChild.style.width).toBe('100%');

    rerender(<ProgressBar value={-10} max={0} />);
    expect(progress.getAttribute('aria-valuenow')).toBe('0');
    expect(progress.firstElementChild.style.width).toBe('0%');
  });
});
