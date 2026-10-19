import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import FileDropzone from './FileDropzone';

describe('FileDropzone UI primitive', () => {
  it('forwards selected files through the shared callback', () => {
    const onFiles = vi.fn();
    const { container } = render(
      <FileDropzone onFiles={onFiles}>Выбрать файл</FileDropzone>,
    );
    const input = container.querySelector('input[type="file"]');
    const file = new File(['{}'], 'session.json', { type: 'application/json' });

    fireEvent.change(input, { target: { files: [file] } });

    expect(onFiles).toHaveBeenCalledWith([file], expect.anything());
    expect(screen.getByRole('button', { name: 'Выбрать файл' })).toBeTruthy();
  });

  it('accepts dropped files', () => {
    const onFiles = vi.fn();
    const { container } = render(<FileDropzone onFiles={onFiles}>Drop</FileDropzone>);
    const file = new File(['{}'], 'session.json', { type: 'application/json' });

    fireEvent.drop(container.firstChild, { dataTransfer: { files: [file] } });

    expect(onFiles).toHaveBeenCalledWith([file], expect.anything());
  });
});
