import { useEffect, useState } from 'react';
import { attractionCommerceAPI, eventsAPI } from '../../../api/generation';
import { Alert, Button, DropdownPanel, InlineState, Panel, SelectableCard, StatusBadge, TextInput } from '@aspectum/ui';
import { getMultiLangValue } from '../../../features/catalog/shared/i18n';
import { parseApiError } from '../../../utils/apiError';

/**
 * «Привязать тур»: продукт поставщика (Ventrata), который продаётся на событии
 * этого места. Текст, фото и аудиогид остаются вашими, поставщик даёт цены,
 * места и доступность. До публикации сессии выбор только запоминается и
 * применяется при публикации; у уже опубликованного места привязка сразу.
 */
export default function SessionAttractionTourPanel({ sessionId, attractionId, attractionName, externalProduct, publishedEventId }) {
  const [tour, setTour] = useState(externalProduct || null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    setTour(externalProduct || null);
    setOpen(false);
    setSearch('');
    setError('');
    setNotice('');
  }, [attractionId, externalProduct]);

  useEffect(() => {
    if (!open) return undefined;
    let active = true;
    setLoading(true);
    const term = search.trim() || getMultiLangValue(attractionName) || '';
    eventsAPI
      .listExternalProducts({
        search: term || undefined,
        page_size: 10,
        ...(publishedEventId && !search.trim() ? { event_id: publishedEventId } : {}),
      })
      .then((r) => active && setResults(r?.data?.external_products || []))
      .catch(() => active && setResults([]))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [open, search, attractionName, publishedEventId]);

  const save = async (product) => {
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const r = await attractionCommerceAPI.setExternalProduct(sessionId, attractionId, product ? product.id : null);
      setTour(r?.data?.external_product || null);
      setOpen(false);
      setSearch('');
      if (product) {
        setNotice(
          r?.data?.linked_now
            ? 'Тур привязан к событию этого места.'
            : 'Тур запомнен — привяжется к событию при публикации сессии.',
        );
      }
    } catch (err) {
      const linkedTitle = getMultiLangValue(err?.response?.data?.linked_event_title);
      setError(
        linkedTitle
          ? `Этот тур уже привязан к другому вашему событию: «${linkedTitle}». Сначала отвяжите его там.`
          : parseApiError(err, 'Не удалось привязать тур'),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Panel className="p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-aspectum-text-emphasis">Бронирование у поставщика (тур)</p>
        {!open && (
          <Button type="button" variant="primary" size="sm" onClick={() => setOpen(true)}>
            {tour ? 'Заменить тур' : 'Привязать тур'}
          </Button>
        )}
      </div>

      <p className="text-xs text-aspectum-text-muted">
        Тур — продукт поставщика (Ventrata): цены, билеты и места. Текст, фото и аудиогид остаются вашими.{' '}
        {publishedEventId
          ? 'Место уже опубликовано — тур привяжется к его событию сразу.'
          : 'Место ещё не опубликовано — тур привяжется к событию при публикации сессии.'}
      </p>

      {error && <Alert tone="error" className="text-xs">{error}</Alert>}
      {notice && <Alert tone="success" className="text-xs">{notice}</Alert>}

      {tour && (
        <Panel tone="accentPurple" className="flex items-start justify-between gap-2 p-2">
          <div className="min-w-0">
            <p className="truncate text-sm text-aspectum-text">{getMultiLangValue(tour.title) || tour.external_id || tour.id}</p>
            {tour.location_text && <p className="truncate text-xs text-aspectum-text-muted">{tour.location_text}</p>}
            <p className="mt-1 text-xs">
              <StatusBadge tone={tour.is_enabled ? 'success' : 'warning'} label={tour.is_enabled ? 'Продажи включены' : 'Продажи выключены'} />
            </p>
          </div>
          <Button type="button" variant="linkDanger" size="sm" disabled={saving} onClick={() => save(null)} className="shrink-0">
            Отвязать
          </Button>
        </Panel>
      )}

      {open && (
        <div>
          <TextInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Название или адрес тура поставщика…"
            disabled={saving}
          />
          <p className="mt-1 text-xs text-aspectum-text-disabled">
            {search.trim() ? 'Результаты поиска' : 'Подсказки по названию места — похожие сверху'}
          </p>
          <DropdownPanel className="mt-1 max-h-56 overflow-y-auto p-0">
            {loading && <InlineState loading size="xs" tone="disabled" className="p-2">Поиск…</InlineState>}
            {!loading && results.length === 0 && <InlineState size="xs" tone="disabled" className="p-2">Ничего не найдено</InlineState>}
            {!loading &&
              results.map((row) => {
                const blocked = Boolean(row.already_linked_event_id);
                return (
                  <SelectableCard
                    key={row.id}
                    disabled={blocked || saving}
                    onSelect={() => save(row)}
                    className="flex w-full flex-col px-3 py-2 text-left text-sm hover:bg-aspectum-purple-soft border-b border-aspectum-border-subtle last:border-0 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
                  >
                    <span className="flex items-center gap-2">
                      <span className="truncate">{getMultiLangValue(row.title) || row.external_id || row.id}</span>
                      {row.suggested && (
                        <span className="shrink-0 rounded bg-aspectum-success-muted px-1.5 py-0.5 text-[11px] font-medium text-aspectum-success-strong">похоже</span>
                      )}
                    </span>
                    {row.location_text && <span className="truncate text-xs text-aspectum-text-disabled">{row.location_text}</span>}
                    {blocked && (
                      <span className="text-xs text-aspectum-text-disabled">
                        Уже привязан к другому событию: {getMultiLangValue(row.already_linked_event_title) || row.already_linked_event_id}
                      </span>
                    )}
                    {row.replaces_event_id && !blocked && (
                      <span className="text-xs text-aspectum-warning">
                        Сейчас на событии «{getMultiLangValue(row.replaces_event_title) || row.replaces_event_id}» — оно будет скрыто, тур переедет к месту
                      </span>
                    )}
                  </SelectableCard>
                );
              })}
          </DropdownPanel>
          <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)} className="mt-2">
            Отмена
          </Button>
        </div>
      )}
    </Panel>
  );
}
