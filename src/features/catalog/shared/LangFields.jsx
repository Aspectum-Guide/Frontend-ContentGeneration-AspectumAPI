import { TextInput, Textarea } from '../../../components/ui/FormField';
import { getFilledLangCodes } from './i18n';

export function LangTabs({ active, onSwitch, value = {}, langOptions = [] }) {
  const filled = getFilledLangCodes(value);
  return (
    <div className="flex flex-wrap gap-1 mb-3">
      {langOptions.map(({ code, label, flag }) => (
        <button
          key={code}
          type="button"
          onClick={() => onSwitch(code)}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
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
        </button>
      ))}
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

