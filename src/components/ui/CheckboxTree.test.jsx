import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import CheckboxTree from './CheckboxTree';

const groups = [{ id: 'cities', label: 'Города', items: [{ id: '1', label: 'Москва' }, { id: '2', label: 'Париж' }] }];

describe('CheckboxTree', () => {
  it('shows selected count and selects all items in a group', () => {
    const onToggle = vi.fn();
    render(<CheckboxTree groups={groups} selected={['1']} onToggle={onToggle} showSelectAll showSelectedCount />);
    expect(screen.getByText('1/2')).toBeTruthy();
    screen.getByRole('button', { name: 'Выбрать все элементы группы Города' }).click();
    expect(onToggle).toHaveBeenCalledWith('2');
  });

  it('can collapse a group', async () => {
    render(<CheckboxTree groups={groups} collapsible />);
    fireEvent.click(screen.getByRole('button', { name: /Города/ }));
    await waitFor(() => expect(screen.queryByText('Москва')).toBeNull());
  });
});
