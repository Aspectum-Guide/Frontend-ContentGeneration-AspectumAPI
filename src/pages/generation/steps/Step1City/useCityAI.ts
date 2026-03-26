import { useState, useEffect, useRef } from 'react';
import { aiAPI, tasksAPI } from '../../../../api/generation';

type GenerateParams = {
  cityName: string;
  country: string;
  setValue: (field: string, value: any) => void;
  onProgress?: (progress: number, step: string) => void;
};

export default function useCityAI(session: any) {
  const [aiLoading, setAiLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState<string | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Очистка интервала при размонтировании
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  const pollTaskStatus = async (taskId: string, setValue: (field: string, value: any) => void): Promise<any> => {
    try {
      const response = await tasksAPI.get(taskId);
      const task = response.data;

      // Обновляем прогресс
      setProgress(task.progress || 0);
      setCurrentStep(task.current_step || null);

      if (task.status === 'completed') {
        // Задача завершена
        setAiLoading(false);
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }

        // Заполняем форму результатами
        if (task.result_data?.city_data) {
          const cityData = task.result_data.city_data;
          setValue('name', cityData.name || {});
          setValue('description', cityData.description || {});
          setValue('country', cityData.country || '');
          
          if (cityData.unsplash_image) {
            setValue('image_copyright', cityData.unsplash_image.author || '');
            return {
              url: cityData.unsplash_image.url,
              author: cityData.unsplash_image.author || '',
            };
          }
        }

        return null;
      } else if (task.status === 'failed') {
        // Задача провалилась
        setAiLoading(false);
        setError(task.error_message || 'Ошибка при генерации через ИИ');
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
        throw new Error(task.error_message || 'Ошибка при генерации через ИИ');
      }
      // Иначе продолжаем polling - возвращаем null чтобы продолжить
      return null;
    } catch (err: any) {
      setAiLoading(false);
      setError(err.message || 'Ошибка при проверке статуса задачи');
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      throw err;
    }
  };

  const generate = async ({ cityName, country, setValue, onProgress }: GenerateParams) => {
    try {
      setAiLoading(true);
      setError(null);
      setProgress(0);
      setCurrentStep('Запуск генерации...');

      // Запускаем асинхронную генерацию одного города
      const response = await aiAPI.citiesJsonStart({ cities: [cityName + (country ? `, ${country}` : '')] });
      
      // Если это синхронный ответ (старый формат)
      if (response.data && response.data.name) {
        const generated = response.data;
        setValue('name', generated.name || {});
        setValue('description', generated.description || {});
        setValue('country', generated.country || country);
        
        if (generated.unsplash_image) {
          return {
            url: generated.unsplash_image.url,
            author: generated.unsplash_image.author || '',
          };
        }
        setAiLoading(false);
        return null;
      }

      // Если это асинхронная задача
      if (response.data && response.data.task_id) {
        const taskId = response.data.task_id;
        setCurrentStep('Ожидание запуска...');
        
        // Начинаем polling
        const poll = async () => {
          try {
            const result = await pollTaskStatus(taskId, setValue);
            // Если задача завершена, result будет содержать данные изображения или null
            if (result !== undefined) {
              // Задача завершена, возвращаем результат
              return result;
            }
            // Если задача еще не завершена, продолжаем polling
            if (pollingIntervalRef.current) {
              // Продолжаем polling каждые 1 секунду
              pollingIntervalRef.current = setTimeout(poll, 1000);
            }
          } catch (err) {
            // Ошибка уже обработана в pollTaskStatus
            throw err;
          }
        };

        // Первый запрос сразу
        const firstResult = await poll();
        if (firstResult !== undefined) {
          return firstResult;
        }
        
        // Устанавливаем интервал для дальнейшего polling
        pollingIntervalRef.current = setInterval(async () => {
          try {
            const result = await pollTaskStatus(taskId, setValue);
            if (result !== undefined) {
              // Задача завершена
              if (pollingIntervalRef.current) {
                clearInterval(pollingIntervalRef.current);
                pollingIntervalRef.current = null;
              }
            }
          } catch (err) {
            // Ошибка обработана
          }
        }, 1000);
        
        return null;
      }

      // Неожиданный формат ответа
      throw new Error('Неожиданный формат ответа от сервера');
    } catch (err: any) {
      setAiLoading(false);
      setProgress(0);
      setCurrentStep(null);
      
      let errorMsg = 'Ошибка при генерации через ИИ';
      if (err.response?.data) {
        if (typeof err.response.data === 'string') errorMsg = err.response.data;
        else if (err.response.data.error) errorMsg = err.response.data.error;
        else if (err.response.data.detail) errorMsg = err.response.data.detail;
        else errorMsg = JSON.stringify(err.response.data);
      } else if (err.message) {
        errorMsg = err.message;
      }
      setError(errorMsg);
      
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      
      throw err;
    }
  };

  const cancel = () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    setAiLoading(false);
    setProgress(0);
    setCurrentStep(null);
  };

  return { generate, aiLoading, error, progress, currentStep, cancel };
}
