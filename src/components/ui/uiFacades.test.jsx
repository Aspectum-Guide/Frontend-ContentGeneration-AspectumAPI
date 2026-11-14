import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Button from './Button';
import Modal, { ConfirmModal } from './Modal';
import DataTable from './DataTable';
import Toast from './Toast';
import StatusBadge, { SessionStatusBadge } from './StatusBadge';
import { Field, FormActions, Select, Textarea, TextInput, MultiLangField } from './FormField';
import Input from './Input';
import InlineProgressBanner from './InlineProgressBanner';

describe('UI facades over @aspectum/admin-ui-web', () => {
  it('renders Button correctly and handles click', () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick} variant="primary">Сохранить</Button>);
    const btn = screen.getByRole('button', { name: 'Сохранить' });
    expect(btn).toBeDefined();
    fireEvent.click(btn);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('renders Modal and ConfirmModal properly', () => {
    const handleClose = vi.fn();
    const handleConfirm = vi.fn();
    const { rerender } = render(
      <Modal open={true} onClose={handleClose} title="Тестовое окно">
        <div>Содержимое окна</div>
      </Modal>
    );
    expect(screen.getByText('Тестовое окно')).toBeDefined();
    expect(screen.getByText('Содержимое окна')).toBeDefined();

    rerender(
      <ConfirmModal
        open={true}
        onClose={handleClose}
        onConfirm={handleConfirm}
        title="Подтверждение"
        message="Вы уверены?"
        confirmLabel="Да"
        cancelLabel="Нет"
      />
    );
    expect(screen.getByText('Вы уверены?')).toBeDefined();
    const confirmBtn = screen.getByRole('button', { name: 'Да' });
    fireEvent.click(confirmBtn);
    expect(handleConfirm).toHaveBeenCalledTimes(1);
  });

  it('renders DataTable with rows and columns', () => {
    const columns = [
      { key: 'name', label: 'Название' },
      { key: 'status', label: 'Статус' },
    ];
    const rows = [
      { id: 1, name: 'Москва', status: 'Активен' },
      { id: 2, name: 'Париж', status: 'Черновик' },
    ];
    render(<DataTable title="Города" columns={columns} rows={rows} />);
    expect(screen.getByText('Города')).toBeDefined();
    expect(screen.getAllByText('Москва').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Париж').length).toBeGreaterThan(0);
  });

  it('renders FormField controls and MultiLangField', () => {
    const handleChange = vi.fn();
    render(
      <div>
        <Field label="Имя" error="Обязательное поле">
          <TextInput placeholder="Введите имя" />
        </Field>
        <Select defaultValue="ru">
          <option value="ru">RU</option>
          <option value="en">EN</option>
        </Select>
        <Textarea placeholder="Описание" />
        <FormActions onSave={() => {}} onCancel={() => {}} />
        <MultiLangField
          label="Заголовок"
          value={{ ru: 'Привет', en: 'Hello' }}
          onChange={handleChange}
          langs={['ru', 'en']}
        />
      </div>
    );
    expect(screen.getByText('Имя')).toBeDefined();
    expect(screen.getByText('Обязательное поле')).toBeDefined();
    expect(screen.getByPlaceholderText('Введите имя')).toBeDefined();
    expect(screen.getByText('Сохранить')).toBeDefined();
    expect(screen.getByText('Отмена')).toBeDefined();
    expect(screen.getByDisplayValue('Привет')).toBeDefined();
    expect(screen.getByDisplayValue('Hello')).toBeDefined();
  });

  it('renders Input wrapper with label and error', () => {
    render(<Input label="Логин" error="Неверный логин" defaultValue="user1" />);
    expect(screen.getByText('Логин')).toBeDefined();
    expect(screen.getByText('Неверный логин')).toBeDefined();
    expect(screen.getByDisplayValue('user1')).toBeDefined();
  });

  it('renders StatusBadge and SessionStatusBadge', () => {
    render(
      <div>
        <StatusBadge active={true} activeLabel="Включено" inactiveLabel="Выключено" />
        <SessionStatusBadge status="completed" label="Завершена" />
      </div>
    );
    expect(screen.getByText('Включено')).toBeDefined();
    expect(screen.getByText('Завершена')).toBeDefined();
  });

  it('renders InlineProgressBanner and Toast', () => {
    render(
      <div>
        <InlineProgressBanner show={true} message="Идёт загрузка..." />
        <Toast note={{ type: 'success', msg: 'Данные сохранены' }} />
      </div>
    );
    expect(screen.getByText('Идёт загрузка...')).toBeDefined();
    expect(screen.getByText('Данные сохранены')).toBeDefined();
  });
});
