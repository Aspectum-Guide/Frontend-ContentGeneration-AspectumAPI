import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { citiesAPI } from '../../../../api/generation';
import { citySchema } from '../../../../utils/validation';

type Params = {
  session: any;
  initialCityData?: any;
  onComplete?: () => void;
};

export default function useCityForm(session: any, initialCityData?: any, onComplete?: () => void) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState,
  } = useForm<any>({
    resolver: zodResolver(citySchema as any),
    defaultValues: {
      name: {},
      description: {},
      country: '',
      image_copyright: '',
    },
  });

  const normalizeJsonField = (value: any) => {
    if (!value) return {};
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch {
        return {};
      }
    }
    return value;
  };

  const loadCityData = (city: any) => {
    if (!city) {
      reset({
        name: {},
        description: {},
        country: '',
        image_copyright: '',
      });
      return null;
    }

    reset({
      name: normalizeJsonField(city.name),
      description: normalizeJsonField(city.description),
      country: city.country || '',
      image_copyright: city.image_copyright || '',
    });

    if (city.main_image) {
      const imageUrl = typeof city.main_image === 'string'
        ? city.main_image.startsWith('http')
          ? city.main_image
          : `/api/v1${city.main_image}`
        : city.main_image;
      return imageUrl;
    }

    return null;
  };

  const onSubmit = async (data: any, imageFile?: File | null) => {
    try {
      setLoading(true);
      setError(null);

      const payload: any = {
        session: session.id,
        name: data.name,
        description: data.description,
        country: data.country,
        image_copyright: data.image_copyright,
      };

      if (initialCityData?.id) {
        payload.city_id = initialCityData.id;
      }

      if (imageFile) {
        // attach file to payload and let API helper build FormData
        payload.main_image = imageFile;
      }

      const resp = await citiesAPI.createOrUpdate(payload);
      console.debug('useCityForm.onSubmit - resp:', resp);
      const created = resp.data;
      return created;
    } catch (err: any) {
      const errorMsg = err?.response?.data?.error || err?.message || 'Ошибка при сохранении';
      setError(errorMsg);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState,
    loadCityData,
    onSubmit,
    loading,
    error,
  };
}
