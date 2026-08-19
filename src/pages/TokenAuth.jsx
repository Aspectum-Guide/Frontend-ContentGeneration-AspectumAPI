import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import TokenManager from '../utils/TokenManager';
import { authAPI } from '../api/auth.ts';
import Button from '../components/ui/Button';

export default function TokenAuth() {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Проверяем есть ли уже валидные токены
    const tokens = TokenManager.getTokens();
    if (tokens) {
      const validation = TokenManager.validateToken(tokens.access);
      if (validation.isValid) {
        // Есть валидный токен, редирект на главную
        navigate('/generation');
      }
    }
  }, [navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();
    
    try {
      setLoading(true);
      setError(null);

      if (!login.trim() || !password.trim()) {
        setError('Пожалуйста, введите email (или логин) и пароль');
        return;
      }

      const { resp: response, data: parsed } = await authAPI.loginJson({
        login: login.trim(),
        password: password.trim(),
      });

      if (response.status === 401) {
        setError('Email или пароль некорректны');
        return;
      }

      if (!response.ok) {
        setError(`Ошибка сервера: ${response.status}`);
        return;
      }

      if (!parsed.success) {
        setError('Сервер вернул некорректные токены');
        return;
      }

      const data = parsed.data;
      TokenManager.saveTokens({
        access: data.access,
        refresh: data.refresh,
        expiresAt: Date.now() + 3600000, // ~1 час
      });

      console.log('✅ Токены сохранены успешно');
      navigate('/generation');
    } catch (err) {
      console.error('Ошибка при входе:', err);
      setError('Ошибка подключения к серверу. Проверьте данные и интернет');
    } finally {
      setLoading(false);
    }
  };

  const toBase64Url = (buffer) => {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  };

  const normalizeCredential = (credential) => ({
    id: credential.id,
    rawId: toBase64Url(credential.rawId),
    type: credential.type,
    authenticatorAttachment: credential.authenticatorAttachment,
    clientExtensionResults: credential.getClientExtensionResults(),
    response: {
      authenticatorData: toBase64Url(credential.response.authenticatorData),
      clientDataJSON: toBase64Url(credential.response.clientDataJSON),
      signature: toBase64Url(credential.response.signature),
      userHandle: credential.response.userHandle ? toBase64Url(credential.response.userHandle) : null,
    },
  });

  const fromBase64Url = (value) => {
    const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4);
    const binary = atob(padded);
    return Uint8Array.from(binary, (char) => char.charCodeAt(0)).buffer;
  };

  const handlePasskeyLogin = async () => {
    if (!window.PublicKeyCredential) {
      setError('Этот браузер не поддерживает passkeys. Используйте пароль.');
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const optionsResponse = await authAPI.passkeyAuthenticationOptions();
      const options = optionsResponse.data.options;
      options.challenge = fromBase64Url(options.challenge);
      if (options.allowCredentials) {
        options.allowCredentials = options.allowCredentials.map((item) => ({ ...item, id: fromBase64Url(item.id) }));
      }
      const credential = await navigator.credentials.get({ publicKey: options });
      if (!credential) return;
      const result = await authAPI.passkeyAuthenticationVerify({
        challenge_id: optionsResponse.data.challenge_id,
        credential: normalizeCredential(credential),
      });
      const data = result.data;
      TokenManager.saveTokens({ access: data.access, refresh: data.refresh, expiresAt: Date.now() + 3600000 });
      navigate('/generation');
    } catch (err) {
      if (err?.name !== 'NotAllowedError') setError(err?.response?.data?.detail || 'Не удалось войти с passkey.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Aspectum Admin</h1>
          <p className="text-gray-600">Введите учетные данные для доступа</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email или логин
            </label>
            <input
              type="text"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              placeholder="your@example.com или username"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
              disabled={loading}
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Пароль
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
              disabled={loading}
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <Button
            type="submit"
            variant="primary"
            className="w-full py-3 text-base font-medium"
            disabled={loading || !login.trim() || !password.trim()}
          >
            {loading ? 'Вход в процессе...' : 'Войти'}
          </Button>
        </form>

        <div className="flex items-center gap-3 my-5 text-xs text-gray-400"><span className="h-px bg-gray-200 flex-1" />или<span className="h-px bg-gray-200 flex-1" /></div>
        <Button type="button" variant="secondary" className="w-full py-3" disabled={loading} onClick={handlePasskeyLogin}>
          Войти с passkey
        </Button>

        <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <p className="text-xs text-blue-900">
            <strong>Информация по входу:</strong><br/>
            Введите email или логин и пароль. Если passkey уже добавлен в настройках аккаунта, можно войти без пароля.
          </p>
        </div>
      </div>
    </div>
  );
}
