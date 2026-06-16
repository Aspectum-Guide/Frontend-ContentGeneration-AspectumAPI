import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

interface WizardLocationState {
  cityDraftId?: string;
}
import {
  referenceAttractionsAPI,
  citiesAPI,
  sessionsAPI,
  imagesAPI,
} from '../../../api/generation';
import { useLayoutActions } from '../../../context/useLayoutActions';
import { trackEvent } from '../../../utils/analytics';
import { parseApiError } from '../../../utils/apiError';
import { useToast } from '../../../components/ui/Toast.jsx';
import {
  normalizeDraftId,
  normalizeServerCityDraftsFromSessionData,
  extractReferenceCities,
} from './useSessionWizardHelpers.js';
import { normalizeTagIds } from './sessionWizardShared.jsx';
import { makeLocaleData } from './useCityStep.js';

import useCityStep from './useCityStep.js';
import { useAttractionsStep } from './useAttractionsStep.js';
import useInteractiveLocationsStep from './useInteractiveLocationsStep.js';
import { useAudioGuides } from './useAudioGuides.js';
import usePublishStep from './usePublishStep.js';
import useTags from './useTags.js';

import type {
  UUID,
  Session,
  CityDraft,
  LocaleData,
  ReferenceCity,
  ReferenceAttraction,
  MultilangDict,
} from '../../../types/models';

const TOTAL_STEPS = 5;

interface LoadSessionOptions {
  silent?: boolean;
  force?: boolean;
  preserveCurrentEditors?: boolean;
}

interface ConfirmFn {
  (message: string): Promise<boolean>;
}

interface UseSessionWizardControllerProps {
  sessionId?: UUID | null;
  confirm?: ConfirmFn;
}

export function useSessionWizardController({
  sessionId,
  confirm: confirmProp,
}: UseSessionWizardControllerProps = {}) {
  const { setMobileActions } = useLayoutActions();
  const navigate = useNavigate();
  const location = useLocation();

  const { note, showNote } = useToast();

  const defaultConfirm = useCallback((opts: string | { message?: string }) => {
    const message = typeof opts === 'string' ? opts : (opts?.message ?? '');
    if (typeof window === 'undefined') return Promise.resolve(false);
    return Promise.resolve(window.confirm(message));
  }, []);

  const confirm: ConfirmFn = confirmProp ?? defaultConfirm;

  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [cityDrafts, setCityDrafts] = useState<CityDraft[]>([]);
  const [activeCityDraftId, setActiveCityDraftId] = useState<UUID | null>(null);
  const [referenceCities, setReferenceCities] = useState<ReferenceCity[]>([]);
  const [referenceAttractions, setReferenceAttractions] = useState<ReferenceAttraction[]>([]);
  const activeCityDraftIdRef = useRef<UUID | null>(null);
  const requestedCityDraftIdRef = useRef<UUID | null>(null);

  const [currentStep, setCurrentStep] = useState(1);
  const [localeData, setLocaleData] = useState<LocaleData>(makeLocaleData);
  const [activeLocale, setActiveLocale] = useState('ru-RU');
  const [defaultLocale, setDefaultLocale] = useState('ru-RU');

  const currentStepRef = useRef(1);
  const hasUnsavedChangesRef = useRef(false);
  const sessionOpenedAtRef = useRef<number | null>(null);
  const firstCitySaveAtRef = useRef<number | null>(null);
  const flushDirtyDraftEditorsRef = useRef<() => Promise<void>>(async () => {});
  const loadSessionSeqRef = useRef(0);
  const localCreatedCityDraftsRef = useRef(new Map<UUID, CityDraft>());
  const localDeletedCityDraftIdsRef = useRef(new Set<UUID>());

  useEffect(() => {
    activeCityDraftIdRef.current = activeCityDraftId;
  }, [activeCityDraftId]);

  useEffect(() => {
    currentStepRef.current = currentStep;
  }, [currentStep]);

  const reconcileCityDraftsWithLocalOverlay = useCallback((serverDrafts: CityDraft[]) => {
    const deletedIds = localDeletedCityDraftIdsRef.current;
    const createdDrafts = localCreatedCityDraftsRef.current;

    const arr = Array.isArray(serverDrafts) ? serverDrafts : [];
    const legacyRows = arr.filter((d) => normalizeDraftId(d?.id) === 'legacy');
    const nonLegacy = arr.filter((d) => normalizeDraftId(d?.id) !== 'legacy');

    let next = nonLegacy
      .filter((draft) => !deletedIds.has(normalizeDraftId(draft?.id) ?? ''))
      .map((draft) => {
        const id = normalizeDraftId(draft?.id);
        if (!id) return null;
        const { isPending: _removed, ...rest } = draft;
        return { ...rest, tags: normalizeTagIds(draft.tags ?? draft.city_tags ?? []) } as CityDraft;
      })
      .filter(Boolean) as CityDraft[];

    const serverIds = new Set(next.map((draft) => normalizeDraftId(draft.id)));

    for (const draftId of Array.from(createdDrafts.keys())) {
      if (serverIds.has(draftId)) {
        createdDrafts.delete(draftId);
      }
    }

    for (const [draftId, draft] of createdDrafts.entries()) {
      if (!deletedIds.has(draftId) && !serverIds.has(draftId)) {
        next = [...next.filter((d) => normalizeDraftId(d?.id) !== draftId), draft];
      }
    }

    const sortFn = (a: CityDraft, b: CityDraft) => {
      const orderA = Number.isFinite(Number(a?.order)) ? Number(a.order) : 0;
      const orderB = Number.isFinite(Number(b?.order)) ? Number(b.order) : 0;
      if (orderA !== orderB) return orderA - orderB;
      return String(a?.created_at || '').localeCompare(String(b?.created_at || ''));
    };

    next.sort(sortFn);

    const legacyNorm = legacyRows
      .map((d) => {
        const id = normalizeDraftId(d?.id);
        if (!id) return null;
        const { isPending: _removed, ...rest } = d;
        return { ...rest, tags: normalizeTagIds(d.tags ?? d.city_tags ?? []) } as CityDraft;
      })
      .filter(Boolean) as CityDraft[];
    legacyNorm.sort(sortFn);

    return [...legacyNorm, ...next].sort(sortFn);
  }, []);

  const loadCityIntoFormRef = useRef<((draft: CityDraft, tags?: string[]) => void) | null>(null);

  const clearCityWizardForm = useCallback(() => {
    setLocaleData(makeLocaleData());
    setDefaultLocale('ru-RU');
    setActiveLocale('ru-RU');
  }, []);

  const loadSession = useCallback(async (preferredDraftId: UUID | null = null, options: LoadSessionOptions = {}) => {
    const { silent = false, force = false, preserveCurrentEditors = false } = options;
    const seq = ++loadSessionSeqRef.current;

    try {
      if (!force) {
        try {
          await flushDirtyDraftEditorsRef.current();
        } catch (err) {
          if (!silent) {
            showNote(
              'Не удалось сохранить несохранённые изменения: ' +
                parseApiError(err, 'Ошибка сохранения'),
              'error',
            );
          }
          return;
        }
      }

      if (!silent) setLoading(true);
      const res = await sessionsAPI.get(
        sessionId!,
        force ? { skipApiGetCache: true } : {}
      );

      if (seq !== loadSessionSeqRef.current && !force) {
        return;
      }

      const data = res?.data as Session;
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

      if (!preserveCurrentEditors && loadCityIntoFormRef.current) {
        if (selectedDraft) loadCityIntoFormRef.current(selectedDraft, sessionLegacyTags);
        else if (fallbackDraft) loadCityIntoFormRef.current(fallbackDraft, sessionLegacyTags);
      }

      // Trigger re-renders for sub-entities
      if (Array.isArray(data?.attractions)) {
        setCityDrafts((prev) => prev);
      }
      if (Array.isArray(data?.city_infos)) {
        setCityDrafts((prev) => prev);
      }
      if (Array.isArray(data?.attraction_infos)) {
        setCityDrafts((prev) => prev);
      }
      if (Array.isArray(data?.attraction_feed_items)) {
        setCityDrafts((prev) => prev);
      }

    } catch (err) {
      if (seq === loadSessionSeqRef.current && !silent) {
        if ((err as { response?: { status?: number } })?.response?.status === 404) {
          showNote('Сессия не найдена', 'error');
          navigate('/generation');
        } else {
          showNote('Не удалось загрузить сессию: ' + parseApiError(err, 'Ошибка загрузки'), 'error');
        }
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [sessionId, navigate, showNote, reconcileCityDraftsWithLocalOverlay]);

  useEffect(() => { loadSession(); }, [loadSession]);

  useEffect(() => {
    citiesAPI.list({ page_size: 1000, limit: 1000 })
      .then((res) => {
        const cities = extractReferenceCities(res?.data);
        setReferenceCities(cities);
      })
      .catch((err: unknown) => {
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
      })
      .catch((err: unknown) => {
        console.error('Не удалось загрузить достопримечательности из EventsAPI:', err);
        setReferenceAttractions([]);
      });
  }, []);

  useEffect(() => {
    setCurrentStep((s) => {
      if (s < 1) return 1;
      if (s > TOTAL_STEPS) return TOTAL_STEPS;
      return s;
    });
  }, [sessionId]);

  useEffect(() => {
    if (!session?.id) return;
    const params = new URLSearchParams(location.search);
    if (!params.has('step')) return;
    const n = parseInt(params.get('step')!, 10);
    if (!Number.isFinite(n)) return;
    void navigateToStep(n);
  }, [session?.id, location.search]);

  const collectWizardLanguageCodes = useCallback(() => {
    const codes = new Set<string>();
    const ingest = (data: LocaleData) => {
      Object.values(data || {}).forEach((loc) => {
        const raw = (loc?.lang || '').trim().toLowerCase();
        if (!raw) return;
        const base = raw.split('-')[0];
        if (base) codes.add(base);
      });
    };
    ingest(localeData);
    if (!codes.size) codes.add('ru');
    return Array.from(codes);
  }, [localeData]);

  const tags = useTags({ showNote, confirm });

  const cityStep = useCityStep({
    sessionId, session, showNote, confirm,
    localeData, setLocaleData, activeLocale, setActiveLocale, defaultLocale, setDefaultLocale,
    cityDrafts, setCityDrafts, activeCityDraftId, setActiveCityDraftId, activeCityDraftIdRef,
    referenceCities, referenceAttractions,
    hasUnsavedChangesRef, currentStepRef, sessionOpenedAtRef, firstCitySaveAtRef,
    navigate, location,
    loadSession, reconcileCityDraftsWithLocalOverlay,
    clearCityWizardForm,
    localCreatedCityDraftsRef, localDeletedCityDraftIdsRef,
    loadSessionSeqRef,
    ...tags,
  });

  useEffect(() => {
    loadCityIntoFormRef.current = cityStep.loadCityIntoForm;
  }, [cityStep.loadCityIntoForm]);

  const attractionsStep = useAttractionsStep({
    sessionId, showNote, confirm,
    localeData, cityDrafts, referenceCities, referenceAttractions, activeCityDraftIdRef,
    currentStepRef, hasUnsavedChangesRef,
    loadSession,
    commonsTarget: cityStep.commonsTarget, setCommonsTarget: cityStep.setCommonsTarget,
    setCommonsModalOpen: cityStep.setCommonsModalOpen,
    aiGenerationMode: cityStep.aiGenerationMode, aiUseWebSearch: cityStep.aiUseWebSearch,
    getSessionUuid: cityStep.getSessionUuid, imagesAPI,
    session,
  });

  const ilStep = useInteractiveLocationsStep({
    sessionId, showNote, confirm,
    localeData, cityDrafts, referenceCities, referenceAttractions, activeCityDraftIdRef,
    currentStepRef, hasUnsavedChangesRef,
    loadSession,
    aiGenerationMode: cityStep.aiGenerationMode, aiUseWebSearch: cityStep.aiUseWebSearch,
    getSessionUuid: cityStep.getSessionUuid, imagesAPI,
    collectWizardLanguageCodes,
    session,
  });

  const audioGuides = useAudioGuides({
    sessionId, session, showNote, confirm,
    currentAttr: attractionsStep.currentAttr, attrLocaleData: attractionsStep.attrLocaleData,
    attractions: attractionsStep.attractions, referenceAttractions,
    getSessionUuid: cityStep.getSessionUuid,
    aiGenerationMode: cityStep.aiGenerationMode, aiUseWebSearch: cityStep.aiUseWebSearch,
  });

  const publishStep = usePublishStep({
    sessionId, showNote, confirm, navigate,
    session, setSession,
    defaultLocale, localeData,
    activeCityDraftIdRef, sessionOpenedAtRef, firstCitySaveAtRef,
    loadSession, saveCityForStep1: cityStep.saveCityForStep1,
    currentCityInfo: cityStep.currentCityInfo, saveCurrentCityInfo: cityStep.saveCurrentCityInfo,
    currentAttr: attractionsStep.currentAttr, saveCurrentAttrIfDirty: attractionsStep.saveCurrentAttrIfDirty,
    currentIl: ilStep.currentIl, saveCurrentIlIfDirty: ilStep.saveCurrentIlIfDirty,
    currentAttractionInfo: attractionsStep.currentAttractionInfo,
    saveCurrentAttractionInfo: attractionsStep.saveCurrentAttractionInfo,
    currentAttractionFeedItem: attractionsStep.currentAttractionFeedItem,
    saveCurrentAttractionFeedItem: attractionsStep.saveCurrentAttractionFeedItem,
    currentAttractionAudioGuide: audioGuides.currentAttractionAudioGuide,
    saveCurrentAttractionAudioGuide: audioGuides.saveCurrentAttractionAudioGuide,
    cityDrafts, cityInfos: cityStep.cityInfos,
    attractionInfos: attractionsStep.attractionInfos,
    attractionFeedItems: attractionsStep.attractionFeedItems,
    attractionAudioGuides: audioGuides.attractionAudioGuides,
    flushDirtyDraftEditorsRef,
  });

  const syncActiveDraftRoute = useCallback((draftId: UUID | null) => {
    const normalizedDraftId = normalizeDraftId(draftId);
    const params = new URLSearchParams(location.search);
    const state = location.state as WizardLocationState | null;
    const currentDraftId = normalizeDraftId(params.get('cityDraftId') || state?.cityDraftId);

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

  useEffect(() => {
    const routeDraftId = new URLSearchParams(location.search).get('cityDraftId');
    const state = location.state as WizardLocationState | null;
    requestedCityDraftIdRef.current = normalizeDraftId(routeDraftId || state?.cityDraftId);
  }, [location.search, location.state]);

  const navigateToStep = useCallback(
    async (target: number): Promise<boolean> => {
      if (target < 1 || target > TOTAL_STEPS || target === currentStepRef.current) {
        return true;
      }

      const fromStep = currentStepRef.current;

      if (fromStep === 1 && target > 1) {
        const name = localeData[defaultLocale]?.name;
        if (!name || !name.trim()) {
          showNote('Укажите название города перед переходом дальше', 'error');
          return false;
        }
      }

      const isGoingToPublishStep = target === TOTAL_STEPS;

      if (isGoingToPublishStep) {
        publishStep.setPreparingPublishStep(true);
      }

      try {
        if (fromStep === 4 && target !== 4) {
          await ilStep.saveCurrentIlIfDirty({ silent: true });
        }

        if (fromStep === 3 && target !== 3) {
          await attractionsStep.saveCurrentAttrIfDirty({ silent: true });
        }

        if (isGoingToPublishStep) {
          await cityStep.saveCitySilently();
          await flushDirtyDraftEditorsRef.current?.();
          await loadSession(activeCityDraftIdRef.current, {
            silent: true,
            force: true,
            preserveCurrentEditors: true,
          });
        }
      } catch {
        return false;
      } finally {
        if (isGoingToPublishStep) {
          publishStep.setPreparingPublishStep(false);
        }
      }

      setCurrentStep(target);
      return true;
    },
    [localeData, defaultLocale, showNote, ilStep.saveCurrentIlIfDirty, attractionsStep.saveCurrentAttrIfDirty, cityStep.saveCitySilently, loadSession, publishStep]
  );

  useEffect(() => {
    flushDirtyDraftEditorsRef.current = async () => {
      await ilStep.saveCurrentIlIfDirty({ silent: true });
      await attractionsStep.saveCurrentAttrIfDirty({ silent: true });
      await cityStep.saveCurrentCityInfoIfDirty?.({ silent: true });
      await attractionsStep.saveCurrentAttractionFeedItemIfDirty?.({ silent: true });
      await audioGuides.saveCurrentAttractionAudioGuideIfDirty?.({ silent: true });
    };
  }, [
    ilStep.saveCurrentIlIfDirty,
    attractionsStep.saveCurrentAttrIfDirty,
    cityStep.saveCurrentCityInfoIfDirty,
    attractionsStep.saveCurrentAttractionFeedItemIfDirty,
    audioGuides.saveCurrentAttractionAudioGuideIfDirty,
  ]);

  useEffect(() => {
    const actions = [
      {
        id: 'save-city-data',
        label: cityStep.saving ? 'Сохранение...' : 'Сохранить город',
        onClick: () => { if (!cityStep.saving) cityStep.saveCityForStep1(); },
        disabled: cityStep.saving,
        variant: 'primary',
      },
    ];
    if (!session?.closed_with_save) {
      actions.push({
        id: 'publish-session',
        label: publishStep.publishing ? 'Публикация...' : 'Опубликовать сессию',
        onClick: () => { if (!publishStep.publishing) publishStep.handlePublish(); },
        disabled: publishStep.publishing,
        variant: '',
      });
    }
    if (session?.status === 'draft' || session?.status === 'in_progress') {
      actions.push({
        id: 'close-session',
        label: 'Закрыть сессию',
        onClick: () => { publishStep.setCloseMode('save'); publishStep.setCloseOpen(true); },
        disabled: false,
        variant: 'danger',
      });
    }

    return () => setMobileActions([]);
  }, [setMobileActions, cityStep.saving, publishStep.publishing, cityStep.saveCityForStep1, publishStep.handlePublish, session, publishStep.setCloseMode, publishStep.setCloseOpen]);

  return {
    note, showNote,
    session, loading,
    cityDrafts, activeCityDraftId, referenceCities, referenceAttractions,
    currentStep, setCurrentStep,
    localeData, activeLocale, defaultLocale, setDefaultLocale,
    hasUnsavedChangesRef,
    loadSession, syncActiveDraftRoute,
    goToStep: navigateToStep,
    navigateToStep,
    TOTAL_STEPS,

    ...cityStep,
    ...tags,
    ...attractionsStep,
    ...ilStep,
    ...audioGuides,
    ...publishStep,
  };
}
