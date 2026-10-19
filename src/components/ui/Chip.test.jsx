import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import Chip from './Chip';

describe('Chip UI primitive', () => {
  it('supports selectable state and keyboard activation', () => {
    const onClick = vi.fn();
    render(<Chip selected onClick={onClick}>Москва</Chip>);
    const chip = screen.getByRole('button', { name: 'Москва' });
    expect(chip.getAttribute('aria-pressed')).toBe('true');
    chip.focus();
    chip.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('supports a removable chip without triggering selection', () => {
    const onClick = vi.fn();
    const onRemove = vi.fn();
    render(<Chip onClick={onClick} onRemove={onRemove} removable>Тег</Chip>);
    screen.getByRole('button', { name: 'Удалить' }).click();
    expect(onRemove).toHaveBeenCalledTimes(1);
    expect(onClick).not.toHaveBeenCalled();
  });
});
