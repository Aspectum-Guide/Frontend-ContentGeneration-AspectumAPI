import React, { useEffect } from 'react';
import CityForm from './Step1City/CityForm';
import useCityForm from './Step1City/useCityForm';
import useCityAI from './Step1City/useCityAI';
import useCityImage from './Step1City/useCityImage';
import useCityPublish from './Step1City/useCityPublish';
import { citiesAPI } from '../../../api/generation';

type Props = {
  session: any;
  cityData: any;
  onComplete?: () => void;
  onSavedCity?: (city: any) => void;
};

export default function Step1City({ session, cityData: initialCityData, onComplete, onSavedCity }: Props) {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
    loadCityData,
    onSubmit,
    loading: saving,
    error: formError,
  } = useCityForm(session, initialCityData, onComplete);

  const { generate, aiLoading, error: aiError, progress, currentStep, cancel } = useCityAI(session);
  const { imagePreview, imageFile, handleFileChange, setPreviewFromUrl, clear: clearImage } = useCityImage();
  const { publish, publishLoading, publishSuccess, publishError } = useCityPublish(session);

  useEffect(() => {
    // reset form & load initial city data when session changes
    const imageUrl = loadCityData(initialCityData);
    if (imageUrl) setPreviewFromUrl(imageUrl as string);
    if (!initialCityData) {
      clearImage();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id, initialCityData]);

  const nameValue = watch('name') || {};
  const countryValue = watch('country') || '';

  const handleAiGenerate = async () => {
    const cityName = nameValue?.[session.target_languages?.[0]] || '';
    const country = countryValue || undefined;

    if (!cityName) {
      // require at least a city name to generate
      window.alert('Укажите название города для генерации');
      return;
    }

    try {
      const generatedImage = await generate({ 
        cityName, 
        country: country || '', 
        setValue,
        onProgress: (progress, step) => {
          // Прогресс обновляется автоматически через хук
        }
      });
      
      if (generatedImage?.url) {
        setValue('image_copyright', generatedImage.author || '');
        setPreviewFromUrl(generatedImage.url);
      }

      // Если генерация завершена (не асинхронная или уже завершилась)
      if (!aiLoading) {
        window.alert('Данные города сгенерированы! Проверьте и при необходимости отредактируйте.');
      }
    } catch (err) {
      // error state is handled inside the hook, but keep alert for parity
      window.alert((aiError as string) || 'Ошибка при генерации через ИИ');
    }
  };

  const submit = handleSubmit(async (data: any) => {
    try {
      const created = await onSubmit(data, imageFile);
      if (created && typeof (onComplete) === 'function') {
        onComplete();
      }
      if (onSavedCity) {
        onSavedCity(created);
      }

      window.alert(initialCityData?.id ? 'Город обновлен!' : 'Город создан!');
      return created;
    } catch (err) {
      window.alert((formError as string) || 'Ошибка при сохранении');
      throw err;
    }
  });

  const handlePublish = async () => {
    if (!window.confirm('Вы уверены, что хотите опубликовать город? Это действие нельзя отменить.')) return;

    const res = await publish();
    if (res?.success) {
      window.alert(res.message || 'Город опубликован');
      if (onComplete) onComplete();
    } else {
      window.alert(res?.error || 'Ошибка при публикации');
    }
  };

  const handleDelete = async () => {
    if (!initialCityData?.id) return;
    const confirmed = window.confirm('Вы уверены, что хотите удалить город из сессии?');
    if (!confirmed) return;
    try {
      await citiesAPI.delete(initialCityData.id);
      // notify parent: remove from list
      if (onSavedCity) onSavedCity({ ...initialCityData, _deleted: true });
      if (onComplete) onComplete();
    } catch (err) {
      console.error('Ошибка удаления города:', err);
      alert('Не удалось удалить город');
    }
  };

  const isSingleStep = session?.content_type === 'city_only';

  return (
    <CityForm
      session={session}
      register={register}
      setValue={setValue}
      nameValue={watch('name')}
      descriptionValue={watch('description')}
      countryValue={watch('country')}
      copyrightValue={watch('image_copyright')}
      onImageChange={handleFileChange}
      imagePreview={imagePreview}
      errors={errors}
      onAiGenerate={handleAiGenerate}
      aiLoading={aiLoading}
      aiProgress={progress}
      aiCurrentStep={currentStep}
      saving={saving}
      onSubmit={submit}
      isSingleStep={isSingleStep}
      publishLoading={publishLoading}
      onPublish={handlePublish}
      publishSuccess={publishSuccess}
      isEditing={!!initialCityData?.id}
      onDelete={handleDelete}
    />
  );
}
