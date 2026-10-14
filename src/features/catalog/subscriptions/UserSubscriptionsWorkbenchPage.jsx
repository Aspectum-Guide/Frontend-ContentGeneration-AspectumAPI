import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { citiesAPI } from '../../../api/generation';
import {
  citySubscriptionsAPI,
  iapPurchasesAdminAPI,
  subscriptionTypesAPI,
  subscriptionUsersAdminAPI,
} from '../../../api/subscription';
import Layout from '../../../components/Layout';
import DataTable from '../../../components/ui/DataTable';
import { Field, FormActions, TextInput } from '../../../components/ui/FormField';
import Modal, { ConfirmModal } from '../../../components/ui/Modal';
import { useLayoutActions } from '../../../context/useLayoutActions';
import { parseApiError } from '../../../utils/apiError';
import ActiveCheckboxField from '../shared/components/ActiveCheckboxField';
import CatalogPageHeader from '../shared/components/CatalogPageHeader';
import FormErrorAlert from '../shared/components/FormErrorAlert';
import StatusBadge from '../shared/components/StatusBadge';
import TableRowActions from '../shared/components/TableRowActions';
import RawJsonModal from '../shared/components/RawJsonModal';
import { formatDateTime, getCityLabel } from './subscriptionLabels';

function createEmptyGrant() {
  return {
    city: '',
    subscription_type: '',
    activation_method: 'admin:manual',
    is_active: true,
  };
}

const USERS_PAGE_SIZE = 20;

export default function UserSubscriptionsWorkbenchPage() {
  const { setMobileActions } = useLayoutActions();

  const [emailSearch, setEmailSearch] = useState('');
  const [userResults, setUserResults] = useState([]);
  const [usersPage, setUsersPage] = useState(1);
  const [usersTotal, setUsersTotal] = useState(0);
  const [listLoading, setListLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userLoading, setUserLoading] = useState(false);
  const [userError, setUserError] = useState(null);

  const [subscriptionTypes, setSubscriptionTypes] = useState([]);
  const [cities, setCities] = useState([]);
  const [refsLoading, setRefsLoading] = useState(true);

  const [grantOpen, setGrantOpen] = useState(false);
  const [grantForm, setGrantForm] = useState(createEmptyGrant());
  const [grantSaving, setGrantSaving] = useState(false);
  const [grantError, setGrantError] = useState(null);
  const [aiGrantOpen, setAiGrantOpen] = useState(false);
  const [aiGrantForm, setAiGrantForm] = useState({ amount: '', reason: '', request_id: '' });
  const [aiGrantSaving, setAiGrantSaving] = useState(false);
  const [aiGrantError, setAiGrantError] = useState(null);

  const [editSubscription, setEditSubscription] = useState(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState(null);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const [bulkAction, setBulkAction] = useState(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkError, setBulkError] = useState(null);
  const [bulkSubscriptionTypeId, setBulkSubscriptionTypeId] = useState('');

  const [iapSavingId, setIapSavingId] = useState(null);
  const [iapRawTarget, setIapRawTarget] = useState(null);
  const [iapRawLoading, setIapRawLoading] = useState(false);
  const [iapError, setIapError] = useState(null);

  const cityLabelById = useMemo(() => {
    const map = new Map();
    cities.forEach((city) => {
      map.set(String(city.id), getCityLabel(city));
    });
    return map;
  }, [cities]);

  const loadRefs = useCallback(async () => {
    try {
      setRefsLoading(true);
      const [typesResp, citiesResp] = await Promise.all([
        subscriptionTypesAPI.list({ page_size: 500, ordering: 'name', is_active: 'true' }),
        citiesAPI.list({ page_size: 1000, limit: 1000 }),
      ]);
      const typesData = typesResp?.data;
      const citiesData = citiesResp?.data;
      setSubscriptionTypes(
        Array.isArray(typesData?.results) ? typesData.results : Array.isArray(typesData) ? typesData : [],
      );
      setCities(
        Array.isArray(citiesData?.results) ? citiesData.results : Array.isArray(citiesData) ? citiesData : [],
      );
    } catch {
      setSubscriptionTypes([]);
      setCities([]);
    } finally {
      setRefsLoading(false);
    }
  }, []);

  const loadUserDetail = useCallback(async (userId) => {
    const response = await subscriptionUsersAdminAPI.get(userId);
    setSelectedUser(response?.data || null);
    return response?.data;
  }, []);

  const loadUsers = useCallback(async (page = 1, search = emailSearch) => {
    try {
      setListLoading(true);
      setUserError(null);
      const query = (search || '').trim();
      const response = await subscriptionUsersAdminAPI.list({
        ...(query ? { search: query } : {}),
        page,
        page_size: USERS_PAGE_SIZE,
        ordering: '-created_at',
      });
      const data = response?.data;
      const list = Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];
      setUserResults(list);
      setUsersTotal(data?.count ?? list.length);
      setUsersPage(page);
    } catch (err) {
      setUserResults([]);
      setUsersTotal(0);
      setUserError(parseApiError(err, 'Ошибка загрузки пользователей'));
    } finally {
      setListLoading(false);
    }
  }, [emailSearch]);

  useEffect(() => {
    loadRefs();
  }, [loadRefs]);

  // Initial list load
  useEffect(() => {
    void loadUsers(1, '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced search filter (skip first empty run — already loaded on mount)
  const searchBootstrapped = useRef(false);
  useEffect(() => {
    if (!searchBootstrapped.current) {
      searchBootstrapped.current = true;
      return;
    }
    const timer = setTimeout(() => {
      void loadUsers(1, emailSearch);
    }, 350);
    return () => clearTimeout(timer);
  }, [emailSearch, loadUsers]);

  useEffect(() => {
    setMobileActions([
      ...(selectedUser
        ? [{
          id: 'grant-city-subscription',
          label: 'Выдать город',
          onClick: () => {
            setGrantError(null);
            setGrantForm(createEmptyGrant());
            setGrantOpen(true);
          },
          variant: 'primary',
        }]
        : [{
          id: 'refresh-users',
          label: 'Обновить список',
          onClick: () => void loadUsers(usersPage, emailSearch),
          variant: 'secondary',
        }]),
    ]);
    return () => setMobileActions([]);
  }, [loadUsers, selectedUser, setMobileActions, usersPage, emailSearch]);

  const refreshSelectedUser = useCallback(async () => {
    if (!selectedUser?.id) return;
    await loadUserDetail(selectedUser.id);
  }, [loadUserDetail, selectedUser?.id]);

  const handleSelectUser = useCallback(async (user) => {
    try {
      setUserLoading(true);
      setUserError(null);
      await loadUserDetail(user.id);
    } catch (err) {
      setUserError(parseApiError(err, 'Ошибка загрузки пользователя'));
    } finally {
      setUserLoading(false);
    }
  }, [loadUserDetail]);

  const openAiGrant = () => {
    setAiGrantError(null);
    setAiGrantForm({ amount: '', reason: '', request_id: crypto.randomUUID() });
    setAiGrantOpen(true);
  };

  const handleAiGrantSave = async (event) => {
    event.preventDefault();
    if (!selectedUser?.id || aiGrantSaving) return;
    try {
      setAiGrantSaving(true);
      setAiGrantError(null);
      await subscriptionUsersAdminAPI.grantAiPrompts(selectedUser.id, {
        ...aiGrantForm,
        amount: Number(aiGrantForm.amount),
      });
      await refreshSelectedUser();
      setAiGrantOpen(false);
    } catch (error) {
      setAiGrantError(parseApiError(error, 'Не удалось начислить запросы ИИ'));
    } finally {
      setAiGrantSaving(false);
    }
  };

  const handleGrantSave = async (e) => {
    e?.preventDefault();
    if (!selectedUser?.id || !grantForm.city) return;

    try {
      setGrantSaving(true);
      setGrantError(null);
      await citySubscriptionsAPI.create({
        user: selectedUser.id,
        city: grantForm.city,
        subscription_type: grantForm.subscription_type || null,
        activation_method: grantForm.activation_method?.trim() || 'admin:manual',
        is_active: !!grantForm.is_active,
      });
      setGrantOpen(false);
      await refreshSelectedUser();
    } catch (err) {
      setGrantError(parseApiError(err, 'Не удалось выдать доступ'));
    } finally {
      setGrantSaving(false);
    }
  };

  const handleEditSave = async (e) => {
    e?.preventDefault();
    if (!editSubscription?.id) return;

    try {
      setEditSaving(true);
      setEditError(null);
      await citySubscriptionsAPI.update(editSubscription.id, {
        is_active: !!editSubscription.is_active,
        activation_method: editSubscription.activation_method?.trim() || 'admin:manual',
        subscription_type: editSubscription.subscription_type || null,
      });
      setEditSubscription(null);
      await refreshSelectedUser();
    } catch (err) {
      setEditError(parseApiError(err, 'Ошибка сохранения подписки'));
    } finally {
      setEditSaving(false);
    }
  };

  const handleDeleteSubscription = async () => {
    if (!deleteTarget?.id) return;
    try {
      setDeleting(true);
      await citySubscriptionsAPI.delete(deleteTarget.id);
      setDeleteTarget(null);
      await refreshSelectedUser();
    } catch (err) {
      setUserError(parseApiError(err, 'Ошибка удаления подписки'));
    } finally {
      setDeleting(false);
    }
  };

  const runBulkAction = async () => {
    if (!selectedUser?.id || !bulkAction) return;

    try {
      setBulkBusy(true);
      setBulkError(null);
      if (bulkAction === 'grant-all') {
        await subscriptionUsersAdminAPI.grantAllCities(selectedUser.id, {});
      } else if (bulkAction === 'revoke-all') {
        await subscriptionUsersAdminAPI.revokeAllCities(selectedUser.id);
      } else if (bulkAction === 'grant-type') {
        if (!bulkSubscriptionTypeId) {
          setBulkError('Выберите тип подписки');
          return;
        }
        await subscriptionUsersAdminAPI.grantSubscriptionType(selectedUser.id, {
          subscription_type_id: bulkSubscriptionTypeId,
        });
      }
      setBulkAction(null);
      setBulkSubscriptionTypeId('');
      await refreshSelectedUser();
    } catch (err) {
      setBulkError(parseApiError(err, 'Ошибка массовой операции'));
    } finally {
      setBulkBusy(false);
    }
  };

  const handleIapUpdate = async (purchase, patch) => {
    try {
      setIapSavingId(purchase.id);
      setIapError(null);
      await iapPurchasesAdminAPI.update(purchase.id, patch);
      await refreshSelectedUser();
    } catch (err) {
      setIapError(parseApiError(err, 'Ошибка обновления IAP'));
    } finally {
      setIapSavingId(null);
    }
  };

  const openIapRaw = async (purchase) => {
    setIapRawLoading(true);
    try {
      const r = await iapPurchasesAdminAPI.get(purchase.id);
      setIapRawTarget(r?.data || purchase);
    } catch (err) {
      setIapError(parseApiError(err, 'Ошибка загрузки raw_response'));
    } finally {
      setIapRawLoading(false);
    }
  };

  const citySubscriptions = selectedUser?.city_subscriptions || [];
  const iapPurchases = selectedUser?.iap_purchases || [];

  const userColumns = [
    {
      key: 'email',
      label: 'Email',
      render: (v, row) => (
        <div>
          <div className={`text-sm font-medium ${selectedUser?.id === row.id ? 'text-violet-700' : 'text-gray-900'}`}>
            {v || '—'}
          </div>
          {row.username ? <div className="text-xs text-gray-400">@{row.username}</div> : null}
        </div>
      ),
    },
    {
      key: 'active_city_subscriptions_count',
      label: 'Города',
      render: (v) => <span className="text-sm text-gray-700">{v ?? 0}</span>,
    },
    {
      key: 'iap_purchases_count',
      label: 'IAP',
      render: (v) => <span className="text-sm text-gray-700">{v ?? 0}</span>,
    },
    {
      key: 'is_active',
      label: 'Активен',
      render: (v) => (
        <span className={`text-xs font-medium ${v ? 'text-green-600' : 'text-gray-400'}`}>
          {v ? 'да' : 'нет'}
        </span>
      ),
    },
    {
      key: 'created_at',
      label: 'Создан',
      render: (v) => <span className="text-xs text-gray-500">{formatDateTime(v)}</span>,
    },
  ];

  const subscriptionColumns = [
    {
      key: 'city_name',
      label: 'Город',
      render: (_, row) => (
        <span className="text-sm text-gray-800">
          {row.city_name || cityLabelById.get(String(row.city)) || row.city}
        </span>
      ),
    },
    {
      key: 'subscription_type_name',
      label: 'Тип',
      render: (v) => <span className="text-sm text-gray-700">{v || '—'}</span>,
    },
    {
      key: 'activation_method',
      label: 'Метод',
      render: (v) => <span className="text-xs text-gray-600 font-mono">{v || '—'}</span>,
    },
    {
      key: 'is_active',
      label: 'Статус',
      render: (v) => <StatusBadge active={!!v} activeLabel="Активна" inactiveLabel="Отключена" />,
    },
    {
      key: 'created_at',
      label: 'Создана',
      render: (v) => <span className="text-sm text-gray-600">{formatDateTime(v)}</span>,
    },
    {
      key: 'actions',
      label: '',
      render: (_, row) => (
        <TableRowActions
          onEdit={() => {
            setEditError(null);
            setEditSubscription({
              ...row,
              subscription_type: row.subscription_type || '',
            });
          }}
          onDelete={() => setDeleteTarget(row)}
        />
      ),
    },
  ];

  const iapColumns = [
    {
      key: 'product_id',
      label: 'Product ID',
      render: (v) => <span className="text-sm font-mono text-gray-800">{v}</span>,
    },
    {
      key: 'platform',
      label: 'Платформа',
      render: (v) => <span className="text-sm text-gray-700">{v}</span>,
    },
    {
      key: 'status',
      label: 'Статус',
      render: (v, row) => (
        <select
          className="text-sm border border-gray-200 rounded-lg px-2 py-1"
          value={v}
          disabled={iapSavingId === row.id}
          onChange={(e) => void handleIapUpdate(row, { status: e.target.value })}
        >
          <option value="active">active</option>
          <option value="expired">expired</option>
          <option value="refunded">refunded</option>
        </select>
      ),
    },
    {
      key: 'expires_at',
      label: 'Истекает',
      render: (v, row) => (
        <input
          type="datetime-local"
          className="text-sm border border-gray-200 rounded-lg px-2 py-1"
          defaultValue={v ? new Date(v).toISOString().slice(0, 16) : ''}
          disabled={iapSavingId === row.id}
          onBlur={(e) => {
            const next = e.target.value ? new Date(e.target.value).toISOString() : null;
            const prev = v ? new Date(v).toISOString() : null;
            if (next !== prev) {
              void handleIapUpdate(row, { expires_at: next });
            }
          }}
        />
      ),
    },
    {
      key: 'purchased_at',
      label: 'Куплено',
      render: (v) => <span className="text-sm text-gray-600">{formatDateTime(v)}</span>,
    },
    {
      key: 'raw_response',
      label: 'Raw',
      render: (_, row) => (
        <button
          type="button"
          onClick={() => openIapRaw(row)}
          disabled={iapRawLoading}
          className="px-2 py-1 text-xs text-blue-600 bg-blue-50 rounded-md hover:bg-blue-100 disabled:opacity-50"
        >
          JSON
        </button>
      ),
    },
  ];

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <CatalogPageHeader
          title="Подписки пользователей"
          description="Пользователи, доступ к городам, квоты ИИ и IAP premium."
          createLabel="Выдать город"
          onCreate={() => {
            if (!selectedUser) {
              setUserError('Сначала выберите пользователя из списка');
              return;
            }
            setGrantError(null);
            setGrantForm(createEmptyGrant());
            setGrantOpen(true);
          }}
        />

        <div className="space-y-3">
          {userError ? <FormErrorAlert message={userError} /> : null}
          <DataTable
            columns={userColumns}
            rows={userResults}
            loading={listLoading}
            error={null}
            emptyIcon="👤"
            emptyText={emailSearch.trim() ? 'По запросу никого не найдено' : 'Пользователей пока нет'}
            isFiltered={!!emailSearch.trim()}
            search={emailSearch}
            onSearch={setEmailSearch}
            searchPlaceholder="Поиск по email, логину или имени…"
            page={usersPage}
            totalCount={usersTotal}
            pageSize={USERS_PAGE_SIZE}
            onPage={(p) => void loadUsers(p, emailSearch)}
            onRowClick={(row) => void handleSelectUser(row)}
          />
          {selectedUser ? (
            <p className="text-xs text-gray-500">
              Выбран: <span className="font-medium text-gray-800">{selectedUser.email}</span>
              {' · '}
              <button
                type="button"
                className="text-violet-600 hover:underline"
                onClick={() => setSelectedUser(null)}
              >
                снять выбор
              </button>
            </p>
          ) : (
            <p className="text-xs text-gray-400">Кликните по пользователю, чтобы открыть подписки и IAP.</p>
          )}
        </div>

        {selectedUser ? (
          <>
            <div className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-5">
              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">{selectedUser.email}</h2>
                  <p className="text-sm text-gray-500 mt-1">
                    ID: {selectedUser.id}
                    {selectedUser.username ? ` · @${selectedUser.username}` : ''}
                  </p>
                  <div className="flex flex-wrap gap-2 mt-3">
                    <span className="text-xs px-2 py-1 rounded-full bg-emerald-100 text-emerald-700">
                      Города: {citySubscriptions.filter((s) => s.is_active).length} активных
                    </span>
                    <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700">
                      IAP: {iapPurchases.length}
                    </span>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      selectedUser.has_premium ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-600'
                    }`}>
                      Premium: {selectedUser.has_premium ? 'да' : 'нет'}
                    </span>
                    <span className="text-xs px-2 py-1 rounded-full bg-violet-100 text-violet-700">
                      Запросов ИИ: {selectedUser.ai_prompts_balance ?? 0}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="px-3 py-2 rounded-xl bg-violet-600 text-white text-sm"
                    onClick={openAiGrant}
                  >
                    Начислить запросы ИИ
                  </button>
                  <button
                    type="button"
                    className="px-3 py-2 rounded-xl bg-violet-600 text-white text-sm"
                    onClick={() => {
                      setGrantError(null);
                      setGrantForm(createEmptyGrant());
                      setGrantOpen(true);
                    }}
                  >
                    Выдать город
                  </button>
                  <button
                    type="button"
                    className="px-3 py-2 rounded-xl border border-gray-200 text-sm"
                    disabled={refsLoading}
                    onClick={() => {
                      setBulkError(null);
                      setBulkSubscriptionTypeId('');
                      setBulkAction('grant-type');
                    }}
                  >
                    По типу подписки
                  </button>
                  <button
                    type="button"
                    className="px-3 py-2 rounded-xl border border-gray-200 text-sm"
                    onClick={() => {
                      setBulkError(null);
                      setBulkAction('grant-all');
                    }}
                  >
                    Все города
                  </button>
                  <button
                    type="button"
                    className="px-3 py-2 rounded-xl border border-red-200 text-red-700 text-sm"
                    onClick={() => {
                      setBulkError(null);
                      setBulkAction('revoke-all');
                    }}
                  >
                    Отключить все
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-base font-semibold text-gray-900">Квота ИИ</h3>
                <span className="text-sm text-gray-600">Осталось: {selectedUser.ai_prompts_balance ?? 0}</span>
              </div>
              <p className="text-xs text-gray-500">Один запрос — одно сообщение ассистенту или построение маршрута. Начисление увеличивает остаток, не меняя настройки типов подписки.</p>
              {(selectedUser.ai_prompt_grants || []).length ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead><tr className="text-gray-500 border-b"><th className="py-2">Когда</th><th>Запросов</th><th>Причина / источник</th><th>Кто выдал</th></tr></thead>
                    <tbody>
                      {selectedUser.ai_prompt_grants.map((grant) => (
                        <tr key={grant.id} className="border-b border-gray-100">
                          <td className="py-2 whitespace-nowrap">{formatDate(grant.created_at)}</td>
                          <td>+{grant.amount}</td>
                          <td className="max-w-sm break-words">{grant.reason || grant.source_key}</td>
                          <td>{grant.granted_by || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <p className="text-sm text-gray-500">Начислений пока нет.</p>}
            </div>

            <div className="space-y-3">
              <h3 className="text-base font-semibold text-gray-900">Доступ к городам</h3>
              <DataTable
                columns={subscriptionColumns}
                rows={citySubscriptions}
                loading={userLoading}
                emptyText="У пользователя пока нет подписок на города"
              />
            </div>

            <div className="space-y-3">
              <h3 className="text-base font-semibold text-gray-900">IAP покупки</h3>
              {iapError ? <FormErrorAlert message={iapError} /> : null}
              <DataTable
                columns={iapColumns}
                rows={iapPurchases}
                loading={userLoading}
                emptyText="IAP-покупок нет — premium определяется через store/webhook или ручную правку записи"
              />
            </div>
          </>
        ) : null}

        <Modal
          open={aiGrantOpen}
          title="Начислить запросы ИИ"
          onClose={() => { if (!aiGrantSaving) setAiGrantOpen(false); }}
        >
          <form onSubmit={handleAiGrantSave} className="space-y-4">
            {aiGrantError ? <FormErrorAlert message={aiGrantError} /> : null}
            <p className="text-sm text-gray-600">Пользователь: {selectedUser?.email}. Текущий остаток: {selectedUser?.ai_prompts_balance ?? 0}</p>
            <Field label="Количество запросов" required>
              <TextInput type="number" min={1} max={1000000} step={1} required
                value={aiGrantForm.amount}
                onChange={(e) => setAiGrantForm((prev) => ({ ...prev, amount: e.target.value }))} />
            </Field>
            <Field label="Причина начисления" required>
              <TextInput required minLength={3} maxLength={500}
                value={aiGrantForm.reason}
                onChange={(e) => setAiGrantForm((prev) => ({ ...prev, reason: e.target.value }))}
                placeholder="Например: тестовый доступ для поддержки" />
            </Field>
            <FormActions onCancel={() => setAiGrantOpen(false)}
              saveLabel="Начислить" saving={aiGrantSaving} />
          </form>
        </Modal>

        <Modal
          open={grantOpen}
          title="Выдать доступ к городу"
          onClose={() => setGrantOpen(false)}
        >
          <form onSubmit={handleGrantSave} className="space-y-4">
            {grantError ? <FormErrorAlert message={grantError} /> : null}
            <Field label="Город" required>
              <select
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm"
                value={grantForm.city}
                onChange={(e) => setGrantForm((prev) => ({ ...prev, city: e.target.value }))}
                required
              >
                <option value="">Выберите город</option>
                {cities.map((city) => (
                  <option key={city.id} value={city.id}>{getCityLabel(city)}</option>
                ))}
              </select>
            </Field>
            <Field label="Тип подписки">
              <select
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm"
                value={grantForm.subscription_type}
                onChange={(e) => setGrantForm((prev) => ({ ...prev, subscription_type: e.target.value }))}
              >
                <option value="">Без типа</option>
                {subscriptionTypes.map((type) => (
                  <option key={type.id} value={type.id}>{type.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Метод активации">
              <TextInput
                value={grantForm.activation_method}
                onChange={(e) => setGrantForm((prev) => ({ ...prev, activation_method: e.target.value }))}
                placeholder="admin:manual"
              />
            </Field>
            <ActiveCheckboxField
              checked={grantForm.is_active}
              onChange={(checked) => setGrantForm((prev) => ({ ...prev, is_active: checked }))}
              label="Активна"
            />
            <FormActions
              onCancel={() => setGrantOpen(false)}
              submitLabel={grantSaving ? 'Сохранение…' : 'Выдать доступ'}
              submitting={grantSaving}
            />
          </form>
        </Modal>

        <Modal
          open={!!editSubscription}
          title="Редактировать подписку"
          onClose={() => setEditSubscription(null)}
        >
          {editSubscription ? (
            <form onSubmit={handleEditSave} className="space-y-4">
              {editError ? <FormErrorAlert message={editError} /> : null}
              <Field label="Город">
                <div className="text-sm text-gray-700">
                  {editSubscription.city_name || cityLabelById.get(String(editSubscription.city))}
                </div>
              </Field>
              <Field label="Тип подписки">
                <select
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm"
                  value={editSubscription.subscription_type || ''}
                  onChange={(e) => setEditSubscription((prev) => ({
                    ...prev,
                    subscription_type: e.target.value,
                  }))}
                >
                  <option value="">Без типа</option>
                  {subscriptionTypes.map((type) => (
                    <option key={type.id} value={type.id}>{type.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="Метод активации">
                <TextInput
                  value={editSubscription.activation_method || ''}
                  onChange={(e) => setEditSubscription((prev) => ({
                    ...prev,
                    activation_method: e.target.value,
                  }))}
                />
              </Field>
              <ActiveCheckboxField
                checked={!!editSubscription.is_active}
                onChange={(checked) => setEditSubscription((prev) => ({ ...prev, is_active: checked }))}
                label="Активна"
              />
              <FormActions
                onCancel={() => setEditSubscription(null)}
                submitLabel={editSaving ? 'Сохранение…' : 'Сохранить'}
                submitting={editSaving}
              />
            </form>
          ) : null}
        </Modal>

        <ConfirmModal
          open={!!deleteTarget}
          title="Удалить подписку?"
          message={`Будет удалена запись доступа к городу ${
            deleteTarget?.city_name || cityLabelById.get(String(deleteTarget?.city)) || ''
          }.`}
          confirmLabel={deleting ? 'Удаление…' : 'Удалить'}
          loading={deleting}
          danger
          onConfirm={handleDeleteSubscription}
          onClose={() => setDeleteTarget(null)}
        />

        <ConfirmModal
          open={!!bulkAction}
          title={
            bulkAction === 'grant-all'
              ? 'Выдать доступ ко всем городам?'
              : bulkAction === 'revoke-all'
                ? 'Отключить все подписки пользователя?'
                : 'Выдать города по типу подписки?'
          }
          message={
            bulkAction === 'grant-type'
              ? 'Будут активированы все города, привязанные к выбранному типу подписки.'
              : bulkAction === 'grant-all'
                ? 'Пользователь получит активный доступ ко всем городам в каталоге.'
                : 'Все активные CitySubscription будут переведены в is_active=false.'
          }
          confirmLabel={bulkBusy ? 'Выполнение…' : 'Подтвердить'}
          loading={bulkBusy}
          onConfirm={runBulkAction}
          onClose={() => {
            setBulkAction(null);
            setBulkSubscriptionTypeId('');
            setBulkError(null);
          }}
        >
          {bulkAction === 'grant-type' ? (
            <div className="mt-4 space-y-2">
              <select
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm"
                value={bulkSubscriptionTypeId}
                onChange={(e) => setBulkSubscriptionTypeId(e.target.value)}
              >
                <option value="">Выберите тип подписки</option>
                {subscriptionTypes.map((type) => (
                  <option key={type.id} value={type.id}>{type.name}</option>
                ))}
              </select>
              {bulkError ? <FormErrorAlert message={bulkError} /> : null}
            </div>
          ) : bulkError ? (
            <FormErrorAlert message={bulkError} />
          ) : null}
        </ConfirmModal>

        <RawJsonModal
          open={!!iapRawTarget}
          onClose={() => setIapRawTarget(null)}
          title={`raw_response — ${iapRawTarget?.product_id || ''}`}
          data={iapRawTarget?.raw_response}
        />
      </div>
    </Layout>
  );
}
