import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Panel from './Panel';

describe('Panel', () => {
  it.each(['accentPurple', 'accentIndigo', 'accentOrange'])('supports %s tone', (tone) => {
    render(<Panel tone={tone}>Контент</Panel>);
    expect(screen.getByText('Контент')).toBeTruthy();
  });

  it('supports semantic radius variants', () => {
    render(<Panel radius="modal">Контент</Panel>);
    expect(screen.getByText('Контент').className).toContain('rounded-aspectum-modal');
  });
});
