import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Chip } from '@aspectum/admin-ui-web';
import { partnerToursAdminAPI } from '../../../api/partners';
import Layout from '../../../components/Layout';
import { parseApiError } from '../../../utils/apiError';
import RelatedEventsField from '../events/RelatedEventsField';
import { eventsCatalogAPI } from '../events/api';
import { normalizeListResponse } from '../shared/normalize';
import {
  CURRENCIES,
  MISSING_LABELS,
  SPOKEN_LANGS,
  TEXT_LANGS,
  TOUR_STATUSES,
  formatDate,
  parseCoords,
  pickText,
  setText,
} from './tourFormat';

const input = 'w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-aspectum-primary-muted';
const label = 'block text-xs font-medium text-gray-500 mb-1';

function Section({ title, children }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
      <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
      {children}
    </div>
  );
}

function LinesEditor({ items, lang, onChange, placeholder }) {
  return (
    <div className="space-y-2">
      {items.map((item, index) => (
        <div key={index} className="flex gap-2">
          <input
            className={input}
            value={item?.[lang] || ''}
            placeholder={placeholder}
            onChange={(e) => onChange(items.map((row, i) => (i === index ? setText(row, lang, e.target.value) : row)))}
          />
          <button type="button" className="text-sm text-gray-500 px-2" onClick={() => onChange(items.filter((_, i) => i !== index))}>
            ✕
          </button>
        </div>
      ))}
      <button type="button" className="text-sm text-aspectum-primary-hover" onClick={() => onChange([...items, {}])}>
        + строка
      </button>
    </div>
  );
}

/**
 * Заявка экскурсии партнёра: карточка целиком (её можно поправить — правит
 * модератор), поля модератора (город, теги, связанные места) и решения:
 * «Опубликовать», «Вернуть на доработку» с комментарием, «Снять с платформы».
 */
const langNames = (codes) => codes.map((code) => TEXT_LANGS.find((l) => l.code === code)?.label || code).join(', ');

// Перевод делает студия по очереди боевого сервера (AspectumAPI docs/TOURS_CONSTRUCTOR.md, «Перевод»).
const TRANSLATION_STATUS = {
  pending: (t) => `Перевод в очереди: ${langNames(t.target_langs)}.`,
  taken: (t) => `Перевод готовится: ${langNames(t.target_langs)}.`,
  done: (t) =>
    t.applied_langs?.length
      ? `Перевод пришёл: ${langNames(t.applied_langs)}.`
      : 'Перевод пришёл, но все языки уже были заполнены — ничего не заменено.',
  failed: () => 'Перевод не удался — переведите вручную.',
};

export default function TourReviewPage() {
  const { draftId } = useParams();
  const [draft, setDraft] = useState(null);
  const [card, setCard] = useState(null);
  const [translateTo, setTranslateTo] = useState([]);
  const [lang, setLang] = useState('ru');
  const [cities, setCities] = useState([]);
  const [filters, setFilters] = useState([]);
  const [tagIds, setTagIds] = useState([]);
  const [related, setRelated] = useState([]);
  // Теги и связанные места отправляем, только если модератор их менял:
  // иначе повторная публикация стёрла бы поставленные раньше.
  const [bindingTouched, setBindingTouched] = useState({ tags: false, related: false });
  const [coords, setCoords] = useState('');
  const [comment, setComment] = useState('');
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [photoUrls, setPhotoUrls] = useState({});

  const apply = useCallback((data) => {
    setDraft(data);
    setCard(data.data || {});
    setTranslateTo(data.translate_to || []);
    const point = data.data?.meeting_point;
    setCoords(point?.lat != null && point?.lon != null ? `${point.lat}, ${point.lon}` : '');
    setDirty(false);
  }, []);

  const load = useCallback(async () => {
    try {
      setError(null);
      const response = await partnerToursAdminAPI.get(draftId);
      apply(response.data);
    } catch (err) {
      setError(parseApiError(err, 'Не удалось загрузить заявку'));
    }
  }, [apply, draftId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    eventsCatalogAPI
      .listCities()
      .then((r) => setCities(normalizeListResponse(r?.data, ['data', 'results'])))
      .catch(() => setCities([]));
    eventsCatalogAPI
      .listFilters()
      .then((r) => {
        const data = r?.data;
        setFilters(Array.isArray(data) ? data : normalizeListResponse(data, ['filters', 'tags', 'results']));
      })
      .catch(() => setFilters([]));
  }, []);

  const update = (patch) => {
    setCard((current) => patch(current || {}));
    setDirty(true);
  };

  const urls = useMemo(() => ({ ...(draft?.photos || {}), ...photoUrls }), [draft?.photos, photoUrls]);

  const run = async (fn, okText) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fn();
      if (response?.data) apply(response.data);
      if (okText) setNotice(okText);
    } catch (err) {
      const fields = err?.response?.data?.fields;
      const missing = fields ? Object.keys(fields).map((key) => MISSING_LABELS[key] || key).join(', ') : '';
      setError(`${parseApiError(err, 'Не получилось')}${missing ? `: ${missing}` : ''}`);
    } finally {
      setBusy(false);
    }
  };

  const save = () => run(() => partnerToursAdminAPI.update(draftId, { data: card, translate_to: translateTo }), 'Сохранено');

  const approve = async () => {
    if (dirty) await partnerToursAdminAPI.update(draftId, { data: card, translate_to: translateTo });
    await run(
      () =>
        partnerToursAdminAPI.approve(draftId, {
          ...(bindingTouched.tags || !draft.event_id ? { tag_ids: tagIds } : {}),
          ...(bindingTouched.related || !draft.event_id ? { related_event_ids: related.map((event) => event.id) } : {}),
          city_id: card?.city_id,
        }),
      'Экскурсия опубликована'
    );
  };

  const uploadPhotos = async (files) => {
    for (const file of Array.from(files || [])) {
      try {
        const response = await partnerToursAdminAPI.uploadPhoto(draft.partner_id, file);
        const { id, url } = response.data;
        setPhotoUrls((prev) => ({ ...prev, [id]: url }));
        update((c) => (c.cover_image_id ? { ...c, photo_ids: [...(c.photo_ids || []), id] } : { ...c, cover_image_id: id }));
      } catch (err) {
        setError(parseApiError(err, 'Не удалось загрузить фото'));
      }
    }
  };

  if (!draft || !card) {
    return (
      <Layout>
        <div className="p-6 text-sm text-gray-500">{error || 'Загружаем…'}</div>
      </Layout>
    );
  }

  const status = TOUR_STATUSES[draft.status] || { label: draft.status, className: 'bg-gray-100' };
  const photos = [card.cover_image_id, ...(card.photo_ids || [])].filter(Boolean);
  const canDecide = ['submitted', 'draft', 'changes_requested'].includes(draft.status);

  return (
    <Layout>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <Link to="/catalog/suppliers" className="text-sm text-aspectum-primary-hover">← Поставщики</Link>
        <h1 className="text-xl font-semibold text-gray-900 flex-1 min-w-0 truncate">{pickText(card.title) || 'Без названия'}</h1>
        <span className={`text-xs px-2 py-0.5 rounded-full ${status.className}`}>{status.label}</span>
      </div>
      <div className="text-xs text-gray-500 mb-4">
        {draft.partner_name}
        {draft.submitted_at ? ` · отправлена ${formatDate(draft.submitted_at)}` : ''}
        {draft.published_at ? ` · опубликована ${formatDate(draft.published_at)}` : ''}
        {draft.event_id ? (
          <>
            {' · '}
            <Link className="text-aspectum-primary-hover" to={`/catalog/events?search=${encodeURIComponent(pickText(card.title))}`}>
              экскурсия в каталоге
            </Link>
          </>
        ) : null}
      </div>

      {error && <div className="mb-3 p-3 rounded-lg bg-red-50 text-red-700 text-sm">{error}</div>}
      {notice && <div className="mb-3 p-3 rounded-lg bg-green-50 text-green-700 text-sm">{notice}</div>}
      {draft.machine_translated?.length ? (
        <div className="mb-3 p-3 rounded-lg bg-blue-50 text-blue-900 text-sm">
          Переведено автоматически: {langNames(draft.machine_translated)}. Проверьте эти языки перед публикацией —
          переключатель языка над текстами.
        </div>
      ) : null}
      {draft.missing?.length ? (
        <div className="mb-3 p-3 rounded-lg bg-amber-50 text-amber-800 text-sm">
          Не хватает: {draft.missing.map((key) => MISSING_LABELS[key] || key).join(', ')}
        </div>
      ) : null}

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-4">
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {TEXT_LANGS.map((item) => (
              <Chip key={item.code} selected={lang === item.code} onClick={() => setLang(item.code)}>
                {item.label}
                {card.title?.[item.code] ? ' ✓' : ''}
              </Chip>
            ))}
          </div>

          <Section title="Название и описание">
            <div>
              <label className={label}>Название</label>
              <input className={input} value={card.title?.[lang] || ''} onChange={(e) => update((c) => ({ ...c, title: setText(c.title, lang, e.target.value) }))} />
            </div>
            <div>
              <label className={label}>Коротко</label>
              <textarea rows={2} className={input} value={card.summary?.[lang] || ''} onChange={(e) => update((c) => ({ ...c, summary: setText(c.summary, lang, e.target.value) }))} />
            </div>
            <div>
              <label className={label}>Подробно</label>
              <textarea rows={8} className={input} value={card.description?.[lang] || ''} onChange={(e) => update((c) => ({ ...c, description: setText(c.description, lang, e.target.value) }))} />
            </div>
          </Section>

          <Section title="Место встречи">
            <div>
              <label className={label}>Адрес</label>
              <input className={input} value={card.meeting_point?.address || ''} onChange={(e) => update((c) => ({ ...c, meeting_point: { ...c.meeting_point, address: e.target.value } }))} />
            </div>
            <div>
              <label className={label}>Точка на карте (широта, долгота)</label>
              <input
                className={input}
                value={coords}
                placeholder="57.6261, 39.8845"
                onChange={(e) => {
                  setCoords(e.target.value);
                  const point = parseCoords(e.target.value);
                  update((c) => ({ ...c, meeting_point: { ...c.meeting_point, lat: point?.lat, lon: point?.lon } }));
                }}
              />
              {card.meeting_point?.lat != null && (
                <a
                  className="text-xs text-aspectum-primary-hover"
                  target="_blank"
                  rel="noreferrer"
                  href={`https://yandex.ru/maps/?pt=${card.meeting_point.lon},${card.meeting_point.lat}&z=16&l=map`}
                >
                  Открыть точку на карте
                </a>
              )}
            </div>
            <div>
              <label className={label}>Как найти</label>
              <textarea rows={2} className={input} value={card.meeting_point?.note?.[lang] || ''} onChange={(e) => update((c) => ({ ...c, meeting_point: { ...c.meeting_point, note: setText(c.meeting_point?.note, lang, e.target.value) } }))} />
            </div>
          </Section>

          <Section title="Фото">
            <div className="flex flex-wrap gap-3">
              {photos.map((id) => (
                <div key={id} className="w-40 space-y-1">
                  <div className="relative w-40 h-28 rounded-lg overflow-hidden bg-gray-100">
                    {urls[id] ? <img src={urls[id]} alt="" className="w-full h-full object-cover" /> : null}
                    {id === card.cover_image_id && (
                      <span className="absolute left-2 top-2 text-[11px] px-2 py-0.5 rounded-full bg-black/70 text-white">Обложка</span>
                    )}
                  </div>
                  <div className="flex justify-between text-xs">
                    {id !== card.cover_image_id ? (
                      <button
                        type="button"
                        className="text-aspectum-primary-hover"
                        onClick={() =>
                          update((c) => ({
                            ...c,
                            cover_image_id: id,
                            photo_ids: [c.cover_image_id, ...(c.photo_ids || [])].filter((pid) => pid && pid !== id),
                          }))
                        }
                      >
                        Сделать обложкой
                      </button>
                    ) : (
                      <span />
                    )}
                    <button
                      type="button"
                      className="text-gray-500"
                      onClick={() =>
                        update((c) =>
                          c.cover_image_id === id
                            ? { ...c, cover_image_id: (c.photo_ids || [])[0], photo_ids: (c.photo_ids || []).slice(1) }
                            : { ...c, photo_ids: (c.photo_ids || []).filter((pid) => pid !== id) }
                        )
                      }
                    >
                      Убрать
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <label className="inline-block text-sm px-3 py-1.5 rounded-lg border border-gray-300 cursor-pointer">
              Добавить фото
              <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={(e) => uploadPhotos(e.target.files)} />
            </label>
          </Section>

          <Section title="Что включено / не включено">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className={label}>Включено</div>
                <LinesEditor items={card.included || []} lang={lang} onChange={(included) => update((c) => ({ ...c, included }))} />
              </div>
              <div>
                <div className={label}>Не включено</div>
                <LinesEditor items={card.excluded || []} lang={lang} onChange={(excluded) => update((c) => ({ ...c, excluded }))} />
              </div>
            </div>
          </Section>

          <Section title="Маршрут">
            {(card.itinerary || []).map((stop, index) => (
              <div key={index} className="grid grid-cols-[1fr_90px_auto] gap-2">
                <input
                  className={input}
                  value={stop.name?.[lang] || ''}
                  placeholder={`Остановка ${index + 1}`}
                  onChange={(e) => update((c) => ({ ...c, itinerary: c.itinerary.map((s, i) => (i === index ? { ...s, name: setText(s.name, lang, e.target.value) } : s)) }))}
                />
                <input
                  className={input}
                  value={stop.duration_minutes || ''}
                  placeholder="мин"
                  onChange={(e) => update((c) => ({ ...c, itinerary: c.itinerary.map((s, i) => (i === index ? { ...s, duration_minutes: Number(e.target.value.replace(/\D/g, '')) || undefined } : s)) }))}
                />
                <button type="button" className="text-sm text-gray-500 px-2" onClick={() => update((c) => ({ ...c, itinerary: c.itinerary.filter((_, i) => i !== index) }))}>
                  ✕
                </button>
              </div>
            ))}
            <button type="button" className="text-sm text-aspectum-primary-hover" onClick={() => update((c) => ({ ...c, itinerary: [...(c.itinerary || []), { name: {} }] }))}>
              + остановка
            </button>
          </Section>

          <Section title="Длительность, языки, группа, билеты">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={label}>Длительность, минут</label>
                <input className={input} value={card.duration_minutes || ''} onChange={(e) => update((c) => ({ ...c, duration_minutes: Number(e.target.value.replace(/\D/g, '')) || undefined }))} />
              </div>
              <div>
                <label className={label}>Гостей в группе, не более</label>
                <input className={input} value={card.group_size || ''} onChange={(e) => update((c) => ({ ...c, group_size: Number(e.target.value.replace(/\D/g, '')) || undefined }))} />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {SPOKEN_LANGS.map((item) => {
                const active = (card.languages || []).includes(item.code);
                return (
                  <Chip
                    key={item.code}
                    selected={active}
                    onClick={() => update((c) => ({ ...c, languages: active ? (c.languages || []).filter((l) => l !== item.code) : [...(c.languages || []), item.code] }))}
                  >
                    {item.label}
                  </Chip>
                );
              })}
            </div>
            {(card.tickets || []).map((ticket, index) => (
              <div key={index} className="grid grid-cols-[1fr_120px_90px_auto] gap-2">
                <input
                  className={input}
                  value={ticket.name?.[lang] || ''}
                  placeholder="Билет"
                  onChange={(e) => update((c) => ({ ...c, tickets: c.tickets.map((t, i) => (i === index ? { ...t, name: setText(t.name, lang, e.target.value) } : t)) }))}
                />
                <input
                  className={input}
                  value={ticket.price || ''}
                  placeholder="Цена"
                  onChange={(e) => update((c) => ({ ...c, tickets: c.tickets.map((t, i) => (i === index ? { ...t, price: e.target.value.replace(',', '.').replace(/[^\d.]/g, '') } : t)) }))}
                />
                <select
                  className={input}
                  value={ticket.currency || 'RUB'}
                  onChange={(e) => update((c) => ({ ...c, tickets: c.tickets.map((t, i) => (i === index ? { ...t, currency: e.target.value } : t)) }))}
                >
                  {CURRENCIES.map((code) => (
                    <option key={code}>{code}</option>
                  ))}
                </select>
                <button type="button" className="text-sm text-gray-500 px-2" onClick={() => update((c) => ({ ...c, tickets: c.tickets.filter((_, i) => i !== index) }))}>
                  ✕
                </button>
              </div>
            ))}
            <button type="button" className="text-sm text-aspectum-primary-hover" onClick={() => update((c) => ({ ...c, tickets: [...(c.tickets || []), { name: {}, price: '', currency: 'RUB' }] }))}>
              + билет
            </button>
          </Section>

          <button
            type="button"
            disabled={!dirty || busy}
            onClick={save}
            className="text-sm px-4 py-2 rounded-lg border border-gray-300 bg-white disabled:opacity-40"
          >
            Сохранить правки
          </button>
        </div>

        <div className="space-y-4">
          <Section title="Привязка (модератор)">
            <div>
              <label className={label}>Город</label>
              <select
                className={input}
                value={card.city_id || ''}
                onChange={(e) => update((c) => ({ ...c, city_id: e.target.value || undefined }))}
              >
                <option value="">— не выбран —</option>
                {cities.map((city) => (
                  <option key={city.id} value={city.id}>
                    {pickText(city.name)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <div className={label}>Теги (папки в приложении)</div>
              <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto">
                {filters.map((filter) => {
                  const fid = String(filter.id);
                  const selected = tagIds.includes(fid);
                  return (
                    <Chip
                      key={fid}
                      selected={selected}
                      variant="purple"
                      onClick={() => {
                        setBindingTouched((prev) => ({ ...prev, tags: true }));
                        setTagIds((prev) => (selected ? prev.filter((id) => id !== fid) : [...prev, fid]));
                      }}
                    >
                      {filter.display_name || filter.slug || fid}
                    </Chip>
                  );
                })}
              </div>
            </div>
            <RelatedEventsField
              eventId={draft.event_id}
              relatedEvents={related}
              onAdd={(event) => {
                setBindingTouched((prev) => ({ ...prev, related: true }));
                setRelated((prev) => [...prev, event]);
              }}
              onRemove={(id) => {
                setBindingTouched((prev) => ({ ...prev, related: true }));
                setRelated((prev) => prev.filter((event) => String(event.id) !== String(id)));
              }}
            />
            {translateTo.length ? (
              <div className="text-xs text-gray-600">
                Партнёр просит перевод на: {langNames(translateTo)}
              </div>
            ) : null}
            {draft.translation ? (
              <div className="text-xs text-gray-600">{TRANSLATION_STATUS[draft.translation.status]?.(draft.translation) || ''}</div>
            ) : null}
          </Section>

          <Section title="Решение">
            {canDecide && (
              <button
                type="button"
                disabled={busy}
                onClick={approve}
                className="w-full text-sm px-4 py-2 rounded-lg bg-green-600 text-white disabled:opacity-40"
              >
                Опубликовать
              </button>
            )}
            {draft.status === 'submitted' && (
              <div className="space-y-2">
                <textarea
                  rows={3}
                  className={input}
                  placeholder="Что поправить — увидит партнёр"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                />
                <button
                  type="button"
                  disabled={busy || !comment.trim()}
                  onClick={() => run(() => partnerToursAdminAPI.requestChanges(draftId, comment.trim()), 'Вернули на доработку')}
                  className="w-full text-sm px-4 py-2 rounded-lg border border-amber-500 text-amber-700 disabled:opacity-40"
                >
                  Вернуть на доработку
                </button>
              </div>
            )}
            {draft.event_id && draft.status !== 'withdrawn' && (
              <button
                type="button"
                disabled={busy}
                onClick={() => run(() => partnerToursAdminAPI.unpublish(draftId), 'Снята с платформы')}
                className="w-full text-sm px-4 py-2 rounded-lg border border-red-300 text-red-700 disabled:opacity-40"
              >
                Снять с платформы
              </button>
            )}
            {draft.moderator_comment ? (
              <div className="text-xs text-gray-600">Последний комментарий: {draft.moderator_comment}</div>
            ) : null}
          </Section>
        </div>
      </div>
    </Layout>
  );
}
