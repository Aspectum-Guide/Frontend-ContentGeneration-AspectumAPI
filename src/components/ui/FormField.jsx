/**
 * Общий компонент для полей форм.
 * Используется в модальных окнах и страницах редактирования.
 */
import { Children, useId } from 'react';
import Button from './Button';
import { FieldContext, useFieldContextValue } from './FieldContext';
import Spinner from './Spinner';

function joinIds(...values) {
  return values.filter(Boolean).join(' ') || undefined;
}

function useFieldControlProps(props) {
  const field = useFieldContextValue();
  const generatedId = useId();
  const hasExplicitName = Boolean(props['aria-label'] || props['aria-labelledby']);
  return {
    ...props,
    id: props.id || generatedId,
    'aria-labelledby': hasExplicitName ? props['aria-labelledby'] : field?.labelId,
    'aria-describedby': joinIds(props['aria-describedby'], field?.descriptionId),
    'aria-invalid': props['aria-invalid'] ?? (field?.invalid || undefined),
    'aria-required': props['aria-required'] ?? (field?.required || undefined),
  };
}

/** Простое поле ввода с лейблом и ошибкой */
export function Field({ label, error, hint, children, required }) {
  const baseId = useId();
  const labelId = label ? `${baseId}-label` : undefined;
  const hintId = hint && !error ? `${baseId}-hint` : undefined;
  const errorId = error ? `${baseId}-error` : undefined;
  const descriptionId = errorId || hintId;
  const isComposite = Children.count(children) !== 1;

  return (
    <FieldContext.Provider value={{ labelId, descriptionId, invalid: Boolean(error), required: Boolean(required) }}>
    <div
      role={isComposite && label ? 'group' : undefined}
      aria-labelledby={isComposite ? labelId : undefined}
      aria-describedby={isComposite ? descriptionId : undefined}
    >
      {label && (
        <div id={labelId} className="block text-sm font-medium text-aspectum-text mb-1">
          {label}
          {required && <span aria-hidden="true" className="text-aspectum-danger ml-0.5">*</span>}
        </div>
      )}
      {children}
      {hint && !error && (
          <p id={hintId} className="mt-1 text-xs text-aspectum-text-muted">{hint}</p>
      )}
      {error && (
        <p id={errorId} role="alert" className="mt-1 text-xs text-aspectum-danger">{error}</p>
      )}
    </div>
    </FieldContext.Provider>
  );
}

/** Стилизованный <input> */
export function TextInput({ className = '', ...props }) {
  const controlProps = useFieldControlProps(props);
  return (
    <input
      {...controlProps}
      className={`w-full px-3 py-2 border border-aspectum-border rounded-aspectum-control text-base sm:text-sm min-h-[44px] focus:ring-2 focus:ring-aspectum-primary focus:border-transparent outline-none disabled:bg-aspectum-surface-muted disabled:text-aspectum-text-muted ${className}`}
    />
  );
}

/** Стилизованный <textarea> */
export function Textarea({ className = '', rows = 3, ...props }) {
  const controlProps = useFieldControlProps(props);
  return (
    <textarea
      rows={rows}
      {...controlProps}
      className={`w-full px-3 py-2 border border-aspectum-border rounded-aspectum-control text-base sm:text-sm resize-none focus:ring-2 focus:ring-aspectum-primary focus:border-transparent outline-none disabled:bg-aspectum-surface-muted ${className}`}
    />
  );
}

/** Стилизованный <select> */
export function Select({ className = '', children, ...props }) {
  const controlProps = useFieldControlProps(props);
  return (
    <select
      {...controlProps}
      className={`w-full bg-aspectum-surface px-3 py-2 border border-aspectum-border rounded-aspectum-control text-base text-aspectum-text sm:text-sm min-h-[44px] focus:ring-2 focus:ring-aspectum-primary focus:border-transparent outline-none disabled:bg-aspectum-surface-muted ${className}`}
    >
      {children}
    </select>
  );
}

/**
 * Кнопки действий формы (Save / Cancel).
 */
export function FormActions({ onSave, onCancel, saving, saveLabel = 'Сохранить', cancelLabel = 'Отмена', saveVariant = 'primary' }) {
  return (
    <div className="flex flex-col sm:flex-row gap-3 pt-2">
      <Button
        type={onSave ? 'button' : 'submit'}
        onClick={onSave}
        disabled={saving}
        variant={saveVariant}
        size="lg"
        className="flex-1"
      >
        {saving ? (
          <span className="flex items-center justify-center gap-2">
            <Spinner size="sm" className="border-aspectum-on-accent" />
            Сохранение...
          </span>
        ) : saveLabel}
      </Button>
      {onCancel && (
        <Button
          type="button"
          onClick={onCancel}
          disabled={saving}
          variant="secondary"
          size="lg"
          className="flex-1"
        >
          {cancelLabel}
        </Button>
      )}
    </div>
  );
}
