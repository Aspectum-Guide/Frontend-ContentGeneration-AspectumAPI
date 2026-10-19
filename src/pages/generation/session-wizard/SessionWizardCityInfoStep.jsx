import { useMemo } from 'react';
import AiGenerationModal from '../../../components/generation/AiGenerationModal.jsx';
import { FormLabel, WizardActionFooter as WizardGenerationActionFooter } from '@aspectum/admin-ui-web';
import AiGenerationQualitySettings from '../../../components/generation/AiGenerationQualitySettings.jsx';
import AiGenerationDedupeToggle from '../../../components/generation/AiGenerationDedupeToggle.jsx';
import AiGenerationCountField from '../../../components/generation/AiGenerationCountField.jsx';
import { normalizeId } from './sessionWizardShared.jsx';
import UsefulInfoTextImportBox from './UsefulInfoTextImportBox.jsx';
import { useAppLanguages } from '../../../hooks/useAppLanguages';
import { Alert, Button, EmptyState, EntityDraftsPanel, IconButton, LocaleEditor, Panel, SectionHeader, Select, SelectableCard, Spinner, Textarea, TextInput } from '@aspectum/admin-ui-web';

const getInfoName = (info) => {
  if (!info) return '(без названия)';

  if (typeof info.name === 'string') {
    return info.name || '(без названия)';
  }

  if (info.name && typeof info.name === 'object') {
    return (
      info.name.ru ||
      info.name.en ||
      info.name.it ||
      Object.values(info.name).find(Boolean) ||
      '(без названия)'
    );
  }

  return info.title || info.display_name || info.id || '(без названия)';
};

const getCityDisplayName = (city) => {
  if (!city) return 'Без названия';

  if (typeof city.name === 'string') return city.name;

  if (city.name && typeof city.name === 'object') {
    return (
      city.name.ru ||
      city.name.en ||
      city.name.it ||
      Object.values(city.name).find(Boolean) ||
      city.id
    );
  }

  return city.display_name || city.title || city.id || 'Без названия';
};

const getDraftCityDisplayName = (draft) => {
  if (!draft) return 'Без названия';

  if (typeof draft.name === 'string') return draft.name;

  if (draft.name && typeof draft.name === 'object') {
    return (
      draft.name.ru ||
      draft.name.en ||
      draft.name.it ||
      Object.values(draft.name).find(Boolean) ||
      draft.id
    );
  }

  return draft.display_name || draft.title || draft.id || 'Без названия';
};

const getCityInfoDatabaseCityId = (info) => {
  return normalizeId(info?.city_id ?? info?.city);
};

const getCityInfoDraftCityId = (info) => {
  return normalizeId(info?.session_city_id ?? info?.session_city);
};

const getCityInfoBindingLabel = (info, referenceCities = [], cityDrafts = []) => {
  const assignedCityType = info?.assigned_city_type || 'none';

  if (assignedCityType === 'database') {
    const cityFromInfo = info?.city && typeof info.city === 'object' ? info.city : null;
    const cityId = getCityInfoDatabaseCityId(info);

    const city =
      cityFromInfo ||
      referenceCities.find((item) => normalizeId(item.id) === cityId);

    return city
      ? `Город из базы: ${getCityDisplayName(city)}`
      : 'Город из базы: не выбран';
  }

  if (assignedCityType === 'draft') {
    const draftFromInfo =
      info?.session_city && typeof info.session_city === 'object'
        ? info.session_city
        : null;

    const draftId = getCityInfoDraftCityId(info);

    const draft =
      draftFromInfo ||
      cityDrafts.find((item) => normalizeId(item.id) === draftId);

    return draft
      ? `Город из сессии: ${getDraftCityDisplayName(draft)}`
      : 'Город из сессии: не выбран';
  }

  return 'Без города';
};

function CityInfoDraftsPanel({
  cityInfos = [],
  currentCityInfo,
  onSelectCityInfo,
  onAddCityInfo,
  onOpenCityInfoGenerateModal,
  showGenerateButton = false,
}) {
  const currentCityInfoId = normalizeId(currentCityInfo?.id);

  return (
    <EntityDraftsPanel
      title="Черновики полезной информации в сессии"
      items={cityInfos}
      emptyText="Пока нет полезной информации"
      actions={(
        <>
          {showGenerateButton && (
            <Button type="button" onClick={onOpenCityInfoGenerateModal} variant="softStrong" size="sm">
              Сгенерировать
            </Button>
          )}
          <Button type="button" onClick={onAddCityInfo} variant="softStrong" size="sm">
            + Добавить
          </Button>
        </>
      )}
      renderItem={(info, index) => {
        const infoId = normalizeId(info.id);
        const isActive = infoId === currentCityInfoId;
        return (
              <SelectableCard
                key={info.id}
                onSelect={() => {
                  if (!isActive) {
                    onSelectCityInfo(info.id);
                  }
                }}
                ariaLabel={getInfoName(info)}
                className={`flex items-center gap-1 px-2 py-1 rounded-aspectum-control border text-xs transition-colors ${
                  isActive
                    ? 'bg-aspectum-primary-soft border-aspectum-primary-border-strong text-aspectum-primary-hover font-medium'
                    : 'bg-aspectum-surface border-aspectum-border text-aspectum-text-strong hover:border-aspectum-primary-border-strong hover:bg-aspectum-primary-soft'
                }`}
                title={getInfoName(info)}
              >
                <span className="text-aspectum-text-disabled">{index + 1}.</span>
                <span>{getInfoName(info)}</span>
              </SelectableCard>
        );
      }}
    />
  );
}

export default function SessionWizardCityInfoStep({
  embedded = false,
  scopedToCityDraftId = '',

  cityInfos = [],
  currentCityInfo,
  cityInfoLocaleData = {},
  cityInfoActiveLocale = 'ru-RU',
  cityInfoSaving = false,
  cityInfoAutoSaving = false,
  cityInfoAutoSaved = false,

  referenceCities = [],
  cityDrafts = [],

  onOpenCityInfoDetail,
  onAddCityInfo,
  onSetCurrentCityInfo,
  onSetCityInfoActiveLocale,
  onUpdateCityInfoLocaleField,
  onUpdateCurrentCityInfoPatch,
  onSaveCurrentCityInfo,
  onDeleteCurrentCityInfo,
  onImportCityInfoFromText,
  onGoToStep,

  cityInfoGenerateModalOpen = false,
  cityInfoGeneratePrompt = '',
  cityInfoGenerateCount = 5,
  cityInfoDedupeExistingItems = true,
  onCityInfoDedupeExistingItemsChange,
  cityInfoGenerating = false,
  cityInfoGenerationError = '',
  cityInfoGenerationLang = 'ru',
  onOpenCityInfoGenerateModal,
  onCloseCityInfoGenerateModal,
  onCityInfoGeneratePromptChange,
  onCityInfoGenerateCountChange,
  onCityInfoGenerationLangChange,
  onGenerateCityInfoFromPrompt,
  aiGenerationMode = 'instant',
  aiUseWebSearch = false,
  aiAdvancedGenerationAvailable = true,
  onAiGenerationModeChange,
  onAiUseWebSearchChange,
}) {
  const { languages: appLanguages } = useAppLanguages();
  const aiGenerationLangOptions = appLanguages.map((language) => ({ value: language.code, label: `${language.label || language.name || language.code} (${language.code})` }));
  const currentLocale = cityInfoLocaleData[cityInfoActiveLocale] || {};

  const showGenerateButton = Boolean(scopedToCityDraftId);

  const activeCityDraft = useMemo(() => {
    if (!scopedToCityDraftId) return null;

    return (
      cityDrafts.find(
        (draft) => normalizeId(draft.id) === normalizeId(scopedToCityDraftId)
      ) || null
    );
  }, [cityDrafts, scopedToCityDraftId]);

  const activeCityDraftDisplayName = activeCityDraft
    ? getDraftCityDisplayName(activeCityDraft)
    : null;

  const assignedCityType = currentCityInfo?.assigned_city_type || 'none';

  const selectedDatabaseCityId = normalizeId(
    currentCityInfo?.city_id ?? currentCityInfo?.city
  );

  const selectedDraftCityId = normalizeId(
    currentCityInfo?.session_city_id ?? currentCityInfo?.session_city
  );

  const updateCityInfoPatch = (patch) => {
    if (typeof onUpdateCurrentCityInfoPatch === 'function') {
      onUpdateCurrentCityInfoPatch(patch);
    }
  };

  return (
    <section className={embedded ? 'space-y-4' : ''}>
      <AiGenerationModal
        open={cityInfoGenerateModalOpen}
        onBackdropClick={() => {
          if (!cityInfoGenerating) onCloseCityInfoGenerateModal?.();
        }}
        titleId="city-info-gen-title"
        busy={cityInfoGenerating}
        footer={(
          <WizardGenerationActionFooter>
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={() => onCloseCityInfoGenerateModal?.()}
              disabled={cityInfoGenerating}
            >
              Отмена
            </Button>
            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={() => onGenerateCityInfoFromPrompt?.()}
              disabled={cityInfoGenerating}
            >
              Сгенерировать
            </Button>
          </WizardGenerationActionFooter>
        )}
      >
        <SectionHeader headingId="city-info-gen-title" title="Сгенерировать полезную информацию о городе" />

        {activeCityDraftDisplayName ? (
          <p className="text-sm text-aspectum-text-subtle">
            Город:{' '}
            <span className="font-medium">
              {activeCityDraftDisplayName}
            </span>
          </p>
        ) : (
          <Alert tone="warning">Город не выбран. Информация будет создана без привязки.
          </Alert>
        )}

        <div>
          <FormLabel
            htmlFor="city-info-gen-lang"
             layout="block" size="sm" weight="medium" tone="strong" spacing="xs"
          >
            Язык
          </FormLabel>

          <Select className="disabled:bg-aspectum-surface-subtle" id="city-info-gen-lang" value={cityInfoGenerationLang || 'ru'} onChange={(e) => onCityInfoGenerationLangChange?.(e.target.value)} disabled={cityInfoGenerating}>
            {aiGenerationLangOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <AiGenerationCountField
            id="city-info-gen-count"
            label="Количество блоков полезной информации"
            value={cityInfoGenerateCount}
            onChange={onCityInfoGenerateCountChange}
            generationType="city_info"
            disabled={cityInfoGenerating}
          />
        </div>

        {cityInfoGenerationError && (
          <Alert tone="error">{cityInfoGenerationError}</Alert>
        )}

        <AiGenerationQualitySettings
          generationMode={aiGenerationMode}
          onGenerationModeChange={onAiGenerationModeChange}
          useWebSearch={aiUseWebSearch}
          onUseWebSearchChange={onAiUseWebSearchChange}
          disabled={cityInfoGenerating}
          advancedDisabled={!aiAdvancedGenerationAvailable}
        />

        <AiGenerationDedupeToggle
          checked={cityInfoDedupeExistingItems}
          onChange={onCityInfoDedupeExistingItemsChange}
          disabled={cityInfoGenerating}
          entityType="city_info"
        />

        <div>
          <FormLabel
            htmlFor="city-info-gen-prompt"
             layout="block" size="sm" weight="medium" tone="strong" spacing="xs"
          >
            Дополнительный промпт
          </FormLabel>

          <Textarea className="disabled:bg-aspectum-surface-subtle" id="city-info-gen-prompt" rows={4} value={cityInfoGeneratePrompt} onChange={(e) => onCityInfoGeneratePromptChange?.(e.target.value)} disabled={cityInfoGenerating} placeholder="Например: для туристов, с акцентом на транспорт и безопасность" />
        </div>
      </AiGenerationModal>

      {!currentCityInfo ? (
        <div className="space-y-4">
          <SectionHeader
            title="Полезная информация о городе"
            description="Добавьте полезные блоки о городе и при необходимости привяжите их к городу"
            actions={
              <>
              {showGenerateButton && (
                <Button type="button" variant="primary" size="md" onClick={onOpenCityInfoGenerateModal}>
                  Сгенерировать
                </Button>
              )}

              <Button type="button" variant="primary" size="md" onClick={onAddCityInfo}>
                + Добавить
              </Button>
              </>
            }
          />

          <UsefulInfoTextImportBox
            title="Вставить готовую полезную информацию о городе"
            description="Строки с «# Заголовок» станут отдельными блоками полезной информации, а текст под каждым заголовком — описанием блока."
            buttonLabel="Создать блоки о городе"
            defaultLanguage={cityInfoGenerationLang || 'ru'}
            disabled={cityInfoSaving || cityInfoGenerating}
            onImport={onImportCityInfoFromText}
          />

          {cityInfos.length === 0 ? (
            <EmptyState
              icon="ℹ️"
              title={scopedToCityDraftId
                ? 'Для этого города пока нет полезной информации.'
                : 'Нет полезной информации'}
              description={scopedToCityDraftId ? 'Добавьте первый блок.' : 'Нажмите «+ Добавить», чтобы начать.'}
              className="py-10"
            />
          ) : (
            <div className="space-y-2">
              {cityInfos.map((info, idx) => (
                <div
                  key={info.id}
                  onClick={() => onOpenCityInfoDetail?.(info.id)}
                  className="flex items-center justify-between p-3 bg-aspectum-surface border border-aspectum-border rounded-aspectum-control hover:border-aspectum-primary-border-strong hover:bg-aspectum-primary-soft cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-6 h-6 flex items-center justify-center rounded-full bg-aspectum-surface-subtle text-xs font-medium text-aspectum-text-subtle shrink-0">
                      {idx + 1}
                    </span>

                    <div className="min-w-0">
                      <div className="text-sm font-medium text-aspectum-text truncate">
                        {getInfoName(info)}
                      </div>

                      <div className="text-xs text-aspectum-text-muted">
                        {getCityInfoBindingLabel(
                          info,
                          referenceCities,
                          cityDrafts
                        )}
                      </div>
                    </div>
                  </div>

                  <span className="text-xs text-aspectum-primary font-medium shrink-0">
                    Открыть →
                  </span>
                </div>
              ))}
            </div>
          )}

          {!embedded && (
            <div className="flex justify-between pt-2">
              <Button type="button" variant="outline" size="md" onClick={() => onGoToStep?.(1)}>
                ← Назад
              </Button>

              <Button type="button" variant="primary" size="md" onClick={() => onGoToStep?.(2)}>
                Далее: Теги →
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <IconButton
              label="Вернуться к списку полезной информации"
              type="button"
              onClick={() => onSetCurrentCityInfo?.(null)}
              variant="outline"
              className="w-8 h-8"
            >
              ←
            </IconButton>

            <span className="text-base font-semibold text-aspectum-text">
              {getInfoName(currentCityInfo)}
            </span>

            <Button
              type="button"
              variant="softDanger"
              size="sm"
              onClick={onDeleteCurrentCityInfo}
              className="ml-auto"
            >
              Удалить
            </Button>
          </div>

          <CityInfoDraftsPanel
            cityInfos={cityInfos}
            currentCityInfo={currentCityInfo}
            onSelectCityInfo={onOpenCityInfoDetail}
            onAddCityInfo={onAddCityInfo}
            onOpenCityInfoGenerateModal={onOpenCityInfoGenerateModal}
            showGenerateButton={showGenerateButton}
          />

          <LocaleEditor
            localeData={cityInfoLocaleData}
            activeLocale={cityInfoActiveLocale}
            onSwitch={onSetCityInfoActiveLocale}
          />

          <main className="space-y-4">
            <div>
              <FormLabel  layout="block" size="sm" weight="medium" tone="strong" spacing="xs">
                Название ({currentLocale.lang?.toUpperCase() || 'RU'})
              </FormLabel>

              <TextInput type="text" value={currentLocale.name || ''} onChange={(e) => onUpdateCityInfoLocaleField?.('name', e.target.value) } placeholder="Например: Транспорт, Безопасность, Когда лучше ехать" />
            </div>

            <Panel tone="muted" className="p-3 space-y-3">
              <div>
                <FormLabel  layout="block" size="sm" weight="medium" tone="strong" spacing="xs">
                  Привязка к городу
                </FormLabel>

                <Select className="bg-aspectum-surface" value={assignedCityType} onChange={(e) => { const type = e.target.value; updateCityInfoPatch({ assigned_city_type: type, city: null, city_id: null, session_city: null, session_city_id: null, }); }}>
                  <option value="none">Без города</option>
                  <option value="database">Город из базы</option>
                  <option value="draft">Город из сессии</option>
                </Select>
              </div>

              {assignedCityType === 'database' && (
                <div>
                  <FormLabel  layout="block" size="sm" weight="medium" tone="strong" spacing="xs">
                    Город из базы
                  </FormLabel>

                  <Select className="bg-aspectum-surface" value={selectedDatabaseCityId} onChange={(e) => { const cityId = e.target.value || null; updateCityInfoPatch({ assigned_city_type: 'database', city: cityId, city_id: cityId, session_city: null, session_city_id: null, }); }}>
                    <option value="">Выберите город из базы</option>

                    {referenceCities.map((city) => (
                      <option key={city.id} value={city.id}>
                        {getCityDisplayName(city)}
                      </option>
                    ))}
                  </Select>

                  {referenceCities.length === 0 && (
                    <p className="mt-1 text-xs text-aspectum-warning">
                      Список городов из базы не загружен.
                    </p>
                  )}
                </div>
              )}

              {assignedCityType === 'draft' && (
                <div>
                  <FormLabel  layout="block" size="sm" weight="medium" tone="strong" spacing="xs">
                    Город из сессии
                  </FormLabel>

                  <Select className="bg-aspectum-surface" value={selectedDraftCityId} onChange={(e) => { const draftId = e.target.value || null; updateCityInfoPatch({ assigned_city_type: 'draft', session_city: draftId, session_city_id: draftId, city: null, city_id: null, }); }}>
                    <option value="">Выберите город</option>

                    {cityDrafts.map((draft) => (
                      <option key={draft.id} value={draft.id}>
                        {getDraftCityDisplayName(draft)}
                      </option>
                    ))}
                  </Select>

                  {cityDrafts.length === 0 && (
                    <p className="mt-1 text-xs text-aspectum-warning">
                      В текущей сессии пока нет городов.
                    </p>
                  )}
                </div>
              )}
            </Panel>

            <div>
              <div className="flex items-center gap-2 mb-1">
                <FormLabel  size="sm" weight="medium" tone="strong">
                  Описание
                </FormLabel>

                <span className="px-1.5 py-0.5 bg-aspectum-primary-muted text-aspectum-primary-hover text-xs rounded font-mono">
                  {currentLocale.lang?.toUpperCase() || 'RU'}
                </span>
              </div>

              <Textarea value={currentLocale.description || ''} onChange={(e) => onUpdateCityInfoLocaleField?.('description', e.target.value) } rows={embedded ? 5 : 7} placeholder="Описание полезной информации для пользователя..." />
            </div>

            <div className="flex items-center justify-end gap-3">
              {(cityInfoAutoSaving || cityInfoAutoSaved) && !cityInfoSaving && (
                <div
                  className={`flex items-center gap-1.5 text-xs transition-opacity ${
                    cityInfoAutoSaved && !cityInfoAutoSaving
                      ? 'text-aspectum-success'
                      : 'text-aspectum-text-disabled'
                  }`}
                >
                  {cityInfoAutoSaving ? (
                    <>
                      <Spinner size="xs" className="border-2 border-aspectum-border-strong" />
                      <span>Сохранение...</span>
                    </>
                  ) : (
                    <>
                      <svg
                        className="w-3.5 h-3.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2.5}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      <span>Сохранено</span>
                    </>
                  )}
                </div>
              )}
              <Button
                type="button"
                variant="primary"
                size="md"
                onClick={onSaveCurrentCityInfo}
                disabled={cityInfoSaving}
              >
                {cityInfoSaving ? 'Сохранение...' : 'Сохранить'}
              </Button>
            </div>
          </main>
        </div>
      )}
    </section>
  );
}
