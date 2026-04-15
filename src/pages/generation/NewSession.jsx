import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Layout from '../../components/Layout';
import Button from '../../components/ui/Button';
import { sessionsAPI } from '../../api/generation';
import { createSessionSchema } from '../../utils/validation';
import { LANGUAGES } from '../../utils/constants';

export default function NewSession() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(createSessionSchema),
    defaultValues: {
      name: '',
      use_ai: true,
      target_languages: ['en', 'ru'],
      notes: '',
      content_type: 'city_only',
    },
  });

  const selectedLanguages = watch('target_languages') || [];
  const contentType = watch('content_type');

  const toggleLanguage = (langCode) => {
    const current = selectedLanguages;
    if (current.includes(langCode)) {
      if (current.length > 2) {
        setValue('target_languages', current.filter(l => l !== langCode));
      }
    } else {
      setValue('target_languages', [...current, langCode]);
    }
  };

  const onSubmit = async (data) => {
    try {
      setLoading(true);
      setError(null);
      const response = await sessionsAPI.create(data);
      const sessionId = response.data?.session?.id || response.data?.session?.uuid || response.data?.id;
      navigate(`/generation/${sessionId}`);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Ошибка при создании сессии');
      console.error('Ошибка создания сессии:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Создать новую сессию</h1>

        <form onSubmit={handleSubmit(onSubmit)} className="bg-white shadow rounded-lg p-6">
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
              <p className="text-red-800">{error}</p>
            </div>
          )}

          {/* Название сессии */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Название сессии (опционально)
            </label>
            <input
              type="text"
              {...register('name')}
              placeholder="Например: Рим - историческое путешествие"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Тип контента */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Что вы хотите создать? <span className="text-red-500">*</span>
            </label>
            <div className="space-y-3">
              <label className={`flex items-start p-4 border-2 rounded-lg cursor-pointer transition-all ${
                contentType === 'city_only' 
                  ? 'border-blue-500 bg-blue-50' 
                  : 'border-gray-300 hover:border-gray-400'
              }`}>
                <input
                  type="radio"
                  value="city_only"
                  {...register('content_type')}
                  className="mt-1 mr-3"
                />
                <div>
                  <div className="font-medium text-gray-900">Только город</div>
                  <div className="text-sm text-gray-600 mt-1">
                    Создание карточки города с основной информацией и описанием
                  </div>
                </div>
              </label>

              <label className={`flex items-start p-4 border-2 rounded-lg cursor-pointer transition-all ${
                contentType === 'city_with_attractions' 
                  ? 'border-blue-500 bg-blue-50' 
                  : 'border-gray-300 hover:border-gray-400'
              }`}>
                <input
                  type="radio"
                  value="city_with_attractions"
                  {...register('content_type')}
                  className="mt-1 mr-3"
                />
                <div>
                  <div className="font-medium text-gray-900">Город с достопримечательностями</div>
                  <div className="text-sm text-gray-600 mt-1">
                    Создание города и генерация контента для его достопримечательностей (мероприятий)
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* Использовать ИИ */}
          <div className="mb-6">
            <label className="flex items-center">
              <input
                type="checkbox"
                {...register('use_ai')}
                className="mr-2 w-4 h-4 text-blue-600"
              />
              <span className="text-gray-700">Использовать ИИ для генерации контента</span>
            </label>
            {contentType === 'city_with_attractions' && (
              <p className="mt-2 text-sm text-gray-500">
                💡 При выборе города с достопримечательностями рекомендуется включить ИИ для лучшего результата
              </p>
            )}
          </div>

          {/* Выбор языков */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Выберите языки (минимум 2) <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {LANGUAGES.map((lang) => (
                <label
                  key={lang.code}
                  className={`flex items-center p-3 border rounded-md cursor-pointer transition-colors ${
                    selectedLanguages.includes(lang.code)
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedLanguages.includes(lang.code)}
                    onChange={() => toggleLanguage(lang.code)}
                    disabled={selectedLanguages.includes(lang.code) && selectedLanguages.length === 2}
                    className="mr-2"
                  />
                  <span>{lang.name}</span>
                </label>
              ))}
            </div>
            {errors.target_languages && (
              <p className="mt-1 text-sm text-red-600">{errors.target_languages.message}</p>
            )}
            {selectedLanguages.length < 2 && (
              <p className="mt-1 text-sm text-gray-500">
                Выбрано: {selectedLanguages.length} из минимум 2
              </p>
            )}
          </div>

          {/* Заметки */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Заметки (опционально)
            </label>
            <textarea
              {...register('notes')}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Добавьте заметки к сессии..."
            />
          </div>

          {/* Кнопки */}
          <div className="flex justify-end gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/generation')}
            >
              Отмена
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={loading || selectedLanguages.length < 2}
            >
              {loading ? 'Создание...' : 'Создать сессию'}
            </Button>
          </div>
        </form>
      </div>
    </Layout>
  );
}
