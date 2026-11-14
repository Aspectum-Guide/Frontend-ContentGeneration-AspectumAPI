/**
 * Общий компонент для полей форм.
 * Используется в модальных окнах и страницах редактирования.
 */
import {
  Field,
  FormActions,
  Select,
  Textarea,
  TextInput,
} from '@aspectum/admin-ui-web';

export { Field, FormActions, Select, Textarea, TextInput };

const MULTILANG_DEFAULT_LANGS = ['ru'];

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
  const fromKeys = Object.keys(value || {}).filter(
    (lang) => typeof lang === 'string' && lang.trim(),
  );
  const resolvedLangs =
    Array.isArray(langs) && langs.length > 0
      ? langs
      : fromKeys;

  const effectiveLangs =
    resolvedLangs.length > 0 ? resolvedLangs : MULTILANG_DEFAULT_LANGS;

  const handleChange = (lang, val) => {
    onChange?.({ ...value, [lang]: val });
  };

  return (
    <div className="space-y-2">
      {label && (
        <div className="block text-sm font-medium text-aspectum-text">
          {label}
          {required && <span className="text-aspectum-danger ml-0.5">*</span>}
        </div>
      )}
      {effectiveLangs.map((lang) => (
        <div key={lang} className="flex flex-col sm:flex-row gap-2 sm:items-start">
          <span className="shrink-0 w-fit sm:w-8 mt-1 sm:mt-2 text-xs font-semibold text-aspectum-text-muted uppercase">
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
