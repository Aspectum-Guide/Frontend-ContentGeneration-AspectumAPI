export default function SessionWizardContentStep({
  attractions,
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
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Контент</h2>
        <p className="text-sm text-gray-500">Генерация текстового контента для достопримечательностей с помощью ИИ</p>
      </div>

      {attractions.length === 0 ? (
        <div className="py-8 text-center text-gray-400 text-sm border border-dashed border-gray-200 rounded-xl">
          Нет достопримечательностей. Добавьте их на шаге 3.
        </div>
      ) : (
        <div className="space-y-3">
          {attractions.map((attr) => {
            const name = attr?.name?.ru || attr?.name?.en || attr?.name?.it || attr?.name || attr.id;
            const hasContent = attr.contents && Object.values(attr.contents).some(Boolean);
            const isSelected = aiGenAttrId === attr.id;

            return (
              <div key={attr.id} className={`border rounded-xl p-4 transition-all ${isSelected ? 'border-blue-400 bg-blue-50' : 'border-gray-200 bg-white'}`}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{name}</p>
                    {hasContent && <p className="text-xs text-green-600 mt-0.5">✓ Контент заполнен</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={isSelected ? aiGenLang : 'ru'}
                      onChange={(e) => { if (!isSelected) onSetAiGenLang(e.target.value); }}
                      onClick={(e) => { onSetAiGenLang(e.target.value); onSetAiGenAttrId(attr.id); }}
                      className="text-xs border border-gray-300 rounded-md px-2 py-1 focus:outline-none"
                    >
                      <option value="ru">RU</option>
                      <option value="en">EN</option>
                      <option value="it">IT</option>
                    </select>
                    <button
                      onClick={() => onStartAiContent(attr.id, aiGenLang)}
                      disabled={isSelected && !aiGenDone}
                      className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                      {isSelected && !aiGenDone ? (
                        <span className="flex items-center gap-1">
                          <span className="animate-spin inline-block w-3 h-3 border border-white border-t-transparent rounded-full" />
                          Генерация...
                        </span>
                      ) : '✨ Сгенерировать'}
                    </button>
                  </div>
                </div>

                {isSelected && (aiGenText || aiGenError) && (
                  <div className="mt-3 space-y-2">
                    {aiGenError && <p className="text-xs text-red-600">{aiGenError}</p>}
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
                            onClick={onSaveAiContent}
                            disabled={aiGenSaving}
                            className="px-4 py-1.5 text-xs font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50 transition-colors"
                          >
                            {aiGenSaving ? 'Сохранение...' : '✓ Сохранить контент'}
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
        <button onClick={() => onGoToStep(3)} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
          ← Назад
        </button>
        <button onClick={() => onGoToStep(5)} className="px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">
          Далее: Публикация →
        </button>
      </div>
    </div>
  );
}