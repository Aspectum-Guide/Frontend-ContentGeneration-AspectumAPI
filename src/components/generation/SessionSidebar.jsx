import { useState, useEffect } from 'react';
import { citiesAPI, attractionsAPI } from '../../api/generation';

export default function SessionSidebar({ session, onCitySelect, selectedCityId, onCitiesChange, initialCities }) {
  const [cities, setCities] = useState([]);
  const [attractions, setAttractions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [expandedCities, setExpandedCities] = useState(new Set());

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id]);

  // Обновляем cities когда изменяются initialCities
  useEffect(() => {
    if (initialCities && Array.isArray(initialCities)) {
      setCities(initialCities);
      setLoading(false);
    }
  }, [initialCities]);

  const loadData = async (attempt = 0) => {
    if (!session?.id) return;

    try {
      setLoading(true);

      // Загружаем города
      const citiesResponse = await citiesAPI.get(session.id);
      console.log('SessionSidebar.loadData - citiesResponse:', citiesResponse);
      console.log('SessionSidebar.loadData - citiesResponse.data:', citiesResponse.data);
      
      let citiesData = [];
      if (Array.isArray(citiesResponse.data)) {
        citiesData = citiesResponse.data;
      } else if (citiesResponse.data && typeof citiesResponse.data === 'object') {
        if (citiesResponse.data.results && Array.isArray(citiesResponse.data.results)) {
          citiesData = citiesResponse.data.results;
        } else if (citiesResponse.data.id) {
          citiesData = [citiesResponse.data];
        }
      }
      
      console.log('SessionSidebar.loadData - итоговый citiesData:', citiesData);
      setCities(citiesData);
      if (onCitiesChange) {
        onCitiesChange(citiesData);
      }

      // Загружаем достопримечательности
      const attractionsResponse = await attractionsAPI.list(session.id);
      const attractionsData = Array.isArray(attractionsResponse.data)
        ? attractionsResponse.data
        : attractionsResponse.data.results || [];
      setAttractions(attractionsData);
    } catch (err) {
      // Простая обработка rate limit: при 429 попробуем ещё раз один раз
      const status = err?.response?.status;
      if (status === 429 && attempt < 2) {
        console.warn('Rate limited when loading data, retrying...', { attempt, err });
        await new Promise((res) => setTimeout(res, 1000 * (attempt + 1)));
        return loadData(attempt + 1);
      }
      console.error('Ошибка загрузки данных:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleCity = (cityId) => {
    const newExpanded = new Set(expandedCities);
    if (newExpanded.has(cityId)) {
      newExpanded.delete(cityId);
    } else {
      newExpanded.add(cityId);
    }
    setExpandedCities(newExpanded);
  };

  const getCityName = (city) => {
    if (!city.name) return 'Без названия';
    if (typeof city.name === 'object') {
      return city.name.en || city.name.ru || Object.values(city.name)[0] || 'Без названия';
    }
    return city.name;
  };

  const getAttractionName = (attraction) => {
    if (!attraction.name) return 'Без названия';
    if (typeof attraction.name === 'object') {
      return attraction.name.en || attraction.name.ru || Object.values(attraction.name)[0] || 'Без названия';
    }
    return attraction.name;
  };

  if (loading) {
    return (
      <div className="w-80 bg-white border-r border-gray-200 p-4">
        <p className="text-gray-500 text-sm">Загрузка...</p>
      </div>
    );
  }

  return (
    <div className="w-80 bg-white border-r border-gray-200 overflow-y-auto">
      <div className="p-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Содержание</h3>

        {/* Список городов */}
        <div className="space-y-2">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium text-gray-700">Города</h4>
            <button
              onClick={async () => {
                if (creating) return;
                setCreating(true);
                // Создаём пустой город на бэкенде и открываем его для редактирования
                try {
                  // Некоторые серверы валидируют наличие name/description — отправим минимальные пустые значения
                  const payload = { session: session.id, name: {}, description: {} };
                  const resp = await citiesAPI.createOrUpdate(payload);
                  console.debug('SessionSidebar.create - resp:', resp);
                  const created = resp.data;
                  // Обновить список и выбрать созданный город
                  await loadData();
                  // loadData уже вызывает onCitiesChange с новыми данными через setCities
                  if (onCitySelect) {
                    onCitySelect(created);
                  }
                } catch (err) {
                  const status = err?.response?.status;
                  console.error('Ошибка создания города:', err);
                  if (status === 400) {
                    alert('Сервер отверг создание города: проверьте обязательные поля (400).');
                  } else if (status === 429) {
                    alert('Сервер перегружен (429). Попробуйте ещё раз через несколько секунд.');
                  } else {
                    alert('Не удалось создать город');
                  }
                } finally {
                  setCreating(false);
                }
              }}
              className={`text-xs ${creating ? 'text-gray-400' : 'text-blue-600 hover:text-blue-800'}`}
              disabled={creating}
            >
              {creating ? 'Создание...' : '+ Создать'}
            </button>
          </div>

          {cities.map((city) => (
            <div key={city.id} className="border border-gray-200 rounded-md">
              <div
                className={`p-3 cursor-pointer hover:bg-gray-50 flex items-center justify-between ${
                  selectedCityId === city.id ? 'bg-blue-50 border-blue-500' : ''
                }`}
                onClick={() => onCitySelect(city)}
              >
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-900">{getCityName(city)}</div>
                  {city.country && <div className="text-xs text-gray-500">{city.country}</div>}
                </div>
                {session.content_type === 'city_with_attractions' && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleCity(city.id);
                    }}
                    className="text-gray-400 hover:text-gray-600 ml-2"
                  >
                    {expandedCities.has(city.id) ? '▼' : '▶'}
                  </button>
                )}
                <button
                  onClick={async (e) => {
                    e.stopPropagation();
                    if (!confirm('Удалить город из сессии?')) return;
                    try {
                      await citiesAPI.delete(city.id);
                      await loadData();
                      if (onCitySelect) onCitySelect(undefined);
                    } catch (err) {
                      console.error('Ошибка удаления города:', err);
                      alert('Не удалось удалить город');
                    }
                  }}
                  className="ml-2 text-red-500 hover:text-red-700"
                  title="Удалить город"
                >
                  🗑
                </button>
              </div>

              {/* Достопримечательности города */}
              {session.content_type === 'city_with_attractions' && expandedCities.has(city.id) && (
                <div className="border-t border-gray-200 bg-gray-50 p-2">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-gray-600">
                      Достопримечательности ({attractions.filter((a) => a.session === session.id).length}/
                      {session.attractions_per_city || 10})
                    </span>
                    <button onClick={() => {}} className="text-xs text-blue-600 hover:text-blue-800">
                      + Добавить
                    </button>
                  </div>
                  <div className="space-y-1">
                    {attractions
                      .filter((a) => a.session === session.id)
                      .map((attraction) => (
                        <div
                          key={attraction.id}
                          className="text-xs p-2 bg-white rounded border border-gray-200 hover:border-blue-300 cursor-pointer"
                        >
                          {getAttractionName(attraction)}
                        </div>
                      ))}
                    {attractions.filter((a) => a.session === session.id).length === 0 && (
                      <p className="text-xs text-gray-400 italic">Нет достопримечательностей</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Кнопка обновить */}
        <button
          onClick={loadData}
          className="mt-4 w-full py-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-md hover:bg-gray-50"
        >
          🔄 Обновить список
        </button>
      </div>
    </div>
  );
}
