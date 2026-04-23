import { useEffect, useMemo, useState } from 'react';
import { TextInput, Textarea } from '../../../components/ui/FormField';
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
        <button
          key={code}
          type="button"
          onClick={() => onSwitch(code)}
          className={`relative flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
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
        </button>
      ))}

      {canManage && (
        <>
          {!adding ? (
            <button
              type="button"
              onClick={() => { setAdding(true); setNewLang(candidates[0] || ''); }}
              className="px-2.5 py-1 rounded-full text-xs font-medium border border-gray-300 text-gray-600 hover:bg-gray-100 transition-colors"
              title="Добавить перевод"
            >
              + Язык
            </button>
          ) : (
            <div className="flex items-center gap-1">
              <select
                value={newLang}
                onChange={(e) => setNewLang(e.target.value)}
                className="px-2 py-1 text-xs border border-gray-300 rounded-lg bg-white"
              >
                {candidates.length === 0 ? (
                  <option value="">— нет —</option>
                ) : (
                  candidates.map((c) => <option key={c} value={c}>{c.toUpperCase()}</option>)
                )}
                <option value="custom">Другое…</option>
              </select>
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
              <button
                type="button"
                onClick={addLang}
                disabled={!newLang || candidates.length === 0 && newLang !== 'custom'}
                className="px-2 py-1 text-xs rounded-lg bg-blue-600 text-white disabled:opacity-50"
              >
                Добавить
              </button>
              <button
                type="button"
                onClick={() => { setAdding(false); setNewLang(''); }}
                className="px-2 py-1 text-xs rounded-lg bg-gray-100 text-gray-700"
              >
                Отмена
              </button>
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

