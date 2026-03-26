import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import TokenManager from '../utils/TokenManager';
import Button from '../components/ui/Button';

export default function TokenAuth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [refreshToken, setRefreshToken] = useState('');
  const [mode, setMode] = useState('credentials'); // 'credentials' или 'token'
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
    
    const apiUrl = import.meta.env.VITE_API_URL || 'https://dev2.aspectum-guide.com/api/v1';

    try {
      setLoading(true);
      setError(null);

      // Для режима 'credentials' отправляем username/password
      if (mode === 'credentials') {
        if (!email.trim() || !password.trim()) {
          setError('Пожалуйста, введите email и пароль');
          return;
        }

        const response = await fetch(`${apiUrl}/auth/login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: email.trim(),
            password: password.trim(),
          }),
        });

        if (response.status === 401) {
          setError('Email или пароль некорректны');
          return;
        }

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          setError(data.detail || `Ошибка сервера: ${response.status}`);
          return;
        }

        const data = await response.json();

        if (!data.access || !data.refresh) {
          setError('Сервер вернул некорректные токены');
          return;
        }

        // Сохраняем токены через TokenManager
        TokenManager.saveTokens({
          access: data.access,
          refresh: data.refresh,
          expiresAt: Date.now() + 3600000, // ~1 час
        });

        console.log('✅ Токены сохранены успешно');
        navigate('/generation');
      } 
      // Для режима 'token' используем refresh токен напрямую
      else {
        if (!refreshToken.trim()) {
          setError('Пожалуйста, введите refresh токен');
          return;
        }

        // Валидируем refresh токен
        const validation = TokenManager.validateToken(refreshToken.trim());
        if (!validation.isValid) {
          setError('Refresh токен некорректен или истёк');
          return;
        }

        // Пытаемся обновить токен
        const refreshResult = await TokenManager.refreshTokens(refreshToken.trim());

        if (!refreshResult.success) {
          setError(refreshResult.error || 'Не удалось обновить токен');
          return;
        }

        console.log('✅ Токены обновлены успешно');
        navigate('/generation');
      }
    } catch (err) {
      console.error('Ошибка при входе:', err);
      setError('Ошибка подключения к серверу. Проверьте данные и интернет');
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

        {/* Переключатель между режимами */}
        <div className="flex gap-2 mb-6 bg-gray-100 p-1 rounded-lg">
          <button
            type="button"
            onClick={() => {
              setMode('credentials');
              setError(null);
            }}
            className={`flex-1 py-2 px-3 rounded transition font-medium text-sm ${
              mode === 'credentials'
                ? 'bg-white text-blue-600 shadow'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Email & Пароль
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('token');
              setError(null);
            }}
            className={`flex-1 py-2 px-3 rounded transition font-medium text-sm ${
              mode === 'token'
                ? 'bg-white text-blue-600 shadow'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Refresh Token
          </button>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          {mode === 'credentials' ? (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@example.com"
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
            </>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Refresh Token
              </label>
              <textarea
                value={refreshToken}
                onChange={(e) => setRefreshToken(e.target.value)}
                placeholder="Введите ваш refresh token..."
                rows={4}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition font-mono text-xs"
                disabled={loading}
                autoFocus
              />
              <p className="text-xs text-gray-500 mt-2">
                Для разработки - введите валидный JWT refresh токен
              </p>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <Button
            type="submit"
            variant="primary"
            className="w-full py-3 text-base font-medium"
            disabled={loading || (mode === 'credentials' ? (!email.trim() || !password.trim()) : !refreshToken.trim())}
          >
            {loading ? 'Вход в процессе...' : 'Войти'}
          </Button>
        </form>

        <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <p className="text-xs text-blue-900">
            <strong>Информация по входу:</strong><br/>
            {mode === 'credentials' 
              ? 'Введите email и пароль вашего аккаунта Aspectum'
              : 'Введите JWT refresh токен для разработки'
            }
          </p>
        </div>
      </div>
    </div>
  );
}
