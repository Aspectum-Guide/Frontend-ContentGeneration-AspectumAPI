import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { aiAPI, tasksAPI, attractionsAPI, attractionInfosAPI, referenceAttractionsAPI, cityInfosAPI, cityFiltersAPI, eventFiltersAPI, citiesAPI, imagesAPI, sessionsAPI, attractionFeedAPI} from '../../../api/generation';
import { useLayoutActions } from '../../../context/useLayoutActions';
import { trackEvent } from '../../../utils/analytics';
import { parseApiError } from '../../../utils/apiError';
import { removeFilterIdsFromTree } from '../../../features/catalog/shared/normalize';
import { useToast } from '../../../components/ui/Toast.jsx';
import { DEFAULT_LOCALE_DEFS, getLocaleInfo } from './sessionWizardShared.jsx';

const TOTAL_STEPS = 4;

function makeLocaleData() {
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
}

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

    // legacy aliases для UI, если где-то ещё используется attraction
    attraction: eventId,
    attraction_id: eventId,

    session_attraction: sessionAttractionId,
    session_attraction_id: sessionAttractionId,

    assigned_attraction_type: assignedAttractionType,
    assigned_attraction_name: info.assigned_attraction_name ?? null,
  };
};

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

  return {
    ...attr,

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

    image_id: attr.image_id ?? attr.image?.id ?? attr.image ?? null,

    image_url:
      attr.image_url ??
      attr.imageUrl ??
      attr.localUrl ??
      attr.local_url ??
      attr.image?.url ??
      attr.image?.file ??
      null,

    image_original_url:
      attr.image_original_url ??
      attr.imageOriginalUrl ??
      attr.original_image_url ??
      attr.originalImageUrl ??
      attr.image?.original_url ??
      attr.image?.source_url ??
      null,

    image_copyright:
      attr.image_copyright ??
      attr.imageCopyright ??
      attr.copyright ??
      attr.image?.copyright ??
      null,

    contents: attr.contents ?? {},

    tags: normalizeTagIds(attr.tags ?? []),
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

    // legacy aliases для UI
    attraction: eventId,
    attraction_id: eventId,

    session_attraction: sessionAttractionId,
    session_attraction_id: sessionAttractionId,

    assigned_attraction_type: assignedAttractionType,
    assigned_attraction_name: item.assigned_attraction_name ?? null,

    isNew: item.isNew ?? false,
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

    // legacy aliases, можно оставить для совместимости
    attraction: event,
    attraction_id: event,

    session_attraction: sessionAttraction,
    session_attraction_id: sessionAttraction,
  };
};

const buildAttractionPayload = (attr, name, description) => {
  const assignedType = attr.assigned_city_type ?? 'none';

  let city = null;
  let sessionCity = null;

  if (assignedType === 'database') {
    city = attr.city_id ?? attr.city ?? null;
  }

  if (assignedType === 'draft') {
    sessionCity = attr.session_city_id ?? attr.session_city ?? null;
  }

  const index = Number(attr.index ?? attr.order ?? 0);

  return {
    name: name ?? attr.name ?? {},
    description: description ?? attr.description ?? {},

    lat: attr.lat === '' ? null : attr.lat,
    lon: attr.lon === '' ? null : attr.lon,

    index,
    rank: Number(attr.rank ?? 0),

    city,
    session_city: sessionCity,

    image_id: attr.image_id ?? null,
    image_original_url: attr.image_original_url ?? attr.imageOriginalUrl ?? '',
    image_copyright: attr.image_copyright ?? attr.imageCopyright ?? '',

    // legacy compatibility
    order: index,

    tags: normalizeTagIds(attr.tags ?? []),
  };
};

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

function normalizeDraftId(value) {
  if (value == null || value === '') return null;
  return String(value);
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

function getAttrName(attr) {
  const name = attr?.name || {};
  return name.ru || name.en || name.it || Object.values(name).find(Boolean) || '(без названия)';
}

const normalizeId = (value) => {
  if (value == null) return '';

  if (typeof value === 'object') {
    return String(value.id ?? value.uuid ?? value.pk ?? '');
  }

  return String(value);
};

const normalizeTagIds = (value) => {
  if (!Array.isArray(value)) return [];

  return [...new Set(
    value
      .map((item) => {
        if (item == null) return '';

        if (typeof item === 'object') {
          return String(item.id ?? item.uuid ?? item.pk ?? '');
        }

        return String(item);
      })
      .filter(Boolean)
  )];
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

/** Список черновиков из ответа GET сессии (до overlay). */
function normalizeServerCityDraftsFromSessionData(data) {
  if (!data || typeof data !== 'object') return [];

  if (Array.isArray(data.city_drafts) && data.city_drafts.length > 0) {
    return data.city_drafts.map((draft) => ({
      ...draft,
      tags: normalizeTagIds(draft.tags ?? draft.city_tags ?? []),
    }));
  }

  if (data.city) {
    return [
      {
        ...data.city,
        id: 'legacy',
        is_primary: true,
        order: 0,
        tags: normalizeTagIds(data.city.tags ?? data.city.city_tags ?? []),
      },
    ];
  }

  return [];
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

const createEmptyAttractionInfo = ({
  activeAttractionId = null,
  sourceLocaleData = null,
} = {}) => {
  const normalizedAttractionId = normalizeId(activeAttractionId);
  const shouldAttachToDraft = Boolean(normalizedAttractionId);

  return {
    id: `attraction-info-${Date.now()}`,

    name: makeEmptyLocaleObject(sourceLocaleData),
    description: makeEmptyLocaleObject(sourceLocaleData),

    assigned_attraction_type: shouldAttachToDraft ? 'draft' : 'none',

    attraction: null,
    attraction_id: null,

    session_attraction: shouldAttachToDraft ? normalizedAttractionId : null,
    session_attraction_id: shouldAttachToDraft ? normalizedAttractionId : null,

    isNew: true,
  };
};

const createEmptyAttractionFeedItem = (itemType = 'text') => {
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

    // aliases
    attraction: event,
    attraction_id: event,

    session_attraction: sessionAttraction,
    session_attraction_id: sessionAttraction,
  };
};

function extractReferenceCities(data) {
  if (Array.isArray(data)) return data;

  if (Array.isArray(data?.cities)) return data.cities;
  if (Array.isArray(data?.results)) return data.results;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.data)) return data.data;

  if (Array.isArray(data?.data?.cities)) return data.data.cities;
  if (Array.isArray(data?.data?.results)) return data.data.results;
  if (Array.isArray(data?.data?.items)) return data.data.items;

  return [];
}

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

function getAttractionLocaleSourceEntries(
  attr = {},
  { localeData, cityDrafts, referenceCities, activeCityDraftIdRef }
) {
  const assignedType = attr.assigned_city_type || 'none';

  let sourceEntries = [];

  if (assignedType === 'draft') {
    const attrDraftCityId = normalizeDraftId(
      attr.session_city_id ?? attr.session_city
    );

    const activeDraftId = normalizeDraftId(activeCityDraftIdRef?.current);

    if (
      attrDraftCityId &&
      activeDraftId &&
      attrDraftCityId === activeDraftId
    ) {
      sourceEntries = sortLocaleSourceEntries(
        Object.entries(localeData || {}).filter(([, loc]) => loc?.lang)
      );
    } else if (attrDraftCityId) {
      const draft = cityDrafts.find(
        (item) => normalizeDraftId(item.id) === attrDraftCityId
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
    const cityId = normalizeId(attr.city_id ?? attr.city);

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
      attr.name,
      attr.description,
      attr.contents
    );

    sourceEntries = makeLocaleEntriesFromLangKeys(ownLangKeys);
  }

  if (sourceEntries.length === 0) {
    sourceEntries = DEFAULT_LOCALE_DEFS.map((locale) => [locale.key, locale]);
  }

  return sourceEntries;
}

export function useSessionWizardController({ sessionId, confirm: confirmProp } = {}) {
  const { setMobileActions } = useLayoutActions();
  const navigate = useNavigate();
  const location = useLocation();

  const { note, showNote } = useToast();

  const defaultConfirm = useCallback((opts) => {
    const message = typeof opts === 'string' ? opts : (opts?.message ?? '');
    if (typeof window === 'undefined') return Promise.resolve(false);
    return Promise.resolve(window.confirm(message));
  }, []);

  const confirm = confirmProp ?? defaultConfirm;

  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cityDrafts, setCityDrafts] = useState([]);
  const [activeCityDraftId, setActiveCityDraftId] = useState(null);
  const [referenceCities, setReferenceCities] = useState([]);
  const [referenceAttractions, setReferenceAttractions] = useState([]);
  const activeCityDraftIdRef = useRef(null);
  const requestedCityDraftIdRef = useRef(null);

  const [currentStep, setCurrentStep] = useState(1);
  const [localeData, setLocaleData] = useState(makeLocaleData);
  const [activeLocale, setActiveLocale] = useState('ru-RU');
  const [defaultLocale, setDefaultLocale] = useState('ru-RU');
  const [addLocaleOpen, setAddLocaleOpen] = useState(false);
  const [newLocaleCode, setNewLocaleCode] = useState('');
  const [newLocaleLang, setNewLocaleLang] = useState('');

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
  const [deletingCityFilterIds, setDeletingCityFilterIds] = useState(() => new Set());
  const [deletingEventFilterIds, setDeletingEventFilterIds] = useState(() => new Set());

  const [attractions, setAttractions] = useState([]);
  const [attrView, setAttrView] = useState('list');
  const [currentAttr, setCurrentAttr] = useState(null);
  const [attrLocaleData, setAttrLocaleData] = useState({});
  const [attrActiveLocale, setAttrActiveLocale] = useState('ru-RU');
  const [attrSaving, setAttrSaving] = useState(false);
  const [attractionsLoaded, setAttractionsLoaded] = useState(false);
  const attrLocaleDataAttractionIdRef = useRef(null);

  const [attractionInfos, setAttractionInfos] = useState([]);
  const [currentAttractionInfo, setCurrentAttractionInfo] = useState(null);
  const [attractionInfoActiveLocale, setAttractionInfoActiveLocale] = useState('ru-RU');
  const [attractionInfoSaving, setAttractionInfoSaving] = useState(false);

  const [attractionFeedItems, setAttractionFeedItems] = useState([]);
  const [currentAttractionFeedItem, setCurrentAttractionFeedItem] = useState(null);
  const [attractionFeedLocaleData, setAttractionFeedLocaleData] = useState({});
  const [attractionFeedActiveLocale, setAttractionFeedActiveLocale] = useState('ru-RU');
  const [attractionFeedSaving, setAttractionFeedSaving] = useState(false);
  const [attractionFeedPhotoUploading, setAttractionFeedPhotoUploading] = useState(false);
  const attractionFeedPhotoFileRef = useRef(null);
  const attractionFeedLocaleDataItemIdRef = useRef(null);

  const [cityInfos, setCityInfos] = useState([]);
  const [currentCityInfo, setCurrentCityInfo] = useState(null);
  const [cityInfoActiveLocale, setCityInfoActiveLocale] = useState('ru-RU');
  const [cityInfoSaving, setCityInfoSaving] = useState(false);

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
        // Блок привязан к той достопримечательности,
        // которая сейчас открыта в форме.
        // Берём живые языки формы достопримечательности.
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
        // Блок привязан к другой достопримечательности из сессии.
        // Не берём языки текущей открытой достопримечательности.
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
      // Если блок не привязан — он не должен брать языки текущей достопримечательности.
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

  const [attractionGenerationOpen, setAttractionGenerationOpen] = useState(false);
  const [attractionGenerationPrompt, setAttractionGenerationPrompt] = useState('');
  const [attractionGenerating, setAttractionGenerating] = useState(false);
  const [attractionGenerationTaskId, setAttractionGenerationTaskId] = useState(null);
  const [attractionGenerationError, setAttractionGenerationError] = useState('');
  const [attractionGenerationAssignedCityType, setAttractionGenerationAssignedCityType] =
    useState('none');
  const [attractionGenerationSessionCityId, setAttractionGenerationSessionCityId] = useState('');
  const [attractionGenerationDatabaseCityId, setAttractionGenerationDatabaseCityId] = useState('');
  const [attractionGenerationLang, setAttractionGenerationLang] = useState('ru');
  const attractionGenPollCancelledRef = useRef(false);
  const loadSessionSeqRef = useRef(0);
  const localCreatedCityDraftsRef = useRef(new Map());
  const localDeletedCityDraftIdsRef = useRef(new Set());

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

  const reconcileCityDraftsWithLocalOverlay = useCallback((serverDrafts) => {
    const deletedIds = localDeletedCityDraftIdsRef.current;
    const createdDrafts = localCreatedCityDraftsRef.current;

    const arr = Array.isArray(serverDrafts) ? serverDrafts : [];
    const legacyRows = arr.filter((d) => normalizeDraftId(d?.id) === 'legacy');
    const nonLegacy = arr.filter((d) => normalizeDraftId(d?.id) !== 'legacy');

    let next = nonLegacy
      .filter((draft) => !deletedIds.has(normalizeDraftId(draft?.id)))
      .map((draft) => normalizeCityDraft(draft))
      .filter(Boolean);

    const serverIds = new Set(next.map((draft) => normalizeDraftId(draft.id)));

    for (const draftId of Array.from(createdDrafts.keys())) {
      if (serverIds.has(draftId)) {
        createdDrafts.delete(draftId);
      }
    }

    for (const [draftId, draft] of createdDrafts.entries()) {
      if (!deletedIds.has(draftId) && !serverIds.has(draftId)) {
        next = upsertCityDraft(next, draft);
      }
    }

    const sortFn = (a, b) => {
      const orderA = Number.isFinite(Number(a?.order)) ? Number(a.order) : 0;
      const orderB = Number.isFinite(Number(b?.order)) ? Number(b.order) : 0;

      if (orderA !== orderB) return orderA - orderB;

      return String(a?.created_at || '').localeCompare(String(b?.created_at || ''));
    };

    next.sort(sortFn);

    const legacyNorm = legacyRows
      .map((d) => normalizeCityDraft(d))
      .filter(Boolean);
    legacyNorm.sort(sortFn);

    return [...legacyNorm, ...next].sort(sortFn);
  }, []);

  const [saving, setSaving] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [closeMode, setCloseMode] = useState('save');
  const [closing, setClosing] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [translating, setTranslating] = useState(false);
  const sessionOpenedAtRef = useRef(null);
  const firstCitySaveAtRef = useRef(null);

  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  const mapReadyRef = useRef(false);
  const [mapNode, setMapNode] = useState(null);
  const setMapContainerRef = useCallback((node) => {
    mapRef.current = node;
    setMapNode(node);
  }, []);

  useEffect(() => {
    activeCityDraftIdRef.current = activeCityDraftId;
  }, [activeCityDraftId]);

  useEffect(() => {
    const routeDraftId = new URLSearchParams(location.search).get('cityDraftId');
    requestedCityDraftIdRef.current = normalizeDraftId(routeDraftId || location.state?.cityDraftId);
  }, [location.search, location.state]);

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
  }, []);

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

    const newLocale = makeLocaleData();
    const allKeys = [...new Set([...Object.keys(nameObj), ...Object.keys(descObj), ...Object.keys(countryObj)])];

    allKeys.forEach((rawKey) => {
      const lang = (rawKey.includes('-') ? rawKey.split('-')[0] : rawKey).toLowerCase().substring(0, 2);
      const info = getLocaleInfo(lang);
      const key = `${lang}-${info.code}`;

      if (!newLocale[key]) {
        newLocale[key] = {
          code: info.code,
          lang,
          langName: info.name,
          isDefault: false,
          name: '',
          description: '',
          country: '',
        };
      }

      const resolve = (obj) => {
        const value = obj[key] ?? obj[lang] ?? obj[rawKey] ?? '';
        return typeof value === 'string' ? value : (value?.text || '');
      };

      newLocale[key].name = resolve(nameObj);
      newLocale[key].description = resolve(descObj);
      newLocale[key].country = resolve(countryObj);
    });

    setLocaleData(newLocale);

    const pref = newLocale['ru-RU'] ? 'ru-RU' : Object.keys(newLocale)[0] || 'ru-RU';

    setDefaultLocale(pref);
    setActiveLocale(pref);
  }, []);

  const loadSession = useCallback(async (preferredDraftId = null, options = {}) => {
    const { silent = false, force = false } = options;
    const seq = ++loadSessionSeqRef.current;

    try {
      if (!silent) setLoading(true);
      const res = await sessionsAPI.get(
        sessionId,
        force ? { skipApiGetCache: true } : {}
      );

      if (seq !== loadSessionSeqRef.current && !force) {
        return;
      }

      const data = res?.data;
      setSession(data);
      if (!sessionOpenedAtRef.current) {
        sessionOpenedAtRef.current = Date.now();
        trackEvent('open_session', {
          source: 'session_wizard',
          sessionId: String(sessionId),
          status: data?.status || 'unknown',
        });
      }

      const serverDrafts = normalizeServerCityDraftsFromSessionData(data);
      const reconciledDrafts = reconcileCityDraftsWithLocalOverlay(serverDrafts);

      setCityDrafts(reconciledDrafts);

      const requestedDraftId = normalizeDraftId(
        preferredDraftId || requestedCityDraftIdRef.current || activeCityDraftIdRef.current
      );
      const selectedDraft = requestedDraftId
        ? reconciledDrafts.find((draft) => normalizeDraftId(draft.id) === requestedDraftId)
        : null;
      const fallbackDraft =
        reconciledDrafts.find((draft) => draft.is_primary) ||
        reconciledDrafts[0] ||
        null;
      const resolvedDraft = selectedDraft || fallbackDraft;
      const resolvedDraftId = normalizeDraftId(resolvedDraft?.id);
      requestedCityDraftIdRef.current = resolvedDraftId;
      activeCityDraftIdRef.current = resolvedDraftId;
      setActiveCityDraftId(resolvedDraftId);

      const sessionLegacyTags = data?.city?.tags ?? data?.city?.city_tags;

      if (selectedDraft) loadCityIntoForm(selectedDraft, sessionLegacyTags);
      else if (fallbackDraft) loadCityIntoForm(fallbackDraft, sessionLegacyTags);

      if (Array.isArray(data?.attractions)) {
        setAttractions(data.attractions.map(normalizeAttraction));
      }
      if (Array.isArray(data?.city_infos)) {
        setCityInfos(data.city_infos.map(normalizeCityInfo));
      } else {
        setCityInfos([]);
      }

      setCurrentCityInfo(null);
      
      if (Array.isArray(data?.attraction_infos)) {
        setAttractionInfos(data.attraction_infos.map(normalizeAttractionInfo));
      } else {
        setAttractionInfos([]);
      }

      setCurrentAttractionInfo(null);

      if (Array.isArray(data?.attraction_feed_items)) {
        setAttractionFeedItems(data.attraction_feed_items.map(normalizeAttractionFeedItem));
      } else {
        setAttractionFeedItems([]);
      }

      setCurrentAttractionFeedItem(null);

    } catch (err) {
      if (seq === loadSessionSeqRef.current && !silent) {
        showNote('Не удалось загрузить сессию: ' + parseApiError(err, 'Ошибка загрузки'), 'error');
        navigate('/generation');
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [sessionId, navigate, showNote, loadCityIntoForm, reconcileCityDraftsWithLocalOverlay]);

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
        removeFilterIdsFromTree(tree, locallyDeletedCityFilterIdsRef.current),
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
        removeFilterIdsFromTree(tree, locallyDeletedEventFilterIdsRef.current),
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
        rows.filter(
          (item) =>
            !locallyDeletedCityFilterIdsRef.current.has(String(item.id)),
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

  useEffect(() => { loadSession(); }, [loadSession]);
  useEffect(() => { loadCityFilterTree(); }, [loadCityFilterTree]);
  useEffect(() => { loadEventFilterTree(); }, [loadEventFilterTree]);
  useEffect(() => { loadCityTagCatalog(); }, [loadCityTagCatalog]);

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

  useEffect(() => {
    citiesAPI.list({ page_size: 1000, limit: 1000 })
      .then((res) => {
        const cities = extractReferenceCities(res?.data);
        setReferenceCities(cities);

        if (import.meta.env.DEV) {
          console.log('🏙️ Reference cities loaded:', {
            raw: res?.data,
            count: cities.length,
            cities,
          });
        }
      })
      .catch((err) => {
        console.error('Не удалось загрузить города из базы:', err);
        setReferenceCities([]);
      });
  }, []);

  useEffect(() => {
    referenceAttractionsAPI.list({ page_size: 1000, limit: 1000 })
      .then((res) => {
        const data = res?.data;

        const items = Array.isArray(data)
          ? data
          : Array.isArray(data?.results)
            ? data.results
            : Array.isArray(data?.data)
              ? data.data
              : Array.isArray(data?.items)
                ? data.items
                : [];

        setReferenceAttractions(items);

        if (import.meta.env.DEV) {
          console.log('🏛️ EventsAPI attractions loaded:', {
            raw: data,
            count: items.length,
            items,
          });
        }
      })
      .catch((err) => {
        console.error('Не удалось загрузить достопримечательности из EventsAPI:', err);
        setReferenceAttractions([]);
      });
  }, []);

  const loadAttractions = useCallback(async () => {
    try {
      const res = await sessionsAPI.get(sessionId);
      const list = res?.data?.attractions || [];
      setAttractions(list.map(normalizeAttraction));  
      setAttractionsLoaded(true);
    } catch (e) {
      showNote('Не удалось загрузить достопримечательности', 'error');
    }
  }, [sessionId, showNote]);
  
  useEffect(() => {
    if (currentStep >= 3 && currentStep <= 4 && !attractionsLoaded) {
      loadAttractions();
    }
  }, [currentStep, attractionsLoaded, loadAttractions]);

  useEffect(() => {
    setCurrentStep((s) => {
      if (s < 1) return 1;
      if (s > TOTAL_STEPS) return TOTAL_STEPS;
      return s;
    });
  }, [sessionId]);

  const saveCityForStep1 = useCallback(async () => {
    if (!defaultLocale || !localeData[defaultLocale]) {
      showNote('Необходимо установить язык по умолчанию', 'error');
      throw new Error('no-default-locale');
    }
    const defLoc = localeData[defaultLocale];
    if (!defLoc.name?.trim()) {
      showNote(`Необходимо заполнить название города для языка "${defLoc.langName}" (язык по умолчанию)`, 'error');
      setActiveLocale(defaultLocale);
      throw new Error('missing-default-name');
    }
    if (!defLoc.description?.trim()) {
      showNote(`Необходимо заполнить описание города для языка "${defLoc.langName}" (язык по умолчанию)`, 'error');
      setActiveLocale(defaultLocale);
      throw new Error('missing-default-description');
    }
    if (!defLoc.country?.trim()) {
      showNote('Необходимо указать страну (для языка по умолчанию)', 'error');
      setActiveLocale(defaultLocale);
      throw new Error('missing-country');
    }

    const name = {};
    const description = {};
    const country = {};
    Object.entries(localeData).forEach(([key, loc]) => {
      if (!loc?.lang) return;
      const localeName = loc.name?.trim() || '';
      const localeDescription = loc.description?.trim() || '';
      const localeCountry = loc.country?.trim() || '';
      const shouldPersistLocale = !!(
        localeName ||
        localeDescription ||
        localeCountry ||
        loc.isDefault ||
        loc.isCustom ||
        key === defaultLocale
      );
      if (shouldPersistLocale) {
        name[loc.lang] = localeName;
        description[loc.lang] = localeDescription;
        country[loc.lang] = localeCountry || loc.code || '';
      }
    });

    const payload = {
      name,
      description,
      country,
      lat: lat ? parseFloat(lat) : null,
      lon: lon ? parseFloat(lon) : null,
      default_language: localeData[defaultLocale]?.lang || null,
      tags: normalizeTagIds(cityTags),
      image_id: imageId,
      image_original_url: imageOriginalUrl || '',
      ...(activeCityDraftIdRef.current && activeCityDraftIdRef.current !== 'legacy'
        ? { draft_id: activeCityDraftIdRef.current }
        : {}),
    };

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
      if (data?.status) setSession(prev => prev ? { ...prev, status: data.status, status_display: data.status_display } : prev);

      const savedDraftId = normalizeDraftId(data?.draft_id || activeCityDraftIdRef.current);
      if (savedDraftId) {
        requestedCityDraftIdRef.current = savedDraftId;
        activeCityDraftIdRef.current = savedDraftId;
        setActiveCityDraftId(savedDraftId);
        syncActiveDraftRoute(savedDraftId);
      }

      if (savedDraft && savedDraftId) {
        const draftTags = normalizeTagIds(savedDraft.tags ?? savedDraft.city_tags ?? []);
        setCityDrafts((prev) =>
          prev.map((d) =>
            normalizeDraftId(d.id) === savedDraftId
              ? { ...d, ...savedDraft, tags: draftTags }
              : d
          )
        );
        if (savedDraftId === normalizeDraftId(activeCityDraftIdRef.current)) {
          setCityTags(draftTags);
        }
      }

      await loadSession(savedDraftId);

      if (!firstCitySaveAtRef.current) {
        firstCitySaveAtRef.current = Date.now();
        trackEvent('save_city_success', { sessionId: String(sessionId), firstSave: true, msFromOpen: sessionOpenedAtRef.current ? (firstCitySaveAtRef.current - sessionOpenedAtRef.current) : null });
      } else {
        trackEvent('save_city_success', { sessionId: String(sessionId), firstSave: false });
      }

      return data;
    } catch (err) {
      trackEvent('save_city_fail', { sessionId: String(sessionId), reason: parseApiError(err, 'Ошибка сохранения') });
      showNote('Ошибка при сохранении города: ' + parseApiError(err, 'Ошибка сохранения'), 'error');
      throw err;
    } finally {
      setSaving(false);
    }
  }, [sessionId, localeData, defaultLocale, lat, lon, cityTags, imageId, imageOriginalUrl, showNote, loadSession, syncActiveDraftRoute]);

  const goToStep = useCallback((target) => {
    if (target < 1 || target > TOTAL_STEPS || target === currentStep) return;
    setCurrentStep(target);
  }, [currentStep]);

  useEffect(() => {
    if (!session?.id) return;
    const params = new URLSearchParams(location.search);
    if (!params.has('step')) return;
    const n = parseInt(params.get('step'), 10);
    if (!Number.isFinite(n)) return;
    goToStep(n);
  }, [session?.id, location.search, goToStep]);

  const switchLocale = useCallback((key) => { setActiveLocale(key); }, []);

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
      [key]: { code, lang, langName, isDefault: false, isCustom: true, name: '', description: '', country: code },
    }));
    setActiveLocale(key);
    setAddLocaleOpen(false);
    setNewLocaleCode('');
    setNewLocaleLang('');
    showNote(`Адаптация "${langName} (${code})" добавлена`, 'success');
  }, [newLocaleCode, newLocaleLang, localeData, showNote]);

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
  }, [localeData, activeLocale, defaultLocale, showNote]);

  const updateLocaleField = useCallback((field, value) => {
    setLocaleData(prev => ({ ...prev, [activeLocale]: { ...prev[activeLocale], [field]: value } }));
  }, [activeLocale]);

  const handleSelectDraft = useCallback((draftId) => {
    const normalizedDraftId = normalizeDraftId(draftId);
    const draft = cityDrafts.find((item) => normalizeDraftId(item.id) === normalizedDraftId);
    if (!draft) return;
    requestedCityDraftIdRef.current = normalizedDraftId;
    activeCityDraftIdRef.current = normalizedDraftId;
    setActiveCityDraftId(normalizedDraftId);
    syncActiveDraftRoute(normalizedDraftId);
    loadCityIntoForm(draft);
  }, [cityDrafts, loadCityIntoForm, syncActiveDraftRoute]);

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
      void loadSession(newDraftId, { silent: true }).catch((error) => {
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

    try {
      await sessionsAPI.deleteCityDraft(sessionId, normalizedDraftId);

      markCityDraftDeletedLocally(normalizedDraftId);

      let nextActiveDraft = null;

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

    void loadSession(nextDraftIdForReload, { silent: true }).catch((error) => {
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

    if (commonsTarget.type === 'attraction') {
      const targetAttrId = commonsTarget.id ?? currentAttr?.id ?? null;

      if (!targetAttrId) {
        showNote('Не удалось определить достопримечательность для изображения', 'error');
        return;
      }

      const patch = {
        image_id: selectedImageId,
        image: selectedImageId,

        image_url: localUrl,
        imageUrl: localUrl,

        image_original_url: originalUrl,
        imageOriginalUrl: originalUrl,

        image_copyright: copyright,
        imageCopyright: copyright,
      };

      setAttractions((items) =>
        items.map((item) =>
          normalizeId(item.id) === normalizeId(targetAttrId)
            ? normalizeAttraction({
                ...item,
                ...patch,
              })
            : item
        )
      );

      setCurrentAttr((prev) => {
        if (!prev || normalizeId(prev.id) !== normalizeId(targetAttrId)) {
          return prev;
        }

        return normalizeAttraction({
          ...prev,
          ...patch,
        });
      });

      showNote('Изображение достопримечательности загружено из Wikimedia Commons', 'success');
      return;
    }

    if (commonsTarget.type === 'attraction_feed') {
      const targetItemId = commonsTarget.id ?? currentAttractionFeedItem?.id ?? null;

      if (!targetItemId) {
        showNote('Не удалось определить элемент ленты для изображения', 'error');
        return;
      }

      const patch = {
        item_type: 'image',

        image_id: selectedImageId,
        image: selectedImageId,

        image_url: localUrl,
        imageUrl: localUrl,

        image_original_url: originalUrl,
        imageOriginalUrl: originalUrl,

        image_copyright: copyright,
        imageCopyright: copyright,

        text: {},
      };

      setAttractionFeedItems((items) =>
        items.map((item) =>
          normalizeId(item.id) === normalizeId(targetItemId)
            ? normalizeAttractionFeedItem({
                ...item,
                ...patch,
              })
            : item
        )
      );

      setCurrentAttractionFeedItem((prev) => {
        if (!prev || normalizeId(prev.id) !== normalizeId(targetItemId)) {
          return prev;
        }

        return normalizeAttractionFeedItem({
          ...prev,
          ...patch,
        });
      });

      showNote('Изображение ленты загружено из Wikimedia Commons', 'success');
      return;
    }
  }, [
    commonsTarget,
    currentAttr,
    currentAttractionFeedItem,
    showNote,
  ]);

  const openCityCommonsModal = useCallback(() => {
    setCommonsTarget({
      type: 'city',
      id: null,
    });

    setCommonsModalOpen(true);
  }, []);

  const openAttractionCommonsModal = useCallback((attr) => {
    setCommonsTarget({
      type: 'attraction',
      id: attr?.id ?? currentAttr?.id ?? null,
    });

    setCommonsModalOpen(true);
  }, [currentAttr]);

  const openAttractionFeedCommonsModal = useCallback((item) => {
    setCommonsTarget({
      type: 'attraction_feed',
      id: item?.id ?? currentAttractionFeedItem?.id ?? null,
    });

    setCommonsModalOpen(true);
  }, [currentAttractionFeedItem]);

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
      const item = normalizeAttractionFeedItem(rawItem || emptyItem);

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

  const openAttractionFeedItemDetail = useCallback((itemId) => {
    const target = attractionFeedItems.find(
      (item) => normalizeId(item.id) === normalizeId(itemId)
    );

    if (!target) return;

    const nextId = normalizeId(target.id);
    if (attractionFeedLocaleDataItemIdRef.current !== nextId) {
      attractionFeedLocaleDataItemIdRef.current = null;
    }

    setCurrentAttractionFeedItem(target);
  }, [attractionFeedItems]);

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

  const saveCurrentAttractionFeedItem = useCallback(async () => {
    if (!currentAttractionFeedItem) return;

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
      showNote('Выберите достопримечательность из базы', 'error');
      return;
    }

    if (assignedType === 'draft' && !sessionAttractionId) {
      showNote('Выберите достопримечательность из сессии', 'error');
      return;
    }

    if (currentAttractionFeedItem.item_type === 'image' && !currentAttractionFeedItem.image_id) {
      showNote('Добавьте изображение для элемента ленты', 'error');
      return;
    }

    setAttractionFeedSaving(true);

    try {
      const text = {};

      Object.values(attractionFeedLocaleData).forEach((d) => {
        if (d.text) {
          text[d.lang] = d.text || '';
        }
      });

      const res = await attractionFeedAPI.update(
        sessionId,
        currentAttractionFeedItem.id,
        buildAttractionFeedPayload(currentAttractionFeedItem, text)
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
            : item
        )
      );

      setCurrentAttractionFeedItem(updatedItem);

      showNote('Элемент ленты сохранён', 'success');
    } catch (e) {
      showNote(
        'Ошибка при сохранении элемента ленты: ' + parseApiError(e),
        'error'
      );
    } finally {
      setAttractionFeedSaving(false);
    }
  }, [
    sessionId,
    currentAttractionFeedItem,
    attractionFeedLocaleData,
    showNote,
  ]);

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
      fd.append('session_uuid', session?.uuid || session?.session_uuid || '');
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
    session,
    currentAttractionFeedItem,
    updateCurrentAttractionFeedItemPatch,
    showNote,
  ]);

  const getSessionUuid = useCallback(() => session?.uuid || session?.session_uuid || '', [session]);

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
  }, []);

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

  const createCityFilterFolder = useCallback(async (payload) => {
    try {
      await cityFiltersAPI.create({
        ...payload,
        type: 'folder',
        parent_id: null,
      });
      showNote('Папка создана', 'success');
      await loadCityFilterTree();
    } catch (e) {
      showNote(parseApiError(e, 'Ошибка создания папки'), 'error');
      throw e;
    }
  }, [loadCityFilterTree, showNote]);

  const createCityFilterTag = useCallback(async (folderId, payload) => {
    const parentId = normalizeId(folderId);
    if (!parentId) {
      showNote('Не указана папка для тега', 'error');
      return;
    }
    try {
      await cityFiltersAPI.create({
        ...payload,
        type: 'tag',
        parent_id: parentId,
      });
      showNote('Тег создан', 'success');
      await loadCityFilterTree();
      await loadCityTagCatalog();
    } catch (e) {
      showNote(parseApiError(e, 'Ошибка создания тега'), 'error');
      throw e;
    }
  }, [loadCityFilterTree, loadCityTagCatalog, showNote]);

  const createCityTag = useCallback(async (payload) => {
    try {
      const res = await cityFiltersAPI.create({
        ...payload,
        type: 'tag',
        parent_id: payload?.parent_id ?? null,
      });
      const raw = res?.data?.data ?? res?.data;
      const newId = raw?.id ?? raw?.uuid ?? raw?.pk;
      if (newId != null) {
        locallyDeletedCityFilterIdsRef.current.delete(String(newId));
      }
      showNote('Тег города создан', 'success');
      await loadCityTagCatalog();
      await loadCityFilterTree();
    } catch (e) {
      showNote(parseApiError(e, 'Ошибка создания тега'), 'error');
      throw e;
    }
  }, [loadCityTagCatalog, loadCityFilterTree, showNote]);

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
    setDeletingCityFilterIds((prev) => {
      const next = new Set(prev);
      next.add(idStr);
      return next;
    });

    const applyLocalRemove = () => {
      locallyDeletedCityFilterIdsRef.current.add(idStr);
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
      if (e?.response?.status === 404) {
        applyLocalRemove();
        showNote('Элемент уже удалён', 'success');
      } else {
        showNote(parseApiError(e, 'Не удалось удалить'), 'error');
      }
    } finally {
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
  }, [confirm, loadCityFilterTree, loadCityTagCatalog, showNote, patchActiveDraftTags]);

  const uploadEventFilterImage = uploadCityFilterImage;

  const createEventFilterFolder = useCallback(async (payload) => {
    try {
      const res = await eventFiltersAPI.create({
        ...payload,
        type: 'folder',
        parent_id: null,
      });
      const raw = res?.data?.data ?? res?.data;
      const newId = raw?.id ?? raw?.uuid ?? raw?.pk;
      if (newId != null) {
        locallyDeletedEventFilterIdsRef.current.delete(String(newId));
      }
      showNote('Папка создана', 'success');
      await loadEventFilterTree();
    } catch (e) {
      showNote(parseApiError(e, 'Ошибка создания папки'), 'error');
      throw e;
    }
  }, [loadEventFilterTree, showNote]);

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
      const raw = res?.data?.data ?? res?.data;
      const newId = raw?.id ?? raw?.uuid ?? raw?.pk;
      if (newId != null) {
        locallyDeletedEventFilterIdsRef.current.delete(String(newId));
      }
      showNote('Тег создан', 'success');
      await loadEventFilterTree();
    } catch (e) {
      showNote(parseApiError(e, 'Ошибка создания тега'), 'error');
      throw e;
    }
  }, [loadEventFilterTree, showNote]);

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
    setDeletingEventFilterIds((prev) => {
      const next = new Set(prev);
      next.add(idStr);
      return next;
    });

    const applyLocalRemove = () => {
      locallyDeletedEventFilterIdsRef.current.add(idStr);
      setEventFilterTree((prev) =>
        removeFilterIdsFromTree(prev, locallyDeletedEventFilterIdsRef.current),
      );
    };

    try {
      await eventFiltersAPI.delete(id);
      applyLocalRemove();
      showNote('Удалено', 'success');
    } catch (e) {
      if (e?.response?.status === 404) {
        applyLocalRemove();
        showNote('Элемент уже удалён', 'success');
      } else {
        showNote(parseApiError(e, 'Не удалось удалить'), 'error');
      }
    } finally {
      setDeletingEventFilterIds((prev) => {
        const next = new Set(prev);
        next.delete(idStr);
        return next;
      });
      void loadEventFilterTree().catch((err) => {
        console.error('Catalog reload after delete failed', err);
      });
    }
  }, [confirm, loadEventFilterTree, showNote]);

  const toggleCurrentAttractionTag = useCallback((tagId) => {
    const id = normalizeId(tagId);

    if (!id) return;

    setCurrentAttr((prev) => {
      if (!prev) return prev;

      const current = normalizeTagIds(prev.tags);
      const nextTags = current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id];

      const updated = {
        ...prev,
        tags: nextTags,
      };

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
      const info = normalizeCityInfo(rawInfo || emptyInfo);

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
  }, [sessionId, showNote, localeData, defaultLocale]);

  const openCityInfoDetail = useCallback((infoId) => {
    const target = cityInfos.find(
      (info) => normalizeId(info.id) === normalizeId(infoId)
    );

    if (!target) return;

    setCurrentCityInfo(target);
    setCityInfoActiveLocale('ru-RU');
  }, [cityInfos]);

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
  }, []);

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
  }, [cityInfoActiveLocale, cityInfoLocaleData]);

  const saveCurrentCityInfo = useCallback(async () => {
    if (!currentCityInfo) return;

    setCityInfoSaving(true);

    try {
      const name = {};
      const description = {};

      Object.values(cityInfoLocaleData).forEach((d) => {
        if (d.name || d.description) {
          name[d.lang] = d.name || '';
          description[d.lang] = d.description || '';
        }
      });

      const res = await cityInfosAPI.update(
        sessionId,
        currentCityInfo.id,
        buildCityInfoPayload(currentCityInfo, name, description)
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
            : item
        )
      );

      setCurrentCityInfo(updatedInfo);

      showNote('Полезная информация сохранена', 'success');
    } catch (e) {
      showNote(
        'Ошибка при сохранении полезной информации: ' + parseApiError(e),
        'error'
      );
    } finally {
      setCityInfoSaving(false);
    }
  }, [sessionId, currentCityInfo, cityInfoLocaleData, showNote]);

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
  }, [sessionId, currentCityInfo, getCityInfoName, confirm, showNote]);

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
      const info = normalizeAttractionInfo(rawInfo || emptyInfo);

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

  const openAttractionInfoDetail = useCallback((infoId) => {
    const target = attractionInfos.find(
      (info) => normalizeId(info.id) === normalizeId(infoId)
    );

    if (!target) return;

    setCurrentAttractionInfo(target);
    setAttractionInfoActiveLocale('ru-RU');
  }, [attractionInfos]);

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
  }, [localeData, cityDrafts, referenceCities]);
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
  }, [
    currentAttr,
    buildAttrLocaleData,
  ]);
  useEffect(() => {
    const availableKeys = Object.keys(attrLocaleData || {});

    if (availableKeys.length === 0) return;

    if (!availableKeys.includes(attrActiveLocale)) {
      setAttrActiveLocale(availableKeys[0]);
    }
  }, [
    attrLocaleData,
    attrActiveLocale,
  ]);

  const openAttrDetail = useCallback(async (attrId) => {
    try {
      const cachedAttr = attractions.find((item) => String(item.id) === String(attrId));

      const res = await attractionsAPI.get(sessionId, attrId);
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

      const nextAttrId = normalizeId(attr.id);
      if (attrLocaleDataAttractionIdRef.current !== nextAttrId) {
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
      setAttrView('detail');
    } catch (e) {
      showNote('Не удалось открыть достопримечательность: ' + e.message, 'error');
    }
  }, [sessionId, attractions, buildAttrLocaleData, showNote]);

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

        // legacy compatibility
        order: nextIndex,
      });

      const rawAttr = res?.data?.attraction || res?.data;

      const attr = normalizeAttraction({
        ...(rawAttr || {}),

        assigned_city_type:
          rawAttr?.assigned_city_type ??
          (shouldAttachToDraft ? 'draft' : 'none'),

        city: rawAttr?.city ?? null,
        city_id: rawAttr?.city_id ?? null,

        session_city:
          rawAttr?.session_city ??
          (shouldAttachToDraft ? activeDraftId : null),

        session_city_id:
          rawAttr?.session_city_id ??
          (shouldAttachToDraft ? activeDraftId : null),
      });

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
  ]);

  const openAttractionGenerationModal = useCallback(() => {
    attractionGenPollCancelledRef.current = false;
    setAttractionGenerationError('');
    setAttractionGenerationPrompt('');
    setAttractionGenerationTaskId(null);
    setAttractionGenerationAssignedCityType('none');
    setAttractionGenerationSessionCityId('');
    setAttractionGenerationDatabaseCityId('');

    const resolveDefaultAiLang = () => {
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
    };

    setAttractionGenerationLang(resolveDefaultAiLang());
    setAttractionGenerationOpen(true);
  }, [localeData, activeLocale, cityDrafts]);

  const closeAttractionGenerationModal = useCallback(() => {
    attractionGenPollCancelledRef.current = true;
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
    const prompt = attractionGenerationPrompt.trim();
    if (!prompt) {
      setAttractionGenerationError('Введите запрос');
      return;
    }

    const assigned_city_type = attractionGenerationAssignedCityType || 'none';
    let session_city_id = null;
    let city_id = null;

    if (assigned_city_type === 'draft') {
      const sid = normalizeDraftId(attractionGenerationSessionCityId);
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
    }

    const langRaw = (attractionGenerationLang || 'ru').trim().toLowerCase();
    const lang = (langRaw.split('-')[0] || 'ru').slice(0, 8) || 'ru';

    attractionGenPollCancelledRef.current = false;
    setAttractionGenerating(true);
    setAttractionGenerationError('');
    setAttractionGenerationTaskId(null);

    try {
      const startRes = await aiAPI.attractionsJsonStart({
        session_id: sessionId,
        prompt,
        lang,
        assigned_city_type,
        session_city_id: assigned_city_type === 'draft' ? session_city_id : null,
        city_id: assigned_city_type === 'database' ? city_id : null,
      });
      const taskId = startRes?.data?.task_id;
      if (!taskId) {
        throw new Error('Сервер не вернул task_id');
      }
      setAttractionGenerationTaskId(taskId);

      let pollDone = false;
      while (!pollDone) {
        if (attractionGenPollCancelledRef.current) {
          return;
        }
        const tr = await tasksAPI.get(taskId);
        const task = tr?.data;
        if (task?.status === 'completed') {
          pollDone = true;
        } else if (task?.status === 'failed') {
          const failedMsg =
            task?.error_message ||
            task?.result_data?.error ||
            'Задача завершилась с ошибкой';
          throw new Error(failedMsg);
        } else {
          await new Promise((r) => setTimeout(r, 1000));
        }
      }

      if (attractionGenPollCancelledRef.current) {
        return;
      }

      const createRes = await aiAPI.attractionsCreateFromTask(taskId, { session_id: sessionId });
      const list = createRes?.data?.attractions || [];
      const n = Array.isArray(list) ? list.length : 0;

      const keepDraft = normalizeDraftId(activeCityDraftIdRef.current);
      await loadSession(keepDraft);

      if (!attractionGenPollCancelledRef.current) {
        showNote(`Сгенерировано достопримечательностей: ${n}`, 'success');
        setAttractionGenerationOpen(false);
        setAttractionGenerationPrompt('');
        setAttractionGenerationTaskId(null);
      }
    } catch (e) {
      if (!attractionGenPollCancelledRef.current) {
        const msg = parseApiError(e, 'Ошибка генерации');
        setAttractionGenerationError(msg);
        showNote(msg, 'error');
      }
    } finally {
      setAttractionGenerating(false);
    }
  }, [
    sessionId,
    attractionGenerationPrompt,
    attractionGenerationAssignedCityType,
    attractionGenerationSessionCityId,
    attractionGenerationDatabaseCityId,
    attractionGenerationLang,
    loadSession,
    showNote,
  ]);

  const saveCurrentAttr = useCallback(async () => {
    if (!currentAttr) return;
    setAttrSaving(true);
    try {
      const name = {}, description = {};
      Object.values(attrLocaleData).forEach((d) => {
        if (d.name || d.description) {
          name[d.lang] = d.name || '';
          description[d.lang] = d.description || '';
        }
      });
      const updated = await attractionsAPI.update(
        sessionId,
        currentAttr.id,
        buildAttractionPayload(currentAttr, name, description)
      );
      
      const responseAttr = updated?.data?.attraction || updated?.data || {};

      const updatedAttr = normalizeAttraction({
        ...currentAttr,
        ...responseAttr,

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
        prev.map((item) => item.id === currentAttr.id ? updatedAttr : item)
      );

      setCurrentAttr(updatedAttr);
      await Promise.all(
        Object.values(attrLocaleData).map((d) => attractionsAPI.saveContent(sessionId, currentAttr.id, { language: d.lang, text: d.contentText || '' }))
      );
      showNote('Достопримечательность сохранена', 'success');
    } catch (e) {
      showNote('Ошибка при сохранении: ' + e.message, 'error');
    } finally {
      setAttrSaving(false);
    }
  }, [sessionId, currentAttr, attrLocaleData, showNote]);

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

  const updateAttrLocaleField = useCallback((field, value) => {
    setAttrLocaleData(prev => ({ ...prev, [attrActiveLocale]: { ...prev[attrActiveLocale], [field]: value } }));
  }, [attrActiveLocale]);

  const handleClose = useCallback(async () => {
    setClosing(true);
    try {
      await sessionsAPI.close(sessionId, closeMode);
      trackEvent('close_session_mode', { sessionId: String(sessionId), mode: closeMode, result: 'success' });
      setCloseOpen(false);
      navigate('/generation');
    } catch (err) {
      trackEvent('close_session_mode', { sessionId: String(sessionId), mode: closeMode, result: 'fail', reason: parseApiError(err, 'Ошибка закрытия') });
      showNote(parseApiError(err, 'Ошибка закрытия сессии'), 'error');
    } finally {
      setClosing(false);
    }
  }, [sessionId, closeMode, navigate, showNote]);

  const handlePublish = useCallback(async () => {
    if (!(await confirm({
      title: 'Публикация сессии',
      message: 'Опубликовать всю сессию? Данные будут записаны в основную базу.',
    }))) {
      return;
    }

    setPublishing(true);

    try {
      const hasCityDataToSave =
        Boolean(session?.city) ||
        (Array.isArray(cityDrafts) && cityDrafts.length > 0) ||
        Object.values(localeData || {}).some((loc) => {
          return (
            loc?.name?.trim?.() ||
            loc?.description?.trim?.() ||
            loc?.country?.trim?.()
          );
        }) ||
        Boolean(imageId) ||
        Boolean(lat) ||
        Boolean(lon) ||
        normalizeTagIds(cityTags).length > 0;

      if (hasCityDataToSave) {
        await saveCityForStep1();
      }

      if (currentCityInfo) {
        await saveCurrentCityInfo();
      }

      if (currentAttr) {
        await saveCurrentAttr();
      }

      if (currentAttractionInfo) {
        await saveCurrentAttractionInfo();
      }

      if (currentAttractionFeedItem) {
        await saveCurrentAttractionFeedItem();
      }

      const res = await sessionsAPI.publish(sessionId);
      const published = res?.data;

      if (
        published &&
        (published.status != null ||
          published.status_display != null ||
          published.closed_at != null ||
          published.closed_with_save != null)
      ) {
        setSession((prev) =>
          prev
            ? {
                ...prev,
                status: published.status ?? prev.status,
                status_display: published.status_display ?? prev.status_display,
                closed_at: published.closed_at ?? prev.closed_at,
                closed_with_save:
                  published.closed_with_save ?? prev.closed_with_save,
              }
            : prev
        );
      }

      await loadSession(
        normalizeDraftId(activeCityDraftIdRef.current) || undefined,
        {
          silent: true,
          force: true,
        }
      );

      trackEvent('publish_session_success', {
        sessionId: String(sessionId),
        msFromOpen: sessionOpenedAtRef.current
          ? Date.now() - sessionOpenedAtRef.current
          : null,
        msFromFirstSave: firstCitySaveAtRef.current
          ? Date.now() - firstCitySaveAtRef.current
          : null,
      });

      showNote(published?.message || 'Сессия опубликована', 'success');
    } catch (err) {
      trackEvent('publish_session_fail', {
        sessionId: String(sessionId),
        reason: parseApiError(err, 'Ошибка публикации'),
      });

      showNote(parseApiError(err, 'Ошибка публикации'), 'error');
    } finally {
      setPublishing(false);
    }
  }, [
    confirm,

    session,
    cityDrafts,
    localeData,
    imageId,
    lat,
    lon,
    cityTags,
    saveCityForStep1,

    currentCityInfo,
    saveCurrentCityInfo,

    currentAttr,
    saveCurrentAttr,

    currentAttractionInfo,
    saveCurrentAttractionInfo,

    currentAttractionFeedItem,
    saveCurrentAttractionFeedItem,

    sessionId,
    loadSession,
    showNote,
  ]);

  const handleTranslateSession = useCallback(async () => {
    const currentDraftId = activeCityDraftIdRef.current;

    const collectLanguageKeys = (cityLike) => {
      const keys = new Set();
      const collect = (value) => {
        if (!value || typeof value !== 'object' || Array.isArray(value)) return;
        Object.keys(value).forEach((key) => {
          const lang = String(key || '').trim().toLowerCase();
          if (lang) keys.add(lang);
        });
      };
      collect(cityLike?.name);
      collect(cityLike?.description);
      collect(cityLike?.country);
      return Array.from(keys);
    };

    const languagesFromLocaleData = Object.values(localeData || {})
      .map((loc) => (loc?.lang || '').trim().toLowerCase())
      .filter(Boolean);
    const languagesFromDrafts = (Array.isArray(cityDrafts) ? cityDrafts : []).flatMap((draft) => collectLanguageKeys(draft));
    const languagesFromLegacyCity = collectLanguageKeys(session?.city || {});
    const targetLanguages = [...new Set([...languagesFromLocaleData, ...languagesFromDrafts, ...languagesFromLegacyCity])];

    setTranslating(true);
    try {
      const res = await sessionsAPI.translate(sessionId, { target_languages: targetLanguages, scope: 'all_drafts' });
      showNote(res?.data?.message || 'Перевод всех городов завершен', 'success');
      await loadSession(currentDraftId);
    } catch (err) {
      showNote(parseApiError(err, 'Ошибка перевода'), 'error');
    } finally {
      setTranslating(false);
    }
  }, [sessionId, cityDrafts, session, localeData, loadSession, showNote]);

  useEffect(() => {
    const actions = [{ id: 'save-city-data', label: saving ? 'Сохранение...' : 'Сохранить город', onClick: () => { if (!saving) saveCityForStep1(); }, disabled: saving, variant: 'primary' }];
    if (!session?.closed_with_save) {
      actions.push({ id: 'publish-session', label: publishing ? 'Публикация...' : 'Опубликовать сессию', onClick: () => { if (!publishing) handlePublish(); }, disabled: publishing });
    }
    if (session?.status === 'draft' || session?.status === 'in_progress') {
      actions.push({ id: 'close-session', label: 'Закрыть сессию', onClick: () => { setCloseMode('save'); setCloseOpen(true); }, variant: 'danger' });
    }

    return () => setMobileActions([]);
  }, [setMobileActions, saving, publishing, saveCityForStep1, handlePublish, session]);

  return {
    note, showNote,
    session, loading,
    cityDrafts, activeCityDraftId, referenceCities, referenceAttractions,
    currentStep, setCurrentStep,
    localeData, activeLocale, defaultLocale, setDefaultLocale, addLocaleOpen, setAddLocaleOpen, newLocaleCode, setNewLocaleCode, newLocaleLang, setNewLocaleLang,
    lat, lon, savedLat, savedLon, setLat, setLon, setSavedLat, setSavedLon,
    imageId, imagePreview, imageOriginalUrl, imageCopyright, setImageOriginalUrl, setImageCopyright, photoUploading, photoFileRef, commonsModalOpen, setCommonsModalOpen, openCityCommonsModal, openAttractionCommonsModal, openAttractionFeedCommonsModal, handleCommonsImageSelect,
    cityTags, tagInput, setTagInput,
    cityFilterTree, cityFilterTreeLoading, cityFilterTreeError, loadCityFilterTree,
    eventFilterTree, eventFilterTreeLoading, eventFilterTreeError, loadEventFilterTree,
    cityTagCatalog, cityTagCatalogLoading, cityTagCatalogError, loadCityTagCatalog,
    deletingCityFilterIds, deletingEventFilterIds,
    cityInfos, currentCityInfo, cityInfoLocaleData, cityInfoActiveLocale, cityInfoSaving,
    attractions, attrView, currentAttr, attrLocaleData, attrActiveLocale, attrSaving,
    attractionInfos, currentAttractionInfo, attractionInfoLocaleData, attractionInfoActiveLocale, attractionInfoSaving,    
    attractionFeedItems, currentAttractionFeedItem, attractionFeedLocaleData, attractionFeedActiveLocale, attractionFeedSaving, attractionFeedPhotoUploading, attractionFeedPhotoFileRef,
    attractionGenerationOpen, attractionGenerationPrompt, attractionGenerating, attractionGenerationTaskId, attractionGenerationError,
    attractionGenerationAssignedCityType, attractionGenerationSessionCityId, attractionGenerationDatabaseCityId, attractionGenerationLang,
    saving, closeOpen, closeMode, closing, publishing, translating,
    setAttrView, setCurrentAttr, setAttrActiveLocale,
    setCloseOpen, setCloseMode,
    setMapContainerRef,
    loadSession, syncActiveDraftRoute, loadCityIntoForm,
    saveCityForStep1,
    goToStep, switchLocale, addLocale, removeLocale, updateLocaleField,
    handleSelectDraft, handleCreateDraft, handleDeleteDraft,
    handlePhotoFile, getSessionUuid,
    addTag, removeTag, handleTagKeyDown, handleTagBlur, toggleCityTag,
    uploadCityFilterImage,
    createCityFilterFolder, createCityFilterTag, createCityTag, updateCityFilter, deleteCityFilter,
    uploadEventFilterImage,
    createEventFilterFolder, createEventFilterTag, updateEventFilter, deleteEventFilter,
    setCurrentCityInfo, setCityInfoActiveLocale, openCityInfoDetail, addCityInfo, updateCurrentCityInfoPatch, updateCityInfoLocaleField, saveCurrentCityInfo, deleteCurrentCityInfo,
    setCurrentAttractionInfo, setAttractionInfoActiveLocale, openAttractionInfoDetail, addAttractionInfo, updateCurrentAttractionInfoPatch, updateAttractionInfoLocaleField, saveCurrentAttractionInfo, deleteCurrentAttractionInfo,
    setCurrentAttractionFeedItem, setAttractionFeedActiveLocale,
    openAttrDetail, addAttraction, deleteCurrentAttr, saveCurrentAttr, updateAttrLocaleField, updateCurrentAttrPatch,
    openAttractionGenerationModal, closeAttractionGenerationModal, setAttractionGenerationPrompt,
    setAttractionGenerationAssignedCityTypeSafe, setAttractionGenerationSessionCityId,
    setAttractionGenerationDatabaseCityId, setAttractionGenerationLang,
    generateAttractionsFromPrompt, toggleCurrentAttractionTag,
    openAttractionFeedItemDetail, addAttractionFeedItem, updateCurrentAttractionFeedItemPatch, updateAttractionFeedLocaleField, saveCurrentAttractionFeedItem, deleteCurrentAttractionFeedItem, handleAttractionFeedPhotoFile,
    handleClose, handlePublish, handleTranslateSession,
    TOTAL_STEPS,
  };
}
