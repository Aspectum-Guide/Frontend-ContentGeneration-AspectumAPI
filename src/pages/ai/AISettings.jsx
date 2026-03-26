import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import apiClient from '../../api/client';
import Button from '../../components/ui/Button';

export default function AISettings() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.get('/generation/ai/settings/');
      setSettings(response.data);
    } catch (err) {
      console.error('Error loading AI settings:', err);
      setError('Ошибка загрузки настроек ИИ');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      setError(null);
      setSuccessMessage('');

      const updateData = {
        provider: settings.provider,
        ...(settings.openai?.model && { openai_model: settings.openai.model }),
        ...(settings.openai?.api_key && { openai_api_key: settings.openai.api_key }),
        ...(settings.ollama && {
          ollama_base_url: settings.ollama.base_url,
          ollama_model: settings.ollama.model,
          ollama_timeout: settings.ollama.timeout,
          ollama_temperature: settings.ollama.temperature,
        }),
      };

      await apiClient.post('/generation/ai/settings/update/', updateData);
      setSuccessMessage('✅ Настройки сохранены!');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      console.error('Error saving AI settings:', err);
      setError('Ошибка сохранения настроек');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-96">
          <p className="text-gray-500">Загрузка настроек...</p>
        </div>
      </Layout>
    );
  }

  if (!settings) {
    return (
      <Layout>
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h1 className="text-2xl font-bold mb-6">Настройки ИИ</h1>
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            <p className="font-medium">⚠️ Ошибка загрузки настроек</p>
            <p className="text-sm mt-2">{error || 'Не удалось загрузить настройки ИИ. Проверьте соединение или перезагрузитесь.'}</p>
          </div>
          <Button 
            variant="primary" 
            onClick={loadSettings}
          >
            ↻ Повторить
          </Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="bg-white rounded-lg shadow-sm p-6">
      <h1 className="text-2xl font-bold mb-6">Настройки ИИ</h1>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      {successMessage && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-6">
          {successMessage}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Provider Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Поставщик ИИ
          </label>
          <select
            value={settings.provider}
            onChange={(e) =>
              setSettings({ ...settings, provider: e.target.value })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="openai">OpenAI (GPT-4)</option>
            <option value="ollama">Ollama (локально)</option>
          </select>
        </div>

        {/* OpenAI Settings */}
        {settings.provider === 'openai' && (
          <div className="border-l-4 border-blue-500 pl-4 space-y-4">
            <h3 className="font-semibold text-gray-900">OpenAI Settings</h3>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Модель
              </label>
              <input
                type="text"
                value={settings.openai?.model || ''}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    openai: { ...settings.openai, model: e.target.value },
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="gpt-4-turbo-preview"
              />
              <p className="text-xs text-gray-500 mt-1">
                Например: gpt-4-turbo-preview, gpt-4o, gpt-3.5-turbo
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                API Ключ
              </label>
              <input
                type="password"
                placeholder="sk-..."
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    openai: { ...settings.openai, api_key: e.target.value },
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">
                {settings.openai?.has_api_key
                  ? '✅ API ключ сохранен'
                  : '⚠️ API ключ не установлен'}
              </p>
            </div>
          </div>
        )}

        {/* Ollama Settings */}
        {settings.provider === 'ollama' && (
          <div className="border-l-4 border-orange-500 pl-4 space-y-4">
            <h3 className="font-semibold text-gray-900">Ollama Settings</h3>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Base URL
              </label>
              <input
                type="text"
                value={settings.ollama?.base_url || ''}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    ollama: { ...settings.ollama, base_url: e.target.value },
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="http://localhost:11434"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Модель
              </label>
              <select
                value={settings.ollama?.model || ''}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    ollama: { ...settings.ollama, model: e.target.value },
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Выбрать модель...</option>
                {settings.ollama?.models?.map((model) => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                {settings.ollama?.available
                  ? '✅ Ollama доступна'
                  : '❌ Ollama не доступна'}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Timeout (сек)
                </label>
                <input
                  type="number"
                  min="1"
                  value={settings.ollama?.timeout || 300}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      ollama: {
                        ...settings.ollama,
                        timeout: parseInt(e.target.value),
                      },
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Temperature (0-1)
                </label>
                <input
                  type="number"
                  min="0"
                  max="1"
                  step="0.1"
                  value={settings.ollama?.temperature || 0.7}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      ollama: {
                        ...settings.ollama,
                        temperature: parseFloat(e.target.value),
                      },
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>
        )}

        <div className="flex gap-3 pt-4">
          <Button
            type="submit"
            variant="primary"
            disabled={saving}
          >
            {saving ? 'Сохранение...' : 'Сохранить'}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={loadSettings}
          >
            Отменить
          </Button>
        </div>
      </form>
    </div>
    </Layout>
  );
}
