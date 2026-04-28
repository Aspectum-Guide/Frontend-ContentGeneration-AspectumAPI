/**
 * SessionWizard — полная миграция Django ContentGeneration визарда
 *
 * Структура:
 *  Header bar (имя сессии, UUID, дата, статус, кнопки)
 *  Photo tile (слева) + Wizard (справа):
 *    Шаг 1: Город — локальные таблетки, название/описание/страна, карта, координаты
 *    Шаг 2: Теги — тегодробавления с подсказками из city-filters
 *    Шаг 3: Достопримечательности — список + детальный просмотр
 *    Шаг 4: Контент — заглушка
 *    Шаг 5: Публикация
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import 'leaflet/dist/leaflet.css';
import Layout from '../../components/Layout';
import CommonsImagePicker from '../../components/generation/CommonsImagePicker';
import { useLayoutActions } from '../../context/LayoutActionsContext';
import { sessionsAPI, attractionsAPI, cityFiltersAPI, imagesAPI, aiAPI } from '../../api/generation';
import { parseApiError } from '../../utils/apiError';
import { trackEvent } from '../../utils/analytics';

// ─── Constants ────────────────────────────────────────────────────────────────
const TOTAL_STEPS = 5;
const STEP_LABELS = ['Город', 'Теги', 'Достопримечательности', 'Контент', 'Публикация'];

const LOCALE_FLAGS = {
  US: '🇺🇸', IT: '🇮🇹', RU: '🇷🇺', FR: '🇫🇷', DE: '🇩🇪', ES: '🇪🇸',
  JP: '🇯🇵', CN: '🇨🇳', KR: '🇰🇷', GB: '🇬🇧', UA: '🇺🇦', NL: '🇳🇱',
  PL: '🇵🇱', PT: '🇵🇹', TR: '🇹🇷', BR: '🇧🇷', CA: '🇨🇦', AU: '🇦🇺',
};

const LOCALE_INFO_MAP = {
  ru: { code: 'RU', name: 'Русский' }, en: { code: 'US', name: 'Английский' },
  it: { code: 'IT', name: 'Итальянский' }, fr: { code: 'FR', name: 'Французский' },
  de: { code: 'DE', name: 'Немецкий' }, es: { code: 'ES', name: 'Испанский' },
  pl: { code: 'PL', name: 'Польский' }, pt: { code: 'PT', name: 'Португальский' },
  nl: { code: 'NL', name: 'Нидерландский' }, zh: { code: 'CN', name: 'Китайский' },
  ja: { code: 'JP', name: 'Японский' }, ko: { code: 'KR', name: 'Корейский' },
  tr: { code: 'TR', name: 'Турецкий' }, uk: { code: 'UA', name: 'Украинский' },
};

const DEFAULT_LOCALE_DEFS = [
  { key: 'ru-RU', lang: 'ru', code: 'RU', langName: 'Русский', isDefault: true },
  { key: 'en-US', lang: 'en', code: 'US', langName: 'Английский', isDefault: true },
];

const STATUS_MAP = {
  draft:            { label: 'Черновик',            cls: 'bg-gray-100 text-gray-700' },
  in_progress:      { label: 'В процессе',           cls: 'bg-yellow-100 text-yellow-800' },
  completed:        { label: 'Завершена',             cls: 'bg-green-100 text-green-800' },
  published:        { label: 'Опубликована',          cls: 'bg-blue-100 text-blue-800' },
  closed_saved:     { label: 'Закрыта (сохранена)',   cls: 'bg-purple-100 text-purple-700' },
  closed_discarded: { label: 'Закрыта (отменена)',    cls: 'bg-red-100 text-red-700' },
  corrected:        { label: 'Скорректирована',       cls: 'bg-teal-100 text-teal-700' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function makeLocaleData() {
  return Object.fromEntries(
    DEFAULT_LOCALE_DEFS.map(l => [
      l.key,
      { code: l.code, lang: l.lang, langName: l.langName, isDefault: l.isDefault,
        name: '', description: '', country: '' },
    ])
  );
}

function getLocaleInfo(lang) {
  const k = (lang || '').toLowerCase().substring(0, 2);
  return LOCALE_INFO_MAP[k] || { code: (lang || 'XX').toUpperCase().substring(0, 2), name: lang || 'Язык' };
}

function getFlag(code) {
  return LOCALE_FLAGS[(code || '').toUpperCase()] || '🌍';
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

function getAttrName(attr) {
  const n = attr?.name || {};
  return n.ru || n.en || n.it || Object.values(n).find(Boolean) || '(без названия)';
}

function getCityDraftName(draft) {
  const n = draft?.name || {};
  return n.ru || n.en || n.it || Object.values(n).find(Boolean) || 'Новый город';
}

function normalizeDraftId(value) {
  if (value == null || value === '') return null;
  return String(value);
}

// ─── Notification toast ───────────────────────────────────────────────────────
function Notification({ note }) {
  if (!note) return null;
  const colorMap = { success: 'bg-green-600', error: 'bg-red-600', info: 'bg-blue-600', warning: 'bg-yellow-500' };
  return (
    <div className={`fixed top-5 right-5 z-50 px-4 py-3 rounded-lg text-white text-sm shadow-lg transition-all ${colorMap[note.type] || colorMap.info}`}>
      {note.msg}
    </div>
  );
}

// ─── StatusBadge ─────────────────────────────────────────────────────────────
function StatusBadge({ status, label }) {
  const s = STATUS_MAP[status] || { label: label || status, cls: 'bg-gray-100 text-gray-600' };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${s.cls}`}>
      {label || s.label}
    </span>
  );
}

function parseMapCoord(value) {
  if (value === null || value === undefined) return NaN;

  return parseFloat(
    String(value)
      .trim()
      .replace(',', '.')
  );
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

// ─── LocalePills component ─────────────────────────────────────────────────────
function LocalePills({ localeData, activeLocale, defaultLocale, onSwitch, onSetDefault, onAddLocale, onRemoveLocale }) {
  return (
    <div className="flex items-center gap-1 flex-wrap mb-4">
      {Object.keys(localeData).map(key => {
        const loc = localeData[key];
        const isActive = key === activeLocale;
        const isDefault = key === defaultLocale;
        return (
          <div key={key} className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => onSwitch(key)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                isActive
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400 hover:text-blue-600'
              }`}
            >
              <span>{getFlag(loc.code)}</span>
              <span>{loc.langName}</span>
            </button>
            <button
              type="button"
              title={isDefault ? 'Язык по умолчанию' : 'Установить как язык по умолчанию'}
              onClick={() => onSetDefault(key)}
              className={`text-xs px-1 transition-colors ${isDefault ? 'text-yellow-500' : 'text-gray-300 hover:text-yellow-400'}`}
            >
              ★
            </button>
            {!loc.isDefault && (
              <button
                type="button"
                title="Удалить адаптацию"
                onClick={() => onRemoveLocale(key)}
                className="text-xs text-gray-300 hover:text-red-400 transition-colors px-0.5"
              >
                ×
              </button>
            )}
          </div>
        );
      })}
      <button
        type="button"
        title="Добавить адаптацию"
        onClick={onAddLocale}
        className="w-6 h-6 rounded-full border-2 border-dashed border-gray-300 text-gray-400 hover:border-blue-400 hover:text-blue-500 text-sm font-bold flex items-center justify-center transition-colors"
      >
        +
      </button>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function SessionWizard() {
  const { setMobileActions } = useLayoutActions();
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  // ── Notification ─────────────────────────────────────────────────────────
  const [note, setNote] = useState(null);
  const showNote = useCallback((msg, type = 'info') => {
    setNote({ msg, type });
    setTimeout(() => setNote(null), 3500);
  }, []);

  // ── Session ───────────────────────────────────────────────────────────────
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cityDrafts, setCityDrafts] = useState([]);
  const [activeCityDraftId, setActiveCityDraftId] = useState(null);
  const activeCityDraftIdRef = useRef(null);

  // ── Wizard step ───────────────────────────────────────────────────────────
  const [currentStep, setCurrentStep] = useState(1);

  // ── Step 1 — Locales ─────────────────────────────────────────────────────
  const [localeData, setLocaleData] = useState(makeLocaleData);
  const [activeLocale, setActiveLocale] = useState('ru-RU');
  const [defaultLocale, setDefaultLocale] = useState('ru-RU');
  const [addLocaleOpen, setAddLocaleOpen] = useState(false);
  const [newLocaleCode, setNewLocaleCode] = useState('');
  const [newLocaleLang, setNewLocaleLang] = useState('');

  // ── Step 1 — Coords ───────────────────────────────────────────────────────
  const [lat, setLat] = useState('');
  const [lon, setLon] = useState('');
  const [savedLat, setSavedLat] = useState(null);
  const [savedLon, setSavedLon] = useState(null);

  // ── Step 1 — Photo ────────────────────────────────────────────────────────
  const [imageId, setImageId] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [imageCopyright, setImageCopyright] = useState('');
  const [photoUploading, setPhotoUploading] = useState(false);
  const photoFileRef = useRef(null);
  const [commonsModalOpen, setCommonsModalOpen] = useState(false);

  // ── Step 2 — Tags ─────────────────────────────────────────────────────────
  const [cityTags, setCityTags] = useState([]);
  const [tagInput, setTagInput] = useState('');
  const [availableTags, setAvailableTags] = useState([]);

  // ── Step 3 — Attractions ──────────────────────────────────────────────────
  const [attractions, setAttractions] = useState([]);
  const [attrView, setAttrView] = useState('list'); // 'list' | 'detail'
  const [currentAttr, setCurrentAttr] = useState(null);
  const [attrLocaleData, setAttrLocaleData] = useState({});
  const [attrActiveLocale, setAttrActiveLocale] = useState('ru-RU');
  const [attrSaving, setAttrSaving] = useState(false);
  const [attractionsLoaded, setAttractionsLoaded] = useState(false);

  // ── Step 4 — AI Content ───────────────────────────────────────────────────
  const [aiGenAttrId, setAiGenAttrId] = useState(null);
  const [aiGenLang, setAiGenLang] = useState('ru');
  const [aiGenText, setAiGenText] = useState('');
  const [aiGenDone, setAiGenDone] = useState(false);
  const [aiGenError, setAiGenError] = useState(null);
  const [aiGenSaving, setAiGenSaving] = useState(false);
  const aiPollRef = useRef(null);

  // ── Saving / Close ────────────────────────────────────────────────────────
  const [saving, setSaving] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [closeMode, setCloseMode] = useState('save');
  const [closing, setClosing] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [translating, setTranslating] = useState(false);
  const sessionOpenedAtRef = useRef(null);
  const firstCitySaveAtRef = useRef(null);

  // ── Map ───────────────────────────────────────────────────────────────────
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  const mapReadyRef = useRef(false);
  const [mapNode, setMapNode] = useState(null);
  const setMapContainerRef = useCallback((node) => {
  mapRef.current = node;
  setMapNode(node);
  }, []);

  const requestedCityDraftIdRef = useRef(null);

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

  // ─────────────────────────────────────────────────────────────────────────
  // Load session
  // ─────────────────────────────────────────────────────────────────────────
  const loadSession = useCallback(async (preferredDraftId = null) => {
    try {
      setLoading(true);
      console.log('Loading session:', sessionId);
      const res = await sessionsAPI.get(sessionId);
      const data = res?.data;
      console.log('Session loaded:', data);
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
      if (selectedDraft) {
        loadCityIntoForm(selectedDraft);
      } else if (fallbackDraft) {
        loadCityIntoForm(fallbackDraft);
      } else {
        console.log('No city draft data in session');
      }
      if (Array.isArray(data?.attractions)) setAttractions(data.attractions);
    } catch (err) {
      console.error('Failed to load session:', err);
      showNote('Не удалось загрузить сессию: ' + parseApiError(err, 'Ошибка загрузки'), 'error');
      navigate('/generation');
    } finally {
      setLoading(false);
    }
  }, [sessionId, navigate, showNote]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadSession(); }, [loadSession]);
  useEffect(() => () => clearInterval(aiPollRef.current), []);

  // ─────────────────────────────────────────────────────────────────────────
  // Load city data into form (mirrors loadCityIntoForm from cg-wizard.js)
  // ─────────────────────────────────────────────────────────────────────────
  const loadCityIntoForm = useCallback((city) => {
    console.log('loadCityIntoForm called with city:', city);
    if (!city) {
      console.log('City is null/undefined, skipping');
      return;
    }
    const latVal = city.lat != null ? String(city.lat) : '';
    const lonVal = city.lon != null ? String(city.lon) : '';
    console.log('Setting lat/lon:', latVal, lonVal);
    setLat(latVal);
    setLon(lonVal);
    if (city.lat != null) setSavedLat(city.lat);
    if (city.lon != null) setSavedLon(city.lon);

    setCityTags(Array.isArray(city.tags) ? city.tags.slice() : []);
    setImagePreview(city.image_url || '');
    setImageId(city.image_id || null);
    setImageCopyright(city.image_copyright || '');

    const nameObj = city.name || {};
    const descObj = city.description || {};
    const countryRaw = city.country;
    const countryObj = countryRaw && typeof countryRaw === 'object'
      ? countryRaw
      : (typeof countryRaw === 'string' && countryRaw.trim() ? { en: countryRaw.trim() } : {});

    const newLocale = makeLocaleData();
    const allKeys = [...new Set([...Object.keys(nameObj), ...Object.keys(descObj), ...Object.keys(countryObj)])];

    allKeys.forEach(rawKey => {
      const lang = (rawKey.includes('-') ? rawKey.split('-')[0] : rawKey).toLowerCase().substring(0, 2);
      const info = getLocaleInfo(lang);
      const key = `${lang}-${info.code}`;
      if (!newLocale[key]) {
        newLocale[key] = { code: info.code, lang, langName: info.name, isDefault: false, name: '', description: '', country: '' };
      }
      const resolve = (obj) => {
        const v = obj[key] ?? obj[lang] ?? obj[rawKey] ?? '';
        return typeof v === 'string' ? v : (v?.text || '');
      };
      newLocale[key].name = resolve(nameObj);
      newLocale[key].description = resolve(descObj);
      newLocale[key].country = resolve(countryObj);
    });

    setLocaleData(newLocale);
    const pref = newLocale['ru-RU'] ? 'ru-RU' : Object.keys(newLocale)[0] || 'ru-RU';
    setDefaultLocale(pref);
    setActiveLocale(pref);
    console.log('loadCityIntoForm completed');
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // Leaflet map init - runs when map DOM node is actually mounted
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapNode) {
      console.log('Map init: mapNode is null, waiting...');
      return;
    }

    if (mapInstanceRef.current?.map) {
      console.log('Map already initialized, invalidating size...');

      requestAnimationFrame(() => {
        mapInstanceRef.current?.map?.invalidateSize();
      });

      return;
    }

    let cancelled = false;

    console.log('Initializing Leaflet map...');

    import('leaflet')
      .then(({ default: L }) => {
        if (cancelled || !mapNode || mapInstanceRef.current?.map) return;

        console.log('Leaflet library loaded');

        delete L.Icon.Default.prototype._getIconUrl;

        L.Icon.Default.mergeOptions({
          iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
          iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
          shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
        });

        const map = L.map(mapNode, {
          zoomControl: true,
          attributionControl: true,
        }).setView([55.75, 37.62], 3);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap contributors',
          maxZoom: 19,
          minZoom: 2,
        }).addTo(map);

        const updateMarker = (latValue, lonValue) => {
          const parsedLat = parseMapCoord(latValue);
          const parsedLon = parseMapCoord(lonValue);

          if (
            !Number.isFinite(parsedLat) ||
            !Number.isFinite(parsedLon) ||
            parsedLat < -90 ||
            parsedLat > 90 ||
            parsedLon < -180 ||
            parsedLon > 180
          ) {
            if (markerRef.current) {
              map.removeLayer(markerRef.current);
              markerRef.current = null;
            }

            return;
          }

          const nextLatLng = [parsedLat, parsedLon];

          if (markerRef.current) {
            markerRef.current.setLatLng(nextLatLng);
          } else {
            markerRef.current = L.marker(nextLatLng).addTo(map);
          }

          map.setView(nextLatLng, 12);

          requestAnimationFrame(() => {
            map.invalidateSize();
          });

          console.log('Marker updated:', parsedLat, parsedLon);
        };

        map.on('click', (e) => {
          console.log('Map clicked:', e.latlng);

          setLat(e.latlng.lat.toFixed(6));
          setLon(e.latlng.lng.toFixed(6));
        });

        mapInstanceRef.current = {
          map,
          updateMarker,
        };

        mapReadyRef.current = true;

        console.log('Map initialized successfully!');

        setTimeout(() => {
          map.invalidateSize();
        }, 0);

        setTimeout(() => {
          map.invalidateSize();
        }, 250);

        if (hasValidMapCoords(lat, lon)) {
          console.log('Applying existing coords:', lat, lon);
          updateMarker(lat, lon);
        }
      })
      .catch((err) => {
        console.error('Failed to load Leaflet:', err);
      });

    return () => {
      cancelled = true;

      if (mapInstanceRef.current?.map) {
        mapInstanceRef.current.map.remove();
        mapInstanceRef.current = null;
        markerRef.current = null;
        mapReadyRef.current = false;

        console.log('Map cleaned up');
      }
    };
  }, [mapNode]); // important: init when the map DOM node appears

  // Sync map marker when lat/lon state changes
  useEffect(() => {
    if (!mapReadyRef.current || !mapInstanceRef.current?.updateMarker) {
      return;
    }

    mapInstanceRef.current.updateMarker(lat, lon);
  }, [lat, lon]);

  // ─────────────────────────────────────────────────────────────────────────
  // Load city tags for step 2
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    cityFiltersAPI.list().then(res => {
      const data = res?.data;
      const tags = Array.isArray(data?.tags) ? data.tags
        : Array.isArray(data?.results) ? data.results
        : Array.isArray(data) ? data : [];
      setAvailableTags(tags);
    }).catch(() => {});
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // Load attractions when entering step 3
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (currentStep === 3 && !attractionsLoaded) {
      loadAttractions();
    }
  }, [currentStep]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadAttractions = useCallback(async () => {
    try {
      const res = await sessionsAPI.get(sessionId);
      const list = res?.data?.attractions || [];
      setAttractions(list);
      setAttractionsLoaded(true);
    } catch (e) {
      showNote('Не удалось загрузить достопримечательности', 'error');
    }
  }, [sessionId, showNote]);

  // ─────────────────────────────────────────────────────────────────────────
  // Save city (mirrors saveCityForStep1 from cg-wizard.js)
  // ─────────────────────────────────────────────────────────────────────────
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
      showNote(`Необходимо указать страну (для языка по умолчанию)`, 'error');
      setActiveLocale(defaultLocale);
      throw new Error('missing-country');
    }

    const name = {}, description = {}, country = {};
    Object.entries(localeData).forEach(([key, loc]) => {
      if (!loc?.lang) return;

      const localeName = loc.name?.trim() || '';
      const localeDescription = loc.description?.trim() || '';
      const localeCountry = loc.country?.trim() || '';

      const shouldPersistLocale = !!(
        localeName ||
        localeDescription ||
        localeCountry ||
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
      name, description, country,
      lat: lat ? parseFloat(lat) : null,
      lon: lon ? parseFloat(lon) : null,
      default_language: localeData[defaultLocale]?.lang || null,
      tags: cityTags,
      image_id: imageId,
      ...(activeCityDraftIdRef.current && activeCityDraftIdRef.current !== 'legacy'
        ? { draft_id: activeCityDraftIdRef.current }
        : {}),
    };

    console.log('[SessionWizard] saving city payload', payload);

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
      if (savedCity?.image_url) {
        setImagePreview(savedCity.image_url);
        if (savedCity.image_id != null) setImageId(savedCity.image_id);
      }
      if (data?.status) {
        setSession(prev => prev ? { ...prev, status: data.status, status_display: data.status_display } : prev);
      }
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
        trackEvent('save_city_success', {
          sessionId: String(sessionId),
          firstSave: true,
          msFromOpen: sessionOpenedAtRef.current ? (firstCitySaveAtRef.current - sessionOpenedAtRef.current) : null,
        });
      } else {
        trackEvent('save_city_success', {
          sessionId: String(sessionId),
          firstSave: false,
        });
      }

      return data;
    } catch (err) {
      trackEvent('save_city_fail', {
        sessionId: String(sessionId),
        reason: parseApiError(err, 'Ошибка сохранения'),
      });
      showNote('Ошибка при сохранении города: ' + parseApiError(err, 'Ошибка сохранения'), 'error');
      throw err;
    } finally {
      setSaving(false);
    }
  }, [sessionId, localeData, defaultLocale, lat, lon, cityTags, imageId, showNote, loadSession, syncActiveDraftRoute]);

  // ─────────────────────────────────────────────────────────────────────────
  // Step navigation
  // ─────────────────────────────────────────────────────────────────────────
  const goToStep = useCallback(async (target) => {
    if (target < 1 || target > TOTAL_STEPS || target === currentStep) return;
    // Auto-save city when leaving step 1 or 2 going forward
    if ((currentStep === 1 || currentStep === 2) && target > currentStep) {
      try {
        await saveCityForStep1();
      } catch {
        return; // Validation failed, stay on current step
      }
    }
    setCurrentStep(target);
  }, [currentStep, saveCityForStep1]);

  // ─────────────────────────────────────────────────────────────────────────
  // Locale management
  // ─────────────────────────────────────────────────────────────────────────
  const switchLocale = useCallback((key) => {
    setActiveLocale(key);
  }, []);

  const addLocale = useCallback(() => {
    const code = newLocaleCode.trim().toUpperCase();
    const langName = newLocaleLang.trim();

    if (!/^[A-Z]{2}$/.test(code)) {
      showNote('Введите корректный двухбуквенный код страны', 'error');
      return;
    }

    if (!langName) {
      showNote('Введите название языка', 'error');
      return;
    }

    const lang = resolveBackendLanguageCode(langName);

    if (!lang) {
      showNote('Этот язык пока не поддерживается. Доступны: Italian, English, Russian, French, German, Spanish.', 'error');
      return;
    }

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
        country: code,
      },
    }));

    setActiveLocale(key);
    setAddLocaleOpen(false);
    setNewLocaleCode('');
    setNewLocaleLang('');
    showNote(`Адаптация "${langName} (${code})" добавлена`, 'success');
  }, [newLocaleCode, newLocaleLang, localeData, showNote]);

  const removeLocale = useCallback((key) => {
    if (localeData[key]?.isDefault) { showNote('Предустановленные языки нельзя удалять', 'error'); return; }
    setLocaleData(prev => { const n = { ...prev }; delete n[key]; return n; });
    if (activeLocale === key) {
      const remaining = Object.keys(localeData).filter(k => k !== key);
      if (remaining.length) setActiveLocale(remaining[0]);
    }
    if (defaultLocale === key) {
      const remaining = Object.keys(localeData).filter(k => k !== key);
      if (remaining.length) setDefaultLocale(remaining[0]);
    }
  }, [localeData, activeLocale, defaultLocale]);

  const updateLocaleField = useCallback((field, value) => {
    setLocaleData(prev => ({
      ...prev,
      [activeLocale]: { ...prev[activeLocale], [field]: value },
    }));
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
  }, [sessionId, loadSession, showNote, syncActiveDraftRoute]);

  const handleDeleteDraft = useCallback(async (draftId) => {
    if (!draftId || draftId === 'legacy') return;
    if (!confirm('Удалить этот черновик города?')) return;
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
  }, [sessionId, loadSession, showNote, syncActiveDraftRoute]);

  // ─────────────────────────────────────────────────────────────────────────
  // Photo upload
  // ─────────────────────────────────────────────────────────────────────────
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
      const { id, url } = res?.data || {};
      if (id && url) {
        setImageId(id);
        setImagePreview(url);
        showNote('Изображение загружено', 'success');
      }
    } catch (err) {
      showNote('Ошибка загрузки: ' + parseApiError(err, 'Ошибка загрузки'), 'error');
    } finally {
      setPhotoUploading(false);
    }
  }, [session, localeData, activeLocale, imageCopyright, showNote]);

  // ─────────────────────────────────────────────────────────────────────────
  // Commons image selection
  // ─────────────────────────────────────────────────────────────────────────
  const handleCommonsImageSelect = useCallback(({ imageId, localUrl, copyright }) => {
    setImageId(imageId);
    setImagePreview(localUrl);
    setImageCopyright(copyright);
    showNote('Изображение загружено из Wikimedia Commons', 'success');
  }, [showNote]);

  const getSessionUuid = useCallback(() => {
    return session?.uuid || session?.session_uuid || '';
  }, [session]);

  // ─────────────────────────────────────────────────────────────────────────
  // Tags
  // ─────────────────────────────────────────────────────────────────────────
  const addTag = useCallback((text) => {
    const t = text.trim();
    if (!t || cityTags.includes(t)) return;
    setCityTags(prev => [...prev, t]);
  }, [cityTags]);

  const removeTag = useCallback((t) => {
    setCityTags(prev => prev.filter(x => x !== t));
  }, []);

  const handleTagKeyDown = useCallback((e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const v = tagInput.trim().replace(/,$/, '');
      if (v) { addTag(v); setTagInput(''); }
    }
  }, [tagInput, addTag]);

  const handleTagBlur = useCallback(() => {
    if (tagInput.trim()) { addTag(tagInput.trim()); setTagInput(''); }
  }, [tagInput, addTag]);

  // ─────────────────────────────────────────────────────────────────────────
  // Attractions
  // ─────────────────────────────────────────────────────────────────────────
  const buildAttrLocaleData = useCallback((attr) => {
    const data = {};
    DEFAULT_LOCALE_DEFS.forEach(loc => {
      data[loc.key] = {
        lang: loc.lang, code: loc.code, langName: loc.langName,
        name: (attr.name && attr.name[loc.lang]) || '',
        description: (attr.description && attr.description[loc.lang]) || '',
        contentText: (attr.contents && attr.contents[loc.lang]) || '',
      };
    });
    return data;
  }, []);

  const openAttrDetail = useCallback(async (attrId) => {
    try {
      const res = await attractionsAPI.get(sessionId, attrId);
      const attr = res?.data?.attraction || attractions.find(a => a.id === attrId);
      if (!attr) return;
      setCurrentAttr(attr);
      setAttrLocaleData(buildAttrLocaleData(attr));
      setAttrActiveLocale('ru-RU');
      setAttrView('detail');
    } catch (e) {
      showNote('Не удалось открыть достопримечательность: ' + e.message, 'error');
    }
  }, [sessionId, attractions, buildAttrLocaleData, showNote]);

  const addAttraction = useCallback(async () => {
    try {
      const res = await attractionsAPI.create(sessionId, {});
      const attr = res?.data?.attraction;
      if (attr) {
        setAttractions(prev => [...prev, attr]);
        setCurrentAttr(attr);
        setAttrLocaleData(buildAttrLocaleData(attr));
        setAttrActiveLocale('ru-RU');
        setAttrView('detail');
        showNote('Достопримечательность добавлена', 'success');
      }
    } catch (e) {
      showNote('Ошибка при добавлении: ' + e.message, 'error');
    }
  }, [sessionId, buildAttrLocaleData, showNote]);

  const saveCurrentAttr = useCallback(async () => {
    if (!currentAttr) return;
    setAttrSaving(true);
    try {
      const name = {}, description = {};
      Object.values(attrLocaleData).forEach(d => {
        if (d.name || d.description) {
          name[d.lang] = d.name || '';
          description[d.lang] = d.description || '';
        }
      });
      const updated = await attractionsAPI.update(sessionId, currentAttr.id, { name, description });
      if (updated?.data?.attraction) {
        setAttractions(prev => prev.map(a => a.id === currentAttr.id ? { ...a, ...updated.data.attraction } : a));
        setCurrentAttr(prev => ({ ...prev, ...updated.data.attraction }));
      }
      // Save content for each locale
      await Promise.all(
        Object.values(attrLocaleData).map(d =>
          attractionsAPI.saveContent(sessionId, currentAttr.id, { language: d.lang, text: d.contentText || '' })
        )
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
    if (!confirm(`Удалить «${name}»?`)) return;
    try {
      await attractionsAPI.delete(sessionId, currentAttr.id);
      setAttractions(prev => prev.filter(a => a.id !== currentAttr.id));
      setAttrView('list');
      setCurrentAttr(null);
      showNote('Удалено', 'success');
    } catch (e) {
      showNote('Ошибка при удалении: ' + e.message, 'error');
    }
  }, [sessionId, currentAttr, showNote]);

  const updateAttrLocaleField = useCallback((field, value) => {
    setAttrLocaleData(prev => ({
      ...prev,
      [attrActiveLocale]: { ...prev[attrActiveLocale], [field]: value },
    }));
  }, [attrActiveLocale]);

  // ─────────────────────────────────────────────────────────────────────────
  // Step 4: AI content generation helpers
  // ─────────────────────────────────────────────────────────────────────────
  const startAiContent = useCallback(async (attrId, lang) => {
    const attr = attractions.find(a => a.id === attrId);
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
      const r = await aiAPI.streamStart({
        prompt: `Напиши подробный текст для туристического приложения о достопримечательности «${attrName}» в городе «${cityName}». Включи историю, интересные факты, что посмотреть. Язык ответа: ${lang}. Объём: 200-350 слов.`,
        language: lang,
        system_prompt: 'Ты — эксперт по туризму и культуре. Пиши живо, интересно и информативно.',
      });
      const sid = r?.data?.stream_id;
      if (!sid) { setAiGenError('Не удалось запустить генерацию'); return; }
      aiPollRef.current = setInterval(async () => {
        try {
          const sr = await aiAPI.streamStatus(sid);
          const sd = sr?.data;
          if (sd?.text) setAiGenText(sd.text);
          if (sd?.done) {
            clearInterval(aiPollRef.current);
            setAiGenDone(true);
          }
          if (sd?.error) {
            clearInterval(aiPollRef.current);
            setAiGenError(sd.error);
            setAiGenDone(true);
          }
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
      setAttractions(prev => prev.map(a => {
        if (a.id !== aiGenAttrId) return a;
        const contents = { ...(a.contents || {}), [aiGenLang]: aiGenText };
        return { ...a, contents };
      }));
      showNote('Контент сохранён', 'success');
    } catch (e) {
      showNote('Ошибка сохранения: ' + parseApiError(e, 'Ошибка сохранения'), 'error');
    } finally {
      setAiGenSaving(false);
    }
  }, [sessionId, aiGenAttrId, aiGenLang, aiGenText, showNote]);

  // ─────────────────────────────────────────────────────────────────────────
  // Close session
  // ─────────────────────────────────────────────────────────────────────────
  const handleClose = useCallback(async () => {
    setClosing(true);
    try {
      await sessionsAPI.close(sessionId, closeMode);
      trackEvent('close_session_mode', {
        sessionId: String(sessionId),
        mode: closeMode,
        result: 'success',
      });
      setCloseOpen(false);
      navigate('/generation');
    } catch (err) {
      trackEvent('close_session_mode', {
        sessionId: String(sessionId),
        mode: closeMode,
        result: 'fail',
        reason: parseApiError(err, 'Ошибка закрытия'),
      });
      showNote(parseApiError(err, 'Ошибка закрытия сессии'), 'error');
    } finally {
      setClosing(false);
    }
  }, [sessionId, closeMode, navigate, showNote]);

  // ─────────────────────────────────────────────────────────────────────────
  // Publish session
  // ─────────────────────────────────────────────────────────────────────────
  const handlePublish = useCallback(async () => {
    if (!confirm('Опубликовать всю сессию? Данные будут записаны в основную базу.')) return;
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
      trackEvent('publish_session_fail', {
        sessionId: String(sessionId),
        reason: parseApiError(err, 'Ошибка публикации'),
      });
      showNote(parseApiError(err, 'Ошибка публикации'), 'error');
    } finally {
      setPublishing(false);
    }
  }, [sessionId, loadSession, showNote]);

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

    const languagesFromDrafts = (Array.isArray(cityDrafts) ? cityDrafts : [])
      .flatMap((draft) => collectLanguageKeys(draft));

    const languagesFromLegacyCity = collectLanguageKeys(session?.city || {});

    const targetLanguages = [...new Set([
      ...languagesFromLocaleData,
      ...languagesFromDrafts,
      ...languagesFromLegacyCity,
    ])];

    const payload = {
      target_languages: targetLanguages,
      scope: 'all_drafts',
    };

    setTranslating(true);

    try {
      const res = await sessionsAPI.translate(sessionId, payload);
      showNote(res?.data?.message || 'Перевод всех городов завершен', 'success');

      // После перевода оставляем пользователя на том же выбранном городе
      await loadSession(currentDraftId);
    } catch (err) {
      showNote(parseApiError(err, 'Ошибка перевода'), 'error');
    } finally {
      setTranslating(false);
    }
  }, [sessionId, cityDrafts, session, localeData, loadSession, showNote]);

  const isCorrectionMode = session?.closed_with_save === true;
  const isActive = session?.status === 'draft' || session?.status === 'in_progress';

  useEffect(() => {
    const actions = [
      {
        id: 'save-city-data',
        label: saving ? 'Сохранение...' : 'Сохранить город',
        onClick: () => {
          if (!saving) saveCityForStep1();
        },
        disabled: saving,
        variant: 'primary',
      },
    ];

    if (!isCorrectionMode) {
      actions.push({
        id: 'publish-session',
        label: publishing ? 'Публикация...' : 'Опубликовать сессию',
        onClick: () => {
          if (!publishing) handlePublish();
        },
        disabled: publishing,
      });
    }

    if (isActive) {
      actions.push({
        id: 'close-session',
        label: 'Закрыть сессию',
        onClick: () => {
          setCloseMode('save');
          setCloseOpen(true);
        },
        variant: 'danger',
      });
    }

    setMobileActions(actions);

    return () => setMobileActions([]);
  }, [setMobileActions, saving, publishing, saveCityForStep1, handlePublish, isCorrectionMode, isActive]);

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────
  const currentLocale = localeData[activeLocale] || {};
  const attrCurrentLocale = attrLocaleData[attrActiveLocale] || {};

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-24">
          <div className="flex items-center gap-3 text-gray-500">
            <div className="animate-spin w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full" />
            <span>Загрузка сессии...</span>
          </div>
        </div>
      </Layout>
    );
  }

  if (!session) {
    return (
      <Layout>
        <div className="text-center py-24 text-red-600">Сессия не найдена</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <Notification note={note} />

      {(saving || publishing || closing || photoUploading || aiGenSaving || translating) && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800 flex items-center gap-2">
          <span className="animate-spin w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full" />
          <span>
            {saving && 'Сохраняем данные города...'}
            {publishing && 'Публикуем сессию...'}
            {closing && 'Закрываем сессию...'}
            {photoUploading && 'Загружаем изображение...'}
            {aiGenSaving && 'Сохраняем AI-контент...'}
            {translating && 'Переводим сессию на другие языки...'}
          </span>
        </div>
      )}

      {/* ── Header bar ───────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 mb-5 pb-4 border-b border-gray-200">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{session.name || 'Сессия генерации контента'}</h1>
          <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
            <span><span className="text-gray-400">UID:</span> <span className="font-mono">{session.uuid || session.session_uuid || session.id}</span></span>
            {session.created_at && (
              <span>
                <span className="text-gray-400">Дата начала:</span>{' '}
                {new Date(session.created_at).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
            <StatusBadge status={session.status} label={session.status_display} />
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => navigate('/generation')}
            title="Назад к списку"
            className="px-3 py-1.5 text-sm text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            ← Назад
          </button>
          <button
            onClick={() => saveCityForStep1()}
            disabled={saving}
            title={isCorrectionMode ? 'Сохранить корректировки' : 'Сохранить'}
            className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Сохранение...' : (isCorrectionMode ? 'Сохранить корректировки' : 'Сохранить город')}
          </button>
        </div>
      </div>

      {/* ── Main layout ──────────────────────────────────────────────────── */}
      <div className="flex gap-5 items-start">

        {/* ── Photo tile ─────────────────────────────────────────────────── */}
        <aside className="w-52 shrink-0 space-y-3">
          <div className="relative aspect-[3/4] bg-gray-100 rounded-xl overflow-hidden border border-gray-200 flex items-center justify-center">
            {imagePreview ? (
              <img src={imagePreview} alt="Фото города" className="w-full h-full object-cover" />
            ) : (
              <span className="text-gray-400 text-sm">Фото</span>
            )}
            {photoUploading && (
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                <div className="animate-spin w-6 h-6 border-2 border-white border-t-transparent rounded-full" />
              </div>
            )}
            {/* Commons button overlay */}
            <button
              type="button"
              onClick={() => setCommonsModalOpen(true)}
              className="absolute top-2 right-2 px-2 py-1 text-xs bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors shadow-lg"
              title="Подобрать в Wikimedia Commons"
            >
              ✦ Commons
            </button>
          </div>
          <div>
            <label className="block w-full text-center text-xs text-blue-600 bg-blue-50 border border-blue-200 rounded-lg py-1.5 cursor-pointer hover:bg-blue-100 transition-colors">
              + Добавить фото
              <input ref={photoFileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoFile} />
            </label>
          </div>
          <div className="space-y-1.5">
            <div>
              <label className="block text-xs text-gray-500 mb-0.5">URL</label>
              <input
                type="url"
                value={imagePreview}
                onChange={e => { setImagePreview(e.target.value); setImageId(null); }}
                placeholder="https://..."
                className="w-full px-2 py-1 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-0.5">Авторские права</label>
              <input
                type="text"
                value={imageCopyright}
                onChange={e => setImageCopyright(e.target.value)}
                placeholder="© Автор / Источник"
                className="w-full px-2 py-1 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
            </div>
          </div>
        </aside>

        {/* ── Wizard ─────────────────────────────────────────────────────── */}
        <main className="flex-1 min-w-0">
          {/* Progress bar */}
          <div className="mb-5">
            <div className="relative h-1.5 bg-gray-200 rounded-full mb-3">
              <div
                className="absolute inset-y-0 left-0 bg-blue-600 rounded-full transition-all duration-300"
                style={{ width: `${((currentStep - 1) / (TOTAL_STEPS - 1)) * 100}%` }}
              />
            </div>
            <div className="flex">
              {STEP_LABELS.map((label, i) => {
                const step = i + 1;
                const isCompleted = step < currentStep;
                const isActive = step === currentStep;
                return (
                  <button
                    key={step}
                    type="button"
                    onClick={() => goToStep(step)}
                    className={`flex-1 text-xs py-1 px-1 text-center transition-colors border-b-2 ${
                      isActive
                        ? 'border-blue-600 text-blue-700 font-semibold'
                        : isCompleted
                        ? 'border-blue-300 text-blue-500 hover:text-blue-700 cursor-pointer'
                        : 'border-transparent text-gray-400 hover:text-gray-600 cursor-pointer'
                    }`}
                  >
                    {step}. {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ─── Step 1: Город ─────────────────────────────────────────── */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Город</h2>
                <p className="text-sm text-gray-500">Название, описание, страна и координаты</p>
              </div>

              <div className="p-3 border border-gray-200 rounded-xl bg-gray-50">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-gray-800">Черновики городов в сессии</p>
                  <button
                    type="button"
                    onClick={handleCreateDraft}
                    className="px-2.5 py-1 text-xs font-medium text-blue-700 bg-blue-100 rounded-md hover:bg-blue-200 transition-colors"
                  >
                    + Добавить город
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {cityDrafts.length === 0 ? (
                    <span className="text-xs text-gray-500">Пока нет черновиков</span>
                  ) : cityDrafts.map((draft) => {
                    const isActiveDraft = normalizeDraftId(draft.id) === activeCityDraftId;
                    return (
                      <div
                        key={draft.id}
                        className={`flex items-center gap-1 px-2 py-1 rounded-lg border ${isActiveDraft ? 'bg-blue-50 border-blue-300' : 'bg-white border-gray-200'}`}
                      >
                        <button
                          type="button"
                          onClick={() => handleSelectDraft(draft.id)}
                          className={`text-xs ${isActiveDraft ? 'text-blue-700 font-medium' : 'text-gray-700'}`}
                        >
                          {getCityDraftName(draft)}
                        </button>
                        {draft.id !== 'legacy' && (
                          <button
                            type="button"
                            onClick={() => handleDeleteDraft(draft.id)}
                            className="text-xs text-red-500 hover:text-red-700"
                            title="Удалить черновик"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Locale pills */}
              <LocalePills
                localeData={localeData}
                activeLocale={activeLocale}
                defaultLocale={defaultLocale}
                onSwitch={switchLocale}
                onSetDefault={setDefaultLocale}
                onAddLocale={() => setAddLocaleOpen(true)}
                onRemoveLocale={removeLocale}
              />

              {/* Two columns: fields | map */}
              <div className="grid grid-cols-2 gap-5">
                {/* Fields */}
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Название города ({currentLocale.lang?.toUpperCase() || activeLocale.split('-')[0].toUpperCase()})
                    </label>
                    <input
                      type="text"
                      value={currentLocale.name || ''}
                      onChange={e => updateLocaleField('name', e.target.value)}
                      placeholder={`Например, ${currentLocale.name || 'название'}`}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Описание ({currentLocale.lang?.toUpperCase() || activeLocale.split('-')[0].toUpperCase()})
                    </label>
                    <textarea
                      value={currentLocale.description || ''}
                      onChange={e => updateLocaleField('description', e.target.value)}
                      rows={4}
                      placeholder={`Описание города на ${currentLocale.langName?.toLowerCase() || 'языке'}`}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Страна ({currentLocale.lang?.toUpperCase() || activeLocale.split('-')[0].toUpperCase()})
                    </label>
                    <input
                      type="text"
                      value={currentLocale.country || ''}
                      onChange={e => updateLocaleField('country', e.target.value)}
                      placeholder={currentLocale.lang === 'ru' ? 'Россия' : currentLocale.lang === 'en' ? 'Russia' : ''}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Map + Coords */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-sm font-medium text-gray-700">Координаты</label>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">Клик по карте или ввод вручную</span>
                      <button
                        type="button"
                        onClick={() => {
                          if (savedLat != null && savedLon != null) {
                            setLat(String(savedLat));
                            setLon(String(savedLon));
                          }
                        }}
                        disabled={savedLat == null}
                        className="px-2 py-0.5 text-xs text-gray-500 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-40 transition-colors"
                      >
                        Вернуть
                      </button>
                    </div>
                  </div>
                  <div ref={setMapContainerRef} className="w-full h-48 rounded-lg border border-gray-200 overflow-hidden z-0" />
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <input
                      type="number"
                      step="0.000001"
                      value={lat}
                      onChange={e => setLat(e.target.value)}
                      placeholder="Широта"
                      className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                      type="number"
                      step="0.000001"
                      value={lon}
                      onChange={e => setLon(e.target.value)}
                      placeholder="Долгота"
                      className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Next button */}
              <div className="flex justify-end pt-2">
                <button
                  onClick={() => goToStep(2)}
                  disabled={saving}
                  className="px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {saving ? 'Сохранение...' : 'Далее: Теги →'}
                </button>
              </div>
            </div>
          )}

          {/* ─── Step 2: Теги ──────────────────────────────────────────── */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Теги</h2>
                <p className="text-sm text-gray-500">Категории для поиска. Можно выбрать из справочника или добавить свои.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Теги города</label>
                <input
                  type="text"
                  value={tagInput}
                  onChange={e => setTagInput(e.target.value)}
                  onKeyDown={handleTagKeyDown}
                  onBlur={handleTagBlur}
                  placeholder="Введите тег и нажмите Enter"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Current tags */}
              <div className="flex flex-wrap gap-2 min-h-[2.5rem] p-2 bg-gray-50 rounded-lg border border-gray-200">
                {cityTags.length === 0 ? (
                  <span className="text-sm text-gray-400 self-center">Тегов пока нет</span>
                ) : cityTags.map(tag => (
                  <span key={tag} className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
                    {tag}
                    <button type="button" onClick={() => removeTag(tag)} className="hover:text-red-600 transition-colors">×</button>
                  </span>
                ))}
              </div>

              {/* Suggestions */}
              {availableTags.length > 0 && (
                <div>
                  <p className="text-xs text-gray-500 mb-1.5">Справочник тегов:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {availableTags.map((tag, i) => {
                      const label = tag.display_name || tag.slug || tag.name || (typeof tag === 'string' ? tag : '');
                      if (!label) return null;
                      const isAdded = cityTags.includes(label);
                      return (
                        <button
                          key={tag.id || i}
                          type="button"
                          onClick={() => addTag(label)}
                          className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
                            isAdded
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400 hover:text-blue-600'
                          }`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex justify-between pt-2">
                <button onClick={() => goToStep(1)} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                  ← Назад
                </button>
                <button
                  onClick={() => goToStep(3)}
                  disabled={saving}
                  className="px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {saving ? 'Сохранение...' : 'Далее: Достопримечательности →'}
                </button>
              </div>
            </div>
          )}

          {/* ─── Step 3: Достопримечательности ───────────────────────── */}
          {currentStep === 3 && (
            <div>
              {attrView === 'list' ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900">Достопримечательности</h2>
                      <p className="text-sm text-gray-500">Добавьте объекты для этого города</p>
                    </div>
                    <button
                      onClick={addAttraction}
                      className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      + Добавить
                    </button>
                  </div>

                  {attractions.length === 0 ? (
                    <div className="text-center py-12 text-gray-400">
                      <div className="text-3xl mb-2">🏛️</div>
                      <p className="text-sm">Нет достопримечательностей. Нажмите «+ Добавить»</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {attractions.map((attr, idx) => (
                        <div
                          key={attr.id}
                          onClick={() => openAttrDetail(attr.id)}
                          className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 cursor-pointer transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <span className="w-6 h-6 flex items-center justify-center rounded-full bg-gray-100 text-xs font-medium text-gray-600">
                              {idx + 1}
                            </span>
                            <span className="text-sm font-medium text-gray-900">{getAttrName(attr)}</span>
                          </div>
                          <span className="text-xs text-blue-600 font-medium">Открыть →</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex justify-between pt-2">
                    <button onClick={() => goToStep(2)} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                      ← Назад
                    </button>
                    <button onClick={() => goToStep(4)} className="px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">
                      Далее: Контент →
                    </button>
                  </div>
                </div>
              ) : (
                /* ─── Attraction detail view ─── */
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => { setAttrView('list'); setCurrentAttr(null); }}
                      className="w-8 h-8 flex items-center justify-center border border-gray-300 rounded-lg text-gray-500 hover:bg-gray-50 transition-colors"
                    >
                      ←
                    </button>
                    <span className="text-base font-semibold text-gray-900">{getAttrName(currentAttr)}</span>
                    <button
                      onClick={deleteCurrentAttr}
                      className="ml-auto px-3 py-1 text-xs font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                    >
                      Удалить
                    </button>
                  </div>

                  {/* Locale pills for attraction */}
                  <div className="flex items-center gap-1 flex-wrap">
                    {DEFAULT_LOCALE_DEFS.map(loc => {
                      const isActive = loc.key === attrActiveLocale;
                      return (
                        <button
                          key={loc.key}
                          type="button"
                          onClick={() => setAttrActiveLocale(loc.key)}
                          className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                            isActive
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
                          }`}
                        >
                          <span>{getFlag(loc.code)}</span>
                          <span>{loc.langName}</span>
                        </button>
                      );
                    })}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Название ({attrCurrentLocale.lang?.toUpperCase() || 'RU'})
                    </label>
                    <input
                      type="text"
                      value={attrCurrentLocale.name || ''}
                      onChange={e => updateAttrLocaleField('name', e.target.value)}
                      placeholder="Название достопримечательности"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Описание ({attrCurrentLocale.lang?.toUpperCase() || 'RU'})
                    </label>
                    <textarea
                      value={attrCurrentLocale.description || ''}
                      onChange={e => updateAttrLocaleField('description', e.target.value)}
                      rows={3}
                      placeholder="Краткое описание"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    />
                  </div>

                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <label className="text-sm font-medium text-gray-700">Текст</label>
                      <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-xs rounded font-mono">
                        {attrCurrentLocale.lang?.toUpperCase() || 'RU'}
                      </span>
                    </div>
                    <textarea
                      value={attrCurrentLocale.contentText || ''}
                      onChange={e => updateAttrLocaleField('contentText', e.target.value)}
                      rows={7}
                      placeholder="Подробный текст-описание, история, интересные факты..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    />
                  </div>

                  <div className="flex justify-end">
                    <button
                      onClick={saveCurrentAttr}
                      disabled={attrSaving}
                      className="px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                      {attrSaving ? 'Сохранение...' : 'Сохранить'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ─── Step 4: Контент ───────────────────────────────────────── */}
          {currentStep === 4 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Контент</h2>
                <p className="text-sm text-gray-500">Генерация текстового контента для достопримечательностей с помощью ИИ</p>
              </div>

              {attractions.length === 0 ? (
                <div className="py-8 text-center text-gray-400 text-sm border border-dashed border-gray-200 rounded-xl">
                  Нет достопримечательностей. Добавьте их на шаге 3.
                </div>
              ) : (
                <div className="space-y-3">
                  {attractions.map(attr => {
                    const name = getAttrName(attr);
                    const hasContent = attr.contents && Object.values(attr.contents).some(Boolean);
                    const isSelected = aiGenAttrId === attr.id;
                    return (
                      <div key={attr.id} className={`border rounded-xl p-4 transition-all ${isSelected ? 'border-blue-400 bg-blue-50' : 'border-gray-200 bg-white'}`}>
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium text-gray-900">{name}</p>
                            {hasContent && (
                              <p className="text-xs text-green-600 mt-0.5">✓ Контент заполнен</p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <select
                              value={isSelected ? aiGenLang : 'ru'}
                              onChange={e => { if (!isSelected) setAiGenLang(e.target.value); }}
                              onClick={e => { setAiGenLang(e.target.value); setAiGenAttrId(attr.id); }}
                              className="text-xs border border-gray-300 rounded-md px-2 py-1 focus:outline-none"
                            >
                              <option value="ru">RU</option>
                              <option value="en">EN</option>
                              <option value="it">IT</option>
                            </select>
                            <button
                              onClick={() => startAiContent(attr.id, aiGenLang)}
                              disabled={isSelected && !aiGenDone}
                              className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
                            >
                              {isSelected && !aiGenDone ? (
                                <span className="flex items-center gap-1">
                                  <span className="animate-spin inline-block w-3 h-3 border border-white border-t-transparent rounded-full" />
                                  Генерация...
                                </span>
                              ) : '✨ Сгенерировать'}
                            </button>
                          </div>
                        </div>

                        {isSelected && (aiGenText || aiGenError) && (
                          <div className="mt-3 space-y-2">
                            {aiGenError && (
                              <p className="text-xs text-red-600">{aiGenError}</p>
                            )}
                            {aiGenText && (
                              <>
                                <textarea
                                  value={aiGenText}
                                  onChange={e => setAiGenText(e.target.value)}
                                  rows={6}
                                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                                />
                                {!aiGenDone && (
                                  <div className="flex items-center gap-1.5 text-xs text-blue-500">
                                    <span className="animate-pulse inline-block w-2 h-2 bg-blue-400 rounded-full" />
                                    Генерация...
                                  </div>
                                )}
                                {aiGenDone && (
                                  <button
                                    onClick={saveAiContent}
                                    disabled={aiGenSaving}
                                    className="px-4 py-1.5 text-xs font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50 transition-colors"
                                  >
                                    {aiGenSaving ? 'Сохранение...' : '✓ Сохранить контент'}
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="flex justify-between pt-2">
                <button onClick={() => goToStep(3)} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                  ← Назад
                </button>
                <button onClick={() => goToStep(5)} className="px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">
                  Далее: Публикация →
                </button>
              </div>
            </div>
          )}

          {/* ─── Step 5: Публикация ────────────────────────────────────── */}
          {currentStep === 5 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Публикация</h2>
                <p className="text-sm text-gray-500">Проверьте данные и опубликуйте сессию.</p>
              </div>
              {/* Summary */}
              <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-gray-500">Сессия:</span><span className="font-medium">{session.name}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Статус:</span><StatusBadge status={session.status} label={session.status_display} /></div>
                <div className="flex justify-between"><span className="text-gray-500">Достопримечательности:</span><span className="font-medium">{attractions.length}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Теги:</span><span className="font-medium">{cityTags.length > 0 ? cityTags.join(', ') : '—'}</span></div>
              </div>
              <div className="flex justify-between pt-2">
                <button onClick={() => goToStep(4)} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                  ← Назад
                </button>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleTranslateSession}
                    disabled={translating}
                    className="px-4 py-2 text-sm font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 disabled:opacity-50 transition-colors"
                  >
                    {translating ? 'Перевод...' : 'Перевести сессию'}
                  </button>
                  <button
                    onClick={handlePublish}
                    disabled={publishing}
                    className="px-6 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                  >
                    {publishing ? 'Публикация...' : '✓ Опубликовать город'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ── Add locale modal ─────────────────────────────────────────────── */}
      {addLocaleOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setAddLocaleOpen(false)} />
          <div className="relative bg-white rounded-xl shadow-xl p-6 w-80 space-y-4">
            <h3 className="text-base font-semibold text-gray-900">Добавить адаптацию</h3>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Код страны (2 буквы)</label>
              <input
                type="text"
                maxLength={2}
                value={newLocaleCode}
                onChange={e => setNewLocaleCode(e.target.value.toUpperCase())}
                placeholder="RU, US, DE..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Название языка</label>
              <input
                type="text"
                value={newLocaleLang}
                onChange={e => setNewLocaleLang(e.target.value)}
                placeholder="Немецкий, Испанский..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setAddLocaleOpen(false)} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">
                Отмена
              </button>
              <button onClick={addLocale} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">
                Добавить
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Close session modal ──────────────────────────────────────────── */}
      {closeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => !closing && setCloseOpen(false)} />
          <div className="relative bg-white rounded-xl shadow-xl p-6 w-96 space-y-4">
            <h3 className="text-base font-semibold text-gray-900">Закрыть сессию</h3>
            <p className="text-sm text-gray-600">
              Сессия <span className="font-medium">«{session.name}»</span> будет закрыта. Выберите режим:
            </p>
            <div className="space-y-2">
              {[
                { mode: 'save', title: 'Сохранить', desc: 'Данные сессии сохранятся', cls: 'border-blue-500 bg-blue-50' },
                { mode: 'discard', title: 'Отменить', desc: 'Данные сессии будут удалены без сохранения', cls: 'border-red-500 bg-red-50' },
              ].map(opt => (
                <label key={opt.mode} className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors ${closeMode === opt.mode ? opt.cls : 'border-gray-200 hover:border-gray-300'}`}>
                  <input type="radio" name="closeMode" value={opt.mode} checked={closeMode === opt.mode} onChange={() => setCloseMode(opt.mode)} className="mt-0.5" />
                  <div>
                    <div className="text-sm font-medium text-gray-900">{opt.title}</div>
                    <div className="text-xs text-gray-500">{opt.desc}</div>
                  </div>
                </label>
              ))}
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setCloseOpen(false)} disabled={closing} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50">
                Отмена
              </button>
              <button
                onClick={handleClose}
                disabled={closing}
                className={`px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50 transition-colors ${closeMode === 'discard' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}
              >
                {closing ? (
                  <span className="flex items-center gap-1.5">
                    <span className="animate-spin w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full" />
                    Закрытие...
                  </span>
                ) : closeMode === 'discard' ? 'Закрыть без сохранения' : 'Закрыть с сохранением'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Wikimedia Commons Image Picker */}
      <CommonsImagePicker
        isOpen={commonsModalOpen}
        onClose={() => setCommonsModalOpen(false)}
        onImageSelected={handleCommonsImageSelect}
        getSessionUuid={getSessionUuid}
        defaultQuery={localeData[activeLocale]?.name || ''}
      />
    </Layout>
  );
}
