import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { attractionsAPI, attractionInfosAPI, attractionFeedAPI, aiAPI, tasksAPI, imagesAPI as defaultImagesAPI, sessionsAPI } from '../../../api/generation';
import {
  pollGenerationTask,
  isPollCancelledError,
  TASK_NOT_FOUND_MESSAGE,
} from '../../../utils/generationTaskPoll';
import { parseApiError } from '../../../utils/apiError';
import {
  clampGenerationCount,
} from '../../../components/generation/AiGenerationCountField.jsx';
import {
  buildGenerationPayloadFields,
} from '../../../components/generation/AiGenerationQualitySettings.jsx';
import { formatGenerationDedupeResultMessage } from '../../../components/generation/AiGenerationDedupeToggle.jsx';
import {
  DEFAULT_LOCALE_DEFS,
  getLocaleInfo,
  normalizeId,
  stripLegacyImageFields,
  resolveSessionEntityImageId,
  resolveSessionEntityImageUrl,
  resolveSessionEntityImageOriginalUrl,
  resolveSessionEntityImageCopyright,
  normalizeTagIds,
} from './sessionWizardShared.jsx';
import {
  getMultilangKeys,
  getAttractionLocaleSourceEntries,
  normalizeDraftId,
} from './useSessionWizardHelpers.js';

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

function getAttrName(attr) {
  const name = attr?.name || {};
  return name.ru || name.en || name.it || Object.values(name).find(Boolean) || '(без названия)';
}

const normalizeAttraction = (attr = {}) => {
  const index = Number(attr.index ?? attr.order ?? 0);

  const cityId = attr.city_id ?? attr.city ?? null;
  const sessionCityId = attr.session_city_id ?? attr.session_city ?? null;

  let assignedCityType = attr.assigned_city_type ?? 'none';

  if (!attr.assigned_city_type) {
    if (cityId) {
      assignedCityType = 'database';
    } else if (sessionCityId) {
      assignedCityType = 'draft';
    }
  }

  const image_id = resolveSessionEntityImageId(attr) || null;
  const image_url = resolveSessionEntityImageUrl(attr);
  const image_original_url = resolveSessionEntityImageOriginalUrl(attr);
  const image_copyright = resolveSessionEntityImageCopyright(attr);

  return {
    ...stripLegacyImageFields(attr),

    id: attr.id ?? null,

    name: attr.name ?? {},
    description: attr.description ?? {},

    lat: attr.lat ?? null,
    lon: attr.lon ?? null,

    index,
    order: index,
    rank: Number(attr.rank ?? 0),

    city: cityId,
    city_id: cityId,

    session_city: sessionCityId,
    session_city_id: sessionCityId,

    assigned_city_type: assignedCityType,
    assigned_city_name: attr.assigned_city_name ?? null,

    image_id,
    image_url,
    imagePreview: image_url,
    image_original_url,
    imageOriginalUrl: image_original_url,
    image_copyright,
    imageCopyright: image_copyright,
    image: null,

    contents: attr.contents ?? {},

    tags: normalizeTagIds(attr.tags ?? []),
  };
};

const normalizeAttractionInfo = (info = {}) => {
  const eventId =
    info.event_id ??
    info.event ??
    info.attraction_id ??
    info.attraction ??
    null;

  const sessionAttractionId =
    info.session_attraction_id ??
    info.session_attraction ??
    null;

  let assignedAttractionType = info.assigned_attraction_type ?? 'none';

  if (!info.assigned_attraction_type) {
    if (eventId) {
      assignedAttractionType = 'database';
    } else if (sessionAttractionId) {
      assignedAttractionType = 'draft';
    }
  }

  return {
    ...info,

    id: info.id ?? null,

    name: info.name ?? {},
    description: info.description ?? {},

    event: eventId,
    event_id: eventId,

    attraction: eventId,
    attraction_id: eventId,

    session_attraction: sessionAttractionId,
    session_attraction_id: sessionAttractionId,

    assigned_attraction_type: assignedAttractionType,
    assigned_attraction_name: info.assigned_attraction_name ?? null,
  };
};

const normalizeAttractionFeedItem = (item = {}) => {
  const eventId = normalizeId(
    item.event_id ??
      item.event ??
      item.attraction_id ??
      item.attraction
  ) || null;

  const sessionAttractionId = normalizeId(
    item.session_attraction_id ??
      item.session_attraction
  ) || null;

  let assignedAttractionType = item.assigned_attraction_type ?? 'none';

  if (!item.assigned_attraction_type) {
    if (eventId) {
      assignedAttractionType = 'database';
    } else if (sessionAttractionId) {
      assignedAttractionType = 'draft';
    }
  }

  return {
    ...item,

    id: item.id ?? null,

    item_type: item.item_type || 'text',

    text: item.text ?? {},

    image_id: item.image_id ?? item.image?.id ?? item.image ?? null,
    image_url:
      item.image_url ??
      item.imageUrl ??
      item.localUrl ??
      item.local_url ??
      item.image?.url ??
      item.image?.file ??
      null,

    image_original_url:
      item.image_original_url ??
      item.imageOriginalUrl ??
      item.original_image_url ??
      item.originalImageUrl ??
      item.image?.original_url ??
      item.image?.source_url ??
      item.image?.file_page_url ??
      '',

    image_copyright:
      item.image_copyright ??
      item.imageCopyright ??
      item.copyright ??
      item.image?.copyright ??
      '',

    index: Number(item.index ?? 0),

    event: eventId,
    event_id: eventId,

    attraction: eventId,
    attraction_id: eventId,

    session_attraction: sessionAttractionId,
    session_attraction_id: sessionAttractionId,

    assigned_attraction_type: assignedAttractionType,
    assigned_attraction_name: item.assigned_attraction_name ?? null,

    isNew: item.isNew ?? false,
  };
};

function collectAttrLocaleTexts(attrLocaleData) {
  const name = {};
  const description = {};

  Object.values(attrLocaleData || {}).forEach((d) => {
    if (!d?.lang) return;

    if (d.name || d.description) {
      name[d.lang] = d.name || '';
      description[d.lang] = d.description || '';
    }
  });

  return { name, description };
}

const buildAttractionPayload = (attr, name, description) => {
  const assignedType = attr.assigned_city_type ?? 'none';

  let city = null;
  let sessionCity = null;

  if (assignedType === 'database') {
    city = normalizeId(attr.city_id ?? attr.city) || null;
  } else if (assignedType === 'draft') {
    sessionCity = normalizeDraftId(attr.session_city_id ?? attr.session_city) || null;
  }

  const index = Number(attr.index ?? attr.order ?? 0);

  const payload = {
    name: name ?? attr.name ?? {},
    description: description ?? attr.description ?? {},

    lat: attr.lat === '' ? null : attr.lat,
    lon: attr.lon === '' ? null : attr.lon,

    index,
    rank: Number(attr.rank ?? 0),

    assigned_city_type: assignedType,

    city: null,
    city_id: null,
    session_city: null,
    session_city_id: null,

    image_id: attr.image_id ?? null,
    image_original_url: attr.image_original_url ?? attr.imageOriginalUrl ?? '',
    image_copyright: attr.image_copyright ?? attr.imageCopyright ?? '',

    order: index,

    tags: normalizeTagIds(attr.tags ?? []),
  };

  if (assignedType === 'database') {
    payload.city = city;
    payload.city_id = city;
  } else if (assignedType === 'draft') {
    payload.session_city = sessionCity;
    payload.session_city_id = sessionCity;
  }

  return payload;
};

function buildAttrPersistSnapshot(attr, attrLocaleData) {
  if (!attr?.id) return null;

  const { name, description } = collectAttrLocaleTexts(attrLocaleData);
  const contents = {};

  Object.values(attrLocaleData || {}).forEach((d) => {
    if (d?.lang) {
      contents[d.lang] = d.contentText || '';
    }
  });

  return JSON.stringify({
    payload: buildAttractionPayload(normalizeAttraction(attr), name, description),
    contents,
  });
}

const buildAttractionInfoPayload = (info, name, description) => {
  const assignedType = info.assigned_attraction_type ?? 'none';

  let event = null;
  let sessionAttraction = null;

  if (assignedType === 'database') {
    event =
      info.event_id ??
      info.event ??
      info.attraction_id ??
      info.attraction ??
      null;
  }

  if (assignedType === 'draft') {
    sessionAttraction =
      info.session_attraction_id ??
      info.session_attraction ??
      null;
  }

  return {
    name: name ?? info.name ?? {},
    description: description ?? info.description ?? {},

    assigned_attraction_type: assignedType,

    event,
    event_id: event,

    attraction: event,
    attraction_id: event,

    session_attraction: sessionAttraction,
    session_attraction_id: sessionAttraction,
  };
};

const createEmptyAttractionInfo = ({
  activeAttractionId = null,
  sourceLocaleData = null,
} = {}) => {
  const normalizedAttractionId = normalizeId(activeAttractionId);
  const shouldAttachToDraft = Boolean(normalizedAttractionId);

  const sourceEntries =
    sourceLocaleData && Object.keys(sourceLocaleData).length > 0
      ? Object.entries(sourceLocaleData).map(([key, loc]) => ({ key, ...loc }))
      : DEFAULT_LOCALE_DEFS;

  const nameObj = {};
  const descObj = {};

  sourceEntries.forEach((locale) => {
    const lang = locale.lang || locale.key?.split('-')?.[0] || 'ru';
    if (lang) {
      nameObj[lang] = '';
      descObj[lang] = '';
    }
  });

  return {
    id: `attraction-info-${Date.now()}`,

    name: nameObj,
    description: descObj,

    assigned_attraction_type: shouldAttachToDraft ? 'draft' : 'none',

    attraction: null,
    attraction_id: null,

    session_attraction: shouldAttachToDraft ? normalizedAttractionId : null,
    session_attraction_id: shouldAttachToDraft ? normalizedAttractionId : null,

    isNew: true,
  };
};

const createEmptyAttractionFeedItem = (itemType = 'text') => {
  const makeEmptyLocaleObject = () => {
    return DEFAULT_LOCALE_DEFS.reduce((acc, locale) => {
      const lang = locale.lang || locale.key?.split('-')?.[0] || 'ru';
      if (lang) acc[lang] = '';
      return acc;
    }, {});
  };

  return {
    id: `attraction-feed-${Date.now()}`,

    item_type: itemType,

    text: makeEmptyLocaleObject(),

    image_id: null,
    image_url: '',
    image_original_url: '',
    image_copyright: '',

    index: 0,

    assigned_attraction_type: 'none',

    event: null,
    event_id: null,

    attraction: null,
    attraction_id: null,

    session_attraction: null,
    session_attraction_id: null,

    isNew: true,
  };
};

const buildAttractionFeedPayload = (item, text = null) => {
  const assignedType = item.assigned_attraction_type ?? 'none';

  let event = null;
  let sessionAttraction = null;

  if (assignedType === 'database') {
    event = item.event_id ?? item.event ?? item.attraction_id ?? item.attraction ?? null;
  }

  if (assignedType === 'draft') {
    sessionAttraction =
      item.session_attraction_id ??
      item.session_attraction ??
      null;
  }

  return {
    item_type: item.item_type || 'text',

    text: text ?? item.text ?? {},

    image_id: item.image_id ?? item.image?.id ?? item.image ?? null,
    image: item.image_id ?? item.image?.id ?? item.image ?? null,

    image_original_url:
      item.image_original_url ??
      item.imageOriginalUrl ??
      '',

    image_copyright:
      item.image_copyright ??
      item.imageCopyright ??
      item.copyright ??
      '',

    index: Number(item.index ?? 0),

    assigned_attraction_type: assignedType,

    event,
    event_id: event,

    attraction: event,
    attraction_id: event,

    session_attraction: sessionAttraction,
    session_attraction_id: sessionAttraction,
  };
};

function collectAttractionFeedLocaleTexts(attractionFeedLocaleData) {
  const text = {};

  Object.values(attractionFeedLocaleData || {}).forEach((d) => {
    if (!d?.lang) return;

    text[d.lang] = d.text || '';
  });

  return text;
}

function buildAttractionFeedPersistSnapshot(item, attractionFeedLocaleData) {
  if (!item?.id) return null;

  const normalizedItem = normalizeAttractionFeedItem(item);

  const text =
    normalizedItem.item_type === 'text'
      ? collectAttractionFeedLocaleTexts(attractionFeedLocaleData)
      : {};

  return JSON.stringify(
    buildAttractionFeedPayload(normalizedItem, text),
  );
}

const getLocaleLang = (localeKey) => {
  const locale = DEFAULT_LOCALE_DEFS.find((item) => item.key === localeKey);

  return locale?.lang || localeKey?.split('-')?.[0] || 'ru';
};

export function useAttractionsStep(ctx) {
  const {
    sessionId,
    showNote,
    confirm,
    localeData,
    cityDrafts,
    referenceCities,
    referenceAttractions,
    activeCityDraftIdRef,
    hasUnsavedChangesRef,
    loadSession,
    setCommonsTarget,
    setCommonsModalOpen,
    aiGenerationMode,
    aiUseWebSearch,
    getSessionUuid,
    imagesAPI: imagesAPIProp,
    session,
  } = ctx;

  const imagesAPI = imagesAPIProp || defaultImagesAPI;

  // ─── Attraction main state ─────────────────────────────────────────────────
  const [attractions, setAttractions] = useState([]);
  const [attrView, setAttrView] = useState('list');
  const [currentAttr, setCurrentAttr] = useState(null);
  const [attrLocaleData, setAttrLocaleData] = useState({});
  const [attrActiveLocale, setAttrActiveLocale] = useState('ru-RU');
  const [attrSaving, setAttrSaving] = useState(false);
  const [attrAutoSaving, setAttrAutoSaving] = useState(false);
  const [attrAutoSaved, setAttrAutoSaved] = useState(false);
  const [attractionsLoaded, setAttractionsLoaded] = useState(false);

  const attrLocaleDataAttractionIdRef = useRef(null);
  const attrSavedSnapshotRef = useRef(null);
  const attrSavingRef = useRef(false);
  const attrAutoSaveTimerRef = useRef(null);
  const attrAutoSavedTimerRef = useRef(null);

  // ─── Attraction info state ─────────────────────────────────────────────────
  const [attractionInfos, setAttractionInfos] = useState([]);
  const [currentAttractionInfo, setCurrentAttractionInfo] = useState(null);
  const [attractionInfoActiveLocale, setAttractionInfoActiveLocale] = useState('ru-RU');
  const [attractionInfoSaving, setAttractionInfoSaving] = useState(false);

  // ─── Attraction feed state ─────────────────────────────────────────────────
  const [attractionFeedItems, setAttractionFeedItems] = useState([]);
  const [currentAttractionFeedItem, setCurrentAttractionFeedItem] = useState(null);
  const [attractionFeedLocaleData, setAttractionFeedLocaleData] = useState({});
  const [attractionFeedActiveLocale, setAttractionFeedActiveLocale] = useState('ru-RU');
  const [attractionFeedSaving, setAttractionFeedSaving] = useState(false);
  const [attractionFeedAutoSaving, setAttractionFeedAutoSaving] = useState(false);
  const [attractionFeedAutoSaved, setAttractionFeedAutoSaved] = useState(false);
  const [attractionFeedPhotoUploading, setAttractionFeedPhotoUploading] = useState(false);

  const attractionFeedSavedSnapshotRef = useRef(null);
  const currentAttractionFeedItemIdRef = useRef(null);
  const attractionFeedAutoSaveTimerRef = useRef(null);
  const attractionFeedAutoSavedTimerRef = useRef(null);
  const attractionFeedSavingRef = useRef(false);
  const attractionFeedPhotoUploadingRef = useRef(false);
  const attractionFeedLocaleDataItemIdRef = useRef(null);

  // ─── Attraction generation state ───────────────────────────────────────────
  const [attractionGenerationOpen, setAttractionGenerationOpen] = useState(false);
  const [attractionGenerationPrompt, setAttractionGenerationPrompt] = useState('');
  const [attractionGenerating, setAttractionGenerating] = useState(false);
  const [attractionGenerationTaskId, setAttractionGenerationTaskId] = useState(null);
  const [attractionGenerationProgress, setAttractionGenerationProgress] = useState(null);
  const [attractionGenerationError, setAttractionGenerationError] = useState('');
  const [attractionGenerationAssignedCityType, setAttractionGenerationAssignedCityType] =
    useState('none');
  const [attractionGenerationSessionCityId, setAttractionGenerationSessionCityId] = useState('');
  const [attractionGenerationDatabaseCityId, setAttractionGenerationDatabaseCityId] = useState('');
  const [attractionGenerationLang, setAttractionGenerationLang] = useState('ru');
  const [attractionGenerationCount, setAttractionGenerationCount] = useState(5);
  const [attractionDedupeExistingItems, setAttractionDedupeExistingItems] = useState(true);
  const attractionGenPollCancelledRef = useRef(false);
  const attractionGenInFlightRef = useRef(false);

  const attractionFeedPhotoFileRef = useRef(null);

  // ─── Ref syncing effects ───────────────────────────────────────────────────
  useEffect(() => {
    attrSavingRef.current = attrSaving;
  }, [attrSaving]);

  useEffect(() => {
    attractionFeedSavingRef.current = attractionFeedSaving;
  }, [attractionFeedSaving]);

  useEffect(() => {
    attractionFeedPhotoUploadingRef.current = attractionFeedPhotoUploading;
  }, [attractionFeedPhotoUploading]);

  useEffect(() => {
    return () => {
      clearTimeout(attrAutoSaveTimerRef.current);
      clearTimeout(attrAutoSavedTimerRef.current);
      clearTimeout(attractionFeedAutoSaveTimerRef.current);
      clearTimeout(attractionFeedAutoSavedTimerRef.current);
    };
  }, []);

  const reloadAttractionsFromServer = useCallback(async () => {
    if (!sessionId) return null;
    try {
      const res = await sessionsAPI.get(sessionId, { skipApiGetCache: true });
      const data = res?.data || {};

      if (Array.isArray(data.attractions)) {
        setAttractions(data.attractions.map(normalizeAttraction));
      }
      if (Array.isArray(data.attraction_infos)) {
        setAttractionInfos(data.attraction_infos.map(normalizeAttractionInfo));
      }
      if (Array.isArray(data.attraction_feed_items)) {
        setAttractionFeedItems(data.attraction_feed_items.map(normalizeAttractionFeedItem));
      }

      setAttractionsLoaded(true);
      return data;
    } catch (e) {
      showNote('Не удалось загрузить достопримечательности', 'error');
      return null;
    }
  }, [sessionId, showNote]);

  useEffect(() => {
    if (!sessionId) return;
    reloadAttractionsFromServer();
  }, [sessionId, reloadAttractionsFromServer]);

  useEffect(() => {
    if (!session?.id || !Array.isArray(session.attractions)) return;
    if (attrSavingRef.current || attrAutoSaving) return;

    setAttractions(session.attractions.map(normalizeAttraction));
    setAttractionsLoaded(true);

    if (Array.isArray(session.attraction_infos)) {
      setAttractionInfos(session.attraction_infos.map(normalizeAttractionInfo));
    }
    if (Array.isArray(session.attraction_feed_items)) {
      setAttractionFeedItems(session.attraction_feed_items.map(normalizeAttractionFeedItem));
    }
  }, [
    session?.id,
    session?.attractions,
    session?.attraction_infos,
    session?.attraction_feed_items,
    attrAutoSaving,
  ]);

  // ─── buildAttrLocaleData ───────────────────────────────────────────────────
  const buildAttrLocaleData = useCallback((attr = {}, previousData = null) => {
    const sourceEntries = getAttractionLocaleSourceEntries(attr, {
      localeData,
      cityDrafts,
      referenceCities,
      activeCityDraftIdRef,
    });

    return sourceEntries.reduce((acc, [key, locale]) => {
      const lang =
        locale.lang ||
        key?.split('-')?.[0] ||
        'ru';

      const previousLocaleData = previousData?.[key];

      acc[key] = {
        lang,
        code: locale.code || key?.split('-')?.[1] || '',
        langName: locale.langName || locale.name || lang.toUpperCase(),
        isDefault: Boolean(locale.isDefault),
        isCustom: Boolean(locale.isCustom),

        name:
          previousLocaleData?.name ??
          attr.name?.[lang] ??
          '',

        description:
          previousLocaleData?.description ??
          attr.description?.[lang] ??
          '',

        contentText:
          previousLocaleData?.contentText ??
          attr.contents?.[lang] ??
          '',
      };

      return acc;
    }, {});
  }, [localeData, cityDrafts, referenceCities, activeCityDraftIdRef]);

  // ─── Attr locale data sync ─────────────────────────────────────────────────
  useEffect(() => {
    if (!currentAttr) return;

    const currentAttrId = normalizeId(currentAttr.id);

    setAttrLocaleData((prev) => {
      const shouldPreserveValues =
        attrLocaleDataAttractionIdRef.current === currentAttrId;

      const next = buildAttrLocaleData(
        currentAttr,
        shouldPreserveValues ? prev : null
      );

      attrLocaleDataAttractionIdRef.current = currentAttrId;

      return next;
    });
  }, [currentAttr, buildAttrLocaleData]);

  useEffect(() => {
    const availableKeys = Object.keys(attrLocaleData || {});

    if (availableKeys.length === 0) return;

    if (!availableKeys.includes(attrActiveLocale)) {
      setAttrActiveLocale(availableKeys[0]);
    }
  }, [attrLocaleData, attrActiveLocale]);

  // ─── openAttrDetail ────────────────────────────────────────────────────────
  const openAttrDetail = useCallback(async (attrId) => {
    const nextAttrId = normalizeId(attrId);
    const currentAttrId = normalizeId(currentAttr?.id);

    if (currentAttrId && currentAttrId !== nextAttrId) {
      try {
        await saveCurrentAttrIfDirty({ silent: true });
      } catch {
        return;
      }
    }

    try {
      const cachedAttr = attractions.find((item) => String(item.id) === String(attrId));

      const res = await attractionsAPI.get(sessionId, attrId, {
        skipApiGetCache: true,
      });
      const responseAttr = res?.data?.attraction || res?.data || null;

      if (!responseAttr && !cachedAttr) return;

      const mergedAttr = {
        ...(cachedAttr || {}),
        ...(responseAttr || {}),

        image_id:
          responseAttr?.image_id ??
          responseAttr?.image?.id ??
          cachedAttr?.image_id ??
          cachedAttr?.image?.id ??
          null,

        image_url:
          responseAttr?.image_url ??
          responseAttr?.image?.url ??
          responseAttr?.image?.file ??
          cachedAttr?.image_url ??
          cachedAttr?.imagePreview ??
          cachedAttr?.image?.url ??
          cachedAttr?.image?.file ??
          null,

        image_original_url:
          responseAttr?.image_original_url ??
          responseAttr?.imageOriginalUrl ??
          responseAttr?.original_image_url ??
          responseAttr?.originalImageUrl ??
          cachedAttr?.image_original_url ??
          cachedAttr?.imageOriginalUrl ??
          cachedAttr?.original_image_url ??
          cachedAttr?.originalImageUrl ??
          '',

        image_copyright:
          responseAttr?.image_copyright ??
          responseAttr?.imageCopyright ??
          responseAttr?.copyright ??
          responseAttr?.image?.copyright ??
          cachedAttr?.image_copyright ??
          cachedAttr?.imageCopyright ??
          cachedAttr?.copyright ??
          cachedAttr?.image?.copyright ??
          '',

        tags: responseAttr?.tags ?? cachedAttr?.tags ?? [],
      };

      const attr = normalizeAttraction(mergedAttr);

      const openedAttrId = normalizeId(attr.id);
      if (attrLocaleDataAttractionIdRef.current !== openedAttrId) {
        attrLocaleDataAttractionIdRef.current = null;
      }

      setAttractions((items) =>
        items.map((item) => (String(item.id) === String(attr.id) ? attr : item))
      );

      const nextLocaleData = buildAttrLocaleData(attr);
      const nextLocaleKeys = Object.keys(nextLocaleData);

      setCurrentAttr(attr);
      setAttrLocaleData(nextLocaleData);
      setAttrActiveLocale(nextLocaleKeys[0] || 'ru-RU');
      attrSavedSnapshotRef.current = buildAttrPersistSnapshot(attr, nextLocaleData);
      setAttrView('detail');
    } catch (e) {
      showNote('Не удалось открыть достопримечательность: ' + e.message, 'error');
    }
  }, [sessionId, attractions, buildAttrLocaleData, showNote, currentAttr?.id]);

  // ─── addAttraction ─────────────────────────────────────────────────────────
  const addAttraction = useCallback(async () => {
    try {
      const nextIndex = attractions.length;

      const activeDraftId = normalizeDraftId(activeCityDraftIdRef.current);
      const shouldAttachToDraft =
        activeDraftId && activeDraftId !== 'legacy';

      const res = await attractionsAPI.create(sessionId, {
        name: {},
        description: {},

        lat: null,
        lon: null,

        index: nextIndex,
        rank: 0,

        assigned_city_type: shouldAttachToDraft ? 'draft' : 'none',

        city: null,
        city_id: null,

        session_city: shouldAttachToDraft ? activeDraftId : null,
        session_city_id: shouldAttachToDraft ? activeDraftId : null,

        image_id: null,

        order: nextIndex,
      });

      const rawAttr = res?.data?.attraction || res?.data;

      const attr = normalizeAttraction(rawAttr || {});

      if (attr?.id) {
        const nextAttrId = normalizeId(attr.id);
        if (attrLocaleDataAttractionIdRef.current !== nextAttrId) {
          attrLocaleDataAttractionIdRef.current = null;
        }

        const nextLocaleData = buildAttrLocaleData(attr);
        const nextLocaleKeys = Object.keys(nextLocaleData);

        setAttractions((prev) => [...prev, attr]);
        setCurrentAttr(attr);
        setAttrLocaleData(nextLocaleData);
        setAttrActiveLocale(nextLocaleKeys[0] || 'ru-RU');
        attrSavedSnapshotRef.current = buildAttrPersistSnapshot(attr, nextLocaleData);
        setAttrView('detail');

        showNote(
          shouldAttachToDraft
            ? 'Достопримечательность добавлена и привязана к текущему городу'
            : 'Достопримечательность добавлена',
          'success'
        );
      }
    } catch (e) {
      showNote('Ошибка при добавлении: ' + parseApiError(e, e.message), 'error');
    }
  }, [
    sessionId,
    attractions.length,
    buildAttrLocaleData,
    showNote,
    activeCityDraftIdRef,
  ]);

  // ─── deleteCurrentAttr ─────────────────────────────────────────────────────
  const deleteCurrentAttr = useCallback(async () => {
    if (!currentAttr) return;
    const name = getAttrName(currentAttr);
    if (!(await confirm({ message: `Удалить «${name}»?`, danger: true }))) return;
    try {
      await attractionsAPI.delete(sessionId, currentAttr.id);
      setAttractions(prev => prev.filter((item) => item.id !== currentAttr.id));
      setAttrView('list');
      setCurrentAttr(null);
      showNote('Удалено', 'success');
    } catch (e) {
      showNote('Ошибка при удалении: ' + e.message, 'error');
    }
  }, [sessionId, currentAttr, showNote, confirm]);

  // ─── isCurrentAttrDirty ────────────────────────────────────────────────────
  const isCurrentAttrDirty = useCallback(() => {
    if (!currentAttr?.id) return false;

    const snap = buildAttrPersistSnapshot(currentAttr, attrLocaleData);

    return snap !== attrSavedSnapshotRef.current;
  }, [currentAttr, attrLocaleData]);

  // ─── saveCurrentAttr ───────────────────────────────────────────────────────
  const saveCurrentAttr = useCallback(
    async ({ silent = false } = {}) => {
      if (!currentAttr?.id) return null;

      setAttrSaving(true);

      try {
        const { name, description } = collectAttrLocaleTexts(attrLocaleData);
        const updated = await attractionsAPI.update(
          sessionId,
          currentAttr.id,
          buildAttractionPayload(currentAttr, name, description),
        );

        const responseAttr = updated?.data?.attraction || updated?.data || {};

        const updatedAttr = normalizeAttraction({
          ...currentAttr,
          ...responseAttr,

          assigned_city_type:
            responseAttr.assigned_city_type ?? currentAttr.assigned_city_type,
          city_id: responseAttr.city_id ?? responseAttr.city ?? currentAttr.city_id,
          city: responseAttr.city_id ?? responseAttr.city ?? currentAttr.city,
          session_city_id:
            responseAttr.session_city_id ??
            responseAttr.session_city ??
            currentAttr.session_city_id,
          session_city:
            responseAttr.session_city_id ??
            responseAttr.session_city ??
            currentAttr.session_city,

          name: responseAttr.name ?? name,
          description: responseAttr.description ?? description,

          image_id:
            responseAttr.image_id ??
            responseAttr.image?.id ??
            currentAttr.image_id ??
            null,

          image_url:
            responseAttr.image_url ??
            responseAttr.image?.url ??
            responseAttr.image?.file ??
            currentAttr.image_url ??
            currentAttr.imagePreview ??
            null,

          image_original_url:
            responseAttr.image_original_url ??
            responseAttr.imageOriginalUrl ??
            currentAttr.image_original_url ??
            currentAttr.imageOriginalUrl ??
            '',

          image_copyright:
            responseAttr.image_copyright ??
            responseAttr.imageCopyright ??
            currentAttr.image_copyright ??
            currentAttr.imageCopyright ??
            '',

          tags: normalizeTagIds(responseAttr.tags ?? currentAttr.tags ?? []),
        });

        setAttractions((prev) =>
          prev.map((item) => (item.id === currentAttr.id ? updatedAttr : item)),
        );

        setCurrentAttr(updatedAttr);

        await Promise.all(
          Object.values(attrLocaleData).map((d) =>
            attractionsAPI.saveContent(sessionId, currentAttr.id, {
              language: d.lang,
              text: d.contentText || '',
            }),
          ),
        );

        attrSavedSnapshotRef.current = buildAttrPersistSnapshot(
          updatedAttr,
          attrLocaleData,
        );

        if (!silent) {
          showNote('Достопримечательность сохранена', 'success');
        }

        return updatedAttr;
      } catch (e) {
        if (!silent) {
          showNote(
            'Ошибка при сохранении: ' + parseApiError(e, e.message),
            'error',
          );
        }
        throw e;
      } finally {
        setAttrSaving(false);
      }
    },
    [sessionId, currentAttr, attrLocaleData, showNote],
  );

  // ─── saveCurrentAttrIfDirty ────────────────────────────────────────────────
  const saveCurrentAttrIfDirty = useCallback(
    async (options = {}) => {
      if (!currentAttr?.id || !isCurrentAttrDirty()) {
        return true;
      }

      await saveCurrentAttr(options);
      return true;
    },
    [currentAttr, isCurrentAttrDirty, saveCurrentAttr],
  );

  // ─── Auto-save for attraction ──────────────────────────────────────────────
  useEffect(() => {
    clearTimeout(attrAutoSaveTimerRef.current);

    if (!sessionId || !currentAttr?.id) return;
    if (attrView !== 'detail') return;

    if (!isCurrentAttrDirty()) return;

    hasUnsavedChangesRef.current = true;
    attrAutoSaveTimerRef.current = setTimeout(async () => {
      if (attrSavingRef.current) return;

      setAttrAutoSaving(true);
      setAttrAutoSaved(false);

      try {
        await saveCurrentAttr({ silent: true });

        setAttrAutoSaved(true);
        hasUnsavedChangesRef.current = false;

        clearTimeout(attrAutoSavedTimerRef.current);
        attrAutoSavedTimerRef.current = setTimeout(() => {
          setAttrAutoSaved(false);
        }, 2500);
      } catch (e) {
        showNote('Ошибка автосохранения достопримечательности: ' + parseApiError(e, 'Неизвестная ошибка'), 'error');
      } finally {
        setAttrAutoSaving(false);
      }
    }, 2500);

    return () => {
      clearTimeout(attrAutoSaveTimerRef.current);
    };
  }, [
    sessionId,
    currentAttr,
    attrLocaleData,
    attrView,
    isCurrentAttrDirty,
    saveCurrentAttr,
    showNote,
    hasUnsavedChangesRef,
  ]);

  // ─── updateAttrLocaleField ─────────────────────────────────────────────────
  const updateAttrLocaleField = useCallback((field, value) => {
    setAttrLocaleData(prev => ({
      ...prev,
      [attrActiveLocale]: { ...prev[attrActiveLocale], [field]: value },
    }));
  }, [attrActiveLocale]);

  // ─── updateCurrentAttrPatch ────────────────────────────────────────────────
  const updateCurrentAttrPatch = useCallback((patch) => {
    setCurrentAttr((prev) => {
      if (!prev) return prev;

      const next = normalizeAttraction({
        ...prev,
        ...patch,
      });

      setAttractions((items) =>
        items.map((item) => (item.id === next.id ? next : item))
      );

      return next;
    });
  }, []);

  // ─── persistAttractionImage ────────────────────────────────────────────────
  const persistAttractionImage = useCallback(
    async (patch, { silent = true } = {}) => {
      if (!currentAttr?.id) return null;

      const merged = normalizeAttraction({ ...currentAttr, ...patch });

      setAttractions((prev) =>
        prev.map((item) => (item.id === merged.id ? merged : item)),
      );
      setCurrentAttr(merged);

      setAttrSaving(true);

      try {
        const { name, description } = collectAttrLocaleTexts(attrLocaleData);
        const updated = await attractionsAPI.update(
          sessionId,
          merged.id,
          buildAttractionPayload(merged, name, description),
        );
        const responseAttr = updated?.data?.attraction || updated?.data || {};
        const updatedAttr = normalizeAttraction({
          ...merged,
          ...responseAttr,
          assigned_city_type:
            responseAttr.assigned_city_type ?? merged.assigned_city_type,
          city_id: responseAttr.city_id ?? responseAttr.city ?? merged.city_id,
          city: responseAttr.city_id ?? responseAttr.city ?? merged.city,
          session_city_id:
            responseAttr.session_city_id ??
            responseAttr.session_city ??
            merged.session_city_id,
          session_city:
            responseAttr.session_city_id ??
            responseAttr.session_city ??
            merged.session_city,
          name: responseAttr.name ?? name,
          description: responseAttr.description ?? description,
          image_id:
            responseAttr.image_id ??
            responseAttr.image?.id ??
            merged.image_id ??
            null,
          image_url:
            responseAttr.image_url ??
            responseAttr.image?.url ??
            merged.image_url ??
            merged.imagePreview ??
            null,
          image_original_url:
            responseAttr.image_original_url ??
            responseAttr.imageOriginalUrl ??
            merged.image_original_url ??
            merged.imageOriginalUrl ??
            '',
          image_copyright:
            responseAttr.image_copyright ??
            responseAttr.imageCopyright ??
            merged.image_copyright ??
            merged.imageCopyright ??
            '',
          tags: normalizeTagIds(responseAttr.tags ?? merged.tags ?? []),
        });

        setAttractions((prev) =>
          prev.map((item) => (item.id === merged.id ? updatedAttr : item)),
        );
        setCurrentAttr(updatedAttr);

        await Promise.all(
          Object.values(attrLocaleData).map((d) =>
            attractionsAPI.saveContent(sessionId, merged.id, {
              language: d.lang,
              text: d.contentText || '',
            }),
          ),
        );

        attrSavedSnapshotRef.current = buildAttrPersistSnapshot(
          updatedAttr,
          attrLocaleData,
        );

        if (!silent) {
          showNote('Изображение достопримечательности сохранено', 'success');
        }

        return updatedAttr;
      } catch (e) {
        showNote(
          'Ошибка при сохранении изображения: ' + parseApiError(e, e.message),
          'error',
        );
        throw e;
      } finally {
        setAttrSaving(false);
      }
    },
    [sessionId, currentAttr, attrLocaleData, showNote],
  );

  // ─── toggleCurrentAttractionTag ────────────────────────────────────────────
  const toggleCurrentAttractionTag = useCallback((tagId) => {
    const id = normalizeId(tagId);

    if (!id) return;

    setCurrentAttr((prev) => {
      if (!prev) return prev;

      const current = normalizeTagIds(prev.tags);
      const nextTags = current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id];

      const updated = normalizeAttraction({
        ...prev,
        tags: nextTags,
      });

      setAttractions((items) =>
        items.map((item) =>
          normalizeId(item.id) === normalizeId(updated.id)
            ? updated
            : item
        )
      );

      return updated;
    });
  }, []);

  // ─── openAttractionCommonsModal ────────────────────────────────────────────
  const openAttractionCommonsModal = useCallback((attr) => {
    setCommonsTarget({
      type: 'attraction',
      id: attr?.id ?? null,
    });

    setCommonsModalOpen(true);
  }, [setCommonsTarget, setCommonsModalOpen]);

  // ─── attractionInfoLocaleData computed ──────────────────────────────────────
  const attractionInfoLocaleData = useMemo(() => {
    if (!currentAttractionInfo) return {};

    const assignedType =
      currentAttractionInfo.assigned_attraction_type || 'none';

    let sourceEntries = [];

    if (assignedType === 'draft') {
      const currentInfoAttractionId = normalizeId(
        currentAttractionInfo.session_attraction_id ??
          currentAttractionInfo.session_attraction
      );

      const activeAttractionId = normalizeId(currentAttr?.id);

      if (
        currentInfoAttractionId &&
        activeAttractionId &&
        currentInfoAttractionId === activeAttractionId
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
      } else if (currentInfoAttractionId) {
        const attraction = attractions.find(
          (item) => normalizeId(item.id) === currentInfoAttractionId
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
        currentAttractionInfo.event_id ??
          currentAttractionInfo.event ??
          currentAttractionInfo.attraction_id ??
          currentAttractionInfo.attraction
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
        currentAttractionInfo.name,
        currentAttractionInfo.description
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

        name: currentAttractionInfo.name?.[lang] || '',
        description: currentAttractionInfo.description?.[lang] || '',
      };

      return acc;
    }, {});
  }, [
    currentAttractionInfo,
    currentAttr,
    attrLocaleData,
    attractions,
    referenceAttractions,
  ]);

  useEffect(() => {
    if (!currentAttractionInfo) return;

    const availableKeys = Object.keys(attractionInfoLocaleData || {});

    if (availableKeys.length === 0) return;

    if (!availableKeys.includes(attractionInfoActiveLocale)) {
      setAttractionInfoActiveLocale(availableKeys[0]);
    }
  }, [
    currentAttractionInfo,
    attractionInfoLocaleData,
    attractionInfoActiveLocale,
  ]);

  // ─── getAttractionInfoName ─────────────────────────────────────────────────
  const getAttractionInfoName = useCallback((info) => {
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

  // ─── addAttractionInfo ─────────────────────────────────────────────────────
  const addAttractionInfo = useCallback(async () => {
    try {
      const activeAttractionId = normalizeId(currentAttr?.id);

      const emptyInfo = createEmptyAttractionInfo({
        activeAttractionId,
        sourceLocaleData: attrLocaleData,
      });

      const res = await attractionInfosAPI.create(
        sessionId,
        buildAttractionInfoPayload(emptyInfo)
      );

      const rawInfo = res?.data?.attraction_info || res?.data;
      const info = rawInfo?.id != null ? normalizeAttractionInfo(rawInfo) : null;

      if (info?.id) {
        const localeKeys = Object.keys(attrLocaleData || {});
        const nextActiveLocale =
          localeKeys.includes(attrActiveLocale)
            ? attrActiveLocale
            : localeKeys[0] || 'ru-RU';

        setAttractionInfos((prev) => [...prev, info]);
        setCurrentAttractionInfo(info);
        setAttractionInfoActiveLocale(nextActiveLocale);

        showNote(
          activeAttractionId
            ? 'Блок полезной информации добавлен и привязан к текущей достопримечательности'
            : 'Блок полезной информации о достопримечательности добавлен',
          'success'
        );
      }
    } catch (e) {
      showNote(
        'Ошибка при добавлении полезной информации: ' + parseApiError(e),
        'error'
      );
    }
  }, [
    sessionId,
    currentAttr,
    attrLocaleData,
    attrActiveLocale,
    showNote,
  ]);

  // ─── openAttractionInfoDetail ──────────────────────────────────────────────
  const openAttractionInfoDetail = useCallback((infoId) => {
    const target = attractionInfos.find(
      (info) => normalizeId(info.id) === normalizeId(infoId)
    );

    if (!target) return;

    setCurrentAttractionInfo(target);
    setAttractionInfoActiveLocale('ru-RU');
  }, [attractionInfos]);

  // ─── updateCurrentAttractionInfoPatch ──────────────────────────────────────
  const updateCurrentAttractionInfoPatch = useCallback((patch) => {
    setCurrentAttractionInfo((prev) => {
      if (!prev) return prev;

      const updated = normalizeAttractionInfo({
        ...prev,
        ...patch,
      });

      setAttractionInfos((items) =>
        items.map((item) =>
          normalizeId(item.id) === normalizeId(updated.id) ? updated : item
        )
      );

      return updated;
    });
  }, []);

  // ─── updateAttractionInfoLocaleField ───────────────────────────────────────
  const updateAttractionInfoLocaleField = useCallback((field, value) => {
    const lang =
      attractionInfoLocaleData?.[attractionInfoActiveLocale]?.lang ||
      getLocaleLang(attractionInfoActiveLocale);

    setCurrentAttractionInfo((prev) => {
      if (!prev) return prev;

      const updated = {
        ...prev,
        [field]: {
          ...(prev[field] || {}),
          [lang]: value,
        },
      };

      setAttractionInfos((items) =>
        items.map((item) =>
          normalizeId(item.id) === normalizeId(updated.id) ? updated : item
        )
      );

      return updated;
    });
  }, [
    attractionInfoActiveLocale,
    attractionInfoLocaleData,
  ]);

  // ─── saveCurrentAttractionInfo ─────────────────────────────────────────────
  const saveCurrentAttractionInfo = useCallback(async () => {
    if (!currentAttractionInfo) return;

    const assignedType = currentAttractionInfo.assigned_attraction_type ?? 'none';

    const eventId =
      currentAttractionInfo.event_id ??
      currentAttractionInfo.event ??
      currentAttractionInfo.attraction_id ??
      currentAttractionInfo.attraction ??
      null;

    const sessionAttractionId =
      currentAttractionInfo.session_attraction_id ??
      currentAttractionInfo.session_attraction ??
      null;

    if (assignedType === 'database' && !eventId) {
      showNote('Выберите достопримечательность из базы', 'error');
      return;
    }

    if (assignedType === 'draft' && !sessionAttractionId) {
      showNote('Выберите достопримечательность из сессии', 'error');
      return;
    }

    setAttractionInfoSaving(true);

    try {
      const name = {};
      const description = {};

      Object.values(attractionInfoLocaleData).forEach((d) => {
        if (d.name || d.description) {
          name[d.lang] = d.name || '';
          description[d.lang] = d.description || '';
        }
      });

      const res = await attractionInfosAPI.update(
        sessionId,
        currentAttractionInfo.id,
        buildAttractionInfoPayload(currentAttractionInfo, name, description)
      );

      const responseInfo = res?.data?.attraction_info || res?.data || {};

      const updatedInfo = normalizeAttractionInfo({
        ...currentAttractionInfo,
        ...responseInfo,

        name: responseInfo.name ?? name,
        description: responseInfo.description ?? description,
      });

      setAttractionInfos((prev) =>
        prev.map((item) =>
          normalizeId(item.id) === normalizeId(currentAttractionInfo.id)
            ? updatedInfo
            : item
        )
      );

      setCurrentAttractionInfo(updatedInfo);

      showNote('Полезная информация о достопримечательности сохранена', 'success');
    } catch (e) {
      showNote(
        'Ошибка при сохранении полезной информации: ' + parseApiError(e),
        'error'
      );
    } finally {
      setAttractionInfoSaving(false);
    }
  }, [
    sessionId,
    currentAttractionInfo,
    attractionInfoLocaleData,
    showNote,
  ]);

  // ─── deleteCurrentAttractionInfo ───────────────────────────────────────────
  const deleteCurrentAttractionInfo = useCallback(async () => {
    if (!currentAttractionInfo) return;

    const name = getAttractionInfoName(currentAttractionInfo);

    if (!(await confirm({ message: `Удалить «${name}»?`, danger: true }))) {
      return;
    }

    try {
      await attractionInfosAPI.delete(sessionId, currentAttractionInfo.id);

      setAttractionInfos((items) =>
        items.filter(
          (item) => normalizeId(item.id) !== normalizeId(currentAttractionInfo.id)
        )
      );

      setCurrentAttractionInfo(null);

      showNote('Полезная информация удалена', 'success');
    } catch (e) {
      showNote(
        'Ошибка при удалении полезной информации: ' + parseApiError(e),
        'error'
      );
    }
  }, [
    sessionId,
    currentAttractionInfo,
    getAttractionInfoName,
    confirm,
    showNote,
  ]);

  // ─── buildAttractionFeedLocaleData ─────────────────────────────────────────
  const buildAttractionFeedLocaleData = useCallback(
    (item, previousData = null) => {
      if (!item || item.item_type !== 'text') return {};

      const assignedType = item.assigned_attraction_type || 'none';
      let sourceEntries = [];

      if (assignedType === 'draft') {
        const feedAttrId = normalizeId(
          item.session_attraction_id ?? item.session_attraction
        );
        const activeAttrId = normalizeId(currentAttr?.id);

        if (feedAttrId && activeAttrId && feedAttrId === activeAttrId) {
          sourceEntries = sortLocaleSourceEntries(
            Object.entries(attrLocaleData || {}).filter(([, loc]) => loc?.lang)
          );
        } else if (feedAttrId) {
          const attraction = attractions.find(
            (a) => normalizeId(a.id) === feedAttrId
          );

          const attractionLangKeys = getMultilangKeys(
            attraction?.name,
            attraction?.description,
            attraction?.contents
          );

          sourceEntries = makeLocaleEntriesFromLangKeys(attractionLangKeys);
        }
      } else if (assignedType === 'database') {
        const eventId = normalizeId(
          item.event_id ??
            item.event ??
            item.attraction_id ??
            item.attraction
        );

        const refAttr = referenceAttractions.find(
          (a) => normalizeId(a.id) === eventId
        );

        const attractionLangKeys = getMultilangKeys(
          refAttr?.name,
          refAttr?.title,
          refAttr?.description
        );

        sourceEntries = makeLocaleEntriesFromLangKeys(attractionLangKeys);
      } else if (assignedType === 'none') {
        const ownLangKeys = getMultilangKeys(item.text);

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

        const previousLocaleData = previousData?.[key];

        acc[key] = {
          lang,
          code: locale.code || key?.split('-')?.[1] || '',
          langName: locale.langName || locale.name || lang.toUpperCase(),
          isDefault: Boolean(locale.isDefault),
          isCustom: Boolean(locale.isCustom),

          text:
            item.text?.[lang] ??
            previousLocaleData?.text ??
            '',
        };

        return acc;
      }, {});
    },
    [currentAttr, attrLocaleData, attractions, referenceAttractions]
  );

  // ─── Feed locale data sync ─────────────────────────────────────────────────
  useEffect(() => {
    if (!currentAttractionFeedItem) {
      attractionFeedLocaleDataItemIdRef.current = null;
      setAttractionFeedLocaleData({});
      return;
    }

    if (currentAttractionFeedItem.item_type !== 'text') {
      attractionFeedLocaleDataItemIdRef.current = normalizeId(
        currentAttractionFeedItem.id
      );
      setAttractionFeedLocaleData({});
      return;
    }

    const itemId = normalizeId(currentAttractionFeedItem.id);

    setAttractionFeedLocaleData((prev) => {
      const shouldPreserveValues =
        attractionFeedLocaleDataItemIdRef.current === itemId;

      const next = buildAttractionFeedLocaleData(
        currentAttractionFeedItem,
        shouldPreserveValues ? prev : null
      );

      attractionFeedLocaleDataItemIdRef.current = itemId;

      return next;
    });
  }, [currentAttractionFeedItem, buildAttractionFeedLocaleData]);

  useEffect(() => {
    if (!currentAttractionFeedItem) return;
    if (currentAttractionFeedItem.item_type !== 'text') return;

    const availableKeys = Object.keys(attractionFeedLocaleData || {});

    if (availableKeys.length === 0) return;

    if (!availableKeys.includes(attractionFeedActiveLocale)) {
      setAttractionFeedActiveLocale(availableKeys[0]);
    }
  }, [
    currentAttractionFeedItem,
    attractionFeedLocaleData,
    attractionFeedActiveLocale,
  ]);

  useEffect(() => {
    const id = normalizeId(currentAttractionFeedItem?.id);

    if (!id) {
      currentAttractionFeedItemIdRef.current = null;
      attractionFeedSavedSnapshotRef.current = null;
      return;
    }

    if (currentAttractionFeedItemIdRef.current !== id) {
      currentAttractionFeedItemIdRef.current = id;
      attractionFeedSavedSnapshotRef.current = buildAttractionFeedPersistSnapshot(
        currentAttractionFeedItem,
        attractionFeedLocaleData,
      );
    }
  }, [currentAttractionFeedItem, attractionFeedLocaleData]);

  // ─── getAttractionFeedItemName ─────────────────────────────────────────────
  const getAttractionFeedItemName = useCallback((item) => {
    if (!item) return '(без названия)';

    if (item.item_type === 'image') {
      return item.image_copyright || item.image_original_url || 'Изображение';
    }

    const text = item.text || {};

    if (typeof text === 'string') {
      return text.slice(0, 60) || '(без текста)';
    }

    return (
      text.ru ||
      text.en ||
      text.it ||
      Object.values(text).find(Boolean) ||
      '(без текста)'
    );
  }, []);

  // ─── addAttractionFeedItem ─────────────────────────────────────────────────
  const addAttractionFeedItem = useCallback(async (itemType = 'text') => {
    try {
      const emptyItem = createEmptyAttractionFeedItem(itemType);

      emptyItem.index = attractionFeedItems.length;

      const sessionAttrId = normalizeId(currentAttr?.id);
      if (sessionAttrId) {
        emptyItem.assigned_attraction_type = 'draft';
        emptyItem.session_attraction = sessionAttrId;
        emptyItem.session_attraction_id = sessionAttrId;
        emptyItem.event = null;
        emptyItem.event_id = null;
        emptyItem.attraction = null;
        emptyItem.attraction_id = null;
      } else {
        emptyItem.assigned_attraction_type = 'none';
        emptyItem.session_attraction = null;
        emptyItem.session_attraction_id = null;
        emptyItem.event = null;
        emptyItem.event_id = null;
        emptyItem.attraction = null;
        emptyItem.attraction_id = null;
      }

      const res = await attractionFeedAPI.create(
        sessionId,
        buildAttractionFeedPayload(emptyItem)
      );

      const rawItem = res?.data?.attraction_feed_item || res?.data;
      const item = rawItem?.id != null ? normalizeAttractionFeedItem(rawItem) : null;

      if (item?.id) {
        const nextItemId = normalizeId(item.id);
        if (attractionFeedLocaleDataItemIdRef.current !== nextItemId) {
          attractionFeedLocaleDataItemIdRef.current = null;
        }

        setAttractionFeedItems((prev) => [...prev, item]);
        setCurrentAttractionFeedItem(item);

        showNote('Элемент ленты добавлен', 'success');
      }
    } catch (e) {
      showNote(
        'Ошибка при добавлении элемента ленты: ' + parseApiError(e),
        'error'
      );
    }
  }, [sessionId, attractionFeedItems.length, showNote, currentAttr]);

  // ─── updateAttractionFeedLocaleField ───────────────────────────────────────
  const updateAttractionFeedLocaleField = useCallback((field, value) => {
    const lang =
      attractionFeedLocaleData?.[attractionFeedActiveLocale]?.lang ||
      getLocaleLang(attractionFeedActiveLocale);

    setCurrentAttractionFeedItem((prev) => {
      if (!prev) return prev;

      const prevField =
        prev[field] && typeof prev[field] === 'object' && !Array.isArray(prev[field])
          ? prev[field]
          : {};

      const updated = {
        ...prev,
        [field]: {
          ...prevField,
          [lang]: value,
        },
      };

      setAttractionFeedItems((items) =>
        items.map((item) =>
          normalizeId(item.id) === normalizeId(updated.id) ? updated : item
        )
      );

      return updated;
    });
  }, [attractionFeedActiveLocale, attractionFeedLocaleData]);

  // ─── updateCurrentAttractionFeedItemPatch ──────────────────────────────────
  const updateCurrentAttractionFeedItemPatch = useCallback((patch) => {
    setCurrentAttractionFeedItem((prev) => {
      if (!prev) return prev;

      const updated = normalizeAttractionFeedItem({
        ...prev,
        ...patch,
      });

      setAttractionFeedItems((items) =>
        items.map((item) =>
          normalizeId(item.id) === normalizeId(updated.id) ? updated : item
        )
      );

      return updated;
    });
  }, []);

  // ─── saveCurrentAttractionFeedItem ─────────────────────────────────────────
  const saveCurrentAttractionFeedItem = useCallback(
    async ({ silent = false } = {}) => {
      if (!currentAttractionFeedItem) return null;

      const assignedType = currentAttractionFeedItem.assigned_attraction_type ?? 'none';

      const eventId =
        currentAttractionFeedItem.event_id ??
        currentAttractionFeedItem.event ??
        currentAttractionFeedItem.attraction_id ??
        currentAttractionFeedItem.attraction ??
        null;

      const sessionAttractionId =
        currentAttractionFeedItem.session_attraction_id ??
        currentAttractionFeedItem.session_attraction ??
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

      if (
        currentAttractionFeedItem.item_type === 'image' &&
        !currentAttractionFeedItem.image_id
      ) {
        if (!silent) {
          showNote('Добавьте изображение для элемента ленты', 'error');
        }
        throw new Error('missing-feed-image');
      }

      setAttractionFeedSaving(true);

      try {
        const text =
          currentAttractionFeedItem.item_type === 'text'
            ? collectAttractionFeedLocaleTexts(attractionFeedLocaleData)
            : {};

        const res = await attractionFeedAPI.update(
          sessionId,
          currentAttractionFeedItem.id,
          buildAttractionFeedPayload(currentAttractionFeedItem, text),
        );

        const responseItem = res?.data?.attraction_feed_item || res?.data || {};

        const updatedItem = normalizeAttractionFeedItem({
          ...currentAttractionFeedItem,
          ...responseItem,
          text: responseItem.text ?? text,
        });

        setAttractionFeedItems((prev) =>
          prev.map((item) =>
            normalizeId(item.id) === normalizeId(currentAttractionFeedItem.id)
              ? updatedItem
              : item,
          ),
        );

        setCurrentAttractionFeedItem(updatedItem);

        attractionFeedSavedSnapshotRef.current = buildAttractionFeedPersistSnapshot(
          updatedItem,
          attractionFeedLocaleData,
        );

        if (!silent) {
          showNote('Элемент ленты сохранён', 'success');
        }

        return updatedItem;
      } catch (e) {
        if (!silent) {
          showNote(
            'Ошибка при сохранении элемента ленты: ' + parseApiError(e),
            'error',
          );
        }
        throw e;
      } finally {
        setAttractionFeedSaving(false);
      }
    },
    [
      sessionId,
      currentAttractionFeedItem,
      attractionFeedLocaleData,
      showNote,
    ],
  );

  // ─── isCurrentAttractionFeedItemDirty ──────────────────────────────────────
  const isCurrentAttractionFeedItemDirty = useCallback(() => {
    if (!currentAttractionFeedItem?.id) return false;

    const snap = buildAttractionFeedPersistSnapshot(
      currentAttractionFeedItem,
      attractionFeedLocaleData,
    );

    return snap !== attractionFeedSavedSnapshotRef.current;
  }, [currentAttractionFeedItem, attractionFeedLocaleData]);

  // ─── saveCurrentAttractionFeedItemIfDirty ──────────────────────────────────
  const saveCurrentAttractionFeedItemIfDirty = useCallback(
    async (options = {}) => {
      if (
        !currentAttractionFeedItem?.id ||
        !isCurrentAttractionFeedItemDirty()
      ) {
        return true;
      }

      await saveCurrentAttractionFeedItem(options);
      return true;
    },
    [
      currentAttractionFeedItem,
      isCurrentAttractionFeedItemDirty,
      saveCurrentAttractionFeedItem,
    ],
  );

  // ─── Auto-save for feed item ───────────────────────────────────────────────
  useEffect(() => {
    clearTimeout(attractionFeedAutoSaveTimerRef.current);

    if (!sessionId || !currentAttractionFeedItem?.id) return;

    if (!isCurrentAttractionFeedItemDirty()) return;

    attractionFeedAutoSaveTimerRef.current = setTimeout(async () => {
      if (
        attractionFeedSavingRef.current ||
        attractionFeedPhotoUploadingRef.current
      ) {
        return;
      }

      setAttractionFeedAutoSaving(true);
      setAttractionFeedAutoSaved(false);

      try {
        await saveCurrentAttractionFeedItem({ silent: true });

        setAttractionFeedAutoSaved(true);

        clearTimeout(attractionFeedAutoSavedTimerRef.current);
        attractionFeedAutoSavedTimerRef.current = setTimeout(() => {
          setAttractionFeedAutoSaved(false);
        }, 2500);
      } catch (e) {
        showNote('Ошибка автосохранения ленты: ' + parseApiError(e, 'Неизвестная ошибка'), 'error');
      } finally {
        setAttractionFeedAutoSaving(false);
      }
    }, 2500);

    return () => {
      clearTimeout(attractionFeedAutoSaveTimerRef.current);
    };
  }, [
    sessionId,
    currentAttractionFeedItem,
    attractionFeedLocaleData,
    isCurrentAttractionFeedItemDirty,
    saveCurrentAttractionFeedItem,
    showNote,
  ]);

  // ─── openAttractionFeedItemDetail ──────────────────────────────────────────
  const openAttractionFeedItemDetail = useCallback(
    async (itemId) => {
      const currentId = normalizeId(currentAttractionFeedItem?.id);
      const nextId = normalizeId(itemId);

      if (currentId && nextId && currentId !== nextId) {
        try {
          await saveCurrentAttractionFeedItemIfDirty({ silent: true });
        } catch {
          return;
        }
      }

      const target = attractionFeedItems.find(
        (item) => normalizeId(item.id) === nextId,
      );

      if (!target) return;

      if (attractionFeedLocaleDataItemIdRef.current !== nextId) {
        attractionFeedLocaleDataItemIdRef.current = null;
      }

      setCurrentAttractionFeedItem(target);
    },
    [
      attractionFeedItems,
      currentAttractionFeedItem,
      saveCurrentAttractionFeedItemIfDirty,
    ],
  );

  // ─── deleteCurrentAttractionFeedItem ───────────────────────────────────────
  const deleteCurrentAttractionFeedItem = useCallback(async () => {
    if (!currentAttractionFeedItem) return;

    const name = getAttractionFeedItemName(currentAttractionFeedItem);

    if (!(await confirm({ message: `Удалить «${name}»?`, danger: true }))) {
      return;
    }

    try {
      await attractionFeedAPI.delete(sessionId, currentAttractionFeedItem.id);

      setAttractionFeedItems((items) =>
        items.filter(
          (item) => normalizeId(item.id) !== normalizeId(currentAttractionFeedItem.id)
        )
      );

      setCurrentAttractionFeedItem(null);

      showNote('Элемент ленты удалён', 'success');
    } catch (e) {
      showNote(
        'Ошибка при удалении элемента ленты: ' + parseApiError(e),
        'error'
      );
    }
  }, [
    sessionId,
    currentAttractionFeedItem,
    getAttractionFeedItemName,
    confirm,
    showNote,
  ]);

  // ─── handleAttractionFeedPhotoFile ─────────────────────────────────────────
  const handleAttractionFeedPhotoFile = useCallback(async (event, itemArg = null) => {
    const file = event.target.files?.[0];

    if (!file || !file.type.startsWith('image/')) return;

    event.target.value = '';

    const targetItem = itemArg || currentAttractionFeedItem;

    if (!targetItem) return;

    setAttractionFeedPhotoUploading(true);

    try {
      const fd = new FormData();

      fd.append('file', file);
      fd.append('session_uuid', getSessionUuid() || '');
      fd.append('temp', '1');

      const copyright =
        targetItem.image_copyright ||
        targetItem.imageCopyright ||
        '';

      if (copyright) {
        fd.append('copyright', copyright);
      }

      const res = await imagesAPI.upload(fd);
      const { id, url, copyright: uploadedCopyright } = res?.data || {};

      if (id && url) {
        const patch = {
          item_type: 'image',

          image_id: id,
          image: id,

          image_url: url,
          imageUrl: url,

          image_original_url: '',
          imageOriginalUrl: '',

          image_copyright:
            uploadedCopyright != null
              ? uploadedCopyright || ''
              : copyright,
          imageCopyright:
            uploadedCopyright != null
              ? uploadedCopyright || ''
              : copyright,

          text: {},
        };

        updateCurrentAttractionFeedItemPatch(patch);

        showNote('Изображение ленты загружено', 'success');
      }
    } catch (err) {
      showNote(
        'Ошибка загрузки изображения ленты: ' + parseApiError(err, 'Ошибка загрузки'),
        'error'
      );
    } finally {
      setAttractionFeedPhotoUploading(false);
    }
  }, [
    getSessionUuid,
    currentAttractionFeedItem,
    updateCurrentAttractionFeedItemPatch,
    showNote,
  ]);

  // ─── openAttractionFeedCommonsModal ────────────────────────────────────────
  const openAttractionFeedCommonsModal = useCallback((item) => {
    setCommonsTarget({
      type: 'attraction_feed',
      id: item?.id ?? null,
    });

    setCommonsModalOpen(true);
  }, [setCommonsTarget, setCommonsModalOpen]);

  // ─── Attraction generation functions ───────────────────────────────────────
  const openAttractionGenerationModal = useCallback(() => {
    attractionGenPollCancelledRef.current = false;
    setAttractionGenerationError('');
    setAttractionGenerationPrompt('');
    setAttractionGenerationTaskId(null);

    const draftId = normalizeDraftId(activeCityDraftIdRef.current);
    if (draftId && draftId !== 'legacy') {
      setAttractionGenerationAssignedCityType('draft');
      setAttractionGenerationSessionCityId(draftId);
      setAttractionGenerationDatabaseCityId('');
    } else {
      setAttractionGenerationAssignedCityType('none');
      setAttractionGenerationSessionCityId('');
      setAttractionGenerationDatabaseCityId('');
    }

    const resolveDefaultAiLang = () => {
      const entries = Object.values(localeData || {});
      if (entries.length > 0) {
        const locLang = (entries[0]?.lang || '').trim().toLowerCase();
        if (locLang) {
          const base = locLang.split('-')[0];
          return base || 'ru';
        }
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
    };

    setAttractionGenerationLang(resolveDefaultAiLang());
    setAttractionGenerationOpen(true);
  }, [localeData, cityDrafts, activeCityDraftIdRef]);

  const closeAttractionGenerationModal = useCallback(() => {
    attractionGenPollCancelledRef.current = true;
    attractionGenInFlightRef.current = false;
    setAttractionGenerationOpen(false);
    setAttractionGenerating(false);
    setAttractionGenerationTaskId(null);
    setAttractionGenerationError('');
  }, []);

  const setAttractionGenerationAssignedCityTypeSafe = useCallback((value) => {
    setAttractionGenerationAssignedCityType(value);
    if (value !== 'draft') {
      setAttractionGenerationSessionCityId('');
    }
    if (value !== 'database') {
      setAttractionGenerationDatabaseCityId('');
    }
  }, []);

  const generateAttractionsFromPrompt = useCallback(async () => {
    if (attractionGenerating || attractionGenInFlightRef.current) return;

    const prompt = attractionGenerationPrompt.trim();
    if (!prompt) {
      setAttractionGenerationError('Введите запрос');
      return;
    }

    const assigned_city_type = attractionGenerationAssignedCityType || 'none';
    let session_city_id = null;
    let city_id = null;

    const activeDraftId = normalizeDraftId(activeCityDraftIdRef.current);
    if (assigned_city_type === 'draft') {
      const sid = normalizeDraftId(attractionGenerationSessionCityId) || activeDraftId;
      if (!sid || sid === 'legacy') {
        setAttractionGenerationError('Выберите город сессии');
        return;
      }
      session_city_id = sid;
    } else if (assigned_city_type === 'database') {
      const cid = (attractionGenerationDatabaseCityId || '').trim();
      if (!cid) {
        setAttractionGenerationError('Выберите город из базы');
        return;
      }
      city_id = cid;
    } else if (activeDraftId && activeDraftId !== 'legacy') {
      session_city_id = activeDraftId;
    }

    const langRaw = (attractionGenerationLang || 'ru').trim().toLowerCase();
    const lang = (langRaw.split('-')[0] || 'ru').slice(0, 8) || 'ru';

    attractionGenPollCancelledRef.current = false;
    attractionGenInFlightRef.current = true;
    setAttractionGenerating(true);
    setAttractionGenerationError('');
    setAttractionGenerationTaskId(null);

    try {
      const startRes = await aiAPI.attractionsJsonStart({
        session_id: sessionId,
        prompt,
        requested_count: clampGenerationCount(attractionGenerationCount, 'attractions'),
        dedupe_existing_items: attractionDedupeExistingItems,
        lang,
        assigned_city_type: session_city_id
          ? 'draft'
          : city_id
            ? 'database'
            : 'none',
        session_city_id: session_city_id || null,
        city_id: city_id || null,
        ...buildGenerationPayloadFields(aiGenerationMode, aiUseWebSearch),
      });
      const taskId = startRes?.data?.task_id;
      if (!taskId) {
        throw new Error('Сервер не вернул task_id');
      }
      setAttractionGenerationTaskId(taskId);

      await pollGenerationTask(taskId, {
        tasksAPI,
        maxWaitMs: 20 * 60 * 1000,
        isCancelled: () => attractionGenPollCancelledRef.current,
        onProgress: (task) => {
          setAttractionGenerationProgress({
            status: task?.status,
            progress: task?.progress || 0,
            step: task?.current_step || '',
          });
        },
      });

      if (attractionGenPollCancelledRef.current) {
        return;
      }

      const createRes = await aiAPI.attractionsCreateFromTask(taskId, {
        session_id: sessionId,
        dedupe_existing_items: attractionDedupeExistingItems,
      });
      const createData = createRes?.data || {};
      if (createData.success === false) {
        throw new Error(createData.error || 'Не удалось добавить достопримечательности в сессию');
      }

      const createdList = (createData.attractions || []).map(normalizeAttraction);
      if (createdList.length > 0) {
        setAttractions((prev) => {
          const existingIds = new Set(prev.map((item) => String(item.id)));
          const toAdd = createdList.filter(
            (item) => item.id && !existingIds.has(String(item.id)),
          );
          return toAdd.length > 0 ? [...prev, ...toAdd] : prev;
        });
      }

      const n =
        typeof createData.created_count === 'number'
          ? createData.created_count
          : createdList.length;

      const keepDraft = normalizeDraftId(activeCityDraftIdRef.current);
      await reloadAttractionsFromServer();
      await loadSession(keepDraft);

      if (!attractionGenPollCancelledRef.current) {
        if (createData.partial && createData.warning) {
          showNote(createData.warning, 'warning');
        }
        showNote(
          formatGenerationDedupeResultMessage(createData, { dedupeField: 'dedupe_existing_items' })
            || `Сгенерировано достопримечательностей: ${n}`,
          createData.partial ? 'warning' : 'success',
        );
        setAttractionGenerationOpen(false);
        setAttractionGenerationPrompt('');
        setAttractionGenerationTaskId(null);
      }
    } catch (e) {
      if (!attractionGenPollCancelledRef.current && !isPollCancelledError(e)) {
        const msg = e?.message || parseApiError(e, TASK_NOT_FOUND_MESSAGE);
        setAttractionGenerationError(msg);
        showNote(msg, 'error');
      }
      setAttractionGenerationTaskId(null);
    } finally {
      attractionGenInFlightRef.current = false;
      setAttractionGenerating(false);
    }
  }, [
    sessionId,
    attractionGenerationPrompt,
    attractionGenerationAssignedCityType,
    attractionGenerationSessionCityId,
    attractionGenerationDatabaseCityId,
    attractionGenerationLang,
    attractionGenerationCount,
    attractionDedupeExistingItems,
    aiGenerationMode,
    aiUseWebSearch,
    loadSession,
    showNote,
    activeCityDraftIdRef,
    reloadAttractionsFromServer,
  ]);

  // ─── Return ────────────────────────────────────────────────────────────────
  return {
    attractions,
    currentAttr,
    attrView,
    attrLocaleData,
    attrActiveLocale,
    attrSaving,
    attrAutoSaving,
    attrAutoSaved,
    attractionsLoaded,
    attrLocaleDataAttractionIdRef,
    attrSavedSnapshotRef,
    attrSavingRef,
    attrAutoSaveTimerRef,
    attrAutoSavedTimerRef,

    attractionInfos,
    currentAttractionInfo,
    attractionInfoLocaleData,
    attractionInfoActiveLocale,
    attractionInfoSaving,

    attractionFeedItems,
    currentAttractionFeedItem,
    attractionFeedLocaleData,
    attractionFeedActiveLocale,
    attractionFeedSaving,
    attractionFeedAutoSaving,
    attractionFeedAutoSaved,
    attractionFeedPhotoUploading,
    attractionFeedPhotoFileRef,
    attractionFeedSavedSnapshotRef,
    currentAttractionFeedItemIdRef,
    attractionFeedAutoSaveTimerRef,
    attractionFeedAutoSavedTimerRef,
    attractionFeedSavingRef,
    attractionFeedPhotoUploadingRef,
    attractionFeedLocaleDataItemIdRef,

    attractionGenerationOpen,
    attractionGenerationPrompt,
    attractionGenerating,
    attractionGenerationTaskId,
    attractionGenerationProgress,
    attractionGenerationError,
    attractionGenerationAssignedCityType,
    attractionGenerationSessionCityId,
    attractionGenerationDatabaseCityId,
    attractionGenerationLang,
    attractionGenerationCount,
    attractionDedupeExistingItems,
    attractionGenPollCancelledRef,
    attractionGenInFlightRef,

    setAttrView,
    setCurrentAttr,
    setAttrActiveLocale,
    setAttractions,

    setCurrentAttractionInfo,
    setAttractionInfoActiveLocale,

    setCurrentAttractionFeedItem,
    setAttractionFeedActiveLocale,

    setAttractionGenerationOpen,
    setAttractionGenerationPrompt,
    setAttractionGenerationAssignedCityType,
    setAttractionGenerationSessionCityId,
    setAttractionGenerationDatabaseCityId,
    setAttractionGenerationLang,
    setAttractionGenerationCount,
    setAttractionDedupeExistingItems,

    buildAttrLocaleData,
    openAttrDetail,
    addAttraction,
    deleteCurrentAttr,
    saveCurrentAttr,
    saveCurrentAttrIfDirty,
    isCurrentAttrDirty,
    updateAttrLocaleField,
    updateCurrentAttrPatch,
    persistAttractionImage,
    toggleCurrentAttractionTag,
    openAttractionCommonsModal,

    addAttractionInfo,
    openAttractionInfoDetail,
    deleteCurrentAttractionInfo,
    updateCurrentAttractionInfoPatch,
    updateAttractionInfoLocaleField,
    saveCurrentAttractionInfo,
    getAttractionInfoName,

    addAttractionFeedItem,
    openAttractionFeedItemDetail,
    deleteCurrentAttractionFeedItem,
    saveCurrentAttractionFeedItem,
    saveCurrentAttractionFeedItemIfDirty,
    isCurrentAttractionFeedItemDirty,
    updateCurrentAttractionFeedItemPatch,
    updateAttractionFeedLocaleField,
    handleAttractionFeedPhotoFile,
    getAttractionFeedItemName,
    openAttractionFeedCommonsModal,

    openAttractionGenerationModal,
    closeAttractionGenerationModal,
    setAttractionGenerationAssignedCityTypeSafe,
    generateAttractionsFromPrompt,

    reloadAttractionsFromServer,
  };
}
