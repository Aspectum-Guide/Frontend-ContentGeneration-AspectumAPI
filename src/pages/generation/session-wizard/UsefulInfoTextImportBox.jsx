import { useState } from 'react';
import { Alert, Button, Panel, Select, Textarea } from '@aspectum/admin-ui-web';
import { useAppLanguages } from '../../../hooks/useAppLanguages';

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
  const { languages: appLanguages } = useAppLanguages();
  const languageOptions = appLanguages.map((language) => ({
    value: language.code,
    label: `${language.label || language.name || language.code} (${language.code})`,
  }));
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
    <Panel className="p-3 space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-medium text-aspectum-text-emphasis">{title}</p>
          <p className="mt-0.5 text-[11px] leading-snug text-aspectum-text-muted">
            {description}
          </p>
        </div>

        <Select className="sm:w-44 bg-aspectum-surface disabled:bg-aspectum-surface-subtle" value={language} onChange={(e) => setLanguage(e.target.value)} disabled={disabled || busy}>
          {languageOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </div>

      <Textarea className="disabled:bg-aspectum-surface-subtle" rows={5} value={text} onChange={(e) => setText(e.target.value)} disabled={disabled || busy} placeholder={placeholder} />

      {error ? (
        <Alert tone="error" className="text-xs">{error}</Alert>
      ) : null}

      <Button
        type="button"
        onClick={handleImport}
        disabled={disabled || busy || !text.trim()}
        variant="softStrong"
        size="sm"
        className="w-fit"
      >
        {busy ? 'Создание...' : buttonLabel}
      </Button>
    </Panel>
  );
}
