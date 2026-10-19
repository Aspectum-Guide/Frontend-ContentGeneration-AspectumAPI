import { useMemo, useState } from 'react';
import AiGenerationModal from '../../../components/generation/AiGenerationModal.jsx';
import { FormLabel, WizardActionFooter as WizardGenerationActionFooter, Glyph } from '@aspectum/admin-ui-web';
import AiGenerationQualitySettings from '../../../components/generation/AiGenerationQualitySettings.jsx';
import AiGenerationDedupeToggle from '../../../components/generation/AiGenerationDedupeToggle.jsx';
import AiGenerationCountField from '../../../components/generation/AiGenerationCountField.jsx';
import { getAttrName, normalizeId, filterPersistedSessionAttractions } from './sessionWizardShared.jsx';
import UsefulInfoTextImportBox from './UsefulInfoTextImportBox.jsx';
import { useAppLanguages } from '../../../hooks/useAppLanguages';
import { Alert, Button, Checkbox, EmptyState, EntityDraftsPanel, IconButton, LocaleEditor, Panel, SectionHeader, Select, SelectableCard, Textarea, TextInput } from '@aspectum/admin-ui-web';

const getAttractionDisplayName = (attraction) => {
  if (!attraction) return 'Без названия';

  try {
    const name = getAttrName(attraction);

    if (name && name !== '(без названия)') {
      return name;
    }
  } catch {
    // ignore
  }

  if (typeof attraction.name === 'string') {
    return attraction.name || 'Без названия';
  }

  if (attraction.name && typeof attraction.name === 'object') {
    return (
      attraction.name.ru ||
      attraction.name.en ||
      attraction.name.it ||
      Object.values(attraction.name).find(Boolean) ||
      attraction.id ||
      'Без названия'
    );
  }

  if (typeof attraction.title === 'string') {
    return attraction.title || 'Без названия';
  }

  if (attraction.title && typeof attraction.title === 'object') {
    return (
      attraction.title.ru ||
      attraction.title.en ||
      attraction.title.it ||
      Object.values(attraction.title).find(Boolean) ||
      attraction.id ||
      'Без названия'
    );
  }

  return (
    attraction.display_name ||
    attraction.name_ru ||
    attraction.title_ru ||
    attraction.id ||
    'Без названия'
  );
};

const getAttractionInfoName = (info) => {
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

const getDatabaseAttractionId = (info) => {
  return normalizeId(
    info?.event_id ??
      info?.event ??
      info?.attraction_id ??
      info?.attraction
  );
};

const getSessionAttractionId = (info) => {
  return normalizeId(
    info?.session_attraction_id ??
      info?.session_attraction ??
      info?.sessionAttractionId ??
      info?.sessionAttraction
  );
};

const isAttractionInfoBindingIncomplete = (info) => {
  const type = info?.assigned_attraction_type || 'none';
  if (type === 'database') return !getDatabaseAttractionId(info);
  if (type === 'draft') return !getSessionAttractionId(info);
  return false;
};

const getAttractionInfoBindingLabel = (
  info,
  referenceAttractions = [],
  sessionAttractions = []
) => {
  const assignedAttractionType = info?.assigned_attraction_type || 'none';

  if (assignedAttractionType === 'database') {
    const attractionFromInfo =
      info?.event && typeof info.event === 'object'
        ? info.event
        : info?.attraction && typeof info.attraction === 'object'
          ? info.attraction
          : null;

    const attractionId = getDatabaseAttractionId(info);

    const attraction =
      attractionFromInfo ||
      referenceAttractions.find((item) => normalizeId(item.id) === attractionId);

    return attraction
      ? `Достопримечательность из базы: ${getAttractionDisplayName(attraction)}`
      : 'Достопримечательность из базы: не выбрана';
  }

  if (assignedAttractionType === 'draft') {
    const attractionFromInfo =
      info?.session_attraction && typeof info.session_attraction === 'object'
        ? info.session_attraction
        : null;

    const attractionId = getSessionAttractionId(info);

    const attraction =
      attractionFromInfo ||
      sessionAttractions.find((item) => normalizeId(item.id) === attractionId);

    return attraction
      ? `Достопримечательность из сессии: ${getAttractionDisplayName(attraction)}`
      : 'Достопримечательность из сессии: не выбрана';
  }

  return 'Без достопримечательности';
};

function AttractionInfoDraftsPanel({
  attractionInfos = [],
  currentAttractionInfo,
  onSelectAttractionInfo,
  onAddAttractionInfo,
}) {
  const currentId = normalizeId(currentAttractionInfo?.id);

  return (
    <EntityDraftsPanel
      title="Черновики полезной информации о достопримечательностях"
      items={attractionInfos}
      emptyText="Пока нет полезной информации"
      actions={(
        <Button type="button" onClick={onAddAttractionInfo} variant="softStrong" size="sm">
          + Добавить
        </Button>
      )}
      renderItem={(info, index) => {
        const infoId = normalizeId(info.id);
        const isActive = infoId === currentId;
        return (
              <SelectableCard
                key={info.id}
                onSelect={() => {
                  if (!isActive) {
                    onSelectAttractionInfo?.(info.id);
                  }
                }}
                ariaLabel={getAttractionInfoName(info)}
                className={`flex items-center gap-1 px-2 py-1 rounded-aspectum-control border text-xs transition-colors ${
                  isActive
                    ? 'bg-aspectum-primary-soft border-aspectum-primary-border-strong text-aspectum-primary-hover font-medium'
                    : 'bg-aspectum-surface border-aspectum-border text-aspectum-text-strong hover:border-aspectum-primary-border-strong hover:bg-aspectum-primary-soft'
                }`}
                title={getAttractionInfoName(info)}
              >
                <span className="text-aspectum-text-disabled">{index + 1}.</span>
                <span>{getAttractionInfoName(info)}</span>
              </SelectableCard>
        );
      }}
    />
  );
}

export default function SessionWizardAttractionInfoStep({
  embedded = false,
  scopedToAttractionId = '',

  attractionInfos = [],
  currentAttractionInfo,
  attractionInfoLocaleData = {},
  attractionInfoActiveLocale = 'ru-RU',
  attractionInfoSaving = false,

  referenceAttractions = [],
  attractions = [],

  onOpenAttractionInfoDetail,
  onAddAttractionInfo,
  onSetCurrentAttractionInfo,
  onSetAttractionInfoActiveLocale,
  onUpdateAttractionInfoLocaleField,
  onUpdateCurrentAttractionInfoPatch,
  onSaveCurrentAttractionInfo,
  onDeleteCurrentAttractionInfo,
  onDeleteAttractionInfosByIds,
  onImportAttractionInfoFromText,
  onGoToStep,

  attractionInfoGenerateModalOpen = false,
  attractionInfoGeneratePrompt = '',
  attractionInfoGenerateCount = 5,
  attractionInfoDedupeExistingItems = true,
  onAttractionInfoDedupeExistingItemsChange,
  attractionInfoGenerating = false,
  attractionInfoGenerationError = '',
  attractionInfoGenerationLang = 'ru',
  attractionInfoGenerationTargetId = '',
  onOpenAttractionInfoGenerateModal,
  onCloseAttractionInfoGenerateModal,
  onAttractionInfoGeneratePromptChange,
  onAttractionInfoGenerateCountChange,
  onAttractionInfoGenerationLangChange,
  onAttractionInfoGenerationTargetIdChange,
  onGenerateAttractionInfoFromPrompt,
  aiGenerationMode = 'instant',
  aiUseWebSearch = false,
  aiAdvancedGenerationAvailable = true,
  onAiGenerationModeChange,
  onAiUseWebSearchChange,
}) {
  const { languages: appLanguages } = useAppLanguages();
  const aiGenerationLangOptions = appLanguages.map((language) => ({ value: language.code, label: `${language.label || language.name || language.code} (${language.code})` }));
  const currentLocale =
    attractionInfoLocaleData[attractionInfoActiveLocale] || {};

  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => new Set());

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelectedIds(new Set());
  };

  const toggleSelected = (id) => {
    const key = normalizeId(id);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const allInfoIds = attractionInfos.map((info) => normalizeId(info.id));
  const allSelected =
    allInfoIds.length > 0 && allInfoIds.every((id) => selectedIds.has(id));

  const toggleSelectAll = () => {
    setSelectedIds(allSelected ? new Set() : new Set(allInfoIds));
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    const res = await onDeleteAttractionInfosByIds?.(ids);
    if (!res?.cancelled) exitSelectMode();
  };

  const savedAttractions = useMemo(
    () => filterPersistedSessionAttractions(attractions),
    [attractions],
  );

  const selectedGenerationAttraction = useMemo(() => {
    const targetId = normalizeId(attractionInfoGenerationTargetId);
    if (!targetId) return null;
    return savedAttractions.find((item) => normalizeId(item?.id) === targetId) || null;
  }, [savedAttractions, attractionInfoGenerationTargetId]);

  const attractionSelectLocked = savedAttractions.length === 1;
  const canSubmitAttractionInfoGeneration =
    Boolean(normalizeId(attractionInfoGenerationTargetId)) && !attractionInfoGenerating;

  const attractionInfoHeaderActions = (
    <div className="flex items-center gap-2 shrink-0">
      <Button
        type="button"
        onClick={() => onOpenAttractionInfoGenerateModal?.()}
        variant="primary"
        size="md"
      >
        Сгенерировать
      </Button>
      <Button
        type="button"
        onClick={onAddAttractionInfo}
        variant="primary"
        size="md"
      >
        + Добавить
      </Button>
    </div>
  );

  const attractionInfoGenerationModal = (
    <AiGenerationModal
      open={attractionInfoGenerateModalOpen}
      onBackdropClick={() => {
        if (!attractionInfoGenerating) onCloseAttractionInfoGenerateModal?.();
      }}
      titleId="attraction-info-gen-title"
      busy={attractionInfoGenerating}
      footer={(
        <WizardGenerationActionFooter>
          <Button
            type="button"
            onClick={() => onCloseAttractionInfoGenerateModal?.()}
            disabled={attractionInfoGenerating}
            variant="outline"
            size="md"
          >
            Отмена
          </Button>
          <Button
            type="button"
            onClick={() => onGenerateAttractionInfoFromPrompt?.()}
            disabled={!canSubmitAttractionInfoGeneration}
            variant="primary"
            size="md"
          >
            Сгенерировать
          </Button>
        </WizardGenerationActionFooter>
      )}
    >
      <SectionHeader headingId="attraction-info-gen-title" title="Сгенерировать полезную информацию" />

      {savedAttractions.length > 0 ? (
        <div>
          <FormLabel
            htmlFor="attraction-info-gen-attraction"
             layout="block" size="sm" weight="medium" tone="strong" spacing="xs"
          >
            Достопримечательность
          </FormLabel>
          <Select className="disabled:bg-aspectum-surface-subtle" id="attraction-info-gen-attraction" value={attractionInfoGenerationTargetId || ''} onChange={(e) => onAttractionInfoGenerationTargetIdChange?.(e.target.value)} disabled={attractionInfoGenerating || attractionSelectLocked}>
            {savedAttractions.length > 1 && (
              <option value="">— Выберите достопримечательность —</option>
            )}
            {savedAttractions.map((attr) => (
              <option key={String(attr.id)} value={String(attr.id)}>
                {getAttrName(attr)}
              </option>
            ))}
          </Select>
          {attractionSelectLocked && selectedGenerationAttraction && (
            <p className="mt-1 text-xs text-aspectum-text-muted">
              В сессии одна достопримечательность — выбрана автоматически.
            </p>
          )}
        </div>
      ) : (
        <Alert tone="warning">Сначала добавьте достопримечательность.
        </Alert>
      )}

      <div>
        <FormLabel
          htmlFor="attraction-info-gen-lang"
           layout="block" size="sm" weight="medium" tone="strong" spacing="xs"
        >
          Язык
        </FormLabel>
        <Select className="disabled:bg-aspectum-surface-subtle" id="attraction-info-gen-lang" value={attractionInfoGenerationLang || 'ru'} onChange={(e) => onAttractionInfoGenerationLangChange?.(e.target.value)} disabled={attractionInfoGenerating}>
          {aiGenerationLangOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>
      </div>

      <div>
        <AiGenerationCountField
          id="attraction-info-gen-count"
          label="Количество блоков полезной информации"
          value={attractionInfoGenerateCount}
          onChange={onAttractionInfoGenerateCountChange}
          generationType="attraction_info"
          disabled={attractionInfoGenerating}
        />
      </div>

      {attractionInfoGenerationError && (
        <Alert tone="error">{attractionInfoGenerationError}</Alert>
      )}

      <AiGenerationQualitySettings
        generationMode={aiGenerationMode}
        onGenerationModeChange={onAiGenerationModeChange}
        useWebSearch={aiUseWebSearch}
        onUseWebSearchChange={onAiUseWebSearchChange}
        disabled={attractionInfoGenerating}
        advancedDisabled={!aiAdvancedGenerationAvailable}
      />

      <AiGenerationDedupeToggle
        checked={attractionInfoDedupeExistingItems}
        onChange={onAttractionInfoDedupeExistingItemsChange}
        disabled={attractionInfoGenerating}
        entityType="attraction_info"
      />

      <div>
        <FormLabel
          htmlFor="attraction-info-gen-prompt"
           layout="block" size="sm" weight="medium" tone="strong" spacing="xs"
        >
          Дополнительный промпт
        </FormLabel>
        <Textarea className="disabled:bg-aspectum-surface-subtle" id="attraction-info-gen-prompt" rows={4} value={attractionInfoGeneratePrompt} onChange={(e) => onAttractionInfoGeneratePromptChange?.(e.target.value)} disabled={attractionInfoGenerating} placeholder="Например: режим работы, билеты, как добраться, советы для семей" />
      </div>
    </AiGenerationModal>
  );

  const assignedAttractionType =
    currentAttractionInfo?.assigned_attraction_type || 'none';

  const selectedDatabaseAttractionId =
    getDatabaseAttractionId(currentAttractionInfo);

  const selectedSessionAttractionId =
    getSessionAttractionId(currentAttractionInfo);

  const isBindingIncomplete = isAttractionInfoBindingIncomplete(currentAttractionInfo);

  const updatePatch = (patch) => {
    onUpdateCurrentAttractionInfoPatch?.(patch);
  };

  if (!currentAttractionInfo) {
    return (
      <section className="space-y-4">
        {attractionInfoGenerationModal}

        <SectionHeader
          title="Полезная информация о достопримечательности"
          description="Добавьте полезные блоки: часы работы, билеты, правила посещения, советы"
          aside={!selectMode ? attractionInfoHeaderActions : null}
          actions={attractionInfos.length > 0 ? (
            <>
              {selectMode ? (
                <>
                  <Button
                    type="button"
                    onClick={toggleSelectAll}
                    variant="outline"
                    size="md"
                  >
                    {allSelected ? 'Снять все' : 'Выбрать все'}
                  </Button>
                  <Button
                    type="button"
                    onClick={handleBulkDelete}
                    disabled={selectedIds.size === 0}
                    variant="danger"
                    size="md"
                  >
                    Удалить ({selectedIds.size})
                  </Button>
                  <Button
                    type="button"
                    onClick={exitSelectMode}
                    variant="outline"
                    size="md"
                  >
                    Отмена
                  </Button>
                </>
              ) : (
                <Button
                  type="button"
                  onClick={() => setSelectMode(true)}
                  variant="outline"
                  size="md"
                >
                  Выбрать
                </Button>
              )}
            </>
          ) : null}
        />

        {scopedToAttractionId ? (
          <UsefulInfoTextImportBox
            title="Вставить готовую полезную информацию о достопримечательности"
            description="Строки с «# Заголовок» станут отдельными блоками полезной информации и будут привязаны к открытой достопримечательности."
            buttonLabel="Создать блоки о достопримечательности"
            defaultLanguage={attractionInfoGenerationLang || 'ru'}
            disabled={attractionInfoSaving || attractionInfoGenerating}
            onImport={onImportAttractionInfoFromText}
          />
        ) : null}

        {attractionInfos.length === 0 ? (
          <EmptyState
            icon="💡"
            title={scopedToAttractionId
              ? 'Для этой достопримечательности пока нет полезной информации.'
              : 'Нет полезной информации'}
            description={scopedToAttractionId ? 'Добавьте первый блок.' : 'Нажмите «+ Добавить», чтобы начать.'}
            className="py-10"
          />
        ) : (
          <div className="space-y-2">
            {attractionInfos.map((info, idx) => {
              const infoKey = normalizeId(info.id);
              const isSelected = selectedIds.has(infoKey);

              return (
                <div
                  key={info.id}
                  onClick={() =>
                    selectMode
                      ? toggleSelected(info.id)
                      : onOpenAttractionInfoDetail?.(info.id)
                  }
                  className={`flex items-center justify-between p-3 bg-aspectum-surface border rounded-aspectum-control cursor-pointer transition-colors ${
                    selectMode && isSelected
                      ? 'border-aspectum-primary-light bg-aspectum-primary-soft'
                      : 'border-aspectum-border hover:border-aspectum-primary-border-strong hover:bg-aspectum-primary-soft'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {selectMode && (
                      <Checkbox
                        checked={isSelected}
                        onChange={() => toggleSelected(info.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="shrink-0 cursor-pointer"
                      />
                    )}

                    <span className="w-6 h-6 flex items-center justify-center rounded-full bg-aspectum-surface-subtle text-xs font-medium text-aspectum-text-subtle shrink-0">
                      {idx + 1}
                    </span>

                    <div className="min-w-0">
                      <div className="text-sm font-medium text-aspectum-text truncate">
                        {getAttractionInfoName(info)}
                      </div>

                      <div className="flex items-center gap-1.5 text-xs text-aspectum-text-muted">
                        {getAttractionInfoBindingLabel(info, referenceAttractions, attractions)}
                        {isAttractionInfoBindingIncomplete(info) && (
                          <span className="px-1.5 py-0.5 rounded bg-aspectum-warning-muted text-aspectum-warning-strong font-medium shrink-0">
                            <Glyph name="⚠" /> не выбрана
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {selectMode ? (
                    <span className="text-xs text-aspectum-text-disabled font-medium shrink-0">
                      {isSelected ? 'Выбрано' : 'Выбрать'}
                    </span>
                  ) : (
                    <span className="text-xs text-aspectum-primary font-medium shrink-0">
                      Открыть →
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {!embedded && (
          <div className="flex justify-between pt-2">
            <Button
              type="button"
              onClick={() => onGoToStep?.(3)}
              variant="outline"
              size="md"
            >
              ← Назад
            </Button>

            <Button
              type="button"
              onClick={() => onGoToStep?.(4)}
              variant="primary"
              size="md"
            >
              Далее: Публикация →
            </Button>
          </div>
        )}
      </section>
    );
  }

  return (
    <section className="space-y-4">
      {attractionInfoGenerationModal}

      <div className="flex items-center gap-3">
        <IconButton
          label="Вернуться к списку полезной информации"
          type="button"
          onClick={() => onSetCurrentAttractionInfo?.(null)}
          variant="outline"
          className="w-8 h-8"
        >
          ←
        </IconButton>

        <span className="text-base font-semibold text-aspectum-text">
          {getAttractionInfoName(currentAttractionInfo)}
        </span>

        <Button
          type="button"
          onClick={onDeleteCurrentAttractionInfo}
          variant="softDanger"
          size="sm"
          className="ml-auto"
        >
          Удалить
        </Button>
      </div>

      <AttractionInfoDraftsPanel
        attractionInfos={attractionInfos}
        currentAttractionInfo={currentAttractionInfo}
        onSelectAttractionInfo={onOpenAttractionInfoDetail}
        onAddAttractionInfo={onAddAttractionInfo}
      />

      <LocaleEditor
        localeData={attractionInfoLocaleData}
        activeLocale={attractionInfoActiveLocale}
        onSwitch={onSetAttractionInfoActiveLocale}
        showStatus={false}
      />

      <main className="space-y-4">
        <div>
          <FormLabel  layout="block" size="sm" weight="medium" tone="strong" spacing="xs">
            Название ({currentLocale.lang?.toUpperCase() || 'RU'})
          </FormLabel>

          <TextInput type="text" value={currentLocale.name || ''} onChange={(e) => onUpdateAttractionInfoLocaleField?.('name', e.target.value) } placeholder="Например: Часы работы, Билеты, Как добраться" />
        </div>

        <Panel tone="muted" className="p-3 space-y-3">
          <div>
            <FormLabel  layout="block" size="sm" weight="medium" tone="strong" spacing="xs">
              Привязка к достопримечательности
            </FormLabel>

            <Select className="bg-aspectum-surface" value={assignedAttractionType} onChange={(e) => { const type = e.target.value; updatePatch({ assigned_attraction_type: type, event: null, event_id: null, attraction: null, attraction_id: null, session_attraction: null, session_attraction_id: null, }); }}>
              <option value="none">Без достопримечательности</option>
              <option value="database">Достопримечательность из базы</option>
              <option value="draft">Достопримечательность из сессии</option>
            </Select>
          </div>

          {assignedAttractionType === 'database' && (
            <div>
              <FormLabel  layout="block" size="sm" weight="medium" tone="strong" spacing="xs">
                Достопримечательность из базы
              </FormLabel>

              <Select className="bg-aspectum-surface" value={selectedDatabaseAttractionId} onChange={(e) => { const attractionId = e.target.value || null; updatePatch({ assigned_attraction_type: 'database', event: attractionId, event_id: attractionId, attraction: attractionId, attraction_id: attractionId, session_attraction: null, session_attraction_id: null, }); }}>
                <option value="">Выберите достопримечательность из базы</option>

                {referenceAttractions.map((attraction) => (
                  <option key={attraction.id} value={attraction.id}>
                    {getAttractionDisplayName(attraction)}
                  </option>
                ))}
              </Select>

              {referenceAttractions.length === 0 && (
                <p className="mt-1 text-xs text-aspectum-warning">
                  Список достопримечательностей из базы не загружен.
                </p>
              )}
            </div>
          )}

          {assignedAttractionType === 'draft' && (
            <div>
              <FormLabel  layout="block" size="sm" weight="medium" tone="strong" spacing="xs">
                Достопримечательность из сессии
              </FormLabel>

              <Select className="bg-aspectum-surface" value={selectedSessionAttractionId} onChange={(e) => { const attractionId = e.target.value || null; updatePatch({ assigned_attraction_type: 'draft', session_attraction: attractionId, session_attraction_id: attractionId, event: null, event_id: null, attraction: null, attraction_id: null, }); }}>
                <option value="">Выберите достопримечательность из сессии</option>

                {attractions.map((attraction) => (
                  <option key={attraction.id} value={attraction.id}>
                    {getAttractionDisplayName(attraction)}
                  </option>
                ))}
              </Select>

              {attractions.length === 0 && (
                <p className="mt-1 text-xs text-aspectum-warning">
                  В текущей сессии пока нет достопримечательностей.
                </p>
              )}
            </div>
          )}

          {isBindingIncomplete && (
            <p className="text-xs text-aspectum-warning-strong bg-aspectum-warning-soft border border-aspectum-warning-border rounded-aspectum-control px-3 py-2">
              <Glyph name="⚠" /> Выбран тип привязки, но достопримечательность не выбрана. Информация сохранится без привязки.
            </p>
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

          <Textarea value={currentLocale.description || ''} onChange={(e) => onUpdateAttractionInfoLocaleField?.('description', e.target.value) } rows={embedded ? 5 : 7} placeholder="Описание полезной информации для пользователя..." />
        </div>

        <div className="flex items-center justify-end gap-3">
          {isBindingIncomplete && (
            <span className="text-xs text-aspectum-warning">Привязка не выбрана</span>
          )}
          <Button
            type="button"
            onClick={onSaveCurrentAttractionInfo}
            disabled={attractionInfoSaving}
            variant="primary"
            size="md"
          >
            {attractionInfoSaving ? 'Сохранение...' : 'Сохранить'}
          </Button>
        </div>
      </main>
    </section>
  );
}
