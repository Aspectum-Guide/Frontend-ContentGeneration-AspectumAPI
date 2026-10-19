import { useState, useEffect, useRef } from 'react';
import Layout from '../../components/Layout';
import { Alert, Button, PageContainer, PageHeader, Panel, ProgressBar, SectionHeader, Spinner, TextInput } from '@aspectum/ui';
import { ttsAPI } from '../../api/generation';
import AudioProcessingMixer from '../../components/tts/AudioProcessingMixer';

const CATEGORY_MESSAGES = {
  elevenlabs_access_restricted:
    'ElevenLabs недоступен с текущего IP или региона сервера. Ключ может быть корректным, но запросы блокируются.',
  elevenlabs_network_error:
    'Не удалось подключиться к ElevenLabs API. Проверьте сетевой доступ с сервера.',
  elevenlabs_unavailable:
    'ElevenLabs API временно недоступен.',
};

function StatusBadge({ configured, externalAvailable, stale, cached }) {
  if (!configured) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-aspectum-danger-muted text-aspectum-danger-strong">
        Не настроен
      </span>
    );
  }
  if (externalAvailable) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-aspectum-positive-muted text-aspectum-positive-strong">
        {stale ? 'Кеш устарел' : cached ? 'Кеш' : 'Подключён'}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-aspectum-warning-muted text-aspectum-warning-strong">
      API недоступен
    </span>
  );
}

function VoiceCard({ voice, isDefault, onPreview }) {
  const labels = voice.labels || {};
  const labelParts = [labels.gender, labels.accent, labels.language, labels.age].filter(Boolean);

  return (
    <div className={`rounded-aspectum-control border p-3 ${isDefault ? 'border-aspectum-primary-light bg-aspectum-primary-soft' : 'border-aspectum-border bg-aspectum-surface'}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm text-aspectum-text">{voice.name}</span>
            {isDefault && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-aspectum-primary text-aspectum-on-accent">по умолчанию</span>
            )}
            {voice.category && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-aspectum-surface-subtle text-aspectum-text-subtle">{voice.category}</span>
            )}
          </div>
          {labelParts.length > 0 && (
            <p className="text-xs text-aspectum-text-muted mt-0.5">{labelParts.join(' · ')}</p>
          )}
          <p className="text-xs text-aspectum-text-disabled font-mono mt-0.5">{voice.voice_id}</p>
        </div>
        {voice.preview_url && (
          <Button
            type="button"
            onClick={() => onPreview(voice)}
            variant="outline"
            size="sm"
            className="shrink-0"
          >
            ▶ Слушать
          </Button>
        )}
      </div>
    </div>
  );
}

export default function TTSSettings() {
  const [data, setData] = useState(null);
  const [providerData, setProviderData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [voiceSearch, setVoiceSearch] = useState('');
  const audioRef = useRef(null);
  const [playingId, setPlayingId] = useState(null);

  const load = async ({ refresh = false } = {}) => {
    try {
      refresh ? setRefreshing(true) : setLoading(true);
      setError(null);
      const [providerRes, elevenLabsRes] = await Promise.all([
        ttsAPI.getSettings(),
        ttsAPI.getElevenLabsSettings({ refresh }),
      ]);
      setProviderData(providerRes.data);
      setData(elevenLabsRes.data);
    } catch (err) {
      setError('Не удалось загрузить настройки ElevenLabs');
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handlePreview = (voice) => {
    if (!voice.preview_url) return;

    if (audioRef.current) {
      audioRef.current.pause();
    }

    if (playingId === voice.voice_id) {
      setPlayingId(null);
      return;
    }

    audioRef.current = new Audio(voice.preview_url);
    audioRef.current.onended = () => setPlayingId(null);
    audioRef.current.play().catch(() => {});
    setPlayingId(voice.voice_id);
  };

  const voices = data?.voices ?? [];
  const models = data?.models ?? [];
  const subscription = data?.subscription;
  const defaults = data?.defaults ?? {};
  const cacheInfo = data?.cache ?? {};

  const filteredVoices = voiceSearch.trim()
    ? voices.filter((v) => {
        const q = voiceSearch.toLowerCase();
        const labels = v.labels || {};
        return (
          (v.name || '').toLowerCase().includes(q) ||
          (v.category || '').toLowerCase().includes(q) ||
          Object.values(labels).some((l) => String(l).toLowerCase().includes(q))
        );
      })
    : voices;

  const warningMessage = data?.error_category
    ? CATEGORY_MESSAGES[data.error_category] || data.warning
    : data?.warning || null;

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-96 text-aspectum-text-disabled text-sm">
          Загрузка настроек TTS...
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <PageContainer maxWidth="wide" spacing="lg">

        <PageHeader
          title="Настройки TTS"
          description="Fish Audio используется по умолчанию, ElevenLabs остаётся доступен для выбора. Общий профиль обработки хранится в базе."
          spacing="none"
          actions={<Button
            type="button"
            onClick={() => load({ refresh: true })}
            disabled={refreshing}
            variant="outline"
            size="md"
          >
            {refreshing ? (
              <Spinner size="xs" className="w-3.5 h-3.5 border border-aspectum-border-disabled" />
            ) : '↻'}
            Обновить кеш
          </Button>}
        />

        {error && (
          <Alert tone="error">
            {error}
            <Button variant="link" size="sm" onClick={() => load()} className="ml-3">Повторить</Button>
          </Alert>
        )}

        {providerData?.providers?.find((item) => item.id === 'fish_audio') ? (() => {
          const fish = providerData.providers.find((item) => item.id === 'fish_audio');
          const usesFreeModel = fish.defaults?.model_id === 's2.1-pro-free';
          const noCredit = !usesFreeModel && fish.credit &&
            Number(fish.credit.credit || 0) <= 0 && !fish.credit.has_free_credit;
          return (
            <Panel className="p-5 space-y-2">
              <SectionHeader size="sm" title="Fish Audio — S2.1 Pro Free" actions={<span className={`text-xs font-medium ${fish.configured && !noCredit ? 'text-aspectum-positive-strong' : 'text-aspectum-danger-strong'}`}>
                  {!fish.configured ? 'Ключ не настроен' : noCredit ? 'Нет API-кредита' : 'Готов'}
                </span>} />
              <p className="text-sm text-aspectum-text-muted">
                Провайдер по умолчанию: {providerData.default_provider === 'fish_audio' ? 'да' : 'нет'}.
                Модель: {fish.defaults?.model_id || 's2.1-pro-free'}. Голос можно оставить
                стандартным или указать Reference ID в аудиогиде.
              </p>
              {noCredit ? (
                <p className="text-sm text-aspectum-danger-strong">
                  Fish API сообщает нулевой баланс без бесплатного кредита. Активируйте промо
                  или API credit в кабинете Fish Audio.
                </p>
              ) : null}
              {fish.warning ? <p className="text-sm text-aspectum-warning-strong">{fish.warning}</p> : null}
            </Panel>
          );
        })() : null}

        {/* Статус подключения ElevenLabs */}
        <Panel className="p-5 space-y-4">
          <SectionHeader size="sm" title="Статус подключения" actions={data ? (
              <StatusBadge
                configured={data.configured}
                externalAvailable={data.external_available}
                stale={data.stale}
                cached={data.cached}
              />
            ) : null} />

          {!data?.configured && (
            <Alert tone="warning">
              <p className="font-medium">ELEVENLABS_API_KEY не задан</p>
              <p className="mt-1 text-xs">Добавьте ключ в переменные окружения сервера и перезапустите его.</p>
            </Alert>
          )}

          {warningMessage && data?.configured && (
            <Alert tone="warning">{warningMessage}</Alert>
          )}

          {data?.refresh_throttled && (
            <p className="text-xs text-aspectum-text-disabled">
              Кеш обновлялся недавно — данные актуальны. Следующее обновление доступно через несколько минут.
            </p>
          )}

          {/* Настройки по умолчанию */}
          {data?.configured && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              {[
                { label: 'Голос по умолчанию', value: defaults.voice_id },
                { label: 'Модель по умолчанию', value: defaults.model_id },
                { label: 'Формат', value: defaults.output_format },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-aspectum-control bg-aspectum-surface-muted border border-aspectum-border-subtle px-3 py-2">
                  <p className="text-xs text-aspectum-text-muted">{label}</p>
                  <p className="text-sm font-mono text-aspectum-text mt-0.5 truncate">{value || '—'}</p>
                </div>
              ))}
            </div>
          )}
        </Panel>

        {/* Подписка */}
        {subscription && (
          <Panel className="p-5 space-y-3">
            <SectionHeader size="sm" title="Подписка" />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Тариф', value: subscription.tier || '—' },
                {
                  label: 'Символов использовано',
                  value: subscription.character_count?.toLocaleString('ru-RU') ?? '—',
                },
                {
                  label: 'Лимит символов',
                  value: subscription.character_limit?.toLocaleString('ru-RU') ?? '—',
                },
                {
                  label: 'Осталось',
                  value: subscription.remaining_characters?.toLocaleString('ru-RU') ?? '—',
                },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-aspectum-control bg-aspectum-surface-muted border border-aspectum-border-subtle px-3 py-2">
                  <p className="text-xs text-aspectum-text-muted">{label}</p>
                  <p className="text-sm font-semibold text-aspectum-text mt-0.5">{value}</p>
                </div>
              ))}
            </div>
            {subscription.character_limit && subscription.character_count != null && (
              <div>
                <div className="flex justify-between text-xs text-aspectum-text-muted mb-1">
                  <span>Использование</span>
                  <span>
                    {Math.round((subscription.character_count / subscription.character_limit) * 100)}%
                  </span>
                </div>
                <ProgressBar
                  value={subscription.character_count}
                  max={subscription.character_limit}
                  tone="focus"
                  track="surface"
                  label="Использование символов"
                />
              </div>
            )}
          </Panel>
        )}

        <AudioProcessingMixer
          value={data?.audio_processing}
          onSaved={(audioProcessing) =>
            setData((current) => ({
              ...(current || {}),
              audio_processing: audioProcessing,
            }))
          }
        />

        {/* Модели */}
        {models.length > 0 && (
          <Panel className="p-5 space-y-3">
            <SectionHeader size="sm" title="Доступные модели" />
            <div className="space-y-2">
              {models.map((model) => (
                <div
                  key={model.model_id}
                  className={`rounded-aspectum-control border px-3 py-2 flex items-start justify-between gap-3 ${
                    model.model_id === defaults.model_id
                      ? 'border-aspectum-primary-light bg-aspectum-primary-soft'
                      : 'border-aspectum-border'
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-aspectum-text">{model.name}</span>
                      {model.model_id === defaults.model_id && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-aspectum-primary text-aspectum-on-accent">
                          по умолчанию
                        </span>
                      )}
                    </div>
                    <p className="text-xs font-mono text-aspectum-text-disabled mt-0.5">{model.model_id}</p>
                    {model.languages?.length > 0 && (
                      <p className="text-xs text-aspectum-text-muted mt-0.5">
                        Языки: {model.languages.slice(0, 8).map((l) => l.language_id || l).join(', ')}
                        {model.languages.length > 8 && ` +${model.languages.length - 8}`}
                      </p>
                    )}
                  </div>
                  <div className="text-right text-xs text-aspectum-text-disabled shrink-0">
                    {model.max_characters_request_subscribed_user
                      ? `${model.max_characters_request_subscribed_user.toLocaleString()} симв./запрос`
                      : null}
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        )}

        {/* Голоса */}
        {voices.length > 0 && (
          <Panel className="p-5 space-y-3">
            <SectionHeader size="sm" title="Голоса" aside={<span className="text-aspectum-text-disabled font-normal text-sm">({voices.length})</span>} actions={<TextInput
                type="search"
                value={voiceSearch}
                onChange={(e) => setVoiceSearch(e.target.value)}
                placeholder="Поиск по имени, категории..."
                className="w-56 px-3 py-1.5 text-sm border border-aspectum-border-strong rounded-aspectum-control focus:outline-none focus:ring-2 focus:ring-aspectum-focus"
              />} />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[480px] overflow-y-auto pr-1">
              {filteredVoices.map((voice) => (
                <VoiceCard
                  key={voice.voice_id}
                  voice={voice}
                  isDefault={voice.voice_id === defaults.voice_id}
                  onPreview={handlePreview}
                />
              ))}
              {filteredVoices.length === 0 && (
                <p className="text-sm text-aspectum-text-disabled col-span-2 py-4 text-center">
                  Голоса не найдены
                </p>
              )}
            </div>
          </Panel>
        )}

        {/* Кеш */}
        {data?.configured && (
          <Panel className="p-5 space-y-2">
            <SectionHeader size="sm" title="Кеш" className="mb-3" />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
              {[
                { label: 'Голоса', updated: cacheInfo.voices_updated_at, ttl: cacheInfo.voices_ttl_seconds },
                { label: 'Модели', updated: cacheInfo.models_updated_at, ttl: cacheInfo.models_ttl_seconds },
                { label: 'Подписка', updated: cacheInfo.subscription_updated_at, ttl: cacheInfo.subscription_ttl_seconds },
              ].map(({ label, updated, ttl }) => (
                <div key={label} className="rounded-aspectum-control bg-aspectum-surface-muted border border-aspectum-border-subtle px-3 py-2">
                  <p className="text-xs text-aspectum-text-muted">{label}</p>
                  <p className="text-xs text-aspectum-text-strong mt-0.5">
                    {updated
                      ? new Date(updated).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
                      : 'Не загружено'}
                  </p>
                  <p className="text-xs text-aspectum-text-disabled">TTL: {ttl ? `${Math.round(ttl / 3600)} ч` : '—'}</p>
                </div>
              ))}
            </div>
          </Panel>
        )}

      </PageContainer>
    </Layout>
  );
}
