import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import BusyOverlay from './BusyOverlay';

describe('BusyOverlay', () => {
  it('renders nothing while closed', () => {
    render(<BusyOverlay open={false} label="Подготовка" />);
    expect(screen.queryByText('Подготовка')).toBeNull();
  });

  it('portals an accessible blocking status while open', () => {
    render(<BusyOverlay open label="Подготовка" priority />);
    expect(screen.getByRole('status').textContent).toContain('Подготовка');
    expect(document.body.style.overflow).toBe('hidden');
  });
});
