const getMultilangText = (value, preferredLang = 'ru') => {
  if (!value) return '';

  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number') {
    return String(value);
  }

  if (typeof value === 'object') {
    return (
      value[preferredLang] ||
      value.ru ||
      value.en ||
      value.it ||
      Object.values(value).find(
        (item) => typeof item === 'string' && item.trim()
      ) ||
      ''
    );
  }

  return '';
};

const getAttractionName = (attr, lang = 'ru') => {
  return getMultilangText(attr?.name, lang) || attr?.id || '(без названия)';
};

const getAttractionContentText = (attr, lang = 'ru') => {
  const contents = attr?.contents;

  if (!contents) return '';

  if (typeof contents === 'string') {
    return contents;
  }

  if (typeof contents === 'object') {
    const value =
      contents[lang] ||
      contents.ru ||
      contents.en ||
      contents.it ||
      Object.values(contents).find(Boolean);

    if (!value) return '';

    if (typeof value === 'string') {
      return value;
    }

    if (typeof value === 'object') {
      return value.text || value.content || value.value || '';
    }
  }

  return '';
};

const hasAnyContent = (attr) => {
  const contents = attr?.contents;

  if (!contents) return false;

  if (typeof contents === 'string') {
    return contents.trim().length > 0;
  }

  if (typeof contents === 'object') {
    return Object.values(contents).some((value) => {
      if (!value) return false;

      if (typeof value === 'string') {
        return value.trim().length > 0;
      }

      if (typeof value === 'object') {
        return Boolean(
          value.text ||
            value.content ||
            value.value ||
            Object.values(value).find(
              (item) => typeof item === 'string' && item.trim()
            )
        );
      }

      return Boolean(value);
    });
  }

  return false;
};

export default function SessionWizardContentStep({
  attractions = [],
  aiGenAttrId,
  aiGenLang,
  aiGenText,
  aiGenDone,
  aiGenError,
  aiGenSaving,
  onStartAiContent,
  onSetAiGenLang,
  onSetAiGenAttrId,
  onSetAiGenText,
  onSaveAiContent,
  onGoToStep,
}) {
  const handleSelectLang = (attrId, lang) => {
    onSetAiGenAttrId(attrId);
    onSetAiGenLang(lang);
  };

  const handleStartGeneration = (attrId) => {
    onSetAiGenAttrId(attrId);
    onStartAiContent(attrId, aiGenLang || 'ru');
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Контент</h2>

        <p className="text-sm text-gray-500">
          Генерация текстового контента для достопримечательностей с помощью ИИ
        </p>
      </div>

      {attractions.length === 0 ? (
        <div className="py-8 text-center text-gray-400 text-sm border border-dashed border-gray-200 rounded-xl">
          Нет достопримечательностей. Добавьте их на шаге 4.
        </div>
      ) : (
        <div className="space-y-3">
          {attractions.map((attr) => {
            const attrId = attr?.id;
            const isSelected = String(aiGenAttrId) === String(attrId);
            const selectedLang = isSelected ? aiGenLang || 'ru' : 'ru';

            const name = getAttractionName(attr, selectedLang);
            const contentFilled = hasAnyContent(attr);
            const currentContentText = getAttractionContentText(
              attr,
              selectedLang
            );

            return (
              <div
                key={attrId}
                className={`border rounded-xl p-4 transition-all ${
                  isSelected
                    ? 'border-blue-400 bg-blue-50'
                    : 'border-gray-200 bg-white'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {name}
                    </p>

                    {contentFilled ? (
                      <p className="text-xs text-green-600 mt-0.5">
                        ✓ Контент заполнен
                      </p>
                    ) : (
                      <p className="text-xs text-gray-400 mt-0.5">
                        Контент пока не создан
                      </p>
                    )}

                    {currentContentText && !isSelected && (
                      <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                        {currentContentText}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <select
                      value={selectedLang}
                      onChange={(e) => {
                        handleSelectLang(attrId, e.target.value);
                      }}
                      className="text-xs border border-gray-300 rounded-md px-2 py-1 focus:outline-none"
                    >
                      <option value="ru">RU</option>
                      <option value="en">EN</option>
                      <option value="it">IT</option>
                    </select>

                    <button
                      type="button"
                      onClick={() => handleStartGeneration(attrId)}
                      disabled={isSelected && !aiGenDone}
                      className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                      {isSelected && !aiGenDone ? (
                        <span className="flex items-center gap-1">
                          <span className="animate-spin inline-block w-3 h-3 border border-white border-t-transparent rounded-full" />
                          Генерация...
                        </span>
                      ) : (
                        '✨ Сгенерировать'
                      )}
                    </button>
                  </div>
                </div>

                {isSelected && (aiGenText || aiGenError) && (
                  <div className="mt-3 space-y-2">
                    {aiGenError && (
                      <p className="text-xs text-red-600">{aiGenError}</p>
                    )}

                    {aiGenText && (
                      <>
                        <textarea
                          value={aiGenText}
                          onChange={(e) => onSetAiGenText(e.target.value)}
                          rows={6}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                        />

                        {!aiGenDone && (
                          <div className="flex items-center gap-1.5 text-xs text-blue-500">
                            <span className="animate-pulse inline-block w-2 h-2 bg-blue-400 rounded-full" />
                            Генерация...
                          </div>
                        )}

                        {aiGenDone && (
                          <button
                            type="button"
                            onClick={onSaveAiContent}
                            disabled={aiGenSaving}
                            className="px-4 py-1.5 text-xs font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50 transition-colors"
                          >
                            {aiGenSaving
                              ? 'Сохранение...'
                              : '✓ Сохранить контент'}
                          </button>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="flex justify-between pt-2">
        <button
          type="button"
          onClick={() => onGoToStep(3)}
          className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          ← Назад
        </button>

        <button
          type="button"
          onClick={() => onGoToStep(5)}
          className="px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
        >
          Далее: Публикация →
        </button>
      </div>
    </div>
  );
}