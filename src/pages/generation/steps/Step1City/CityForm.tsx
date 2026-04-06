import React from 'react';
import MultiLangInput from '../../../../components/forms/MultiLangInput';
import Input from '../../../../components/ui/Input';
import Button from '../../../../components/ui/Button';

// Simple country autocomplete used only in this form (no external deps)
function CountryAutocomplete({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [query, setQuery] = React.useState(value || '');
  const [open, setOpen] = React.useState(false);

  const COUNTRIES = [
    'United States', 'United Kingdom', 'France', 'Germany', 'Italy', 'Spain', 'Portugal',
    'Russia', 'Ukraine', 'Poland', 'Netherlands', 'Belgium', 'Sweden', 'Norway', 'Denmark',
    'Finland', 'China', 'Japan', 'South Korea', 'India', 'Brazil', 'Argentina', 'Mexico',
    'Canada', 'Australia', 'New Zealand', 'Turkey', 'Greece', 'Czech Republic', 'Austria'
  ];

  const suggestions = React.useMemo(() => {
    const q = (query || '').trim().toLowerCase();
    if (!q) return COUNTRIES.slice(0, 8);
    return COUNTRIES.filter(c => c.toLowerCase().includes(q)).slice(0, 8);
  }, [query]);

  React.useEffect(() => {
    setQuery(value || '');
  }, [value]);

  return (
    <div className="relative">
      <input
        type="text"
        className="w-full px-3 py-2 border border-gray-300 rounded-md text-base sm:text-sm min-h-[44px]"
        placeholder="Начните вводить название страны..."
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && suggestions.length > 0 && (
        <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-sm max-h-40 overflow-auto">
          {suggestions.map((s) => (
            <div
              key={s}
              className="px-3 py-2.5 hover:bg-gray-50 cursor-pointer text-base sm:text-sm"
              onMouseDown={(e) => { e.preventDefault(); onChange(s); setQuery(s); setOpen(false); }}
            >
              {s}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

type Props = {
  session: any;
  register: any;
  setValue: (field: string, value: any) => void;
  nameValue: any;
  descriptionValue: any;
  countryValue: string;
  copyrightValue: string;
  onImageChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  imagePreview: string | null;
  errors: any;
  onAiGenerate: () => void;
  aiLoading: boolean;
  aiProgress?: number;
  aiCurrentStep?: string | null;
  saving: boolean;
  onSubmit: (e?: React.BaseSyntheticEvent) => void;
  isSingleStep: boolean;
  publishLoading: boolean;
  onPublish: () => void;
  publishSuccess: string | null;
  isEditing?: boolean;
  onDelete?: () => Promise<void> | void;
};

export default function CityForm({
  session,
  register,
  setValue,
  nameValue,
  descriptionValue,
  countryValue,
  copyrightValue,
  onImageChange,
  imagePreview,
  errors,
  onAiGenerate,
  aiLoading,
  aiProgress = 0,
  aiCurrentStep = null,
  saving,
  onSubmit,
  isSingleStep,
  publishLoading,
  onPublish,
  publishSuccess,
  isEditing = false,
  onDelete,
}: Props) {
  const targetLanguages = session.target_languages?.map((code: string) => ({ code, name: code.toUpperCase() })) || [];

  return (
    <div className="bg-white shadow rounded-lg p-4 md:p-6">
      <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-4 md:mb-6">
        {isSingleStep ? 'Данные города' : 'Шаг 1: Данные города'}
      </h2>

      {errors && errors.global && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
          <p className="text-red-800 text-sm">{errors.global}</p>
        </div>
      )}

      {publishSuccess && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-md">
          <p className="text-green-800 text-sm">{publishSuccess}</p>
        </div>
      )}

      <div className="mb-6">
        <Button
          type="button"
          variant="outline"
          onClick={onAiGenerate}
          disabled={aiLoading || !nameValue?.[session.target_languages?.[0]]}
          className="w-full md:w-auto"
        >
          {aiLoading ? 'Генерация через ИИ...' : '🤖 Заполнить автоматически через ИИ'}
        </Button>
        {aiLoading && (
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">
                {aiCurrentStep || 'Генерация данных города через Ollama...'}
              </span>
              <span className="text-gray-500">{aiProgress}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${aiProgress}%` }}
              />
            </div>
            <p className="text-xs text-gray-500">
              Это может занять некоторое время...
            </p>
          </div>
        )}
      </div>

      <form onSubmit={onSubmit} className="space-y-4 md:space-y-6">
        <div>
          <MultiLangInput
            label="Название города"
            value={nameValue}
            onChange={(value: any) => setValue('name', value)}
            required
            languages={targetLanguages}
            error={errors?.name}
          />
        </div>

        <div>
          <MultiLangInput
            label="Описание города"
            value={descriptionValue}
            onChange={(value: any) => setValue('description', value)}
            languages={targetLanguages}
            error={errors?.description}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Страна (автодополнение)</label>
          <CountryAutocomplete value={countryValue} onChange={(v: string) => setValue('country', v)} />
          {errors?.country && <p className="mt-1 text-sm text-red-600">{errors.country.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Главное изображение города
          </label>

          {imagePreview && (
            <div className="mb-4">
              <img
                src={imagePreview}
                alt="Preview"
                className="max-w-full h-auto rounded-lg border border-gray-300"
                style={{ maxHeight: '300px' }}
              />
            </div>
          )}

          <input
            type="file"
            accept="image/*"
            onChange={onImageChange}
            className="block w-full text-base sm:text-sm text-gray-500
              file:mr-4 file:py-2 file:px-4
              file:rounded-md file:border-0
              file:text-sm file:font-semibold
              file:bg-blue-50 file:text-blue-700
              hover:file:bg-blue-100
              file:cursor-pointer"
          />

          {errors?.main_image && (
            <p className="mt-1 text-sm text-red-600">{errors.main_image.message}</p>
          )}
        </div>

        {(imagePreview) && (
          <div>
            <Input
              label="Автор изображения (Copyright) *"
              {...register('image_copyright', {
                required: imagePreview ? 'Необходимо указать автора изображения' : false,
              })}
              error={errors?.image_copyright?.message}
              required
              placeholder="Например: John Doe / Unsplash"
              helpText="Обязательно укажите автора изображения"
            />
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-4 pt-4">
          <Button
            type="submit"
            variant="primary"
            disabled={saving || aiLoading}
            className="w-full sm:w-auto"
          >
            {saving ? 'Сохранение...' : (isSingleStep ? 'Сохранить' : 'Сохранить и продолжить')}
          </Button>

          {isEditing && (
            <Button
              type="button"
              variant="outline"
              onClick={async () => {
                if (!confirm('Удалить город из сессии? Это действие нельзя отменить.')) return;
                if (onDelete) await onDelete();
              }}
              className="w-full sm:w-auto text-red-600 border-red-200 hover:border-red-300"
            >
              Удалить
            </Button>
          )}

          {isSingleStep && (
            <Button
              type="button"
              variant="outline"
              onClick={onPublish}
              disabled={publishLoading || aiLoading}
              className="w-full sm:w-auto"
            >
              {publishLoading ? 'Публикация...' : '🚀 Опубликовать город'}
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
