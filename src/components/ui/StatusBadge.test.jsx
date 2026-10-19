import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import StatusBadge from './StatusBadge';

describe('StatusBadge', () => {
  it('renders a session status label', () => {
    render(<StatusBadge status="completed" />);
    expect(screen.getByText('Завершена')).toBeTruthy();
  });

  it('renders active and inactive labels', () => {
    const { rerender } = render(<StatusBadge active activeLabel="Включен" inactiveLabel="Выключен" />);
    expect(screen.getByText('Включен')).toBeTruthy();
    rerender(<StatusBadge active={false} activeLabel="Включен" inactiveLabel="Выключен" />);
    expect(screen.getByText('Выключен')).toBeTruthy();
  });

  it('renders a generic semantic tone', () => {
    render(<StatusBadge tone="warning" label="Требует внимания" />);
    expect(screen.getByText('Требует внимания').className).toContain('bg-aspectum-warning-muted');
  });
});
