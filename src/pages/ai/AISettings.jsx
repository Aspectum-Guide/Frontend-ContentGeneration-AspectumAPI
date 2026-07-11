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

    <SourceToggles />
    </Layout>
  );
}

const SOURCE_GROUPS = [
  { key: 'photo', title: '📷 Фото' },
  { key: 'facts', title: '📚 Фактура (гиды и описания)' },
  { key: 'discovery', title: '🔎 Поиск достопримечательностей' },
];

const REGION_LABELS = { RU: 'Россия', 'RU-SPB': 'Санкт-Петербург' };

// Источники данных конвейера: включение/отключение без деплоя.
function SourceToggles() {
  const [sources, setSources] = useState(null);
  const [busyKey, setBusyKey] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    try {
      const response = await apiClient.get('/generation/sources/');
      setSources(response.data?.sources || []);
    } catch (err) {
      console.error('Error loading sources:', err);
      setSources([]);
      setError('Не удалось загрузить список источников');
    }
  };

  useEffect(() => {
    load();
  }, []);

  const setToggle = async (key, enabled) => {
    setBusyKey(key);
    setError('');
    try {
      const response = await apiClient.post(`/generation/sources/${key}/`, { enabled });
      setSources(response.data?.sources || []);
    } catch (err) {
      console.error('Error toggling source:', err);
      setError('Не удалось сохранить переключатель');
    } finally {
      setBusyKey('');
    }
  };

  if (!sources) return null;

  return (
    <div className="bg-white rounded-lg shadow-sm p-6 mt-6">
      <h2 className="text-xl font-bold mb-1">Источники данных</h2>
      <p className="text-sm text-gray-500 mb-4">
        Откуда конвейер берёт фото, факты и кандидатов достопримечательностей.
        Региональные источники срабатывают только для своих городов; серые —
        на сервере нет нужного API-ключа.
      </p>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg mb-4 text-sm">
          {error}
        </div>
      )}

      {SOURCE_GROUPS.map((group) => (
        <div key={group.key} className="mb-5 last:mb-0">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">{group.title}</h3>
          <div className="grid md:grid-cols-2 gap-2">
            {sources
              .filter((s) => s.group === group.key)
              .map((s) => {
                const checked = s.operator_toggle ?? s.default_on;
                const disabled = !s.env_ok || busyKey === s.key;
                return (
                  <label
                    key={s.key}
                    className={`flex items-start gap-2 p-2.5 rounded-lg border cursor-pointer ${
                      disabled
                        ? 'border-gray-100 bg-gray-50 opacity-60 cursor-not-allowed'
                        : 'border-gray-200 hover:border-blue-300'
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={checked}
                      disabled={disabled}
                      onChange={(e) => setToggle(s.key, e.target.checked)}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="text-sm font-medium text-gray-900">{s.title}</span>
                      <span className="block text-xs text-gray-500">{s.description}</span>
                      <span className="flex gap-1 mt-1 flex-wrap items-center">
                        {s.regions.map((r) => (
                          <span
                            key={r}
                            className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 text-[10px]"
                          >
                            {REGION_LABELS[r] || r}
                          </span>
                        ))}
                        {!s.env_ok && (
                          <span className="px-1.5 py-0.5 rounded bg-red-50 text-red-600 text-[10px]">
                            нужен ключ: {(s.requires_env || []).join(', ')}
                          </span>
                        )}
                        {s.operator_toggle != null && (
                          <button
                            type="button"
                            className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 text-[10px] hover:bg-gray-200"
                            onClick={(e) => {
                              e.preventDefault();
                              setToggle(s.key, null);
                            }}
                          >
                            {s.operator_toggle ? 'включён вручную' : 'выключен вручную'} — сбросить
                          </button>
                        )}
                      </span>
                    </span>
                  </label>
                );
              })}
          </div>
        </div>
      ))}
    </div>
  );
}
