import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import apiClient from '../../api/client';
import { FormLabel, Alert, Button, Checkbox, EmptyState, Heading, PageHeader, Panel, SectionHeader, Select, Spinner, TextInput } from '@aspectum/ui';

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
          <EmptyState icon={<Spinner size="md" />} title="Загрузка настроек..." spacing="md" />
        </div>
      </Layout>
    );
  }

  if (!settings) {
    return (
      <Layout>
        <Panel className="p-6 shadow-aspectum-card">
          <PageHeader title="Настройки ИИ" />
          <Alert tone="error" className="mb-6">
            <p className="font-medium">Ошибка загрузки настроек</p>
            <p className="text-sm mt-2">{error || 'Не удалось загрузить настройки ИИ. Проверьте соединение или перезагрузитесь.'}</p>
          </Alert>
          <Button 
            variant="primary" 
            onClick={loadSettings}
          >
            ↻ Повторить
          </Button>
        </Panel>
      </Layout>
    );
  }

  return (
    <Layout>
      <Panel className="p-6 shadow-aspectum-card">
      <PageHeader title="Настройки ИИ" />

      {error && (
        <Alert tone="error">{error}</Alert>
      )}

      {successMessage && (
        <Alert tone="success" className="mb-6">{successMessage}</Alert>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Provider Selection */}
        <div>
          <FormLabel  layout="block" size="sm" weight="medium" tone="strong" spacing="sm">
            Поставщик ИИ
          </FormLabel>
          <Select
            value={settings.provider}
            onChange={(e) =>
              setSettings({ ...settings, provider: e.target.value })
            }
          >
            <option value="openai">OpenAI (GPT-4)</option>
            <option value="ollama">Ollama (локально)</option>
          </Select>
        </div>

        {/* OpenAI Settings */}
        {settings.provider === 'openai' && (
          <div className="border-l-4 border-aspectum-focus pl-4 space-y-4">
            <Heading level={3} size="sm">OpenAI Settings</Heading>

            <div>
              <FormLabel  layout="block" size="sm" weight="medium" tone="strong" spacing="sm">
                Модель
              </FormLabel>
              <TextInput
                type="text"
                value={settings.openai?.model || ''}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    openai: { ...settings.openai, model: e.target.value },
                  })
                }
                placeholder="gpt-4-turbo-preview"
              />
              <p className="text-xs text-aspectum-text-muted mt-1">
                Например: gpt-4-turbo-preview, gpt-4o, gpt-3.5-turbo
              </p>
            </div>

            <div>
              <FormLabel  layout="block" size="sm" weight="medium" tone="strong" spacing="sm">
                API Ключ
              </FormLabel>
              <TextInput
                type="password"
                placeholder="sk-..."
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    openai: { ...settings.openai, api_key: e.target.value },
                  })
                }
              />
              <p className="text-xs text-aspectum-text-muted mt-1">
                {settings.openai?.has_api_key
                  ? '✅ API ключ сохранен'
                  : '⚠️ API ключ не установлен'}
              </p>
            </div>
          </div>
        )}

        {/* Ollama Settings */}
        {settings.provider === 'ollama' && (
          <div className="border-l-4 border-aspectum-orange-subtle pl-4 space-y-4">
            <Heading level={3} size="sm">Ollama Settings</Heading>

            <div>
              <FormLabel  layout="block" size="sm" weight="medium" tone="strong" spacing="sm">
                Base URL
              </FormLabel>
              <TextInput
                type="text"
                value={settings.ollama?.base_url || ''}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    ollama: { ...settings.ollama, base_url: e.target.value },
                  })
                }
                placeholder="http://localhost:11434"
              />
            </div>

            <div>
              <FormLabel  layout="block" size="sm" weight="medium" tone="strong" spacing="sm">
                Модель
              </FormLabel>
              <Select
                value={settings.ollama?.model || ''}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    ollama: { ...settings.ollama, model: e.target.value },
                  })
                }
              >
                <option value="">Выбрать модель...</option>
                {settings.ollama?.models?.map((model) => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
              </Select>
              <p className="text-xs text-aspectum-text-muted mt-1">
                {settings.ollama?.available
                  ? '✅ Ollama доступна'
                  : '❌ Ollama не доступна'}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <FormLabel  layout="block" size="sm" weight="medium" tone="strong" spacing="sm">
                  Timeout (сек)
                </FormLabel>
                <TextInput
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
                />
              </div>

              <div>
                <FormLabel  layout="block" size="sm" weight="medium" tone="strong" spacing="sm">
                  Temperature (0-1)
                </FormLabel>
                <TextInput
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
    </Panel>

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
    <Panel className="mt-6 p-6 shadow-aspectum-card">
      <SectionHeader
        title="Источники данных"
        description="Откуда конвейер берёт фото, факты и кандидатов достопримечательностей. Региональные источники срабатывают только для своих городов; серые — на сервере нет нужного API-ключа."
        size="lg"
        className="mb-4"
      />

      {error && (
        <Alert tone="error">{error}</Alert>
      )}

      {SOURCE_GROUPS.map((group) => (
        <div key={group.key} className="mb-5 last:mb-0">
          <SectionHeader title={group.title} level={3} size="xs" className="mb-2" />
          <div className="grid md:grid-cols-2 gap-2">
            {sources
              .filter((s) => s.group === group.key)
              .map((s) => {
                const checked = s.operator_toggle ?? s.default_on;
                const disabled = !s.env_ok || busyKey === s.key;
                return (
                  <FormLabel
                    key={s.key}
                    className={`flex items-start gap-2 p-2.5 rounded-aspectum-control border cursor-pointer ${
                      disabled
                        ? 'border-aspectum-border-subtle bg-aspectum-surface-muted opacity-60 cursor-not-allowed'
                        : 'border-aspectum-border hover:border-aspectum-primary-border-strong'
                    }`}
                  >
                    <Checkbox
                      className="mt-1"
                      checked={checked}
                      disabled={disabled}
                      onChange={(e) => setToggle(s.key, e.target.checked)}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="text-sm font-medium text-aspectum-text">{s.title}</span>
                      <span className="block text-xs text-aspectum-text-muted">{s.description}</span>
                      <span className="flex gap-1 mt-1 flex-wrap items-center">
                        {s.regions.map((r) => (
                          <span
                            key={r}
                            className="px-1.5 py-0.5 rounded bg-aspectum-warning-soft text-aspectum-warning-strong text-[10px]"
                          >
                            {REGION_LABELS[r] || r}
                          </span>
                        ))}
                        {!s.env_ok && (
                          <span className="px-1.5 py-0.5 rounded bg-aspectum-danger-soft text-aspectum-danger text-[10px]">
                            нужен ключ: {(s.requires_env || []).join(', ')}
                          </span>
                        )}
                        {s.operator_toggle != null && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="xxs"
                            onClick={(e) => {
                              e.preventDefault();
                              setToggle(s.key, null);
                            }}
                          >
                            {s.operator_toggle ? 'включён вручную' : 'выключен вручную'} — сбросить
                          </Button>
                        )}
                      </span>
                    </span>
                  </FormLabel>
                );
              })}
          </div>
        </div>
      ))}
    </Panel>
  );
}
