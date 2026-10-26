import { useEffect, useState } from 'react';
import { partnerReportsAPI } from '../../../api/partners';
import { activationCodesAPI } from '../../../api/subscription';
import { Field, TextInput } from '../../../components/ui/FormField';
import { parseApiError } from '../../../utils/apiError';
import FormErrorAlert from '../shared/components/FormErrorAlert';
import { ANY_CITY, resolveTypeId } from './codeTypes';
import { downloadBlob, formatDate } from './partnerFormat';
import TypeSelect from './TypeSelect';

const SELECT_CLASS = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none';
const BUTTON = 'px-3 py-1.5 text-xs font-medium rounded-md border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50';
const PRIMARY = 'px-3 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50';

function QrPreview({ partnerId, code }) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    let objectUrl = '';
    let cancelled = false;
    partnerReportsAPI
      .codeQr(partnerId, code, 'png')
      .then((response) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(response.data);
        setUrl(objectUrl);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [partnerId, code]);
  return (
    <div className="w-28 h-28 shrink-0 rounded-lg border border-gray-200 bg-white grid place-items-center overflow-hidden">
      {url ? <img src={url} alt={`QR ${code}`} className="w-full h-full object-contain" /> : <span className="text-xs text-gray-400">QR…</span>}
    </div>
  );
}

// Постоянный код партнёра: многоразовый, со своим текстом — как коды для Рима
// или Углича. Партнёр раздаёт его клиентам; ссылка и QR появляются и здесь,
// и у партнёра в кабинете.
export default function MainCodePanel({ partnerId, codes, types, onIssued, onEdit }) {
  const [form, setForm] = useState({ code: '', subscription_type: ANY_CITY, max_uses: '', expiry_days: '' });
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState('');

  const usable = codes.filter((code) => code.can_be_used);
  const set = (key) => (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const issue = async (e) => {
    e.preventDefault();
    try {
      setBusy(true);
      setError(null);
      const days = form.expiry_days === '' ? null : Number(form.expiry_days);
      await activationCodesAPI.create({
        code: (form.code || '').trim().toUpperCase(),
        subscription_type: await resolveTypeId(form.subscription_type, types),
        partner: partnerId,
        max_uses: form.max_uses === '' ? null : Number(form.max_uses),
        expiry_date: days ? new Date(Date.now() + days * 86400000).toISOString() : null,
        description: 'Постоянный код партнёра',
        is_active: true,
      });
      setForm({ code: '', subscription_type: ANY_CITY, max_uses: '', expiry_days: '' });
      setOpen(false);
      await onIssued();
    } catch (err) {
      setError(parseApiError(err, 'Не удалось выпустить код'));
    } finally {
      setBusy(false);
    }
  };

  const copy = async (text, key) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(''), 2000);
    } catch {
      setCopied('');
    }
  };

  const downloadQr = async (code, type) => {
    try {
      const response = await partnerReportsAPI.codeQr(partnerId, code, type, true);
      downloadBlob(`aspectum-${code}.${type}`, response.data);
    } catch (err) {
      setError(parseApiError(err, 'Не удалось скачать QR'));
    }
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-medium text-gray-800">Постоянный код партнёра</div>
        {!open ? (
          <button type="button" className={PRIMARY} onClick={() => setOpen(true)}>
            Создать постоянный код
          </button>
        ) : null}
      </div>
      <p className="text-xs text-gray-500">
        Многоразовый код со своим текстом — как коды для Рима или Углича. Партнёр раздаёт его клиентам: ссылка и
        QR для плакатов появляются у него в кабинете. Каждый клиент активирует код один раз (и один раз на телефон),
        клиент закрепляется за партнёром.
      </p>
      <FormErrorAlert message={error} />

      {usable.map((code) => (
        <div key={code.code} className="flex flex-wrap gap-4 items-start border-t border-gray-100 pt-3">
          <QrPreview partnerId={partnerId} code={code.code} />
          <div className="min-w-0 flex-1 space-y-1.5 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-lg font-semibold tracking-wider">{code.code}</span>
              <button type="button" className={BUTTON} onClick={() => copy(code.code, `code:${code.code}`)}>
                {copied === `code:${code.code}` ? 'Скопировано' : 'Скопировать'}
              </button>
            </div>
            {code.link ? (
              <div className="flex flex-wrap items-center gap-2">
                <a href={code.link} target="_blank" rel="noreferrer" className="text-blue-700 break-all">{code.link}</a>
                <button type="button" className={BUTTON} onClick={() => copy(code.link, `link:${code.code}`)}>
                  {copied === `link:${code.code}` ? 'Скопировано' : 'Скопировать ссылку'}
                </button>
              </div>
            ) : null}
            <div className="text-xs text-gray-500">
              {code.access_mode === 'choose_city' ? 'Город на выбор' : code.label} · активаций {code.current_uses} из{' '}
              {code.max_uses ?? '∞'} · {code.expiry_date ? `до ${formatDate(code.expiry_date)}` : 'бессрочно'}
            </div>
            <div className="flex flex-wrap gap-2">
              {onEdit ? (
                <button type="button" className={BUTTON} onClick={() => onEdit(code.code)}>Изменить</button>
              ) : null}
              <button type="button" className={BUTTON} onClick={() => downloadQr(code.code, 'svg')}>QR для печати (SVG)</button>
              <button type="button" className={BUTTON} onClick={() => downloadQr(code.code, 'png')}>QR картинкой (PNG)</button>
            </div>
          </div>
        </div>
      ))}
      {!usable.length && !open ? (
        <p className="text-sm text-amber-700">У партнёра нет действующего многоразового кода — в его кабинете нечего раздавать. Создайте постоянный код.</p>
      ) : null}

      {open ? (
        <form onSubmit={issue} className="space-y-3 border-t border-gray-100 pt-3">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <Field label="Что открывает" required>
              <TypeSelect
                className={SELECT_CLASS}
                value={form.subscription_type}
                onChange={set('subscription_type')}
                types={types}
                required
              />
            </Field>
            <Field label="Текст кода" hint="Латиница и цифры, например VOLGA2026. Пусто — сгенерируем">
              <TextInput value={form.code} maxLength={40} onChange={set('code')} placeholder="VOLGA2026" />
            </Field>
            <Field label="Активаций" hint="Пусто — без ограничения">
              <TextInput type="number" min={1} value={form.max_uses} onChange={set('max_uses')} />
            </Field>
            <Field label="Срок, дней" hint="Пусто — бессрочно">
              <TextInput type="number" min={1} max={3650} value={form.expiry_days} onChange={set('expiry_days')} />
            </Field>
          </div>
          <div className="flex gap-2">
            <button type="submit" className={PRIMARY} disabled={busy || !form.subscription_type}>{busy ? 'Создаю…' : 'Создать код'}</button>
            <button type="button" className={BUTTON} onClick={() => setOpen(false)} disabled={busy}>Отмена</button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
