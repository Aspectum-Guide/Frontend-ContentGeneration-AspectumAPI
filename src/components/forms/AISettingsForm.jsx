import { useState, useEffect } from 'react';
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
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [testResult, setTestResult] = useState(null);

  useEffect(() => {
    loadSettings();
  }, []);

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
      <h2 className="text-2xl font-bold mb-6">Настройки AI</h2>

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
              <input
                type="text"
                name="ollama_model"
                value={settings.ollama_model}
                onChange={handleChange}
                placeholder="mistral"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
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
