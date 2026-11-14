import React, { useEffect } from 'react';
import CityForm from './Step1City/CityForm';
import useCityForm from './Step1City/useCityForm';
import useCityAI from './Step1City/useCityAI';
import useCityImage from './Step1City/useCityImage';
import useCityPublish from './Step1City/useCityPublish';
import Toast, { useToast } from '../../../components/ui/Toast';
import { useConfirmModal } from '../../../components/ui/useConfirmModal';
import { citiesAPI } from '../../../api/generation';

type Props = {
  session: any;
  cityData: any;
  onComplete?: () => void;
  onSavedCity?: (city: any) => void;
};

export default function Step1City({ session, cityData: initialCityData, onComplete, onSavedCity }: Props) {
  const { confirm, confirmModal } = useConfirmModal();
  const { note, showNote } = useToast();
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
      showNote('Укажите название города для генерации', 'warning');
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
        showNote('Данные города сгенерированы! Проверьте и при необходимости отредактируйте.', 'success');
      }
    } catch (err) {
      showNote((aiError as string) || 'Ошибка при генерации через ИИ', 'error');
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

      showNote(initialCityData?.id ? 'Город обновлен!' : 'Город создан!', 'success');
      return created;
    } catch (err) {
      showNote((formError as string) || 'Ошибка при сохранении', 'error');
      throw err;
    }
  });

  const handlePublish = async () => {
    const ok = await confirm({
      title: 'Публикация города',
      message: 'Вы уверены, что хотите опубликовать город? Это действие нельзя отменить.',
      confirmLabel: 'Опубликовать',
    });
    if (!ok) return;

    const res = await publish();
    if (res?.success) {
      showNote(res.message || 'Город опубликован', 'success');
      if (onComplete) onComplete();
    } else {
      showNote(res?.error || 'Ошибка при публикации', 'error');
    }
  };

  const handleDelete = async () => {
    if (!initialCityData?.id) return;
    const confirmed = await confirm({
      title: 'Удаление города',
      message: 'Вы уверены, что хотите удалить город из сессии?',
      danger: true,
      confirmLabel: 'Удалить',
    });
    if (!confirmed) return;
    try {
      await citiesAPI.delete(initialCityData.id);
      // notify parent: remove from list
      if (onSavedCity) onSavedCity({ ...initialCityData, _deleted: true });
      if (onComplete) onComplete();
      showNote('Город удален из сессии', 'success');
    } catch (err) {
      console.error('Ошибка удаления города:', err);
      showNote('Не удалось удалить город', 'error');
    }
  };

  const isSingleStep = session?.content_type === 'city_only';

  return (
    <>
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
      {confirmModal}
      <Toast note={note} />
    </>
  );
}
