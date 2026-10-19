import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import PageContainer from './PageContainer';

describe('PageContainer', () => {
  it('applies page width, alignment and spacing without adding gutters', () => {
    render(
      <PageContainer maxWidth="wide" centered spacing="lg" as="main" data-testid="page">
        Content
      </PageContainer>,
    );

    const page = screen.getByTestId('page');
    expect(page.tagName).toBe('MAIN');
    expect(page.className).toContain('max-w-4xl');
    expect(page.className).toContain('mx-auto');
    expect(page.className).toContain('space-y-6');
    expect(page.className).not.toContain('px-');
  });
});
