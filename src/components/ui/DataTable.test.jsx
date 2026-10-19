import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import DataTable from './DataTable';

const columns = [{ key: 'name', label: 'Название' }];

describe('DataTable', () => {
  it('renders empty state when there are no rows', () => {
    render(<DataTable columns={columns} rows={[]} emptyText="Пусто" />);
    expect(screen.getByText('Пусто')).toBeTruthy();
  });

  it('changes page through pagination controls', () => {
    const onPage = vi.fn();
    render(<DataTable columns={columns} rows={[{ id: 1, name: 'Город' }]} page={1} totalCount={21} pageSize={20} onPage={onPage} />);
    fireEvent.click(screen.getByRole('button', { name: '2' }));
    expect(onPage).toHaveBeenCalledWith(2);
  });
});
