import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { aiAPI, tasksAPI, cityInfosAPI, cityFiltersAPI, eventFiltersAPI, imagesAPI, sessionsAPI, tagsAPI } from '../../../api/generation';
import apiClient from '../../../api/client';
import TokenManager from '../../../utils/TokenManager';
import { trackEvent } from '../../../utils/analytics';
import { isNotFoundError, parseApiError } from '../../../utils/apiError';
import {
  removeFilterIdsFromTree,
  upsertEventFilterInTree,
} from '../../../features/catalog/shared/normalize';
import {
  applyLocalFilterDeletion,
  mergeCityFilterTreeWithLocalOverlays,
  mergeCityTagCatalogWithLocalOverlays,
  mergeEventFilterTreeWithLocalOverlays,
  normalizeCreatedFilter,
  unwrapCreatedFilter,
  upsertFlatFilterRow,
} from '../../../features/catalog/shared/tagCatalog';
import { clampGenerationCount } from '../../../components/generation/AiGenerationCountField.jsx';
import { formatGenerationDedupeResultMessage } from '../../../components/generation/AiGenerationDedupeToggle.jsx';
import {
  DEFAULT_GENERATION_MODE,
  buildGenerationPayloadFields,
} from '../../../components/generation/AiGenerationQualitySettings.jsx';
import {
  DEFAULT_LOCALE_DEFS,
  getLocaleInfo,
  isLocaleCodeUsedAsCountry,
  normalizeLocaleCountryForSave,
  normalizeLocaleDescriptionForSave,
  normalizeId,
  normalizeTagIds,
} from './sessionWizardShared.jsx';
import { normalizeDraftId } from './useSessionWizardHelpers.js';
import {
  pollGenerationTask,
  isPollCancelledError,
  TASK_NOT_FOUND_MESSAGE,
} from '../../../utils/generationTaskPoll';
import { parseUsefulInfoTextImport } from './usefulInfoTextImport';

export const makeLocaleData = () => {
  return Object.fromEntries(
    DEFAULT_LOCALE_DEFS.map((locale) => [
      locale.key,
      {
        code: locale.code,
        lang: locale.lang,
        langName: locale.langName,
        isDefault: locale.isDefault,
        name: '',
        description: '',
        country: '',
      },
    ])
  );
};

const BACKEND_SUPPORTED_LOCALE_NAMES = {
  it: ['итальянский', 'italian', 'it'],
  en: ['английский', 'english', 'en'],
  ru: ['русский', 'russian', 'ru'],
  fr: ['французский', 'french', 'fr'],
  de: ['немецкий', 'german', 'de'],
  es: ['испанский', 'spanish', 'es'],
};

function normalizeLocaleName(value) {
  return (value || '').toString().trim().toLowerCase();
}

function resolveBackendLanguageCode(langName) {
  const normalized = normalizeLocaleName(langName);
  if (!normalized) return '';

  if (/^[a-z]{2}$/i.test(normalized) && BACKEND_SUPPORTED_LOCALE_NAMES[normalized]) {
    return normalized;
  }

  for (const langCode in BACKEND_SUPPORTED_LOCALE_NAMES) {
    if (BACKEND_SUPPORTED_LOCALE_NAMES[langCode].includes(normalized)) {
      return langCode;
    }
  }

  return '';
}

function parseMapCoord(value) {
  if (value === null || value === undefined) return NaN;

  return parseFloat(String(value).trim().replace(',', '.'));
}

function hasValidMapCoords(latValue, lonValue) {
  const parsedLat = parseMapCoord(latValue);
  const parsedLon = parseMapCoord(lonValue);

  return (
    Number.isFinite(parsedLat) &&
    Number.isFinite(parsedLon) &&
    parsedLat >= -90 &&
    parsedLat <= 90 &&
    parsedLon >= -180 &&
    parsedLon <= 180
  );
}

const buildCityStepPayload = ({
  localeData,
  defaultLocale,
  lat,
  lon,
  cityTags,
  imageId,
  imageOriginalUrl,
  activeCityDraftId,
  baseUpdatedAt,
}) => {
  const name = {};
  const description = {};
  const country = {};

  Object.entries(localeData || {}).forEach(([, loc]) => {
    if (!loc?.lang) return;
    name[loc.lang] = loc.name != null ? String(loc.name).trim() : '';
    description[loc.lang] = normalizeLocaleDescriptionForSave(loc.description);
    country[loc.lang] = normalizeLocaleCountryForSave(loc.country, loc.code);
  });

  const draftId = normalizeDraftId(activeCityDraftId);

  return {
    name,
    description,
    country,
    lat: lat ? parseFloat(lat) : null,
    lon: lon ? parseFloat(lon) : null,
    default_language: localeData?.[defaultLocale]?.lang || null,
    tags: normalizeTagIds(cityTags),
    image_id: imageId,
    image_original_url: imageOriginalUrl || '',
    ...(draftId && draftId !== 'legacy' ? { draft_id: draftId } : {}),
    // optimistic concurrency: версия драфта на момент загрузки формы —
    // сейв поверх более свежих данных (их пишет генерация) бэкенд отклонит 409.
    ...(baseUpdatedAt ? { base_updated_at: baseUpdatedAt } : {}),
  };
};

function upsertCityDraft(drafts = [], draft) {
  const draftId = normalizeDraftId(draft?.id);

  if (!draftId) return drafts;

  const next = drafts
    .filter((item) => normalizeDraftId(item?.id) !== 'legacy')
    .filter((item) => normalizeDraftId(item?.id) !== draftId);

  return [...next, draft].sort((a, b) => {
    const orderA = Number.isFinite(Number(a?.order)) ? Number(a.order) : 0;
    const orderB = Number.isFinite(Number(b?.order)) ? Number(b.order) : 0;

    if (orderA !== orderB) return orderA - orderB;

    return String(a?.created_at || '').localeCompare(String(b?.created_at || ''));
  });
}

function normalizeCityDraft(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = normalizeDraftId(raw.id);
  if (!id) return null;
  const next = {
    ...raw,
    tags: normalizeTagIds(raw.tags ?? raw.city_tags ?? []),
  };
  delete next.isPending;
  return next;
}

function parseCreatedCityDraftResponse(res) {
  const d = res?.data;
  if (!d || typeof d !== 'object') return null;
  const nested =
    d.draft ??
    d.city_draft ??
    (d.data && typeof d.data === 'object' && !Array.isArray(d.data) ? d.data : null);
  if (nested) return nested;
  if (
    d.id != null &&
    typeof d.name === 'object' &&
    d.name !== null &&
    !Array.isArray(d.name)
  ) {
    return d;
  }
  if (d.draft_id != null) {
    return {
      id: String(d.draft_id),
      name: typeof d.name === 'object' && d.name ? d.name : {},
      description: typeof d.description === 'object' && d.description ? d.description : {},
      country: typeof d.country === 'object' && d.country ? d.country : {},
      order: d.order ?? 0,
      is_primary: Boolean(d.is_primary),
    };
  }
  return null;
}

const getLocaleLang = (localeKey) => {
  const locale = DEFAULT_LOCALE_DEFS.find((item) => item.key === localeKey);

  return locale?.lang || localeKey?.split('-')?.[0] || 'ru';
};

function getMultilangKeys(...objects) {
  const keys = new Set();

  objects.forEach((obj) => {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return;

    Object.keys(obj).forEach((key) => {
      const lang = String(key || '').trim().toLowerCase();

      if (lang) {
        keys.add(lang);
      }
    });
  });

  return Array.from(keys);
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

const normalizeCityInfo = (info = {}) => {
  const cityId = info.city_id ?? info.city ?? null;
  const sessionCityId = info.session_city_id ?? info.session_city ?? null;

  let assignedCityType = info.assigned_city_type ?? 'none';

  if (!info.assigned_city_type) {
    if (cityId) {
      assignedCityType = 'database';
    } else if (sessionCityId) {
      assignedCityType = 'draft';
    }
  }

  return {
    ...info,

    id: info.id ?? null,

    name: info.name ?? info.title ?? {},
    description: info.description ?? {},

    city: cityId,
    city_id: cityId,

    session_city: sessionCityId,
    session_city_id: sessionCityId,

    assigned_city_type: assignedCityType,
    assigned_city_name: info.assigned_city_name ?? null,
  };
};

const buildCityInfoPayload = (info, name, description) => {
  const assignedType = info.assigned_city_type ?? 'none';

  let city = null;
  let sessionCity = null;

  if (assignedType === 'database') {
    city = info.city_id ?? info.city ?? null;
  }

  if (assignedType === 'draft') {
    sessionCity = info.session_city_id ?? info.session_city ?? null;
  }

  return {
    name: name ?? info.name ?? {},
    description: description ?? info.description ?? {},

    assigned_city_type: assignedType,

    city,
    city_id: city,

    session_city: sessionCity,
    session_city_id: sessionCity,
  };
};

function collectCityInfoLocaleTexts(cityInfoLocaleData) {
  const name = {};
  const description = {};

  Object.values(cityInfoLocaleData || {}).forEach((d) => {
    if (!d?.lang) return;

    if (d.name || d.description) {
      name[d.lang] = d.name || '';
      description[d.lang] = d.description || '';
    }
  });

  return { name, description };
}

function buildCityInfoPersistSnapshot(info, cityInfoLocaleData) {
  if (!info?.id) return null;

  const { name, description } = collectCityInfoLocaleTexts(cityInfoLocaleData);

  return JSON.stringify(
    buildCityInfoPayload(normalizeCityInfo(info), name, description),
  );
}

const makeEmptyLocaleObject = (sourceLocaleData = null) => {
  const sourceEntries =
    sourceLocaleData && Object.keys(sourceLocaleData).length > 0
      ? Object.entries(sourceLocaleData).map(([key, loc]) => ({
          key,
          ...loc,
        }))
      : DEFAULT_LOCALE_DEFS;

  return sourceEntries.reduce((acc, locale) => {
    const lang =
      locale.lang ||
      locale.key?.split('-')?.[0] ||
      'ru';

    if (lang) {
      acc[lang] = '';
    }

    return acc;
  }, {});
};

const createEmptyCityInfo = ({
  activeDraftId = null,
  sourceLocaleData = null,
} = {}) => {
  const normalizedDraftId = normalizeDraftId(activeDraftId);
  const shouldAttachToDraft =
    normalizedDraftId && normalizedDraftId !== 'legacy';

  return {
    id: `city-info-${Date.now()}`,

    name: makeEmptyLocaleObject(sourceLocaleData),
    description: makeEmptyLocaleObject(sourceLocaleData),

    assigned_city_type: shouldAttachToDraft ? 'draft' : 'none',

    city: null,
    city_id: null,

    session_city: shouldAttachToDraft ? normalizedDraftId : null,
    session_city_id: shouldAttachToDraft ? normalizedDraftId : null,

    isNew: true,
  };
};

export default function useCityStep(ctx) {
  const {
    sessionId,
    session,
    showNote,
    confirm,
    localeData,
    setLocaleData,
    activeLocale,
    setActiveLocale,
    defaultLocale,
    setDefaultLocale,
    cityDrafts,
    setCityDrafts,
    activeCityDraftId,
    setActiveCityDraftId,
    activeCityDraftIdRef,
    referenceCities,
    hasUnsavedChangesRef,
    currentStepRef,
    sessionOpenedAtRef,
    firstCitySaveAtRef,
    navigate,
    location,
    loadSession,
    setSession,
  } = ctx;

  const [lat, setLat] = useState('');
  const [lon, setLon] = useState('');
  const [savedLat, setSavedLat] = useState(null);
  const [savedLon, setSavedLon] = useState(null);

  const [imageId, setImageId] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [imageOriginalUrl, setImageOriginalUrl] = useState('');
  const [imageCopyright, setImageCopyright] = useState('');
  const [photoUploading, setPhotoUploading] = useState(false);
  const photoFileRef = useRef(null);

  const [commonsModalOpen, setCommonsModalOpen] = useState(false);
  const [commonsTarget, setCommonsTarget] = useState({
    type: 'city',
    id: null,
  });

  const [cityTags, setCityTags] = useState([]);
  const [tagInput, setTagInput] = useState('');

  const [addLocaleOpen, setAddLocaleOpen] = useState(false);
  const [newLocaleCode, setNewLocaleCode] = useState('');
  const [newLocaleLang, setNewLocaleLang] = useState('');

  const [cityInfos, setCityInfos] = useState([]);
  const [currentCityInfo, setCurrentCityInfo] = useState(null);
  const [cityInfoActiveLocale, setCityInfoActiveLocale] = useState('ru-RU');
  const [cityInfoSaving, setCityInfoSaving] = useState(false);
  const cityInfoSavedSnapshotRef = useRef(null);
  const cityInfoAutoSaveTimerRef = useRef(null);
  const cityInfoAutoSavedTimerRef = useRef(null);
  const cityInfoSavingRef = useRef(false);
  const currentCityInfoIdRef = useRef(null);
  const [cityInfoAutoSaving, setCityInfoAutoSaving] = useState(false);
  const [cityInfoAutoSaved, setCityInfoAutoSaved] = useState(false);
  const saveCurrentCityInfoRef = useRef(null);
  const isCurrentCityInfoDirtyRef = useRef(null);

  const [cityInfoGenerateModalOpen, setCityInfoGenerateModalOpen] = useState(false);
  const [cityInfoGeneratePrompt, setCityInfoGeneratePrompt] = useState('');
  const [cityInfoGenerateCount, setCityInfoGenerateCount] = useState(5);
  const [cityInfoDedupeExistingItems, setCityInfoDedupeExistingItems] = useState(true);
  const [cityInfoGenerating, setCityInfoGenerating] = useState(false);
  const [cityInfoGenerationError, setCityInfoGenerationError] = useState('');
  const [cityInfoGenerationTaskId, setCityInfoGenerationTaskId] = useState(null);
  const [cityInfoGenerationLang, setCityInfoGenerationLang] = useState('ru');
  const cityInfoGenPollCancelledRef = useRef(false);
  const cityInfoGenInFlightRef = useRef(false);

  useEffect(() => {
    if (!session?.id || !Array.isArray(session.city_infos)) return;
    if (cityInfoSavingRef.current || cityInfoAutoSaving) return;
    setCityInfos(session.city_infos.map(normalizeCityInfo));
  }, [session?.id, session?.city_infos, cityInfoAutoSaving]);

  const [aiGenerationMode, setAiGenerationMode] = useState(DEFAULT_GENERATION_MODE);
  const [aiUseWebSearch, setAiUseWebSearch] = useState(false);
  const [aiAdvancedGenerationAvailable, setAiAdvancedGenerationAvailable] = useState(true);

  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  const mapReadyRef = useRef(false);
  const [mapNode, setMapNode] = useState(null);
  const setMapContainerRef = useCallback((node) => {
    mapRef.current = node;
    setMapNode(node);
  }, []);

  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [autoSaving, setAutoSaving] = useState(false);
  const autoSavingRef = useRef(false);
  const [autoSaved, setAutoSaved] = useState(false);
  const autoSaveTimerRef = useRef(null);
  // Optimistic concurrency: версия (updated_at) драфта, которую держит форма.
  // Сейв со stale-версией бэкенд отклоняет 409 — форма перезагружается свежим,
  // вместо того чтобы затирать работу генерации «город целиком».
  const cityBaseUpdatedAtRef = useRef(null);
  // Пауза автосейва после конфликта с активной генерацией (не долбим 409 каждые 2.5с).
  const autoSavePausedUntilRef = useRef(0);
  // Программная загрузка данных в форму (loadCityIntoForm) меняет тот же стейт,
  // что и пользовательский ввод — раньше это рождало «пустые» автосейвы после
  // каждого открытия формы (и именно они затирали работу генерации). Окно
  // подавления: изменения внутри него — не правки, автосейв не заводится.
  const suppressAutosaveUntilRef = useRef(0);
  // Актуальный слепок формы для немедленного flush при уходе со страницы
  // (debounce-таймер при unmount раньше просто отменялся — правки терялись).
  const autosaveSnapshotRef = useRef(null);

  const localCreatedCityDraftsRef = useRef(new Map());
  const localDeletedCityDraftIdsRef = useRef(new Set());
  const loadSessionSeqRef = useRef(0);

  const [cityFilterTree, setCityFilterTree] = useState([]);
  const [cityFilterTreeLoading, setCityFilterTreeLoading] = useState(false);
  const [cityFilterTreeError, setCityFilterTreeError] = useState('');

  const [eventFilterTree, setEventFilterTree] = useState([]);
  const [eventFilterTreeLoading, setEventFilterTreeLoading] = useState(false);
  const [eventFilterTreeError, setEventFilterTreeError] = useState('');

  const [cityTagCatalog, setCityTagCatalog] = useState([]);
  const [cityTagCatalogLoading, setCityTagCatalogLoading] = useState(false);
  const [cityTagCatalogError, setCityTagCatalogError] = useState('');

  const locallyDeletedCityFilterIdsRef = useRef(new Set());
  const locallyDeletedEventFilterIdsRef = useRef(new Set());
  const locallyCreatedCityFiltersRef = useRef(new Map());
  const locallyCreatedEventFiltersRef = useRef(new Map());
  const deletingCityFilterPendingRef = useRef(new Set());
  const deletingEventFilterPendingRef = useRef(new Set());
  const [deletingCityFilterIds, setDeletingCityFilterIds] = useState(() => new Set());
  const [deletingEventFilterIds, setDeletingEventFilterIds] = useState(() => new Set());

  const deferredLocaleData = useDeferredValue(localeData);
  const deferredLat = useDeferredValue(lat);
  const deferredLon = useDeferredValue(lon);
  const deferredCityTags = useDeferredValue(cityTags);
  const deferredImageOriginalUrl = useDeferredValue(imageOriginalUrl);
  const deferredCurrentCityInfo = useDeferredValue(currentCityInfo);

  const requestedCityDraftIdRef = useRef(null);

  useEffect(() => {
    savingRef.current = saving;
  }, [saving]);

  useEffect(() => {
    autoSavingRef.current = autoSaving;
  }, [autoSaving]);

  useEffect(() => {
    cityInfoSavingRef.current = cityInfoSaving;
  }, [cityInfoSaving]);

  useEffect(() => {
    return () => {
      clearTimeout(cityInfoAutoSaveTimerRef.current);
      clearTimeout(cityInfoAutoSavedTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const routeDraftId = new URLSearchParams(location.search).get('cityDraftId');
    requestedCityDraftIdRef.current = normalizeDraftId(routeDraftId || location.state?.cityDraftId);
  }, [location.search, location.state]);

  const cityInfoLocaleData = useMemo(() => {
    if (!currentCityInfo) return {};

    const assignedType = currentCityInfo.assigned_city_type || 'none';

    let sourceEntries = [];

    if (assignedType === 'draft') {
      const currentInfoDraftId = normalizeDraftId(
        currentCityInfo.session_city_id ?? currentCityInfo.session_city
      );

      const activeDraftId = normalizeDraftId(activeCityDraftIdRef.current);

      if (
        currentInfoDraftId &&
        activeDraftId &&
        currentInfoDraftId === activeDraftId
      ) {
        sourceEntries = sortLocaleSourceEntries(
          Object.entries(localeData || {}).filter(([, loc]) => loc?.lang)
        );
      } else if (currentInfoDraftId) {
        const draft = cityDrafts.find(
          (item) => normalizeDraftId(item.id) === currentInfoDraftId
        );

        const draftLangKeys = getMultilangKeys(
          draft?.name,
          draft?.description,
          draft?.country
        );

        sourceEntries = makeLocaleEntriesFromLangKeys(draftLangKeys);
      }
    }

    if (assignedType === 'database') {
      const cityId = normalizeId(currentCityInfo.city_id ?? currentCityInfo.city);

      const city = referenceCities.find(
        (item) => normalizeId(item.id) === cityId
      );

      const cityLangKeys = getMultilangKeys(
        city?.name,
        city?.description,
        city?.country
      );

      sourceEntries = makeLocaleEntriesFromLangKeys(cityLangKeys);
    }

    if (assignedType === 'none') {
      const ownLangKeys = getMultilangKeys(
        currentCityInfo.name,
        currentCityInfo.description
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

      acc[key] = {
        lang,
        code: locale.code || key?.split('-')?.[1] || '',
        langName: locale.langName || locale.name || lang.toUpperCase(),
        isDefault: Boolean(locale.isDefault),
        isCustom: Boolean(locale.isCustom),

        name: currentCityInfo.name?.[lang] || '',
        description: currentCityInfo.description?.[lang] || '',
      };

      return acc;
    }, {});
  }, [
    currentCityInfo,
    localeData,
    cityDrafts,
    referenceCities,
    activeCityDraftId,
  ]);

  const deferredCityInfoLocaleData = useDeferredValue(cityInfoLocaleData);

  useEffect(() => {
    if (!currentCityInfo) return;

    const availableKeys = Object.keys(cityInfoLocaleData || {});

    if (availableKeys.length === 0) return;

    if (!availableKeys.includes(cityInfoActiveLocale)) {
      setCityInfoActiveLocale(availableKeys[0]);
    }
  }, [
    currentCityInfo,
    cityInfoLocaleData,
    cityInfoActiveLocale,
  ]);

  useEffect(() => {
    const id = normalizeId(currentCityInfo?.id);

    if (!id) {
      currentCityInfoIdRef.current = null;
      cityInfoSavedSnapshotRef.current = null;
      return;
    }

    if (currentCityInfoIdRef.current !== id) {
      currentCityInfoIdRef.current = id;
      cityInfoSavedSnapshotRef.current = buildCityInfoPersistSnapshot(
        currentCityInfo,
        cityInfoLocaleData,
      );
    }
  }, [currentCityInfo, cityInfoLocaleData]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const response = await aiAPI.getSettings();
        if (cancelled) return;

        const caps = response?.data?.generation_capabilities || {};
        const advancedAvailable = caps.thinking_modes !== false && caps.web_search !== false;
        const provider = String(response?.data?.provider || '').toLowerCase();
        const isOllama = provider === 'ollama';

        setAiAdvancedGenerationAvailable(!isOllama && advancedAvailable);

        if (isOllama || !advancedAvailable) {
          setAiGenerationMode((prev) =>
            prev === DEFAULT_GENERATION_MODE ? prev : DEFAULT_GENERATION_MODE,
          );
          setAiUseWebSearch(false);
        }
      } catch {
        if (!cancelled) {
          setAiAdvancedGenerationAvailable(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const markCityDraftCreatedLocally = useCallback((draft) => {
    const draftId = normalizeDraftId(draft?.id);

    if (!draftId) return;

    localDeletedCityDraftIdsRef.current.delete(draftId);
    localCreatedCityDraftsRef.current.set(draftId, draft);
  }, []);

  const markCityDraftDeletedLocally = useCallback((draftId) => {
    const normalizedDraftId = normalizeDraftId(draftId);

    if (!normalizedDraftId) return;

    localCreatedCityDraftsRef.current.delete(normalizedDraftId);
    localDeletedCityDraftIdsRef.current.add(normalizedDraftId);
  }, []);

  const syncActiveDraftRoute = useCallback((draftId) => {
    const normalizedDraftId = normalizeDraftId(draftId);
    const params = new URLSearchParams(location.search);
    const currentDraftId = normalizeDraftId(params.get('cityDraftId') || location.state?.cityDraftId);

    if (currentDraftId === normalizedDraftId) return;

    if (normalizedDraftId) params.set('cityDraftId', normalizedDraftId);
    else params.delete('cityDraftId');

    navigate(
      {
        pathname: location.pathname,
        search: params.toString() ? `?${params.toString()}` : '',
      },
      {
        replace: true,
        state: normalizedDraftId ? { cityDraftId: normalizedDraftId } : null,
      }
    );
  }, [navigate, location.pathname, location.search, location.state]);

  const clearCityWizardForm = useCallback(() => {
    setLocaleData(makeLocaleData());
    setDefaultLocale('ru-RU');
    setActiveLocale('ru-RU');
    setLat('');
    setLon('');
    setSavedLat(null);
    setSavedLon(null);
    setCityTags([]);
    setImagePreview('');
    setImageId(null);
    setImageOriginalUrl('');
    setImageCopyright('');
  }, [setLocaleData, setDefaultLocale, setActiveLocale]);

  const loadCityIntoForm = useCallback((city, legacyTagsFallback = null) => {
    if (!city) return;

    const latVal = city.lat != null ? String(city.lat) : '';
    const lonVal = city.lon != null ? String(city.lon) : '';

    setLat(latVal);
    setLon(lonVal);

    if (city.lat != null) setSavedLat(city.lat);
    if (city.lon != null) setSavedLon(city.lon);

    const isLegacyCityRow = normalizeDraftId(city?.id) === 'legacy';
    const primaryTags = normalizeTagIds(city.tags ?? city.city_tags ?? []);
    const fallbackTags = normalizeTagIds(legacyTagsFallback ?? []);
    setCityTags(
      isLegacyCityRow && primaryTags.length === 0 ? fallbackTags : primaryTags
    );

    setImagePreview(city.image_url || '');
    setImageId(city.image_id || null);

    setImageOriginalUrl(
      city.image_original_url ||
      city.original_image_url ||
      city.source_url ||
      city.image?.original_image_url ||
      city.image?.source_url ||
      city.image?.file_page_url ||
      ''
    );

    setImageCopyright(
      city.image_copyright ||
      city.image?.copyright ||
      ''
    );

    const nameObj = city.name || {};
    const descObj = city.description || {};
    const countryRaw = city.country;
    const countryObj = countryRaw && typeof countryRaw === 'object'
      ? countryRaw
      : (typeof countryRaw === 'string' && countryRaw.trim() ? { en: countryRaw.trim() } : {});

    const langKeys = getMultilangKeys(nameObj, descObj, countryObj);
    const defaultLang = String(city.default_language || '').trim().toLowerCase();
    if (defaultLang && !langKeys.includes(defaultLang)) {
      langKeys.push(defaultLang);
    }

    const localeEntries = makeLocaleEntriesFromLangKeys(
      langKeys.length > 0 ? langKeys : DEFAULT_LOCALE_DEFS.map((locale) => locale.lang),
    );

    const newLocale = makeLocaleData();

    localeEntries.forEach(([key, meta]) => {
      const lang = meta.lang || key.split('-')[0];
      const resolve = (obj) => {
        const value = obj[key] ?? obj[lang] ?? '';
        return typeof value === 'string' ? value : (value?.text || '');
      };

      const resolvedName = resolve(nameObj);
      const resolvedDescription = resolve(descObj);
      const resolvedCountry = resolve(countryObj);

      newLocale[key] = {
        ...(newLocale[key] || {}),
        ...meta,
        lang,
        name: resolvedName,
        description: resolvedDescription == null ? '' : String(resolvedDescription),
        country: isLocaleCodeUsedAsCountry(resolvedCountry, meta.code)
          ? ''
          : String(resolvedCountry || '').trim(),
      };
    });

    setLocaleData(newLocale);

    const defaultLocaleKey =
      (defaultLang &&
        Object.keys(newLocale).find((key) => newLocale[key]?.lang === defaultLang)) ||
      (newLocale['ru-RU'] ? 'ru-RU' : Object.keys(newLocale)[0] || 'ru-RU');

    setDefaultLocale(defaultLocaleKey);
    setActiveLocale(defaultLocaleKey);

    // запоминаем версию загруженных данных для optimistic concurrency
    cityBaseUpdatedAtRef.current = city.updated_at || null;
    // это программная загрузка, не правка пользователя — автосейв не нужен
    suppressAutosaveUntilRef.current = Date.now() + 800;
  }, [setLocaleData, setDefaultLocale, setActiveLocale]);

  const mergeCitySaveResponseIntoState = useCallback((data) => {
    if (!data || typeof data !== 'object') return;

    const savedDraft = data.draft || null;
    if (savedDraft?.updated_at) {
      cityBaseUpdatedAtRef.current = savedDraft.updated_at;
    }
    const savedDraftId = normalizeDraftId(
      data.draft_id || savedDraft?.id || activeCityDraftIdRef.current,
    );
    const savedCity = data.city || null;

    if (savedDraft && savedDraftId) {
      const draftTags = normalizeTagIds(savedDraft.tags ?? savedDraft.city_tags ?? []);
      const normalizedDraft = { ...savedDraft, id: savedDraftId, tags: draftTags };

      setCityDrafts((prev) => upsertCityDraft(prev, normalizedDraft));

      requestedCityDraftIdRef.current = savedDraftId;
      activeCityDraftIdRef.current = savedDraftId;
      setActiveCityDraftId(savedDraftId);
      syncActiveDraftRoute(savedDraftId);
      setCityTags(draftTags);
    }

    if (setSession) {
      setSession((prev) => {
        if (!prev) return prev;

        let nextDrafts = prev.city_drafts || [];
        if (savedDraft && savedDraftId) {
          const draftTags = normalizeTagIds(savedDraft.tags ?? savedDraft.city_tags ?? []);
          nextDrafts = upsertCityDraft(nextDrafts, {
            ...savedDraft,
            id: savedDraftId,
            tags: draftTags,
          });
        }

        return {
          ...prev,
          ...(savedCity ? { city: { ...(prev.city || {}), ...savedCity } } : {}),
          city_drafts: nextDrafts,
        };
      });
    }
  }, [setCityDrafts, setSession, setActiveCityDraftId, syncActiveDraftRoute]);

  const saveCityForStep1 = useCallback(async () => {
    if (!defaultLocale || !localeData[defaultLocale]) {
      showNote('Необходимо установить язык по умолчанию', 'error');
      throw new Error('no-default-locale');
    }

    const payload = buildCityStepPayload({
      localeData,
      defaultLocale,
      lat,
      lon,
      cityTags,
      imageId,
      imageOriginalUrl,
      activeCityDraftId: activeCityDraftIdRef.current,
      baseUpdatedAt: cityBaseUpdatedAtRef.current,
    });

    setSaving(true);
    try {
      const res = await sessionsAPI.updateCity(sessionId, payload);
      const data = res?.data;
      const msg = data?.applied_to_published
        ? 'Корректировки сохранены и применены к объектам (City, Event, EventLocation). Сессия закрыта.'
        : 'Город сохранён в рамках сессии';
      showNote(msg, 'success');

      const savedDraft = data?.draft || null;
      const savedCity = savedDraft || data?.city || null;
      if (savedCity?.image_url) setImagePreview(savedCity.image_url);
      if (savedCity?.image_id != null) setImageId(savedCity.image_id);
      if (savedCity?.image_original_url) setImageOriginalUrl(savedCity.image_original_url);

      const savedDraftId = normalizeDraftId(data?.draft_id || activeCityDraftIdRef.current);
      if (savedDraftId) {
        requestedCityDraftIdRef.current = savedDraftId;
        activeCityDraftIdRef.current = savedDraftId;
        setActiveCityDraftId(savedDraftId);
        syncActiveDraftRoute(savedDraftId);
      }

      mergeCitySaveResponseIntoState(data);

      await loadSession(savedDraftId, { force: true });

      if (!firstCitySaveAtRef.current) {
        firstCitySaveAtRef.current = Date.now();
        trackEvent('save_city_success', { sessionId: String(sessionId), firstSave: true, msFromOpen: sessionOpenedAtRef.current ? (firstCitySaveAtRef.current - sessionOpenedAtRef.current) : null });
      } else {
        trackEvent('save_city_success', { sessionId: String(sessionId), firstSave: false });
      }

      return data;
    } catch (err) {
      const conflictData = err?.response?.status === 409 && err?.response?.data?.conflict
        ? err.response.data : null;
      if (conflictData) {
        // Данные на сервере новее формы (их писала генерация): не затираем —
        // перезагружаем форму свежим драфтом и сообщаем без «ошибки».
        if (conflictData.draft) {
          loadCityIntoForm(conflictData.draft);
          mergeCitySaveResponseIntoState(conflictData);
        }
        hasUnsavedChangesRef.current = false;
        showNote(
          conflictData.generation_active
            ? 'Идёт генерация города — форма обновлена свежими данными с сервера'
            : 'Данные города были обновлены — форма перезагружена свежими данными',
          'info',
        );
        return conflictData;
      }
      trackEvent('save_city_fail', { sessionId: String(sessionId), reason: parseApiError(err, 'Ошибка сохранения') });
      showNote('Ошибка при сохранении города: ' + parseApiError(err, 'Ошибка сохранения'), 'error');
      throw err;
    } finally {
      setSaving(false);
    }
  }, [sessionId, localeData, defaultLocale, lat, lon, cityTags, imageId, imageOriginalUrl, showNote, loadSession, syncActiveDraftRoute, mergeCitySaveResponseIntoState, loadCityIntoForm, setActiveCityDraftId, sessionOpenedAtRef, firstCitySaveAtRef]);

  const waitForCityPersistenceIdle = useCallback(async () => {
    const deadline = Date.now() + 15000;
    while ((savingRef.current || autoSavingRef.current) && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }, []);

  const saveCitySilently = useCallback(async () => {
    if (!sessionId || !session || !defaultLocale || !localeData[defaultLocale]) return;

    clearTimeout(autoSaveTimerRef.current);
    await waitForCityPersistenceIdle();

    if (savingRef.current) return;

    const payload = buildCityStepPayload({
      localeData,
      defaultLocale,
      lat,
      lon,
      cityTags,
      imageId,
      imageOriginalUrl,
      activeCityDraftId: activeCityDraftIdRef.current,
      baseUpdatedAt: cityBaseUpdatedAtRef.current,
    });

    try {
      const res = await sessionsAPI.updateCity(sessionId, payload);
      mergeCitySaveResponseIntoState(res?.data);
    } catch (e) {
      // Конфликт версий (сервер новее — писала генерация): тихий сейв просто
      // не нужен, данные уже лучше наших. Прочие ошибки — наверх, как раньше.
      if (!(e?.response?.status === 409 && e?.response?.data?.conflict)) throw e;
      mergeCitySaveResponseIntoState(e.response.data);
    }
  }, [
    sessionId,
    session,
    defaultLocale,
    localeData,
    lat,
    lon,
    cityTags,
    imageId,
    imageOriginalUrl,
    waitForCityPersistenceIdle,
    mergeCitySaveResponseIntoState,
  ]);

  useEffect(() => {
    if (currentStepRef.current !== 1 || !sessionId || !session || !defaultLocale) return;
    if (!localeData[defaultLocale]) return;

    // Программная загрузка формы (loadCityIntoForm) — не правка: без этого
    // каждое открытие формы рождало «пустой» автосейв, который и затирал
    // данные, дописанные генерацией.
    if (Date.now() < suppressAutosaveUntilRef.current) {
      hasUnsavedChangesRef.current = false;
      return;
    }

    // Свежий слепок формы — для немедленного flush при уходе со страницы.
    autosaveSnapshotRef.current = {
      localeData, defaultLocale, lat, lon, cityTags, imageId, imageOriginalUrl,
    };

    hasUnsavedChangesRef.current = true;
    clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(async () => {
      if (savingRef.current) return;
      // после конфликта с активной генерацией автосейв берёт паузу
      if (Date.now() < autoSavePausedUntilRef.current) return;

      setAutoSaving(true);
      try {
        const payload = buildCityStepPayload({
          localeData,
          defaultLocale,
          lat,
          lon,
          cityTags,
          imageId,
          imageOriginalUrl,
          activeCityDraftId: activeCityDraftIdRef.current,
          baseUpdatedAt: cityBaseUpdatedAtRef.current,
        });
        const res = await sessionsAPI.updateCity(sessionId, payload);
        mergeCitySaveResponseIntoState(res?.data);
        setAutoSaved(true);
        hasUnsavedChangesRef.current = false;
        setTimeout(() => setAutoSaved(false), 2500);
      } catch (e) {
        const conflictData = e?.response?.status === 409 && e?.response?.data?.conflict
          ? e.response.data : null;
        if (conflictData) {
          // Сервер новее (город дозаполняет генерация): перезагружаем форму
          // свежим драфтом вместо затирания; при активной генерации — пауза,
          // чтобы не конфликтить каждые 2.5 секунды.
          if (conflictData.draft) {
            loadCityIntoForm(conflictData.draft);
            mergeCitySaveResponseIntoState(conflictData);
          }
          hasUnsavedChangesRef.current = false;
          if (conflictData.generation_active) {
            autoSavePausedUntilRef.current = Date.now() + 60_000;
            showNote('Идёт генерация города — форма обновлена, автосохранение приостановлено на минуту', 'info');
          } else {
            showNote('Данные города были обновлены — форма перезагружена свежими данными', 'info');
          }
        } else {
          showNote('Ошибка автосохранения города: ' + parseApiError(e, 'Неизвестная ошибка'), 'error');
        }
      } finally {
        setAutoSaving(false);
      }
    }, 2500);

    return () => clearTimeout(autoSaveTimerRef.current);
  }, [
    deferredLocaleData,
    deferredLat,
    deferredLon,
    deferredCityTags,
    imageId,
    deferredImageOriginalUrl,
    imageCopyright,
    defaultLocale,
    sessionId,
    session,
    mergeCitySaveResponseIntoState,
    loadCityIntoForm,
  ]);

  // Немедленный сейв несохранённых правок при уходе: debounce-таймер при
  // unmount раньше просто отменялся («вставил → переключился → пропало»).
  // useKeepalive=true — страница скрывается/закрывается: обычный XHR может
  // не дожить, keepalive-fetch браузер дошлёт сам.
  const flushPendingCityAutosave = useCallback((useKeepalive = false) => {
    if (!hasUnsavedChangesRef.current || savingRef.current) return;
    if (Date.now() < autoSavePausedUntilRef.current) return;
    const snap = autosaveSnapshotRef.current;
    if (!sessionId || !snap?.defaultLocale || !snap.localeData?.[snap.defaultLocale]) return;

    const payload = buildCityStepPayload({
      ...snap,
      activeCityDraftId: activeCityDraftIdRef.current,
      baseUpdatedAt: cityBaseUpdatedAtRef.current,
    });
    hasUnsavedChangesRef.current = false;
    clearTimeout(autoSaveTimerRef.current);

    if (useKeepalive) {
      try {
        const tokens = TokenManager.getTokens?.();
        fetch(`${apiClient.defaults.baseURL}/generation/sessions/${sessionId}/city/`, {
          method: 'PATCH',
          keepalive: true,
          headers: {
            'Content-Type': 'application/json',
            ...(tokens?.access ? { Authorization: `Bearer ${tokens.access}` } : {}),
          },
          body: JSON.stringify(payload),
        }).catch(() => {});
      } catch { /* уход со страницы — best effort */ }
    } else {
      sessionsAPI.updateCity(sessionId, payload)
        .then((res) => mergeCitySaveResponseIntoState(res?.data))
        .catch(() => { /* 409 = на сервере новее; сеть — правка уже в форме при возврате */ });
    }
  }, [sessionId, mergeCitySaveResponseIntoState]);

  useEffect(() => {
    if (!sessionId) return undefined;
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flushPendingCityAutosave(true);
    };
    const onPageHide = () => flushPendingCityAutosave(true);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onPageHide);
      flushPendingCityAutosave(false);   // SPA-переход на другую страницу админки
    };
  }, [sessionId, flushPendingCityAutosave]);

  useEffect(() => {
    if (!mapNode) return;
    if (mapInstanceRef.current?.map) {
      requestAnimationFrame(() => {
        mapInstanceRef.current?.map?.invalidateSize();
      });
      return;
    }

    let cancelled = false;
    import('leaflet').then(({ default: L }) => {
      if (cancelled || !mapNode || mapInstanceRef.current?.map) return;

      delete L.Icon.Default.prototype._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      const map = L.map(mapNode, { zoomControl: true, attributionControl: true }).setView([55.75, 37.62], 3);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
        minZoom: 2,
      }).addTo(map);

      const updateMarker = (latValue, lonValue) => {
        const parsedLat = parseMapCoord(latValue);
        const parsedLon = parseMapCoord(lonValue);

        if (!Number.isFinite(parsedLat) || !Number.isFinite(parsedLon) || parsedLat < -90 || parsedLat > 90 || parsedLon < -180 || parsedLon > 180) {
          if (markerRef.current) {
            map.removeLayer(markerRef.current);
            markerRef.current = null;
          }
          return;
        }

        const nextLatLng = [parsedLat, parsedLon];
        if (markerRef.current) markerRef.current.setLatLng(nextLatLng);
        else markerRef.current = L.marker(nextLatLng).addTo(map);
        map.setView(nextLatLng, 12);
        requestAnimationFrame(() => map.invalidateSize());
      };

      map.on('click', (event) => {
        setLat(event.latlng.lat.toFixed(6));
        setLon(event.latlng.lng.toFixed(6));
      });

      mapInstanceRef.current = { map, updateMarker };
      mapReadyRef.current = true;

      setTimeout(() => { map.invalidateSize(); }, 0);
      setTimeout(() => { map.invalidateSize(); }, 250);

      if (hasValidMapCoords(lat, lon)) updateMarker(lat, lon);
    });

    return () => {
      cancelled = true;
      if (mapInstanceRef.current?.map) {
        mapInstanceRef.current.map.remove();
        mapInstanceRef.current = null;
        markerRef.current = null;
        mapReadyRef.current = false;
      }
    };
  }, [mapNode, lat, lon]);

  useEffect(() => {
    if (!mapReadyRef.current || !mapInstanceRef.current?.updateMarker) return;
    mapInstanceRef.current.updateMarker(lat, lon);
  }, [lat, lon]);

  const loadCityFilterTree = useCallback(async () => {
    setCityFilterTreeLoading(true);
    setCityFilterTreeError('');

    try {
      const res = await cityFiltersAPI.getTree();
      const raw = res?.data?.data ?? res?.data?.results ?? res?.data;
      const data = Array.isArray(raw)
        ? raw
        : Array.isArray(raw?.tree)
          ? raw.tree
          : [];

      const tree = Array.isArray(data) ? data : [];
      setCityFilterTree(
        mergeCityFilterTreeWithLocalOverlays(
          tree,
          locallyCreatedCityFiltersRef.current,
          locallyDeletedCityFilterIdsRef.current,
        ),
      );
    } catch (error) {
      setCityFilterTreeError(
        parseApiError(error, 'Ошибка загрузки тегов города')
      );
    } finally {
      setCityFilterTreeLoading(false);
    }
  }, []);

  const loadEventFilterTree = useCallback(async () => {
    setEventFilterTreeLoading(true);
    setEventFilterTreeError('');

    try {
      const res = await eventFiltersAPI.getTree();
      const data = res?.data?.data || res?.data?.results || res?.data || [];
      const tree = Array.isArray(data) ? data : [];
      setEventFilterTree(
        mergeEventFilterTreeWithLocalOverlays(
          tree,
          locallyCreatedEventFiltersRef.current,
          locallyDeletedEventFilterIdsRef.current,
        ),
      );
    } catch (error) {
      setEventFilterTreeError(
        parseApiError(error, 'Ошибка загрузки тегов достопримечательностей')
      );
    } finally {
      setEventFilterTreeLoading(false);
    }
  }, []);

  const loadCityTagCatalog = useCallback(async () => {
    setCityTagCatalogLoading(true);
    setCityTagCatalogError('');

    try {
      const res = await cityFiltersAPI.getTags();
      const raw = res?.data?.data ?? res?.data?.results ?? res?.data ?? [];
      const rows = Array.isArray(raw) ? raw : [];
      setCityTagCatalog(
        mergeCityTagCatalogWithLocalOverlays(
          rows,
          locallyCreatedCityFiltersRef.current,
          locallyDeletedCityFilterIdsRef.current,
        ),
      );
    } catch (error) {
      setCityTagCatalogError(
        parseApiError(error, 'Ошибка загрузки тегов города')
      );
    } finally {
      setCityTagCatalogLoading(false);
    }
  }, []);

  useEffect(() => { loadCityFilterTree(); }, [loadCityFilterTree]);
  useEffect(() => { loadEventFilterTree(); }, [loadEventFilterTree]);
  useEffect(() => { loadCityTagCatalog(); }, [loadCityTagCatalog]);

  const switchLocale = useCallback((key) => { setActiveLocale(key); }, [setActiveLocale]);

  const addLocale = useCallback(() => {
    const code = newLocaleCode.trim().toUpperCase();
    const langName = newLocaleLang.trim();

    if (!/^[A-Z]{2}$/.test(code)) { showNote('Введите корректный двухбуквенный код страны', 'error'); return; }
    if (!langName) { showNote('Введите название языка', 'error'); return; }

    const lang = resolveBackendLanguageCode(langName);
    if (!lang) { showNote('Этот язык пока не поддерживается. Доступны: Italian, English, Russian, French, German, Spanish.', 'error'); return; }

    const existingKey = Object.keys(localeData).find(key => localeData[key]?.lang === lang);
    if (existingKey) {
      showNote('Адаптация для этого языка уже добавлена', 'error');
      setActiveLocale(existingKey);
      setAddLocaleOpen(false);
      return;
    }

    const key = `${lang}-${code}`;
    setLocaleData(prev => ({
      ...prev,
      [key]: {
        code,
        lang,
        langName,
        isDefault: false,
        isCustom: true,
        name: '',
        description: '',
        country: '',
      },
    }));
    setActiveLocale(key);
    setAddLocaleOpen(false);
    setNewLocaleCode('');
    setNewLocaleLang('');
    showNote(`Адаптация "${langName} (${code})" добавлена`, 'success');
  }, [newLocaleCode, newLocaleLang, localeData, showNote, setLocaleData, setActiveLocale, setAddLocaleOpen, setNewLocaleCode, setNewLocaleLang]);

  const removeLocale = useCallback((key) => {
    if (localeData[key]?.isDefault) { showNote('Предустановленные языки нельзя удалять', 'error'); return; }
    setLocaleData(prev => { const next = { ...prev }; delete next[key]; return next; });
    if (activeLocale === key) {
      const remaining = Object.keys(localeData).filter(k => k !== key);
      if (remaining.length) setActiveLocale(remaining[0]);
    }
    if (defaultLocale === key) {
      const remaining = Object.keys(localeData).filter(k => k !== key);
      if (remaining.length) setDefaultLocale(remaining[0]);
    }
  }, [localeData, activeLocale, defaultLocale, showNote, setLocaleData, setActiveLocale, setDefaultLocale]);

  const updateLocaleField = useCallback((field, value) => {
    setLocaleData(prev => ({ ...prev, [activeLocale]: { ...prev[activeLocale], [field]: value } }));
  }, [activeLocale, setLocaleData]);

  const handleSelectDraft = useCallback(async (draftId) => {
    const normalizedDraftId = normalizeDraftId(draftId);
    const draft = cityDrafts.find((item) => normalizeDraftId(item.id) === normalizedDraftId);
    if (!draft) return;

    if (hasUnsavedChangesRef.current) {
      try {
        await saveCitySilently();
      } catch {
        // not blocking switch on save error
      }
    }

    requestedCityDraftIdRef.current = normalizedDraftId;
    activeCityDraftIdRef.current = normalizedDraftId;
    setActiveCityDraftId(normalizedDraftId);
    syncActiveDraftRoute(normalizedDraftId);
    loadCityIntoForm(draft);
  }, [cityDrafts, loadCityIntoForm, syncActiveDraftRoute, saveCitySilently, setActiveCityDraftId, hasUnsavedChangesRef]);

  const handleCreateDraft = useCallback(async () => {
    let newDraftId = null;
    const sessionLegacyTags = session?.city?.tags ?? session?.city?.city_tags;

    try {
      const res = await sessionsAPI.createCityDraft(sessionId, {});

      const rawDraft =
        res?.data?.draft ||
        res?.data?.city_draft ||
        res?.data?.data ||
        res?.data;

      const parsed =
        rawDraft && typeof rawDraft === 'object' && !Array.isArray(rawDraft)
          ? rawDraft
          : parseCreatedCityDraftResponse(res);

      const normalizedDraft = normalizeCityDraft(parsed);
      newDraftId = normalizeDraftId(normalizedDraft?.id);

      if (!normalizedDraft || !newDraftId) {
        throw new Error('no_draft_in_response');
      }

      markCityDraftCreatedLocally(normalizedDraft);

      setCityDrafts((prev) => upsertCityDraft(prev, normalizedDraft));

      requestedCityDraftIdRef.current = newDraftId;
      activeCityDraftIdRef.current = newDraftId;

      setActiveCityDraftId(newDraftId);
      syncActiveDraftRoute(newDraftId);
      loadCityIntoForm(normalizedDraft, sessionLegacyTags);

      showNote('Черновик города добавлен', 'success');
    } catch (error) {
      const msg =
        error?.message === 'no_draft_in_response'
          ? 'Сервер не вернул черновик'
          : parseApiError(error, 'Ошибка создания черновика города');
      showNote(msg, 'error');
    }

    if (newDraftId) {
      void loadSession(newDraftId, { silent: true, force: true }).catch((error) => {
        console.error('Silent loadSession after create draft failed', error);
      });
    }
  }, [
    sessionId,
    session,
    markCityDraftCreatedLocally,
    loadSession,
    syncActiveDraftRoute,
    showNote,
    loadCityIntoForm,
    setCityDrafts,
    setActiveCityDraftId,
  ]);

  const handleDeleteDraft = useCallback(async (draftId) => {
    const normalizedDraftId = normalizeDraftId(draftId);

    if (!normalizedDraftId || normalizedDraftId === 'legacy') {
      return;
    }

    if (!(await confirm({ message: 'Удалить этот черновик города?', danger: true }))) {
      return;
    }

    let nextDraftIdForReload = normalizeDraftId(activeCityDraftIdRef.current);
    let nextActiveDraft = null;

    try {
      await sessionsAPI.deleteCityDraft(sessionId, normalizedDraftId);

      markCityDraftDeletedLocally(normalizedDraftId);

      setCityDrafts((prev) => {
        const activeId = normalizeDraftId(activeCityDraftIdRef.current);

        const oldIndex = prev.findIndex(
          (d) => normalizeDraftId(d.id) === normalizedDraftId
        );

        const nextDrafts = prev.filter(
          (d) => normalizeDraftId(d.id) !== normalizedDraftId
        );

        if (activeId === normalizedDraftId) {
          if (nextDrafts.length === 0) {
            nextActiveDraft = null;
          } else {
            const nextIndex = Math.min(
              Math.max(oldIndex, 0),
              nextDrafts.length - 1
            );
            nextActiveDraft = nextDrafts[nextIndex] || null;
          }
        }

        return nextDrafts;
      });

      const activeId = normalizeDraftId(activeCityDraftIdRef.current);

      if (activeId === normalizedDraftId) {
        if (nextActiveDraft) {
          const nextId = normalizeDraftId(nextActiveDraft.id);

          nextDraftIdForReload = nextId;

          requestedCityDraftIdRef.current = nextId;
          activeCityDraftIdRef.current = nextId;

          setActiveCityDraftId(nextId);
          syncActiveDraftRoute(nextId);
          const sessionLegacyTags = session?.city?.tags ?? session?.city?.city_tags;
          loadCityIntoForm(nextActiveDraft, sessionLegacyTags);
        } else {
          nextDraftIdForReload = null;

          requestedCityDraftIdRef.current = null;
          activeCityDraftIdRef.current = null;

          setActiveCityDraftId(null);
          syncActiveDraftRoute(null);
          clearCityWizardForm();
        }
      }

      showNote('Черновик города удален', 'success');
    } catch (error) {
      showNote(
        parseApiError(error, 'Ошибка удаления черновика города'),
        'error'
      );
    }

    void loadSession(nextDraftIdForReload, { silent: true, force: true }).catch((error) => {
      console.error('Silent loadSession after delete draft failed', error);
    });
  }, [
    sessionId,
    session,
    markCityDraftDeletedLocally,
    syncActiveDraftRoute,
    loadCityIntoForm,
    clearCityWizardForm,
    loadSession,
    showNote,
    confirm,
    setCityDrafts,
    setActiveCityDraftId,
  ]);

  const handlePhotoFile = useCallback(async (e) => {
    const f = e.target.files?.[0];
    if (!f || !f.type.startsWith('image/')) return;
    e.target.value = '';
    setPhotoUploading(true);

    try {
      const fd = new FormData();
      fd.append('file', f);
      if (imageCopyright) fd.append('copyright', imageCopyright);
      fd.append('session_uuid', session?.uuid || session?.session_uuid || '');
      fd.append('city_name', localeData[activeLocale]?.name || '');
      fd.append('temp', '1');

      const res = await imagesAPI.upload(fd);
      const { id, url, copyright } = res?.data || {};
      if (id && url) {
        setImageId(id);
        setImagePreview(url);
        setImageOriginalUrl('');
        if (copyright != null) setImageCopyright(copyright || '');
        showNote('Изображение загружено', 'success');
      }
    } catch (err) {
      showNote('Ошибка загрузки: ' + parseApiError(err, 'Ошибка загрузки'), 'error');
    } finally {
      setPhotoUploading(false);
    }
  }, [session, localeData, activeLocale, imageCopyright, showNote]);

  const handlePhotoDelete = useCallback(() => {
    setImageId(null);
    setImagePreview(null);
    setImageOriginalUrl('');
    setImageCopyright('');
    hasUnsavedChangesRef.current = true;
    showNote('Изображение удалено', 'info');
  }, [showNote, hasUnsavedChangesRef]);

  const handleCommonsImageSelect = useCallback((payload = {}) => {
    const selectedImageId =
      payload.imageId ??
      payload.image_id ??
      payload.image?.id ??
      null;

    const localUrl =
      payload.localUrl ??
      payload.local_url ??
      payload.url ??
      payload.image_url ??
      payload.image?.url ??
      '';

    const originalUrl =
      payload.originalUrl ??
      payload.original_url ??
      payload.originalImageUrl ??
      payload.original_image_url ??
      payload.sourceUrl ??
      payload.source_url ??
      payload.image?.original_image_url ??
      payload.image?.source_url ??
      '';

    const copyright =
      payload.copyright ??
      payload.image_copyright ??
      payload.imageCopyright ??
      payload.image?.copyright ??
      '';

    if (commonsTarget.type === 'city') {
      setImageId(selectedImageId);
      setImagePreview(localUrl);
      setImageOriginalUrl(originalUrl);
      setImageCopyright(copyright);

      showNote('Изображение города загружено из Wikimedia Commons', 'success');
      return;
    }
  }, [commonsTarget, showNote]);

  const openCityCommonsModal = useCallback(() => {
    setCommonsTarget({
      type: 'city',
      id: null,
    });

    setCommonsModalOpen(true);
  }, []);

  const patchActiveDraftTags = useCallback((nextTags) => {
    const activeDraftId = normalizeDraftId(activeCityDraftIdRef.current);
    if (!activeDraftId || activeDraftId === 'legacy') return;
    setCityDrafts((drafts) =>
      drafts.map((draft) =>
        normalizeDraftId(draft.id) === activeDraftId
          ? { ...draft, tags: [...nextTags] }
          : draft
      )
    );
  }, [setCityDrafts]);

  const toggleCityTag = useCallback((tagId) => {
    const normalizedTagId = String(tagId || '');

    if (!normalizedTagId) return;

    setCityTags((prev) => {
      const normalizedPrev = normalizeTagIds(prev);
      const nextTags = normalizedPrev.includes(normalizedTagId)
        ? normalizedPrev.filter((item) => item !== normalizedTagId)
        : [...normalizedPrev, normalizedTagId];
      patchActiveDraftTags(nextTags);
      return nextTags;
    });
  }, [patchActiveDraftTags]);

  const addTag = useCallback((text) => {
    const t = text.trim();
    if (!t) return;
    setCityTags((prev) => {
      const next = normalizeTagIds(prev);
      if (next.includes(t)) return next;
      const merged = [...next, t];
      patchActiveDraftTags(merged);
      return merged;
    });
  }, [patchActiveDraftTags]);

  const removeTag = useCallback((tag) => {
    setCityTags((prev) => {
      const next = normalizeTagIds(prev).filter((item) => item !== tag);
      patchActiveDraftTags(next);
      return next;
    });
  }, [patchActiveDraftTags]);

  const handleTagKeyDown = useCallback((event) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      const value = tagInput.trim().replace(/,$/, '');
      if (value) { addTag(value); setTagInput(''); }
    }
  }, [tagInput, addTag]);

  const handleTagBlur = useCallback(() => {
    if (tagInput.trim()) { addTag(tagInput.trim()); setTagInput(''); }
  }, [tagInput, addTag]);

  const uploadCityFilterImage = useCallback(async (file) => {
    if (!file || !file.type?.startsWith('image/')) {
      showNote('Выберите файл изображения', 'error');
      return null;
    }
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('session_uuid', session?.uuid || session?.session_uuid || '');
      fd.append('city_name', localeData[activeLocale]?.name || '');
      fd.append('temp', '1');
      const res = await imagesAPI.upload(fd);
      const { id, url } = res?.data || {};
      if (id && url) {
        showNote('Изображение загружено', 'success');
        return { id, url };
      }
      showNote('Сервер не вернул данные изображения', 'error');
      return null;
    } catch (err) {
      showNote(
        'Ошибка загрузки изображения: ' + parseApiError(err, 'Ошибка загрузки'),
        'error'
      );
      return null;
    }
  }, [session, localeData, activeLocale, showNote]);

  const getCityInfoName = useCallback((info) => {
    const name = info?.name || {};

    if (typeof name === 'string') {
      return name || '(без названия)';
    }

    return (
      name.ru ||
      name.en ||
      name.it ||
      Object.values(name).find(Boolean) ||
      '(без названия)'
    );
  }, []);

  const addCityInfo = useCallback(async () => {
    try {
      const activeDraftId = normalizeDraftId(activeCityDraftIdRef.current);

      const emptyInfo = createEmptyCityInfo({
        activeDraftId,
        sourceLocaleData: localeData,
      });

      const res = await cityInfosAPI.create(
        sessionId,
        buildCityInfoPayload(emptyInfo)
      );

      const rawInfo = res?.data?.city_info || res?.data;
      const info = rawInfo?.id != null ? normalizeCityInfo(rawInfo) : null;

      if (info?.id) {
        const localeKeys = Object.keys(localeData || {});
        const nextActiveLocale =
          localeKeys.includes(defaultLocale)
            ? defaultLocale
            : localeKeys[0] || 'ru-RU';

        setCityInfos((prev) => [...prev, info]);
        setCurrentCityInfo(info);
        setCityInfoActiveLocale(nextActiveLocale);

        showNote(
          activeDraftId && activeDraftId !== 'legacy'
            ? 'Блок полезной информации добавлен и привязан к текущему городу'
            : 'Блок полезной информации добавлен',
          'success'
        );
      }
    } catch (e) {
      showNote(
        'Ошибка при добавлении полезной информации: ' + parseApiError(e),
        'error'
      );
    }
  }, [sessionId, showNote, localeData, defaultLocale, setCityInfos, setCurrentCityInfo, setCityInfoActiveLocale]);

  const importCityInfoFromText = useCallback(async (langRaw = 'ru', rawText = '') => {
    const lang = String(langRaw || 'ru').split('-')[0].trim().toLowerCase() || 'ru';
    const parsed = parseUsefulInfoTextImport(rawText);

    if (parsed.length === 0) {
      showNote('Не удалось распознать блоки. Заголовки должны начинаться с «#».', 'error');
      return 0;
    }

    const activeDraftId = normalizeDraftId(activeCityDraftIdRef.current);
    const created = [];

    try {
      for (const item of parsed) {
        const emptyInfo = createEmptyCityInfo({
          activeDraftId,
          sourceLocaleData: localeData,
        });

        const name = {
          ...(emptyInfo.name || {}),
          [lang]: item.title,
        };
        const description = {
          ...(emptyInfo.description || {}),
          [lang]: item.text,
        };

        const res = await cityInfosAPI.create(
          sessionId,
          buildCityInfoPayload(
            {
              ...emptyInfo,
              name,
              description,
            },
            name,
            description,
          ),
        );

        const rawInfo = res?.data?.city_info || res?.data;
        const info = rawInfo?.id != null ? normalizeCityInfo(rawInfo) : null;
        if (info?.id) {
          created.push(info);
        }
      }

      if (created.length > 0) {
        setCityInfos((prev) => {
          const existingIds = new Set(prev.map((item) => String(item.id)));
          const toAdd = created.filter((item) => item.id && !existingIds.has(String(item.id)));
          return [...prev, ...toAdd];
        });

        if (setSession) {
          setSession((prev) => {
            if (!prev) return prev;
            const existing = Array.isArray(prev.city_infos) ? prev.city_infos : [];
            const existingIds = new Set(existing.map((item) => String(item.id)));
            const toAdd = created.filter((item) => item.id && !existingIds.has(String(item.id)));
            return { ...prev, city_infos: [...existing, ...toAdd] };
          });
        }
      }

      showNote(`Создано блоков полезной информации: ${created.length}`, 'success');
      return created.length;
    } catch (e) {
      showNote(
        'Ошибка при создании полезной информации: ' + parseApiError(e, 'Ошибка создания'),
        'error',
      );
      throw e;
    }
  }, [sessionId, showNote, localeData, setSession]);

  const updateCurrentCityInfoPatch = useCallback((patch) => {
    setCurrentCityInfo((prev) => {
      if (!prev) return prev;

      const updated = {
        ...prev,
        ...patch,
      };

      setCityInfos((items) =>
        items.map((item) =>
          normalizeId(item.id) === normalizeId(updated.id) ? updated : item
        )
      );

      return updated;
    });
  }, [setCityInfos, setCurrentCityInfo]);

  const updateCityInfoLocaleField = useCallback((field, value) => {
    const lang =
      cityInfoLocaleData?.[cityInfoActiveLocale]?.lang ||
      getLocaleLang(cityInfoActiveLocale);

    setCurrentCityInfo((prev) => {
      if (!prev) return prev;

      const updated = {
        ...prev,
        [field]: {
          ...(prev[field] || {}),
          [lang]: value,
        },
      };

      setCityInfos((items) =>
        items.map((item) =>
          normalizeId(item.id) === normalizeId(updated.id) ? updated : item
        )
      );

      return updated;
    });
  }, [cityInfoActiveLocale, cityInfoLocaleData, setCurrentCityInfo, setCityInfos]);

  const saveCurrentCityInfo = useCallback(
    async ({ silent = false } = {}) => {
      if (!currentCityInfo?.id) return null;

      setCityInfoSaving(true);

      try {
        const { name, description } = collectCityInfoLocaleTexts(cityInfoLocaleData);

        const res = await cityInfosAPI.update(
          sessionId,
          currentCityInfo.id,
          buildCityInfoPayload(currentCityInfo, name, description),
        );

        const responseInfo = res?.data?.city_info || res?.data || {};

        const updatedInfo = normalizeCityInfo({
          ...currentCityInfo,
          ...responseInfo,
          name: responseInfo.name ?? name,
          description: responseInfo.description ?? description,
        });

        setCityInfos((prev) =>
          prev.map((item) =>
            normalizeId(item.id) === normalizeId(currentCityInfo.id)
              ? updatedInfo
              : item,
          ),
        );

        setCurrentCityInfo(updatedInfo);

        cityInfoSavedSnapshotRef.current = buildCityInfoPersistSnapshot(
          updatedInfo,
          cityInfoLocaleData,
        );

        if (!silent) {
          showNote('Полезная информация сохранена', 'success');
        }

        return updatedInfo;
      } catch (e) {
        if (!silent) {
          showNote(
            'Ошибка при сохранении полезной информации: ' + parseApiError(e),
            'error',
          );
        }
        throw e;
      } finally {
        setCityInfoSaving(false);
      }
    },
    [sessionId, currentCityInfo, cityInfoLocaleData, showNote, setCityInfos, setCurrentCityInfo],
  );

  const isCurrentCityInfoDirty = useCallback(() => {
    if (!currentCityInfo?.id) return false;

    const snap = buildCityInfoPersistSnapshot(
      currentCityInfo,
      cityInfoLocaleData,
    );

    return snap !== cityInfoSavedSnapshotRef.current;
  }, [currentCityInfo, cityInfoLocaleData]);

  saveCurrentCityInfoRef.current = saveCurrentCityInfo;
  isCurrentCityInfoDirtyRef.current = isCurrentCityInfoDirty;

  const saveCurrentCityInfoIfDirty = useCallback(
    async (options = {}) => {
      clearTimeout(cityInfoAutoSaveTimerRef.current);
      const deadline = Date.now() + 15000;
      while (
        (cityInfoSavingRef.current || cityInfoAutoSaving) &&
        Date.now() < deadline
      ) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      if (!currentCityInfo?.id || !isCurrentCityInfoDirty()) {
        return true;
      }

      await saveCurrentCityInfo(options);
      return true;
    },
    [currentCityInfo, isCurrentCityInfoDirty, saveCurrentCityInfo, cityInfoAutoSaving],
  );

  useEffect(() => {
    clearTimeout(cityInfoAutoSaveTimerRef.current);

    if (!sessionId || !deferredCurrentCityInfo?.id) return;

    if (!isCurrentCityInfoDirtyRef.current?.()) return;

    cityInfoAutoSaveTimerRef.current = setTimeout(async () => {
      if (cityInfoSavingRef.current) return;

      setCityInfoAutoSaving(true);
      setCityInfoAutoSaved(false);

      try {
        await saveCurrentCityInfoRef.current?.({ silent: true });

        setCityInfoAutoSaved(true);

        clearTimeout(cityInfoAutoSavedTimerRef.current);
        cityInfoAutoSavedTimerRef.current = setTimeout(() => {
          setCityInfoAutoSaved(false);
        }, 2500);
      } catch (e) {
        showNote('Ошибка автосохранения информации: ' + parseApiError(e, 'Неизвестная ошибка'), 'error');
      } finally {
        setCityInfoAutoSaving(false);
      }
    }, 2500);

    return () => {
      clearTimeout(cityInfoAutoSaveTimerRef.current);
    };
  }, [
    sessionId,
    deferredCurrentCityInfo,
    deferredCityInfoLocaleData,
  ]);

  const openCityInfoDetail = useCallback(
    async (infoId) => {
      try {
        await saveCurrentCityInfoIfDirty({ silent: true });
      } catch {
        return;
      }

      const target = cityInfos.find(
        (info) => normalizeId(info.id) === normalizeId(infoId),
      );

      if (!target) return;

      setCurrentCityInfo(target);
      setCityInfoActiveLocale('ru-RU');
    },
    [cityInfos, saveCurrentCityInfoIfDirty, setCurrentCityInfo, setCityInfoActiveLocale],
  );

  const deleteCurrentCityInfo = useCallback(async () => {
    if (!currentCityInfo) return;

    const name = getCityInfoName(currentCityInfo);

    if (!(await confirm({ message: `Удалить «${name}»?`, danger: true }))) {
      return;
    }

    try {
      await cityInfosAPI.delete(sessionId, currentCityInfo.id);

      setCityInfos((items) =>
        items.filter(
          (item) => normalizeId(item.id) !== normalizeId(currentCityInfo.id)
        )
      );

      setCurrentCityInfo(null);

      showNote('Полезная информация удалена', 'success');
    } catch (e) {
      showNote(
        'Ошибка при удалении полезной информации: ' + parseApiError(e),
        'error'
      );
    }
  }, [sessionId, currentCityInfo, getCityInfoName, confirm, showNote, setCityInfos, setCurrentCityInfo]);

  const resolveDefaultCityInfoAiLang = useCallback(() => {
    const loc = localeData[activeLocale];
    const locLang = (loc?.lang || '').trim().toLowerCase();
    if (locLang) {
      const base = locLang.split('-')[0];
      return base || 'ru';
    }

    const draftId = normalizeDraftId(activeCityDraftIdRef.current);
    const draft = cityDrafts.find((d) => normalizeDraftId(d.id) === draftId);

    const collect = (obj) => {
      if (!obj || typeof obj !== 'object') return null;
      const keys = Object.keys(obj);
      for (let i = 0; i < keys.length; i += 1) {
        const k = keys[i];
        if (k && /^[a-z]{2}/i.test(k)) return k.split('-')[0].toLowerCase();
      }
      return null;
    };

    return (
      collect(draft?.name) ||
      collect(draft?.description) ||
      collect(draft?.country) ||
      'ru'
    );
  }, [localeData, activeLocale, cityDrafts]);

  const openCityInfoGenerateModal = useCallback(() => {
    cityInfoGenPollCancelledRef.current = false;
    setCityInfoGenerationError('');
    setCityInfoGeneratePrompt('');
    setCityInfoGenerateCount(5);
    setCityInfoGenerationTaskId(null);
    setCityInfoGenerationLang(resolveDefaultCityInfoAiLang());
    setCityInfoGenerateModalOpen(true);
  }, [resolveDefaultCityInfoAiLang, setCityInfoGenerationError, setCityInfoGeneratePrompt, setCityInfoGenerateCount, setCityInfoGenerationTaskId, setCityInfoGenerationLang, setCityInfoGenerateModalOpen]);

  const closeCityInfoGenerateModal = useCallback(() => {
    cityInfoGenPollCancelledRef.current = true;
    cityInfoGenInFlightRef.current = false;
    setCityInfoGenerateModalOpen(false);
    setCityInfoGenerating(false);
    setCityInfoGenerationTaskId(null);
    setCityInfoGenerationError('');
  }, [setCityInfoGenerateModalOpen, setCityInfoGenerating, setCityInfoGenerationTaskId, setCityInfoGenerationError]);

  const generateCityInfoFromPrompt = useCallback(async () => {
    if (cityInfoGenerating || cityInfoGenInFlightRef.current) return;

    const prompt = cityInfoGeneratePrompt.trim();
    const userPrompt = prompt || 'Сгенерируй полезную информацию для туристов';

    const draftId = normalizeDraftId(activeCityDraftIdRef.current);
    let assigned_city_type = 'none';
    let session_city_id = null;

    if (draftId && draftId !== 'legacy') {
      assigned_city_type = 'draft';
      session_city_id = draftId;
    }

    const langRaw = (cityInfoGenerationLang || 'ru').trim().toLowerCase();
    const lang = (langRaw.split('-')[0] || 'ru').slice(0, 8) || 'ru';

    let requested_count = clampGenerationCount(cityInfoGenerateCount, 'city_info');

    cityInfoGenPollCancelledRef.current = false;
    cityInfoGenInFlightRef.current = true;
    setCityInfoGenerating(true);
    setCityInfoGenerationError('');
    setCityInfoGenerationTaskId(null);

    try {
      const startRes = await aiAPI.cityInfoJsonStart({
        session_id: sessionId,
        prompt: userPrompt,
        lang,
        requested_count,
        dedupe_existing_items: cityInfoDedupeExistingItems,
        assigned_city_type,
        session_city_id: assigned_city_type === 'draft' ? session_city_id : null,
        city_id: null,
        ...buildGenerationPayloadFields(aiGenerationMode, aiUseWebSearch),
      });
      const taskId = startRes?.data?.task_id;
      if (!taskId) {
        throw new Error('Сервер не вернул task_id');
      }
      setCityInfoGenerationTaskId(taskId);

      await pollGenerationTask(taskId, {
        tasksAPI,
        maxWaitMs: 20 * 60 * 1000,
        isCancelled: () => cityInfoGenPollCancelledRef.current,
      });

      if (cityInfoGenPollCancelledRef.current) {
        return;
      }

      const createRes = await aiAPI.cityInfoCreateFromTask(taskId, {
        session_id: sessionId,
        dedupe_existing_items: cityInfoDedupeExistingItems,
      });
      const createData = createRes?.data || {};
      const createdRaw = createData.city_infos || [];
      const created = (Array.isArray(createdRaw) ? createdRaw : []).map(normalizeCityInfo);
      const n = typeof createData.created_count === 'number'
        ? createData.created_count
        : created.length;

      if (created.length > 0) {
        setCityInfos((prev) => {
          const existingIds = new Set(prev.map((item) => String(item.id)));
          const toAdd = created.filter((item) => item.id && !existingIds.has(String(item.id)));
          return [...prev, ...toAdd];
        });
      }

      if (!cityInfoGenPollCancelledRef.current) {
        if (createData.partial && createData.warning) {
          showNote(createData.warning, 'warning');
        }
        showNote(
          formatGenerationDedupeResultMessage(createData, { dedupeField: 'dedupe_existing_items' })
            || `Сгенерировано блоков полезной информации: ${n}`,
          createData.partial ? 'warning' : 'success',
        );
        setCityInfoGenerateModalOpen(false);
        setCityInfoGeneratePrompt('');
        setCityInfoGenerationTaskId(null);
      }
    } catch (e) {
      if (!cityInfoGenPollCancelledRef.current && !isPollCancelledError(e)) {
        const msg = e?.message || parseApiError(e, TASK_NOT_FOUND_MESSAGE);
        setCityInfoGenerationError(msg);
        showNote(msg, 'error');
      }
      setCityInfoGenerationTaskId(null);
    } finally {
      cityInfoGenInFlightRef.current = false;
      setCityInfoGenerating(false);
    }
  }, [
    sessionId,
    cityInfoGeneratePrompt,
    cityInfoGenerateCount,
    cityInfoDedupeExistingItems,
    cityInfoGenerationLang,
    aiGenerationMode,
    aiUseWebSearch,
    showNote,
    setCityInfos,
    setCityInfoGenerateModalOpen,
    setCityInfoGeneratePrompt,
    setCityInfoGenerationTaskId,
    setCityInfoGenerating,
    setCityInfoGenerationError,
  ]);

  const createCityFilterFolder = useCallback(async (payload) => {
    try {
      const res = await cityFiltersAPI.create({
        ...payload,
        type: 'folder',
        parent_id: null,
      });
      const created = normalizeCreatedFilter(unwrapCreatedFilter(res));
      if (created?.id != null) {
        const idStr = String(created.id);
        locallyDeletedCityFilterIdsRef.current.delete(idStr);
        locallyCreatedCityFiltersRef.current.set(idStr, created);
        setCityFilterTree((prev) => upsertEventFilterInTree(prev, created));
      }
      showNote('Папка создана', 'success');
      void loadCityFilterTree().catch((err) => {
        console.error('City filter tree reload failed', err);
      });
    } catch (e) {
      showNote(parseApiError(e, 'Ошибка создания папки'), 'error');
      throw e;
    }
  }, [loadCityFilterTree, showNote, setCityFilterTree]);

  const createCityFilterTag = useCallback(async (folderId, payload) => {
    const parentId = normalizeId(folderId);
    if (!parentId) {
      showNote('Не указана папка для тега', 'error');
      return;
    }
    try {
      const res = await cityFiltersAPI.create({
        ...payload,
        type: 'tag',
        parent_id: parentId,
      });
      const created = normalizeCreatedFilter(unwrapCreatedFilter(res));
      if (created?.id != null) {
        const idStr = String(created.id);
        locallyDeletedCityFilterIdsRef.current.delete(idStr);
        locallyCreatedCityFiltersRef.current.set(idStr, created);
        setCityFilterTree((prev) => upsertEventFilterInTree(prev, created));
      }
      showNote('Тег создан', 'success');
      void loadCityFilterTree().catch((err) => {
        console.error('City filter tree reload failed', err);
      });
    } catch (e) {
      showNote(parseApiError(e, 'Ошибка создания тега'), 'error');
      throw e;
    }
  }, [loadCityFilterTree, showNote, setCityFilterTree]);

  const createCityTag = useCallback(async (payload) => {
    try {
      const res = await cityFiltersAPI.create({
        ...payload,
        type: 'tag',
        parent_id: payload?.parent_id ?? null,
      });
      const created = normalizeCreatedFilter(unwrapCreatedFilter(res));
      if (created?.id != null) {
        const idStr = String(created.id);
        locallyDeletedCityFilterIdsRef.current.delete(idStr);
        locallyCreatedCityFiltersRef.current.set(idStr, created);
        setCityTagCatalog((prev) => upsertFlatFilterRow(prev, created));
      }
      showNote('Тег города создан', 'success');
      void loadCityTagCatalog().catch((err) => {
        console.error('City tag catalog reload failed', err);
      });
      void loadCityFilterTree().catch((err) => {
        console.error('City filter tree reload failed', err);
      });
    } catch (e) {
      showNote(parseApiError(e, 'Ошибка создания тега'), 'error');
      throw e;
    }
  }, [loadCityTagCatalog, loadCityFilterTree, showNote, setCityTagCatalog]);

  const updateCityFilter = useCallback(async (filterId, payload) => {
    const id = normalizeId(filterId);
    if (!id) return;
    try {
      await cityFiltersAPI.update(id, payload);
      locallyDeletedCityFilterIdsRef.current.delete(String(id));
      showNote('Сохранено', 'success');
      await loadCityFilterTree();
      await loadCityTagCatalog();
    } catch (e) {
      showNote(parseApiError(e, 'Ошибка сохранения'), 'error');
      throw e;
    }
  }, [loadCityFilterTree, loadCityTagCatalog, showNote]);

  const deleteCityFilter = useCallback(async (filterId, opts = {}) => {
    const id = normalizeId(filterId);
    if (!id) return;
    const message = opts.message || 'Удалить этот элемент?';
    if (!(await confirm({ message, danger: true }))) return;

    const idStr = String(id);
    if (deletingCityFilterPendingRef.current.has(idStr)) {
      return;
    }

    deletingCityFilterPendingRef.current.add(idStr);
    setDeletingCityFilterIds((prev) => {
      const next = new Set(prev);
      next.add(idStr);
      return next;
    });

    const applyLocalRemove = () => {
      applyLocalFilterDeletion(
        idStr,
        locallyDeletedCityFilterIdsRef.current,
        locallyCreatedCityFiltersRef.current,
      );
      setCityTagCatalog((prev) =>
        prev.filter((item) => String(item.id) !== idStr),
      );
      setCityFilterTree((prev) =>
        removeFilterIdsFromTree(prev, locallyDeletedCityFilterIdsRef.current),
      );
      setCityTags((prev) => {
        const next = normalizeTagIds(prev).filter((t) => t !== id);
        patchActiveDraftTags(next);
        return next;
      });
    };

    try {
      await cityFiltersAPI.delete(id);
      applyLocalRemove();
      showNote('Удалено', 'success');
    } catch (e) {
      if (isNotFoundError(e)) {
        applyLocalRemove();
        showNote('Элемент уже удалён', 'success');
      } else {
        showNote(parseApiError(e, 'Не удалось удалить'), 'error');
      }
    } finally {
      deletingCityFilterPendingRef.current.delete(idStr);
      setDeletingCityFilterIds((prev) => {
        const next = new Set(prev);
        next.delete(idStr);
        return next;
      });
      void loadCityFilterTree().catch((err) => {
        console.error('Catalog reload after delete failed', err);
      });
      void loadCityTagCatalog().catch((err) => {
        console.error('Catalog reload after delete failed', err);
      });
    }
  }, [confirm, loadCityFilterTree, loadCityTagCatalog, showNote, patchActiveDraftTags, setDeletingCityFilterIds, setCityTagCatalog, setCityFilterTree, setCityTags]);

  const uploadEventFilterImage = uploadCityFilterImage;

  const createEventFilterFolder = useCallback(async (payload) => {
    try {
      const res = await eventFiltersAPI.create({
        ...payload,
        type: 'folder',
        parent_id: null,
      });
      const created = normalizeCreatedFilter(unwrapCreatedFilter(res));
      if (created?.id != null) {
        const idStr = String(created.id);
        locallyDeletedEventFilterIdsRef.current.delete(idStr);
        locallyCreatedEventFiltersRef.current.set(idStr, created);
        setEventFilterTree((prev) => upsertEventFilterInTree(prev, created));
      }
      showNote('Папка создана', 'success');
      void loadEventFilterTree().catch((err) => {
        console.error('Event filter tree reload failed', err);
      });
    } catch (e) {
      showNote(parseApiError(e, 'Ошибка создания папки'), 'error');
      throw e;
    }
  }, [loadEventFilterTree, showNote, setEventFilterTree]);

  const createEventFilterTag = useCallback(async (folderId, payload) => {
    const parentId = normalizeId(folderId);
    if (!parentId) {
      showNote('Не указана папка для тега', 'error');
      return;
    }
    try {
      const res = await eventFiltersAPI.create({
        ...payload,
        type: 'tag',
        parent_id: parentId,
      });
      const created = normalizeCreatedFilter(
        unwrapCreatedFilter(res) || { ...payload, parent_id: parentId },
      );
      if (created?.id != null) {
        const idStr = String(created.id);
        locallyDeletedEventFilterIdsRef.current.delete(idStr);
        locallyCreatedEventFiltersRef.current.set(idStr, {
          ...created,
          parent_id: created.parent_id ?? parentId,
        });
        setEventFilterTree((prev) =>
          upsertEventFilterInTree(prev, {
            ...created,
            parent_id: created.parent_id ?? parentId,
          }),
        );
      }
      showNote('Тег создан', 'success');
      void loadEventFilterTree().catch((err) => {
        console.error('Event filter tree reload failed', err);
      });
    } catch (e) {
      showNote(parseApiError(e, 'Ошибка создания тега'), 'error');
      throw e;
    }
  }, [loadEventFilterTree, showNote, setEventFilterTree]);

  const updateEventFilter = useCallback(async (filterId, payload) => {
    const id = normalizeId(filterId);
    if (!id) return;
    try {
      await eventFiltersAPI.update(id, payload);
      locallyDeletedEventFilterIdsRef.current.delete(String(id));
      showNote('Сохранено', 'success');
      await loadEventFilterTree();
    } catch (e) {
      showNote(parseApiError(e, 'Ошибка сохранения'), 'error');
      throw e;
    }
  }, [loadEventFilterTree, showNote]);

  const deleteEventFilter = useCallback(async (filterId, opts = {}) => {
    const id = normalizeId(filterId);
    if (!id) return;
    const message = opts.message || 'Удалить этот элемент?';
    if (!(await confirm({ message, danger: true }))) return;

    const idStr = String(id);
    if (deletingEventFilterPendingRef.current.has(idStr)) {
      return;
    }

    deletingEventFilterPendingRef.current.add(idStr);
    setDeletingEventFilterIds((prev) => {
      const next = new Set(prev);
      next.add(idStr);
      return next;
    });

    const applyLocalRemove = () => {
      applyLocalFilterDeletion(
        idStr,
        locallyDeletedEventFilterIdsRef.current,
        locallyCreatedEventFiltersRef.current,
      );
      setEventFilterTree((prev) =>
        removeFilterIdsFromTree(prev, locallyDeletedEventFilterIdsRef.current),
      );
    };

    try {
      await eventFiltersAPI.delete(id);
      applyLocalRemove();
      showNote('Удалено', 'success');
    } catch (e) {
      if (isNotFoundError(e)) {
        applyLocalRemove();
        showNote('Элемент уже удалён', 'success');
      } else {
        showNote(parseApiError(e, 'Не удалось удалить'), 'error');
      }
    } finally {
      deletingEventFilterPendingRef.current.delete(idStr);
      setDeletingEventFilterIds((prev) => {
        const next = new Set(prev);
        next.delete(idStr);
        return next;
      });
      void loadEventFilterTree().catch((err) => {
        console.error('Catalog reload after delete failed', err);
      });
    }
  }, [confirm, loadEventFilterTree, showNote, setDeletingEventFilterIds, setEventFilterTree]);

  const bulkDeleteCityTags = useCallback(async (rawIds) => {
    const ids = [...new Set((rawIds || []).map(normalizeId).filter(Boolean))];
    if (!ids.length) return { deleted: 0, failed: 0 };

    let deleted = 0;
    let failed = 0;

    for (const id of ids) {
      const idStr = String(id);
      if (deletingCityFilterPendingRef.current.has(idStr)) {
        continue;
      }

      deletingCityFilterPendingRef.current.add(idStr);
      setDeletingCityFilterIds((prev) => {
        const next = new Set(prev);
        next.add(idStr);
        return next;
      });

      const applyLocalRemove = () => {
        applyLocalFilterDeletion(
          idStr,
          locallyDeletedCityFilterIdsRef.current,
          locallyCreatedCityFiltersRef.current,
        );
        setCityTagCatalog((prev) => prev.filter((item) => String(item.id) !== idStr));
        setCityFilterTree((prev) =>
          removeFilterIdsFromTree(prev, locallyDeletedCityFilterIdsRef.current),
        );
        setCityTags((prev) => {
          const next = normalizeTagIds(prev).filter((tagId) => tagId !== id);
          patchActiveDraftTags(next);
          return next;
        });
      };

      try {
        await cityFiltersAPI.delete(id);
        applyLocalRemove();
        deleted += 1;
      } catch (e) {
        if (isNotFoundError(e)) {
          applyLocalRemove();
          deleted += 1;
        } else {
          failed += 1;
        }
      } finally {
        deletingCityFilterPendingRef.current.delete(idStr);
        setDeletingCityFilterIds((prev) => {
          const next = new Set(prev);
          next.delete(idStr);
          return next;
        });
      }
    }

    void loadCityFilterTree().catch((err) => {
      console.error('Catalog reload after bulk delete failed', err);
    });
    void loadCityTagCatalog().catch((err) => {
      console.error('Catalog reload after bulk delete failed', err);
    });

    if (failed) {
      showNote(`Удалено с ошибками: ${failed} из ${ids.length}`, 'error');
    } else if (deleted) {
      showNote(`Удалено тегов: ${deleted}`, 'success');
    }

    return { deleted, failed };
  }, [
    loadCityFilterTree,
    loadCityTagCatalog,
    patchActiveDraftTags,
    setCityFilterTree,
    setCityTagCatalog,
    setCityTags,
    setDeletingCityFilterIds,
    showNote,
  ]);

  const bulkDeleteEventTags = useCallback(async (rawIds) => {
    const ids = [...new Set((rawIds || []).map(normalizeId).filter(Boolean))];
    if (!ids.length) return { deleted: 0, failed: 0 };

    let deleted = 0;
    let failed = 0;

    for (const id of ids) {
      const idStr = String(id);
      if (deletingEventFilterPendingRef.current.has(idStr)) {
        continue;
      }

      deletingEventFilterPendingRef.current.add(idStr);
      setDeletingEventFilterIds((prev) => {
        const next = new Set(prev);
        next.add(idStr);
        return next;
      });

      const applyLocalRemove = () => {
        applyLocalFilterDeletion(
          idStr,
          locallyDeletedEventFilterIdsRef.current,
          locallyCreatedEventFiltersRef.current,
        );
        setEventFilterTree((prev) =>
          removeFilterIdsFromTree(prev, locallyDeletedEventFilterIdsRef.current),
        );
      };

      try {
        await eventFiltersAPI.delete(id);
        applyLocalRemove();
        deleted += 1;
      } catch (e) {
        if (isNotFoundError(e)) {
          applyLocalRemove();
          deleted += 1;
        } else {
          failed += 1;
        }
      } finally {
        deletingEventFilterPendingRef.current.delete(idStr);
        setDeletingEventFilterIds((prev) => {
          const next = new Set(prev);
          next.delete(idStr);
          return next;
        });
      }
    }

    void loadEventFilterTree().catch((err) => {
      console.error('Catalog reload after bulk delete failed', err);
    });

    if (failed) {
      showNote(`Удалено с ошибками: ${failed} из ${ids.length}`, 'error');
    } else if (deleted) {
      showNote(`Удалено тегов: ${deleted}`, 'success');
    }

    return { deleted, failed };
  }, [loadEventFilterTree, setDeletingEventFilterIds, setEventFilterTree, showNote]);

  const translateSelectedTags = useCallback(async ({
    filterType,
    ids,
    sourceLanguage = 'ru',
    targetLanguages = [],
  }) => {
    const normalizedIds = [...new Set((ids || []).map(normalizeId).filter(Boolean))];
    if (!normalizedIds.length) {
      return null;
    }

    try {
      const res = await tagsAPI.translateSelected({
        filter_type: filterType,
        ids: normalizedIds,
        source_language: sourceLanguage,
        target_languages: targetLanguages,
        fields: ['title'],
      });
      const data = res?.data;
      const translatedCount = Number(data?.translated_count ?? 0);

      if (filterType === 'city') {
        await loadCityTagCatalog();
        await loadCityFilterTree();
      } else {
        await loadEventFilterTree();
      }

      showNote(`Переведено тегов: ${translatedCount}`, 'success');
      return data;
    } catch (e) {
      showNote(parseApiError(e, 'Ошибка перевода тегов'), 'error');
      throw e;
    }
  }, [loadCityFilterTree, loadCityTagCatalog, loadEventFilterTree, showNote]);

  const getSessionUuid = useCallback(() => session?.uuid || session?.session_uuid || '', [session]);

  return {
    lat, lon, savedLat, savedLon,
    setLat, setLon, setSavedLat, setSavedLon,

    imageId, imagePreview, imageOriginalUrl, imageCopyright,
    setImageId, setImagePreview, setImageOriginalUrl, setImageCopyright,
    photoUploading, photoFileRef,

    commonsModalOpen, setCommonsModalOpen, commonsTarget, setCommonsTarget,
    openCityCommonsModal, handleCommonsImageSelect,

    cityTags, setCityTags, tagInput, setTagInput,

    addLocaleOpen, setAddLocaleOpen, newLocaleCode, setNewLocaleCode, newLocaleLang, setNewLocaleLang,

    cityInfos, setCityInfos, currentCityInfo, setCurrentCityInfo,
    cityInfoActiveLocale, setCityInfoActiveLocale,
    cityInfoSaving, cityInfoAutoSaving, cityInfoAutoSaved,
    cityInfoLocaleData,

    cityInfoGenerateModalOpen, setCityInfoGenerateModalOpen,
    cityInfoGeneratePrompt, setCityInfoGeneratePrompt,
    cityInfoGenerateCount, setCityInfoGenerateCount,
    cityInfoDedupeExistingItems, setCityInfoDedupeExistingItems,
    cityInfoGenerating, setCityInfoGenerating,
    cityInfoGenerationError, setCityInfoGenerationError,
    cityInfoGenerationTaskId, setCityInfoGenerationTaskId,
    cityInfoGenerationLang, setCityInfoGenerationLang,

    aiGenerationMode, setAiGenerationMode,
    aiUseWebSearch, setAiUseWebSearch,
    aiAdvancedGenerationAvailable, setAiAdvancedGenerationAvailable,

    mapRef, mapInstanceRef, markerRef, mapReadyRef,
    mapNode, setMapContainerRef,

    saving, savingRef, autoSaving, autoSavingRef, autoSaved, autoSaveTimerRef,

    localCreatedCityDraftsRef, localDeletedCityDraftIdsRef,
    loadSessionSeqRef,

    cityFilterTree, setCityFilterTree, cityFilterTreeLoading, cityFilterTreeError,
    eventFilterTree, setEventFilterTree, eventFilterTreeLoading, eventFilterTreeError,
    cityTagCatalog, setCityTagCatalog, cityTagCatalogLoading, cityTagCatalogError,

    locallyDeletedCityFilterIdsRef, locallyDeletedEventFilterIdsRef,
    locallyCreatedCityFiltersRef, locallyCreatedEventFiltersRef,
    deletingCityFilterPendingRef, deletingEventFilterPendingRef,
    deletingCityFilterIds, deletingEventFilterIds,

    clearCityWizardForm, loadCityIntoForm,
    saveCityForStep1, saveCitySilently, waitForCityPersistenceIdle,
    mergeCitySaveResponseIntoState,

    handlePhotoFile, handlePhotoDelete,

    switchLocale, addLocale, removeLocale, updateLocaleField,

    handleSelectDraft, handleCreateDraft, handleDeleteDraft,
    markCityDraftCreatedLocally, markCityDraftDeletedLocally,
    syncActiveDraftRoute,

    addTag, removeTag, handleTagKeyDown, handleTagBlur, toggleCityTag,
    patchActiveDraftTags,

    uploadCityFilterImage,

    addCityInfo, importCityInfoFromText, openCityInfoDetail, deleteCurrentCityInfo,
    updateCurrentCityInfoPatch, updateCityInfoLocaleField,
    saveCurrentCityInfo, saveCurrentCityInfoIfDirty, isCurrentCityInfoDirty,
    getCityInfoName,

    openCityInfoGenerateModal, closeCityInfoGenerateModal,
    generateCityInfoFromPrompt, resolveDefaultCityInfoAiLang,

    loadCityFilterTree, loadEventFilterTree, loadCityTagCatalog,

    createCityFilterFolder, createCityFilterTag, createCityTag,
    updateCityFilter, deleteCityFilter,
    bulkDeleteCityTags, bulkDeleteEventTags, translateSelectedTags,

    createEventFilterFolder, createEventFilterTag,
    updateEventFilter, deleteEventFilter, uploadEventFilterImage,

    getSessionUuid,

    requestedCityDraftIdRef,
  };
}
