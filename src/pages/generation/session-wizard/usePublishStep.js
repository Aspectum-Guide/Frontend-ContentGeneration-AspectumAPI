import { useCallback, useState } from 'react';
import { sessionsAPI } from '../../../api/generation';
import { trackEvent } from '../../../utils/analytics';
import { parseApiError } from '../../../utils/apiError';

export default function usePublishStep(ctx) {
  const {
    sessionId,
    showNote,
    confirm,
    navigate,
    session,
    setSession,
    defaultLocale,
    localeData,
    activeCityDraftIdRef,
    sessionOpenedAtRef,
    firstCitySaveAtRef,
    loadSession,
    saveCityForStep1,
    currentCityInfo,
    saveCurrentCityInfo,
    saveCurrentAttrIfDirty,
    saveCurrentIlIfDirty,
    currentAttractionInfo,
    saveCurrentAttractionInfo,
    currentAttractionFeedItem,
    saveCurrentAttractionFeedItem,
    currentAttractionAudioGuide,
    saveCurrentAttractionAudioGuide,
    cityDrafts,
    cityInfos,
    attractionInfos,
    attractionFeedItems,
    attractionAudioGuides,
    flushDirtyDraftEditorsRef,
  } = ctx;

  const [closeOpen, setCloseOpen] = useState(false);
  const [closeMode, setCloseMode] = useState('save');
  const [closing, setClosing] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [preparingPublishStep, setPreparingPublishStep] = useState(false);

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
      if (defaultLocale && localeData[defaultLocale]) {
        await saveCityForStep1();
      }

      if (typeof flushDirtyDraftEditorsRef?.current === 'function') {
        await flushDirtyDraftEditorsRef.current();
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
        activeCityDraftIdRef?.current || undefined,
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
    defaultLocale,
    localeData,
    saveCityForStep1,
    flushDirtyDraftEditorsRef,
    sessionId,
    loadSession,
    showNote,
    activeCityDraftIdRef,
    sessionOpenedAtRef,
    firstCitySaveAtRef,
    setSession,
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

    const collectMultilangFieldKeys = (value) => {
      const keys = new Set();
      if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
      Object.keys(value).forEach((key) => {
        const lang = String(key || '').trim().toLowerCase();
        if (lang) keys.add(lang);
      });
      return Array.from(keys);
    };

    const languagesFromLocaleData = Object.values(localeData || {})
      .map((loc) => (loc?.lang || '').trim().toLowerCase())
      .filter(Boolean);
    const languagesFromDrafts = (Array.isArray(cityDrafts) ? cityDrafts : []).flatMap((draft) => collectLanguageKeys(draft));
    const languagesFromLegacyCity = collectLanguageKeys(session?.city || {});
    const languagesFromCityInfos = (Array.isArray(cityInfos) ? cityInfos : []).flatMap((info) => [
      ...collectMultilangFieldKeys(info?.name),
      ...collectMultilangFieldKeys(info?.description),
    ]);
    const languagesFromAttractionInfos = (Array.isArray(attractionInfos) ? attractionInfos : []).flatMap((info) => [
      ...collectMultilangFieldKeys(info?.name),
      ...collectMultilangFieldKeys(info?.description),
    ]);
    const languagesFromFeedItems = (Array.isArray(attractionFeedItems) ? attractionFeedItems : [])
      .filter((item) => item?.item_type === 'text')
      .flatMap((item) => collectMultilangFieldKeys(item?.text));
    const languagesFromAudioGuides = (Array.isArray(attractionAudioGuides) ? attractionAudioGuides : []).flatMap(
      (guide) => [
        ...collectMultilangFieldKeys(guide?.title),
        ...collectMultilangFieldKeys(guide?.content_plan),
        ...collectMultilangFieldKeys(guide?.content_texts),
      ],
    );
    const targetLanguages = [
      ...new Set([
        ...languagesFromLocaleData,
        ...languagesFromDrafts,
        ...languagesFromLegacyCity,
        ...languagesFromCityInfos,
        ...languagesFromAttractionInfos,
        ...languagesFromFeedItems,
        ...languagesFromAudioGuides,
      ]),
    ];

    setTranslating(true);
    try {
      if (defaultLocale && localeData[defaultLocale]) {
        await saveCityForStep1();
      }

      const res = await sessionsAPI.translate(sessionId, { target_languages: targetLanguages, scope: 'all_drafts' });
      showNote(res?.data?.message || 'Перевод всех городов завершен', 'success');
      await loadSession(currentDraftId, { force: true });
    } catch (err) {
      showNote(parseApiError(err, 'Ошибка перевода'), 'error');
    } finally {
      setTranslating(false);
    }
  }, [
    sessionId,
    defaultLocale,
    localeData,
    cityDrafts,
    session,
    cityInfos,
    attractionInfos,
    attractionFeedItems,
    attractionAudioGuides,
    saveCityForStep1,
    loadSession,
    showNote,
    activeCityDraftIdRef,
  ]);

  return {
    closeOpen,
    setCloseOpen,
    closeMode,
    setCloseMode,
    closing,
    publishing,
    translating,
    preparingPublishStep,
    setPreparingPublishStep,
    handleClose,
    handlePublish,
    handleTranslateSession,
  };
}
