/**
 * Общий компонент для полей форм.
 * Используется в модальных окнах и страницах редактирования.
 */

/** Простое поле ввода с лейблом и ошибкой */
export function Field({ label, error, hint, children, required }) {
  return (
    <div>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}
      {children}
      {hint && !error && (
        <p className="mt-1 text-xs text-gray-400">{hint}</p>
      )}
      {error && (
        <p className="mt-1 text-xs text-red-600">{error}</p>
      )}
    </div>
  );
}

/** Стилизованный <input> */
export function TextInput({ className = '', ...props }) {
  return (
    <input
      {...props}
      className={`w-full px-3 py-2 border border-gray-300 rounded-lg text-base sm:text-sm min-h-[44px] focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none disabled:bg-gray-50 disabled:text-gray-500 ${className}`}
    />
  );
}

/** Стилизованный <textarea> */
export function Textarea({ className = '', rows = 3, ...props }) {
  return (
    <textarea
      rows={rows}
      {...props}
      className={`w-full px-3 py-2 border border-gray-300 rounded-lg text-base sm:text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none disabled:bg-gray-50 ${className}`}
    />
  );
}

/** Стилизованный <select> */
export function Select({ className = '', children, ...props }) {
  return (
    <select
      {...props}
      className={`w-full px-3 py-2 border border-gray-300 rounded-lg text-base sm:text-sm min-h-[44px] focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none disabled:bg-gray-50 ${className}`}
    >
      {children}
    </select>
  );
}

/**
 * Мультиязычное текстовое поле (ru/en/it).
 *
 * Props:
 *   label   — string
 *   value   — { ru?: string, en?: string, it?: string, ... }
 *   onChange — (newValue: object) => void
 *   langs   — string[] (default ['ru', 'en', 'it'])
 *   multiline — boolean
 *   rows    — number (for multiline)
 *   disabled — boolean
 */
export function MultiLangField({
  label,
  value = {},
  onChange,
  langs,
  multiline = false,
  rows = 3,
  disabled = false,
  required = false,
}) {
  const effectiveLangs =
    Array.isArray(langs) && langs.length > 0
      ? langs
      : Object.keys(value || {}).filter((lang) => typeof lang === 'string' && lang.trim());

  const handleChange = (lang, val) => {
    onChange?.({ ...value, [lang]: val });
  };

  return (
    <div className="space-y-2">
      {label && (
        <label className="block text-sm font-medium text-gray-700">
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}
      {effectiveLangs.map((lang) => (
        <div key={lang} className="flex flex-col sm:flex-row gap-2 sm:items-start">
          <span className="shrink-0 w-fit sm:w-8 mt-1 sm:mt-2 text-xs font-semibold text-gray-400 uppercase">
            {lang}
          </span>
          {multiline ? (
            <Textarea
              value={value?.[lang] || ''}
              onChange={(e) => handleChange(lang, e.target.value)}
              rows={rows}
              disabled={disabled}
              placeholder={`${label || 'Значение'} (${lang})`}
            />
          ) : (
            <TextInput
              value={value?.[lang] || ''}
              onChange={(e) => handleChange(lang, e.target.value)}
              disabled={disabled}
              placeholder={`${label || 'Значение'} (${lang})`}
            />
          )}
        </div>
      ))}
    </div>
  );
}

/**
 * Кнопки действий формы (Save / Cancel).
 */
export function FormActions({ onSave, onCancel, saving, saveLabel = 'Сохранить', cancelLabel = 'Отмена', saveVariant = 'primary' }) {
  const saveClass = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700',
    danger: 'bg-red-600 text-white hover:bg-red-700',
    success: 'bg-green-600 text-white hover:bg-green-700',
  }[saveVariant] || 'bg-blue-600 text-white hover:bg-blue-700';

  return (
    <div className="flex flex-col sm:flex-row gap-3 pt-2">
      <button
        type={onSave ? 'button' : 'submit'}
        onClick={onSave}
        disabled={saving}
        className={`flex-1 min-h-[44px] py-2.5 text-base sm:text-sm font-medium rounded-lg transition-colors disabled:opacity-50 ${saveClass}`}
      >
        {saving ? (
          <span className="flex items-center justify-center gap-2">
            <span className="animate-spin w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full inline-block" />
            Сохранение...
          </span>
        ) : saveLabel}
      </button>
      {onCancel && (
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="flex-1 min-h-[44px] py-2.5 text-base sm:text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
        >
          {cancelLabel}
        </button>
      )}
    </div>
  );
}
