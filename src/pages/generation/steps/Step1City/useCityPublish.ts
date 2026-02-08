import { useState } from 'react';
import { citiesAPI } from '../../../../api/generation';

export default function useCityPublish(session: any) {
  const [publishLoading, setPublishLoading] = useState(false);
  const [publishSuccess, setPublishSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const publish = async () => {
    try {
      setPublishLoading(true);
      setError(null);
      setPublishSuccess(null);

      const response = await citiesAPI.publish(session.id);
      if (response.data?.status === 'success') {
        setPublishSuccess(response.data.message || 'Город опубликован');
        return { success: true, message: response.data.message };
      }

      const msg = response.data?.message || 'Ошибка при публикации';
      setError(msg);
      return { success: false, error: msg };
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Ошибка при публикации';
      setError(msg);
      return { success: false, error: msg };
    } finally {
      setPublishLoading(false);
    }
  };

  return { publish, publishLoading, publishSuccess, error };
}
