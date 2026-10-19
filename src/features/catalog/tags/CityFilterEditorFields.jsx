import { useRef, useState } from 'react';
import { FormLabel, Alert, Field, FormGrid, MediaUploadField, Panel, Select, Switch, TagPicker, TextInput } from '@aspectum/ui';
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
    <div className="space-y-4 pt-2 border-t border-aspectum-border-subtle">
      <FormGrid responsive={false}>
        <Field label="Тип">
          <Select value={filter.type || filter.kind || 'tag'} disabled={disabled || !!filter.id} onChange={(e) => setFilter((p) => ({ ...p, type: e.target.value, kind: e.target.value, parent_id: e.target.value === 'folder' ? null : p.parent_id, parent_folder_id: e.target.value === 'folder' ? '' : (p.parent_folder_id || p.parent_id || ''), }))}>
            <option value="folder">Папка</option>
            <option value="tag">Тег</option>
          </Select>
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
      </FormGrid>

      {(filter.type || filter.kind || 'tag') === 'tag' && (
        <Field label="Папка">
          <Select value={filter.parent_id || filter.parent_folder_id || ''} disabled={disabled} onChange={(e) => setFilter((p) => ({ ...p, parent_id: e.target.value || null, parent_folder_id: e.target.value || '', }))}>
            <option value="">— без папки —</option>
            {folderOptions.map((f) => (
              <option key={String(f.id)} value={String(f.id)}>
                {getMultiLangValue(f.name) || f.slug || f.id}
              </option>
            ))}
          </Select>
        </Field>
      )}

      <FormLabel  layout="row" size="sm" tone="strong">
        <Switch
          checked={filter.is_show !== false}
          disabled={disabled}
          onChange={(is_show) => setFilter((p) => ({ ...p, is_show }))}
          aria-label="Показывать фильтр в приложении"
        />
        Показывать в приложении
      </FormLabel>

      <MediaUploadField
        label="Изображение (pic)"
        previewUrl={filter.image_url}
        inputRef={fileInputRef}
        disabled={disabled}
        uploading={uploading}
        onChange={handleImageUpload}
        onRemove={() => setFilter((p) => ({ ...p, pic_id: null, image_url: null }))}
      />
      <div>
        {uploadError && <Alert tone="error" className="text-xs">{uploadError}</Alert>}
      </div>

      {cityOptions.length > 0 && (
        <Field label="Привязанные города">
          <Panel tone="muted" className="max-h-40 overflow-y-auto p-2">
            <TagPicker
              options={cityOptions}
              selected={filter.city_ids || []}
              disabled={disabled}
              onToggle={toggleCity}
              getOptionLabel={(city) => getMultiLangValue(city.name) || city.display_name || city.id}
            />
          </Panel>
          <p className="mt-1 text-xs text-aspectum-text-disabled">
            Выбрано: {(filter.city_ids || []).length}
          </p>
        </Field>
      )}
    </div>
  );
}
