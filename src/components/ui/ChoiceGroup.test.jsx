import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import SegmentedControl from './SegmentedControl';
import ToggleGroup from './ToggleGroup';

const items = [
  { id: 'one', label: 'Один' },
  { id: 'two', label: 'Два', disabled: true },
  { id: 'three', label: 'Три' },
];

describe('ChoiceGroup compatibility components', () => {
  it('toggles multiple values while preserving their original types', () => {
    const onChange = vi.fn();
    render(<ToggleGroup ariaLabel="Дни" items={[{ id: 1, label: 'Пн' }, { id: 2, label: 'Вт' }]} value={[1]} onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'Вт' }));
    expect(onChange).toHaveBeenCalledWith([1, 2]);

    fireEvent.click(screen.getByRole('button', { name: 'Пн' }));
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('uses radio semantics and skips disabled items with arrow keys', () => {
    const onChange = vi.fn();
    render(<SegmentedControl ariaLabel="Режим" items={items} value="one" onChange={onChange} />);

    const first = screen.getByRole('radio', { name: 'Один' });
    fireEvent.keyDown(first, { key: 'ArrowRight' });

    expect(onChange).toHaveBeenCalledWith('three');
    expect(document.activeElement).toBe(screen.getByRole('radio', { name: 'Три' }));
    expect(screen.getByRole('radiogroup', { name: 'Режим' })).toBeTruthy();
  });
});
