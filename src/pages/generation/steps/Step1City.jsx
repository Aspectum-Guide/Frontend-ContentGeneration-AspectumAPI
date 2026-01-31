import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import MultiLangInput from '../../../components/forms/MultiLangInput';
import Input from '../../../components/ui/Input';
import Button from '../../../components/ui/Button';
import { citiesAPI } from '../../../api/generation';
import { citySchema } from '../../../utils/validation';

export default function Step1City({ session, onComplete }) {
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [error, setError] = useState(null);
  const [cityData, setCityData] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [imageFile, setImageFile] = useState(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(citySchema),
    defaultValues: {
      name: {},
      description: {},
      country: '',
      image_copyright: '',
    },
  });

  useEffect(() => {
    loadCityData();
  }, [session.id]);

  const loadCityData = async () => {
    try {
      const response = await citiesAPI.get(session.id);
      if (response.data.length > 0) {
        const city = response.data[0];
        setCityData(city);
        setValue('name', city.name || {});
        setValue('description', city.description || {});
        setValue('country', city.country || '');
        setValue('image_copyright', city.image_copyright || '');
        
        if (city.main_image) {
          setImagePreview(city.main_image);
        }
      }
    } catch (err) {
      // Город еще не создан - это нормально
      console.log('Город еще не создан');
    }
  };

  const handleAiGenerate = async () => {
    const cityName = watch('name')?.[session.target_languages?.[0]] || '';
    const country = watch('country') || '';
    
    if (!cityName || !country) {
      setError('Укажите название города и страну для генерации');
      return;
    }

    try {
      setAiLoading(true);
      setError(null);
      
      const response = await citiesAPI.aiGenerate(
        session.id,
        cityName,
        country,
        'ollama' // Используем Ollama по умолчанию
      );
      
      const generated = response.data;
      
      // Заполняем форму сгенерированными данными
      setValue('name', generated.name || {});
      setValue('description', generated.description || {});
      setValue('country', generated.country || country);
      
      // Если есть изображение из Unsplash
      if (generated.unsplash_image) {
        setValue('image_copyright', generated.unsplash_image.author || '');
        // TODO: Загрузить изображение из URL
        setImagePreview(generated.unsplash_image.url);
      }
      
      // Перезагружаем данные
      await loadCityData();
      
      alert('Данные города сгенерированы! Проверьте и при необходимости отредактируйте.');
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Ошибка при генерации через ИИ');
      console.error('Ошибка генерации города:', err);
    } finally {
      setAiLoading(false);
    }
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const onSubmit = async (data) => {
    try {
      setLoading(true);
      setError(null);
      
      const formData = {
        session: session.id,
        name: data.name,
        description: data.description,
        country: data.country,
        image_copyright: data.image_copyright,
      };
      
      if (imageFile) {
        formData.main_image = imageFile;
      }
      
      await citiesAPI.createOrUpdate(formData);

      onComplete();
      alert('Данные города сохранены!');
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Ошибка при сохранении');
      console.error('Ошибка сохранения города:', err);
    } finally {
      setLoading(false);
    }
  };

  const nameValue = watch('name') || {};
  const descriptionValue = watch('description') || {};
  const countryValue = watch('country') || '';
  const copyrightValue = watch('image_copyright') || '';

  return (
    <div className="bg-white shadow rounded-lg p-4 md:p-6">
      <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-4 md:mb-6">
        Шаг 1: Данные города
      </h2>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
          <p className="text-red-800 text-sm">{error}</p>
        </div>
      )}

      {/* Кнопка генерации через ИИ */}
      <div className="mb-6">
        <Button
          type="button"
          variant="outline"
          onClick={handleAiGenerate}
          disabled={aiLoading || !countryValue || !nameValue[session.target_languages?.[0]]}
          className="w-full md:w-auto"
        >
          {aiLoading ? 'Генерация через ИИ...' : '🤖 Заполнить автоматически через ИИ'}
        </Button>
        {aiLoading && (
          <p className="mt-2 text-sm text-gray-500">
            Генерация данных города через Ollama. Это может занять некоторое время...
          </p>
        )}
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 md:space-y-6">
        {/* Название города */}
        <div>
          <MultiLangInput
            label="Название города"
            value={nameValue}
            onChange={(value) => setValue('name', value)}
            required
            languages={session.target_languages?.map(code => ({
              code,
              name: code.toUpperCase(),
            })) || []}
            error={errors.name}
          />
        </div>

        {/* Описание города */}
        <div>
          <MultiLangInput
            label="Описание города"
            value={descriptionValue}
            onChange={(value) => setValue('description', value)}
            languages={session.target_languages?.map(code => ({
              code,
              name: code.toUpperCase(),
            })) || []}
            error={errors.description}
          />
        </div>

        {/* Страна */}
        <div>
          <Input
            label="Страна"
            {...register('country')}
            error={errors.country?.message}
            required
            placeholder="Например: Italy"
          />
        </div>

        {/* Загрузка изображения */}
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
            onChange={handleImageChange}
            className="block w-full text-sm text-gray-500
              file:mr-4 file:py-2 file:px-4
              file:rounded-md file:border-0
              file:text-sm file:font-semibold
              file:bg-blue-50 file:text-blue-700
              hover:file:bg-blue-100
              file:cursor-pointer"
          />
          
          {errors.main_image && (
            <p className="mt-1 text-sm text-red-600">{errors.main_image.message}</p>
          )}
        </div>

        {/* Автор изображения (обязательно, если есть изображение) */}
        {(imageFile || imagePreview) && (
          <div>
            <Input
              label="Автор изображения (Copyright) *"
              {...register('image_copyright', {
                required: imageFile || imagePreview ? 'Необходимо указать автора изображения' : false,
              })}
              error={errors.image_copyright?.message}
              required
              placeholder="Например: John Doe / Unsplash"
              helpText="Обязательно укажите автора изображения"
            />
          </div>
        )}

        {/* Кнопки */}
        <div className="flex flex-col sm:flex-row gap-4 pt-4">
          <Button
            type="submit"
            variant="primary"
            disabled={loading || aiLoading}
            className="w-full sm:w-auto"
          >
            {loading ? 'Сохранение...' : 'Сохранить и продолжить'}
          </Button>
        </div>
      </form>
    </div>
  );
}
