import { useEffect, useState } from 'react';

import { ttsAPI } from '../../api/generation';

const DEFAULT_AUDIO_PROCESSING_SETTINGS = {
  enabled: false,
  trim_silence: {
    enabled: true,
    threshold_db: -48,
    keep_silence_ms: 80,
    detection_window_ms: 20,
  },
  highpass: { enabled: true, cutoff_hz: 70 },
  noise_reduction: {
    enabled: false,
    amount_db: 8,
    noise_floor_db: -55,
    track_noise: false,
  },
  gate: {
    enabled: true,
    threshold_db: -42,
    reduction_db: -18,
    ratio: 2,
    attack_ms: 10,
    release_ms: 180,
  },
  compressor: {
    enabled: true,
    threshold_db: -18,
    ratio: 2.5,
    attack_ms: 15,
    release_ms: 180,
    makeup_db: 1.5,
    knee: 2.8,
  },
  deesser: {
    enabled: true,
    intensity: 0.2,
    max_reduction: 0.35,
    frequency: 0.55,
  },
  loudness: {
    enabled: true,
    target_lufs: -16,
    true_peak_db: -1.5,
    range_lu: 9,
  },
  output: { sample_rate_hz: 44100, bitrate_kbps: 128, channels: 1 },
  chapter_gap_seconds: 1.25,
};

const cloneSettings = (value) =>
  JSON.parse(JSON.stringify(value || DEFAULT_AUDIO_PROCESSING_SETTINGS));

function Toggle({ checked, onChange, disabled = false, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
        checked ? 'bg-blue-600' : 'bg-gray-300'
      }`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
          checked ? 'translate-x-5' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}

function RangeField({ label, value, min, max, step, unit = '', onChange, disabled }) {
  const commit = (raw) => {
    const number = Number(raw);
    if (Number.isFinite(number)) onChange(number);
  };

  return (
    <label className="grid grid-cols-[minmax(130px,1fr)_minmax(120px,1.5fr)_88px] items-center gap-3 text-xs">
      <span className="text-gray-600">{label}</span>
      <input
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onChange={(event) => commit(event.target.value)}
        className="w-full accent-blue-600 disabled:opacity-40"
      />
      <span className="flex items-center gap-1">
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          onChange={(event) => commit(event.target.value)}
          className="w-16 rounded-md border border-gray-300 px-2 py-1 text-right text-xs disabled:bg-gray-100"
        />
        <span className="w-5 text-gray-400">{unit}</span>
      </span>
    </label>
  );
}

function Module({ title, enabled, onToggle, disabled, children }) {
  return (
    <div className="border-t border-gray-100 py-4 first:border-t-0 first:pt-0">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-medium text-gray-800">{title}</h3>
        <Toggle
          checked={enabled}
          onChange={onToggle}
          disabled={disabled}
          label={`${enabled ? 'Выключить' : 'Включить'}: ${title}`}
        />
      </div>
      <div className={`space-y-2.5 ${!enabled || disabled ? 'opacity-50' : ''}`}>
        {children}
      </div>
    </div>
  );
}

const SOURCE_LABELS = {
  database: 'Сохранено в базе',
  default: 'Значения по умолчанию',
  legacy_env: 'Используется прежняя серверная цепочка',
  database_invalid: 'Ошибка сохранённого профиля',
};

export default function AudioProcessingMixer({ value, onSaved }) {
  const [draft, setDraft] = useState(() =>
    cloneSettings(value?.settings || DEFAULT_AUDIO_PROCESSING_SETTINGS),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setDraft(cloneSettings(value?.settings || DEFAULT_AUDIO_PROCESSING_SETTINGS));
  }, [value]);

  const update = (path, nextValue) => {
    setSaved(false);
    setDraft((current) => {
      const next = cloneSettings(current);
      let target = next;
      path.slice(0, -1).forEach((key) => {
        target = target[key];
      });
      target[path[path.length - 1]] = nextValue;
      return next;
    });
  };

  const save = async () => {
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      const response = await ttsAPI.updateAudioProcessing(draft);
      const next = response?.data?.audio_processing;
      if (!response?.data?.ok || !next) {
        throw new Error(response?.data?.error || 'Не удалось сохранить профиль');
      }
      setDraft(cloneSettings(next.settings));
      setSaved(true);
      onSaved?.(next);
    } catch (requestError) {
      setError(
        requestError?.response?.data?.error ||
          requestError?.message ||
          'Не удалось сохранить профиль',
      );
    } finally {
      setSaving(false);
    }
  };

  const masterDisabled = !draft.enabled;

  return (
    <details className="bg-white rounded-lg border border-gray-200">
      <summary className="cursor-pointer select-none px-5 py-4 text-base font-semibold text-gray-900">
        Обработка звука
      </summary>

      <div className="border-t border-gray-200 px-5 pb-5 pt-4">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-gray-800">Применять профиль после TTS</p>
            <p className="mt-0.5 text-xs text-gray-500">
              {SOURCE_LABELS[value?.source] || value?.source || 'Значения по умолчанию'}
            </p>
          </div>
          <Toggle
            checked={draft.enabled}
            onChange={(next) => update(['enabled'], next)}
            label="Обработка звука"
          />
        </div>

        {value?.legacy_filter_active ? (
          <div className="mb-4 border-l-4 border-amber-400 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            После сохранения этот профиль заменит прежнюю серверную FFmpeg-цепочку.
          </div>
        ) : null}

        {value?.warning ? (
          <div className="mb-4 border-l-4 border-red-400 bg-red-50 px-3 py-2 text-xs text-red-700">
            {value.warning}
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-x-8 lg:grid-cols-2">
          <div>
            <p className="mb-3 text-xs font-semibold uppercase text-gray-400">Очистка</p>

            <Module
              title="Обрезка тишины по краям"
              enabled={draft.trim_silence.enabled}
              onToggle={(next) => update(['trim_silence', 'enabled'], next)}
              disabled={masterDisabled}
            >
              <RangeField label="Порог" value={draft.trim_silence.threshold_db} min={-80} max={-20} step={1} unit="dB" disabled={masterDisabled || !draft.trim_silence.enabled} onChange={(next) => update(['trim_silence', 'threshold_db'], next)} />
              <RangeField label="Оставить по краям" value={draft.trim_silence.keep_silence_ms} min={0} max={1000} step={10} unit="мс" disabled={masterDisabled || !draft.trim_silence.enabled} onChange={(next) => update(['trim_silence', 'keep_silence_ms'], next)} />
              <RangeField label="Окно анализа" value={draft.trim_silence.detection_window_ms} min={5} max={250} step={5} unit="мс" disabled={masterDisabled || !draft.trim_silence.enabled} onChange={(next) => update(['trim_silence', 'detection_window_ms'], next)} />
            </Module>

            <Module
              title="Срез низких частот"
              enabled={draft.highpass.enabled}
              onToggle={(next) => update(['highpass', 'enabled'], next)}
              disabled={masterDisabled}
            >
              <RangeField label="Частота среза" value={draft.highpass.cutoff_hz} min={20} max={300} step={5} unit="Гц" disabled={masterDisabled || !draft.highpass.enabled} onChange={(next) => update(['highpass', 'cutoff_hz'], next)} />
            </Module>

            <Module
              title="Шумоподавление"
              enabled={draft.noise_reduction.enabled}
              onToggle={(next) => update(['noise_reduction', 'enabled'], next)}
              disabled={masterDisabled}
            >
              <RangeField label="Подавление" value={draft.noise_reduction.amount_db} min={0.01} max={30} step={0.01} unit="dB" disabled={masterDisabled || !draft.noise_reduction.enabled} onChange={(next) => update(['noise_reduction', 'amount_db'], next)} />
              <RangeField label="Уровень шума" value={draft.noise_reduction.noise_floor_db} min={-80} max={-20} step={1} unit="dB" disabled={masterDisabled || !draft.noise_reduction.enabled} onChange={(next) => update(['noise_reduction', 'noise_floor_db'], next)} />
              <div className="flex items-center justify-between text-xs text-gray-600">
                <span>Адаптивно отслеживать шум</span>
                <Toggle checked={draft.noise_reduction.track_noise} disabled={masterDisabled || !draft.noise_reduction.enabled} onChange={(next) => update(['noise_reduction', 'track_noise'], next)} label="Адаптивное отслеживание шума" />
              </div>
            </Module>

            <Module
              title="Гейт вдохов и тихих призвуков"
              enabled={draft.gate.enabled}
              onToggle={(next) => update(['gate', 'enabled'], next)}
              disabled={masterDisabled}
            >
              <RangeField label="Порог" value={draft.gate.threshold_db} min={-80} max={-5} step={1} unit="dB" disabled={masterDisabled || !draft.gate.enabled} onChange={(next) => update(['gate', 'threshold_db'], next)} />
              <RangeField label="Ослабление" value={draft.gate.reduction_db} min={-80} max={0} step={1} unit="dB" disabled={masterDisabled || !draft.gate.enabled} onChange={(next) => update(['gate', 'reduction_db'], next)} />
              <RangeField label="Коэффициент" value={draft.gate.ratio} min={1} max={20} step={0.5} unit="×" disabled={masterDisabled || !draft.gate.enabled} onChange={(next) => update(['gate', 'ratio'], next)} />
              <RangeField label="Атака" value={draft.gate.attack_ms} min={0.01} max={500} step={0.01} unit="мс" disabled={masterDisabled || !draft.gate.enabled} onChange={(next) => update(['gate', 'attack_ms'], next)} />
              <RangeField label="Восстановление" value={draft.gate.release_ms} min={10} max={3000} step={10} unit="мс" disabled={masterDisabled || !draft.gate.enabled} onChange={(next) => update(['gate', 'release_ms'], next)} />
            </Module>
          </div>

          <div>
            <p className="mb-3 text-xs font-semibold uppercase text-gray-400">Динамика</p>

            <Module
              title="Компрессор"
              enabled={draft.compressor.enabled}
              onToggle={(next) => update(['compressor', 'enabled'], next)}
              disabled={masterDisabled}
            >
              <RangeField label="Порог" value={draft.compressor.threshold_db} min={-60} max={0} step={1} unit="dB" disabled={masterDisabled || !draft.compressor.enabled} onChange={(next) => update(['compressor', 'threshold_db'], next)} />
              <RangeField label="Коэффициент" value={draft.compressor.ratio} min={1} max={20} step={0.5} unit="×" disabled={masterDisabled || !draft.compressor.enabled} onChange={(next) => update(['compressor', 'ratio'], next)} />
              <RangeField label="Атака" value={draft.compressor.attack_ms} min={0.01} max={500} step={0.01} unit="мс" disabled={masterDisabled || !draft.compressor.enabled} onChange={(next) => update(['compressor', 'attack_ms'], next)} />
              <RangeField label="Восстановление" value={draft.compressor.release_ms} min={10} max={3000} step={10} unit="мс" disabled={masterDisabled || !draft.compressor.enabled} onChange={(next) => update(['compressor', 'release_ms'], next)} />
              <RangeField label="Компенсация" value={draft.compressor.makeup_db} min={0} max={18} step={0.5} unit="dB" disabled={masterDisabled || !draft.compressor.enabled} onChange={(next) => update(['compressor', 'makeup_db'], next)} />
              <RangeField label="Колено" value={draft.compressor.knee} min={1} max={8} step={0.1} disabled={masterDisabled || !draft.compressor.enabled} onChange={(next) => update(['compressor', 'knee'], next)} />
            </Module>

            <Module
              title="Де-эссер"
              enabled={draft.deesser.enabled}
              onToggle={(next) => update(['deesser', 'enabled'], next)}
              disabled={masterDisabled}
            >
              <RangeField label="Интенсивность" value={draft.deesser.intensity} min={0} max={1} step={0.05} disabled={masterDisabled || !draft.deesser.enabled} onChange={(next) => update(['deesser', 'intensity'], next)} />
              <RangeField label="Макс. подавление" value={draft.deesser.max_reduction} min={0} max={1} step={0.05} disabled={masterDisabled || !draft.deesser.enabled} onChange={(next) => update(['deesser', 'max_reduction'], next)} />
              <RangeField label="Частотная область" value={draft.deesser.frequency} min={0} max={1} step={0.05} disabled={masterDisabled || !draft.deesser.enabled} onChange={(next) => update(['deesser', 'frequency'], next)} />
            </Module>

            <Module
              title="Нормализация громкости"
              enabled={draft.loudness.enabled}
              onToggle={(next) => update(['loudness', 'enabled'], next)}
              disabled={masterDisabled}
            >
              <RangeField label="Целевая громкость" value={draft.loudness.target_lufs} min={-24} max={-10} step={0.5} unit="LUFS" disabled={masterDisabled || !draft.loudness.enabled} onChange={(next) => update(['loudness', 'target_lufs'], next)} />
              <RangeField label="Пиковый уровень" value={draft.loudness.true_peak_db} min={-9} max={0} step={0.5} unit="dB" disabled={masterDisabled || !draft.loudness.enabled} onChange={(next) => update(['loudness', 'true_peak_db'], next)} />
              <RangeField label="Диапазон" value={draft.loudness.range_lu} min={1} max={20} step={0.5} unit="LU" disabled={masterDisabled || !draft.loudness.enabled} onChange={(next) => update(['loudness', 'range_lu'], next)} />
            </Module>

            <div className="border-t border-gray-100 py-4">
              <h3 className="mb-3 text-sm font-medium text-gray-800">Выходной файл</h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <label className="text-xs text-gray-600">
                  Частота
                  <select value={draft.output.sample_rate_hz} disabled={masterDisabled} onChange={(event) => update(['output', 'sample_rate_hz'], Number(event.target.value))} className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs disabled:bg-gray-100">
                    <option value={22050}>22 050 Гц</option>
                    <option value={44100}>44 100 Гц</option>
                    <option value={48000}>48 000 Гц</option>
                  </select>
                </label>
                <label className="text-xs text-gray-600">
                  Битрейт
                  <select value={draft.output.bitrate_kbps} disabled={masterDisabled} onChange={(event) => update(['output', 'bitrate_kbps'], Number(event.target.value))} className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs disabled:bg-gray-100">
                    {[64, 96, 128, 192].map((value) => <option key={value} value={value}>{value} кбит/с</option>)}
                  </select>
                </label>
                <label className="text-xs text-gray-600">
                  Каналы
                  <select value={draft.output.channels} disabled={masterDisabled} onChange={(event) => update(['output', 'channels'], Number(event.target.value))} className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs disabled:bg-gray-100">
                    <option value={1}>Моно</option>
                    <option value={2}>Стерео</option>
                  </select>
                </label>
              </div>
              <div className="mt-3">
                <RangeField label="Пауза между главами" value={draft.chapter_gap_seconds} min={0} max={5} step={0.05} unit="с" onChange={(next) => update(['chapter_gap_seconds'], next)} />
              </div>
            </div>
          </div>
        </div>

        <div className="mt-2 flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 pt-4">
          <div className="text-xs">
            {error ? <span className="text-red-600">{error}</span> : null}
            {saved ? <span className="text-green-700">Настройки сохранены</span> : null}
          </div>
          <div className="flex items-center gap-2">
            <button type="button" disabled={saving} onClick={() => { setDraft(cloneSettings(DEFAULT_AUDIO_PROCESSING_SETTINGS)); setSaved(false); setError(''); }} className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">
              По умолчанию
            </button>
            <button type="button" disabled={saving} onClick={save} className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
              {saving ? 'Сохранение...' : 'Сохранить профиль'}
            </button>
          </div>
        </div>
      </div>
    </details>
  );
}
