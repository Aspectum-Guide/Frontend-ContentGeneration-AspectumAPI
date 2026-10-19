import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import Switch from './Switch';

describe('Switch', () => {
  it('toggles through onChange', () => {
    const onChange = vi.fn();
    render(<Switch checked={false} onChange={onChange} aria-label="Публикация" />);
    fireEvent.click(screen.getByRole('switch', { name: 'Публикация' }));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('does not toggle while disabled', () => {
    const onChange = vi.fn();
    render(<Switch checked={false} disabled onChange={onChange} aria-label="Публикация" />);
    fireEvent.click(screen.getByRole('switch', { name: 'Публикация' }));
    expect(onChange).not.toHaveBeenCalled();
  });
});
