import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import MediaPreview from './MediaPreview';

describe('MediaPreview', () => {
  it('renders image and overlay content', () => {
    render(<MediaPreview src="/cover.jpg" alt="Обложка"><button type="button">Удалить</button></MediaPreview>);
    expect(screen.getByRole('img', { name: 'Обложка' }).getAttribute('src')).toBe('/cover.jpg');
    expect(screen.getByRole('button', { name: 'Удалить' })).toBeTruthy();
  });

  it('renders placeholder without source', () => {
    render(<MediaPreview placeholder="Нет фото" />);
    expect(screen.getByText('Нет фото')).toBeTruthy();
  });
});
