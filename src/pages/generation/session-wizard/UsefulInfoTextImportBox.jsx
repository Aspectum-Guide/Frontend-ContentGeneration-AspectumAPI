import { useState } from 'react';

const LANGUAGE_OPTIONS = [
  { value: 'ru', label: 'Русский (ru)' },
  { value: 'en', label: 'English (en)' },
  { value: 'it', label: 'Italiano (it)' },
  { value: 'fr', label: 'Français (fr)' },
  { value: 'de', label: 'Deutsch (de)' },
  { value: 'es', label: 'Español (es)' },
];

export default function UsefulInfoTextImportBox({
  title = 'Вставить готовую полезную информацию',
  description = 'Строки с «# Заголовок» станут отдельными блоками, а текст под каждым заголовком — описанием блока.',
  buttonLabel = 'Создать блоки из текста',
  placeholder = '# Как добраться\nТекст первого блока…\n\n# Билеты\nТекст второго блока…',
  emptyError = 'Не удалось распознать блоки. Заголовки должны начинаться с «#».',
  errorFallback = 'Не удалось создать блоки',
  defaultLanguage = 'ru',
  disabled = false,
  onImport,
}) {
  const [text, setText] = useState('');
  const [language, setLanguage] = useState(defaultLanguage || 'ru');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const handleImport = async () => {
    const raw = text.trim();
    if (!raw || busy || disabled) return;

    setBusy(true);
    setError('');

    try {
      const count = await onImport?.(language, raw);

      if (!count) {
        setError(emptyError);
        return;
      }

      setText('');
    } catch (err) {
      setError(err?.message || errorFallback);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3 space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-medium text-gray-800">{title}</p>
          <p className="mt-0.5 text-[11px] leading-snug text-gray-500">
            {description}
          </p>
        </div>

        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          disabled={disabled || busy}
          className="w-full sm:w-44 px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
        >
          {LANGUAGE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <textarea
        rows={5}
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={disabled || busy}
        placeholder={placeholder}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 resize-y"
      />

      {error ? (
        <p className="text-xs text-red-600">{error}</p>
      ) : null}

      <button
        type="button"
        onClick={handleImport}
        disabled={disabled || busy || !text.trim()}
        className="w-fit px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-100 border border-blue-200 rounded-lg hover:bg-blue-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {busy ? 'Создание...' : buttonLabel}
      </button>
    </div>
  );
}
