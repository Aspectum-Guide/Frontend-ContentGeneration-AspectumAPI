import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Layout from '../../components/Layout';
import Button from '../../components/ui/Button';
import { sessionsAPI } from '../../api/generation';
import { parseApiError } from '../../utils/apiError';

export default function GenerationList() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('Запрос списка сессий от:', new Date().toISOString());
      const response = await sessionsAPI.list();
      console.log('✓ Ответ получен:', response);
      console.log('  Status:', response.status);
      console.log('  Data:', response.data);
      
      // Обработка ответа: может быть { success, results } или прямо массив
      let data = [];
      if (response?.data?.results) {
        data = response.data.results;
      } else if (response?.data && Array.isArray(response.data)) {
        data = response.data;
      } else if (Array.isArray(response?.results)) {
        data = response.results;
      }
      
      console.log('✓ Обработано сессий:', data.length);
      setSessions(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('✗ Ошибка загрузки:', err);
      console.error('  URL:', err.config?.url);
      console.error('  Status:', err.response?.status);
      console.error('  Data:', err.response?.data);
      
      setError(parseApiError(err, 'Не удалось загрузить сессии'));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (sessionId) => {
    if (!window.confirm('Вы уверены, что хотите удалить эту сессию?')) {
      return;
    }

    try {
      await sessionsAPI.delete(sessionId);
      loadSessions();
    } catch (err) {
      alert('Ошибка при удалении сессии');
      console.error(err);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="text-center py-12">
          <p className="text-gray-600">Загрузка...</p>
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <div className="text-center py-12">
          <p className="text-red-600">Ошибка: {error}</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="mb-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-4xl font-bold text-gray-900">Список сессий</h1>
            <p className="text-gray-600 mt-2">Управление сессиями создания контента для городов</p>
          </div>
          <Button
            variant="primary"
            onClick={() => navigate('/generation/new')}
            className="py-2 px-6 text-lg"
          >
            + Создать сессию
          </Button>
        </div>

        {sessions.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
            <div className="text-6xl mb-4">📋</div>
            <p className="text-gray-600 text-lg mb-6">Нет созданных сессий</p>
            <Button
              variant="primary"
              onClick={() => navigate('/generation/new')}
              className="py-2 px-8 text-base"
            >
              Создать первую сессию
            </Button>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Название
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Статус
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Статус публикации
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Город
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Дата создания
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Действия
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {sessions.map((session, idx) => (
                    <tr 
                      key={session.id} 
                      className="hover:bg-blue-50 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-blue-400 to-blue-600 rounded-lg flex items-center justify-center text-white font-semibold">
                            {idx + 1}
                          </div>
                          <div>
                            <div className="text-sm font-medium text-gray-900 max-w-xs truncate">
                              {session.name || 'Без названия'}
                            </div>
                            <div className="text-xs text-gray-500 font-mono">
                              {session.uuid?.substring(0, 12)}...
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                          session.status === 'draft' ? 'bg-gray-100 text-gray-800' :
                          session.status === 'in_progress' ? 'bg-yellow-100 text-yellow-800' :
                          session.status === 'completed' ? 'bg-green-100 text-green-800' :
                          session.status === 'published' ? 'bg-blue-100 text-blue-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {session.status_display || session.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {session.status === 'published' ? (
                          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">
                            <span>✅</span> Опубликовано
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600">
                            <span>📝</span> Черновик
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {session.published_city ? (
                            <span className="font-medium">{session.published_city.name}</span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {new Date(session.created_at).toLocaleDateString('ru-RU', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="flex justify-end gap-2">
                          <Link
                            to={`/generation/${session.id}`}
                            className="inline-flex items-center justify-center w-9 h-9 rounded-lg text-blue-600 hover:bg-blue-100 transition-colors font-medium"
                            title="Редактировать"
                          >
                            ✏️
                          </Link>
                          {session.status === 'draft' ? (
                            <button
                              onClick={() => handleDelete(session.id)}
                              className="inline-flex items-center justify-center w-9 h-9 rounded-lg text-red-600 hover:bg-red-100 transition-colors font-medium"
                              title="Удалить"
                            >
                              🗑️
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
