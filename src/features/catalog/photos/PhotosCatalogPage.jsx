import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../../../components/Layout';
import apiClient from '../../../api/client';
import { imagesAPI } from './api';
import { FormLabel, Alert, Button, Card, ConfirmModal, EmptyState, IconButton, InlineState, Modal, PageHeader, Spinner, TextInput, Glyph } from '@aspectum/ui';

const USAGE_KIND_LABELS = {
  city: 'Город',
  event: 'Событие',
  event_feed: 'Лента события',
  city_filter: 'Фильтр города',
  event_filter: 'Фильтр события',
  il: 'IL',
  il_photo: 'IL фото',
  session_city: 'Сессия · город',
  session_attraction: 'Сессия · достопримечательность',
};

const ROLE_LABELS = {
  title_pic: 'обложка',
  pic: 'иконка',
  'event_media.title': 'обложка',
  'event_media.image': 'галерея',
  image: 'изображение',
  icon: 'иконка',
};

function usageKindLabel(kind) {
  return USAGE_KIND_LABELS[kind] || kind || '—';
}

function usageRoleLabel(role) {
  if (!role) return '';
  if (ROLE_LABELS[role]) return ROLE_LABELS[role];
  if (String(role).startsWith('feed[')) return `лента ${role}`;
  return role;
}

function CopyableMono({ value, empty = '—' }) {
  if (!value) {
    return <span className="text-sm text-aspectum-text-disabled">{empty}</span>;
  }
  return (
    <Button
      type="button"
      title="Скопировать"
      onClick={() => navigator.clipboard?.writeText(String(value))}
      variant="copyField"
      size="md"
      className="block w-full text-left font-mono text-xs break-all"
    >
      {value}
    </Button>
  );
}

export default function PhotosCatalog() {
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingImage, setEditingImage] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  const PAGE_SIZE = 24;

  const loadImages = useCallback(async (pageNum = 1) => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.get('/media/images/', {
        params: { page: pageNum, page_size: PAGE_SIZE },
      });
      const data = response?.data;
      const list = Array.isArray(data?.results) ? data.results
        : Array.isArray(data) ? data
        : [];
      setImages(list.map((img) => ({
        ...img,
        image_url: img.image_url || img.url || null,
      })));
      setTotalCount(data?.count || list.length);
    } catch (err) {
      setError('Список изображений: ' + (err?.response?.data?.error || err.message || 'недоступен'));
      setImages([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadImages(page);
  }, [page, loadImages]);

  const openEdit = async (img) => {
    setActionError(null);
    setEditingImage({
      id: img.id,
      image_url: img.image_url || img.url || null,
      copyright: img.copyright || '',
      path: img.path || '',
      filename: img.filename || '',
      source_url: img.source_url || '',
      original_image_url: img.original_image_url || '',
      file_page_url: img.file_page_url || '',
      usages: [],
    });
    setDetailLoading(true);
    try {
      const { data } = await imagesAPI.get(img.id);
      const detail = data?.image || data || {};
      setEditingImage((prev) => ({
        ...prev,
        ...detail,
        id: detail.id || img.id,
        image_url: detail.url || detail.image_url || prev?.image_url || null,
        copyright: detail.copyright ?? prev?.copyright ?? '',
        path: detail.path || prev?.path || '',
        filename: detail.filename || prev?.filename || '',
        source_url: detail.source_url || '',
        original_image_url: detail.original_image_url || '',
        file_page_url: detail.file_page_url || '',
        usages: Array.isArray(detail.usages) ? detail.usages : [],
      }));
    } catch (err) {
      setActionError(err?.response?.data?.error || 'Не удалось загрузить детали изображения');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!editingImage?.id) return;
    try {
      setSaving(true);
      setActionError(null);
      await imagesAPI.update(editingImage.id, {
        copyright: editingImage.copyright,
        source_url: editingImage.source_url,
        file_page_url: editingImage.file_page_url,
        original_image_url: editingImage.original_image_url,
      });
      setEditingImage(null);
      await loadImages(page);
    } catch (err) {
      setActionError(err?.response?.data?.error || 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget?.id) return;
    try {
      setDeleteError(null);
      setDeleting(true);
      await imagesAPI.delete(deleteTarget.id);
      setDeleteTarget(null);
      await loadImages(page);
    } catch (err) {
      setDeleteError(err?.response?.data?.error || 'Ошибка удаления');
    } finally {
      setDeleting(false);
    }
  };

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  return (
    <Layout>
      <PageHeader
        title="Фотографии"
        description="Справочник изображений"
        actions={totalCount > 0 ? (
          <span className="text-sm text-aspectum-text-muted">Всего: {totalCount}</span>
        ) : null}
      />

      {error && (
        <Alert tone="warning" className="mb-4">{error}</Alert>
      )}
      {actionError && (
        <Alert tone="error" className="mb-4 flex items-center justify-between">
          {actionError}
          <IconButton label="Закрыть ошибку" onClick={() => setActionError(null)} variant="ghostDanger" className="ml-3 shrink-0"><Glyph name="✕" /></IconButton>
        </Alert>
      )}

      {loading ? (
        <EmptyState icon={<Spinner size="md" />} title="Загрузка..." className="py-16" />
      ) : images.length === 0 ? (
        <Card>
          <EmptyState
            icon="🖼️"
            title="Изображений не найдено"
            description="Изображения добавляются автоматически при создании контента городов и событий"
          />
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-4">
            {images.map((img) => (
              <div
                key={img.id}
                className="group relative bg-aspectum-surface rounded-aspectum-control border border-aspectum-border overflow-hidden shadow-aspectum-card hover:shadow-aspectum-raised transition-shadow"
              >
                {img.image_url ? (
                  <img
                    src={img.image_url}
                    alt={img.copyright || `#${img.id}`}
                    className="w-full aspect-square object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full aspect-square bg-aspectum-surface-subtle flex items-center justify-center text-aspectum-text-disabled text-xs">
                    No image
                  </div>
                )}
                <div className="p-2">
                  <p className="text-xs text-aspectum-text-muted truncate">{img.filename || img.copyright || '—'}</p>
                  <p className="text-xs text-aspectum-text-faint font-mono truncate" title={img.id}>#{img.id}</p>
                </div>
                <div className="absolute inset-0 bg-aspectum-overlay-clear group-hover:bg-aspectum-overlay-light transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100 gap-2">
                  <IconButton
                    type="button"
                    variant="outline"
                    onClick={() => openEdit(img)}
                    label="Редактировать"
                  >
                    <Glyph name="✏" />
                  </IconButton>
                  <IconButton
                    type="button"
                    variant="outlineDanger"
                    onClick={() => setDeleteTarget(img)}
                    label="Удалить"
                  >
                    <Glyph name="🗑" />
                  </IconButton>
                </div>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 py-4">
              <Button type="button" variant="outline" size="md" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                ← Предыдущая
              </Button>
              <span className="text-sm text-aspectum-text-subtle">{page} / {totalPages}</span>
              <Button type="button" variant="outline" size="md" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                Следующая →
              </Button>
            </div>
          )}
        </>
      )}

      <Modal
        open={!!editingImage}
        onClose={() => setEditingImage(null)}
        title="Редактировать изображение"
        size="lg"
      >
        {editingImage && (
            <form onSubmit={handleSave} className="space-y-4">
              {editingImage.image_url && (
                <img src={editingImage.image_url} alt="preview"
                  className="w-full max-h-56 object-contain rounded-aspectum-control border border-aspectum-border bg-aspectum-surface-muted" />
              )}

              {detailLoading && (
                <InlineState loading>Загрузка деталей...</InlineState>
              )}

              <div>
                <FormLabel  layout="block" size="sm" weight="medium" tone="strong" spacing="xs">ID</FormLabel>
                <CopyableMono value={editingImage.id} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <FormLabel  layout="block" size="sm" weight="medium" tone="strong" spacing="xs">Имя файла</FormLabel>
                  <CopyableMono value={editingImage.filename} />
                </div>
                <div>
                  <FormLabel  layout="block" size="sm" weight="medium" tone="strong" spacing="xs">Путь на сервере</FormLabel>
                  <CopyableMono value={editingImage.path} />
                </div>
              </div>

              <div>
                <FormLabel  layout="block" size="sm" weight="medium" tone="strong" spacing="xs">URL файла</FormLabel>
                {editingImage.image_url || editingImage.url ? (
                  <a
                    href={editingImage.image_url || editingImage.url}
                    target="_blank"
                    rel="noreferrer"
                    className="block font-mono text-xs text-aspectum-primary-hover bg-aspectum-primary-soft border border-aspectum-primary-muted rounded-aspectum-control px-3 py-2 break-all hover:underline"
                  >
                    {editingImage.image_url || editingImage.url}
                  </a>
                ) : (
                  <CopyableMono value={null} />
                )}
              </div>

              <div>
                <FormLabel  layout="block" size="sm" weight="medium" tone="strong" spacing="xs">Авторское право</FormLabel>
                <TextInput type="text" value={editingImage.copyright || ''} onChange={(e) => setEditingImage((p) => ({ ...p, copyright: e.target.value }))} placeholder="© Author Name" />
              </div>

              <div>
                <FormLabel  layout="block" size="sm" weight="medium" tone="strong" spacing="xs">Source URL</FormLabel>
                <TextInput type="url" value={editingImage.source_url || ''} onChange={(e) => setEditingImage((p) => ({ ...p, source_url: e.target.value }))} placeholder="https://..." />
              </div>

              <div>
                <FormLabel  layout="block" size="sm" weight="medium" tone="strong" spacing="xs">Страница источника (file page)</FormLabel>
                <TextInput type="url" value={editingImage.file_page_url || ''} onChange={(e) => setEditingImage((p) => ({ ...p, file_page_url: e.target.value }))} placeholder="https://commons.wikimedia.org/..." />
              </div>

              <div>
                <FormLabel  layout="block" size="sm" weight="medium" tone="strong" spacing="xs">Original image URL</FormLabel>
                <TextInput type="url" value={editingImage.original_image_url || ''} onChange={(e) => setEditingImage((p) => ({ ...p, original_image_url: e.target.value }))} placeholder="https://..." />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <FormLabel  layout="block" size="sm" weight="medium" tone="strong">Где используется</FormLabel>
                  <span className="text-xs text-aspectum-text-disabled">
                    {(editingImage.usages || []).length} связей
                  </span>
                </div>
                {(editingImage.usages || []).length === 0 ? (
                  <EmptyState
                    title={detailLoading ? 'Ищем связи…' : 'Изображение не используется'}
                    description={detailLoading ? undefined : 'Или используется только в черновиках без привязки.'}
                    className="py-4"
                  />
                ) : (
                  <ul className="divide-y divide-aspectum-border-subtle border border-aspectum-border rounded-aspectum-control overflow-hidden">
                    {editingImage.usages.map((u, idx) => {
                      const title = `${usageKindLabel(u.kind)}: ${u.label || '—'}`;
                      const role = usageRoleLabel(u.role);
                      const inner = (
                        <>
                          <div className="min-w-0">
                            <p className="text-sm text-aspectum-text truncate">{title}</p>
                            <p className="text-xs text-aspectum-text-muted truncate">
                              {role}
                              {u.id ? ` · #${u.id}` : ''}
                            </p>
                          </div>
                          {u.href ? (
                            <span className="text-xs text-aspectum-primary shrink-0">открыть →</span>
                          ) : null}
                        </>
                      );
                      return (
                        <li key={`${u.kind}-${u.id}-${u.role}-${idx}`}>
                          {u.href ? (
                            <Link
                              to={u.href}
                              className="flex items-center justify-between gap-3 px-3 py-2.5 hover:bg-aspectum-primary-soft"
                              onClick={() => setEditingImage(null)}
                            >
                              {inner}
                            </Link>
                          ) : (
                            <div className="flex items-center justify-between gap-3 px-3 py-2.5">
                              {inner}
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              <div className="flex gap-3 pt-2 sticky bottom-0 bg-aspectum-surface pb-1">
                <Button type="submit" variant="primary" size="md" disabled={saving || detailLoading} className="flex-1">
                  {saving ? 'Сохранение...' : 'Сохранить'}
                </Button>
                <Button type="button" variant="secondary" size="md" onClick={() => setEditingImage(null)} className="flex-1">
                  Отмена
                </Button>
              </div>
            </form>
        )}
      </Modal>

      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => {
          setDeleteTarget(null);
          setDeleteError(null);
        }}
        onConfirm={handleConfirmDelete}
        title="Удалить изображение?"
        message={deleteError || 'Изображение будет удалено без возможности восстановления.'}
        confirmLabel="Удалить"
        danger
        loading={deleting}
      />
    </Layout>
  );
}
