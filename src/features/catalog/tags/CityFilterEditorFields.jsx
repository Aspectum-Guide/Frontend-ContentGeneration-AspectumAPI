import { useRef, useState } from 'react';
import { Field, TextInput } from '../../../components/ui/FormField';
import { imagesAPI } from '../../../api/generation';
import { parseApiError } from '../../../utils/apiError';
import { getMultiLangValue } from '../shared/i18n';

export default function CityFilterEditorFields({
  filter,
  setFilter,
  cityOptions = [],
  folderOptions = [],
  disabled = false,
}) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const fileInputRef = useRef(null);

  const toggleCity = (cityId) => {
    const sid = String(cityId);
    setFilter((prev) => {
      const ids = (prev?.city_ids || []).map(String);
      return {
        ...prev,
        city_ids: ids.includes(sid) ? ids.filter((x) => x !== sid) : [...ids, sid],
      };
    });
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    setUploadError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const r = await imagesAPI.upload(fd);
      const { id, url } = r?.data || {};
      if (id) {
        setFilter((prev) => ({
          ...prev,
          pic_id: id,
          image_url: url || prev?.image_url || null,
        }));
      }
    } catch (err) {
      setUploadError(parseApiError(err, 'Ошибка загрузки изображения'));
    } finally {
      setUploading(false);
    }
  };

  if (!filter) return null;

  return (
    <div className="space-y-4 pt-2 border-t border-gray-100">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Тип">
          <select
            value={filter.type || filter.kind || 'tag'}
            disabled={disabled || !!filter.id}
            onChange={(e) => setFilter((p) => ({
              ...p,
              type: e.target.value,
              kind: e.target.value,
              parent_id: e.target.value === 'folder' ? null : p.parent_id,
              parent_folder_id: e.target.value === 'folder' ? '' : (p.parent_folder_id || p.parent_id || ''),
            }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="folder">Папка</option>
            <option value="tag">Тег</option>
          </select>
        </Field>
        <Field label="Индекс">
          <TextInput
            type="number"
            min={0}
            value={filter.index ?? 0}
            disabled={disabled}
            onChange={(e) => setFilter((p) => ({ ...p, index: Number(e.target.value) || 0 }))}
          />
        </Field>
      </div>

      {(filter.type || filter.kind || 'tag') === 'tag' && (
        <Field label="Папка">
          <select
            value={filter.parent_id || filter.parent_folder_id || ''}
            disabled={disabled}
            onChange={(e) => setFilter((p) => ({
              ...p,
              parent_id: e.target.value || null,
              parent_folder_id: e.target.value || '',
            }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="">— без папки —</option>
            {folderOptions.map((f) => (
              <option key={String(f.id)} value={String(f.id)}>
                {getMultiLangValue(f.name) || f.slug || f.id}
              </option>
            ))}
          </select>
        </Field>
      )}

      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={filter.is_show !== false}
          disabled={disabled}
          onChange={(e) => setFilter((p) => ({ ...p, is_show: e.target.checked }))}
        />
        Показывать в приложении
      </label>

      <div className="space-y-2">
        <p className="text-sm font-medium text-gray-700">Изображение (pic)</p>
        {filter.image_url ? (
          <img src={filter.image_url} alt="" className="max-h-32 rounded-lg border border-gray-200" />
        ) : (
          <p className="text-sm text-gray-400">Изображение не выбрано</p>
        )}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={disabled || uploading}
            onClick={() => fileInputRef.current?.click()}
            className="px-3 py-2 text-sm font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 disabled:opacity-50"
          >
            {uploading ? 'Загрузка...' : 'Загрузить изображение'}
          </button>
          {filter.pic_id && (
            <button
              type="button"
              disabled={disabled}
              onClick={() => setFilter((p) => ({ ...p, pic_id: null, image_url: null }))}
              className="px-3 py-2 text-sm text-red-600 hover:text-red-700 disabled:opacity-50"
            >
              Убрать
            </button>
          )}
        </div>
        {uploadError && <p className="text-xs text-red-600">{uploadError}</p>}
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
      </div>

      {cityOptions.length > 0 && (
        <Field label="Привязанные города">
          <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto p-2 border border-gray-200 rounded-lg bg-gray-50">
            {cityOptions.map((city) => {
              const cid = String(city.id);
              const selected = (filter.city_ids || []).map(String).includes(cid);
              return (
                <button
                  key={cid}
                  type="button"
                  disabled={disabled}
                  onClick={() => toggleCity(cid)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                    selected
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
                  }`}
                >
                  {getMultiLangValue(city.name) || city.display_name || cid}
                </button>
              );
            })}
          </div>
          <p className="mt-1 text-xs text-gray-400">
            Выбрано: {(filter.city_ids || []).length}
          </p>
        </Field>
      )}
    </div>
  );
}
