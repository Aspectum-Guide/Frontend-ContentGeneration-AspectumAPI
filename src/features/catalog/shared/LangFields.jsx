import { useEffect, useMemo, useState } from 'react';
import { Select, TextInput, Textarea } from '../../../components/ui/FormField';
import Button from '../../../components/ui/Button';
import { getFilledLangCodes } from './i18n';

const DEFAULT_AVAILABLE_LANGS = ['ru', 'en', 'it', 'fr', 'de', 'es'];

function normalizeLangCode(raw) {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z]/g, '')
    .slice(0, 5);
}

export function LangTabs({
  active,
  onSwitch,
  value = {},
  onChangeValue,
  onAddLang,
  onRemoveLang,
  langOptions = [],
  availableLangs = DEFAULT_AVAILABLE_LANGS,
  allowManage = true,
}) {
  const filled = getFilledLangCodes(value);
  const [adding, setAdding] = useState(false);
  const [newLang, setNewLang] = useState('');

  const existing = useMemo(() => new Set(langOptions.map((x) => x.code)), [langOptions]);
  const candidates = useMemo(
    () => (Array.isArray(availableLangs) ? availableLangs : DEFAULT_AVAILABLE_LANGS).filter((c) => !existing.has(c)),
    [availableLangs, existing]
  );

  const canManage = allowManage && (typeof onChangeValue === 'function' || typeof onAddLang === 'function' || typeof onRemoveLang === 'function');

  useEffect(() => {
    if (active) return;
    if (langOptions.length === 0) return;
    onSwitch?.(langOptions[0].code);
  }, [active, langOptions, onSwitch]);

  const addLang = () => {
    const code = normalizeLangCode(newLang);
    if (!code) return;
    if (existing.has(code)) {
      onSwitch?.(code);
      setAdding(false);
      setNewLang('');
      return;
    }
    if (typeof onAddLang === 'function') {
      onAddLang(code);
    } else {
      onChangeValue?.({ ...(value || {}), [code]: value?.[code] ?? '' });
    }
    onSwitch?.(code);
    setAdding(false);
    setNewLang('');
  };

  const removeLang = (code) => {
    if (!canManage) return;
    if (typeof onRemoveLang === 'function') {
      onRemoveLang(code);
    } else {
      const next = { ...(value || {}) };
      delete next[code];
      onChangeValue?.(next);
    }
    if (active === code) {
      const remaining = langOptions.map((x) => x.code).filter((c) => c !== code);
      onSwitch?.(remaining[0] || '');
    }
  };

  return (
    <div className="flex flex-wrap gap-1 mb-3 items-center">
      {langOptions.map(({ code, label, flag }) => (
        <Button
          key={code}
          type="button"
          onClick={() => onSwitch(code)}
          variant={active === code ? 'primary' : 'outline'}
          className={`min-h-0 relative flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
            active === code
              ? 'bg-blue-600 text-white border-blue-600'
              : filled.has(code)
              ? 'bg-blue-50 text-blue-700 border-blue-300 hover:border-blue-500'
              : 'bg-white text-gray-500 border-gray-300 hover:border-blue-300 hover:text-blue-600'
          }`}
        >
          <span>{flag}</span>
          <span>{label}</span>
          {filled.has(code) && active !== code && (
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 inline-block" />
          )}

          {canManage && langOptions.length > 1 && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => { e.stopPropagation(); removeLang(code); }}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); removeLang(code); } }}
              className={`ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] border ${
                active === code ? 'border-white/50 text-white/90 hover:bg-white/15' : 'border-gray-300 text-gray-400 hover:bg-gray-100'
              }`}
              title="Удалить язык"
            >
              ×
            </span>
          )}
        </Button>
      ))}

      {canManage && (
        <>
          {!adding ? (
            <Button
              type="button"
              onClick={() => { setAdding(true); setNewLang(candidates[0] || ''); }}
              variant="outline"
              className="min-h-0 rounded-full px-2.5 py-1 text-xs font-medium"
              title="Добавить перевод"
            >
              + Язык
            </Button>
          ) : (
            <div className="flex items-center gap-1">
              <Select
                value={newLang}
                onChange={(e) => setNewLang(e.target.value)}
                className="min-h-0 w-auto px-2 py-1 text-xs"
              >
                {candidates.length === 0 ? (
                  <option value="">— нет —</option>
                ) : (
                  candidates.map((c) => <option key={c} value={c}>{c.toUpperCase()}</option>)
                )}
                <option value="custom">Другое…</option>
              </Select>
              {newLang === 'custom' && (
                <input
                  value=""
                  onChange={() => {}}
                  className="hidden"
                />
              )}
              <input
                type="text"
                value={newLang === 'custom' ? '' : newLang}
                onChange={(e) => setNewLang(e.target.value)}
                placeholder="ru"
                className={`px-2 py-1 text-xs border border-gray-300 rounded-lg ${newLang === 'custom' ? '' : 'hidden'}`}
              />
              <Button
                type="button"
                onClick={addLang}
                disabled={!newLang || candidates.length === 0 && newLang !== 'custom'}
                className="min-h-0 rounded-lg px-2 py-1 text-xs"
              >
                Добавить
              </Button>
              <Button
                type="button"
                onClick={() => { setAdding(false); setNewLang(''); }}
                variant="secondary"
                className="min-h-0 rounded-lg px-2 py-1 text-xs"
              >
                Отмена
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export function LangBlock({
  label,
  value = {},
  onChange,
  activeLang,
  multiline = false,
  rows = 3,
  required,
}) {
  const lang = activeLang;
  if (!lang) return null;

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label} <span className="text-gray-400 font-normal uppercase text-xs">{lang}</span>
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {multiline ? (
        <Textarea
          value={value?.[lang] || ''}
          onChange={(e) => onChange({ ...value, [lang]: e.target.value })}
          rows={rows}
          placeholder={`${label} (${lang})`}
        />
      ) : (
        <TextInput
          value={value?.[lang] || ''}
          onChange={(e) => onChange({ ...value, [lang]: e.target.value })}
          placeholder={`${label} (${lang})`}
        />
      )}
    </div>
  );
}

