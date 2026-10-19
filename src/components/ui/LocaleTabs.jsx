import { useEffect, useMemo, useRef, useState } from 'react';
import Button from './Button';
import IconButton from './IconButton';
import { Select, TextInput } from './FormField';
import TabButton from './TabButton';

function normalizeLangCode(raw) {
  return String(raw || '').trim().toLowerCase().replace(/[^a-z]/g, '').slice(0, 5);
}

export default function LocaleTabs({
  active,
  onSwitch,
  value = {},
  onChangeValue,
  onAddLang,
  onRemoveLang,
  langOptions = [],
  availableLangs = [],
  allowManage = true,
  getFilledCodes = (input) => new Set(Object.entries(input).filter(([, item]) => item).map(([code]) => code)),
  className = 'mb-3',
}) {
  const filled = getFilledCodes(value);
  const [adding, setAdding] = useState(false);
  const [newLang, setNewLang] = useState('');
  const [customLang, setCustomLang] = useState('');
  const tabRefs = useRef(new Map());
  const existing = useMemo(() => new Set(langOptions.map((item) => item.code)), [langOptions]);
  const candidates = useMemo(() => availableLangs.filter((code) => !existing.has(code)), [availableLangs, existing]);
  const canManage = allowManage && (typeof onChangeValue === 'function' || typeof onAddLang === 'function' || typeof onRemoveLang === 'function');

  useEffect(() => {
    if (!active && langOptions.length) onSwitch?.(langOptions[0].code);
  }, [active, langOptions, onSwitch]);

  const addLang = () => {
    const code = normalizeLangCode(newLang === 'custom' ? customLang : newLang);
    if (!code) return;
    if (existing.has(code)) {
      onSwitch?.(code);
    } else if (typeof onAddLang === 'function') {
      onAddLang(code);
    } else {
      onChangeValue?.({ ...value, [code]: value?.[code] ?? '' });
    }
    onSwitch?.(code);
    setAdding(false);
    setNewLang('');
    setCustomLang('');
  };

  const removeLang = (code) => {
    if (!canManage) return;
    if (typeof onRemoveLang === 'function') onRemoveLang(code);
    else {
      const next = { ...value };
      delete next[code];
      onChangeValue?.(next);
    }
    if (active === code) onSwitch?.(langOptions.map((item) => item.code).find((item) => item !== code) || '');
  };

  const moveFocus = (event, currentCode) => {
    const codes = langOptions.map((item) => item.code);
    const currentIndex = codes.indexOf(currentCode);
    let nextIndex;
    if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = codes.length - 1;
    else if (event.key === 'ArrowRight' || event.key === 'ArrowDown') nextIndex = (currentIndex + 1) % codes.length;
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') nextIndex = (currentIndex - 1 + codes.length) % codes.length;
    else return;
    event.preventDefault();
    const nextCode = codes[nextIndex];
    if (!nextCode) return;
    onSwitch?.(nextCode);
    tabRefs.current.get(nextCode)?.focus();
  };

  return (
    <div role="tablist" aria-label="Языки" className={`flex flex-wrap gap-1 items-center ${className}`.trim()}>
      {langOptions.map(({ code, label, flag }) => (
        <div key={code} className="relative inline-flex">
          <TabButton selected={active === code} onClick={() => onSwitch?.(code)} onKeyDown={(event) => moveFocus(event, code)} ref={(node) => { if (node) tabRefs.current.set(code, node); else tabRefs.current.delete(code); }} className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${canManage && langOptions.length > 1 ? 'pr-7' : ''} ${active === code ? 'bg-aspectum-primary text-aspectum-on-accent border-aspectum-primary' : filled.has(code) ? 'bg-aspectum-primary-soft text-aspectum-primary border-aspectum-primary/30 hover:border-aspectum-primary' : 'bg-aspectum-surface text-aspectum-text-muted border-aspectum-border hover:border-aspectum-primary'}`}>
            <span>{flag}</span><span>{label}</span>
            {filled.has(code) && active !== code && <span className="w-1.5 h-1.5 rounded-full bg-aspectum-primary inline-block" />}
          </TabButton>
          {canManage && langOptions.length > 1 && (
            <IconButton
              label={`Удалить язык ${label}`}
              onClick={() => removeLang(code)}
              variant={active === code ? 'ghostOnAccent' : 'ghost'}
              size="iconXs"
              className="absolute right-1 top-1/2 -translate-y-1/2"
            >×</IconButton>
          )}
        </div>
      ))}
      {canManage && (!adding ? (
        <Button type="button" onClick={() => { setAdding(true); setNewLang(candidates[0] || ''); }} variant="outline" size="pillSm" title="Добавить перевод">+ Язык</Button>
      ) : (
        <div className="flex items-center gap-1">
          <Select aria-label="Новый язык" className="w-auto min-h-0 py-1 text-xs" value={newLang} onChange={(event) => setNewLang(event.target.value)}>
            {candidates.length ? candidates.map((code) => <option key={code} value={code}>{code.toUpperCase()}</option>) : <option value="">— нет —</option>}
            <option value="custom">Другое…</option>
          </Select>
          {newLang === 'custom' && <TextInput aria-label="Код языка" className="w-20 min-h-0 py-1 text-xs" type="text" value={customLang} onChange={(event) => setCustomLang(event.target.value)} placeholder="ru" />}
          <Button type="button" onClick={addLang} disabled={!normalizeLangCode(newLang === 'custom' ? customLang : newLang)} variant="primary" size="sm">Добавить</Button>
          <Button type="button" onClick={() => { setAdding(false); setNewLang(''); setCustomLang(''); }} variant="secondary" size="sm">Отмена</Button>
        </div>
      ))}
    </div>
  );
}
