import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Layout from '../../components/Layout';
import Button from '../../components/ui/Button';
import { sessionsAPI } from '../../api/generation';
import { SESSION_STATUS_LABELS } from '../../utils/constants';

export default function SessionsList() {
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
      const response = await sessionsAPI.list();
      setSessions(response.data.results || response.data);
    } catch (err) {
      setError(err.message);
      console.error('Ошибка загрузки сессий:', err);
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
      <div className="mb-6 flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Сессии генерации</h1>
        <Button
          variant="primary"
          onClick={() => navigate('/generation/new')}
        >
          Создать сессию
        </Button>
      </div>

      {sessions.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <p className="text-gray-600 mb-4">Нет созданных сессий</p>
          <Button
            variant="primary"
            onClick={() => navigate('/generation/new')}
          >
            Создать первую сессию
          </Button>
        </div>
      ) : (
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Название
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Статус
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Публикация
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Языки
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Создано
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Действия
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sessions.map((session) => (
                <tr key={session.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {session.name || 'Без названия'}
                    </div>
                    <div className="text-xs text-gray-500 font-mono">
                      {session.id.substring(0, 8)}...
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                      session.status === 'draft' ? 'bg-gray-100 text-gray-800' :
                      session.status === 'ready' ? 'bg-green-100 text-green-800' :
                      session.status === 'committed' ? 'bg-blue-100 text-blue-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {SESSION_STATUS_LABELS[session.status] || session.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {session.is_published ? (
                      <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                        ✅ Опубликовано
                      </span>
                    ) : (
                      <span className="px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-600">
                        Черновик
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {session.target_languages?.join(', ') || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(session.created_at).toLocaleDateString('ru-RU')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex gap-3">
                      <Link
                        to={`/generation/${session.id}`}
                        className="inline-flex items-center justify-center w-8 h-8 rounded-md text-blue-600 hover:bg-blue-100 hover:text-blue-900 transition-colors"
                        title="Открыть сессию"
                      >
                        ✏️
                      </Link>
                      {session.status === 'draft' && (
                        <button
                          onClick={() => handleDelete(session.id)}
                          className="inline-flex items-center justify-center w-8 h-8 rounded-md text-red-600 hover:bg-red-100 hover:text-red-900 transition-colors"
                          title="Удалить сессию"
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Layout>
  );
}
