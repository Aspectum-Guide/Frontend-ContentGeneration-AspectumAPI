import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import DropdownPanel from './DropdownPanel';

describe('DropdownPanel', () => {
  it('renders content and forwards attributes', () => {
    render(<DropdownPanel data-testid="dropdown"><span>Результаты</span></DropdownPanel>);
    expect(screen.getByTestId('dropdown').textContent).toContain('Результаты');
  });
});
