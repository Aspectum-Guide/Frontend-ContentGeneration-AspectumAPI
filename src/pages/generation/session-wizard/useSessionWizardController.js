import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { aiAPI, attractionsAPI, cityFiltersAPI, imagesAPI, sessionsAPI } from '../../../api/generation';
import { useLayoutActions } from '../../../context/useLayoutActions';
import { trackEvent } from '../../../utils/analytics';
import { parseApiError } from '../../../utils/apiError';
import { DEFAULT_LOCALE_DEFS, getLocaleInfo } from './sessionWizardShared';

const TOTAL_STEPS = 5;

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

export function useSessionWizardController({ sessionId }) {
  const { setMobileActions } = useLayoutActions();
  const navigate = useNavigate();
  const location = useLocation();

  const [note, setNote] = useState(null);
  const showNote = useCallback((msg, type = 'info') => {
    setNote({ msg, type });
    setTimeout(() => setNote(null), 3500);
  }, []);

  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cityDrafts, setCityDrafts] = useState([]);
  const [activeCityDraftId, setActiveCityDraftId] = useState(null);
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
    setImageCopyright(city.image_copyright || '');

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
        newLocale[key] = { code: info.code, lang, langName: info.name, isDefault: false, name: '', description: '', country: '' };
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

      if (Array.isArray(data?.attractions)) setAttractions(data.attractions);
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
    if (currentStep === 3 && !attractionsLoaded) {
      loadAttractions();
    }
  }, [currentStep, attractionsLoaded, loadAttractions]);

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

  const goToStep = useCallback(async (target) => {
    if (target < 1 || target > TOTAL_STEPS || target === currentStep) return;
    if ((currentStep === 1 || currentStep === 2) && target > currentStep) {
      try {
        await saveCityForStep1();
      } catch {
        return;
      }
    }
    setCurrentStep(target);
  }, [currentStep, saveCityForStep1]);

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
  }, [sessionId, loadSession, syncActiveDraftRoute, showNote]);

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

  const buildAttrLocaleData = useCallback((attr) => {
    const data = {};
    DEFAULT_LOCALE_DEFS.forEach((loc) => {
      data[loc.key] = { lang: loc.lang, code: loc.code, langName: loc.langName, name: (attr.name && attr.name[loc.lang]) || '', description: (attr.description && attr.description[loc.lang]) || '', contentText: (attr.contents && attr.contents[loc.lang]) || '' };
    });
    return data;
  }, []);

  const openAttrDetail = useCallback(async (attrId) => {
    try {
      const res = await attractionsAPI.get(sessionId, attrId);
      const attr = res?.data?.attraction || attractions.find((item) => item.id === attrId);
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
      Object.values(attrLocaleData).forEach((d) => {
        if (d.name || d.description) {
          name[d.lang] = d.name || '';
          description[d.lang] = d.description || '';
        }
      });
      const updated = await attractionsAPI.update(sessionId, currentAttr.id, { name, description });
      if (updated?.data?.attraction) {
        setAttractions(prev => prev.map((item) => item.id === currentAttr.id ? { ...item, ...updated.data.attraction } : item));
        setCurrentAttr(prev => ({ ...prev, ...updated.data.attraction }));
      }
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
    if (!confirm(`Удалить «${name}»?`)) return;
    try {
      await attractionsAPI.delete(sessionId, currentAttr.id);
      setAttractions(prev => prev.filter((item) => item.id !== currentAttr.id));
      setAttrView('list');
      setCurrentAttr(null);
      showNote('Удалено', 'success');
    } catch (e) {
      showNote('Ошибка при удалении: ' + e.message, 'error');
    }
  }, [sessionId, currentAttr, showNote]);

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
      trackEvent('publish_session_fail', { sessionId: String(sessionId), reason: parseApiError(err, 'Ошибка публикации') });
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
    cityDrafts, activeCityDraftId,
    currentStep, setCurrentStep,
    localeData, activeLocale, defaultLocale, setDefaultLocale, addLocaleOpen, setAddLocaleOpen, newLocaleCode, setNewLocaleCode, newLocaleLang, setNewLocaleLang,
    lat, lon, savedLat, savedLon, setLat, setLon, setSavedLat, setSavedLon,
    imageId, imagePreview, imageOriginalUrl, imageCopyright, setImageOriginalUrl, setImageCopyright, photoUploading, photoFileRef, commonsModalOpen, setCommonsModalOpen,
    cityTags, tagInput, setTagInput, availableTags,
    attractions, attrView, currentAttr, attrLocaleData, attrActiveLocale, attrSaving,
    aiGenAttrId, aiGenLang, aiGenText, aiGenDone, aiGenError, aiGenSaving,
    saving, closeOpen, closeMode, closing, publishing, translating,
    setAttrView, setCurrentAttr, setAttrActiveLocale, setAiGenLang, setAiGenAttrId, setAiGenText,
    setCloseOpen, setCloseMode,
    setMapContainerRef,
    loadSession, syncActiveDraftRoute, loadCityIntoForm,
    goToStep, switchLocale, addLocale, removeLocale, updateLocaleField,
    handleSelectDraft, handleCreateDraft, handleDeleteDraft,
    handlePhotoFile, handleCommonsImageSelect, getSessionUuid,
    addTag, removeTag, handleTagKeyDown, handleTagBlur,
    openAttrDetail, addAttraction, deleteCurrentAttr, saveCurrentAttr, updateAttrLocaleField,
    startAiContent, saveAiContent,
    handleClose, handlePublish, handleTranslateSession,
    TOTAL_STEPS,
  };
}