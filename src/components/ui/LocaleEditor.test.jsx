import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import LocaleEditor from './LocaleEditor';

describe('LocaleEditor', () => {
  it('switches between locales', () => {
    const onSwitch = vi.fn();
    render(<LocaleEditor localeData={{ ru: { code: 'RU', langName: 'Русский' }, en: { code: 'GB', langName: 'English' } }} activeLocale="ru" onSwitch={onSwitch} showStatus={false} />);
    fireEvent.click(screen.getByText('English'));
    expect(onSwitch).toHaveBeenCalledWith('en');
  });

  it('moves between locale tabs with arrow keys', () => {
    const onSwitch = vi.fn();
    render(<LocaleEditor localeData={{ ru: { code: 'RU', langName: 'Русский' }, en: { code: 'GB', langName: 'English' } }} activeLocale="ru" onSwitch={onSwitch} showStatus={false} />);

    fireEvent.keyDown(screen.getByRole('tab', { name: /Русский/ }), { key: 'ArrowRight' });

    expect(onSwitch).toHaveBeenCalledWith('en');
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: /English/ }));
  });
});
