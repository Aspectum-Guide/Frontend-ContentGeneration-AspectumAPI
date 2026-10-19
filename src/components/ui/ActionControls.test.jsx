import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import IconButton from './IconButton';
import InlineAction from './InlineAction';

describe('Action controls', () => {
  it('requires and exposes an accessible icon label', () => {
    render(<IconButton label="Закрыть">×</IconButton>);
    const button = screen.getByRole('button', { name: 'Закрыть' });
    expect(button.getAttribute('title')).toBe('Закрыть');
    expect(button.getAttribute('type')).toBe('button');
  });

  it('renders compact inline actions through Button', () => {
    render(<InlineAction>Редактировать</InlineAction>);
    const button = screen.getByRole('button', { name: 'Редактировать' });
    expect(button.className).toContain('text-xs');
    expect(button.className).toContain('text-aspectum-primary');
  });
});
