import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Alert from './Alert';

describe('Alert', () => {
  it('renders content for each supported tone', () => {
    for (const tone of ['error', 'warning', 'success', 'info']) {
      const { unmount } = render(<Alert tone={tone}>Сообщение</Alert>);
      expect(screen.getByText('Сообщение')).toBeTruthy();
      unmount();
    }
  });
});
