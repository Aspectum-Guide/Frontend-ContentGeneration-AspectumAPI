import { useState, useEffect, useRef } from 'react';
import { aiAPI, tasksAPI } from '../../../../api/generation';

type GenerateParams = {
  cityName: string;
  country: string;
  setValue: (field: string, value: any) => void;
  onProgress?: (progress: number, step: string) => void;
};

type GeneratedImage = {
  url: string;
  author: string;
};

type PollResult =
  | { finished: false }
  | { finished: true; image: GeneratedImage | null };

function extractCityData(resultData: any): any | null {
  if (!resultData) return null;

  if (resultData.city_data) {
    return resultData.city_data;
  }

  if (Array.isArray(resultData.data) && resultData.data.length > 0) {
    const firstItem = resultData.data[0];

    if (firstItem?.city) {
      return firstItem.city;
    }

    return firstItem;
  }

  if (resultData.city) {
    return resultData.city;
  }

  return null;
}

export default function useCityAI(session: any) {
  const [aiLoading, setAiLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState<string | null>(null);

  const pollingTimerRef = useRef<number | null>(null);

  const clearPollingTimer = () => {
    if (pollingTimerRef.current !== null) {
      window.clearTimeout(pollingTimerRef.current);
      pollingTimerRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      clearPollingTimer();
    };
  }, []);

  const applyCityDataToForm = (
    cityData: any,
    setValue: (field: string, value: any) => void,
    fallbackCountry: string
  ): GeneratedImage | null => {
    setValue('name', cityData.name || {});
    setValue('description', cityData.description || {});
    setValue('country', cityData.country || fallbackCountry || '');

    if (cityData.unsplash_image) {
      setValue('image_copyright', cityData.unsplash_image.author || '');

      return {
        url: cityData.unsplash_image.url,
        author: cityData.unsplash_image.author || '',
      };
    }

    return null;
  };

  const pollTaskStatus = async (
    taskId: string,
    setValue: (field: string, value: any) => void,
    fallbackCountry: string,
    onProgress?: (progress: number, step: string) => void
  ): Promise<PollResult> => {
    try {
      const response = await tasksAPI.get(taskId);
      const task = response.data;

      const nextProgress = task.progress || 0;
      const nextStep = task.current_step || null;

      setProgress(nextProgress);
      setCurrentStep(nextStep);
      onProgress?.(nextProgress, nextStep || '');

      if (task.status === 'completed') {
        setAiLoading(false);
        clearPollingTimer();

        const cityData = extractCityData(task.result_data);

        if (cityData) {
          const image = applyCityDataToForm(cityData, setValue, fallbackCountry);
          return { finished: true, image };
        }

        return { finished: true, image: null };
      }

      if (task.status === 'failed') {
        setAiLoading(false);
        clearPollingTimer();

        const message = task.error_message || 'Ошибка при генерации через ИИ';
        setError(message);

        throw new Error(message);
      }

      return { finished: false };
    } catch (err: any) {
      setAiLoading(false);
      clearPollingTimer();

      const message = err.message || 'Ошибка при проверке статуса задачи';
      setError(message);

      throw err;
    }
  };

  const waitForTask = (
    taskId: string,
    setValue: (field: string, value: any) => void,
    fallbackCountry: string,
    onProgress?: (progress: number, step: string) => void
  ): Promise<GeneratedImage | null> => {
    return new Promise((resolve, reject) => {
      const poll = async () => {
        try {
          const result = await pollTaskStatus(
            taskId,
            setValue,
            fallbackCountry,
            onProgress
          );

          if (result.finished) {
            resolve(result.image);
            return;
          }

          pollingTimerRef.current = window.setTimeout(poll, 1000);
        } catch (err) {
          reject(err);
        }
      };

      poll();
    });
  };

  const generate = async ({
    cityName,
    country,
    setValue,
    onProgress,
  }: GenerateParams): Promise<GeneratedImage | null> => {
    try {
      setAiLoading(true);
      setError(null);
      setProgress(0);
      setCurrentStep('Запуск генерации...');
      onProgress?.(0, 'Запуск генерации...');

      const prompt = [cityName, country].filter(Boolean).join(', ');

      const response = await aiAPI.citiesJsonStart({
        prompt,
        requested_count: 1,
      });

      if (response.data && response.data.name) {
        const generated = response.data;
        const image = applyCityDataToForm(generated, setValue, country);

        setAiLoading(false);
        setProgress(100);
        setCurrentStep('Готово');
        onProgress?.(100, 'Готово');

        return image;
      }

      if (response.data && response.data.task_id) {
        const taskId = response.data.task_id;

        setCurrentStep('Ожидание запуска...');
        onProgress?.(0, 'Ожидание запуска...');

        return await waitForTask(taskId, setValue, country, onProgress);
      }

      throw new Error('Неожиданный формат ответа от сервера');
    } catch (err: any) {
      setAiLoading(false);
      setProgress(0);
      setCurrentStep(null);
      clearPollingTimer();

      let errorMsg = 'Ошибка при генерации через ИИ';

      if (err.response?.data) {
        if (typeof err.response.data === 'string') {
          errorMsg = err.response.data;
        } else if (err.response.data.error) {
          errorMsg = err.response.data.error;
        } else if (err.response.data.detail) {
          errorMsg = err.response.data.detail;
        } else {
          errorMsg = JSON.stringify(err.response.data);
        }
      } else if (err.message) {
        errorMsg = err.message;
      }

      setError(errorMsg);
      throw err;
    }
  };

  const cancel = () => {
    clearPollingTimer();
    setAiLoading(false);
    setProgress(0);
    setCurrentStep(null);
  };

  return {
    generate,
    aiLoading,
    error,
    progress,
    currentStep,
    cancel,
  };
}
