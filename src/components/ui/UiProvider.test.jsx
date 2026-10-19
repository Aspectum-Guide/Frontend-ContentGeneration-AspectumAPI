import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import UiProvider from './UiProvider';

describe('UiProvider', () => {
  it('leaves default tokens to the UI kit stylesheet', () => {
    render(
      <UiProvider>
        <span>default content</span>
      </UiProvider>,
    );

    const provider = screen.getByText('default content').parentElement;
    expect(provider.getAttribute('style')).toBeNull();
  });

  it('applies theme overrides as CSS variables', () => {
    render(
      <UiProvider theme={{ colors: { primary: '#7c3aed', surface: '#fefce8', dangerBorder: '#abc' }, radius: { control: '1rem', compact: '0.25rem' }, shadows: { stickyFooter: '0 -2px 4px #0001' }, spacing: { pageX: '2rem' }, layout: { pageY: '3rem', sidebarExpanded: '20rem' } }}>
        <span>content</span>
      </UiProvider>,
    );

    const provider = screen.getByText('content').parentElement;
    expect(provider.style.getPropertyValue('--aspectum-color-primary')).toBe('#7c3aed');
    expect(provider.style.getPropertyValue('--aspectum-radius-control')).toBe('1rem');
    expect(provider.style.getPropertyValue('--aspectum-color-surface')).toBe('#fefce8');
    expect(provider.style.getPropertyValue('--aspectum-layout-sidebar-expanded')).toBe('20rem');
    expect(provider.style.getPropertyValue('--aspectum-color-danger-border')).toBe('#abc');
    expect(provider.style.getPropertyValue('--aspectum-radius-compact')).toBe('0.25rem');
    expect(provider.style.getPropertyValue('--aspectum-shadow-sticky-footer')).toBe('0 -2px 4px #0001');
    expect(provider.style.getPropertyValue('--aspectum-space-page-x')).toBe('2rem');
    expect(provider.style.getPropertyValue('--aspectum-space-page-y')).toBe('3rem');
  });
});
