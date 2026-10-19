import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import RangeInput from './RangeInput';

describe('RangeInput UI primitive', () => {
  it('renders a configurable range input', () => {
    render(<RangeInput aria-label="Threshold" min={0} max={100} step={5} value={25} readOnly />);
    const input = screen.getByRole('slider', { name: 'Threshold' });

    expect(input.getAttribute('type')).toBe('range');
    expect(input.getAttribute('min')).toBe('0');
    expect(input.getAttribute('max')).toBe('100');
    expect(input.getAttribute('step')).toBe('5');
    expect(input.value).toBe('25');
  });
});
