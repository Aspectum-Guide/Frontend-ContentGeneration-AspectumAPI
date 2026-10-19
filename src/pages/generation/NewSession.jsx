import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Layout from '../../components/Layout';
import { FormLabel, Checkbox, RadioGroup, Textarea, TextInput, Alert, Button, PageContainer, PageHeader, Panel, Glyph } from '@aspectum/admin-ui-web';
import { sessionsAPI } from '../../api/generation';
import { createSessionSchema } from '../../utils/validation';
import { useAppLanguages } from '../../hooks/useAppLanguages';

export default function NewSession() {
  const navigate = useNavigate();
  const { languages: appLanguages } = useAppLanguages();
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
      <PageContainer maxWidth="medium" centered>
        <PageHeader title="Создать новую сессию" />

        <Panel as="form" onSubmit={handleSubmit(onSubmit)} className="p-6 shadow-aspectum-card">
          {error && (
            <Alert tone="error" className="mb-4">{error}</Alert>
          )}

          {/* Название сессии */}
          <div className="mb-6">
            <FormLabel  layout="block" size="sm" weight="medium" tone="strong" spacing="sm">
              Название сессии (опционально)
            </FormLabel>
            <TextInput type="text" {...register('name')} placeholder="Например: Рим - историческое путешествие" />
          </div>

          {/* Тип контента */}
          <div className="mb-6">
            <FormLabel  layout="block" size="sm" weight="medium" tone="strong" spacing="md">
              Что вы хотите создать? <span className="text-aspectum-danger-subtle">*</span>
            </FormLabel>
            <RadioGroup
              name="content_type"
              value={contentType}
              onChange={(value) => setValue('content_type', value, { shouldValidate: true })}
              options={[
                { value: 'city_only', label: 'Только город', description: 'Создание карточки города с основной информацией и описанием' },
                { value: 'city_with_attractions', label: 'Город с достопримечательностями', description: 'Создание города и генерация контента для его достопримечательностей (мероприятий)' },
              ]}
            />
          </div>

          {/* Использовать ИИ */}
          <div className="mb-6">
            <FormLabel   layout="rowBare">
              <Checkbox {...register('use_ai')} />
              <span className="text-aspectum-text-strong">Использовать ИИ для генерации контента</span>
            </FormLabel>
            {contentType === 'city_with_attractions' && (
              <p className="mt-2 text-sm text-aspectum-text-muted">
                <Glyph name="💡" /> При выборе города с достопримечательностями рекомендуется включить ИИ для лучшего результата
              </p>
            )}
          </div>

          {/* Выбор языков */}
          <div className="mb-6">
            <FormLabel  layout="block" size="sm" weight="medium" tone="strong" spacing="sm">
              Выберите языки (минимум 2) <span className="text-aspectum-danger-subtle">*</span>
            </FormLabel>
            <div className="grid grid-cols-3 gap-2">
              {appLanguages.map((lang) => (
                <FormLabel
                  key={lang.code}
                  className={`flex items-center p-3 border rounded-aspectum-compact cursor-pointer transition-colors ${
                    selectedLanguages.includes(lang.code)
                      ? 'border-aspectum-focus bg-aspectum-primary-soft'
                      : 'border-aspectum-border-strong hover:border-aspectum-border-disabled'
                  }`}
                >
                  <Checkbox
                    checked={selectedLanguages.includes(lang.code)}
                    onChange={() => toggleLanguage(lang.code)}
                    disabled={selectedLanguages.includes(lang.code) && selectedLanguages.length === 2}
                  />
                  <span>{lang.label || lang.name || lang.code}</span>
                </FormLabel>
              ))}
            </div>
            {errors.target_languages && (
              <p className="mt-1 text-sm text-aspectum-danger">{errors.target_languages.message}</p>
            )}
            {selectedLanguages.length < 2 && (
              <p className="mt-1 text-sm text-aspectum-text-muted">
                Выбрано: {selectedLanguages.length} из минимум 2
              </p>
            )}
          </div>

          {/* Заметки */}
          <div className="mb-6">
            <FormLabel  layout="block" size="sm" weight="medium" tone="strong" spacing="sm">
              Заметки (опционально)
            </FormLabel>
            <Textarea {...register('notes')} rows={4} placeholder="Добавьте заметки к сессии..." />
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
        </Panel>
      </PageContainer>
    </Layout>
  );
}
