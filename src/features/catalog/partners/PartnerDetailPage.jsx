import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { partnerReportsAPI, partnersAdminAPI } from '../../../api/partners';
import { activationCodesAPI, subscriptionTypesAPI } from '../../../api/subscription';
import Layout from '../../../components/Layout';
import { Field, TextInput } from '../../../components/ui/FormField';
import { parseApiError } from '../../../utils/apiError';
import FormErrorAlert from '../shared/components/FormErrorAlert';
import AbuseSignalsPanel from './AbuseSignalsPanel';
import CodeBatchesPanel from './CodeBatchesPanel';
import CodeBatchResult from './CodeBatchResult';
import MainCodePanel from './MainCodePanel';
import PartnerFormModal from './PartnerFormModal';
import {
  MEMBER_STATUS_LABELS,
  PARTNER_STATUSES,
  downloadBlob,
  formatDate,
  formatMoney,
} from './partnerFormat';

const TABS = [
  { key: 'report', label: 'Отчёт' },
  { key: 'codes', label: 'Коды' },
  { key: 'members', label: 'Доступ к кабинету' },
  { key: 'review', label: 'Проверка и сверка' },
];

const SELECT_CLASS = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none';
const BUTTON = 'px-3 py-2 text-sm font-medium rounded-lg border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50';
const PRIMARY = 'px-3 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50';

function Card({ title, children }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="text-xs uppercase tracking-wide text-gray-500">{title}</div>
      <div className="mt-1 text-lg font-semibold text-gray-900">{children}</div>
    </div>
  );
}

function MoneyTable({ money }) {
  if (!money?.length) return <p className="text-sm text-gray-500">Покупок с суммой пока нет.</p>;
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-gray-500">
          <th className="py-1 pr-4">Валюта</th>
          <th className="py-1 pr-4">Покупки</th>
          <th className="py-1 pr-4">Возвраты</th>
          <th className="py-1 pr-4">Корректировки</th>
          <th className="py-1 pr-4">Итого</th>
          <th className="py-1">Комиссия</th>
        </tr>
      </thead>
      <tbody>
        {money.map((row) => (
          <tr key={row.currency} className="border-t border-gray-100">
            <td className="py-1 pr-4">{row.currency}</td>
            <td className="py-1 pr-4">{formatMoney(row.sales_minor, row.currency)}</td>
            <td className="py-1 pr-4">{formatMoney(row.refunds_minor, row.currency)}</td>
            <td className="py-1 pr-4">{formatMoney(row.adjustments_minor, row.currency)}</td>
            <td className="py-1 pr-4 font-medium">{formatMoney(row.net_minor, row.currency)}</td>
            <td className="py-1 font-medium">{formatMoney(row.commission_minor, row.currency)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ReportTab({ partnerId }) {
  const [period, setPeriod] = useState({ from: '', to: '' });
  const [summary, setSummary] = useState(null);
  const [entries, setEntries] = useState({ results: [], count: 0 });
  const [offset, setOffset] = useState(0);
  const [error, setError] = useState(null);
  const limit = 50;

  const params = useCallback(() => ({
    from: period.from || undefined,
    to: period.to || undefined,
  }), [period]);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [summaryResp, entriesResp] = await Promise.all([
        partnerReportsAPI.summary(partnerId, params()),
        partnerReportsAPI.entries(partnerId, { ...params(), offset, limit }),
      ]);
      setSummary(summaryResp.data);
      setEntries(entriesResp.data);
    } catch (err) {
      setError(parseApiError(err, 'Не удалось загрузить отчёт'));
    }
  }, [partnerId, params, offset]);

  useEffect(() => {
    load();
  }, [load]);

  const downloadCsv = async () => {
    try {
      const response = await partnerReportsAPI.entriesCsv(partnerId, params());
      downloadBlob(`partner-${partnerId.slice(0, 8)}.csv`, response.data);
    } catch (err) {
      setError(parseApiError(err, 'Не удалось выгрузить таблицу'));
    }
  };

  return (
    <div className="space-y-4">
      <FormErrorAlert message={error} />
      <div className="flex flex-wrap items-end gap-3">
        <Field label="С">
          <TextInput type="date" value={period.from} onChange={(e) => { setOffset(0); setPeriod((p) => ({ ...p, from: e.target.value })); }} />
        </Field>
        <Field label="По">
          <TextInput type="date" value={period.to} onChange={(e) => { setOffset(0); setPeriod((p) => ({ ...p, to: e.target.value })); }} />
        </Field>
        <button type="button" className={BUTTON} onClick={() => { setOffset(0); setPeriod({ from: '', to: '' }); }}>За всё время</button>
        <button type="button" className={BUTTON} onClick={downloadCsv}>Скачать таблицу (CSV)</button>
      </div>

      {summary && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card title="Клиентов всего">{summary.clients.total}</Card>
            <Card title="Новых за период">{summary.clients.new_in_period}</Card>
            <Card title="Покупок">{summary.purchases.count}</Card>
            <Card title="Возвратов">{summary.purchases.refunds}</Card>
          </div>
          {summary.purchases.without_amount > 0 && (
            <p className="text-sm text-gray-500">
              Покупок без суммы (магазины приложений её не сообщают): {summary.purchases.without_amount}
            </p>
          )}
          {summary.purchases.needs_review > 0 && (
            <p className="text-sm text-amber-700">
              Есть записи, которые нужно проверить: {summary.purchases.needs_review} — вкладка «Проверка и сверка».
            </p>
          )}
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <MoneyTable money={summary.money} />
          </div>
        </>
      )}

      <div className="rounded-xl border border-gray-200 bg-white p-4 overflow-x-auto">
        <div className="mb-2 text-sm font-medium text-gray-800">Операции ({entries.count})</div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500">
              <th className="py-1 pr-3">Дата</th>
              <th className="py-1 pr-3">Операция</th>
              <th className="py-1 pr-3">Что</th>
              <th className="py-1 pr-3">Клиент</th>
              <th className="py-1 pr-3">Сумма</th>
              <th className="py-1">Комиссия</th>
            </tr>
          </thead>
          <tbody>
            {entries.results.map((row) => (
              <tr key={row.id} className="border-t border-gray-100 align-top">
                <td className="py-1 pr-3 whitespace-nowrap">{formatDate(row.occurred_at, true)}</td>
                <td className="py-1 pr-3">{row.kind_label}{row.needs_review ? ' ⚠️' : ''}</td>
                <td className="py-1 pr-3">
                  <div>{row.description}</div>
                  {row.note && <div className="text-xs text-gray-500">{row.note}</div>}
                </td>
                <td className="py-1 pr-3">№{row.client_number}</td>
                <td className="py-1 pr-3 whitespace-nowrap">{formatMoney(row.amount_minor, row.currency)}</td>
                <td className="py-1 whitespace-nowrap">{formatMoney(row.commission_minor, row.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {entries.count > limit && (
          <div className="mt-3 flex gap-2">
            <button type="button" className={BUTTON} disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - limit))}>Назад</button>
            <button type="button" className={BUTTON} disabled={offset + limit >= entries.count} onClick={() => setOffset(offset + limit)}>Дальше</button>
          </div>
        )}
      </div>
    </div>
  );
}

function CodesTab({ partnerId }) {
  const [codes, setCodes] = useState([]);
  const [types, setTypes] = useState([]);
  const [form, setForm] = useState({ name: '', subscription_type: '', count: 10, max_uses: 1, expiry_days: 365, prefix: '' });
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [issuing, setIssuing] = useState(false);
  const [batchesVersion, setBatchesVersion] = useState(0);

  const load = useCallback(async () => {
    try {
      const [codesResp, typesResp] = await Promise.all([
        partnerReportsAPI.codes(partnerId),
        subscriptionTypesAPI.list({ page_size: 500, ordering: 'name' }),
      ]);
      setCodes(codesResp.data.results || []);
      const typeData = typesResp?.data;
      setTypes(Array.isArray(typeData?.results) ? typeData.results : Array.isArray(typeData) ? typeData : []);
    } catch (err) {
      setError(parseApiError(err, 'Не удалось загрузить коды'));
    }
  }, [partnerId]);

  useEffect(() => {
    load();
  }, [load]);

  const issue = async (e) => {
    e.preventDefault();
    try {
      setIssuing(true);
      setError(null);
      const response = await activationCodesAPI.bulkGenerate({
        name: (form.name || '').trim(),
        subscription_type: form.subscription_type,
        partner: partnerId,
        count: Number(form.count),
        max_uses: form.max_uses === '' ? null : Number(form.max_uses),
        expiry_days: form.expiry_days === '' ? null : Number(form.expiry_days),
        prefix: (form.prefix || '').trim().toUpperCase(),
        description: 'Коды партнёра',
      });
      setResult(response.data);
      setBatchesVersion((value) => value + 1);
      await load();
    } catch (err) {
      setError(parseApiError(err, 'Не удалось выпустить коды'));
    } finally {
      setIssuing(false);
    }
  };

  const set = (key) => (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }));

  return (
    <div className="space-y-4">
      <FormErrorAlert message={error} />
      <MainCodePanel partnerId={partnerId} codes={codes} types={types} onIssued={load} />
      <form onSubmit={issue} className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
        <div className="text-sm font-medium text-gray-800">Партия карточек для печати</div>
        <p className="text-xs text-gray-500">
          Например, карточки для печати: каждая — одноразовый код. Для «любого города на выбор» выберите тип подписки
          с режимом «Один город на выбор». Партнёрский код можно активировать один раз на аккаунт; многоразовый код —
          только в приложении и один раз на устройство. По оферте неактивированный код действует 12 месяцев.
        </p>
        <Field label="Название партии" hint="Например: «Карточки для ресепшена, декабрь». Пусто — подставим дату и количество.">
          <TextInput value={form.name} maxLength={200} onChange={set('name')} />
        </Field>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <Field label="Тип подписки" required>
            <select className={SELECT_CLASS} value={form.subscription_type} onChange={set('subscription_type')} required>
              <option value="">Выберите…</option>
              {types.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name}{type.access_mode === 'choose_city' ? ' (город на выбор)' : ''}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Сколько кодов" hint="До 10 000 за раз">
            <TextInput type="number" min={1} max={10000} value={form.count} onChange={set('count')} />
          </Field>
          <Field label="Активаций на код" hint="1 — одноразовые карточки. Постоянный многоразовый код — блок выше">
            <TextInput type="number" min={1} value={form.max_uses} onChange={set('max_uses')} required />
          </Field>
          <Field label="Срок, дней">
            <TextInput type="number" min={1} max={3650} value={form.expiry_days} onChange={set('expiry_days')} />
          </Field>
          <Field label="Префикс">
            <TextInput value={form.prefix} maxLength={10} onChange={set('prefix')} />
          </Field>
        </div>
        <button type="submit" className={PRIMARY} disabled={issuing || !form.subscription_type}>
          {issuing ? 'Выпускаю…' : 'Выпустить'}
        </button>
        {result ? <CodeBatchResult result={result} /> : null}
      </form>

      <CodeBatchesPanel partnerId={partnerId} refreshKey={batchesVersion} />

      <div className="rounded-xl border border-gray-200 bg-white p-4 overflow-x-auto">
        <div className="mb-2 text-sm font-medium text-gray-800">Отдельные коды ({codes.length})</div>
        <p className="mb-2 text-xs text-gray-500">Коды, выпущенные не партией, например для плаката. Коды из партий — в таблице выше.</p>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500">
              <th className="py-1 pr-3">Код</th>
              <th className="py-1 pr-3">Что открывает</th>
              <th className="py-1 pr-3">Активаций</th>
              <th className="py-1 pr-3">Действует до</th>
              <th className="py-1">Можно активировать</th>
            </tr>
          </thead>
          <tbody>
            {codes.map((code) => (
              <tr key={code.code} className="border-t border-gray-100">
                <td className="py-1 pr-3 font-mono">{code.code}</td>
                <td className="py-1 pr-3">{code.access_mode === 'choose_city' ? `Город на выбор (${code.label})` : code.label}</td>
                <td className="py-1 pr-3">{code.current_uses} / {code.max_uses ?? '∞'}</td>
                <td className="py-1 pr-3">{code.expiry_date ? formatDate(code.expiry_date) : 'бессрочно'}</td>
                <td className="py-1">{code.can_be_used ? 'да' : 'нет'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MembersTab({ partner, onChanged }) {
  const [email, setEmail] = useState('');
  const [inviteText, setInviteText] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const members = partner.members || [];

  const invite = async (e) => {
    e.preventDefault();
    try {
      setBusy(true);
      setError(null);
      const response = await partnersAdminAPI.invite(partner.id, email.trim());
      setInviteText(response.data.invite_text);
      setEmail('');
      onChanged();
    } catch (err) {
      setError(parseApiError(err, 'Не удалось пригласить'));
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (member) => {
    if (!window.confirm(`Отозвать доступ ${member.email}?`)) return;
    try {
      await partnersAdminAPI.revokeMember(partner.id, member.id);
      onChanged();
    } catch (err) {
      setError(parseApiError(err, 'Не удалось отозвать доступ'));
    }
  };

  return (
    <div className="space-y-4">
      <FormErrorAlert message={error} />
      <form onSubmit={invite} className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
        <div className="text-sm font-medium text-gray-800">Пригласить сотрудника партнёра</div>
        <p className="text-xs text-gray-500">
          Кабинет откроется тому, кто войдёт в Аспектум с этой почтой и подтвердит её. Если такой аккаунт уже есть,
          доступ появится сразу. Письмо пока отправляете сами — ниже будет готовый текст.
        </p>
        <div className="flex flex-wrap gap-2">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="manager@partner.ru"
            className="flex-1 min-w-[16rem] px-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
          <button type="submit" className={PRIMARY} disabled={busy}>Пригласить</button>
        </div>
        {inviteText && (
          <div className="rounded-lg bg-gray-50 border border-gray-200 p-3 text-sm space-y-2">
            <div className="whitespace-pre-wrap">{inviteText}</div>
            <button type="button" className={BUTTON} onClick={() => navigator.clipboard?.writeText(inviteText)}>
              Скопировать текст
            </button>
          </div>
        )}
      </form>

      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500">
              <th className="py-1 pr-3">Почта</th>
              <th className="py-1 pr-3">Статус</th>
              <th className="py-1 pr-3">Приглашён</th>
              <th className="py-1 pr-3">Вошёл</th>
              <th className="py-1" />
            </tr>
          </thead>
          <tbody>
            {members.map((member) => (
              <tr key={member.id} className="border-t border-gray-100">
                <td className="py-1 pr-3">{member.email}</td>
                <td className="py-1 pr-3">{MEMBER_STATUS_LABELS[member.status] || member.status}</td>
                <td className="py-1 pr-3">{formatDate(member.created_at)}</td>
                <td className="py-1 pr-3">{member.accepted_at ? formatDate(member.accepted_at) : '—'}</td>
                <td className="py-1 text-right">
                  {member.status !== 'revoked' && (
                    <button type="button" className="text-xs text-red-600 hover:underline" onClick={() => revoke(member)}>
                      Отозвать
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {!members.length && (
              <tr><td colSpan={5} className="py-2 text-gray-400">Пока никого не пригласили.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function rublesToMinor(value) {
  const normalized = String(value || '').replace(/\s/g, '').replace(',', '.');
  if (!normalized) return null;
  const number = Number(normalized);
  return Number.isFinite(number) ? Math.round(number * 100) : null;
}

function ReviewTab({ partnerId }) {
  const [ledger, setLedger] = useState([]);
  const [runs, setRuns] = useState([]);
  const [form, setForm] = useState({ sale_entry: '', amount: '', commission: '', note: '', resolves_entry: '' });
  const [error, setError] = useState(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [ledgerResp, runsResp] = await Promise.all([
        partnersAdminAPI.ledger(partnerId),
        partnersAdminAPI.syncRuns(),
      ]);
      setLedger(ledgerResp.data.results || []);
      setRuns(runsResp.data.results || []);
    } catch (err) {
      setError(parseApiError(err, 'Не удалось загрузить реестр'));
    }
  }, [partnerId]);

  useEffect(() => {
    load();
  }, [load]);

  const sales = ledger.filter((entry) => entry.kind === 'sale');
  const toReview = ledger.filter((entry) => entry.needs_review && !entry.reviewed_at);

  const syncNow = async () => {
    try {
      setBusy(true);
      setError(null);
      const response = await partnersAdminAPI.syncNow();
      setMessage(`Сверка: новых записей ${response.data.created}, на проверку ${response.data.needs_review}.`);
      await load();
    } catch (err) {
      setError(parseApiError(err, 'Сверка не удалась'));
    } finally {
      setBusy(false);
    }
  };

  const addAdjustment = async (e) => {
    e.preventDefault();
    const amountMinor = rublesToMinor(form.amount);
    if (!amountMinor) {
      setError('Укажите сумму корректировки (возврат — со знаком минус).');
      return;
    }
    try {
      setBusy(true);
      setError(null);
      await partnersAdminAPI.addAdjustment(partnerId, {
        sale_entry: form.sale_entry,
        amount_minor: amountMinor,
        commission_minor: form.commission === '' ? null : rublesToMinor(form.commission),
        note: form.note,
        resolves_entry: form.resolves_entry || null,
      });
      setForm({ sale_entry: '', amount: '', commission: '', note: '', resolves_entry: '' });
      setMessage('Корректировка записана.');
      await load();
    } catch (err) {
      setError(parseApiError(err, 'Не удалось записать корректировку'));
    } finally {
      setBusy(false);
    }
  };

  const set = (key) => (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }));

  return (
    <div className="space-y-4">
      <FormErrorAlert message={error} />
      {message && <div className="text-sm text-green-700">{message}</div>}

      <AbuseSignalsPanel partnerId={partnerId} />

      <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm font-medium text-gray-800">Сверка реестра</div>
          <button type="button" className={BUTTON} disabled={busy} onClick={syncNow}>Сверить сейчас</button>
        </div>
        <p className="text-xs text-gray-500">
          Реестр сам дописывается раз в 10 минут по уже записанным оплатам и возвратам. Повторная сверка ничего не задваивает.
        </p>
        <ul className="text-sm text-gray-700 space-y-1">
          {runs.slice(0, 5).map((run) => (
            <li key={run.id}>
              {formatDate(run.started_at, true)} — новых записей {run.created_entries}
              {run.error ? <span className="text-red-600"> · ошибка: {run.error}</span> : ''}
            </li>
          ))}
          {!runs.length && <li className="text-gray-400">Сверка ещё не запускалась.</li>}
        </ul>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-2">
        <div className="text-sm font-medium text-gray-800">Нужно проверить ({toReview.length})</div>
        {toReview.map((entry) => (
          <div key={entry.id} className="text-sm text-amber-800">
            {formatDate(entry.occurred_at, true)} · {entry.description} · клиент №{entry.client_number} — {entry.note}
          </div>
        ))}
        {!toReview.length && <p className="text-sm text-gray-400">Всё проверено.</p>}
      </div>

      <form onSubmit={addAdjustment} className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
        <div className="text-sm font-medium text-gray-800">Корректировка</div>
        <p className="text-xs text-gray-500">
          Например, точная сумма частичного возврата по выписке банка. Записи реестра не меняются — корректировка добавляется отдельной строкой.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Покупка" required>
            <select className={SELECT_CLASS} value={form.sale_entry} onChange={set('sale_entry')} required>
              <option value="">Выберите…</option>
              {sales.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {formatDate(entry.occurred_at)} · {entry.description} · №{entry.client_number} · {formatMoney(entry.amount_minor, entry.currency)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Закрывает запись «проверить»">
            <select className={SELECT_CLASS} value={form.resolves_entry} onChange={set('resolves_entry')}>
              <option value="">—</option>
              {toReview.map((entry) => (
                <option key={entry.id} value={entry.id}>{formatDate(entry.occurred_at)} · {entry.description}</option>
              ))}
            </select>
          </Field>
          <Field label="Сумма, ₽" hint="Возврат — со знаком минус, например -100,00">
            <TextInput value={form.amount} onChange={set('amount')} placeholder="-100,00" />
          </Field>
          <Field label="Комиссия, ₽" hint="Сколько комиссии снять; пусто — не менять">
            <TextInput value={form.commission} onChange={set('commission')} placeholder="-10,00" />
          </Field>
        </div>
        <Field label="Основание" required>
          <TextInput value={form.note} onChange={set('note')} maxLength={255} required placeholder="Частичный возврат по выписке банка от …" />
        </Field>
        <button type="submit" className={PRIMARY} disabled={busy}>Записать корректировку</button>
      </form>
    </div>
  );
}

export default function PartnerDetailPage() {
  const { partnerId } = useParams();
  const [partner, setPartner] = useState(null);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState('report');
  const [editing, setEditing] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      const response = await partnersAdminAPI.get(partnerId);
      setPartner(response.data);
    } catch (err) {
      setError(parseApiError(err, 'Не удалось загрузить партнёра'));
    }
  }, [partnerId]);

  useEffect(() => {
    load();
  }, [load]);

  const status = PARTNER_STATUSES.find((item) => item.value === partner?.status)?.label;

  return (
    <Layout>
      <div className="mb-4">
        <Link to="/catalog/partners" className="text-sm text-blue-600 hover:underline">← Все партнёры</Link>
      </div>
      <FormErrorAlert message={error} />
      {partner && (
        <>
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{partner.name}</h1>
              <p className="mt-1 text-sm text-gray-500">
                {status} · комиссия {partner.commission_percent ? `${String(partner.commission_percent).replace('.', ',')} %` : 'не задана'}
                {' '}· покупки в зачёт {partner.attribution_months} мес. после активации кода
                {' '}· клиентов {partner.clients_count} · кодов {partner.codes_count}
              </p>
            </div>
            <button type="button" className={BUTTON} onClick={() => setEditing(true)}>Изменить</button>
          </div>

          <div className="mb-4 flex flex-wrap gap-2 border-b border-gray-200 pb-3">
            {TABS.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setTab(item.key)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium ${tab === item.key ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {tab === 'report' && <ReportTab partnerId={partner.id} />}
          {tab === 'codes' && <CodesTab partnerId={partner.id} />}
          {tab === 'members' && <MembersTab partner={partner} onChanged={load} />}
          {tab === 'review' && <ReviewTab partnerId={partner.id} />}

          <PartnerFormModal
            open={editing}
            partner={partner}
            onClose={() => setEditing(false)}
            onSaved={() => { setEditing(false); load(); }}
          />
        </>
      )}
    </Layout>
  );
}
