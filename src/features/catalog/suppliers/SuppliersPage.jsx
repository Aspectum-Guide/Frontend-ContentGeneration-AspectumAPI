import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { partnersAdminAPI, partnerToursAdminAPI } from '../../../api/partners';
import Layout from '../../../components/Layout';
import { parseApiError } from '../../../utils/apiError';
import CatalogPageHeader from '../shared/components/CatalogPageHeader';
import { TOUR_STATUSES, formatDate, pickText } from './tourFormat';

/**
 * «Поставщики»: экскурсии партнёров из конструктора. Слева — папки по
 * организациям, сверху — очередь «Запросы на добавление». Модератор открывает
 * заявку, проверяет карточку, привязывает к городу, местам и тегам и
 * публикует или возвращает на доработку; может и завести экскурсию за
 * партнёра. Без модерации на платформе ничего не появляется.
 */
export default function SuppliersPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const partnerFilter = params.get('partner') || '';
  const queueOnly = !partnerFilter && params.get('all') !== '1';
  const [rows, setRows] = useState([]);
  const [partners, setPartners] = useState([]);
  const [queue, setQueue] = useState(0);
  const [allPartners, setAllPartners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [creatingFor, setCreatingFor] = useState('');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const query = partnerFilter ? { partner: partnerFilter } : queueOnly ? { status: 'submitted' } : {};
      const response = await partnerToursAdminAPI.list(query);
      const data = response?.data || {};
      setRows(Array.isArray(data.results) ? data.results : []);
      setPartners(Array.isArray(data.partners) ? data.partners : []);
      setQueue(data.queue || 0);
    } catch (err) {
      setError(parseApiError(err, 'Не удалось загрузить экскурсии поставщиков'));
    } finally {
      setLoading(false);
    }
  }, [partnerFilter, queueOnly]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    partnersAdminAPI
      .list()
      .then((r) => {
        const data = r?.data;
        setAllPartners(Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : []);
      })
      .catch(() => setAllPartners([]));
  }, []);

  const createFor = async () => {
    if (!creatingFor) return;
    try {
      const response = await partnerToursAdminAPI.create(creatingFor, {});
      navigate(`/catalog/suppliers/${response.data.id}`);
    } catch (err) {
      setError(parseApiError(err, 'Не удалось завести экскурсию'));
    }
  };

  const folder = (active, label, count, onClick, accent = false) => (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-left text-sm ${
        active ? 'bg-aspectum-primary-muted text-aspectum-primary-hover font-semibold' : 'hover:bg-gray-100 text-gray-800'
      }`}
    >
      <span className="truncate">{label}</span>
      {count ? (
        <span className={`text-xs px-2 py-0.5 rounded-full ${accent ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}>
          {count}
        </span>
      ) : null}
    </button>
  );

  return (
    <Layout>
      <CatalogPageHeader
        title="Поставщики"
        description="Экскурсии партнёров из конструктора: заявки на модерацию, правки и публикация."
      />
      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4">
        <aside className="bg-white rounded-xl border border-gray-200 p-3 space-y-1 h-fit">
          {folder(queueOnly, 'Запросы на добавление', queue, () => setParams({}), true)}
          {folder(!queueOnly && !partnerFilter, 'Все экскурсии', null, () => setParams({ all: '1' }))}
          <div className="pt-2 mt-2 border-t border-gray-100 text-xs uppercase tracking-wide text-gray-400 px-3">
            Партнёры
          </div>
          {partners.map((partner) =>
            folder(
              partnerFilter === partner.id,
              partner.name,
              partner.submitted || partner.total,
              () => setParams({ partner: partner.id }),
              Boolean(partner.submitted)
            )
          )}
          {!partners.length && <p className="px-3 py-2 text-sm text-gray-400">Заявок ещё не было</p>}
        </aside>

        <section className="space-y-3">
          <div className="bg-white rounded-xl border border-gray-200 p-3 flex flex-wrap items-center gap-2">
            <span className="text-sm text-gray-700">Завести экскурсию за партнёра:</span>
            <select
              value={creatingFor}
              onChange={(e) => setCreatingFor(e.target.value)}
              className="text-sm border border-gray-300 rounded-lg px-2 py-1.5"
            >
              <option value="">— выберите партнёра —</option>
              {allPartners.map((partner) => (
                <option key={partner.id} value={partner.id}>
                  {partner.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={!creatingFor}
              onClick={createFor}
              className="text-sm px-3 py-1.5 rounded-lg bg-aspectum-primary text-white disabled:opacity-40"
            >
              Завести
            </button>
          </div>

          {error && <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm">{error}</div>}
          {loading ? (
            <div className="p-6 text-sm text-gray-500">Загружаем…</div>
          ) : rows.length ? (
            <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
              {rows.map((row) => {
                const status = TOUR_STATUSES[row.status] || { label: row.status, className: 'bg-gray-100' };
                return (
                  <button
                    type="button"
                    key={row.id}
                    onClick={() => navigate(`/catalog/suppliers/${row.id}`)}
                    className="w-full flex items-center gap-3 p-3 text-left hover:bg-gray-50"
                  >
                    <div className="w-24 h-16 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0">
                      {row.cover_url ? <img src={row.cover_url} alt="" className="w-full h-full object-cover" /> : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-gray-900 truncate">
                        {pickText(row.title) || 'Без названия'}
                      </div>
                      <div className="text-xs text-gray-500">
                        {row.partner_name || ''}
                        {row.submitted_at ? ` · отправлена ${formatDate(row.submitted_at)}` : ''}
                        {row.created_by_staff ? ' · заведена модератором' : ''}
                      </div>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${status.className}`}>{status.label}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 p-6 text-sm text-gray-500">
              {queueOnly ? 'Новых заявок нет.' : 'Экскурсий нет.'}
            </div>
          )}
        </section>
      </div>
    </Layout>
  );
}
