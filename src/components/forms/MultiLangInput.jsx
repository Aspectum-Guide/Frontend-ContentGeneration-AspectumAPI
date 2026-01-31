import { useState } from 'react';
import Input from '../ui/Input';
import { LANGUAGES } from '../../utils/constants';

export default function MultiLangInput({
  label,
  value = {},
  onChange,
  required = false,
  languages = LANGUAGES,
  error,
  className = '',
}) {
  const [activeLang, setActiveLang] = useState(languages[0]?.code || 'en');

  const handleChange = (langCode, newValue) => {
    const newValueObj = { ...value, [langCode]: newValue };
    onChange(newValueObj);
  };

  return (
    <div className={`mb-4 ${className}`}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}
      
      {/* Переключатель языков */}
      <div className="flex gap-2 mb-2 border-b">
        {languages.map((lang) => (
          <button
            key={lang.code}
            type="button"
            onClick={() => setActiveLang(lang.code)}
            className={`px-3 py-1 text-sm font-medium transition-colors ${
              activeLang === lang.code
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {lang.name}
          </button>
        ))}
      </div>

      {/* Поле ввода для активного языка */}
      {languages.map((lang) => (
        <div key={lang.code} className={activeLang === lang.code ? '' : 'hidden'}>
          <Input
            value={value[lang.code] || ''}
            onChange={(e) => handleChange(lang.code, e.target.value)}
            placeholder={`Введите ${label?.toLowerCase()} на ${lang.name}`}
            error={error?.[lang.code]}
          />
        </div>
      ))}

      {error && typeof error === 'string' && (
        <p className="mt-1 text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}
