import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Button from './Button';

describe('Button UI primitive', () => {
  it('defaults to a non-submit button and supports disabled state', () => {
    render(<Button disabled>Save</Button>);
    const button = screen.getByRole('button', { name: 'Save' });

    expect(button.getAttribute('type')).toBe('button');
    expect(button.disabled).toBe(true);
  });

  it('combines size and accent variant classes', () => {
    render(<Button variant="softOrange" size="sm">Translate</Button>);
    const button = screen.getByRole('button', { name: 'Translate' });

    expect(button.className).toContain('text-xs');
    expect(button.className).toContain('bg-aspectum-orange/10');
    expect(button.className).toContain('text-aspectum-orange');
  });

  it('forwards native props and click handler', () => {
    let clicks = 0;
    render(
      <Button type="submit" aria-label="Create" onClick={() => { clicks += 1; }}>
        Create
      </Button>
    );

    const button = screen.getByRole('button', { name: 'Create' });
    button.click();
    expect(button.getAttribute('type')).toBe('submit');
    expect(clicks).toBe(1);
  });
});
