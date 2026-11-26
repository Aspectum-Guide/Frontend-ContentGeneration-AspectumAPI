import { useCallback, useEffect, useMemo, useState } from 'react';
import { appleCodesAdminAPI } from '../../../api/appleCodes';
import { partnersAdminAPI } from '../../../api/partners';
import { subscriptionTypesAPI } from '../../../api/subscription';
import Layout from '../../../components/Layout';
import { parseApiError } from '../../../utils/apiError';
import { downloadBlob, formatDate } from '../partners/partnerFormat';
import CatalogPageHeader from '../shared/components/CatalogPageHeader';

/**
 * «Коды Apple»: коды App Store для iPhone в глобальной версии (свой ввод кода
 * для платного контента Apple на iOS запрещает). Порядок: продукт App Store по
 * типу подписки (что открывает код и на сколько) → предложение «бесплатно по
 * коду» (у приложения до 10 активных; у партнёра своё — погасившие код
 * закрепляются за ним) → партии кодов и файл для печати.
 */

const accessLabel = (type) => {
  if (!type) return '';
  const what = type.access_mode === 'choose_city' ? 'город на выбор' : 'набор городов';
  const howLong = type.access_hours ? `на ${type.access_hours} ч` : 'навсегда';
  return `${what}, ${howLong}`;
};

const ASC_STATES = {
  MISSING_METADATA: 'не хватает данных',
  READY_TO_SUBMIT: 'готов к отправке на ревью',
  WAITING_FOR_REVIEW: 'ждёт ревью',
  IN_REVIEW: 'на ревью',
  DEVELOPER_ACTION_NEEDED: 'нужны правки',
  REJECTED: 'отклонён',
  APPROVED: 'одобрен',
};

// Ответы сервера — по-английски с error_code; в админке показываем по-русски.
const ERROR_TEXT = {
  asc_not_configured: 'На этом сервере не задан ключ App Store Connect.',
  asc_app_not_found: 'В App Store Connect не найдено приложение с нашим bundle ID.',
  asc_product_not_found: 'В App Store Connect нет продукта с таким Product ID — заведите его там или снимите галочку.',
  product_exists: 'У этого типа подписки продукт уже есть.',
  type_not_found: 'Тип подписки не найден.',
  product_not_found: 'Продукт не найден.',
  product_not_in_asc: 'Продукт ещё не заведён в App Store Connect.',
  partner_not_found: 'Партнёр не найден.',
  invalid_name: 'Нужно название предложения, до 64 символов.',
  name_taken: 'Предложение с таким названием уже есть — у Apple оно должно быть уникальным.',
  offer_limit: 'У Apple не больше 10 активных предложений на приложение — выключите ненужное.',
  offer_inactive: 'Предложение выключено.',
  invalid_kind: 'Выберите, какие коды выпускать.',
  invalid_environment: 'Неизвестная среда кодов.',
  invalid_count:
    'Неверное количество: одноразовых боевых — от 500 до 25 000, тестовых — от 10 до 10 000, у своего кода — до 25 000 погашений.',
  invalid_expiry: 'Срок — с завтрашнего дня и не дальше чем на 6 месяцев.',
  invalid_custom_code: 'Свой код — латинские буквы и цифры, до 64 символов.',
  custom_code_taken: 'Такой свой код уже есть.',
};

const errorText = (err, fallback) => {
  const data = err?.response?.data;
  if (data?.error_code === 'asc_error') return `Ответ Apple: ${data.detail}`;
  return ERROR_TEXT[data?.error_code] || parseApiError(err, fallback);
};

const inputClass = 'text-sm border border-gray-300 rounded-lg px-2 py-1.5';
const buttonClass = 'text-sm px-3 py-1.5 rounded-lg bg-aspectum-primary text-white disabled:opacity-40';
const ghostButtonClass = 'text-sm px-3 py-1.5 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-40';

const inThreeMonths = () => {
  const date = new Date();
  date.setMonth(date.getMonth() + 3);
  return date.toISOString().slice(0, 10);
};

function Card({ title, hint, children }) {
  return (
    <section className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
      <div>
        <h2 className="text-base font-semibold text-gray-900">{title}</h2>
        {hint ? <p className="text-sm text-gray-500 mt-0.5">{hint}</p> : null}
      </div>
      {children}
    </section>
  );
}

function BatchForm({ offer, onCreated, onError }) {
  const [kind, setKind] = useState('one_time');
  const [count, setCount] = useState(500);
  const [expiresOn, setExpiresOn] = useState(inThreeMonths);
  const [customCode, setCustomCode] = useState('');
  const [sandbox, setSandbox] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      await appleCodesAdminAPI.createBatch(offer.id, {
        kind,
        number_of_codes: Number(count),
        expires_on: expiresOn,
        custom_code: kind === 'custom' ? customCode : '',
        environment: kind === 'one_time' && sandbox ? 'SANDBOX' : 'PRODUCTION',
      });
      onCreated();
    } catch (err) {
      onError(errorText(err, 'Не удалось выпустить коды'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-wrap items-end gap-2 pt-2 border-t border-gray-100">
      <label className="text-xs text-gray-500 flex flex-col gap-1">
        Какие коды
        <select value={kind} onChange={(e) => setKind(e.target.value)} className={inputClass}>
          <option value="one_time">Одноразовые (Apple создаёт сам)</option>
          <option value="custom">Свой код с лимитом</option>
        </select>
      </label>
      {kind === 'custom' ? (
        <label className="text-xs text-gray-500 flex flex-col gap-1">
          Код (латиница и цифры)
          <input
            value={customCode}
            onChange={(e) => setCustomCode(e.target.value.toUpperCase())}
            placeholder="ROME2027"
            className={inputClass}
            maxLength={64}
          />
        </label>
      ) : null}
      <label className="text-xs text-gray-500 flex flex-col gap-1">
        {kind === 'custom' ? 'Сколько раз можно погасить' : 'Сколько кодов'}
        <input
          type="number"
          value={count}
          onChange={(e) => setCount(e.target.value)}
          className={`${inputClass} w-28`}
          min={1}
          max={25000}
        />
      </label>
      <label className="text-xs text-gray-500 flex flex-col gap-1">
        Действуют до
        <input type="date" value={expiresOn} onChange={(e) => setExpiresOn(e.target.value)} className={inputClass} />
      </label>
      {kind === 'one_time' ? (
        <label className="text-xs text-gray-600 flex items-center gap-1.5 pb-2">
          <input type="checkbox" checked={sandbox} onChange={(e) => setSandbox(e.target.checked)} />
          тестовые (песочница, 10–10 000)
        </label>
      ) : null}
      <button type="button" onClick={submit} disabled={busy} className={buttonClass}>
        Выпустить
      </button>
    </div>
  );
}

function OfferRow({ offer, onChanged, onError }) {
  const [showForm, setShowForm] = useState(false);

  const download = async (batch) => {
    try {
      const response = await appleCodesAdminAPI.downloadCodes(batch.id);
      downloadBlob(`apple-codes-${offer.name}-${batch.id.slice(0, 8)}.csv`, response.data);
    } catch (err) {
      onError(errorText(err, 'Не удалось получить коды у Apple'));
    }
  };

  const deactivate = async () => {
    if (!window.confirm(`Выключить предложение «${offer.name}»? Все его коды сразу перестанут работать.`)) return;
    try {
      await appleCodesAdminAPI.deactivateOffer(offer.id);
      onChanged();
    } catch (err) {
      onError(errorText(err, 'Не удалось выключить предложение'));
    }
  };

  return (
    <div className="border border-gray-200 rounded-lg p-3 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold text-sm text-gray-900">{offer.name}</span>
        <span
          className={`text-xs px-2 py-0.5 rounded-full ${
            offer.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'
          }`}
        >
          {offer.is_active ? 'действует' : 'выключено'}
        </span>
        <span className="text-xs text-gray-500">
          {offer.partner ? `партнёр: ${offer.partner.name}` : 'общее'} · погашено {offer.redeemed ?? 0}, открыто городов{' '}
          {offer.applied ?? 0}
        </span>
        <span className="flex-1" />
        {offer.is_active ? (
          <>
            <button type="button" className={ghostButtonClass} onClick={() => setShowForm((value) => !value)}>
              Выпустить коды
            </button>
            <button type="button" className={ghostButtonClass} onClick={deactivate}>
              Выключить
            </button>
          </>
        ) : null}
      </div>
      {offer.batches.length ? (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-500">
              <th className="py-1 font-normal">Партия</th>
              <th className="py-1 font-normal">Кодов / погашений</th>
              <th className="py-1 font-normal">До</th>
              <th className="py-1 font-normal">Выпущена</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {offer.batches.map((batch) => (
              <tr key={batch.id} className="border-t border-gray-100">
                <td className="py-1.5">
                  {batch.kind === 'custom' ? `свой код ${batch.custom_code}` : 'одноразовые'}
                  {batch.environment === 'SANDBOX' ? ' · тестовые' : ''}
                </td>
                <td className="py-1.5">{batch.number_of_codes}</td>
                <td className="py-1.5">{batch.expires_on}</td>
                <td className="py-1.5">{formatDate(batch.created_at)}</td>
                <td className="py-1.5 text-right">
                  <button type="button" className="text-aspectum-primary-hover text-sm" onClick={() => download(batch)}>
                    Скачать CSV
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="text-xs text-gray-400">Кодов ещё не выпускали.</p>
      )}
      {showForm ? (
        <BatchForm
          offer={offer}
          onCreated={() => {
            setShowForm(false);
            onChanged();
          }}
          onError={onError}
        />
      ) : null}
    </div>
  );
}

export default function AppleCodesPage() {
  const [data, setData] = useState(null);
  const [types, setTypes] = useState([]);
  const [partners, setPartners] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [typeId, setTypeId] = useState('');
  const [attachExisting, setAttachExisting] = useState(false);
  const [offerProduct, setOfferProduct] = useState('');
  const [offerName, setOfferName] = useState('');
  const [offerPartner, setOfferPartner] = useState('');

  const load = useCallback(async () => {
    try {
      setError(null);
      const response = await appleCodesAdminAPI.overview();
      setData(response.data);
    } catch (err) {
      setError(errorText(err, 'Не удалось загрузить коды Apple'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    subscriptionTypesAPI
      .list({ page_size: 200 })
      .then((r) => {
        const rows = r?.data?.results ?? r?.data ?? [];
        setTypes(Array.isArray(rows) ? rows : []);
      })
      .catch(() => setTypes([]));
    partnersAdminAPI
      .list()
      .then((r) => {
        const rows = r?.data?.results ?? r?.data ?? [];
        setPartners(Array.isArray(rows) ? rows : []);
      })
      .catch(() => setPartners([]));
  }, [load]);

  const products = useMemo(() => data?.products ?? [], [data]);
  const offers = data?.offers ?? [];
  const limits = data?.limits ?? { active_offers: 0, max_active_offers: 10 };
  const typesWithoutProduct = types.filter(
    (type) => type.is_active !== false && !products.some((product) => product.subscription_type.id === type.id),
  );
  const offerLimitReached = limits.active_offers >= limits.max_active_offers;

  const run = async (action, failure) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      await load();
    } catch (err) {
      setError(errorText(err, failure));
    } finally {
      setBusy(false);
    }
  };

  const createProduct = () =>
    run(async () => {
      await appleCodesAdminAPI.createProduct(typeId, attachExisting);
      setTypeId('');
      setAttachExisting(false);
    }, 'Не удалось завести продукт в App Store Connect');

  const createOffer = () =>
    run(async () => {
      await appleCodesAdminAPI.createOffer({
        product_id: offerProduct,
        name: offerName.trim(),
        partner_id: offerPartner || null,
      });
      setOfferName('');
      setOfferPartner('');
    }, 'Не удалось создать предложение');

  return (
    <Layout>
      <CatalogPageHeader
        title="Коды Apple"
        description="Коды App Store для iPhone в глобальной версии: город на выбор или набор городов, навсегда или на несколько часов."
      />
      <div className="space-y-4 max-w-5xl">
        <div className="p-3 rounded-lg bg-blue-50 text-blue-900 text-sm space-y-1">
          <p>
            Код вводят в окне Apple («Активировать код» → «Ввести код App Store») или по ссылке из файла кодов — она
            открывает App Store с уже вписанным кодом. Что откроется и на сколько, решает тип подписки продукта.
          </p>
          <p>
            Только глобальная версия и только iPhone. В RU-контуре покупок App Store нет, на Android — наши коды, как
            раньше. Боевые коды Apple выдаёт, когда продукт одобрен на ревью; тестовые работают сразу.
          </p>
        </div>
        {data && !data.configured ? (
          <div className="p-3 rounded-lg bg-amber-50 text-amber-900 text-sm">
            На этом сервере не задан ключ App Store Connect — завести продукт или выпустить коды отсюда не выйдет.
          </div>
        ) : null}
        {error ? (
          <div className="sticky top-2 z-10 p-3 rounded-lg bg-red-50 text-red-700 text-sm shadow flex gap-3">
            <span className="flex-1">{error}</span>
            <button type="button" className="text-red-700" onClick={() => setError(null)} aria-label="Закрыть">
              ✕
            </button>
          </div>
        ) : null}
        {loading ? <div className="p-6 text-sm text-gray-500">Загружаем…</div> : null}

        <Card
          title="1. Продукты App Store"
          hint="Продукт-код заводится на тип подписки. Первый продукт Apple пропускает на ревью только вместе с новой версией приложения."
        >
          {products.length ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500">
                  <th className="py-1 font-normal">Тип подписки</th>
                  <th className="py-1 font-normal">Product ID</th>
                  <th className="py-1 font-normal">App Store</th>
                  <th className="py-1 font-normal">Погашено · открыто · ждут города</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr key={product.id} className="border-t border-gray-100 align-top">
                    <td className="py-1.5">
                      <div className="font-medium text-gray-900">{product.subscription_type.name}</div>
                      <div className="text-xs text-gray-500">{accessLabel(product.subscription_type)}</div>
                    </td>
                    <td className="py-1.5 pr-2 font-mono text-xs break-all">{product.product_id}</td>
                    <td className="py-1.5 text-xs">
                      {ASC_STATES[product.asc_state] || product.asc_state || '—'}
                      {product.asc_error ? <div className="text-red-600">{product.asc_error}</div> : null}
                    </td>
                    <td className="py-1.5 text-xs">
                      {product.redemptions?.total ?? 0} · {product.redemptions?.applied ?? 0} ·{' '}
                      {product.redemptions?.pending ?? 0}
                    </td>
                    <td className="py-1.5 text-right">
                      <button
                        type="button"
                        className="text-aspectum-primary-hover text-sm disabled:opacity-40"
                        disabled={busy}
                        onClick={() =>
                          run(() => appleCodesAdminAPI.refreshProduct(product.id), 'Не удалось обновить состояние')
                        }
                      >
                        Обновить
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-gray-400">Продуктов ещё нет.</p>
          )}
          <div className="flex flex-wrap items-end gap-2 pt-2 border-t border-gray-100">
            <label className="text-xs text-gray-500 flex flex-col gap-1">
              Тип подписки
              <select value={typeId} onChange={(e) => setTypeId(e.target.value)} className={inputClass}>
                <option value="">— выберите тип —</option>
                {typesWithoutProduct.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name} ({accessLabel(type)})
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-gray-600 flex items-center gap-1.5 pb-2">
              <input type="checkbox" checked={attachExisting} onChange={(e) => setAttachExisting(e.target.checked)} />
              уже заведён в App Store Connect вручную
            </label>
            <button type="button" className={buttonClass} disabled={!typeId || busy} onClick={createProduct}>
              Завести продукт
            </button>
          </div>
        </Card>

        <Card
          title="2. Предложения и коды"
          hint={`Предложение — канал раздачи: общее или партнёра. Активных: ${limits.active_offers} из ${limits.max_active_offers} (лимит Apple на приложение). Один человек гасит один код каждого предложения.`}
        >
          <div className="space-y-2">
            {offers.length ? (
              offers.map((offer) => (
                <OfferRow key={offer.id} offer={offer} onChanged={load} onError={setError} />
              ))
            ) : (
              <p className="text-sm text-gray-400">Предложений ещё нет.</p>
            )}
          </div>
          <div className="flex flex-wrap items-end gap-2 pt-2 border-t border-gray-100">
            <label className="text-xs text-gray-500 flex flex-col gap-1">
              Продукт
              <select value={offerProduct} onChange={(e) => setOfferProduct(e.target.value)} className={inputClass}>
                <option value="">— продукт —</option>
                {products
                  .filter((product) => product.asc_iap_id)
                  .map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.subscription_type.name}
                    </option>
                  ))}
              </select>
            </label>
            <label className="text-xs text-gray-500 flex flex-col gap-1">
              Название (видно в App Store Connect, менять нельзя)
              <input
                value={offerName}
                onChange={(e) => setOfferName(e.target.value)}
                placeholder="HOTEL-SEA-2027"
                className={`${inputClass} w-64`}
                maxLength={64}
              />
            </label>
            <label className="text-xs text-gray-500 flex flex-col gap-1">
              Партнёр
              <select value={offerPartner} onChange={(e) => setOfferPartner(e.target.value)} className={inputClass}>
                <option value="">— общее, без партнёра —</option>
                {partners.map((partner) => (
                  <option key={partner.id} value={partner.id}>
                    {partner.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className={buttonClass}
              disabled={!offerProduct || !offerName.trim() || busy || offerLimitReached}
              onClick={createOffer}
            >
              Создать предложение
            </button>
          </div>
          {offerLimitReached ? (
            <p className="text-xs text-amber-700">Достигнут лимит Apple: выключите ненужное предложение.</p>
          ) : null}
        </Card>
      </div>
    </Layout>
  );
}
