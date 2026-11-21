import { useCallback, useEffect, useState } from 'react';
import Layout from '../../../components/Layout';
import apiClient from '../../../api/client';
import { Button, Heading, Panel, TextInput } from '@aspectum/admin-ui-web';

const initial = { email: '', username: '', first_name: '', last_name: '', phone_number: '', is_active: true, is_email_verified: false, is_staff: false, is_superuser: false };
const fields = [['email', 'Email'], ['username', 'Имя пользователя'], ['first_name', 'Имя'], ['last_name', 'Фамилия'], ['phone_number', 'Телефон']];
const flags = [['is_active', 'Аккаунт активен'], ['is_email_verified', 'Email подтверждён'], ['is_staff', 'Персонал'], ['is_superuser', 'Суперпользователь']];

export default function UsersPage() {
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ results: [], count: 0 });
  const [editing, setEditing] = useState(null);
  const [password, setPassword] = useState('');
  const [deleteEmail, setDeleteEmail] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const load = useCallback(async () => {
    try { const r = await apiClient.get('/admin/users/', { params: { search: query, page } }); setData(Array.isArray(r.data) ? { results: r.data, count: r.data.length } : r.data); setError(''); }
    catch (e) { setError(e.response?.status === 403 ? 'Управление аккаунтами доступно только суперпользователю.' : 'Не удалось загрузить пользователей.'); }
  }, [query, page]);
  useEffect(() => { load(); }, [load]);
  const mutate = async (fn, message) => {
    setBusy(true); setError(''); setNotice('');
    try { await fn(); setNotice(message); await load(); }
    catch (e) { const detail = e.response?.data; setError(typeof detail === 'string' ? detail : JSON.stringify(detail || 'Ошибка запроса')); }
    finally { setBusy(false); }
  };
  const save = () => mutate(async () => {
    const payload = Object.fromEntries([...fields, ...flags].map(([key]) => [key, editing[key] ?? '']));
    if (editing.id) await apiClient.patch(`/admin/users/${editing.id}/`, payload);
    else await apiClient.post('/admin/users/', payload);
    setEditing(null);
  }, 'Данные сохранены.');
  const remove = () => mutate(async () => {
    await apiClient.delete(`/admin/users/${editing.id}/`, { data: { confirm_email: deleteEmail } });
    setEditing(null); setDeleteEmail('');
  }, 'Аккаунт удалён.');
  return <Layout><div className="space-y-4 p-4 md:p-6"><Heading level={1}>Управление пользователями</Heading>
    {error && <div role="alert" className="rounded border border-red-300 p-3 text-red-700">{error}</div>}
    {notice && <div role="status" className="rounded border border-green-300 p-3">{notice}</div>}
    <Panel className="p-4"><form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); setPage(1); setQuery(search); }}><TextInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Поиск по email или имени" aria-label="Поиск пользователей" /><Button type="submit">Найти</Button><Button type="button" variant="outline" onClick={() => { setEditing({ ...initial }); setPassword(''); setDeleteEmail(''); }}>Добавить</Button></form></Panel>
    <Panel className="overflow-x-auto p-4"><table className="w-full text-left text-sm"><thead><tr><th>Email</th><th>Имя</th><th>Статус</th><th>Роль</th><th /></tr></thead><tbody>{(data.results || []).map((u) => <tr key={u.id} className="border-t border-aspectum-border"><td className="py-2">{u.email}</td><td>{[u.first_name, u.last_name].filter(Boolean).join(' ') || u.username || '—'}</td><td>{u.is_active ? 'Активен' : 'Заблокирован'}</td><td>{u.is_superuser ? 'Суперпользователь' : u.is_staff ? 'Персонал' : 'Пользователь'}</td><td><Button type="button" size="sm" variant="outline" onClick={() => { setEditing({ ...u }); setPassword(''); setDeleteEmail(''); }}>Открыть</Button></td></tr>)}</tbody></table><div className="mt-4 flex items-center gap-3"><Button type="button" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>Назад</Button><span>Страница {page} · Всего {data.count}</span><Button type="button" variant="outline" disabled={!data.next} onClick={() => setPage(page + 1)}>Далее</Button></div></Panel>
    {editing && <Panel className="space-y-4 p-4"><div className="flex justify-between"><Heading level={2}>{editing.id ? 'Карточка пользователя' : 'Новый пользователь'}</Heading><Button variant="outline" onClick={() => setEditing(null)}>Закрыть</Button></div>
      {!editing.id && <p className="text-sm">Аккаунт создаётся без пароля. Задайте пароль после создания.</p>}
      <div className="grid gap-3 md:grid-cols-2">{fields.map(([key, label]) => <label key={key} className="space-y-1 text-sm"><span>{label}</span><TextInput type={key === 'email' ? 'email' : 'text'} value={editing[key] || ''} onChange={(e) => setEditing({ ...editing, [key]: e.target.value })} /></label>)}</div>
      <div className="flex flex-wrap gap-4">{flags.map(([key, label]) => <label key={key} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(editing[key])} onChange={(e) => setEditing({ ...editing, [key]: e.target.checked })} />{label}</label>)}</div>
      <Button disabled={busy} onClick={save}>Сохранить</Button>
      {editing.id && <><div className="space-y-2 border-t border-aspectum-border pt-4"><Heading level={3}>Сменить пароль</Heading><div className="flex flex-wrap gap-2"><TextInput type="password" autoComplete="new-password" placeholder="Новый пароль" value={password} onChange={(e) => setPassword(e.target.value)} /><Button disabled={busy || !password} onClick={() => mutate(async () => { await apiClient.post(`/admin/users/${editing.id}/set-password/`, { password }); setPassword(''); }, 'Пароль изменён.')}>Установить пароль</Button></div></div>
      <div className="space-y-2 border-t border-aspectum-border pt-4"><Heading level={3}>Удалить аккаунт</Heading><p className="text-sm">Удаление необратимо. Введите email аккаунта для подтверждения.</p><div className="flex flex-wrap gap-2"><TextInput value={deleteEmail} onChange={(e) => setDeleteEmail(e.target.value)} placeholder={editing.email} aria-label="Подтверждение email для удаления" /><Button variant="outline" disabled={busy || deleteEmail.toLowerCase().trim() !== editing.email.toLowerCase()} onClick={remove}>Удалить аккаунт</Button></div></div></>}
    </Panel>}
  </div></Layout>;
}
