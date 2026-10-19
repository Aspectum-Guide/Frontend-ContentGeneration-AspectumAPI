import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import TagPicker from './TagPicker';

describe('TagPicker', () => {
  it('renders options and toggles the selected id', () => {
    const onToggle = vi.fn();
    render(<TagPicker options={[{ id: '1', label: 'Москва' }, { id: '2', label: 'Париж' }]} selected={['1']} onToggle={onToggle} />);
    expect(screen.getByRole('button', { name: 'Москва' }).getAttribute('aria-pressed')).toBe('true');
    screen.getByRole('button', { name: 'Париж' }).click();
    expect(onToggle).toHaveBeenCalledWith('2');
  });
});
