import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { attractionAudioGuidesAPI, audioAPI, ttsAPI } from '../../../api/generation';
import { parseApiError } from '../../../utils/apiError';
import {
  normalizeId,
  DEFAULT_LOCALE_DEFS,
  getLocaleInfo,
} from './sessionWizardShared.jsx';
import {
  getMultilangKeys,
} from './useSessionWizardHelpers.js';
import { buildGenerationPayloadFields } from '../../../components/generation/AiGenerationQualitySettings.jsx';

const DEFAULT_AUDIO_GUIDE_PLAN_ITEMS_COUNT = 6;
const PREFERRED_DEFAULT_ELEVENLABS_VOICE_ID = 'ogi2DyUAKJb7CEdqqvlU';
const ELEVENLABS_SETTINGS_FRONTEND_CACHE_KEY = 'aspectum:elevenlabs:settings:v1';
const ELEVENLABS_SETTINGS_FRONTEND_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

const emptyAudioGuidePlanGenerationLocaleState = () => ({
  prompt: '',
  desiredItemsCount: DEFAULT_AUDIO_GUIDE_PLAN_ITEMS_COUNT,
});

const normalizeAudioGuidePlanItemsCount = (value) => {
  const n = Number.parseInt(String(value), 10);
  if (!Number.isFinite(n)) return DEFAULT_AUDIO_GUIDE_PLAN_ITEMS_COUNT;
  return Math.max(1, Math.min(n, 20));
};

const normalizeAttractionAudioGuide = (guide = {}) => {
  const eventId =
    guide.event_id ??
    guide.event ??
    guide.attraction_id ??
    guide.attraction ??
    null;

  const sessionAttractionId =
    guide.session_attraction_id ?? guide.session_attraction ?? null;

  let assignedAttractionType =
    guide.assigned_attraction_type ?? 'none';

  if (!guide.assigned_attraction_type) {
    if (eventId) {
      assignedAttractionType = 'database';
    } else if (sessionAttractionId) {
      assignedAttractionType = 'draft';
    }
  }

  return {
    ...guide,

    id: guide.id ?? null,

    title: guide.title ?? guide.name ?? {},
    content_plan: normalizeContentPlan(guide.content_plan ?? guide.contentPlan ?? {}),
    content_texts: normalizeContentTexts(
      guide.content_texts ?? guide.contentTexts ?? {},
    ),

    index: Number(guide.index ?? 0),

    event: eventId,
    event_id: eventId,

    attraction: eventId,
    attraction_id: eventId,

    session_attraction: sessionAttractionId,
    session_attraction_id: sessionAttractionId,

    assigned_attraction_type: assignedAttractionType,
    assigned_attraction_name: guide.assigned_attraction_name ?? null,

    tracks: normalizeAudioGuideTracks(guide.tracks),

    isNew: guide.isNew ?? false,
  };
};

const normalizeAudioGuideTracks = (tracks) => {
  const result = {};

  if (!tracks || typeof tracks !== 'object') return result;

  Object.entries(tracks).forEach(([rawLang, raw]) => {
    const lang = String(rawLang || '').trim();
    if (!lang) return;

    const track = raw || {};

    result[lang] = {
      id: track.id ?? track.track_id ?? track.trackId ?? null,
      audio_id: track.audio_id ?? track.audioId ?? track.audio?.id ?? null,
      audio_url:
        track.audio_url ??
        track.audioUrl ??
        track.url ??
        track.audio?.url ??
        track.audio?.audio_url ??
        '',
      copyright:
        track.copyright ??
        track.audio_copyright ??
        track.audio?.copyright ??
        '',
      language: lang,
    };
  });

  return result;
};

const normalizeContentPlan = (plan) => {
  if (!plan || typeof plan !== 'object') return {};

  const result = {};

  Object.entries(plan).forEach(([rawLang, items]) => {
    const lang = String(rawLang || '').trim();
    if (!lang) return;

    result[lang] = normalizeAudioGuidePlanItemsForLang(items);
  });

  return result;
};

const normalizeContentTexts = (value) => {
  if (!value || typeof value !== 'object') return {};

  const result = {};

  Object.entries(value).forEach(([rawLang, body]) => {
    const lang = String(rawLang || '').trim();
    if (!lang) return;

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      result[lang] = {};
      return;
    }

    const inner = {};
    Object.entries(body).forEach(([pid, txt]) => {
      const id = String(pid || '').trim();
      if (!id) return;
      inner[id] = txt == null ? '' : String(txt);
    });
    result[lang] = inner;
  });

  return result;
};

const generateAudioGuidePlanItemId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `plan-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const isAudioGuidePlanUuid = (value) => {
  if (!value || typeof value !== 'string') return false;

  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value.trim(),
  );
};

const normalizeAudioGuidePlanItemsForLang = (items) => {
  const usedIds = new Set();
  const allocId = (preferred) => {
    const p = preferred != null ? String(preferred).trim() : '';
    if (isAudioGuidePlanUuid(p) && !usedIds.has(p)) {
      usedIds.add(p);
      return p;
    }
    const nid = generateAudioGuidePlanItemId();
    usedIds.add(nid);
    return nid;
  };

  if (items == null) return [];

  let list = items;

  if (typeof items === 'string') {
    list = items.trim() ? [items] : [];
  }

  if (!Array.isArray(list)) return [];

  const result = [];

  list.forEach((raw) => {
    if (raw == null) return;

    if (typeof raw === 'string') {
      result.push({
        id: allocId(null),
        title: String(raw),
      });
      return;
    }

    if (typeof raw === 'object') {
      const id = allocId(raw.id);
      const titleVal =
        raw.title != null ? raw.title : raw.text != null ? raw.text : '';
      result.push({
        id,
        title: titleVal == null ? '' : String(titleVal),
      });
    }
  });

  return result;
};

const langHasNonEmptyAudioGuideTexts = (guide, lang) => {
  const key = String(lang || '').trim();
  if (!key) return false;

  const m = guide?.content_texts?.[key];
  if (!m || typeof m !== 'object') return false;

  return Object.values(m).some((t) => String(t || '').trim() !== '');
};

const audioGuideAllPlanItemsHaveText = (guide, lang) => {
  const langKey = String(lang || '').trim();
  if (!langKey) return false;

  const planItems = normalizeAudioGuidePlanItemsForLang(
    guide?.content_plan?.[langKey],
  );
  if (planItems.length === 0) return false;

  const texts = guide?.content_texts?.[langKey] || {};

  return planItems.every((item) => {
    const itemId = String(item?.id || '').trim();
    if (!itemId) return false;
    const text = texts[itemId];
    return typeof text === 'string' && text.trim().length > 0;
  });
};

const mapAudioGuideTrackTtsError = (error) => {
  const status = error?.response?.status;
  const data = error?.response?.data || {};
  const category = data.error_category;

  if (status === 409) {
    return 'Аудиофайл уже существует. Используйте «Заменить аудиофайл».';
  }
  if (status === 400) {
    return data.error || 'Сначала заполните тексты всех пунктов аудиогида.';
  }
  if (category === 'elevenlabs_access_restricted') {
    return (
      data.error ||
      'ElevenLabs недоступен с текущего IP или региона сервера. Проверьте VPN, хостинг или страну доступа.'
    );
  }
  if (status === 502 || status === 503) {
    return data.error || 'Не удалось сгенерировать аудио. Попробуйте позже.';
  }

  return data.error || data.detail || 'Не удалось сгенерировать аудио';
};

const mergeAudioGuideTrackFromTtsResponse = (guide, lang, data) => {
  const audio = data?.audio || {};
  const track = data?.track || {};
  const audioId = audio.id ?? track.audio ?? null;
  const audioUrl = audio.url ?? '';
  const copyright = audio.copyright ?? 'Generated with ElevenLabs';

  return normalizeAttractionAudioGuide({
    ...guide,
    tracks: {
      ...(guide.tracks || {}),
      [lang]: {
        ...(guide.tracks?.[lang] || {}),
        id: track.id ?? guide.tracks?.[lang]?.id ?? null,
        audio_id: audioId,
        audio_url: audioUrl,
        copyright,
        language: lang,
      },
    },
  });
};

const buildAttractionAudioGuidePayload = (
  guide,
  {
    title = null,
    contentPlan = null,
    contentTexts = null,
    includeTracks = false,
    trackLanguages = null,
  } = {},
) => {
  const assignedType = guide.assigned_attraction_type ?? 'none';

  let event = null;
  let sessionAttraction = null;

  if (assignedType === 'database') {
    event =
      guide.event_id ??
      guide.event ??
      guide.attraction_id ??
      guide.attraction ??
      null;
  }

  if (assignedType === 'draft') {
    sessionAttraction =
      guide.session_attraction_id ?? guide.session_attraction ?? null;
  }

  const payload = {
    title: title ?? guide.title ?? {},
    content_plan: contentPlan ?? guide.content_plan ?? {},
    content_texts: normalizeContentTexts(
      contentTexts ?? guide.content_texts ?? {},
    ),

    index: Number(guide.index ?? 0),

    assigned_attraction_type: assignedType,

    event,
    event_id: event,

    attraction: event,
    attraction_id: event,

    session_attraction: sessionAttraction,
    session_attraction_id: sessionAttraction,
  };

  if (includeTracks) {
    const langSet = new Set();
    if (Array.isArray(trackLanguages)) {
      trackLanguages.forEach((raw) => {
        const k = String(raw || '').trim();
        if (k) langSet.add(k);
      });
    }
    Object.keys(guide.tracks || {}).forEach((raw) => {
      const k = String(raw || '').trim();
      if (k) langSet.add(k);
    });

    const tracks = {};
    langSet.forEach((lang) => {
      const track = guide.tracks?.[lang];
      if (!track) {
        tracks[lang] = null;
        return;
      }
      const audioId = track?.audio_id ?? null;
      const audioUrl = track?.audio_url ?? '';
      const copyright = track?.copyright ?? '';
      if (!audioId && !audioUrl && !String(copyright).trim()) {
        tracks[lang] = null;
        return;
      }
      tracks[lang] = {
        audio_id: audioId,
        copyright: String(copyright).slice(0, 255),
      };
    });
    payload.tracks = tracks;
  }

  return payload;
};

function collectAttractionAudioGuideLocaleTexts(attractionAudioGuideLocaleData) {
  const title = {};
  const contentPlan = {};
  const trackLanguages = [];
  const seenLang = new Set();

  Object.values(attractionAudioGuideLocaleData || {}).forEach((d) => {
    const lang = String(d?.lang || '').trim();
    if (!lang) return;

    title[lang] = d.title || '';

    const rawPlan = Array.isArray(d.contentPlan) ? d.contentPlan : [];
    contentPlan[lang] = normalizeAudioGuidePlanItemsForLang(rawPlan);

    if (!seenLang.has(lang)) {
      seenLang.add(lang);
      trackLanguages.push(lang);
    }
  });

  return { title, contentPlan, trackLanguages };
}

function collectAttractionAudioGuideTrackLanguages(guide, localeData) {
  const langSet = new Set();

  Object.values(localeData || {}).forEach((d) => {
    const lang = String(d?.lang || '').trim();
    if (lang) langSet.add(lang);
  });

  Object.keys(guide?.tracks || {}).forEach((raw) => {
    const lang = String(raw || '').trim();
    if (lang) langSet.add(lang);
  });

  return Array.from(langSet);
}

function buildAttractionAudioGuideSavePayload(guide, localeData) {
  const normalizedGuide = normalizeAttractionAudioGuide(guide);
  const { title, contentPlan } =
    collectAttractionAudioGuideLocaleTexts(localeData);

  const trackLanguages = collectAttractionAudioGuideTrackLanguages(
    normalizedGuide,
    localeData,
  );

  return buildAttractionAudioGuidePayload(normalizedGuide, {
    title,
    contentPlan,
    contentTexts: normalizeContentTexts(
      normalizedGuide.content_texts ?? {},
    ),
    includeTracks: true,
    trackLanguages,
  });
}

function buildAttractionAudioGuidePersistSnapshot(guide, localeData) {
  if (!guide?.id) return null;

  return JSON.stringify(
    buildAttractionAudioGuideSavePayload(guide, localeData),
  );
}

function createEmptyAttractionAudioGuide({
  activeAttractionId = null,
  sourceLocaleData = null,
} = {}) {
  const normalizedAttractionId = normalizeId(activeAttractionId);
  const shouldAttachToDraft = Boolean(normalizedAttractionId);

  const sourceEntries =
    sourceLocaleData && Object.keys(sourceLocaleData).length > 0
      ? Object.entries(sourceLocaleData).map(([key, loc]) => ({
          key,
          ...loc,
        }))
      : DEFAULT_LOCALE_DEFS;

  const title = {};
  const contentPlan = {};

  sourceEntries.forEach((locale) => {
    const lang =
      locale.lang ||
      locale.key?.split('-')?.[0] ||
      'ru';

    if (lang) {
      title[lang] = '';
      contentPlan[lang] = [];
    }
  });

  return {
    id: `attraction-audio-guide-${Date.now()}`,

    title,
    content_plan: contentPlan,
    content_texts: {},

    index: 0,

    assigned_attraction_type: shouldAttachToDraft ? 'draft' : 'none',

    event: null,
    event_id: null,

    attraction: null,
    attraction_id: null,

    session_attraction: shouldAttachToDraft ? normalizedAttractionId : null,
    session_attraction_id: shouldAttachToDraft ? normalizedAttractionId : null,

    tracks: {},

    isNew: true,
  };
}

function sortLocaleSourceEntries(entries) {
  if (!Array.isArray(entries) || entries.length <= 1) return entries;

  const defaultLangOrder = DEFAULT_LOCALE_DEFS.map((locale) =>
    locale.lang || locale.key?.split('-')?.[0]
  ).filter(Boolean);

  const langToPair = new Map();
  for (const [key, loc] of entries) {
    const lang = String(loc?.lang || key?.split('-')?.[0] || '')
      .trim()
      .toLowerCase();
    if (!lang) continue;
    if (!langToPair.has(lang)) {
      langToPair.set(lang, [key, loc]);
    }
  }

  const normalizedLangKeys = [...langToPair.keys()];

  const orderedLangKeys = [
    ...defaultLangOrder.filter((lang) => normalizedLangKeys.includes(lang)),
    ...normalizedLangKeys.filter((lang) => !defaultLangOrder.includes(lang)),
  ];

  return orderedLangKeys.map((lang) => langToPair.get(lang));
}

function makeLocaleEntriesFromLangKeys(langKeys = []) {
  const normalizedLangKeys = [
    ...new Set(
      langKeys
        .map((lang) => String(lang || '').trim().toLowerCase())
        .filter(Boolean)
    ),
  ];

  const defaultLangOrder = DEFAULT_LOCALE_DEFS.map((locale) =>
    locale.lang || locale.key?.split('-')?.[0]
  ).filter(Boolean);

  const orderedLangKeys = [
    ...defaultLangOrder.filter((lang) => normalizedLangKeys.includes(lang)),
    ...normalizedLangKeys.filter((lang) => !defaultLangOrder.includes(lang)),
  ];

  return orderedLangKeys.map((lang) => {
    const matchedDef = DEFAULT_LOCALE_DEFS.find((locale) => locale.lang === lang);

    if (matchedDef) {
      return [
        matchedDef.key,
        {
          lang: matchedDef.lang,
          code: matchedDef.code,
          langName: matchedDef.langName,
          isDefault: Boolean(matchedDef.isDefault),
        },
      ];
    }

    const info = getLocaleInfo(lang);
    const key = `${lang}-${info.code}`;

    return [
      key,
      {
        lang,
        code: info.code,
        langName: info.name,
        isDefault: false,
        isCustom: true,
      },
    ];
  });
}

function getLocaleLang(localeKey) {
  const locale = DEFAULT_LOCALE_DEFS.find((item) => item.key === localeKey);
  return locale?.lang || localeKey?.split('-')?.[0] || 'ru';
}

function resolveDefaultElevenLabsVoiceId(settings) {
  const voices = Array.isArray(settings?.voices) ? settings.voices : [];

  if (voices.some((voice) => voice.voice_id === PREFERRED_DEFAULT_ELEVENLABS_VOICE_ID)) {
    return PREFERRED_DEFAULT_ELEVENLABS_VOICE_ID;
  }

  if (settings?.defaults?.voice_id) {
    return settings.defaults.voice_id;
  }

  return voices[0]?.voice_id || '';
}

function readElevenLabsSettingsFromFrontendCache() {
  try {
    const raw = sessionStorage.getItem(ELEVENLABS_SETTINGS_FRONTEND_CACHE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!parsed?.data || !parsed?.savedAt) return null;

    if (Date.now() - parsed.savedAt > ELEVENLABS_SETTINGS_FRONTEND_CACHE_TTL_MS) {
      return null;
    }

    return parsed.data;
  } catch {
    return null;
  }
}

function writeElevenLabsSettingsToFrontendCache(data) {
  try {
    sessionStorage.setItem(
      ELEVENLABS_SETTINGS_FRONTEND_CACHE_KEY,
      JSON.stringify({ savedAt: Date.now(), data }),
    );
  } catch {
    // ignore quota / private mode
  }
}

function buildElevenLabsSettingsFromApiData(data = {}) {
  return {
    ok: data.ok ?? false,
    configured: data.configured ?? true,
    provider: data.provider || 'elevenlabs',
    external_available: data.external_available ?? true,
    defaults: data.defaults || null,
    subscription: data.subscription ?? null,
    voices: Array.isArray(data.voices) ? data.voices : [],
    models: Array.isArray(data.models) ? data.models : [],
    warning: data.warning || '',
    error: data.error || '',
    error_category: data.error_category || '',
    stale: Boolean(data.stale),
    cached: Boolean(data.cached),
    refresh_throttled: Boolean(data.refresh_throttled),
    cache: data.cache || null,
  };
}

function resolveElevenLabsSettingsUiMessage(settings, fallbackError = '') {
  const voices = Array.isArray(settings?.voices) ? settings.voices : [];
  if (voices.length > 0) {
    return '';
  }

  const category = settings?.error_category || '';

  if (category === 'elevenlabs_access_restricted') {
    return (
      'ElevenLabs недоступен с текущего IP или региона сервера. Список голосов нельзя загрузить. ' +
      'Генерация аудио также может быть недоступна, пока backend запущен с этого IP.'
    );
  }

  if (category === 'elevenlabs_network_error' || category === 'elevenlabs_unavailable') {
    return (
      'Не удалось загрузить список голосов ElevenLabs. Генерация будет выполнена голосом по умолчанию.'
    );
  }

  if (settings?.configured === false) {
    return 'ElevenLabs не настроен: отсутствует ELEVENLABS_API_KEY';
  }

  return fallbackError;
}

export function useAudioGuides({
  sessionId,
  session,
  showNote,
  confirm,
  currentAttr,
  attrLocaleData,
  attractions,
  referenceAttractions,
  getSessionUuid,
  aiGenerationMode,
  aiUseWebSearch,
}) {
  const [attractionAudioGuides, setAttractionAudioGuides] = useState([]);
  const [currentAttractionAudioGuide, setCurrentAttractionAudioGuide] = useState(null);
  const [attractionAudioGuideActiveLocale, setAttractionAudioGuideActiveLocale] = useState('ru-RU');
  const [attractionAudioGuideSaving, setAttractionAudioGuideSaving] = useState(false);
  const [attractionAudioUploading, setAttractionAudioUploading] = useState(false);
  const attractionAudioGuideSavedSnapshotRef = useRef(null);
  const currentAttractionAudioGuideIdRef = useRef(null);
  const attractionAudioGuideAutoSaveTimerRef = useRef(null);
  const attractionAudioGuideAutoSavedTimerRef = useRef(null);
  const attractionAudioGuideSavingRef = useRef(false);
  const attractionAudioGuideBusyRef = useRef(false);
  const [attractionAudioGuideAutoSaving, setAttractionAudioGuideAutoSaving] = useState(false);
  const [attractionAudioGuideAutoSaved, setAttractionAudioGuideAutoSaved] = useState(false);
  const currentAttractionAudioGuideRef = useRef(null);
  const attractionAudioGuideActiveLocaleRef = useRef('ru-RU');
  const attractionAudioGuideLocaleDataRef = useRef({});
  const [audioGuideGeneratingPlan, setAudioGuideGeneratingPlan] = useState(false);
  const [audioGuidePlanGenerateModalOpen, setAudioGuidePlanGenerateModalOpen] =
    useState(false);
  const [audioGuidePlanGeneratePrompt, setAudioGuidePlanGeneratePrompt] =
    useState('');
  const [audioGuidePlanGenerationError, setAudioGuidePlanGenerationError] =
    useState('');
  const [audioGuideGeneratingAllMainText, setAudioGuideGeneratingAllMainText] = useState(false);
  const [audioGuideMainTextGenerateModalOpen, setAudioGuideMainTextGenerateModalOpen] =
    useState(false);
  const [audioGuideMainTextGeneratePrompt, setAudioGuideMainTextGeneratePrompt] =
    useState('');
  const [audioGuideMainTextGenerationError, setAudioGuideMainTextGenerationError] =
    useState('');
  const [audioGuideGeneratingItemTextById, setAudioGuideGeneratingItemTextById] = useState({});
  const [audioGuideItemTextGenerateModalOpen, setAudioGuideItemTextGenerateModalOpen] =
    useState(false);
  const [audioGuideItemTextGenerateItemId, setAudioGuideItemTextGenerateItemId] =
    useState(null);
  const [audioGuideItemTextGenerateItemTitle, setAudioGuideItemTextGenerateItemTitle] =
    useState('');
  const audioGuideItemTextGeneratePlanItemRef = useRef(null);
  const [audioGuideItemTextGeneratePrompt, setAudioGuideItemTextGeneratePrompt] =
    useState('');
  const [audioGuideItemTextGenerationError, setAudioGuideItemTextGenerationError] =
    useState('');
  const [generatingAudioGuideTrack, setGeneratingAudioGuideTrack] = useState(false);
  const [audioGuideTrackGenerationError, setAudioGuideTrackGenerationError] = useState(null);
  const [audioGuidePlanGenerationState, setAudioGuidePlanGenerationState] = useState({});
  const audioGuidePlanGenerationStateRef = useRef({});
  const [elevenLabsSettingsLoading, setElevenLabsSettingsLoading] = useState(false);
  const [elevenLabsSettingsError, setElevenLabsSettingsError] = useState('');
  const [elevenLabsSettings, setElevenLabsSettings] = useState(null);
  const [audioGuideTtsVoiceId, setAudioGuideTtsVoiceId] = useState('');
  const [audioGuideTtsModelId, setAudioGuideTtsModelId] = useState('');
  const audioGuideTtsVoiceIdRef = useRef('');
  const audioGuideTtsModelIdRef = useRef('');
  const audioGuideTtsVoiceTouchedRef = useRef(false);
  const audioGuideTtsModelTouchedRef = useRef(false);

  useEffect(() => {
    return () => {
      clearTimeout(attractionAudioGuideAutoSaveTimerRef.current);
      clearTimeout(attractionAudioGuideAutoSavedTimerRef.current);
    };
  }, []);

  useEffect(() => {
    audioGuideTtsVoiceIdRef.current = audioGuideTtsVoiceId;
  }, [audioGuideTtsVoiceId]);

  useEffect(() => {
    audioGuideTtsModelIdRef.current = audioGuideTtsModelId;
  }, [audioGuideTtsModelId]);

  useEffect(() => {
    attractionAudioGuideSavingRef.current = attractionAudioGuideSaving;
  }, [attractionAudioGuideSaving]);

  useEffect(() => {
    if (!session?.id) return;
    if (attractionAudioGuideSavingRef.current || attractionAudioGuideAutoSaving) return;

    const guides = Array.isArray(session.attraction_audio_guides)
      ? session.attraction_audio_guides.map(normalizeAttractionAudioGuide)
      : [];

    setAttractionAudioGuides(guides);
  }, [
    session?.id,
    session?.attraction_audio_guides,
    attractionAudioGuideAutoSaving,
  ]);

  useEffect(() => {
    attractionAudioGuideBusyRef.current =
      attractionAudioGuideSaving ||
      attractionAudioUploading ||
      audioGuideGeneratingPlan ||
      audioGuideGeneratingAllMainText ||
      generatingAudioGuideTrack ||
      Object.values(audioGuideGeneratingItemTextById || {}).some(Boolean);
  }, [
    attractionAudioGuideSaving,
    attractionAudioUploading,
    audioGuideGeneratingPlan,
    audioGuideGeneratingAllMainText,
    generatingAudioGuideTrack,
    audioGuideGeneratingItemTextById,
  ]);

  const updateAudioGuideTtsVoiceId = useCallback((value) => {
    const next = (value || '').trim();
    audioGuideTtsVoiceTouchedRef.current = true;
    audioGuideTtsVoiceIdRef.current = next;
    setAudioGuideTtsVoiceId(next);
  }, []);

  const updateAudioGuideTtsModelId = useCallback((value) => {
    const next = (value || '').trim();
    audioGuideTtsModelTouchedRef.current = true;
    audioGuideTtsModelIdRef.current = next;
    setAudioGuideTtsModelId(next);
  }, []);

  const applyElevenLabsDefaultSelections = useCallback((settings) => {
    if (!audioGuideTtsVoiceTouchedRef.current) {
      const nextVoice = resolveDefaultElevenLabsVoiceId(settings).trim();
      audioGuideTtsVoiceIdRef.current = nextVoice;
      setAudioGuideTtsVoiceId(nextVoice);
    }

    if (!audioGuideTtsModelTouchedRef.current) {
      audioGuideTtsModelIdRef.current = '';
      setAudioGuideTtsModelId('');
    }
  }, []);

  const loadElevenLabsSettings = useCallback(
    async ({ refresh = false } = {}) => {
      if (!refresh && elevenLabsSettings) {
        return elevenLabsSettings;
      }

      if (!refresh) {
        const cached = readElevenLabsSettingsFromFrontendCache();
        if (cached) {
          setElevenLabsSettings(cached);
          setElevenLabsSettingsError('');
          applyElevenLabsDefaultSelections(cached);
          return cached;
        }
      }

      setElevenLabsSettingsLoading(true);
      setElevenLabsSettingsError('');

      try {
        const res = await ttsAPI.getElevenLabsSettings({ refresh });
        const data = res?.data || {};

        if (data.ok) {
          setElevenLabsSettings(data);
          setElevenLabsSettingsError('');
          writeElevenLabsSettingsToFrontendCache(data);
          applyElevenLabsDefaultSelections(data);
          return data;
        }

        const partial = buildElevenLabsSettingsFromApiData(data);
        if (partial.defaults) {
          setElevenLabsSettings(partial);
          applyElevenLabsDefaultSelections(partial);
        }
        setElevenLabsSettingsError(
          resolveElevenLabsSettingsUiMessage(partial, data.error || ''),
        );
        return partial.defaults ? partial : null;
      } catch (error) {
        const responseData = error?.response?.data;

        if (responseData && typeof responseData === 'object') {
          const partial = buildElevenLabsSettingsFromApiData(responseData);

          if (partial.defaults || partial.ok) {
            setElevenLabsSettings(partial);
            applyElevenLabsDefaultSelections(partial);
          }

          const uiMessage = resolveElevenLabsSettingsUiMessage(
            partial,
            parseApiError(error),
          );
          setElevenLabsSettingsError(uiMessage || '');
          return partial.defaults || partial.ok ? partial : null;
        }

        setElevenLabsSettingsError(
          parseApiError(error) || 'Не удалось загрузить настройки ElevenLabs',
        );
        return null;
      } finally {
        setElevenLabsSettingsLoading(false);
      }
    },
    [elevenLabsSettings, applyElevenLabsDefaultSelections],
  );

  const getAttractionAudioGuideName = useCallback((guide) => {
    const title = guide?.title || {};

    if (typeof title === 'string') {
      return title || 'Аудиогид';
    }

    return (
      title.ru ||
      title.en ||
      title.it ||
      Object.values(title).find(Boolean) ||
      'Аудиогид'
    );
  }, []);

  const attractionAudioGuideLocaleData = useMemo(() => {
    if (!currentAttractionAudioGuide) return {};

    const assignedType =
      currentAttractionAudioGuide.assigned_attraction_type || 'none';

    let sourceEntries = [];

    if (assignedType === 'draft') {
      const guideAttractionId = normalizeId(
        currentAttractionAudioGuide.session_attraction_id ??
          currentAttractionAudioGuide.session_attraction
      );

      const activeAttractionId = normalizeId(currentAttr?.id);

      if (
        guideAttractionId &&
        activeAttractionId &&
        guideAttractionId === activeAttractionId
      ) {
        sourceEntries = sortLocaleSourceEntries(
          Object.entries(attrLocaleData || {})
            .filter(([, loc]) => loc?.lang)
            .map(([key, loc]) => [
              key,
              {
                lang: loc.lang,
                code: loc.code,
                langName: loc.langName,
                isDefault: loc.isDefault,
                isCustom: loc.isCustom,
              },
            ])
        );
      } else if (guideAttractionId) {
        const attraction = attractions.find(
          (item) => normalizeId(item.id) === guideAttractionId
        );

        const attractionLangKeys = getMultilangKeys(
          attraction?.name,
          attraction?.description,
          attraction?.contents
        );

        sourceEntries = makeLocaleEntriesFromLangKeys(attractionLangKeys);
      }
    }

    if (assignedType === 'database') {
      const eventId = normalizeId(
        currentAttractionAudioGuide.event_id ??
          currentAttractionAudioGuide.event ??
          currentAttractionAudioGuide.attraction_id ??
          currentAttractionAudioGuide.attraction
      );

      const attraction = referenceAttractions.find(
        (item) => normalizeId(item.id) === eventId
      );

      const attractionLangKeys = getMultilangKeys(
        attraction?.name,
        attraction?.title,
        attraction?.description
      );

      sourceEntries = makeLocaleEntriesFromLangKeys(attractionLangKeys);
    }

    if (assignedType === 'none') {
      const ownLangKeys = getMultilangKeys(
        currentAttractionAudioGuide.title,
        currentAttractionAudioGuide.content_plan,
        currentAttractionAudioGuide.content_texts,
      );

      sourceEntries = makeLocaleEntriesFromLangKeys(ownLangKeys);
    }

    if (sourceEntries.length === 0) {
      sourceEntries = DEFAULT_LOCALE_DEFS.map((locale) => [locale.key, locale]);
    }

    return sourceEntries.reduce((acc, [key, locale]) => {
      const lang =
        locale.lang ||
        key?.split('-')?.[0] ||
        'ru';

      const planRaw = currentAttractionAudioGuide.content_plan?.[lang];
      const plan = normalizeAudioGuidePlanItemsForLang(planRaw);

      const trackRaw = currentAttractionAudioGuide.tracks?.[lang] || {};

      acc[key] = {
        lang,
        code: locale.code || key?.split('-')?.[1] || '',
        langName: locale.langName || locale.name || lang.toUpperCase(),
        isDefault: Boolean(locale.isDefault),
        isCustom: Boolean(locale.isCustom),

        title: currentAttractionAudioGuide.title?.[lang] || '',
        contentPlan: plan,

        track: {
          id: trackRaw.id ?? trackRaw.track_id ?? null,
          audio_id: trackRaw.audio_id ?? null,
          audio_url: trackRaw.audio_url ?? '',
          copyright: trackRaw.copyright ?? '',
        },
      };

      return acc;
    }, {});
  }, [
    currentAttractionAudioGuide,
    currentAttr,
    attrLocaleData,
    attractions,
    referenceAttractions,
  ]);

  useEffect(() => {
    if (!currentAttractionAudioGuide) return;

    const availableKeys = Object.keys(attractionAudioGuideLocaleData || {});

    if (availableKeys.length === 0) return;

    if (!availableKeys.includes(attractionAudioGuideActiveLocale)) {
      setAttractionAudioGuideActiveLocale(availableKeys[0]);
    }
  }, [
    currentAttractionAudioGuide,
    attractionAudioGuideLocaleData,
    attractionAudioGuideActiveLocale,
  ]);

  useEffect(() => {
    currentAttractionAudioGuideRef.current = currentAttractionAudioGuide;
  }, [currentAttractionAudioGuide]);

  useEffect(() => {
    attractionAudioGuideActiveLocaleRef.current = attractionAudioGuideActiveLocale;
  }, [attractionAudioGuideActiveLocale]);

  useEffect(() => {
    attractionAudioGuideLocaleDataRef.current = attractionAudioGuideLocaleData;
  }, [attractionAudioGuideLocaleData]);

  useEffect(() => {
    const id = normalizeId(currentAttractionAudioGuide?.id);

    if (!id) {
      currentAttractionAudioGuideIdRef.current = null;
      attractionAudioGuideSavedSnapshotRef.current = null;
      return;
    }

    if (currentAttractionAudioGuideIdRef.current !== id) {
      currentAttractionAudioGuideIdRef.current = id;
      attractionAudioGuideSavedSnapshotRef.current =
        buildAttractionAudioGuidePersistSnapshot(
          currentAttractionAudioGuide,
          attractionAudioGuideLocaleData,
        );
    }
  }, [currentAttractionAudioGuide, attractionAudioGuideLocaleData]);

  useEffect(() => {
    audioGuidePlanGenerationStateRef.current = audioGuidePlanGenerationState;
  }, [audioGuidePlanGenerationState]);

  const patchAudioGuidePlanGenerationState = useCallback((guideId, lang, patch) => {
    const gid = normalizeId(guideId);
    const langKey = String(lang || '').trim();
    if (!gid || !langKey) return;

    setAudioGuidePlanGenerationState((prev) => {
      const rawPrev = prev[gid]?.[langKey];
      const base =
        typeof rawPrev === 'object' && rawPrev !== null && !Array.isArray(rawPrev)
          ? { ...emptyAudioGuidePlanGenerationLocaleState(), ...rawPrev }
          : {
              ...emptyAudioGuidePlanGenerationLocaleState(),
              prompt: typeof rawPrev === 'string' ? rawPrev : '',
            };

      const nextLocale = {
        ...base,
        ...patch,
      };
      if (Object.prototype.hasOwnProperty.call(patch, 'desiredItemsCount')) {
        nextLocale.desiredItemsCount = normalizeAudioGuidePlanItemsCount(
          patch.desiredItemsCount,
        );
      }

      const next = {
        ...prev,
        [gid]: {
          ...(prev[gid] || {}),
          [langKey]: nextLocale,
        },
      };
      audioGuidePlanGenerationStateRef.current = next;
      return next;
    });
  }, []);

  const setAttractionAudioGuidePlanGenerationPrompt = useCallback(
    (guideId, lang, value) => {
      patchAudioGuidePlanGenerationState(guideId, lang, { prompt: value });
    },
    [patchAudioGuidePlanGenerationState],
  );

  const setAttractionAudioGuidePlanItemsCount = useCallback(
    (guideId, lang, value) => {
      patchAudioGuidePlanGenerationState(guideId, lang, {
        desiredItemsCount: value,
      });
    },
    [patchAudioGuidePlanGenerationState],
  );

  const addAttractionAudioGuide = useCallback(async () => {
    try {
      const activeAttractionId = normalizeId(currentAttr?.id);

      const emptyGuide = createEmptyAttractionAudioGuide({
        activeAttractionId,
        sourceLocaleData: attrLocaleData,
      });

      const res = await attractionAudioGuidesAPI.create(
        sessionId,
        buildAttractionAudioGuidePayload(emptyGuide, { includeTracks: false }),
      );

      const rawGuide = res?.data?.attraction_audio_guide || res?.data;
      const guide = rawGuide?.id != null ? normalizeAttractionAudioGuide(rawGuide) : null;

      if (guide?.id) {
        const localeKeys = Object.keys(attrLocaleData || {});
        const nextActiveLocale = localeKeys.includes(attractionAudioGuideActiveLocale)
          ? attractionAudioGuideActiveLocale
          : localeKeys[0] || 'ru-RU';

        setAttractionAudioGuides((prev) => [...prev, guide]);
        setCurrentAttractionAudioGuide(guide);
        setAttractionAudioGuideActiveLocale(nextActiveLocale);

        showNote(
          activeAttractionId
            ? 'Аудиогид добавлен и привязан к текущей достопримечательности'
            : 'Аудиогид достопримечательности добавлен',
          'success',
        );
      }
    } catch (e) {
      showNote(
        'Ошибка при добавлении аудиогида: ' + parseApiError(e),
        'error',
      );
    }
  }, [
    sessionId,
    currentAttr,
    attrLocaleData,
    attractionAudioGuideActiveLocale,
    showNote,
  ]);

  const updateCurrentAttractionAudioGuidePatch = useCallback((patch) => {
    setCurrentAttractionAudioGuide((prev) => {
      if (!prev) return prev;

      const updated = normalizeAttractionAudioGuide({
        ...prev,
        ...patch,
      });

      setAttractionAudioGuides((items) =>
        items.map((item) =>
          normalizeId(item.id) === normalizeId(updated.id) ? updated : item,
        ),
      );

      return updated;
    });
  }, []);

  const updateAttractionAudioGuideLocaleField = useCallback(
    (field, value) => {
      const lang =
        attractionAudioGuideLocaleData?.[attractionAudioGuideActiveLocale]?.lang ||
        getLocaleLang(attractionAudioGuideActiveLocale);

      setCurrentAttractionAudioGuide((prev) => {
        if (!prev) return prev;

        const baseField = prev[field] || {};
        const updated = {
          ...prev,
          [field]: {
            ...baseField,
            [lang]: value,
          },
        };

        setAttractionAudioGuides((items) =>
          items.map((item) =>
            normalizeId(item.id) === normalizeId(updated.id) ? updated : item,
          ),
        );

        return updated;
      });
    },
    [
      attractionAudioGuideActiveLocale,
      attractionAudioGuideLocaleData,
    ],
  );

  const updateAttractionAudioGuidePlanPoint = useCallback(
    (lang, itemId, value) => {
      const targetLang =
        lang ||
        attractionAudioGuideLocaleData?.[attractionAudioGuideActiveLocale]?.lang ||
        getLocaleLang(attractionAudioGuideActiveLocale);

      if (!targetLang) return;

      setCurrentAttractionAudioGuide((prev) => {
        if (!prev) return prev;

        const plan = normalizeAudioGuidePlanItemsForLang(
          prev.content_plan?.[targetLang],
        );

        const nextPlan = plan.map((item) => {
          if (item.id !== itemId) return item;

          return {
            ...item,
            title: value == null ? '' : String(value),
          };
        });

        const updated = {
          ...prev,
          content_plan: {
            ...(prev.content_plan || {}),
            [targetLang]: nextPlan,
          },
        };

        setAttractionAudioGuides((items) =>
          items.map((item) =>
            normalizeId(item.id) === normalizeId(updated.id) ? updated : item,
          ),
        );

        return updated;
      });
    },
    [attractionAudioGuideActiveLocale, attractionAudioGuideLocaleData],
  );

  const addAttractionAudioGuidePlanPoint = useCallback(
    (lang) => {
      const targetLang =
        lang ||
        attractionAudioGuideLocaleData?.[attractionAudioGuideActiveLocale]?.lang ||
        getLocaleLang(attractionAudioGuideActiveLocale);

      if (!targetLang) return;

      setCurrentAttractionAudioGuide((prev) => {
        if (!prev) return prev;

        const plan = normalizeAudioGuidePlanItemsForLang(
          prev.content_plan?.[targetLang],
        );

        const newId = generateAudioGuidePlanItemId();
        const nextPlan = [
          ...plan,
          { id: newId, title: '' },
        ];

        const ct = { ...(prev.content_texts || {}) };
        const langMap = { ...(ct[targetLang] || {}) };
        langMap[newId] = '';
        ct[targetLang] = langMap;

        const updated = {
          ...prev,
          content_plan: {
            ...(prev.content_plan || {}),
            [targetLang]: nextPlan,
          },
          content_texts: ct,
        };

        setAttractionAudioGuides((items) =>
          items.map((item) =>
            normalizeId(item.id) === normalizeId(updated.id) ? updated : item,
          ),
        );

        return updated;
      });
    },
    [attractionAudioGuideActiveLocale, attractionAudioGuideLocaleData],
  );

  const removeAttractionAudioGuidePlanPoint = useCallback(
    (lang, itemId) => {
      const targetLang =
        lang ||
        attractionAudioGuideLocaleData?.[attractionAudioGuideActiveLocale]?.lang ||
        getLocaleLang(attractionAudioGuideActiveLocale);

      if (!targetLang) return;

      setCurrentAttractionAudioGuide((prev) => {
        if (!prev) return prev;

        const plan = normalizeAudioGuidePlanItemsForLang(
          prev.content_plan?.[targetLang],
        );

        const nextPlan = plan.filter((item) => item.id !== itemId);

        const ct = { ...(prev.content_texts || {}) };
        const langMap = { ...(ct[targetLang] || {}) };
        delete langMap[itemId];
        ct[targetLang] = langMap;

        const updated = {
          ...prev,
          content_plan: {
            ...(prev.content_plan || {}),
            [targetLang]: nextPlan,
          },
          content_texts: ct,
        };

        setAttractionAudioGuides((items) =>
          items.map((item) =>
            normalizeId(item.id) === normalizeId(updated.id) ? updated : item,
          ),
        );

        return updated;
      });
    },
    [attractionAudioGuideActiveLocale, attractionAudioGuideLocaleData],
  );

  const updateAttractionAudioGuidePlanItemText = useCallback(
    (lang, itemId, value) => {
      const targetLang =
        lang ||
        attractionAudioGuideLocaleData?.[attractionAudioGuideActiveLocale]?.lang ||
        getLocaleLang(attractionAudioGuideActiveLocale);

      if (!targetLang || !itemId) return;

      setCurrentAttractionAudioGuide((prev) => {
        if (!prev) return prev;

        const ct = { ...(prev.content_texts || {}) };
        const langMap = { ...(ct[targetLang] || {}) };
        langMap[itemId] = value == null ? '' : String(value);
        ct[targetLang] = langMap;

        const updated = {
          ...prev,
          content_texts: ct,
        };

        setAttractionAudioGuides((items) =>
          items.map((item) =>
            normalizeId(item.id) === normalizeId(updated.id) ? updated : item,
          ),
        );

        return updated;
      });
    },
    [attractionAudioGuideActiveLocale, attractionAudioGuideLocaleData],
  );

  const saveCurrentAttractionAudioGuide = useCallback(
    async ({ silent = false } = {}) => {
      if (!currentAttractionAudioGuide) return null;

      const assignedType =
        currentAttractionAudioGuide.assigned_attraction_type ?? 'none';

      const eventId =
        currentAttractionAudioGuide.event_id ??
        currentAttractionAudioGuide.event ??
        currentAttractionAudioGuide.attraction_id ??
        currentAttractionAudioGuide.attraction ??
        null;

      const sessionAttractionId =
        currentAttractionAudioGuide.session_attraction_id ??
        currentAttractionAudioGuide.session_attraction ??
        null;

      if (assignedType === 'database' && !eventId) {
        if (!silent) {
          showNote('Выберите достопримечательность из базы', 'error');
        }
        throw new Error('missing-database-attraction');
      }

      if (assignedType === 'draft' && !sessionAttractionId) {
        if (!silent) {
          showNote('Выберите достопримечательность из сессии', 'error');
        }
        throw new Error('missing-session-attraction');
      }

      setAttractionAudioGuideSaving(true);

      try {
        const payload = buildAttractionAudioGuideSavePayload(
          currentAttractionAudioGuide,
          attractionAudioGuideLocaleData,
        );

        const res = await attractionAudioGuidesAPI.update(
          sessionId,
          currentAttractionAudioGuide.id,
          payload,
        );

        const responseGuide =
          res?.data?.attraction_audio_guide || res?.data || {};

        const updatedGuide = normalizeAttractionAudioGuide({
          ...currentAttractionAudioGuide,
          ...responseGuide,

          title: responseGuide.title ?? payload.title,
          content_plan: responseGuide.content_plan ?? payload.content_plan,
          content_texts: normalizeContentTexts(
            responseGuide.content_texts ??
              payload.content_texts ??
              currentAttractionAudioGuide.content_texts ??
              {},
          ),

          tracks:
            responseGuide.tracks ??
            currentAttractionAudioGuide.tracks ??
            {},
        });

        setAttractionAudioGuides((prev) =>
          prev.map((item) =>
            normalizeId(item.id) === normalizeId(currentAttractionAudioGuide.id)
              ? updatedGuide
              : item,
          ),
        );

        setCurrentAttractionAudioGuide(updatedGuide);

        attractionAudioGuideSavedSnapshotRef.current =
          buildAttractionAudioGuidePersistSnapshot(
            updatedGuide,
            attractionAudioGuideLocaleData,
          );

        if (!silent) {
          showNote('Аудиогид сохранён', 'success');
        }

        return updatedGuide;
      } catch (e) {
        if (!silent) {
          showNote(
            'Ошибка при сохранении аудиогида: ' + parseApiError(e),
            'error',
          );
        }
        throw e;
      } finally {
        setAttractionAudioGuideSaving(false);
      }
    },
    [
      sessionId,
      currentAttractionAudioGuide,
      attractionAudioGuideLocaleData,
      showNote,
    ],
  );

  const isCurrentAttractionAudioGuideDirty = useCallback(() => {
    if (!currentAttractionAudioGuide?.id) return false;

    const snap = buildAttractionAudioGuidePersistSnapshot(
      currentAttractionAudioGuide,
      attractionAudioGuideLocaleData,
    );

    return snap !== attractionAudioGuideSavedSnapshotRef.current;
  }, [currentAttractionAudioGuide, attractionAudioGuideLocaleData]);

  const saveCurrentAttractionAudioGuideIfDirty = useCallback(
    async (options = {}) => {
      if (
        !currentAttractionAudioGuide?.id ||
        !isCurrentAttractionAudioGuideDirty()
      ) {
        return true;
      }

      await saveCurrentAttractionAudioGuide(options);
      return true;
    },
    [
      currentAttractionAudioGuide,
      isCurrentAttractionAudioGuideDirty,
      saveCurrentAttractionAudioGuide,
    ],
  );

  useEffect(() => {
    clearTimeout(attractionAudioGuideAutoSaveTimerRef.current);

    if (!sessionId || !currentAttractionAudioGuide?.id) return;

    if (!isCurrentAttractionAudioGuideDirty()) return;

    attractionAudioGuideAutoSaveTimerRef.current = setTimeout(async () => {
      if (
        attractionAudioGuideSavingRef.current ||
        attractionAudioGuideBusyRef.current
      ) {
        return;
      }

      setAttractionAudioGuideAutoSaving(true);
      setAttractionAudioGuideAutoSaved(false);

      try {
        await saveCurrentAttractionAudioGuide({ silent: true });

        setAttractionAudioGuideAutoSaved(true);

        clearTimeout(attractionAudioGuideAutoSavedTimerRef.current);
        attractionAudioGuideAutoSavedTimerRef.current = setTimeout(() => {
          setAttractionAudioGuideAutoSaved(false);
        }, 2500);
      } catch (e) {
        showNote('Ошибка автосохранения аудиогида: ' + parseApiError(e, 'Неизвестная ошибка'), 'error');
      } finally {
        setAttractionAudioGuideAutoSaving(false);
      }
    }, 2500);

    return () => {
      clearTimeout(attractionAudioGuideAutoSaveTimerRef.current);
    };
  }, [
    sessionId,
    currentAttractionAudioGuide,
    attractionAudioGuideLocaleData,
    isCurrentAttractionAudioGuideDirty,
    saveCurrentAttractionAudioGuide,
  ]);

  const openAttractionAudioGuideDetail = useCallback(
    async (guideId) => {
      const currentId = normalizeId(currentAttractionAudioGuide?.id);
      const nextId = normalizeId(guideId);

      if (currentId && nextId && currentId !== nextId) {
        try {
          await saveCurrentAttractionAudioGuideIfDirty({ silent: true });
        } catch {
          return;
        }
      }

      const target = attractionAudioGuides.find(
        (guide) => normalizeId(guide.id) === nextId,
      );

      if (!target) return;

      setCurrentAttractionAudioGuide(target);
      setAttractionAudioGuideActiveLocale('ru-RU');
    },
    [
      attractionAudioGuides,
      currentAttractionAudioGuide,
      saveCurrentAttractionAudioGuideIfDirty,
    ],
  );

  const deleteCurrentAttractionAudioGuide = useCallback(async () => {
    if (!currentAttractionAudioGuide) return;

    const name = getAttractionAudioGuideName(currentAttractionAudioGuide);

    if (!(await confirm({ message: `Удалить «${name}»?`, danger: true }))) {
      return;
    }

    try {
      await attractionAudioGuidesAPI.delete(
        sessionId,
        currentAttractionAudioGuide.id,
      );

      setAttractionAudioGuides((items) =>
        items.filter(
          (item) =>
            normalizeId(item.id) !== normalizeId(currentAttractionAudioGuide.id),
        ),
      );

      setCurrentAttractionAudioGuide(null);

      showNote('Аудиогид удалён', 'success');
    } catch (e) {
      showNote(
        'Ошибка при удалении аудиогида: ' + parseApiError(e),
        'error',
      );
    }
  }, [
    sessionId,
    currentAttractionAudioGuide,
    getAttractionAudioGuideName,
    confirm,
    showNote,
  ]);

  const removeAttractionAudioGuideTrack = useCallback(() => {
    const guide = currentAttractionAudioGuideRef.current;
    if (!guide?.id) {
      showNote('Сначала откройте аудиогид', 'error');
      return;
    }

    const activeLoc = attractionAudioGuideActiveLocaleRef.current;
    const localeSnapshot = attractionAudioGuideLocaleDataRef.current;

    const lang =
      localeSnapshot?.[activeLoc]?.lang || getLocaleLang(activeLoc);

    if (!lang) {
      showNote('Не удалось определить язык трека', 'error');
      return;
    }

    const mergeTrackIntoGuide = (base) => {
      const nextTracks = { ...(base.tracks || {}) };
      delete nextTracks[lang];

      return normalizeAttractionAudioGuide({
        ...base,
        tracks: nextTracks,
      });
    };

    setCurrentAttractionAudioGuide((prev) => {
      if (!prev || normalizeId(prev.id) !== normalizeId(guide.id)) {
        return prev;
      }

      return mergeTrackIntoGuide(prev);
    });

    setAttractionAudioGuides((prev) =>
      prev.map((item) => {
        if (normalizeId(item.id) !== normalizeId(guide.id)) {
          return item;
        }

        return mergeTrackIntoGuide(item);
      }),
    );
  }, [showNote]);

  const uploadAttractionAudioGuideTrack = useCallback(
    async (file, languageOverride = null) => {
      if (!file) return;

      const guide = currentAttractionAudioGuideRef.current;
      if (!guide?.id) {
        showNote('Сначала откройте аудиогид', 'error');
        return;
      }

      const activeLoc = attractionAudioGuideActiveLocaleRef.current;
      const localeSnapshot = attractionAudioGuideLocaleDataRef.current;

      const lang =
        languageOverride ||
        localeSnapshot?.[activeLoc]?.lang ||
        getLocaleLang(activeLoc);

      if (!lang) {
        showNote('Не удалось определить язык трека', 'error');
        return;
      }

      const sessionUuid = getSessionUuid();

      const formData = new FormData();
      formData.append('audio', file);
      formData.append('language', lang);
      formData.append('temp', 'true');
      if (sessionUuid) {
        formData.append('session_uuid', String(sessionUuid));
      }

      setAttractionAudioUploading(true);

      try {
        const res = await audioAPI.upload(formData);
        const audioPayload = res?.data?.audio || res?.data || {};

        const audioId =
          audioPayload.id ??
          audioPayload.audio_id ??
          audioPayload.audio?.id ??
          null;

        const audioUrl =
          audioPayload.audio_url ??
          audioPayload.url ??
          audioPayload.audio?.url ??
          '';

        const copyright =
          audioPayload.copyright ??
          audioPayload.audio?.copyright ??
          '';

        if (!audioId) {
          throw new Error('Сервер не вернул id аудиофайла');
        }

        const trackPatch = {
          audio_id: audioId,
          audio_url: audioUrl,
          copyright,
        };

        const mergeTrackIntoGuide = (base) =>
          normalizeAttractionAudioGuide({
            ...base,
            tracks: {
              ...(base.tracks || {}),
              [lang]: {
                ...(base.tracks?.[lang] || {}),
                ...trackPatch,
              },
            },
          });

        const updatedGuide = mergeTrackIntoGuide(
          normalizeAttractionAudioGuide(guide),
        );

        setCurrentAttractionAudioGuide((prev) => {
          if (!prev || normalizeId(prev.id) !== normalizeId(guide.id)) {
            return prev;
          }

          return updatedGuide;
        });

        setAttractionAudioGuides((prev) =>
          prev.map((item) => {
            if (normalizeId(item.id) !== normalizeId(guide.id)) {
              return item;
            }

            return updatedGuide;
          }),
        );

        try {
          await attractionAudioGuidesAPI.update(sessionId, guide.id, {
            tracks: {
              [lang]: {
                audio_id: audioId,
                copyright,
              },
            },
          });
        } catch (persistErr) {
          showNote(
            'Файл загружен, но не сохранён в аудиогиде: ' +
              parseApiError(persistErr),
            'error',
          );
          return;
        }

        attractionAudioGuideSavedSnapshotRef.current =
          buildAttractionAudioGuidePersistSnapshot(
            updatedGuide,
            localeSnapshot,
          );

        showNote('Аудиофайл загружен', 'success');
      } catch (e) {
        showNote(
          'Ошибка при загрузке аудио: ' + parseApiError(e),
          'error',
        );
      } finally {
        setAttractionAudioUploading(false);
      }
    },
    [sessionId, showNote],
  );

  const generateAttractionAudioGuideTrackAudio = useCallback(
    async ({ languageCode = null, replaceExisting = false } = {}) => {
      const guide = currentAttractionAudioGuideRef.current;
      if (!guide?.id) {
        showNote('Сначала откройте аудиогид', 'error');
        return;
      }

      const activeLoc = attractionAudioGuideActiveLocaleRef.current;
      const localeSnapshot = attractionAudioGuideLocaleDataRef.current;
      const lang =
        languageCode ||
        localeSnapshot?.[activeLoc]?.lang ||
        getLocaleLang(activeLoc);

      if (!lang) {
        showNote('Не удалось определить язык трека', 'error');
        return;
      }

      const normalizedGuide = normalizeAttractionAudioGuide(guide);
      if (!audioGuideAllPlanItemsHaveText(normalizedGuide, lang)) {
        const message = 'Сначала заполните тексты всех пунктов аудиогида.';
        setAudioGuideTrackGenerationError(message);
        showNote(message, 'error');
        return;
      }

      const applyGuidePatch = (nextGuide) => {
        setCurrentAttractionAudioGuide((prev) => {
          if (!prev || normalizeId(prev.id) !== normalizeId(guide.id)) {
            return prev;
          }
          return nextGuide;
        });

        setAttractionAudioGuides((prev) =>
          prev.map((item) =>
            normalizeId(item.id) === normalizeId(guide.id) ? nextGuide : item,
          ),
        );
      };

      let workingGuide = normalizedGuide;
      let trackId = workingGuide.tracks?.[lang]?.id;

      if (!trackId) {
        try {
          const ensureRes = await attractionAudioGuidesAPI.update(
            sessionId,
            guide.id,
            {
              tracks: {
                [lang]: { copyright: '' },
              },
            },
          );
          workingGuide = normalizeAttractionAudioGuide(
            ensureRes?.data?.attraction_audio_guide || ensureRes?.data || {},
          );
          trackId = workingGuide.tracks?.[lang]?.id;
          applyGuidePatch(workingGuide);
          attractionAudioGuideSavedSnapshotRef.current =
            buildAttractionAudioGuidePersistSnapshot(
              workingGuide,
              localeSnapshot,
            );
        } catch (ensureErr) {
          showNote(
            'Не удалось подготовить дорожку аудиогида: ' +
              parseApiError(ensureErr),
            'error',
          );
          return;
        }
      }

      if (!trackId) {
        showNote('Не удалось определить дорожку аудиогида для языка', 'error');
        return;
      }

      setGeneratingAudioGuideTrack(true);
      setAudioGuideTrackGenerationError(null);

      if (normalizeId(workingGuide.id) === normalizeId(guide.id)) {
        applyGuidePatch(workingGuide);
      }

      try {
        const voiceId = (audioGuideTtsVoiceId || audioGuideTtsVoiceIdRef.current || '').trim();
        const payload = {
          language_code: lang,
          replace_existing: Boolean(replaceExisting),
        };
        if (voiceId) payload.voice_id = voiceId;

        if (audioGuideTtsModelTouchedRef.current) {
          const modelId = (audioGuideTtsModelId || audioGuideTtsModelIdRef.current || '').trim();
          if (modelId) payload.model_id = modelId;
        }

        if (import.meta.env.DEV) {
          console.debug('ElevenLabs generate audio payload', payload);
        }

        const res = await attractionAudioGuidesAPI.generateTrackAudio(
          sessionId,
          guide.id,
          trackId,
          payload,
        );

        const data = res?.data || {};
        if (!data.ok) {
          throw new Error(data.error || 'Не удалось сгенерировать аудио');
        }

        const merged = mergeAudioGuideTrackFromTtsResponse(
          workingGuide,
          lang,
          data,
        );
        applyGuidePatch(merged);
        attractionAudioGuideSavedSnapshotRef.current =
          buildAttractionAudioGuidePersistSnapshot(
            merged,
            localeSnapshot,
          );
        showNote(
          data.reused
            ? 'Аудиофайл уже актуален — повторная генерация не потребовалась'
            : 'Аудиофайл аудиогида сгенерирован',
          'success',
        );
      } catch (error) {
        const message = mapAudioGuideTrackTtsError(error);
        setAudioGuideTrackGenerationError(message);
        showNote(message, 'error');
      } finally {
        setGeneratingAudioGuideTrack(false);
      }
    },
    [sessionId, showNote, audioGuideTtsVoiceId, audioGuideTtsModelId],
  );

  const pendingPlanGenerationRef = useRef(null);

  const runAttractionAudioGuidePlanGeneration = useCallback(
    async (snapshot, { closeSettingsModalOnSuccess = true } = {}) => {
      const {
        guideId,
        lang,
        assigned,
        eventId,
        sessionAttractionId,
        title,
        desired_items_count,
        prompt,
        generation_mode,
        use_web_search,
      } = snapshot;

      const expectedGuideId = normalizeId(guideId);
      setAudioGuideGeneratingPlan(true);
      setAudioGuidePlanGenerationError('');

      try {
        const planPayload = {
          lang,
          title,
          assigned_attraction_type: assigned,
          session_attraction_id: sessionAttractionId,
          event_id: eventId,
          desired_items_count,
          generation_mode,
          use_web_search,
        };
        if (prompt) {
          planPayload.prompt = prompt;
        }

        const res = await attractionAudioGuidesAPI.generatePlan(
          sessionId,
          guideId,
          planPayload,
        );

        if (res?.data?.success === false) {
          const message = res?.data?.error || 'Не удалось сгенерировать план';
          setAudioGuidePlanGenerationError(message);
          showNote(message, 'error');
          return;
        }

        const rawPlan = res?.data?.content_plan?.[lang];
        const newPlan = normalizeAudioGuidePlanItemsForLang(rawPlan);

        if (!newPlan.length) {
          const message = 'План не получен';
          setAudioGuidePlanGenerationError(message);
          showNote(message, 'error');
          return;
        }

        const freshTexts = {};
        newPlan.forEach((item) => {
          freshTexts[item.id] = '';
        });

        setCurrentAttractionAudioGuide((prev) => {
          if (!prev || normalizeId(prev.id) !== expectedGuideId) return prev;

          const updated = normalizeAttractionAudioGuide({
            ...prev,
            content_plan: {
              ...(prev.content_plan || {}),
              [lang]: newPlan,
            },
            content_texts: {
              ...(prev.content_texts || {}),
              [lang]: freshTexts,
            },
          });

          setAttractionAudioGuides((items) =>
            items.map((item) =>
              normalizeId(item.id) === expectedGuideId ? updated : item,
            ),
          );

          return updated;
        });

        if (closeSettingsModalOnSuccess) {
          setAudioGuidePlanGenerateModalOpen(false);
          setAudioGuidePlanGeneratePrompt('');
        }
        showNote('План сгенерирован', 'success');
      } catch (e) {
        const message = 'Ошибка генерации плана: ' + parseApiError(e);
        setAudioGuidePlanGenerationError(message);
        showNote(message, 'error');
      } finally {
        setAudioGuideGeneratingPlan(false);
      }
    },
    [sessionId, showNote],
  );

  const generateAttractionAudioGuidePlan = useCallback(async () => {
    const g = currentAttractionAudioGuideRef.current;
    const activeLoc = attractionAudioGuideActiveLocaleRef.current;
    const loc = attractionAudioGuideLocaleDataRef.current?.[activeLoc];
    const lang = loc?.lang || getLocaleLang(activeLoc) || 'ru';

    const assigned = g?.assigned_attraction_type ?? 'none';
    const eventId =
      g?.event_id ?? g?.event ?? g?.attraction_id ?? g?.attraction ?? null;
    const sessionAttractionId =
      g?.session_attraction_id ?? g?.session_attraction ?? null;
    const guideId = g?.id;

    if (!g?.id || !guideId) {
      setAudioGuidePlanGenerationError('Сначала откройте аудиогид');
      showNote('Сначала откройте аудиогид', 'error');
      return;
    }

    const planItems = normalizeAudioGuidePlanItemsForLang(g.content_plan?.[lang]);
    const hasPlan = planItems.length > 0;

    const expectedGuideId = normalizeId(guideId);
    const planGenState =
      audioGuidePlanGenerationStateRef.current[expectedGuideId]?.[lang] ?? {};
    const desiredItemsCount = normalizeAudioGuidePlanItemsCount(
      planGenState.desiredItemsCount,
    );
    const generationFields = buildGenerationPayloadFields(
      aiGenerationMode,
      aiUseWebSearch,
    );
    const payloadSnapshot = {
      guideId,
      lang,
      assigned,
      eventId,
      sessionAttractionId,
      title: g.title ?? {},
      desired_items_count: desiredItemsCount,
      prompt: audioGuidePlanGeneratePrompt.trim(),
      generation_mode: generationFields.generation_mode,
      use_web_search: generationFields.use_web_search,
    };

    if (hasPlan) {
      pendingPlanGenerationRef.current = payloadSnapshot;
      const ok = await confirm({
        message:
          'Существующий план для этого языка будет заменён. Продолжить?',
        danger: true,
        confirmLabel: 'Продолжить',
      });
      if (!ok) {
        pendingPlanGenerationRef.current = null;
        return;
      }

      const pendingPayload = pendingPlanGenerationRef.current;
      pendingPlanGenerationRef.current = null;
      setAudioGuidePlanGenerateModalOpen(false);
      await runAttractionAudioGuidePlanGeneration(pendingPayload, {
        closeSettingsModalOnSuccess: false,
      });
      return;
    }

    await runAttractionAudioGuidePlanGeneration(payloadSnapshot);
  }, [
    confirm,
    showNote,
    audioGuidePlanGeneratePrompt,
    aiGenerationMode,
    aiUseWebSearch,
    runAttractionAudioGuidePlanGeneration,
  ]);

  const openAttractionAudioGuidePlanGenerateModal = useCallback(() => {
    const g = currentAttractionAudioGuideRef.current;

    if (!g?.id) {
      showNote('Сначала откройте аудиогид', 'error');
      return;
    }

    setAudioGuidePlanGenerationError('');
    setAudioGuidePlanGeneratePrompt('');
    setAudioGuidePlanGenerateModalOpen(true);
  }, [showNote]);

  const closeAttractionAudioGuidePlanGenerateModal = useCallback(() => {
    if (audioGuideGeneratingPlan) return;
    setAudioGuidePlanGenerateModalOpen(false);
    setAudioGuidePlanGenerationError('');
  }, [audioGuideGeneratingPlan]);

  const pendingMainTextGenerationRef = useRef(null);

  const runAttractionAudioGuideMainTextGeneration = useCallback(
    async (snapshot, { closeSettingsModalOnSuccess = true } = {}) => {
      const {
        guideId,
        lang,
        assigned,
        eventId,
        sessionAttractionId,
        title,
        content_plan,
        content_texts,
        prompt,
        generation_mode,
        use_web_search,
      } = snapshot;

      const expectedGuideId = normalizeId(guideId);
      setAudioGuideGeneratingAllMainText(true);
      setAudioGuideMainTextGenerationError('');

      try {
        const res = await attractionAudioGuidesAPI.generateMainText(
          sessionId,
          guideId,
          {
            lang,
            title,
            assigned_attraction_type: assigned,
            session_attraction_id: sessionAttractionId,
            event_id: eventId,
            content_plan,
            content_texts,
            prompt,
            generation_mode,
            use_web_search,
          },
        );

        if (res?.data?.success === false) {
          const message =
            res?.data?.error || 'Не удалось сгенерировать основной текст';
          setAudioGuideMainTextGenerationError(message);
          showNote(message, 'error');
          return;
        }

        const incoming = res?.data?.content_texts?.[lang];
        if (!incoming || typeof incoming !== 'object') {
          const message = 'Ответ сервера не содержит текстов';
          setAudioGuideMainTextGenerationError(message);
          showNote(message, 'error');
          return;
        }

        setCurrentAttractionAudioGuide((prev) => {
          if (!prev || normalizeId(prev.id) !== expectedGuideId) return prev;

          const mergedLang = { ...(prev.content_texts?.[lang] || {}), ...incoming };

          const updated = normalizeAttractionAudioGuide({
            ...prev,
            content_texts: {
              ...(prev.content_texts || {}),
              [lang]: mergedLang,
            },
          });

          setAttractionAudioGuides((items) =>
            items.map((item) =>
              normalizeId(item.id) === expectedGuideId ? updated : item,
            ),
          );

          return updated;
        });

        if (closeSettingsModalOnSuccess) {
          setAudioGuideMainTextGenerateModalOpen(false);
          setAudioGuideMainTextGeneratePrompt('');
        }
        showNote('Основной текст сгенерирован', 'success');
      } catch (e) {
        const message =
          'Ошибка генерации основного текста: ' + parseApiError(e);
        setAudioGuideMainTextGenerationError(message);
        showNote(message, 'error');
      } finally {
        setAudioGuideGeneratingAllMainText(false);
      }
    },
    [sessionId, showNote],
  );

  const generateAttractionAudioGuideMainText = useCallback(async () => {
    const g = currentAttractionAudioGuideRef.current;
    const activeLoc = attractionAudioGuideActiveLocaleRef.current;
    const loc = attractionAudioGuideLocaleDataRef.current?.[activeLoc];
    const lang = loc?.lang || getLocaleLang(activeLoc) || 'ru';

    const assigned = g?.assigned_attraction_type ?? 'none';
    const eventId =
      g?.event_id ?? g?.event ?? g?.attraction_id ?? g?.attraction ?? null;
    const sessionAttractionId =
      g?.session_attraction_id ?? g?.session_attraction ?? null;
    const guideId = g?.id;

    if (!g?.id || !guideId) {
      setAudioGuideMainTextGenerationError('Сначала откройте аудиогид');
      showNote('Сначала откройте аудиогид', 'error');
      return;
    }

    const planItems = normalizeAudioGuidePlanItemsForLang(g.content_plan?.[lang]);
    if (planItems.length === 0) {
      setAudioGuideMainTextGenerationError('Сначала добавьте или сгенерируйте план аудиогида.');
      showNote('Сначала добавьте или сгенерируйте план аудиогида.', 'error');
      return;
    }

    const hasAnyText = planItems.some((p) =>
      String(g.content_texts?.[lang]?.[p.id] || '').trim(),
    );

    const generationFields = buildGenerationPayloadFields(
      aiGenerationMode,
      aiUseWebSearch,
    );
    const payloadSnapshot = {
      guideId,
      lang,
      assigned,
      eventId,
      sessionAttractionId,
      title: g.title ?? {},
      content_plan: g.content_plan ?? {},
      content_texts: g.content_texts ?? {},
      prompt: audioGuideMainTextGeneratePrompt.trim(),
      generation_mode: generationFields.generation_mode,
      use_web_search: generationFields.use_web_search,
    };

    if (hasAnyText) {
      pendingMainTextGenerationRef.current = payloadSnapshot;
      const ok = await confirm({
        message:
          'Существующий основной текст для этого языка будет заменён. Продолжить?',
        danger: true,
        confirmLabel: 'Продолжить',
      });
      if (!ok) {
        pendingMainTextGenerationRef.current = null;
        return;
      }

      const pendingPayload = pendingMainTextGenerationRef.current;
      pendingMainTextGenerationRef.current = null;
      setAudioGuideMainTextGenerateModalOpen(false);
      await runAttractionAudioGuideMainTextGeneration(pendingPayload, {
        closeSettingsModalOnSuccess: false,
      });
      return;
    }

    await runAttractionAudioGuideMainTextGeneration(payloadSnapshot);
  }, [
    confirm,
    showNote,
    audioGuideMainTextGeneratePrompt,
    aiGenerationMode,
    aiUseWebSearch,
    runAttractionAudioGuideMainTextGeneration,
  ]);

  const openAttractionAudioGuideMainTextGenerateModal = useCallback(() => {
    const g = currentAttractionAudioGuideRef.current;
    const activeLoc = attractionAudioGuideActiveLocaleRef.current;
    const loc = attractionAudioGuideLocaleDataRef.current?.[activeLoc];
    const lang = loc?.lang || getLocaleLang(activeLoc) || 'ru';

    if (!g?.id) {
      showNote('Сначала откройте аудиогид', 'error');
      return;
    }

    const planItems = normalizeAudioGuidePlanItemsForLang(g.content_plan?.[lang]);
    if (planItems.length === 0) {
      showNote('Сначала добавьте или сгенерируйте план аудиогида.', 'error');
      return;
    }

    setAudioGuideMainTextGenerationError('');
    setAudioGuideMainTextGeneratePrompt('');
    setAudioGuideMainTextGenerateModalOpen(true);
  }, [showNote]);

  const closeAttractionAudioGuideMainTextGenerateModal = useCallback(() => {
    if (audioGuideGeneratingAllMainText) return;
    setAudioGuideMainTextGenerateModalOpen(false);
    setAudioGuideMainTextGenerationError('');
  }, [audioGuideGeneratingAllMainText]);

  const pendingItemTextGenerationRef = useRef(null);

  const runAttractionAudioGuideMainTextItemGeneration = useCallback(
    async (snapshot, { closeSettingsModalOnSuccess = true } = {}) => {
      const {
        guideId,
        lang,
        assigned,
        eventId,
        sessionAttractionId,
        title,
        content_plan,
        itemId,
        itemTitle,
        current_text,
        additional_prompt,
        generation_mode,
        use_web_search,
      } = snapshot;

      const expectedGuideId = normalizeId(guideId);

      setAudioGuideGeneratingItemTextById((prev) => ({
        ...prev,
        [itemId]: true,
      }));
      setAudioGuideItemTextGenerationError('');

      try {
        const res = await attractionAudioGuidesAPI.generateMainTextItem(
          sessionId,
          guideId,
          {
            lang,
            title,
            assigned_attraction_type: assigned,
            session_attraction_id: sessionAttractionId,
            event_id: eventId,
            plan_item: {
              id: itemId,
              title: itemTitle,
            },
            content_plan,
            current_text,
            additional_prompt,
            generation_mode,
            use_web_search,
          },
        );

        if (res?.data?.success === false) {
          const message =
            res?.data?.error || 'Не удалось сгенерировать текст раздела';
          setAudioGuideItemTextGenerationError(message);
          showNote(message, 'error');
          return;
        }

        const text = res?.data?.text;
        const outId = String(res?.data?.plan_item_id || itemId).trim();

        if (typeof text !== 'string' || !text.trim()) {
          const message = 'Пустой ответ модели';
          setAudioGuideItemTextGenerationError(message);
          showNote(message, 'error');
          return;
        }

        setCurrentAttractionAudioGuide((prev) => {
          if (!prev || normalizeId(prev.id) !== expectedGuideId) return prev;

          const langMap = { ...(prev.content_texts?.[lang] || {}) };
          langMap[outId] = text.trim();

          const updated = normalizeAttractionAudioGuide({
            ...prev,
            content_texts: {
              ...(prev.content_texts || {}),
              [lang]: langMap,
            },
          });

          setAttractionAudioGuides((items) =>
            items.map((item) =>
              normalizeId(item.id) === expectedGuideId ? updated : item,
            ),
          );

          return updated;
        });

        if (closeSettingsModalOnSuccess) {
          setAudioGuideItemTextGenerateModalOpen(false);
          setAudioGuideItemTextGenerateItemId(null);
          setAudioGuideItemTextGenerateItemTitle('');
          audioGuideItemTextGeneratePlanItemRef.current = null;
          setAudioGuideItemTextGeneratePrompt('');
        }
        showNote('Текст раздела обновлён', 'success');
      } catch (e) {
        const message =
          'Ошибка генерации текста раздела: ' + parseApiError(e);
        setAudioGuideItemTextGenerationError(message);
        showNote(message, 'error');
      } finally {
        setAudioGuideGeneratingItemTextById((prev) => {
          const next = { ...prev };
          delete next[itemId];
          return next;
        });
      }
    },
    [sessionId, showNote],
  );

  const generateAttractionAudioGuideMainTextItem = useCallback(async () => {
    const planItem = audioGuideItemTextGeneratePlanItemRef.current;
    const g = currentAttractionAudioGuideRef.current;
    const activeLoc = attractionAudioGuideActiveLocaleRef.current;
    const loc = attractionAudioGuideLocaleDataRef.current?.[activeLoc];
    const lang = loc?.lang || getLocaleLang(activeLoc) || 'ru';

    const assigned = g?.assigned_attraction_type ?? 'none';
    const eventId =
      g?.event_id ?? g?.event ?? g?.attraction_id ?? g?.attraction ?? null;
    const sessionAttractionId =
      g?.session_attraction_id ?? g?.session_attraction ?? null;
    const guideId = g?.id;

    const itemId = String(planItem?.id || audioGuideItemTextGenerateItemId || '').trim();
    if (!g?.id || !guideId || !itemId) {
      setAudioGuideItemTextGenerationError('Не удалось определить пункт плана');
      showNote('Не удалось определить пункт плана', 'error');
      return;
    }

    const itemTitle =
      planItem?.title != null
        ? String(planItem.title)
        : String(audioGuideItemTextGenerateItemTitle || '');

    const existingText = String(g.content_texts?.[lang]?.[itemId] ?? '').trim();
    const generationFields = buildGenerationPayloadFields(
      aiGenerationMode,
      aiUseWebSearch,
    );
    const payloadSnapshot = {
      guideId,
      lang,
      assigned,
      eventId,
      sessionAttractionId,
      title: g.title ?? {},
      content_plan: g.content_plan ?? {},
      itemId,
      itemTitle,
      current_text: String(g.content_texts?.[lang]?.[itemId] ?? ''),
      additional_prompt: audioGuideItemTextGeneratePrompt.trim(),
      generation_mode: generationFields.generation_mode,
      use_web_search: generationFields.use_web_search,
    };

    if (existingText) {
      pendingItemTextGenerationRef.current = payloadSnapshot;
      const ok = await confirm({
        message:
          'Существующий текст этого пункта будет заменён. Продолжить?',
        danger: true,
        confirmLabel: 'Продолжить',
      });
      if (!ok) {
        pendingItemTextGenerationRef.current = null;
        return;
      }

      const pendingPayload = pendingItemTextGenerationRef.current;
      pendingItemTextGenerationRef.current = null;
      setAudioGuideItemTextGenerateModalOpen(false);
      await runAttractionAudioGuideMainTextItemGeneration(pendingPayload, {
        closeSettingsModalOnSuccess: false,
      });
      return;
    }

    await runAttractionAudioGuideMainTextItemGeneration(payloadSnapshot);
  }, [
    confirm,
    showNote,
    audioGuideItemTextGenerateItemId,
    audioGuideItemTextGenerateItemTitle,
    audioGuideItemTextGeneratePrompt,
    aiGenerationMode,
    aiUseWebSearch,
    runAttractionAudioGuideMainTextItemGeneration,
  ]);

  const openAttractionAudioGuideMainTextItemGenerateModal = useCallback(
    (planItem) => {
      const g = currentAttractionAudioGuideRef.current;
      const itemId = String(planItem?.id || '').trim();

      if (!g?.id) {
        showNote('Сначала откройте аудиогид', 'error');
        return;
      }
      if (!itemId) {
        showNote('Не удалось определить пункт плана', 'error');
        return;
      }

      audioGuideItemTextGeneratePlanItemRef.current = planItem;
      setAudioGuideItemTextGenerateItemId(itemId);
      setAudioGuideItemTextGenerateItemTitle(
        planItem?.title != null ? String(planItem.title) : '',
      );
      setAudioGuideItemTextGenerationError('');
      setAudioGuideItemTextGeneratePrompt('');
      setAudioGuideItemTextGenerateModalOpen(true);
    },
    [showNote],
  );

  const closeAttractionAudioGuideMainTextItemGenerateModal = useCallback(() => {
    const itemId = audioGuideItemTextGenerateItemId;
    if (itemId && audioGuideGeneratingItemTextById?.[itemId]) return;

    setAudioGuideItemTextGenerateModalOpen(false);
    setAudioGuideItemTextGenerateItemId(null);
    setAudioGuideItemTextGenerateItemTitle('');
    audioGuideItemTextGeneratePlanItemRef.current = null;
    setAudioGuideItemTextGenerationError('');
  }, [audioGuideItemTextGenerateItemId, audioGuideGeneratingItemTextById]);

  return {
    attractionAudioGuides,
    setAttractionAudioGuides,
    currentAttractionAudioGuide,
    setCurrentAttractionAudioGuide,
    attractionAudioGuideActiveLocale,
    setAttractionAudioGuideActiveLocale,
    attractionAudioGuideSaving,
    attractionAudioGuideAutoSaving,
    attractionAudioGuideAutoSaved,
    attractionAudioUploading,
    audioGuideGeneratingPlan,
    audioGuidePlanGenerateModalOpen,
    audioGuidePlanGeneratePrompt,
    audioGuidePlanGenerationError,
    audioGuideGeneratingAllMainText,
    audioGuideMainTextGenerateModalOpen,
    audioGuideMainTextGeneratePrompt,
    audioGuideMainTextGenerationError,
    audioGuideGeneratingItemTextById,
    audioGuideItemTextGenerateModalOpen,
    audioGuideItemTextGenerateItemId,
    audioGuideItemTextGenerateItemTitle,
    audioGuideItemTextGeneratePrompt,
    audioGuideItemTextGenerationError,
    generatingAudioGuideTrack,
    audioGuideTrackGenerationError,
    audioGuidePlanGenerationState,
    elevenLabsSettingsLoading,
    elevenLabsSettingsError,
    elevenLabsSettings,
    audioGuideTtsVoiceId,
    audioGuideTtsModelId,
    attractionAudioGuideLocaleData,

    getAttractionAudioGuideName,
    addAttractionAudioGuide,
    openAttractionAudioGuideDetail,
    deleteCurrentAttractionAudioGuide,
    updateCurrentAttractionAudioGuidePatch,
    updateAttractionAudioGuideLocaleField,
    updateAttractionAudioGuidePlanPoint,
    addAttractionAudioGuidePlanPoint,
    removeAttractionAudioGuidePlanPoint,
    updateAttractionAudioGuidePlanItemText,
    saveCurrentAttractionAudioGuide,
    saveCurrentAttractionAudioGuideIfDirty,
    isCurrentAttractionAudioGuideDirty,
    removeAttractionAudioGuideTrack,
    uploadAttractionAudioGuideTrack,
    generateAttractionAudioGuideTrackAudio,
    generateAttractionAudioGuidePlan,
    openAttractionAudioGuidePlanGenerateModal,
    closeAttractionAudioGuidePlanGenerateModal,
    setAudioGuidePlanGeneratePrompt,
    generateAttractionAudioGuideMainText,
    openAttractionAudioGuideMainTextGenerateModal,
    closeAttractionAudioGuideMainTextGenerateModal,
    setAudioGuideMainTextGeneratePrompt,
    generateAttractionAudioGuideMainTextItem,
    openAttractionAudioGuideMainTextItemGenerateModal,
    closeAttractionAudioGuideMainTextItemGenerateModal,
    setAudioGuideItemTextGeneratePrompt,
    patchAudioGuidePlanGenerationState,
    setAttractionAudioGuidePlanGenerationPrompt,
    setAttractionAudioGuidePlanItemsCount,
    loadElevenLabsSettings,
    updateAudioGuideTtsVoiceId,
    updateAudioGuideTtsModelId,
    applyElevenLabsDefaultSelections,
  };
}
