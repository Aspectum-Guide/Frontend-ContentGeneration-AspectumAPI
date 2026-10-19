import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import FormGrid from './FormGrid';
import formGridClassName from './formGridStyles';

describe('FormGrid', () => {
  it('creates a responsive field grid by default', () => {
    render(<FormGrid columns={3} data-testid="grid"><span>Field</span></FormGrid>);
    expect(screen.getByTestId('grid').className).toContain('grid-cols-1');
    expect(screen.getByTestId('grid').className).toContain('md:grid-cols-3');
  });

  it('supports a fixed grid for compact paired fields', () => {
    render(<FormGrid responsive={false} data-testid="grid"><span>Field</span></FormGrid>);
    expect(screen.getByTestId('grid').className).toContain('grid-cols-2');
    expect(screen.getByTestId('grid').className).not.toContain('md:grid-cols-2');
  });

  it('shares the same layout contract with existing containers', () => {
    expect(formGridClassName({ columns: 3 })).toBe('grid grid-cols-1 md:grid-cols-3 gap-3');
    expect(formGridClassName({ responsive: false })).toBe('grid grid-cols-2 gap-3');
  });
});
