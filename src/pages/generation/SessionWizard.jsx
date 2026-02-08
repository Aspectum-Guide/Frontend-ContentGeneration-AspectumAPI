import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../../components/Layout';
import Wizard from '../../components/wizard/Wizard';
import SessionSidebar from '../../components/generation/SessionSidebar';
import { sessionsAPI, citiesAPI } from '../../api/generation';
import Step1City from './steps/Step1City';
import Step2Attractions from './steps/Step2Attractions';
import Step3Content from './steps/Step3Content';
import Step4Commit from './steps/Step4Commit';
import { WIZARD_STEPS } from '../../utils/constants';

const ALL_STEPS = [
  WIZARD_STEPS.CITY,
  WIZARD_STEPS.ATTRACTIONS,
  WIZARD_STEPS.CONTENT,
  WIZARD_STEPS.COMMIT,
];

export default function SessionWizard() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [session, setSession] = useState(null);
  const [cities, setCities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState('');
  const [publishSuccess, setPublishSuccess] = useState('');
  const [selectedCity, setSelectedCity] = useState(undefined);

  useEffect(() => {
    loadSession();
  }, [sessionId]);

  useEffect(() => {
    if (!session) return;
    if (getSteps(session).length === 1 && currentStep !== 1) {
      setCurrentStep(1);
    }
  }, [session]);

  const loadSession = async () => {
    try {
      const response = await sessionsAPI.get(sessionId);
      setSession(response.data);
      // also load cities for content view
      if (response.data?.id) {
        await loadCities(response.data.id);
      }
    } catch (err) {
      console.error('Ошибка загрузки сессии:', err);
      navigate('/generation');
    } finally {
      setLoading(false);
    }
  };

  const loadCities = async (sessId) => {
    try {
      if (!sessId) {
        console.warn('loadCities: нет sessionId');
        return;
      }
      console.log('SessionWizard.loadCities - загрузка для сессии:', sessId);
      const citiesResponse = await citiesAPI.get(sessId);
      console.log('SessionWizard.loadCities - citiesResponse:', citiesResponse);
      console.log('SessionWizard.loadCities - citiesResponse.data:', citiesResponse.data);
      
      let citiesData = [];
      
      if (Array.isArray(citiesResponse.data)) {
        citiesData = citiesResponse.data;
      } else if (citiesResponse.data && typeof citiesResponse.data === 'object') {
        // Если это объект с results
        if (citiesResponse.data.results && Array.isArray(citiesResponse.data.results)) {
          citiesData = citiesResponse.data.results;
        } else if (citiesResponse.data.id) {
          // Если это один объект города
          citiesData = [citiesResponse.data];
        } else if (Object.keys(citiesResponse.data).length === 0) {
          // Пустой объект
          citiesData = [];
        }
      }
      
      console.log('SessionWizard.loadCities - итоговый citiesData:', citiesData);
      setCities(citiesData);
    } catch (err) {
      console.error('Ошибка загрузки городов:', err);
      console.error('Ошибка загрузки городов - детали:', err.response?.data);
      setCities([]);
    }
  };

  const handleNext = () => {
    if (currentStep < getSteps(session).length) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleStepChange = (step) => {
    setCurrentStep(step);
  };

  const handlePublish = async () => {
    if (!confirm('Опубликовать город в основную базу? Это действие нельзя отменить.')) {
      return;
    }

    setPublishing(true);
    setPublishError('');
    setPublishSuccess('');

    try {
      const response = await citiesAPI.publish(sessionId);
      setPublishSuccess(response.data.message);
      await loadSession();
      alert(`Успешно! ${response.data.message}\nГород ID: ${response.data.city.id}\nДостопримечательностей: ${response.data.attractions_count}`);
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.message || 'Ошибка публикации';
      setPublishError(errorMsg);
      console.error('Ошибка публикации:', err);
    } finally {
      setPublishing(false);
    }
  };

  const getSteps = (sessionData) => {
    if (sessionData?.content_type === 'city_only') {
      return [WIZARD_STEPS.CITY];
    }
    return ALL_STEPS;
  };

  const renderStep = () => {
    // Если выбран город (включая null для создания нового), показываем форму
    if (selectedCity !== undefined) {
      return (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">
              {selectedCity?.id ? 'Редактирование города' : 'Создание нового города'}
            </h2>
            <button
              onClick={() => setSelectedCity(undefined)}
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              ✕ Закрыть
            </button>
          </div>
          <Step1City 
            session={session}
            cityData={selectedCity}
            onComplete={async () => {
              // Сначала обновляем список городов
              await loadCities(session.id);
              // Потом обновляем сессию
              await loadSession();
              // Закрываем форму
              setSelectedCity(undefined);
            }}
            onSavedCity={(city) => {
              setCities((prev) => {
                const idx = prev.findIndex((p) => p.id === city.id);
                if (idx >= 0) {
                  const copy = [...prev]; copy[idx] = city; return copy;
                }
                return [...prev, city];
              });
            }}
          />
        </div>
      );
    }

    // Иначе показываем визард
    const steps = getSteps(session);
    const stepId = steps[currentStep - 1];

    switch (stepId) {
      case WIZARD_STEPS.CITY:
        // Если город не выбран — показываем содержание (список городов) или пустой экран
        if (selectedCity === undefined) {
          return (
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Содержание — Города</h3>
              <div className="space-y-2">
                {cities.map((c) => {
                  const cityName = typeof c.name === 'object'
                    ? (c.name?.en || c.name?.ru || Object.values(c.name || {})[0] || 'Без названия')
                    : (c.name || 'Без названия');
                  return (
                    <div key={c.id} className="p-3 border rounded-md hover:bg-gray-50 cursor-pointer" onClick={() => setSelectedCity(c)}>
                      <div className="text-sm font-medium text-gray-900">{cityName}</div>
                      {c.country && <div className="text-xs text-gray-500">{c.country}</div>}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        }
        return <Step1City session={session} onComplete={async () => {
          await loadCities(session.id);
          await loadSession();
        }} onSavedCity={(city) => {
          setCities((prev) => {
            const idx = prev.findIndex((p) => p.id === city.id);
            if (idx >= 0) {
              const copy = [...prev]; copy[idx] = city; return copy;
            }
            return [...prev, city];
          });
        }} />;
      case WIZARD_STEPS.ATTRACTIONS:
        return <Step2Attractions session={session} onComplete={loadSession} />;
      case WIZARD_STEPS.CONTENT:
        return <Step3Content session={session} onComplete={loadSession} />;
      case WIZARD_STEPS.COMMIT:
        return <Step4Commit session={session} onComplete={loadSession} />;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="text-center py-12">
          <p className="text-gray-600">Загрузка сессии...</p>
        </div>
      </Layout>
    );
  }

  if (!session) {
    return (
      <Layout>
        <div className="text-center py-12">
          <p className="text-red-600">Сессия не найдена</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="mb-6 flex justify-between items-center">
        <button
          onClick={() => navigate('/generation')}
          className="text-blue-600 hover:text-blue-800 text-sm"
        >
          ← Назад к списку сессий
        </button>

        {session && !session.is_published && (
          <button
            onClick={handlePublish}
            disabled={publishing}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 font-medium"
          >
            {publishing ? '📤 Публикация...' : '📤 Опубликовать в основную базу'}
          </button>
        )}

        {session?.is_published && (
          <div className="px-4 py-2 bg-green-50 border border-green-200 rounded-md">
            <span className="text-green-800 font-medium">
              ✅ Опубликовано (ID города: {session.published_city_id})
            </span>
          </div>
        )}
      </div>

      {publishError && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
          <p className="text-red-800">{publishError}</p>
        </div>
      )}

      {publishSuccess && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-md">
          <p className="text-green-800">{publishSuccess}</p>
        </div>
      )}

      {/* Настройки сессии */}
      {session && (
        <div className="mb-6 bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Настройки генерации</h3>
              <p className="text-sm text-gray-500 mt-1">
                Типа контента: {session.content_type === 'city_only' ? 'Только город' : 'Город с достопримечательностями'}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <label className="block text-xs text-gray-500 mb-1">Городов</label>
                <input
                  type="number"
                  value={session.cities_count || 1}
                  onChange={(e) => {
                    const newValue = parseInt(e.target.value);
                    if (newValue >= 1 && newValue <= 50) {
                      sessionsAPI.update(session.id, { cities_count: newValue }).then(loadSession);
                    }
                  }}
                  min="1"
                  max="50"
                  className="w-20 px-2 py-1 text-center border border-gray-300 rounded-md text-sm"
                />
              </div>
              {session.content_type === 'city_with_attractions' && (
                <div className="text-right">
                  <label className="block text-xs text-gray-500 mb-1">Достопримечательностей</label>
                  <input
                    type="number"
                    value={session.attractions_per_city || 10}
                    onChange={(e) => {
                      const newValue = parseInt(e.target.value);
                      if (newValue >= 1 && newValue <= 100) {
                        sessionsAPI.update(session.id, { attractions_per_city: newValue }).then(loadSession);
                      }
                    }}
                    min="1"
                    max="100"
                    className="w-20 px-2 py-1 text-center border border-gray-300 rounded-md text-sm"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Основной контент с сайдбаром */}
      <div className="flex gap-6">
        {/* Боковая панель со списком городов и достопримечательностей */}
        {session && (
          <SessionSidebar 
            session={session} 
            onCitySelect={setSelectedCity}
            selectedCityId={selectedCity?.id}
            onCitiesChange={(newCities) => {
              if (newCities && Array.isArray(newCities)) {
                setCities(newCities);
              } else {
                loadCities(session.id);
              }
            }}
            initialCities={cities}
          />
        )}

        {/* Основная область с визардом */}
        <div className="flex-1">
          <Wizard
            steps={getSteps(session)}
            currentStep={currentStep}
            onStepChange={handleStepChange}
            onNext={handleNext}
            onPrevious={handlePrevious}
            canGoNext={currentStep < getSteps(session).length}
            canGoPrevious={currentStep > 1}
          />

          <div className="mt-8">
            {renderStep()}
          </div>
        </div>
      </div>
    </Layout>
  );
}
