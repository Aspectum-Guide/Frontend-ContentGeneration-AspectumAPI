import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { sessionsAPI, citiesAPI } from '../../../../api/generation';
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

      if (initialCityData?.id) {
        // Update existing city via cities/<uuid>/update/
        const formData = new FormData();
        formData.append('name', JSON.stringify(data.name));
        formData.append('description', JSON.stringify(data.description));
        formData.append('country', JSON.stringify(
          typeof data.country === 'string' ? { en: data.country } : data.country
        ));
        if (data.image_copyright) formData.append('image_copyright', data.image_copyright);
        if (imageFile) formData.append('main_image', imageFile);

        const resp = await citiesAPI.update(initialCityData.id, formData);
        return resp.data;
      } else {
        // Create/update session city via sessions/<uuid>/city/
        const formData = new FormData();
        formData.append('name', JSON.stringify(data.name));
        formData.append('description', JSON.stringify(data.description));
        formData.append('country', JSON.stringify(
          typeof data.country === 'string' ? { en: data.country } : data.country
        ));
        if (data.image_copyright) formData.append('image_copyright', data.image_copyright);
        if (imageFile) formData.append('main_image', imageFile);

        const resp = await sessionsAPI.updateCity(session.id, formData);
        return resp.data;
      }
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
