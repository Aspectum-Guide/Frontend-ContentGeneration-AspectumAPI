import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import SidebarActions from './SidebarActions';

describe('SidebarActions', () => {
  it('renders actions and forwards the selected action', () => {
    const onAction = vi.fn();
    const action = { id: 'save', label: 'Save', variant: 'primary' };

    render(<SidebarActions actions={[action]} onAction={onAction} />);
    screen.getByRole('button', { name: 'Save' }).click();

    expect(onAction).toHaveBeenCalledWith(action);
  });

  it('renders an empty state and refresh action', () => {
    const onRefresh = vi.fn();

    render(<SidebarActions actions={[]} onRefresh={onRefresh} emptyText="No actions" />);
    expect(screen.getByText('No actions')).toBeTruthy();
    screen.getByRole('button', { name: 'Обновить страницу' }).click();
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });
});
