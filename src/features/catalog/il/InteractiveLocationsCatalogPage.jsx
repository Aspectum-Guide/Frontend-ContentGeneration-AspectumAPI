import 'leaflet/dist/leaflet.css';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ilCatalogAPI, imagesAPI } from './api';
import ILCityPhotosEditor from './ILCityPhotosEditor';
import { eventsCatalogAPI } from '../events/api';
import Layout from '../../../components/Layout';
import { FormLabel, Alert, Button, Chip, ConfirmModal, DataTable, EmptyState, Field, FileButton, FormGrid, IconButton, Modal, PageHeader, Panel, Select, Switch, TableRowActions, Tabs, TextInput, Glyph } from '@aspectum/ui';
import { useLayoutActions } from '../../../context/useLayoutActions';
import { parseApiError } from '../../../utils/apiError';
import { createCoordinatePasteHandler, parseCoord } from '../../../utils/coordinates';
import { buildLangOptions, getMultiLangValue } from '../shared/i18n';
import { LangBlock, LangTabs } from '../shared/LangFields';
import { useAppLanguages } from '../../../hooks/useAppLanguages';

const PAGE_SIZE = 20;

function ILEditorModal({ open, onClose, location, onSaved, cityOptions, tagOptions = [] }) {
  const isNew = !location?.id;
  const { languages: appLanguages } = useAppLanguages();

  const [activeLang, setActiveLang] = useState('ru');
  const [form, setForm] = useState({
    title: {}, description: {}, lat: '', lon: '', index: 0, rank: '',
    is_show: true, city_id: '', image_id: null, image_url: null, icon_id: null, icon_url: null,
    tag_ids: [],
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('content');
  const [imageUploading, setImageUploading] = useState(false);
  const [iconUploading, setIconUploading] = useState(false);
  const imageInputRef = useRef(null);
  const iconInputRef = useRef(null);

  const mapElRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const leafletRef = useRef(null);
  const locationRef = useRef(location);
  const formRef = useRef(form);
  locationRef.current = location;
  formRef.current = form;

  useEffect(() => {
    if (!open) return;
    if (isNew) {
      setForm({
        title: {}, description: {}, lat: '', lon: '', index: 0, rank: '',
        is_show: true, city_id: '', image_id: null, image_url: null, icon_id: null, icon_url: null,
        tag_ids: [],
      });
    } else {
      const location = locationRef.current;
      setForm({
        title: location.title || {},
        description: location.description || {},
        lat: location.lat ?? '',
        lon: location.lon ?? '',
        index: location.index ?? 0,
        rank: location.rank ?? '',
        is_show: location.is_show ?? true,
        city_id: location.city_id ? String(location.city_id) : '',
        image_id: location.image_id || null,
        image_url: location.image_url || null,
        icon_id: location.icon_id || null,
        icon_url: location.icon_url || null,
        tag_ids: (location.tag_ids || []).map(String),
      });
    }
    setError('');
    setActiveTab('content');
    setActiveLang('ru');
  }, [open, location?.id, isNew]);

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
      const currentForm = formRef.current;
      const lat = parseCoord(currentForm.lat);
      const lon = parseCoord(currentForm.lon);
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

  // Reset map and upload state on close
  useEffect(() => {
    if (!open) {
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
      setImageUploading(false);
      setIconUploading(false);
    }
  }, [open]);

  const defaultLanguageCodes = ['ru', ...appLanguages.map((language) => language.code).filter((code) => code !== 'ru')].slice(0, 2);
  const langOptions = buildLangOptions(Object.keys(form.title || {}).filter(Boolean).length
    ? Object.keys(form.title)
    : defaultLanguageCodes);

  const handleImageUpload = async (e, kind) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    kind === 'icon' ? setIconUploading(true) : setImageUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const r = await imagesAPI.upload(fd);
      const { id, url } = r?.data || {};
      if (id) {
        if (kind === 'icon') {
          setForm((p) => ({ ...p, icon_id: id, icon_url: url || null }));
        } else {
          setForm((p) => ({ ...p, image_id: id, image_url: url || null }));
        }
      }
    } catch (err) {
      setError('Ошибка загрузки: ' + parseApiError(err, 'Ошибка'));
    } finally {
      kind === 'icon' ? setIconUploading(false) : setImageUploading(false);
    }
  };

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
        rank: form.rank === '' ? null : Number(form.rank),
        is_show: form.is_show,
        city_id: form.city_id || null,
        image_id: form.image_id || null,
        icon_id: form.icon_id || null,
        tag_ids: form.tag_ids || [],
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
    { key: 'media', label: 'Медиа' },
    { key: 'photos', label: 'Фото' },
  ];

  return (
    <Modal open={open} onClose={onClose} title={isNew ? 'Новая локация' : 'Редактировать локацию'} size="lg">
      <div className="mb-4 border-b border-aspectum-border-subtle pb-3">
        <Tabs
          items={tabs.map(({ key, label }) => ({ id: key, label }))}
          value={activeTab}
          onChange={setActiveTab}
        />
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
            <FormGrid responsive={false}>
              <Field label="Широта (lat)">
                <TextInput
                  type="number"
                  step="any"
                  value={form.lat}
                  onChange={(e) => setForm((p) => ({ ...p, lat: e.target.value }))}
                  onPaste={createCoordinatePasteHandler(({ lat, lon }) => setForm((p) => ({ ...p, lat: String(lat), lon: String(lon) })))}
                  placeholder="41.902800"
                />
              </Field>
              <Field label="Долгота (lon)">
                <TextInput
                  type="number"
                  step="any"
                  value={form.lon}
                  onChange={(e) => setForm((p) => ({ ...p, lon: e.target.value }))}
                  onPaste={createCoordinatePasteHandler(({ lat, lon }) => setForm((p) => ({ ...p, lat: String(lat), lon: String(lon) })))}
                  placeholder="12.496400"
                />
              </Field>
            </FormGrid>
            <p className="text-xs text-aspectum-text-disabled">Кликните по карте чтобы выбрать точку</p>
            <div ref={mapElRef} className="w-full h-72 rounded-aspectum-card border border-aspectum-border overflow-hidden" />
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="space-y-4">
            <FormGrid responsive={false}>
              <Field label="Индекс (порядок)">
                <TextInput
                  type="number"
                  min={0}
                  value={form.index}
                  onChange={(e) => setForm((p) => ({ ...p, index: +e.target.value || 0 }))}
                />
              </Field>
              <Field label="Ранг (rank)">
                <TextInput
                  type="number"
                  value={form.rank}
                  onChange={(e) => setForm((p) => ({ ...p, rank: e.target.value }))}
                  placeholder="авто"
                />
              </Field>
              <Field label="Город">
                <Select value={form.city_id} onChange={(e) => setForm((p) => ({ ...p, city_id: e.target.value }))}>
                  <option value="">— не выбран —</option>
                  {cityOptions.map((c) => (
                    <option key={c.id} value={String(c.id)}>{c.name}</option>
                  ))}
                </Select>
              </Field>
            </FormGrid>
            <FormLabel  layout="row" interactive>
              <Switch
                checked={form.is_show}
                onChange={(is_show) => setForm((p) => ({ ...p, is_show }))}
                aria-label="Показывать локацию"
              />
              <span className="text-sm text-aspectum-text-strong">Показывать в приложении</span>
            </FormLabel>
            {tagOptions.length > 0 && (
              <Field label="Теги">
                <Panel tone="muted" className="flex flex-wrap gap-2 max-h-36 overflow-y-auto p-2">
                  {tagOptions.map((tag) => {
                    const tid = String(tag.id);
                    const selected = form.tag_ids.includes(tid);
                    const label = tag.display_name || tag.slug || tid;
                    return (
                      <Chip
                        key={tid}
                        variant="purple"
                        selected={selected}
                        onClick={() => setForm((p) => ({
                          ...p,
                          tag_ids: selected
                            ? p.tag_ids.filter((x) => x !== tid)
                            : [...p.tag_ids, tid],
                        }))}
                      >
                        {label}
                      </Chip>
                    );
                  })}
                </Panel>
              </Field>
            )}
          </div>
        )}

        {activeTab === 'media' && (
          <div className="space-y-5">
            <div>
              <p className="text-sm font-medium text-aspectum-text-strong mb-2">Иконка (маркер на карте)</p>
              <div className="flex items-start gap-4">
                <div className="w-16 h-16 rounded-aspectum-card border border-aspectum-border bg-aspectum-surface-muted flex items-center justify-center shrink-0 overflow-hidden">
                  {form.icon_url
                    ? <img src={form.icon_url} alt="" className="w-full h-full object-contain" />
                    : <span className="text-2xl"><Glyph name="📍" /></span>
                  }
                </div>
                <div className="flex flex-col gap-2">
                  <FileButton inputRef={iconInputRef} accept="image/*,.svg" variant="secondary" size="md" onChange={(e) => handleImageUpload(e, 'icon')} disabled={iconUploading}>
                    {iconUploading ? 'Загрузка…' : 'Загрузить иконку'}
                  </FileButton>
                  {form.icon_id && (
                    <Button type="button" variant="softDanger" size="md" onClick={() => setForm((p) => ({ ...p, icon_id: null, icon_url: null }))}>
                      Удалить иконку
                    </Button>
                  )}
                </div>
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-aspectum-text-strong mb-2">Изображение (обложка)</p>
              <div className="space-y-2">
                {form.image_url
                  ? (
                    <div className="relative w-full h-40 rounded-aspectum-card border border-aspectum-border bg-aspectum-surface-subtle overflow-hidden">
                      <img src={form.image_url} alt="" className="w-full h-full object-cover" />
                      <IconButton label="Удалить изображение" type="button" onClick={() => setForm((p) => ({ ...p, image_id: null, image_url: null }))}
                        variant="overlay" size="iconOverlay" className="absolute top-2 right-2">
                        ×
                      </IconButton>
                    </div>
                  ) : (
                    <EmptyState title="Изображение не выбрано" className="py-8" />
                  )
                }
                <FileButton inputRef={imageInputRef} accept="image/*" variant="secondary" size="md" onChange={(e) => handleImageUpload(e, 'image')} disabled={imageUploading}>
                  {imageUploading ? 'Загрузка…' : 'Загрузить изображение'}
                </FileButton>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'photos' && (
          <ILCityPhotosEditor cityId={form.city_id || null} disabled={isNew && !form.city_id} />
        )}

        <div className="flex items-center gap-3 mt-5 pt-4 border-t border-aspectum-border-subtle">
          <Button type="submit" variant="primary" size="md" disabled={saving}>
            {saving ? 'Сохранение…' : isNew ? 'Создать' : 'Сохранить'}
          </Button>
          <Button type="button" variant="secondary" size="md" onClick={onClose}>
            Отмена
          </Button>
          {error && <Alert tone="error" className="text-xs px-2 py-1">{error}</Alert>}
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
  const loadRequestRef = useRef(0);
  const [search, setSearch] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [showFilter, setShowFilter] = useState('');
  const [cities, setCities] = useState([]);
  const [tagOptions, setTagOptions] = useState([]);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingRow, setEditingRow] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    eventsCatalogAPI.listFilters()
      .then((r) => setTagOptions(Array.isArray(r?.data) ? r.data : []))
      .catch(() => setTagOptions([]));
  }, []);

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
    const requestId = ++loadRequestRef.current;
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
      if (requestId !== loadRequestRef.current) return;
      setRows(data?.results || []);
      setTotal(data?.total ?? 0);
      setPage(p);
    } catch (e) {
      if (requestId !== loadRequestRef.current) return;
      setError(parseApiError(e, 'Ошибка загрузки'));
      setRows([]);
    } finally {
      if (requestId === loadRequestRef.current) setLoading(false);
    }
  }, [search, cityFilter, showFilter]);

  useEffect(() => { setPage(1); }, [search, cityFilter, showFilter]);
  useEffect(() => { load(page); }, [load, page]);

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
          {row.icon_url
            ? <img src={row.icon_url} alt="" className="w-10 h-10 rounded-aspectum-control object-contain shrink-0 bg-aspectum-surface-muted border border-aspectum-border-subtle p-1" />
            : row.image_url
              ? <img src={row.image_url} alt="" className="w-10 h-10 rounded-aspectum-control object-cover shrink-0" />
              : <div className="w-10 h-10 rounded-aspectum-control bg-aspectum-surface-subtle flex items-center justify-center text-aspectum-text-faint shrink-0 text-lg"><Glyph name="📍" /></div>
          }
          <div className="min-w-0">
            <p className="text-sm font-medium text-aspectum-text truncate">{getMultiLangValue(v) || '—'}</p>
            {row.lat != null && (
              <p className="text-xs text-aspectum-text-disabled font-mono">{Number(row.lat).toFixed(4)}, {Number(row.lon).toFixed(4)}</p>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'city_name',
      label: 'Город',
      render: (v) => <span className="text-sm text-aspectum-text-subtle">{v || '—'}</span>,
    },
    {
      key: 'index',
      label: 'Индекс',
      render: (v) => <span className="text-sm text-aspectum-text-muted">{v ?? '—'}</span>,
    },
    {
      key: 'is_show',
      label: 'Виден',
      render: (v, row) => (
        <Switch
          checked={Boolean(v)}
          aria-label={v ? 'Скрыть локацию' : 'Показать локацию'}
          onChange={() => toggleShow(row)}
          onClick={(e) => e.stopPropagation()}
        />
      ),
    },
    {
      key: 'actions',
      label: '',
      render: (_, row) => (
        <div className="flex items-center gap-2 justify-end" onClick={(e) => e.stopPropagation()}>
          <TableRowActions
            onEdit={() => { setEditingRow(row); setEditorOpen(true); }}
            onDelete={() => setDeleteTarget(row)}
          />
        </div>
      ),
    },
  ];

  return (
    <Layout>
      <PageHeader
        title="Интерактивные локации"
        description="Управление локациями для приложения"
        actions={<Button
          type="button"
          variant="primary"
          size="md"
          onClick={() => { setEditingRow(null); setEditorOpen(true); }}
        >
          + Новая локация
        </Button>}
      />

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
            <Select value={cityFilter} onChange={(e) => setCityFilter(e.target.value)}>
              <option value="">Все города</option>
              {cities.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
            <Select value={showFilter} onChange={(e) => setShowFilter(e.target.value)}>
              <option value="">Любая видимость</option>
              <option value="true">Видимые</option>
              <option value="false">Скрытые</option>
            </Select>
          </>
        )}
      />

      <ILEditorModal
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        location={editingRow}
        onSaved={handleSaved}
        cityOptions={cities}
        tagOptions={tagOptions}
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
