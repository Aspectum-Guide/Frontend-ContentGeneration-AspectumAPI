import { useState, useEffect, useRef } from 'react';
import Layout from '../../components/Layout';
import { ttsAPI } from '../../api/generation';

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
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
        Не настроен
      </span>
    );
  }
  if (externalAvailable) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
        {stale ? 'Кеш устарел' : cached ? 'Кеш' : 'Подключён'}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
      API недоступен
    </span>
  );
}

function VoiceCard({ voice, isDefault, onPreview }) {
  const labels = voice.labels || {};
  const labelParts = [labels.gender, labels.accent, labels.language, labels.age].filter(Boolean);

  return (
    <div className={`rounded-lg border p-3 ${isDefault ? 'border-blue-400 bg-blue-50' : 'border-gray-200 bg-white'}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm text-gray-900">{voice.name}</span>
            {isDefault && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-blue-600 text-white">по умолчанию</span>
            )}
            {voice.category && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">{voice.category}</span>
            )}
          </div>
          {labelParts.length > 0 && (
            <p className="text-xs text-gray-500 mt-0.5">{labelParts.join(' · ')}</p>
          )}
          <p className="text-xs text-gray-400 font-mono mt-0.5">{voice.voice_id}</p>
        </div>
        {voice.preview_url && (
          <button
            type="button"
            onClick={() => onPreview(voice)}
            className="shrink-0 text-xs px-2.5 py-1 rounded-md border border-gray-200 hover:bg-gray-50 text-gray-600"
          >
            ▶ Слушать
          </button>
        )}
      </div>
    </div>
  );
}

export default function TTSSettings() {
  const [data, setData] = useState(null);
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
      const res = await ttsAPI.getElevenLabsSettings({ refresh });
      setData(res.data);
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
        <div className="flex items-center justify-center min-h-96 text-gray-400 text-sm">
          Загрузка настроек ElevenLabs...
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6 max-w-4xl">

        {/* Заголовок */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Настройки TTS — ElevenLabs</h1>
            <p className="text-sm text-gray-500 mt-1">
              Настройки берутся из переменных окружения сервера. Здесь можно проверить статус подключения,
              доступные голоса и лимиты подписки.
            </p>
          </div>
          <button
            type="button"
            onClick={() => load({ refresh: true })}
            disabled={refreshing}
            className="shrink-0 flex items-center gap-1.5 px-3 py-2 text-sm font-medium border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            {refreshing ? (
              <span className="animate-spin w-3.5 h-3.5 border border-gray-400 border-t-transparent rounded-full" />
            ) : '↻'}
            Обновить кеш
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            {error}
            <button onClick={() => load()} className="ml-3 underline">Повторить</button>
          </div>
        )}

        {/* Статус подключения */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Статус подключения</h2>
            {data && (
              <StatusBadge
                configured={data.configured}
                externalAvailable={data.external_available}
                stale={data.stale}
                cached={data.cached}
              />
            )}
          </div>

          {!data?.configured && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
              <p className="font-medium">ELEVENLABS_API_KEY не задан</p>
              <p className="mt-1 text-xs">Добавьте ключ в переменные окружения сервера и перезапустите его.</p>
            </div>
          )}

          {warningMessage && data?.configured && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
              {warningMessage}
            </div>
          )}

          {data?.refresh_throttled && (
            <p className="text-xs text-gray-400">
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
                <div key={label} className="rounded-lg bg-gray-50 border border-gray-100 px-3 py-2">
                  <p className="text-xs text-gray-500">{label}</p>
                  <p className="text-sm font-mono text-gray-900 mt-0.5 truncate">{value || '—'}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Подписка */}
        {subscription && (
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
            <h2 className="font-semibold text-gray-900">Подписка</h2>
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
                <div key={label} className="rounded-lg bg-gray-50 border border-gray-100 px-3 py-2">
                  <p className="text-xs text-gray-500">{label}</p>
                  <p className="text-sm font-semibold text-gray-900 mt-0.5">{value}</p>
                </div>
              ))}
            </div>
            {subscription.character_limit && subscription.character_count != null && (
              <div>
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>Использование</span>
                  <span>
                    {Math.round((subscription.character_count / subscription.character_limit) * 100)}%
                  </span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all"
                    style={{
                      width: `${Math.min(
                        (subscription.character_count / subscription.character_limit) * 100,
                        100,
                      )}%`,
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Модели */}
        {models.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
            <h2 className="font-semibold text-gray-900">Доступные модели</h2>
            <div className="space-y-2">
              {models.map((model) => (
                <div
                  key={model.model_id}
                  className={`rounded-lg border px-3 py-2 flex items-start justify-between gap-3 ${
                    model.model_id === defaults.model_id
                      ? 'border-blue-400 bg-blue-50'
                      : 'border-gray-200'
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-gray-900">{model.name}</span>
                      {model.model_id === defaults.model_id && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-blue-600 text-white">
                          по умолчанию
                        </span>
                      )}
                    </div>
                    <p className="text-xs font-mono text-gray-400 mt-0.5">{model.model_id}</p>
                    {model.languages?.length > 0 && (
                      <p className="text-xs text-gray-500 mt-0.5">
                        Языки: {model.languages.slice(0, 8).map((l) => l.language_id || l).join(', ')}
                        {model.languages.length > 8 && ` +${model.languages.length - 8}`}
                      </p>
                    )}
                  </div>
                  <div className="text-right text-xs text-gray-400 shrink-0">
                    {model.max_characters_request_subscribed_user
                      ? `${model.max_characters_request_subscribed_user.toLocaleString()} симв./запрос`
                      : null}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Голоса */}
        {voices.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-semibold text-gray-900">
                Голоса <span className="text-gray-400 font-normal text-sm">({voices.length})</span>
              </h2>
              <input
                type="search"
                value={voiceSearch}
                onChange={(e) => setVoiceSearch(e.target.value)}
                placeholder="Поиск по имени, категории..."
                className="w-56 px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
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
                <p className="text-sm text-gray-400 col-span-2 py-4 text-center">
                  Голоса не найдены
                </p>
              )}
            </div>
          </div>
        )}

        {/* Кеш */}
        {data?.configured && (
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-2">
            <h2 className="font-semibold text-gray-900 mb-3">Кеш</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
              {[
                { label: 'Голоса', updated: cacheInfo.voices_updated_at, ttl: cacheInfo.voices_ttl_seconds },
                { label: 'Модели', updated: cacheInfo.models_updated_at, ttl: cacheInfo.models_ttl_seconds },
                { label: 'Подписка', updated: cacheInfo.subscription_updated_at, ttl: cacheInfo.subscription_ttl_seconds },
              ].map(({ label, updated, ttl }) => (
                <div key={label} className="rounded-lg bg-gray-50 border border-gray-100 px-3 py-2">
                  <p className="text-xs text-gray-500">{label}</p>
                  <p className="text-xs text-gray-700 mt-0.5">
                    {updated
                      ? new Date(updated).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
                      : 'Не загружено'}
                  </p>
                  <p className="text-xs text-gray-400">TTL: {ttl ? `${Math.round(ttl / 3600)} ч` : '—'}</p>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </Layout>
  );
}
