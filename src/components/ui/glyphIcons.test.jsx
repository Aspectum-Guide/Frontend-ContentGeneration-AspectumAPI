import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import EmptyState from './EmptyState';
import { GLYPH_ICONS, Glyph, glyphComponent, normalizeGlyph, renderIcon } from './glyphIcons';

describe('glyph registry', () => {
  it('maps every glyph to a renderable component', () => {
    for (const [glyph, Icon] of Object.entries(GLYPH_ICONS)) {
      expect(Icon, glyph).toBeTruthy();
    }
  });

  it('ignores the emoji variation selector when looking a glyph up', () => {
    expect(normalizeGlyph('🏙️')).toBe('🏙');
    expect(glyphComponent('🏙️')).toBe(GLYPH_ICONS['🏙']);
    expect(glyphComponent('🏙')).toBe(GLYPH_ICONS['🏙']);
  });

  it('only resolves strings it knows', () => {
    expect(glyphComponent('🦄')).toBeNull();
    expect(glyphComponent(null)).toBeNull();
    expect(glyphComponent(<span />)).toBeNull();
  });

  it('keeps national flags as text (they are content, not icons)', () => {
    expect(glyphComponent('🇷🇺')).toBeNull();
    expect(renderIcon('🇷🇺')).toBe('🇷🇺');
  });
});

describe('renderIcon / Glyph', () => {
  it('turns a known glyph into a hidden svg and passes nodes through', () => {
    const { container } = render(<div>{renderIcon('🎧', 'size-8')}</div>);
    const svg = container.querySelector('svg');
    expect(svg).toBeTruthy();
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(svg.getAttribute('class')).toContain('size-8');

    const node = <b data-testid="node">x</b>;
    expect(renderIcon(node)).toBe(node);
  });

  it('Glyph renders an inline icon sized to the text, or the raw text when unknown', () => {
    const known = render(<p><Glyph name="⬇" /> Скачать</p>);
    expect(known.container.querySelector('svg').getAttribute('class')).toContain('size-[1.1em]');
    expect(known.container.textContent).toBe(' Скачать');

    const unknown = render(<p><Glyph name="🦄" /></p>);
    expect(unknown.container.querySelector('svg')).toBeNull();
    expect(unknown.container.textContent).toBe('🦄');
  });
});

describe('EmptyState', () => {
  it('shows a lucide icon for glyph keys and keeps custom nodes', () => {
    const glyph = render(<EmptyState icon="🏙️" title="Пусто" />);
    expect(glyph.container.querySelector('svg')).toBeTruthy();
    expect(glyph.container.textContent).not.toContain('🏙');

    const custom = render(<EmptyState icon={<span data-testid="spinner" />} title="Пусто" />);
    expect(custom.getByTestId('spinner')).toBeTruthy();
    expect(custom.container.querySelector('svg')).toBeNull();
  });
});
