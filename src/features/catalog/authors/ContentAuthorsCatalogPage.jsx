import { useCallback, useEffect, useState } from 'react';
import Layout from '../../../components/Layout';
import Modal, { ConfirmModal } from '../../../components/ui/Modal';
import { Field, MultiLangField, TextInput } from '../../../components/ui/FormField';
import { contentAuthorsAPI } from '../../../api/generation';
import { getMultiLangValue } from '../shared/i18n';

const emptyAuthor = () => ({ name: '', biography: {}, links: {}, is_show: true });

function readAuthors(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.results)) return data.results;
  return [];
}

export default function ContentAuthorsCatalogPage() {
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
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Авторы</h1>
          <p className="mt-1 text-sm text-gray-500">Самостоятельный справочник авторов контента. Связи с гидами пока нет.</p>
        </div>
        <button onClick={() => setEditor(emptyAuthor())} className="shrink-0 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
          + Добавить автора
        </button>
      </div>

      {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      {loading ? <div className="py-16 text-center text-gray-500">Загрузка...</div> : authors.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-12 text-center text-gray-500">Авторов пока нет</div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {authors.map((author) => (
            <article key={author.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="truncate font-semibold text-gray-900">{author.name}</h2>
                  <p className="mt-1 line-clamp-3 text-sm text-gray-500">{getMultiLangValue(author.biography) || 'Биография не добавлена'}</p>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-1 text-xs font-medium ${author.is_show ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {author.is_show ? 'Показан' : 'Скрыт'}
                </span>
              </div>
              <div className="mt-4 flex gap-2 border-t border-gray-100 pt-3">
                <button onClick={() => setEditor({ ...author, biography: author.biography || {}, links: author.links || {} })} className="text-sm font-medium text-blue-600 hover:text-blue-800">Редактировать</button>
                <button onClick={() => setDeleteTarget(author)} className="text-sm font-medium text-red-600 hover:text-red-800">Удалить</button>
              </div>
            </article>
          ))}
        </div>
      )}

      <Modal open={!!editor} onClose={() => !saving && setEditor(null)} title={editor?.id ? 'Редактировать автора' : 'Новый автор'} size="ml">
        {editor && <form className="space-y-4" onSubmit={save}>
          <Field label="Имя" required><TextInput value={editor.name} onChange={(e) => setEditor({ ...editor, name: e.target.value })} autoFocus /></Field>
          <MultiLangField label="Биография" value={editor.biography} onChange={(biography) => setEditor({ ...editor, biography })} langs={['ru', 'en', 'it']} multiline />
          <Field label="Сайт"><TextInput value={editor.links?.website || ''} onChange={(e) => setEditor({ ...editor, links: { ...editor.links, website: e.target.value } })} placeholder="https://..." /></Field>
          <Field label="Telegram"><TextInput value={editor.links?.telegram || ''} onChange={(e) => setEditor({ ...editor, links: { ...editor.links, telegram: e.target.value } })} placeholder="https://t.me/..." /></Field>
          <Field label="Видимость"><label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={editor.is_show !== false} onChange={(e) => setEditor({ ...editor, is_show: e.target.checked })} /> Показывать автора</label></Field>
          <div className="flex justify-end gap-3 pt-2"><button type="button" onClick={() => setEditor(null)} disabled={saving} className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200">Отмена</button><button disabled={saving} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">{saving ? 'Сохранение...' : 'Сохранить'}</button></div>
        </form>}
      </Modal>
      <ConfirmModal open={!!deleteTarget} onClose={() => !deleting && setDeleteTarget(null)} onConfirm={remove} title="Удалить автора?" message="Связей с контентом пока нет, поэтому будет удалён только профиль автора." confirmLabel="Удалить" danger loading={deleting} />
    </Layout>
  );
}
