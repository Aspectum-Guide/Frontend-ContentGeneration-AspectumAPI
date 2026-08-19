import { useEffect, useState } from 'react';
import { authAPI } from '../api/auth.ts';
import Button from '../components/ui/Button';

const fromBase64Url = (value) => {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4);
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0)).buffer;
};

const toBase64Url = (buffer) => {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

export default function AccountSettings() {
  const [passkeys, setPasskeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    try {
      setLoading(true);
      const { data } = await authAPI.passkeys();
      setPasskeys(data.passkeys || []);
    } catch (err) {
      setError(err?.response?.data?.detail || 'Не удалось загрузить настройки безопасности.');
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const addPasskey = async () => {
    if (!window.PublicKeyCredential) { setError('Этот браузер не поддерживает passkeys.'); return; }
    try {
      setSaving(true); setError('');
      const { data } = await authAPI.passkeyRegistrationOptions();
      const options = data.options;
      options.challenge = fromBase64Url(options.challenge);
      options.user.id = fromBase64Url(options.user.id);
      options.excludeCredentials = (options.excludeCredentials || []).map((item) => ({ ...item, id: fromBase64Url(item.id) }));
      const credential = await navigator.credentials.create({ publicKey: options });
      if (!credential) return;
      const response = credential.response;
      await authAPI.passkeyRegistrationVerify({
        challenge_id: data.challenge_id,
        name: `Passkey ${new Date().toLocaleDateString('ru-RU')}`,
        credential: {
          id: credential.id, rawId: toBase64Url(credential.rawId), type: credential.type,
          authenticatorAttachment: credential.authenticatorAttachment,
          clientExtensionResults: credential.getClientExtensionResults(),
          response: {
            attestationObject: toBase64Url(response.attestationObject),
            clientDataJSON: toBase64Url(response.clientDataJSON),
            transports: typeof response.getTransports === 'function' ? response.getTransports() : [],
          },
        },
      });
      await load();
    } catch (err) {
      if (err?.name !== 'NotAllowedError') setError(err?.response?.data?.detail || 'Не удалось добавить passkey.');
    } finally { setSaving(false); }
  };

  const removePasskey = async (id) => {
    if (!window.confirm('Удалить этот passkey? Вход с этого устройства больше не будет доступен.')) return;
    try { await authAPI.deletePasskey(id); setPasskeys((items) => items.filter((item) => item.id !== id)); }
    catch (err) { setError(err?.response?.data?.detail || 'Не удалось удалить passkey.'); }
  };

  return <div className="max-w-3xl mx-auto p-4 md:p-8">
    <h1 className="text-2xl font-bold text-gray-900">Настройки аккаунта</h1>
    <p className="mt-2 text-sm text-gray-600">Управляйте безопасным входом в контент-админку.</p>
    <section className="mt-6 bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
      <div className="flex flex-wrap justify-between items-start gap-4"><div><h2 className="font-semibold text-gray-900">Passkeys</h2><p className="mt-1 text-sm text-gray-500">Вход по Face ID, Touch ID, PIN устройства или ключу безопасности — без пароля.</p></div><Button type="button" onClick={addPasskey} disabled={saving}>{saving ? 'Добавляем…' : 'Добавить passkey'}</Button></div>
      {error && <p className="mt-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">{error}</p>}
      {loading ? <p className="mt-5 text-sm text-gray-500">Загрузка…</p> : passkeys.length === 0 ? <p className="mt-5 text-sm text-gray-500">Passkeys ещё не добавлены. Пароль остаётся способом восстановления доступа.</p> : <ul className="mt-5 divide-y divide-gray-100 border-t border-b border-gray-100">{passkeys.map((item) => <li className="py-3 flex justify-between items-center gap-4" key={item.id}><div><p className="text-sm font-medium text-gray-800">{item.name}</p><p className="text-xs text-gray-500">Добавлен {new Date(item.created_at).toLocaleDateString('ru-RU')}{item.last_used_at ? ` · использован ${new Date(item.last_used_at).toLocaleDateString('ru-RU')}` : ''}</p></div><button className="text-sm text-red-600 hover:text-red-800" onClick={() => removePasskey(item.id)}>Удалить</button></li>)}</ul>}
    </section>
  </div>;
}
