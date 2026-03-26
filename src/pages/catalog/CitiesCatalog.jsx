import { useState, useEffect, useCallback, useRef } from 'react';
import Layout from '../../components/Layout';
import DataTable from '../../components/ui/DataTable';
import Modal from '../../components/ui/Modal';
import { ConfirmModal } from '../../components/ui/Modal';
import { Field, TextInput, Textarea, FormActions } from '../../components/ui/FormField';
import { citiesAPI, cityFiltersAPI, imagesAPI } from '../../api/generation';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getMultiLang(val) {
  if (!val) return '';
  if (typeof val === 'string') return val;
  return val.ru || val.en || val.it || Object.values(val).find(Boolean) || '';
}

const LANGS = [
  { code: 'ru', label: 'RU', flag: '🇷🇺' },
  { code: 'en', label: 'EN', flag: '🇺🇸' },
  { code: 'it', label: 'IT', flag: '🇮🇹' },
  { code: 'fr', label: 'FR', flag: '🇫🇷' },
  { code: 'de', label: 'DE', flag: '🇩🇪' },
  { code: 'es', label: 'ES', flag: '🇪🇸' },
];

// ─── LangTabs ────────────────────────────────────────────────────────────────
function LangTabs({ active, onSwitch, values = {} }) {
  const filled = new Set(Object.entries(values).filter(([, v]) => v?.trim()).map(([k]) => k));
  return (
    <div className="flex flex-wrap gap-1 mb-3">
      {LANGS.map(({ code, label, flag }) => (
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

// ─── LangBlock ─────────────────────────────────────────────────────────────
function LangBlock({ label, value = {}, onChange, activeLang, multiline = false, rows = 3, required }) {
  const lang = activeLang;
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
export default function CitiesCatalog() {
  const [allCities, setAllCities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  // Edit state
  const [editingCity, setEditingCity] = useState(null);
  const [editLoading, setEditLoading] = useState(false);
  const [activeLang, setActiveLang] = useState('ru');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  // Filters (city tags)
  const [allFilters, setAllFilters] = useState([]);

  // Image upload
  const imageInputRef = useRef(null);
  const [imageUploading, setImageUploading] = useState(false);

  // Delete
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // ── Load list ───────────────────────────────────────────────────────────
  const loadCities = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await citiesAPI.list({});
      const data = response?.data;
      const list = Array.isArray(data?.data) ? data.data
        : Array.isArray(data?.results) ? data.results
        : Array.isArray(data) ? data : [];
      setAllCities(list);
    } catch (err) {
      setError(err?.response?.data?.error || err.message || 'Ошибка загрузки городов');
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Load city filters (tags) ────────────────────────────────────────────
  const loadFilters = useCallback(async () => {
    try {
      const r = await cityFiltersAPI.list();
      const data = r?.data;
      const list = Array.isArray(data?.tags) ? data.tags
        : Array.isArray(data?.filters) ? data.filters
        : Array.isArray(data) ? data : [];
      setAllFilters(list);
    } catch {}
  }, []);

  useEffect(() => { loadCities(); loadFilters(); }, [loadCities, loadFilters]);
  useEffect(() => { setPage(1); }, [search]);

  // ── Filtered + paginated ────────────────────────────────────────────────
  const filtered = allCities.filter((c) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      getMultiLang(c.name).toLowerCase().includes(q) ||
      getMultiLang(c.country).toLowerCase().includes(q) ||
      (c.display_country || '').toLowerCase().includes(q)
    );
  });
  const totalCount = filtered.length;
  const cities = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // ── Open edit: load full city data ─────────────────────────────────────
  const openEdit = useCallback(async (row) => {
    setSaveError(null);
    setActiveLang('ru');
    setEditingCity({ ...row, city_filter_ids: row.city_filter_ids || [] });
    setEditLoading(true);
    try {
      const r = await citiesAPI.get(row.id);
      const d = r?.data?.city || r?.data;
      if (d) {
        setEditingCity(prev => ({
          ...prev,
          name: d.name || prev.name || {},
          description: d.description || prev.description || {},
          country: d.country || prev.country || {},
          lat: d.lat ?? prev.lat ?? '',
          lon: d.lon ?? prev.lon ?? '',
          image_id: d.image_id ?? prev.image_id ?? null,
          image_url: d.image_url ?? prev.image_url ?? null,
          image_copyright: d.image_copyright ?? prev.image_copyright ?? '',
          city_filter_ids: d.city_filter_ids || prev.city_filter_ids || [],
        }));
      }
    } catch {}
    setEditLoading(false);
  }, []);

  // ── Toggle filter ───────────────────────────────────────────────────────
  const toggleFilter = useCallback((filterId) => {
    setEditingCity(prev => {
      if (!prev) return prev;
      const ids = prev.city_filter_ids || [];
      const sid = String(filterId);
      return {
        ...prev,
        city_filter_ids: ids.includes(sid)
          ? ids.filter(x => x !== sid)
          : [...ids, sid],
      };
    });
  }, []);

  // ── Image upload ────────────────────────────────────────────────────────
  const handleImageUpload = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setImageUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const r = await imagesAPI.upload(fd);
      const { id, url } = r?.data || {};
      if (id) {
        setEditingCity(prev => ({ ...prev, image_id: id, image_url: url || prev.image_url }));
      }
    } catch (err) {
      setSaveError('Ошибка загрузки изображения: ' + (err?.response?.data?.error || err.message));
    } finally {
      setImageUploading(false);
    }
  }, []);

  // ── Save ────────────────────────────────────────────────────────────────
  const handleSave = async (e) => {
    e?.preventDefault();
    if (!editingCity?.id) return;
    try {
      setSaving(true);
      setSaveError(null);
      const payload = {
        name: editingCity.name || {},
        description: editingCity.description || {},
        country: editingCity.country || {},
        city_filter_ids: editingCity.city_filter_ids || [],
      };
      const latVal = editingCity.lat;
      const lonVal = editingCity.lon;
      if (latVal !== '' && latVal != null) payload.lat = parseFloat(latVal);
      if (lonVal !== '' && lonVal != null) payload.lon = parseFloat(lonVal);
      if (editingCity.image_id !== undefined) payload.image_id = editingCity.image_id;
      if (editingCity.image_copyright !== undefined) payload.image_copyright = editingCity.image_copyright;
      await citiesAPI.update(editingCity.id, payload);
      setEditingCity(null);
      await loadCities();
    } catch (err) {
      setSaveError(err?.response?.data?.error || 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  // ── Delete ──────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      setDeleting(true);
      await citiesAPI.delete(deleteTarget.id);
      setDeleteTarget(null);
      await loadCities();
    } catch (err) {
      alert(err?.response?.data?.error || 'Ошибка удаления');
    } finally {
      setDeleting(false);
    }
  };

  // ── Table columns ───────────────────────────────────────────────────────
  const columns = [
    {
      key: 'name',
      label: 'Название',
      render: (name, row) => (
        <div>
          <div className="font-medium text-gray-900 text-sm">{getMultiLang(name) || '—'}</div>
          {name && typeof name === 'object' && (
            <div className="text-xs text-gray-400 mt-0.5">
              {Object.entries(name).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join(' · ')}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'country',
      label: 'Страна',
      render: (country, row) => (
        <span className="text-sm text-gray-600">{row.display_country || getMultiLang(country) || '—'}</span>
      ),
    },
    {
      key: 'lat',
      label: 'Коорд.',
      render: (lat, row) => (
        <span className="text-xs font-mono text-gray-400">
          {lat != null ? `${parseFloat(lat).toFixed(3)}, ${parseFloat(row.lon).toFixed(3)}` : '—'}
        </span>
      ),
    },
    {
      key: 'id',
      label: 'ID',
      className: 'font-mono text-xs text-gray-400',
      render: (id) => String(id).slice(0, 12) + '…',
    },
  ];

  // ── Form state helpers ──────────────────────────────────────────────────
  const ec = editingCity;
  const nameVal = typeof ec?.name === 'object' ? ec.name : {};
  const descVal = typeof ec?.description === 'object' ? ec.description : {};
  const countryVal = typeof ec?.country === 'object' ? ec.country : {};

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Справочник городов</h1>
        <p className="mt-1 text-sm text-gray-500">Просмотр и редактирование городов базы данных</p>
      </div>

      <DataTable
        columns={columns}
        rows={cities}
        loading={loading}
        error={error}
        emptyIcon="🏙️"
        emptyText={search ? 'По запросу городов не найдено' : 'Городов нет'}
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Поиск по названию, стране..."
        page={page}
        totalCount={totalCount}
        pageSize={PAGE_SIZE}
        onPage={setPage}
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
        open={!!editingCity}
        onClose={() => setEditingCity(null)}
        title={`Редактировать город${ec ? ` — ${getMultiLang(ec.name) || ''}` : ''}`}
        size="xl"
      >
        {editingCity && (
          <form onSubmit={handleSave} className="space-y-5">
            {saveError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {saveError}
              </div>
            )}

            {editLoading && (
              <div className="flex items-center gap-2 text-sm text-gray-400 py-2">
                <span className="animate-spin w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full inline-block" />
                Загрузка данных...
              </div>
            )}

            {/* ── Language switcher ─────────────────────────────────── */}
            <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
              <p className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">Активный язык</p>
              <LangTabs
                active={activeLang}
                onSwitch={setActiveLang}
                values={nameVal}
              />
            </div>

            {/* ── Название ──────────────────────────────────────────── */}
            <LangBlock
              label="Название"
              value={nameVal}
              onChange={v => setEditingCity(p => ({ ...p, name: v }))}
              activeLang={activeLang}
              required
            />

            {/* ── Описание ──────────────────────────────────────────── */}
            <LangBlock
              label="Описание"
              value={descVal}
              onChange={v => setEditingCity(p => ({ ...p, description: v }))}
              activeLang={activeLang}
              multiline
              rows={4}
            />

            {/* ── Страна ────────────────────────────────────────────── */}
            <LangBlock
              label="Страна"
              value={countryVal}
              onChange={v => setEditingCity(p => ({ ...p, country: v }))}
              activeLang={activeLang}
            />

            {/* ── Координаты ────────────────────────────────────────── */}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Широта (lat)">
                <TextInput
                  type="number"
                  step="any"
                  value={ec?.lat ?? ''}
                  onChange={e => setEditingCity(p => ({ ...p, lat: e.target.value }))}
                  placeholder="55.7558"
                />
              </Field>
              <Field label="Долгота (lon)">
                <TextInput
                  type="number"
                  step="any"
                  value={ec?.lon ?? ''}
                  onChange={e => setEditingCity(p => ({ ...p, lon: e.target.value }))}
                  placeholder="37.6173"
                />
              </Field>
            </div>

            {/* ── Обложка ───────────────────────────────────────────── */}
            <Field label="Обложка города">
              <div className="space-y-2">
                {ec?.image_url && (
                  <div className="relative w-full h-32 rounded-lg overflow-hidden border border-gray-200">
                    <img src={ec.image_url} alt="" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setEditingCity(p => ({ ...p, image_id: null, image_url: null }))}
                      className="absolute top-1 right-1 w-6 h-6 bg-black/60 text-white rounded-full text-xs flex items-center justify-center hover:bg-black/80"
                    >
                      ×
                    </button>
                  </div>
                )}
                <div className="flex gap-2">
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => imageInputRef.current?.click()}
                    disabled={imageUploading}
                    className="px-3 py-2 text-xs font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors"
                  >
                    {imageUploading ? (
                      <span className="flex items-center gap-1.5">
                        <span className="animate-spin w-3 h-3 border border-gray-500 border-t-transparent rounded-full inline-block" />
                        Загрузка...
                      </span>
                    ) : '📷 Загрузить фото'}
                  </button>
                  {ec?.image_id && (
                    <span className="px-2 py-2 text-xs text-gray-400 font-mono">
                      ID: {String(ec.image_id).slice(0, 8)}…
                    </span>
                  )}
                </div>
                {ec?.image_id && (
                  <TextInput
                    value={ec?.image_copyright || ''}
                    onChange={e => setEditingCity(p => ({ ...p, image_copyright: e.target.value }))}
                    placeholder="Авторские права (copyright)"
                  />
                )}
              </div>
            </Field>

            {/* ── Теги города (фильтры) ─────────────────────────────── */}
            {allFilters.length > 0 && (
              <Field label="Теги города">
                <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto p-2 border border-gray-200 rounded-lg bg-gray-50">
                  {allFilters.map((f) => {
                    const fid = String(f.id);
                    const selected = (ec?.city_filter_ids || []).includes(fid);
                    const label = getMultiLang(f.name) || f.display_name || fid;
                    return (
                      <button
                        key={fid}
                        type="button"
                        onClick={() => toggleFilter(fid)}
                        className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                          selected
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400 hover:text-blue-600'
                        }`}
                      >
                        {f.emoji && <span>{f.emoji}</span>}
                        {label}
                        {selected && <span className="ml-0.5">✓</span>}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-1 text-xs text-gray-400">
                  Выбрано: {(ec?.city_filter_ids || []).length} тегов
                </p>
              </Field>
            )}

            {/* ── Действия ──────────────────────────────────────────── */}
            <FormActions saving={saving} onCancel={() => setEditingCity(null)} />
          </form>
        )}
      </Modal>

      {/* ── Delete Modal ────────────────────────────────────────────────── */}
      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Удалить город?"
        message={`Город «${getMultiLang(deleteTarget?.name) || deleteTarget?.id}» будет удалён безвозвратно.`}
        confirmLabel="Удалить"
        danger
        loading={deleting}
      />
    </Layout>
  );
}
