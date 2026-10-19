import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import LoadingOverlay from './LoadingOverlay';

describe('LoadingOverlay', () => {
  it('shows label only while loading', () => {
    const { rerender } = render(<LoadingOverlay loading>Контент</LoadingOverlay>);
    expect(screen.getByText('Загрузка…')).toBeTruthy();
    rerender(<LoadingOverlay>Контент</LoadingOverlay>);
    expect(screen.queryByText('Загрузка…')).toBeNull();
  });
});
