import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import SectionHeader from './SectionHeader';

describe('SectionHeader', () => {
  it('renders semantic heading, description and slots', () => {
    render(<SectionHeader headingId="section-title" level={3} size="sm" title="Секция" description="Описание" icon={<span>Иконка</span>} aside={<span>3</span>} actions={<button type="button">Добавить</button>} />);
    expect(screen.getByRole('heading', { level: 3, name: 'Секция' }).id).toBe('section-title');
    expect(screen.getByText('Описание')).toBeTruthy();
    expect(screen.getByText('Иконка')).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Добавить' })).toBeTruthy();
  });
});
