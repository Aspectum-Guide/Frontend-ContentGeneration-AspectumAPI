import { useCallback, useEffect, useState } from 'react';
import Layout from '../../../components/Layout';
import { FormLabel, Alert, Button, ConfirmModal, EmptyState, Field, Heading, Modal, PageHeader, Panel, Spinner, StatusBadge, Switch, TextInput } from '@aspectum/admin-ui-web';
import { contentAuthorsAPI } from '../../../api/generation';
import { getMultiLangValue } from '../shared/i18n';
import MultiLangField from '../shared/components/MultiLangField';
import { useAppLanguages } from '../../../hooks/useAppLanguages';

const emptyAuthor = () => ({ name: '', biography: {}, links: {}, is_show: true });

function readAuthors(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.results)) return data.results;
  return [];
}

export default function ContentAuthorsCatalogPage() {
  const { languages: appLanguages } = useAppLanguages();
  const authorLanguages = appLanguages.map((language) => language.code);
  const [authors, setAuthors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editor, setEditor] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await contentAuthorsAPI.list();
      setAuthors(readAuthors(response?.data));
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Не удалось загрузить авторов');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async (event) => {
    event.preventDefault();
    if (!editor?.name?.trim()) {
      setError('Укажите имя автора');
      return;
    }
    setSaving(true);
    setError('');
    const payload = {
      name: editor.name.trim(),
      biography: editor.biography || {},
      links: editor.links || {},
      is_show: editor.is_show !== false,
    };
    try {
      if (editor.id) await contentAuthorsAPI.update(editor.id, payload);
      else await contentAuthorsAPI.create(payload);
      setEditor(null);
      await load();
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Не удалось сохранить автора');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!deleteTarget?.id) return;
    setDeleting(true);
    try {
      await contentAuthorsAPI.delete(deleteTarget.id);
      setDeleteTarget(null);
      await load();
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Не удалось удалить автора');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Layout>
      <PageHeader
        title="Авторы"
        description="Самостоятельный справочник авторов контента. Связи с гидами пока нет."
        actions={<Button type="button" variant="primary" size="md" onClick={() => setEditor(emptyAuthor())} className="shrink-0">
          + Добавить автора
        </Button>}
      />

      {error && <Alert tone="error" className="mb-4 text-sm">{error}</Alert>}
      {loading ? <EmptyState icon={<Spinner size="md" />} title="Загрузка..." className="py-16" /> : authors.length === 0 ? (
        <EmptyState title="Авторов пока нет" description="Добавьте первого автора контента." className="py-12" />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {authors.map((author) => (
            <Panel as="article" key={author.id} className="p-4 shadow-aspectum-card">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Heading level={2} size="sm" className="truncate">{author.name}</Heading>
                  <p className="mt-1 line-clamp-3 text-sm text-aspectum-text-muted">{getMultiLangValue(author.biography) || 'Биография не добавлена'}</p>
                </div>
                <StatusBadge active={author.is_show} activeLabel="Показан" inactiveLabel="Скрыт" className="shrink-0 py-1" />
              </div>
              <div className="mt-4 flex gap-2 border-t border-aspectum-border-subtle pt-3">
                <Button type="button" variant="link" size="md" onClick={() => setEditor({ ...author, biography: author.biography || {}, links: author.links || {} })}>Редактировать</Button>
                <Button type="button" variant="linkDanger" size="md" onClick={() => setDeleteTarget(author)}>Удалить</Button>
              </div>
            </Panel>
          ))}
        </div>
      )}

      <Modal open={!!editor} onClose={() => !saving && setEditor(null)} title={editor?.id ? 'Редактировать автора' : 'Новый автор'} size="ml">
        {editor && <form className="space-y-4" onSubmit={save}>
          <Field label="Имя" required><TextInput value={editor.name} onChange={(e) => setEditor({ ...editor, name: e.target.value })} autoFocus /></Field>
          <MultiLangField label="Биография" value={editor.biography} onChange={(biography) => setEditor({ ...editor, biography })} langs={authorLanguages} multiline />
          <Field label="Сайт"><TextInput value={editor.links?.website || ''} onChange={(e) => setEditor({ ...editor, links: { ...editor.links, website: e.target.value } })} placeholder="https://..." /></Field>
          <Field label="Telegram"><TextInput value={editor.links?.telegram || ''} onChange={(e) => setEditor({ ...editor, links: { ...editor.links, telegram: e.target.value } })} placeholder="https://t.me/..." /></Field>
          <Field label="Видимость"><FormLabel  layout="row" size="sm" tone="strong"><Switch checked={editor.is_show !== false} onChange={(is_show) => setEditor({ ...editor, is_show })} aria-label="Показывать автора" /> Показывать автора</FormLabel></Field>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" size="md" onClick={() => setEditor(null)} disabled={saving}>Отмена</Button>
            <Button type="submit" variant="primary" size="md" disabled={saving}>{saving ? 'Сохранение...' : 'Сохранить'}</Button>
          </div>
        </form>}
      </Modal>
      <ConfirmModal open={!!deleteTarget} onClose={() => !deleting && setDeleteTarget(null)} onConfirm={remove} title="Удалить автора?" message="Связей с контентом пока нет, поэтому будет удалён только профиль автора." confirmLabel="Удалить" danger loading={deleting} />
    </Layout>
  );
}
