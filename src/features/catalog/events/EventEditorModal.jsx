import { useState } from 'react';
import CommonsImagePicker from '../../../components/generation/CommonsImagePicker';
import { Field, FormActions, TextInput } from '../../../components/ui/FormField';
import Modal from '../../../components/ui/Modal';
import { buildLangOptions, getMultiLangValue } from '../shared/i18n';
import { LangBlock, LangTabs } from '../shared/LangFields';

export default function EventEditorModal({
  open,
  onClose,
  event,
  setEvent,
  editLoading,
  activeLang,
  setActiveLang,
  saving,
  saveError,
  onSave,
  cityOptions,
  allEventFilters,
  toggleTag,
  onSetMedia,
  mediaSaving,
  mediaError,
}) {
  const [activeTab, setActiveTab] = useState('content');
  const [commonsModalOpen, setCommonsModalOpen] = useState(false);

  const titleVal = typeof event?.title === 'object' ? event.title : {};
  const descVal = typeof event?.description === 'object' ? event.description : {};
  const langOptions = buildLangOptions([titleVal, descVal]);

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title={event?.id ? 'Редактировать событие' : 'Создать событие'}
        size="xl"
      >
        {event && (
          <form onSubmit={onSave} className="space-y-5">
            {saveError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {saveError}
              </div>
            )}

            {editLoading && (
              <div className="flex items-center gap-2 text-sm text-gray-400 py-1">
                <span className="animate-spin w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full inline-block" />
                Загрузка данных события...
              </div>
            )}

            <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-3">
              {[
                { key: 'content', label: 'Контент' },
                { key: 'media', label: 'Обложка' },
                { key: 'meta', label: 'Связи' },
              ].map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${activeTab === tab.key ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {activeTab === 'content' && (langOptions.length > 0 ? (
              <>
                <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
                  <p className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">Активный язык</p>
                  <LangTabs
                    active={activeLang}
                    onSwitch={setActiveLang}
                    value={titleVal}
                    langOptions={langOptions}
                    onAddLang={(code) => {
                      setEvent((p) => ({
                        ...p,
                        title: { ...(p?.title || {}), [code]: p?.title?.[code] ?? '' },
                        description: { ...(p?.description || {}), [code]: p?.description?.[code] ?? '' },
                      }));
                    }}
                    onRemoveLang={(code) => {
                      setEvent((p) => {
                        const nextTitle = { ...(p?.title || {}) };
                        const nextDesc = { ...(p?.description || {}) };
                        delete nextTitle[code];
                        delete nextDesc[code];
                        return { ...p, title: nextTitle, description: nextDesc };
                      });
                    }}
                  />
                </div>

                <LangBlock
                  label="Название"
                  value={titleVal}
                  onChange={(v) => setEvent((p) => ({ ...p, title: v }))}
                  activeLang={activeLang}
                  required
                />

                <LangBlock
                  label="Описание"
                  value={descVal}
                  onChange={(v) => setEvent((p) => ({ ...p, description: v }))}
                  activeLang={activeLang}
                  multiline
                  rows={4}
                />
              </>
            ) : (
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
                Для этого события бэкенд не прислал переводы. Языки отображаются строго из JSON-ключей ответа.
              </div>
            ))}

            {activeTab === 'media' && (
              <div className="space-y-3">
                {mediaError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                    {mediaError}
                  </div>
                )}

                {(event?.image_url || event?.media?.image?.url) ? (
                  <div className="relative w-full h-[220px] rounded-xl overflow-hidden border border-gray-200 bg-gray-100">
                    <img
                      src={event?.image_url || event?.media?.image?.url}
                      alt=""
                      className="w-full h-full object-contain"
                    />
                    <button
                      type="button"
                      onClick={() => onSetMedia?.(null)}
                      disabled={!!mediaSaving}
                      className="absolute top-2 right-2 w-7 h-7 bg-black/60 text-white rounded-full text-sm flex items-center justify-center hover:bg-black/80 disabled:opacity-50"
                      title="Убрать обложку"
                    >
                      ×
                    </button>
                  </div>
                ) : (
                  <div className="w-full h-[220px] rounded-xl border border-dashed border-gray-300 bg-gray-50 flex items-center justify-center text-sm text-gray-400">
                    Обложка не выбрана
                  </div>
                )}

                <div className="flex flex-wrap gap-2 items-center">
                  <button
                    type="button"
                    onClick={() => setCommonsModalOpen(true)}
                    disabled={!!mediaSaving}
                    className="px-3 py-2 text-sm font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 disabled:opacity-50 transition-colors"
                  >
                    {mediaSaving ? 'Сохранение...' : '🖼️ Выбрать из Wikimedia Commons'}
                  </button>
                </div>

                <p className="text-xs text-gray-400">
                  Под капотом: импортируем изображение и привязываем его к ивенту через `/generation/events/&lt;id&gt;/media/`.
                </p>
              </div>
            )}

            {activeTab === 'meta' && (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Город">
                  <select
                    value={event?.city_id || ''}
                    onChange={(e) => setEvent((p) => ({ ...p, city_id: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="">— Без города —</option>
                    {cityOptions.map((c) => (
                      <option key={c.id} value={String(c.id)}>
                        {getMultiLangValue(c.name) || c.display_name || c.display_country || c.id}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Видимость">
                  <div className="flex items-center h-full pt-1">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <div
                        onClick={() => setEvent((p) => ({ ...p, is_show: !p.is_show }))}
                        className={`relative w-10 h-5 rounded-full transition-colors cursor-pointer ${event?.is_show ? 'bg-blue-600' : 'bg-gray-300'
                          }`}
                      >
                        <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${event?.is_show ? 'left-5' : 'left-0.5'
                          }`} />
                      </div>
                      <span className="text-sm text-gray-700">
                        {event?.is_show ? 'Показывается' : 'Скрыто'}
                      </span>
                    </label>
                  </div>
                </Field>
              </div>
            )}

            {allEventFilters?.length > 0 && (
              <Field label="Теги / категории события">
                <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto p-2 border border-gray-200 rounded-lg bg-gray-50">
                  {allEventFilters.map((f) => {
                    const fid = String(f.id);
                    const selected = (event?.tag_ids || []).includes(fid);
                    const label = f.display_name || f.slug || fid;
                    return (
                      <button
                        key={fid}
                        type="button"
                        onClick={() => toggleTag(fid)}
                        className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${selected
                            ? 'bg-purple-600 text-white border-purple-600'
                            : 'bg-white text-gray-600 border-gray-300 hover:border-purple-400 hover:text-purple-600'
                          }`}
                      >
                        {label}
                        {selected && <span className="ml-0.5">✓</span>}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-1 text-xs text-gray-400">
                  Выбрано: {(event?.tag_ids || []).length} тегов
                </p>
              </Field>
            )}

            {(event?.lat != null || event?.lon != null) && (
              <Field label="Координаты (только просмотр)">
                <div className="flex gap-3">
                  <TextInput
                    value={event?.lat ?? ''}
                    readOnly
                    className="bg-gray-50 text-gray-400 font-mono text-xs cursor-not-allowed"
                    placeholder="lat"
                  />
                  <TextInput
                    value={event?.lon ?? ''}
                    readOnly
                    className="bg-gray-50 text-gray-400 font-mono text-xs cursor-not-allowed"
                    placeholder="lon"
                  />
                </div>
                <p className="mt-1 text-xs text-gray-400">Координаты редактируются через Django Admin</p>
              </Field>
            )}

            <div className="hidden md:block">
              <FormActions saving={saving} onCancel={onClose} saveLabel={event?.id ? 'Сохранить' : 'Создать'} />
            </div>
            <div className="md:hidden text-xs text-gray-500 border border-dashed border-gray-300 rounded-lg p-3">
              Кнопки формы перенесены в верхнее меню «Действия».
            </div>
          </form>
        )}
      </Modal>

      <CommonsImagePicker
        isOpen={commonsModalOpen}
        onClose={() => setCommonsModalOpen(false)}
        onImageSelected={async ({ imageId }) => {
          setCommonsModalOpen(false);
          await onSetMedia?.(imageId);
        }}
        getSessionUuid={() => ''}
        defaultQuery={getMultiLangValue(event?.title || '')}
      />
    </>
  );
}


