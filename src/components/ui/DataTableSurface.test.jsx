import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import DataTableSurface from './DataTableSurface';

describe('DataTableSurface', () => {
  it('provides a scrollable bordered surface', () => {
    render(<DataTableSurface><table><tbody><tr><td>Данные</td></tr></tbody></table></DataTableSurface>);
    const surface = screen.getByText('Данные').closest('div');
    expect(surface.className).toContain('overflow-x-auto');
    expect(surface.className).toContain('border');
  });
});
