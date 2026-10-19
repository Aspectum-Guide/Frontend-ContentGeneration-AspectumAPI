import { useCallback, useEffect, useState } from 'react';
import { citiesAPI, attractionsAPI } from '../../api/generation';

export default function useSessionSidebarData({ session, initialCities, onCitiesChange }) {
  const [cities, setCities] = useState([]);
  const [attractions, setAttractions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [expandedCities, setExpandedCities] = useState(new Set());

  const loadData = useCallback(async (attempt = 0) => {
    if (!session?.id) return;
    try {
      setLoading(true);
      const citiesResponse = await citiesAPI.get(session.id);
      const payload = citiesResponse.data;
      const nextCities = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.results) ? payload.results : payload?.id ? [payload] : [];
      setCities(nextCities);
      onCitiesChange?.(nextCities);

      const attractionsResponse = await attractionsAPI.list(session.id);
      const attractionsPayload = attractionsResponse.data;
      setAttractions(Array.isArray(attractionsPayload) ? attractionsPayload : attractionsPayload?.results || []);
    } catch (error) {
      if (error?.response?.status === 429 && attempt < 2) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
        return loadData(attempt + 1);
      }
      console.error('Ошибка загрузки данных:', error);
    } finally {
      setLoading(false);
    }
  }, [session?.id, onCitiesChange]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (Array.isArray(initialCities)) {
      setCities(initialCities);
      setLoading(false);
    }
  }, [initialCities]);

  const toggleCity = useCallback((cityId) => {
    setExpandedCities((current) => {
      const next = new Set(current);
      if (next.has(cityId)) next.delete(cityId);
      else next.add(cityId);
      return next;
    });
  }, []);

  const createCity = useCallback(async () => {
    if (creating || !session?.id) return null;
    setCreating(true);
    try {
      const response = await citiesAPI.createOrUpdate({ session: session.id, name: {}, description: {} });
      await loadData();
      return response.data;
    } finally {
      setCreating(false);
    }
  }, [creating, session?.id, loadData]);

  const deleteCity = useCallback(async (cityId) => {
    await citiesAPI.delete(cityId);
    await loadData();
  }, [loadData]);

  return { cities, attractions, loading, creating, expandedCities, toggleCity, loadData, createCity, deleteCity };
}
