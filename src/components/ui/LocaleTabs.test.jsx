import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import LocaleTabs from './LocaleTabs';

const options = [
  { code: 'ru', label: 'Русский', flag: '🇷🇺' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
];

describe('LocaleTabs', () => {
  it('switches the active locale', () => {
    const onSwitch = vi.fn();
    render(<LocaleTabs active="ru" onSwitch={onSwitch} langOptions={options} />);

    fireEvent.click(screen.getByText('English'));

    expect(onSwitch).toHaveBeenCalledWith('en');
  });

  it('adds a selected available locale', () => {
    const onAddLang = vi.fn();
    const onSwitch = vi.fn();
    render(<LocaleTabs active="ru" onSwitch={onSwitch} onAddLang={onAddLang} langOptions={options.slice(0, 1)} availableLangs={['ru', 'de']} />);

    fireEvent.click(screen.getByText('+ Язык'));
    fireEvent.click(screen.getByText('Добавить'));

    expect(onAddLang).toHaveBeenCalledWith('de');
    expect(onSwitch).toHaveBeenCalledWith('de');
  });

  it('adds a normalized custom locale', () => {
    const onAddLang = vi.fn();
    const onSwitch = vi.fn();
    render(<LocaleTabs active="ru" onSwitch={onSwitch} onAddLang={onAddLang} langOptions={options.slice(0, 1)} availableLangs={['ru']} />);

    fireEvent.click(screen.getByText('+ Язык'));
    fireEvent.change(screen.getByLabelText('Новый язык'), { target: { value: 'custom' } });
    fireEvent.change(screen.getByLabelText('Код языка'), { target: { value: ' PT-br ' } });
    fireEvent.click(screen.getByText('Добавить'));

    expect(onAddLang).toHaveBeenCalledWith('ptbr');
    expect(onSwitch).toHaveBeenCalledWith('ptbr');
  });

  it('removes a locale without switching its tab', () => {
    const onRemoveLang = vi.fn();
    const onSwitch = vi.fn();
    render(<LocaleTabs active="ru" onSwitch={onSwitch} onRemoveLang={onRemoveLang} langOptions={options} />);

    fireEvent.click(screen.getByRole('button', { name: 'Удалить язык English' }));

    expect(onRemoveLang).toHaveBeenCalledWith('en');
    expect(onSwitch).not.toHaveBeenCalled();
  });

  it('moves between locale tabs with arrow keys', () => {
    const onSwitch = vi.fn();
    render(<LocaleTabs active="ru" onSwitch={onSwitch} langOptions={options} />);

    fireEvent.keyDown(screen.getByRole('tab', { name: /Русский/ }), { key: 'ArrowRight' });

    expect(onSwitch).toHaveBeenCalledWith('en');
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: /English/ }));
  });
});
