import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import LocaleField from './LocaleField';

describe('LocaleField', () => {
  it('renders and updates the active locale value', () => {
    const onChange = vi.fn();
    render(<LocaleField label="Название" activeLocale="ru" value={{ ru: 'Москва' }} onChange={onChange} />);

    fireEvent.change(screen.getByDisplayValue('Москва'), { target: { value: 'Казань' } });

    expect(onChange).toHaveBeenCalledWith({ ru: 'Казань' });
  });

  it('renders a textarea for multiline fields', () => {
    render(<LocaleField label="Описание" activeLocale="en" value={{ en: '' }} onChange={vi.fn()} multiline rows={5} />);

    expect(screen.getByPlaceholderText('Описание (en)').tagName).toBe('TEXTAREA');
  });
});
