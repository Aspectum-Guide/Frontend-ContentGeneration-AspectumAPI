import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../../components/Layout';
import DataTable from '../../components/ui/DataTable';
import Modal from '../../components/ui/Modal';
import { ConfirmModal } from '../../components/ui/Modal';
import { Field, TextInput, Textarea, FormActions } from '../../components/ui/FormField';
import { useLayoutActions } from '../../context/LayoutActionsContext';
import { eventsAPI, citiesAPI, eventFiltersAPI } from '../../api/generation';
import { parseApiError } from '../../utils/apiError';
import { buildLangOptions, getMultiLangValue, pickPrimaryLangCode } from '../../features/catalog/shared/i18n';
import { normalizeListResponse } from '../../features/catalog/shared/normalize';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function createEmptyEvent() {
  return {
    id: null,
    title: {},
    description: {},
    tag_ids: [],
    city_id: '',
    is_show: true,
    image_url: null,
    image_copyright: '',
    lat: null,
    lon: null,
    media: null,
  };
}

// ─── LangTabs ────────────────────────────────────────────────────────────────
function LangTabs({ active, onSwitch, values = {}, langOptions = [] }) {
  const filled = new Set(Object.entries(values).filter(([, v]) => v?.trim()).map(([k]) => k));
  return (
    <div className="flex flex-wrap gap-1 mb-3">
      {langOptions.map(({ code, label, flag }) => (
        <button
          key={code}
          type="button"
          onClick={() => onSwitch(code)}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
            active === code
              ? 'bg-blue-600 text-white border-blue-600'
              : filled.has(code)
              ? 'bg-blue-50 text-blue-700 border-blue-300 hover:border-blue-500'
              : 'bg-white text-gray-500 border-gray-300 hover:border-blue-300 hover:text-blue-600'
          }`}
        >
          <span>{flag}</span>
          <span>{label}</span>
          {filled.has(code) && active !== code && (
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 inline-block" />
          )}
        </button>
      ))}
    </div>
  );
}

// ─── LangBlock ────────────────────────────────────────────────────────────────
function LangBlock({ label, value = {}, onChange, activeLang, multiline = false, rows = 3, required }) {
  const lang = activeLang;
  if (!lang) return null;
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label} <span className="text-gray-400 font-normal uppercase text-xs">{lang}</span>
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {multiline ? (
        <Textarea
          value={value?.[lang] || ''}
          onChange={e => onChange({ ...value, [lang]: e.target.value })}
          rows={rows}
          placeholder={`${label} (${lang})`}
        />
      ) : (
        <TextInput
          value={value?.[lang] || ''}
          onChange={e => onChange({ ...value, [lang]: e.target.value })}
          placeholder={`${label} (${lang})`}
        />
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function EventsCatalog() {
  const { setMobileActions } = useLayoutActions();
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [cityOptions, setCityOptions] = useState([]);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const PAGE_SIZE = 20;

  // Edit state
  const [editingEvent, setEditingEvent] = useState(null);
  const [editLoading, setEditLoading] = useState(false);
  const [activeLang, setActiveLang] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  // Event filters (tags)
  const [allEventFilters, setAllEventFilters] = useState([]);

  // Delete
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // ── Load events ─────────────────────────────────────────────────────────
  const loadEvents = useCallback(async (pageNum = 1, q = '', city = '') => {
    try {
      setLoading(true);
      setError(null);
      const params = {
        page: pageNum,
        page_size: PAGE_SIZE,
        ...(q ? { search: q } : {}),
        ...(city ? { city_id: city } : {}),
      };
      const response = await eventsAPI.list(params);
      const data = response?.data;
      const list = normalizeListResponse(data, ['events', 'results']);
      const count = data?.total ?? data?.count ?? list.length;
      setEvents(list);
      setTotalCount(count);
    } catch (err) {
      setError(parseApiError(err, 'Ошибка загрузки событий'));
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Load cities + event filters ─────────────────────────────────────────
  useEffect(() => {
    citiesAPI.list({ page_size: 300 }).then(r => {
      const data = r?.data;
      const list = normalizeListResponse(data, ['data', 'results']);
      setCityOptions(list);
    }).catch(() => {});

    eventFiltersAPI.list().then(r => {
      const data = r?.data;
      const list = normalizeListResponse(data, ['filters', 'tags', 'results']);
      setAllEventFilters(list);
    }).catch(() => {});
  }, []);

  useEffect(() => { loadEvents(page, search, cityFilter); }, [page, loadEvents]);

  useEffect(() => {
    const t = setTimeout(() => { setPage(1); loadEvents(1, search, cityFilter); }, 400);
    return () => clearTimeout(t);
  }, [search, cityFilter]);

  // ── Open edit: load full event data ─────────────────────────────────────
  const openEdit = useCallback(async (row) => {
    setSaveError(null);
    setActiveLang(pickPrimaryLangCode([row?.title, row?.description]));
    setEditingEvent({
      ...row,
      title: row.title || {},
      description: row.description || {},
      tag_ids: (row.tag_ids || []).map(String),
      city_id: row.city_id || '',
    });
    setEditLoading(true);
    try {
      const r = await eventsAPI.get(row.id);
      const d = r?.data;
      if (d) {
        setEditingEvent(prev => ({
          ...prev,
          title: d.title || prev.title || {},
          description: d.description || prev.description || {},
          city_id: d.city_id ? String(d.city_id) : (prev.city_id || ''),
          tag_ids: (d.tag_ids || d.tags || []).map(String),
          is_show: d.is_show ?? prev.is_show ?? true,
          image_url: d.image_url || prev.image_url || null,
          image_copyright: d.image_copyright || prev.image_copyright || '',
          lat: d.lat ?? prev.lat ?? null,
          lon: d.lon ?? prev.lon ?? null,
          media: d.media || null,
        }));
      }
    } catch {
      // ignore loading errors, edit dialog will use list row data
    }
    setEditLoading(false);
  }, []);

  const openCreate = useCallback(() => {
    setSaveError(null);
    setEditLoading(false);
    setActiveLang('');
    setEditingEvent(createEmptyEvent());
  }, []);

  // ── Toggle event tag ────────────────────────────────────────────────────
  const toggleTag = useCallback((filterId) => {
    setEditingEvent(prev => {
      if (!prev) return prev;
      const ids = prev.tag_ids || [];
      const sid = String(filterId);
      return {
        ...prev,
        tag_ids: ids.includes(sid)
          ? ids.filter(x => x !== sid)
          : [...ids, sid],
      };
    });
  }, []);

  // ── Save ────────────────────────────────────────────────────────────────
  const handleSave = async (e) => {
    e?.preventDefault();
    if (!editingEvent) return;
    try {
      setSaving(true);
      setSaveError(null);
      const payload = {
        title: editingEvent.title || {},
        description: editingEvent.description || {},
        is_show: !!editingEvent.is_show,
        city_id: editingEvent.city_id || null,
        tag_ids: (editingEvent.tag_ids || []).filter(Boolean),
      };
      if (editingEvent.id) {
        await eventsAPI.update(editingEvent.id, payload);
      } else {
        await eventsAPI.create(payload);
      }
      setEditingEvent(null);
      await loadEvents(page, search, cityFilter);
    } catch (err) {
      setSaveError(parseApiError(err, editingEvent?.id ? 'Ошибка сохранения' : 'Ошибка создания'));
    } finally {
      setSaving(false);
    }
  };

  // ── Delete ──────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      setDeleting(true);
      await eventsAPI.delete(deleteTarget.id);
      setDeleteTarget(null);
      await loadEvents(page, search, cityFilter);
    } catch (err) {
      alert(parseApiError(err, 'Ошибка удаления'));
    } finally {
      setDeleting(false);
    }
  };

  // ── Table columns ───────────────────────────────────────────────────────
  const columns = [
    {
      key: 'title',
      label: 'Название',
      render: (title, row) => (
        <div>
          <div className="font-medium text-gray-900 text-sm">{getMultiLangValue(title) || '—'}</div>
          {row.tags?.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {row.tags.slice(0, 3).map((tag, i) => (
                <span key={i} className="px-1.5 py-0.5 bg-purple-50 text-purple-700 rounded text-xs">
                  {tag}
                </span>
              ))}
              {row.tags.length > 3 && (
                <span className="text-xs text-gray-400">+{row.tags.length - 3}</span>
              )}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'city_display_name',
      label: 'Город',
      render: (v) => <span className="text-sm text-gray-600">{v || '—'}</span>,
    },
    {
      key: 'is_show',
      label: 'Статус',
      render: (v) => (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
          v ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
        }`}>
          {v ? 'Активно' : 'Скрыто'}
        </span>
      ),
    },
    {
      key: 'image_url',
      label: 'Фото',
      render: (url) => url
        ? <img src={url} alt="" className="w-10 h-10 object-cover rounded-md" />
        : <span className="text-gray-300 text-xs">—</span>,
    },
  ];

  const ee = editingEvent;
  const titleVal = typeof ee?.title === 'object' ? ee.title : {};
  const descVal = typeof ee?.description === 'object' ? ee.description : {};
  const langOptions = buildLangOptions([titleVal, descVal]);

  useEffect(() => {
    if (!editingEvent || langOptions.length === 0) return;
    const hasActive = langOptions.some((lang) => lang.code === activeLang);
    if (!hasActive) {
      setActiveLang(langOptions[0].code);
    }
  }, [editingEvent, langOptions, activeLang]);

  useEffect(() => {
    const actions = [
      {
        id: 'create-event',
        label: 'Создать событие',
        onClick: openCreate,
        disabled: saving,
        variant: editingEvent ? 'secondary' : 'primary',
      },
      {
        id: 'create-event-tag',
        label: 'Создать тег ивента',
        onClick: () => navigate('/catalog/tags?tab=event'),
        variant: 'secondary',
      },
    ];

    if (!editingEvent) {
      setMobileActions(actions);
      return () => setMobileActions([]);
    }

    actions.push(
      {
        id: 'save-event',
        label: saving ? (editingEvent?.id ? 'Сохранение...' : 'Создание...') : (editingEvent?.id ? 'Сохранить событие' : 'Создать событие'),
        onClick: () => {
          if (!saving) handleSave();
        },
        disabled: saving,
        variant: 'primary',
      },
      {
        id: 'close-event-editor',
        label: 'Закрыть форму',
        onClick: () => setEditingEvent(null),
      },
    );

    setMobileActions(actions);

    return () => setMobileActions([]);
  }, [editingEvent, openCreate, saving, setMobileActions, navigate]);

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Справочник событий</h1>
        <p className="mt-1 text-sm text-gray-500">Просмотр и редактирование событий</p>
      </div>

      <DataTable
        columns={columns}
        rows={events}
        loading={loading}
        error={error}
        emptyIcon="🎪"
        emptyText={search || cityFilter ? 'По запросу событий не найдено' : 'Событий нет'}
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Поиск по названию..."
        page={page}
        totalCount={totalCount}
        pageSize={PAGE_SIZE}
        onPage={setPage}
        filters={
          cityOptions.length > 0 && (
            <select
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="">Все города</option>
              {cityOptions.map((c) => (
                <option key={c.id} value={c.id}>{getMultiLangValue(c.name) || c.id}</option>
              ))}
            </select>
          )
        }
        actions={(row) => (
          <>
            <button
              onClick={() => openEdit(row)}
              className="px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 rounded-md hover:bg-blue-100 transition-colors"
            >
              Ред.
            </button>
            <button
              onClick={() => setDeleteTarget(row)}
              className="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 rounded-md hover:bg-red-100 transition-colors"
            >
              Удалить
            </button>
          </>
        )}
      />

      {/* ── Edit Modal ──────────────────────────────────────────────────── */}
      <Modal
        open={!!editingEvent}
        onClose={() => setEditingEvent(null)}
        title={ee?.id
          ? `Редактировать событие${ee ? ` — ${getMultiLangValue(ee.title) || ''}` : ''}`
          : 'Создать событие'}
        size="xl"
      >
        {editingEvent && (
          <form onSubmit={handleSave} className="space-y-5">
            {saveError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {saveError}
              </div>
            )}

            {editLoading && (
              <div className="flex items-center gap-2 text-sm text-gray-400 py-1">
                <span className="animate-spin w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full inline-block" />
                Загрузка данных события...
              </div>
            )}

            {/* ── Language switcher ─────────────────────────────────── */}
            {langOptions.length > 0 ? (
              <>
                <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
                  <p className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">Активный язык</p>
                  <LangTabs
                    active={activeLang}
                    onSwitch={setActiveLang}
                    values={titleVal}
                    langOptions={langOptions}
                  />
                </div>

                {/* ── Название ──────────────────────────────────────────── */}
                <LangBlock
                  label="Название"
                  value={titleVal}
                  onChange={v => setEditingEvent(p => ({ ...p, title: v }))}
                  activeLang={activeLang}
                  required
                />

                {/* ── Описание ──────────────────────────────────────────── */}
                <LangBlock
                  label="Описание"
                  value={descVal}
                  onChange={v => setEditingEvent(p => ({ ...p, description: v }))}
                  activeLang={activeLang}
                  multiline
                  rows={4}
                />
              </>
            ) : (
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
                Для этого события бэкенд не прислал переводы. Языки отображаются строго из JSON-ключей ответа.
              </div>
            )}

            {/* ── Город + Видимость ─────────────────────────────────── */}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Город">
                <select
                  value={ee?.city_id || ''}
                  onChange={e => setEditingEvent(p => ({ ...p, city_id: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="">— Без города —</option>
                  {cityOptions.map(c => (
                    <option key={c.id} value={String(c.id)}>
                      {getMultiLangValue(c.name) || c.id}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Видимость">
                <div className="flex items-center h-full pt-1">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <div
                      onClick={() => setEditingEvent(p => ({ ...p, is_show: !p.is_show }))}
                      className={`relative w-10 h-5 rounded-full transition-colors cursor-pointer ${
                        ee?.is_show ? 'bg-blue-600' : 'bg-gray-300'
                      }`}
                    >
                      <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${
                        ee?.is_show ? 'left-5' : 'left-0.5'
                      }`} />
                    </div>
                    <span className="text-sm text-gray-700">
                      {ee?.is_show ? 'Показывается' : 'Скрыто'}
                    </span>
                  </label>
                </div>
              </Field>
            </div>

            {/* ── Теги события ──────────────────────────────────────── */}
            {allEventFilters.length > 0 && (
              <Field label="Теги / категории события">
                <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto p-2 border border-gray-200 rounded-lg bg-gray-50">
                  {allEventFilters.map((f) => {
                    const fid = String(f.id);
                    const selected = (ee?.tag_ids || []).includes(fid);
                    const label = getMultiLangValue(f.name) || f.display_name || fid;
                    return (
                      <button
                        key={fid}
                        type="button"
                        onClick={() => toggleTag(fid)}
                        className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                          selected
                            ? 'bg-purple-600 text-white border-purple-600'
                            : 'bg-white text-gray-600 border-gray-300 hover:border-purple-400 hover:text-purple-600'
                        }`}
                      >
                        {label}
                        {selected && <span className="ml-0.5">✓</span>}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-1 text-xs text-gray-400">
                  Выбрано: {(ee?.tag_ids || []).length} тегов
                </p>
              </Field>
            )}

            {/* ── Медиа (превью) ────────────────────────────────────── */}
            {(ee?.image_url || ee?.media?.image?.url) && (
              <Field label="Текущее фото">
                <div className="relative w-full h-32 rounded-lg overflow-hidden border border-gray-200">
                  <img
                    src={ee?.image_url || ee?.media?.image?.url}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                </div>
                {(ee?.image_copyright || ee?.media?.image?.copyright) && (
                  <p className="mt-1 text-xs text-gray-400">
                    © {ee?.image_copyright || ee?.media?.image?.copyright}
                  </p>
                )}
              </Field>
            )}

            {/* ── Координаты (только для просмотра) ────────────────── */}
            {(ee?.lat != null || ee?.lon != null) && (
              <Field label="Координаты (только просмотр)">
                <div className="flex gap-3">
                  <TextInput
                    value={ee?.lat ?? ''}
                    readOnly
                    className="bg-gray-50 text-gray-400 font-mono text-xs cursor-not-allowed"
                    placeholder="lat"
                  />
                  <TextInput
                    value={ee?.lon ?? ''}
                    readOnly
                    className="bg-gray-50 text-gray-400 font-mono text-xs cursor-not-allowed"
                    placeholder="lon"
                  />
                </div>
                <p className="mt-1 text-xs text-gray-400">Координаты редактируются через EventLocation в Django Admin</p>
              </Field>
            )}

            {/* ── Действия ──────────────────────────────────────────── */}
            <div className="hidden md:block">
              <FormActions
                saving={saving}
                onCancel={() => setEditingEvent(null)}
                saveLabel={ee?.id ? 'Сохранить' : 'Создать'}
              />
            </div>
            <div className="md:hidden text-xs text-gray-500 border border-dashed border-gray-300 rounded-lg p-3">
              Кнопки формы перенесены в верхнее меню «Действия».
            </div>
          </form>
        )}
      </Modal>

      {/* ── Delete Modal ────────────────────────────────────────────────── */}
      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Удалить событие?"
        message={`Событие «${getMultiLangValue(deleteTarget?.title || deleteTarget?.name) || deleteTarget?.id}» будет удалено безвозвратно.`}
        confirmLabel="Удалить"
        danger
        loading={deleting}
      />
    </Layout>
  );
}
