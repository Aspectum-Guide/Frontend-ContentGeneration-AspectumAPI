import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import SearchSelect from './SearchSelect';

const options = [
  { id: 1, label: 'Первый' },
  { id: 2, label: 'Недоступный' },
  { id: 3, label: 'Третий' },
];

describe('SearchSelect', () => {
  it('exposes combobox semantics and selects with the keyboard', () => {
    const onSelect = vi.fn();
    render(
      <SearchSelect
        ariaLabel="Поиск события"
        value="со"
        options={options}
        isOptionDisabled={(option) => option.id === 2}
        onSelect={onSelect}
      />
    );

    const input = screen.getByRole('combobox', { name: 'Поиск события' });
    expect(input.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('listbox')).toBeTruthy();

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(screen.getByRole('option', { name: 'Третий' }).getAttribute('aria-selected')).toBe('true');

    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onSelect).toHaveBeenCalledWith(options[2]);
    expect(input.getAttribute('aria-expanded')).toBe('false');
  });

  it('closes results with Escape and reopens them on focus', () => {
    render(<SearchSelect value="со" options={options} />);
    const input = screen.getByRole('combobox');

    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).toBeNull();

    fireEvent.focus(input);
    expect(screen.getByRole('listbox')).toBeTruthy();
  });
});
