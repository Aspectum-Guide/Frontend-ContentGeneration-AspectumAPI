import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { aiAPI, attractionsAPI, attractionInfosAPI, referenceAttractionsAPI, cityInfosAPI, cityFiltersAPI, citiesAPI, imagesAPI, sessionsAPI, eventsAPI } from '../../../api/generation';
import { useLayoutActions } from '../../../context/useLayoutActions';
import { trackEvent } from '../../../utils/analytics';
import { parseApiError } from '../../../utils/apiError';
import { useToast } from '../../../components/ui/Toast.jsx';
import { DEFAULT_LOCALE_DEFS, getLocaleInfo } from './sessionWizardShared.jsx';

const TOTAL_STEPS = 7;

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

    city,
    session_city: sessionCity,
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

const getLocaleLang = (localeKey) => {
  const locale = DEFAULT_LOCALE_DEFS.find((item) => item.key === localeKey);

  return locale?.lang || localeKey?.split('-')?.[0] || 'ru';
};

const makeEmptyLocaleObject = () => {
  return DEFAULT_LOCALE_DEFS.reduce((acc, locale) => {
    const lang = locale.lang || locale.key?.split('-')?.[0] || 'ru';

    acc[lang] = '';

    return acc;
  }, {});
};

const createEmptyCityInfo = () => {
  return {
    id: `city-info-${Date.now()}`,

    name: makeEmptyLocaleObject(),
    description: makeEmptyLocaleObject(),

    assigned_city_type: 'none',

    city: null,
    city_id: null,

    session_city: null,
    session_city_id: null,

    isNew: true,
  };
};

const createEmptyAttractionInfo = () => {
  return {
    id: `attraction-info-${Date.now()}`,

    name: makeEmptyLocaleObject(),
    description: makeEmptyLocaleObject(),

    assigned_attraction_type: 'none',

    attraction: null,
    attraction_id: null,

    session_attraction: null,
    session_attraction_id: null,

    isNew: true,
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

  const [cityTags, setCityTags] = useState([]);
  const [tagInput, setTagInput] = useState('');
  const [availableTags, setAvailableTags] = useState([]);

  const [attractions, setAttractions] = useState([]);
  const [attrView, setAttrView] = useState('list');
  const [currentAttr, setCurrentAttr] = useState(null);
  const [attrLocaleData, setAttrLocaleData] = useState({});
  const [attrActiveLocale, setAttrActiveLocale] = useState('ru-RU');
  const [attrSaving, setAttrSaving] = useState(false);
  const [attractionsLoaded, setAttractionsLoaded] = useState(false);

  const [attractionInfos, setAttractionInfos] = useState([]);
  const [currentAttractionInfo, setCurrentAttractionInfo] = useState(null);
  const [attractionInfoActiveLocale, setAttractionInfoActiveLocale] = useState('ru-RU');
  const [attractionInfoSaving, setAttractionInfoSaving] = useState(false);

  const [cityInfos, setCityInfos] = useState([]);
  const [currentCityInfo, setCurrentCityInfo] = useState(null);
  const [cityInfoActiveLocale, setCityInfoActiveLocale] = useState('ru-RU');
  const [cityInfoSaving, setCityInfoSaving] = useState(false);
  const cityInfoLocaleData = useMemo(() => {
    if (!currentCityInfo) return {};

    return DEFAULT_LOCALE_DEFS.reduce((acc, locale) => {
      const lang = locale.lang || locale.key?.split('-')?.[0] || 'ru';

      acc[locale.key] = {
        lang,
        code: locale.code,
        langName: locale.langName,
        name: currentCityInfo.name?.[lang] || '',
        description: currentCityInfo.description?.[lang] || '',
      };

      return acc;
    }, {});
  }, [currentCityInfo]);

  const attractionInfoLocaleData = useMemo(() => {
    if (!currentAttractionInfo) return {};

    return DEFAULT_LOCALE_DEFS.reduce((acc, locale) => {
      const lang = locale.lang || locale.key?.split('-')?.[0] || 'ru';

      acc[locale.key] = {
        lang,
        code: locale.code,
        langName: locale.langName,
        name: currentAttractionInfo.name?.[lang] || '',
        description: currentAttractionInfo.description?.[lang] || '',
      };

      return acc;
    }, {});
  }, [currentAttractionInfo]);

  const [aiGenAttrId, setAiGenAttrId] = useState(null);
  const [aiGenLang, setAiGenLang] = useState('ru');
  const [aiGenText, setAiGenText] = useState('');
  const [aiGenDone, setAiGenDone] = useState(false);
  const [aiGenError, setAiGenError] = useState(null);
  const [aiGenSaving, setAiGenSaving] = useState(false);
  const aiPollRef = useRef(null);

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

  const loadCityIntoForm = useCallback((city) => {
    if (!city) return;

    const latVal = city.lat != null ? String(city.lat) : '';
    const lonVal = city.lon != null ? String(city.lon) : '';

    setLat(latVal);
    setLon(lonVal);

    if (city.lat != null) setSavedLat(city.lat);
    if (city.lon != null) setSavedLon(city.lon);

    setCityTags(Array.isArray(city.tags) ? city.tags.slice() : []);

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

  const loadSession = useCallback(async (preferredDraftId = null) => {
    try {
      setLoading(true);
      const res = await sessionsAPI.get(sessionId);
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

      const drafts = Array.isArray(data?.city_drafts) && data.city_drafts.length > 0
        ? data.city_drafts
        : (data?.city ? [{ ...data.city, id: 'legacy', is_primary: true, order: 0 }] : []);
      setCityDrafts(drafts);

      const requestedDraftId = normalizeDraftId(
        preferredDraftId || requestedCityDraftIdRef.current || activeCityDraftIdRef.current
      );
      const selectedDraft = requestedDraftId
        ? drafts.find((draft) => normalizeDraftId(draft.id) === requestedDraftId)
        : null;
      const fallbackDraft = drafts.find((draft) => draft.is_primary) || drafts[0] || null;
      const resolvedDraft = selectedDraft || fallbackDraft;
      const resolvedDraftId = normalizeDraftId(resolvedDraft?.id);
      requestedCityDraftIdRef.current = resolvedDraftId;
      activeCityDraftIdRef.current = resolvedDraftId;
      setActiveCityDraftId(resolvedDraftId);

      if (selectedDraft) loadCityIntoForm(selectedDraft);
      else if (fallbackDraft) loadCityIntoForm(fallbackDraft);

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

    } catch (err) {
      showNote('Не удалось загрузить сессию: ' + parseApiError(err, 'Ошибка загрузки'), 'error');
      navigate('/generation');
    } finally {
      setLoading(false);
    }
  }, [sessionId, navigate, showNote, loadCityIntoForm]);

  useEffect(() => { loadSession(); }, [loadSession]);
  useEffect(() => () => clearInterval(aiPollRef.current), []);

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
    cityFiltersAPI.list().then((res) => {
      const data = res?.data;
      const tags = Array.isArray(data?.tags) ? data.tags
        : Array.isArray(data?.results) ? data.results
          : Array.isArray(data) ? data : [];
      setAvailableTags(tags);
    }).catch(() => { });
  }, []);

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
    if ((currentStep === 4 || currentStep === 5) && !attractionsLoaded) {
      loadAttractions();
    }
  }, [currentStep, attractionsLoaded, loadAttractions]);

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
      const shouldPersistLocale = !!(localeName || localeDescription || localeCountry || loc.isCustom || key === defaultLocale);
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
      tags: cityTags,
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
    try {
      const res = await sessionsAPI.createCityDraft(sessionId, {});
      const newDraftId = normalizeDraftId(res?.data?.draft?.id);
      if (newDraftId) {
        requestedCityDraftIdRef.current = newDraftId;
        activeCityDraftIdRef.current = newDraftId;
        syncActiveDraftRoute(newDraftId);
      }
      await loadSession(newDraftId);
      showNote('Черновик города добавлен', 'success');
    } catch (err) {
      showNote(parseApiError(err, 'Ошибка добавления города'), 'error');
    }
  }, [sessionId, loadSession, syncActiveDraftRoute, showNote]);

  const handleDeleteDraft = useCallback(async (draftId) => {
    if (!draftId || draftId === 'legacy') return;
    if (!(await confirm({ message: 'Удалить этот черновик города?', danger: true }))) return;
    try {
      await sessionsAPI.deleteCityDraft(sessionId, draftId);
      const normalizedDraftId = normalizeDraftId(draftId);
      const nextDraftId = normalizedDraftId === activeCityDraftIdRef.current ? null : activeCityDraftIdRef.current;
      requestedCityDraftIdRef.current = nextDraftId;
      activeCityDraftIdRef.current = nextDraftId;
      syncActiveDraftRoute(nextDraftId);
      await loadSession(nextDraftId);
      showNote('Черновик города удален', 'success');
    } catch (err) {
      showNote(parseApiError(err, 'Ошибка удаления города'), 'error');
    }
  }, [sessionId, loadSession, syncActiveDraftRoute, showNote, confirm]);

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

  const handleCommonsImageSelect = useCallback(({ imageId: selectedImageId, localUrl, originalUrl, sourceUrl, copyright }) => {
    setImageId(selectedImageId || null);
    setImagePreview(localUrl || '');
    setImageOriginalUrl(originalUrl || sourceUrl || '');
    setImageCopyright(copyright || '');
    showNote('Изображение загружено из Wikimedia Commons', 'success');
  }, [showNote]);

  const getSessionUuid = useCallback(() => session?.uuid || session?.session_uuid || '', [session]);

  const addTag = useCallback((text) => {
    const t = text.trim();
    if (!t || cityTags.includes(t)) return;
    setCityTags(prev => [...prev, t]);
  }, [cityTags]);

  const removeTag = useCallback((tag) => { setCityTags(prev => prev.filter((item) => item !== tag)); }, []);

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
      const emptyInfo = createEmptyCityInfo();

      const res = await cityInfosAPI.create(
        sessionId,
        buildCityInfoPayload(emptyInfo)
      );

      const rawInfo = res?.data?.city_info || res?.data;
      const info = normalizeCityInfo(rawInfo || emptyInfo);

      if (info?.id) {
        setCityInfos((prev) => [...prev, info]);
        setCurrentCityInfo(info);
        setCityInfoActiveLocale('ru-RU');

        showNote('Блок полезной информации добавлен', 'success');
      }
    } catch (e) {
      showNote(
        'Ошибка при добавлении полезной информации: ' + parseApiError(e),
        'error'
      );
    }
  }, [sessionId, showNote]);

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
    const lang = getLocaleLang(cityInfoActiveLocale);

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
  }, [cityInfoActiveLocale]);

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
      const emptyInfo = createEmptyAttractionInfo();

      const res = await attractionInfosAPI.create(
        sessionId,
        buildAttractionInfoPayload(emptyInfo)
      );

      const rawInfo = res?.data?.attraction_info || res?.data;
      const info = normalizeAttractionInfo(rawInfo || emptyInfo);

      if (info?.id) {
        setAttractionInfos((prev) => [...prev, info]);
        setCurrentAttractionInfo(info);
        setAttractionInfoActiveLocale('ru-RU');

        showNote('Блок полезной информации о достопримечательности добавлен', 'success');
      }
    } catch (e) {
      showNote(
        'Ошибка при добавлении полезной информации: ' + parseApiError(e),
        'error'
      );
    }
  }, [sessionId, showNote]);

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
    const lang = getLocaleLang(attractionInfoActiveLocale);

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
  }, [attractionInfoActiveLocale]);

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
  
  const buildAttrLocaleData = useCallback((attr) => {
    const data = {};
    DEFAULT_LOCALE_DEFS.forEach((loc) => {
      data[loc.key] = { lang: loc.lang, code: loc.code, langName: loc.langName, name: (attr.name && attr.name[loc.lang]) || '', description: (attr.description && attr.description[loc.lang]) || '', contentText: (attr.contents && attr.contents[loc.lang]) || '' };
    });
    return data;
  }, []);

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
      };

      const attr = normalizeAttraction(mergedAttr);

      setAttractions((items) =>
        items.map((item) => (String(item.id) === String(attr.id) ? attr : item))
      );

      setCurrentAttr(attr);
      setAttrLocaleData(buildAttrLocaleData(attr));
      setAttrActiveLocale('ru-RU');
      setAttrView('detail');
    } catch (e) {
      showNote('Не удалось открыть достопримечательность: ' + e.message, 'error');
    }
  }, [sessionId, attractions, buildAttrLocaleData, showNote]);

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

  const addAttraction = useCallback(async () => {
    try {
      const nextIndex = attractions.length;

      const res = await attractionsAPI.create(sessionId, {
        name: {},
        description: {},
        lat: null,
        lon: null,

        index: nextIndex,
        rank: 0,

        city: null,
        session_city: null,

        image_id: null,

        // legacy compatibility
        order: nextIndex,
      });

      const rawAttr = res?.data?.attraction || res?.data;
      const attr = normalizeAttraction(rawAttr || {});

      if (attr?.id) {
        setAttractions((prev) => [...prev, attr]);
        setCurrentAttr(attr);
        setAttrLocaleData(buildAttrLocaleData(attr));
        setAttrActiveLocale('ru-RU');
        setAttrView('detail');
        showNote('Достопримечательность добавлена', 'success');
      }
    } catch (e) {
      showNote('Ошибка при добавлении: ' + e.message, 'error');
    }
  }, [sessionId, attractions.length, buildAttrLocaleData, showNote]);

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

  const startAiContent = useCallback(async (attrId, lang) => {
    const attr = attractions.find((item) => item.id === attrId);
    if (!attr) return;
    const cityName = Object.values(localeData)[0]?.name || 'город';
    const attrName = getAttrName(attr);
    clearInterval(aiPollRef.current);
    setAiGenAttrId(attrId);
    setAiGenLang(lang);
    setAiGenText('');
    setAiGenDone(false);
    setAiGenError(null);
    try {
      const r = await aiAPI.streamStart({ prompt: `Напиши подробный текст для туристического приложения о достопримечательности «${attrName}» в городе «${cityName}». Включи историю, интересные факты, что посмотреть. Язык ответа: ${lang}. Объём: 200-350 слов.`, language: lang, system_prompt: 'Ты — эксперт по туризму и культуре. Пиши живо, интересно и информативно.' });
      const sid = r?.data?.stream_id;
      if (!sid) { setAiGenError('Не удалось запустить генерацию'); return; }
      aiPollRef.current = setInterval(async () => {
        try {
          const sr = await aiAPI.streamStatus(sid);
          const sd = sr?.data;
          if (sd?.text) setAiGenText(sd.text);
          if (sd?.done) { clearInterval(aiPollRef.current); setAiGenDone(true); }
          if (sd?.error) { clearInterval(aiPollRef.current); setAiGenError(sd.error); setAiGenDone(true); }
        } catch {
          clearInterval(aiPollRef.current);
          setAiGenError('Ошибка получения результата');
          setAiGenDone(true);
        }
      }, 1500);
    } catch (e) {
      setAiGenError(parseApiError(e, 'Ошибка запуска'));
    }
  }, [attractions, localeData]);

  const saveAiContent = useCallback(async () => {
    if (!aiGenAttrId || !aiGenText.trim()) return;
    setAiGenSaving(true);
    try {
      await attractionsAPI.saveContent(sessionId, aiGenAttrId, { language: aiGenLang, text: aiGenText });
      setAttractions(prev => prev.map((item) => {
        if (item.id !== aiGenAttrId) return item;
        const contents = { ...(item.contents || {}), [aiGenLang]: aiGenText };
        return { ...item, contents };
      }));
      showNote('Контент сохранён', 'success');
    } catch (e) {
      showNote('Ошибка сохранения: ' + parseApiError(e, 'Ошибка сохранения'), 'error');
    } finally {
      setAiGenSaving(false);
    }
  }, [sessionId, aiGenAttrId, aiGenLang, aiGenText, showNote]);

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
    }))) return;
    setPublishing(true);
    try {
      const res = await sessionsAPI.publish(sessionId);
      trackEvent('publish_session_success', {
        sessionId: String(sessionId),
        msFromOpen: sessionOpenedAtRef.current ? (Date.now() - sessionOpenedAtRef.current) : null,
        msFromFirstSave: firstCitySaveAtRef.current ? (Date.now() - firstCitySaveAtRef.current) : null,
      });
      showNote(res?.data?.message || 'Сессия опубликована', 'success');
      await loadSession();
    } catch (err) {
      trackEvent('publish_session_fail', { sessionId: String(sessionId), reason: parseApiError(err, 'Ошибка публикации') });
      showNote(parseApiError(err, 'Ошибка публикации'), 'error');
    } finally {
      setPublishing(false);
    }
  }, [sessionId, loadSession, showNote, confirm]);

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
    imageId, imagePreview, imageOriginalUrl, imageCopyright, setImageOriginalUrl, setImageCopyright, photoUploading, photoFileRef, commonsModalOpen, setCommonsModalOpen,
    cityTags, tagInput, setTagInput, availableTags,
    cityInfos, currentCityInfo, cityInfoLocaleData, cityInfoActiveLocale, cityInfoSaving,
    attractions, attrView, currentAttr, attrLocaleData, attrActiveLocale, attrSaving,
    attractionInfos, currentAttractionInfo, attractionInfoLocaleData, attractionInfoActiveLocale, attractionInfoSaving,    
    aiGenAttrId, aiGenLang, aiGenText, aiGenDone, aiGenError, aiGenSaving,
    saving, closeOpen, closeMode, closing, publishing, translating,
    setAttrView, setCurrentAttr, setAttrActiveLocale, setAiGenLang, setAiGenAttrId, setAiGenText,
    setCloseOpen, setCloseMode,
    setMapContainerRef,
    loadSession, syncActiveDraftRoute, loadCityIntoForm,
    saveCityForStep1,
    goToStep, switchLocale, addLocale, removeLocale, updateLocaleField,
    handleSelectDraft, handleCreateDraft, handleDeleteDraft,
    handlePhotoFile, handleCommonsImageSelect, getSessionUuid,
    addTag, removeTag, handleTagKeyDown, handleTagBlur,
    setCurrentCityInfo, setCityInfoActiveLocale, openCityInfoDetail, addCityInfo, updateCurrentCityInfoPatch, updateCityInfoLocaleField, saveCurrentCityInfo, deleteCurrentCityInfo,
    setCurrentAttractionInfo, setAttractionInfoActiveLocale, openAttractionInfoDetail, addAttractionInfo, updateCurrentAttractionInfoPatch, updateAttractionInfoLocaleField, saveCurrentAttractionInfo, deleteCurrentAttractionInfo,
    openAttrDetail, addAttraction, deleteCurrentAttr, saveCurrentAttr, updateAttrLocaleField, updateCurrentAttrPatch,    startAiContent, saveAiContent,
    handleClose, handlePublish, handleTranslateSession,
    TOTAL_STEPS,
  };
}
