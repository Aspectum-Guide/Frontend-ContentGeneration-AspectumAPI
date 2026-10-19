import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert, Button, ConfirmModal, Field, Panel, SearchSelect, StatusBadge } from '@aspectum/admin-ui-web';
import { getMultiLangValue } from '../shared/i18n';
import { useCatalogFilters } from '../core/useCatalogFilters';
import { eventsCatalogAPI } from './api';

/**
 * BookingAPI.ExternalProduct.event (OneToOne) — привязка продукта поставщика
 * к ЭТОМУ событию. Сохраняется сразу при выборе (у update_event нет такого
 * поля, см. onPick/onClear/onSetOwnership).
 *
 * Без поиска показываем подсказки: продукты города события, самые похожие по
 * названию сверху. Продукт, висящий на «событии-проекции поставщика»,
 * выбрать можно — он переедет сюда, а старое событие скроется.
 */
function renderProduct(row) {
  const blocked = Boolean(row.already_linked_event_id);
  const moves = Boolean(row.replaces_event_id);
  return (
    <>
      <span className="flex flex-col min-w-0">
        <span className="flex items-center gap-2 min-w-0">
          <span className="truncate">{getMultiLangValue(row.title) || row.external_id || row.id}</span>
          {row.suggested && (
            <span className="shrink-0 rounded bg-aspectum-success-muted px-1.5 py-0.5 text-[11px] font-medium text-aspectum-success-strong">
              похоже
            </span>
          )}
        </span>
        {row.location_text && <span className="truncate text-xs text-aspectum-text-disabled">{row.location_text}</span>}
        {blocked && (
          <span className="text-xs text-aspectum-text-disabled">
            Уже привязан к другому событию: {getMultiLangValue(row.already_linked_event_title) || row.already_linked_event_id}
          </span>
        )}
        {moves && (
          <span className="text-xs text-aspectum-warning">
            Сейчас на событии «{getMultiLangValue(row.replaces_event_title) || row.replaces_event_id}» — оно будет скрыто, продукт переедет сюда
          </span>
        )}
      </span>
      <span className="flex shrink-0 items-center gap-1 text-xs text-aspectum-text-disabled">
        {row.status && <span className="rounded bg-aspectum-surface-subtle px-1.5 py-0.5">{row.status}</span>}
      </span>
    </>
  );
}

export default function ExternalProductField({
  eventId,
  externalProduct,
  onPick,
  onClear,
  onSetOwnership,
  saving,
  error,
}) {
  const { search, setSearch, debouncedSearch } = useCatalogFilters({ debounceMs: 300 });
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [ownershipConfirmOpen, setOwnershipConfirmOpen] = useState(false);
  const linked = Boolean(externalProduct);

  useEffect(() => {
    if (linked) {
      setResults([]);
      return undefined;
    }
    let active = true;
    setLoading(true);
    eventsCatalogAPI
      .listExternalProducts({ search: debouncedSearch.trim() || undefined, page_size: 10, event_id: eventId })
      .then((r) => {
        if (active) setResults(r?.data?.external_products || []);
      })
      .catch(() => {
        if (active) setResults([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [debouncedSearch, eventId, linked]);

  const supplierText = externalProduct?.sync_event_content;
  const title = externalProduct
    ? getMultiLangValue(externalProduct.title) || externalProduct.external_id || externalProduct.id
    : '';

  return (
    <Field label="Бронирование у поставщика (Ventrata)">
      <Panel tone="info" className="mb-3 p-3 text-xs space-y-1">
        <p className="font-medium text-aspectum-text-strong">Что это и что здесь нажимать</p>
        <p>
          Поставщик отдаёт билеты, цены и места. Эта привязка подключает их к <b>этому</b> событию:
          текст, фото и аудиогид остаются вашими, а кнопка «Забронировать» берёт цены и доступность у поставщика.
        </p>
        <p>
          Нет подходящего продукта в списке или нужно создать событие из продукта? Это делается на странице{' '}
          <Link className="text-aspectum-purple-strong underline" to="/catalog/external-products/linking">
            «Внешние продукты → Привязка к событиям»
          </Link>.
        </p>
      </Panel>

      {error && <Alert tone="error" className="mb-2 text-xs">{error}</Alert>}

      {linked ? (
        <Panel tone="muted" className="p-3 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-medium text-aspectum-text truncate">{title}</p>
              <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
                <StatusBadge tone={supplierText ? 'info' : 'success'} label={supplierText ? 'Название и описание — от поставщика' : 'Название и описание — ваши'} />
                <StatusBadge tone={externalProduct.is_enabled ? 'success' : 'warning'} label={externalProduct.is_enabled ? 'Продажи включены' : 'Продажи выключены'} />
              </p>
            </div>
            <Button
              type="button"
              variant="linkDanger"
              size="sm"
              onClick={onClear}
              disabled={saving}
              className="shrink-0"
            >
              Отвязать
            </Button>
          </div>

          <p className="text-xs text-aspectum-text-muted">
            {supplierText
              ? 'Каждая синхронизация перезаписывает название, описание и город события данными поставщика. Если вы редактируете текст сами — заберите его себе, иначе правки пропадут.'
              : 'Синхронизация не трогает текст события. Цены, места и доступность всё равно приходят от поставщика.'}
          </p>
          {!externalProduct.is_enabled && (
            <p className="text-xs text-aspectum-warning-strong">
              Продажи включаются в Django-админке (Внешние продукты → «Включено»). Пока выключено, кнопки бронирования в приложении нет.
            </p>
          )}

          <Button
            type="button"
            variant="outline"
            size="md"
            disabled={saving}
            onClick={() => {
              if (supplierText) {
                onSetOwnership?.(externalProduct.id, false);
              } else {
                setOwnershipConfirmOpen(true);
              }
            }}
          >
            {supplierText ? 'Забрать текст себе' : 'Вернуть текст поставщику'}
          </Button>
          {saving && <span className="ml-2 text-xs text-aspectum-text-disabled">Сохранение...</span>}
          <ConfirmModal
            open={ownershipConfirmOpen}
            onClose={() => setOwnershipConfirmOpen(false)}
            onConfirm={() => {
              onSetOwnership?.(externalProduct.id, true);
              setOwnershipConfirmOpen(false);
            }}
            title="Вернуть текст поставщику?"
            message="Следующая синхронизация перезапишет название, описание и город этого события."
            confirmLabel="Вернуть"
            danger
          />
        </Panel>
      ) : (
        <>
          <SearchSelect
            value={search}
            onChange={setSearch}
            placeholder="Поиск продукта поставщика по названию или адресу..."
            disabled={saving}
            options={results}
            loading={loading}
            emptyText={search.trim() ? 'Ничего не найдено' : 'Подходящих продуктов нет — попробуйте найти по названию или адресу'}
            isOptionDisabled={(row) => Boolean(row.already_linked_event_id) || saving}
            onSelect={(row) => { onPick(row); setSearch(''); }}
            renderOption={renderProduct}
          />
          <p className="mt-1 text-xs text-aspectum-text-disabled">
            {search.trim() ? 'Результаты поиска' : 'Подсказки: продукты, похожие по названию и месту, — сверху'}
          </p>
        </>
      )}
    </Field>
  );
}
