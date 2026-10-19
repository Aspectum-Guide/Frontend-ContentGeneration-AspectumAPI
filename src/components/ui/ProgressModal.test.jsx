import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ProgressModal from './ProgressModal';

describe('ProgressModal UI primitive', () => {
  it('does not render while closed', () => {
    render(<ProgressModal open={false}>Content</ProgressModal>);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('renders content, busy state, progress and footer', () => {
    const onBackdropClick = vi.fn();
    render(
      <ProgressModal open busy busyLabel="Генерация" progress={42} onBackdropClick={onBackdropClick}>
        <span>Content</span>
        <button type="button">Footer</button>
      </ProgressModal>
    );

    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText('Content')).toBeTruthy();
    expect(screen.getByText('Генерация')).toBeTruthy();
    expect(screen.getByText('42%')).toBeTruthy();
  });
});
