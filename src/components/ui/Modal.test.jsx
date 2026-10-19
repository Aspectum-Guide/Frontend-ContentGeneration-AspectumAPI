import { fireEvent, render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import Modal from './Modal';

describe('Modal', () => {
  it('renders nothing while closed', () => {
    render(<Modal open={false} title="Скрыто">Контент</Modal>);
    expect(screen.queryByText('Скрыто')).toBeNull();
  });

  it('renders content and closes from the close action', () => {
    const onClose = vi.fn();
    render(<Modal open onClose={onClose} title="Заголовок">Контент</Modal>);
    expect(screen.getByRole('dialog', { name: 'Заголовок' })).toBeTruthy();
    expect(screen.getByText('Контент')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Закрыть' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('traps focus and restores it after closing', () => {
    const { rerender } = render(
      <><button type="button">Открыть</button><Modal open={false} title="Форма">Контент</Modal></>,
    );
    const trigger = screen.getByRole('button', { name: 'Открыть' });
    trigger.focus();

    rerender(
      <><button type="button">Открыть</button><Modal open title="Форма"><button type="button">Первый</button><button type="button">Последний</button></Modal></>,
    );
    const first = screen.getByRole('button', { name: 'Первый' });
    const last = screen.getByRole('button', { name: 'Последний' });
    expect(document.activeElement).toBe(first);

    last.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(first);
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(last);

    rerender(
      <><button type="button">Открыть</button><Modal open={false} title="Форма">Контент</Modal></>,
    );
    expect(document.activeElement).toBe(trigger);
  });

  it('handles Escape only in the topmost modal', () => {
    const closeParent = vi.fn();
    const closeChild = vi.fn();
    render(
      <>
        <Modal open onClose={closeParent} title="Родитель">Контент</Modal>
        <Modal open onClose={closeChild} title="Подтверждение" priority>Контент</Modal>
      </>,
    );

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(closeChild).toHaveBeenCalledOnce();
    expect(closeParent).not.toHaveBeenCalled();
  });

  it('stops handling Escape when closing becomes disabled', () => {
    const onClose = vi.fn();
    const { rerender } = render(<Modal open onClose={onClose} title="Сохранение">Контент</Modal>);
    rerender(<Modal open onClose={undefined} title="Сохранение">Контент</Modal>);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('supports a fixed toolbar and an externally controlled scroll body', () => {
    const bodyRef = createRef();
    render(
      <Modal
        open
        title="Библиотека"
        description="Выберите изображение"
        toolbar={<button type="button">Найти</button>}
        bodyRef={bodyRef}
        bodyClassName="p-4"
      >
        Результаты
      </Modal>,
    );

    expect(screen.getByText('Выберите изображение')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Найти' })).toBeTruthy();
    expect(screen.getByText('Результаты')).toBeTruthy();
    expect(bodyRef.current?.classList.contains('overflow-y-auto')).toBe(true);
    expect(bodyRef.current?.classList.contains('p-4')).toBe(true);
  });
});
