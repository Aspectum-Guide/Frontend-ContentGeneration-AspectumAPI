import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import PageActionBar from './PageActionBar';
import { orderActions } from './pageActions';

const make = (label, extra = {}) => ({ id: label, label, onClick: vi.fn(), ...extra });

describe('PageActionBar', () => {
  it('renders nothing without actions', () => {
    const { container } = render(<PageActionBar actions={[]} onRefresh={() => {}} />);
    expect(container.firstChild).toBeNull();
  });

  it('puts primary actions first and runs the clicked action', () => {
    const secondary = make('Через сессию', { variant: 'secondary' });
    const primary = make('Создать город', { variant: 'primary' });
    render(<PageActionBar actions={[secondary, primary]} />);

    const labels = screen.getAllByRole('button').map((button) => button.textContent);
    expect(labels).toEqual(['Создать город', 'Через сессию']);
    fireEvent.click(screen.getByRole('button', { name: 'Создать город' }));
    expect(primary.onClick).toHaveBeenCalledTimes(1);
    expect(secondary.onClick).not.toHaveBeenCalled();
  });

  it('keeps registration order for non-primary actions', () => {
    const list = [make('b'), make('a', { variant: 'primary' }), make('c')];
    expect(orderActions(list).map((a) => a.label)).toEqual(['a', 'b', 'c']);
  });

  it('moves actions beyond maxInline into the "Ещё" menu', () => {
    const actions = [make('Один'), make('Два'), make('Три')];
    render(<PageActionBar actions={actions} maxInline={1} />);

    expect(screen.getByRole('button', { name: 'Один' })).toBeTruthy();
    expect(screen.queryByRole('menuitem')).toBeNull();

    const more = screen.getByRole('button', { name: /Ещё/ });
    expect(more.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(more);
    expect(more.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual(['Два', 'Три']);

    fireEvent.click(screen.getByRole('menuitem', { name: 'Три' }));
    expect(actions[2].onClick).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menuitem')).toBeNull();
  });

  it('closes the menu on Escape and on an outside click', () => {
    render(
      <div>
        <span>outside</span>
        <PageActionBar actions={[make('Один'), make('Два')]} maxInline={1} />
      </div>
    );
    fireEvent.click(screen.getByRole('button', { name: /Ещё/ }));
    expect(screen.getByRole('menuitem', { name: 'Два' })).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menuitem')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /Ещё/ }));
    fireEvent.mouseDown(screen.getByText('outside'));
    expect(screen.queryByRole('menuitem')).toBeNull();
  });

  it('does not run disabled actions', () => {
    const disabled = make('Сохранить', { disabled: true });
    render(<PageActionBar actions={[disabled]} />);
    const button = screen.getByRole('button', { name: 'Сохранить' });
    expect(button.hasAttribute('disabled')).toBe(true);
    fireEvent.click(button);
    expect(disabled.onClick).not.toHaveBeenCalled();
  });

  it('offers a refresh button when given a handler', () => {
    const onRefresh = vi.fn();
    render(<PageActionBar actions={[make('Один')]} onRefresh={onRefresh} />);
    fireEvent.click(screen.getByRole('button', { name: 'Обновить страницу' }));
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });
});
