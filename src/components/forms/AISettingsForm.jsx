import { useState, useEffect, useRef } from 'react';
import apiClient from '../../api/client';

export default function AISettingsForm() {
  const [settings, setSettings] = useState({
    provider: 'ollama',
    openai_api_key: '',
    openai_model: 'gpt-4-turbo-preview',
    ollama_base_url: 'http://localhost:11434',
    ollama_model: 'mistral',
    ollama_timeout: 300,
    ollama_temperature: 0.7,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [autoSaving, setAutoSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [testResult, setTestResult] = useState(null);
  const [ollamaModels, setOllamaModels] = useState([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const saveTimeoutRef = useRef(null);
  const isFirstLoadRef = useRef(true);

  useEffect(() => {
    loadSettings();
  }, []);

  useEffect(() => {
    if (settings.provider === 'ollama' && settings.ollama_base_url) {
      loadOllamaModels();
    }
  }, [settings.provider, settings.ollama_base_url]);

  // Автосохранение при изменении настроек
  useEffect(() => {
    // Пропускаем первую загрузку
    if (isFirstLoadRef.current) {
      isFirstLoadRef.current = false;
      return;
    }

    // Очищаем предыдущий таймер
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Устанавливаем новый таймер на автосохранение через 1 секунду
    setAutoSaving(true);
    saveTimeoutRef.current = setTimeout(() => {
      autoSaveSettings();
    }, 1000);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [settings]);

  const autoSaveSettings = async () => {
    try {
      await apiClient.post('/generation/ai-settings/', settings);
      setAutoSaving(false);
      setSuccess('✓ Автосохранено');
      setTimeout(() => setSuccess(''), 2000);
    } catch (err) {
      setAutoSaving(false);
      console.error('Ошибка автосохранения:', err);
    }
  };

  const loadSettings = async () => {
    try {
      const response = await apiClient.get('/generation/ai-settings/');
      setSettings(response.data);
      setError('');
    } catch (err) {
      console.error('Ошибка загрузки настроек:', err);
      setError('Не удалось загрузить настройки');
    } finally {
      setLoading(false);
    }
  };

  const loadOllamaModels = async () => {
    setLoadingModels(true);
    try {
      const response = await apiClient.get('/generation/ai-settings/ollama-models/');
      if (response.data.status === 'success') {
        setOllamaModels(response.data.models || []);
      } else {
        setOllamaModels([]);
      }
    } catch (err) {
      console.error('Ошибка загрузки моделей:', err);
      setOllamaModels([]);
    } finally {
      setLoadingModels(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type } = e.target;
    setSettings({
      ...settings,
      [name]: type === 'number' ? parseFloat(value) : value,
    });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      await apiClient.post('/generation/ai-settings/', settings);
      setSuccess('Настройки успешно сохранены');
    } catch (err) {
      setError('Ошибка сохранения настроек: ' + (err.response?.data?.detail || err.message));
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setTestResult({ status: 'loading' });
    try {
      const response = await apiClient.post('/generation/ai-settings/test_connection/');
      setTestResult({ status: 'success', message: response.data.message });
    } catch (err) {
      setTestResult({
        status: 'error',
        message: err.response?.data?.message || 'Ошибка подключения',
      });
    }
  };

  if (loading) {
    return <div className="p-4">Загрузка настроек...</div>;
  }

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Настройки AI</h2>
        {autoSaving && (
          <span className="text-sm text-blue-600 animate-pulse">
            💾 Сохранение...
          </span>
        )}
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {success && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded">
          <p className="text-green-800">{success}</p>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Провайдер AI
          </label>
          <select
            name="provider"
            value={settings.provider}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="ollama">Ollama (Локальный)</option>
            <option value="openai">OpenAI</option>
          </select>
        </div>

        {settings.provider === 'ollama' && (
          <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
            <h3 className="text-lg font-semibold text-gray-900">Ollama настройки</h3>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                URL сервера Ollama
              </label>
              <input
                type="text"
                name="ollama_base_url"
                value={settings.ollama_base_url}
                onChange={handleChange}
                placeholder="http://localhost:11434"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Модель Ollama
              </label>
              {loadingModels ? (
                <div className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50">
                  Загрузка моделей...
                </div>
              ) : (
                <div className="space-y-2">
                  <input
                    type="text"
                    name="ollama_model"
                    value={settings.ollama_model}
                    onChange={handleChange}
                    list="ollama-models-list"
                    placeholder="mistral"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {ollamaModels.length > 0 && (
                    <datalist id="ollama-models-list">
                      {ollamaModels.map((model) => (
                        <option key={model} value={model} />
                      ))}
                    </datalist>
                  )}
                  {ollamaModels.length === 0 && (
                    <p className="text-sm text-amber-600">
                      ⚠️ Модели не найдены. Убедитесь что Ollama запущен и URL корректен.
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={loadOllamaModels}
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    🔄 Обновить список моделей
                  </button>
                  {ollamaModels.length > 0 && (
                    <p className="text-sm text-gray-500">
                      Доступно моделей: {ollamaModels.length}
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Таймаут (сек)
                </label>
                <input
                  type="number"
                  name="ollama_timeout"
                  value={settings.ollama_timeout}
                  onChange={handleChange}
                  min="1"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Температура (0-1)
                </label>
                <input
                  type="number"
                  name="ollama_temperature"
                  value={settings.ollama_temperature}
                  onChange={handleChange}
                  min="0"
                  max="1"
                  step="0.1"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>
        )}

        {settings.provider === 'openai' && (
          <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
            <h3 className="text-lg font-semibold text-gray-900">OpenAI настройки</h3>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                API Ключ OpenAI
              </label>
              <input
                type="password"
                name="openai_api_key"
                value={settings.openai_api_key}
                onChange={handleChange}
                placeholder="sk-..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Модель OpenAI
              </label>
              <input
                type="text"
                name="openai_model"
                value={settings.openai_model}
                onChange={handleChange}
                placeholder="gpt-4-turbo-preview"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        )}

        <div className="flex gap-4">
          <button
            type="submit"
            disabled={saving}
            className="flex-1 py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 font-medium"
          >
            {saving ? 'Сохранение...' : 'Сохранить настройки'}
          </button>

          <button
            type="button"
            onClick={handleTestConnection}
            className="flex-1 py-2 px-4 bg-gray-600 text-white rounded-md hover:bg-gray-700 font-medium"
          >
            Тест подключения
          </button>
        </div>

        {testResult && (
          <div
            className={`p-4 rounded-lg ${
              testResult.status === 'loading'
                ? 'bg-blue-50 text-blue-800'
                : testResult.status === 'success'
                ? 'bg-green-50 text-green-800'
                : 'bg-red-50 text-red-800'
            }`}
          >
            {testResult.status === 'loading' ? (
              <p>Проверка подключения...</p>
            ) : (
              <p>{testResult.message}</p>
            )}
          </div>
        )}
      </form>
    </div>
  );
}
