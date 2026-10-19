import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import Card from './Card';
import Checkbox from './Checkbox';
import DetailHeader from './DetailHeader';
import ErrorState from './ErrorState';
import EmptyState from './EmptyState';
import { Field, TextInput } from './FormField';
import FormLabel from './FormLabel';
import HeroHeader from './HeroHeader';
import InlineState from './InlineState';
import MediaUploadField from './MediaUploadField';
import MetricCard from './MetricCard';
import PageHeader from './PageHeader';
import Panel from './Panel';
import RadioGroup from './RadioGroup';
import SearchSelect from './SearchSelect';
import Spinner from './Spinner';
import Tabs from './Tabs';
import Toast from './Toast';
import Wizard from './Wizard';
import WizardActionFooter from './WizardActionFooter';

describe('core UI primitives', () => {
  it('renders form metadata and native controls', () => {
    render(<Field label="Название" required error="Обязательное поле"><TextInput aria-label="Название" /><Checkbox aria-label="Активно" /></Field>);
    expect(screen.getByText('Обязательное поле')).toBeTruthy();
    expect(screen.getByRole('textbox', { name: 'Название' })).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: 'Активно' })).toBeTruthy();
  });

  it('keeps native label behavior for composite controls', () => {
    render(<FormLabel layout="row" size="sm" tone="strong" interactive unselectable><Checkbox aria-label="Показывать" /> Показывать</FormLabel>);
    const label = screen.getByText('Показывать').closest('label');
    expect(screen.getByRole('checkbox', { name: 'Показывать' })).toBeTruthy();
    expect(label.className).toContain('flex items-center gap-2');
    expect(label.className).toContain('cursor-pointer');
  });

  it('associates field labels, hints, and errors with controls', () => {
    const { rerender } = render(<Field label="Город" hint="Начните вводить"><TextInput /></Field>);
    const input = screen.getByRole('textbox', { name: 'Город' });
    expect(input.getAttribute('aria-describedby')).toBe(screen.getByText('Начните вводить').id);
    expect(input.getAttribute('aria-invalid')).toBeNull();

    rerender(<Field label="Город" error="Обязательное поле" required><TextInput /></Field>);
    const invalidInput = screen.getByRole('textbox', { name: 'Город' });
    expect(invalidInput.getAttribute('aria-describedby')).toBe(screen.getByRole('alert').id);
    expect(invalidInput.getAttribute('aria-invalid')).toBe('true');
    expect(invalidInput.getAttribute('aria-required')).toBe('true');
  });

  it('renders layout surfaces and page actions', () => {
    const onCreate = vi.fn();
    render(<><Card>Карточка</Card><MetricCard label="Всего" value="42" sub="за день" /><Panel tone="info">Панель</Panel><PageHeader title="Каталог" createLabel="Создать" onCreate={onCreate} /></>);
    fireEvent.click(screen.getByRole('button', { name: 'Создать' }));
    expect(onCreate).toHaveBeenCalledOnce();
    expect(screen.getByText('Карточка')).toBeTruthy();
    expect(screen.getByText('42')).toBeTruthy();
  });

  it('renders specialized headers through reusable slots', () => {
    render(
      <>
        <HeroHeader title="404" description="Страница не найдена" actions={<button>На главную</button>} />
        <DetailHeader
          leading={<button aria-label="Назад">←</button>}
          title="Сессия"
          titleAdornment={<span>Черновик</span>}
          metadata={<span>18.10.2026</span>}
          status={<span>Сохранено</span>}
          actions={<button>Сохранить</button>}
        />
      </>,
    );

    expect(screen.getByRole('heading', { name: '404' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Сессия' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Назад' })).toBeTruthy();
    expect(screen.getByText('Сохранено')).toBeTruthy();
  });

  it('renders a critical error state with diagnostics and recovery actions', () => {
    render(<ErrorState title="Ошибка" description="Повторите попытку" details="boom" actions={<button>Повторить</button>} />);
    expect(screen.getByRole('heading', { name: 'Ошибка' })).toBeTruthy();
    expect(screen.getByText('boom')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Повторить' })).toBeTruthy();
  });

  it('renders empty-state tone, custom icon and actions', () => {
    render(<EmptyState icon={<span>!</span>} title="Нет доступа" tone="danger" actions={<button>Выйти</button>} />);
    expect(screen.getByText('Нет доступа').className).toContain('text-aspectum-danger');
    expect(screen.getByRole('button', { name: 'Выйти' })).toBeTruthy();
  });

  it('renders compact loading and table states', () => {
    const { rerender } = render(<InlineState loading size="xs">Загрузка…</InlineState>);
    expect(screen.getByRole('status').textContent).toContain('Загрузка…');

    rerender(<table><tbody><tr><InlineState as="td" colSpan={2} align="center">Ничего не найдено</InlineState></tr></tbody></table>);
    expect(screen.getByRole('cell').getAttribute('colspan')).toBe('2');
  });

  it('changes radio and tab selection', () => {
    const onRadio = vi.fn();
    const onTab = vi.fn();
    render(<><RadioGroup name="mode" value="a" onChange={onRadio} options={[{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }]} /><Tabs value="one" onChange={onTab} items={[{ id: 'one', label: 'Один' }, { id: 'two', label: 'Два' }]} /></>);
    fireEvent.click(screen.getByRole('radio', { name: 'B' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Два' }));
    expect(onRadio).toHaveBeenCalledWith('b');
    expect(onTab).toHaveBeenCalledWith('two');
  });

  it('moves between tabs with arrow keys', () => {
    const onTab = vi.fn();
    render(<Tabs value="one" onChange={onTab} items={[{ id: 'one', label: 'Один' }, { id: 'disabled', label: 'Недоступен', disabled: true }, { id: 'three', label: 'Три' }]} />);

    const firstTab = screen.getByRole('tab', { name: 'Один' });
    firstTab.focus();
    fireEvent.keyDown(firstTab, { key: 'ArrowRight' });

    expect(onTab).toHaveBeenCalledWith('three');
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'Три' }));
  });

  it('searches and selects an option', () => {
    const onChange = vi.fn();
    const onSelect = vi.fn();
    render(<SearchSelect value="мо" onChange={onChange} onSelect={onSelect} options={[{ id: 1, label: 'Москва' }]} />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'моск' } });
    fireEvent.click(screen.getByText('Москва'));
    expect(onChange).toHaveBeenCalledWith('моск');
    expect(onSelect).toHaveBeenCalledWith({ id: 1, label: 'Москва' });
  });

  it('renders feedback and wizard actions', () => {
    const next = vi.fn();
    render(<><Spinner /><Toast note={{ type: 'success', msg: 'Готово' }} /><Wizard steps={[1, 2]} currentStep={1} onNext={next} /><WizardActionFooter><span>Действия</span></WizardActionFooter></>);
    fireEvent.click(screen.getByRole('button', { name: 'Далее' }));
    expect(next).toHaveBeenCalledOnce();
    expect(screen.getAllByRole('status')).toHaveLength(2);
    expect(screen.getByText('Действия')).toBeTruthy();
  });

  it('handles media removal', () => {
    const onRemove = vi.fn();
    render(<MediaUploadField previewUrl="/photo.jpg" alt="Фото" onRemove={onRemove} />);
    fireEvent.click(screen.getByRole('button', { name: 'Убрать' }));
    expect(onRemove).toHaveBeenCalledOnce();
    expect(screen.getByRole('img', { name: 'Фото' })).toBeTruthy();
  });
});
