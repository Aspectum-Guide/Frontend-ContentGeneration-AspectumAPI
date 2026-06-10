import 'leaflet/dist/leaflet.css';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ilCatalogAPI } from '../../../api/generation';
import Layout from '../../../components/Layout';
import DataTable from '../../../components/ui/DataTable';
import { Field, TextInput, Textarea } from '../../../components/ui/FormField';
import Modal, { ConfirmModal } from '../../../components/ui/Modal';
import { useLayoutActions } from '../../../context/useLayoutActions';
import { parseApiError } from '../../../utils/apiError';
import { buildLangOptions, getMultiLangValue } from '../shared/i18n';
import { LangBlock, LangTabs } from '../shared/LangFields';

const PAGE_SIZE = 20;
const ALL_LANGS = ['ru', 'en', 'it', 'fr', 'de', 'es'];

const parseCoord = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null; };

function ILEditorModal({ open, onClose, location, onSaved, cityOptions }) {
  const isNew = !location?.id;

  const [activeLang, setActiveLang] = useState('ru');
  const [form, setForm] = useState({ title: {}, description: {}, lat: '', lon: '', index: 0, is_show: true, city_id: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('content');

  const mapElRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const leafletRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    if (isNew) {
      setForm({ title: {}, description: {}, lat: '', lon: '', index: 0, is_show: true, city_id: '' });
    } else {
      setForm({
        title: location.title || {},
        description: location.description || {},
        lat: location.lat ?? '',
        lon: location.lon ?? '',
        index: location.index ?? 0,
        is_show: location.is_show ?? true,
        city_id: location.city_id ? String(location.city_id) : '',
      });
    }
    setError('');
    setActiveTab('content');
    setActiveLang('ru');
  }, [open, location?.id]);

  // Map init on tab switch
  useEffect(() => {
    const initMap = async () => {
      if (!open || activeTab !== 'map' || !mapElRef.current || mapRef.current) return;
      const { default: L } = await import('leaflet');
      leafletRef.current = L;
      if (L.Icon?.Default) {
        L.Icon.Default.mergeOptions({
          iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
          iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
          shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
        });
      }
      const lat = parseCoord(form.lat);
      const lon = parseCoord(form.lon);
      const map = L.map(mapElRef.current).setView(
        lat != null && lon != null ? [lat, lon] : [41.9028, 12.4964],
        lat != null && lon != null ? 13 : 5,
      );
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
      map.on('click', (e) => {
        setForm((p) => ({ ...p, lat: Number(e.latlng.lat.toFixed(6)), lon: Number(e.latlng.lng.toFixed(6)) }));
      });
      mapRef.current = map;
      if (lat != null && lon != null) {
        markerRef.current = L.marker([lat, lon]).addTo(map);
      }
      setTimeout(() => map.invalidateSize(), 50);
    };
    initMap();
  }, [open, activeTab]);

  useEffect(() => {
    const map = mapRef.current;
    const L = leafletRef.current;
    if (!map || !L || activeTab !== 'map') return;
    const lat = parseCoord(form.lat);
    const lon = parseCoord(form.lon);
    if (lat == null || lon == null) {
      if (markerRef.current) { map.removeLayer(markerRef.current); markerRef.current = null; }
      return;
    }
    if (!markerRef.current) {
      markerRef.current = L.marker([lat, lon]).addTo(map);
    } else {
      markerRef.current.setLatLng([lat, lon]);
    }
    map.setView([lat, lon], Math.max(map.getZoom(), 13));
  }, [form.lat, form.lon, activeTab]);

  // Reset map on close
  useEffect(() => {
    if (!open) {
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
    }
  }, [open]);

  const langOptions = buildLangOptions(Object.keys(form.title || {}).filter(Boolean).length
    ? Object.keys(form.title)
    : ALL_LANGS.slice(0, 2));

  const handleSave = async (e) => {
    e.preventDefault();
    if (!Object.values(form.title).some((v) => v?.trim())) {
      setError('Введите название хотя бы на одном языке');
      return;
    }
    setSaving(true); setError('');
    try {
      const payload = {
        title: form.title,
        description: form.description,
        lat: parseCoord(form.lat),
        lon: parseCoord(form.lon),
        index: Number(form.index || 0),
        is_show: form.is_show,
        ...(form.city_id ? { city_id: form.city_id } : {}),
      };
      if (isNew) {
        await ilCatalogAPI.create(payload);
      } else {
        await ilCatalogAPI.update(location.id, payload);
      }
      onSaved();
    } catch (err) {
      setError(parseApiError(err, 'Ошибка сохранения'));
    } finally {
      setSaving(false);
    }
  };

  const tabs = [
    { key: 'content', label: 'Контент' },
    { key: 'map', label: 'Карта' },
    { key: 'settings', label: 'Настройки' },
  ];

  return (
    <Modal open={open} onClose={onClose} title={isNew ? 'Новая локация' : 'Редактировать локацию'} size="lg">
      <div className="flex gap-2 mb-4 border-b border-gray-100 pb-3">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
              activeTab === tab.key ? 'bg-blue-50 text-blue-700' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <form onSubmit={handleSave}>
        {activeTab === 'content' && (
          <div className="space-y-4">
            <LangTabs
              active={activeLang}
              onSwitch={setActiveLang}
              value={form.title}
              onChangeValue={(v) => setForm((p) => ({ ...p, title: v }))}
              langOptions={langOptions}
            />
            <LangBlock
              label="Название"
              value={form.title}
              onChange={(v) => setForm((p) => ({ ...p, title: v }))}
              activeLang={activeLang}
              required
            />
            <LangBlock
              label="Описание"
              value={form.description}
              onChange={(v) => setForm((p) => ({ ...p, description: v }))}
              activeLang={activeLang}
              multiline
              rows={4}
            />
          </div>
        )}

        {activeTab === 'map' && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Широта (lat)">
                <TextInput
                  type="number"
                  step="any"
                  value={form.lat}
                  onChange={(e) => setForm((p) => ({ ...p, lat: e.target.value }))}
                  placeholder="41.902800"
                />
              </Field>
              <Field label="Долгота (lon)">
                <TextInput
                  type="number"
                  step="any"
                  value={form.lon}
                  onChange={(e) => setForm((p) => ({ ...p, lon: e.target.value }))}
                  placeholder="12.496400"
                />
              </Field>
            </div>
            <p className="text-xs text-gray-400">Кликните по карте чтобы выбрать точку</p>
            <div ref={mapElRef} className="w-full h-72 rounded-xl border border-gray-200 overflow-hidden" />
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Индекс (порядок)">
                <TextInput
                  type="number"
                  min={0}
                  value={form.index}
                  onChange={(e) => setForm((p) => ({ ...p, index: +e.target.value || 0 }))}
                />
              </Field>
              <Field label="Город">
                <select
                  value={form.city_id}
                  onChange={(e) => setForm((p) => ({ ...p, city_id: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="">— не выбран —</option>
                  {cityOptions.map((c) => (
                    <option key={c.id} value={String(c.id)}>{c.name}</option>
                  ))}
                </select>
              </Field>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.is_show}
                onChange={(e) => setForm((p) => ({ ...p, is_show: e.target.checked }))}
                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">Показывать в приложении</span>
            </label>
          </div>
        )}

        <div className="flex items-center gap-3 mt-5 pt-4 border-t border-gray-100">
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Сохранение…' : isNew ? 'Создать' : 'Сохранить'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Отмена
          </button>
          {error && <p className="text-xs text-red-600 bg-red-50 rounded px-2 py-1">{error}</p>}
        </div>
      </form>
    </Modal>
  );
}

export default function InteractiveLocationsCatalogPage() {
  const { setMobileActions } = useLayoutActions();

  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [showFilter, setShowFilter] = useState('');
  const [cities, setCities] = useState([]);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingRow, setEditingRow] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const map = new Map();
    for (const r of rows) {
      if (r.city_id && r.city_name) map.set(r.city_id, r.city_name);
    }
    setCities((prev) => {
      const merged = new Map(prev.map((c) => [c.id, c.name]));
      map.forEach((name, id) => merged.set(id, name));
      return [...merged.entries()].map(([id, name]) => ({ id, name }));
    });
  }, [rows]);

  const load = useCallback(async (p = 1) => {
    setLoading(true);
    setError(null);
    try {
      const r = await ilCatalogAPI.list({
        page: p, page_size: PAGE_SIZE,
        ...(search ? { search } : {}),
        ...(cityFilter ? { city_id: cityFilter } : {}),
        ...(showFilter ? { is_show: showFilter } : {}),
      });
      const data = r?.data;
      setRows(data?.results || []);
      setTotal(data?.total ?? 0);
      setPage(p);
    } catch (e) {
      setError(parseApiError(e, 'Ошибка загрузки'));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [search, cityFilter, showFilter]);

  useEffect(() => { load(1); setPage(1); }, [search, cityFilter, showFilter]);
  useEffect(() => { load(page); }, [page]);

  useEffect(() => {
    setMobileActions([{
      label: '+ Новая локация',
      onClick: () => { setEditingRow(null); setEditorOpen(true); },
    }]);
    return () => setMobileActions([]);
  }, [setMobileActions]);

  const toggleShow = async (row) => {
    const next = !row.is_show;
    setRows((prev) => prev.map((r) => r.id === row.id ? { ...r, is_show: next } : r));
    try {
      await ilCatalogAPI.update(row.id, { is_show: next });
    } catch {
      setRows((prev) => prev.map((r) => r.id === row.id ? { ...r, is_show: !next } : r));
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await ilCatalogAPI.delete(deleteTarget.id);
      setDeleteTarget(null);
      await load(rows.length === 1 && page > 1 ? page - 1 : page);
    } catch (e) {
      setError(parseApiError(e, 'Ошибка удаления'));
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  const handleSaved = () => {
    setEditorOpen(false);
    load(editingRow ? page : 1);
  };

  const isFiltered = !!(search || cityFilter || showFilter);

  const columns = [
    {
      key: 'title',
      label: 'Название',
      render: (v, row) => (
        <div className="flex items-center gap-3">
          {row.image_url
            ? <img src={row.image_url} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" />
            : <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-gray-300 shrink-0 text-lg">📍</div>
          }
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{getMultiLangValue(v) || '—'}</p>
            {row.lat != null && (
              <p className="text-xs text-gray-400 font-mono">{Number(row.lat).toFixed(4)}, {Number(row.lon).toFixed(4)}</p>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'city_name',
      label: 'Город',
      render: (v) => <span className="text-sm text-gray-600">{v || '—'}</span>,
    },
    {
      key: 'index',
      label: 'Индекс',
      render: (v) => <span className="text-sm text-gray-500">{v ?? '—'}</span>,
    },
    {
      key: 'is_show',
      label: 'Виден',
      render: (v, row) => (
        <button
          onClick={(e) => { e.stopPropagation(); toggleShow(row); }}
          className={`relative w-9 h-5 rounded-full transition-colors focus:outline-none ${v ? 'bg-blue-500' : 'bg-gray-300'}`}
        >
          <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${v ? 'left-4' : 'left-0.5'}`} />
        </button>
      ),
    },
    {
      key: 'actions',
      label: '',
      render: (_, row) => (
        <div className="flex items-center gap-2 justify-end" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => { setEditingRow(row); setEditorOpen(true); }}
            className="px-2 py-1 text-xs text-blue-600 bg-blue-50 rounded-md hover:bg-blue-100 transition-colors"
          >
            Ред.
          </button>
          <button
            onClick={() => setDeleteTarget(row)}
            className="px-2 py-1 text-xs text-red-500 bg-red-50 rounded-md hover:bg-red-100 transition-colors"
          >
            Удалить
          </button>
        </div>
      ),
    },
  ];

  return (
    <Layout>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Интерактивные локации</h1>
          <p className="mt-1 text-sm text-gray-500">Управление локациями для приложения</p>
        </div>
        <button
          onClick={() => { setEditingRow(null); setEditorOpen(true); }}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
        >
          + Новая локация
        </button>
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        loading={loading}
        error={error}
        isFiltered={isFiltered}
        emptyIcon="📍"
        emptyText="Интерактивных локаций нет"
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Поиск по названию…"
        page={page}
        totalCount={total}
        pageSize={PAGE_SIZE}
        onPage={setPage}
        onRowClick={(row) => { setEditingRow(row); setEditorOpen(true); }}
        filters={(
          <>
            <select
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="">Все города</option>
              {cities.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <select
              value={showFilter}
              onChange={(e) => setShowFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="">Любая видимость</option>
              <option value="true">Видимые</option>
              <option value="false">Скрытые</option>
            </select>
          </>
        )}
      />

      <ILEditorModal
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        location={editingRow}
        onSaved={handleSaved}
        cityOptions={cities}
      />

      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Удалить локацию?"
        message={`«${getMultiLangValue(deleteTarget?.title) || 'Локация'}» будет удалена безвозвратно.`}
        confirmLabel={deleting ? 'Удаление…' : 'Удалить'}
      />
    </Layout>
  );
}
