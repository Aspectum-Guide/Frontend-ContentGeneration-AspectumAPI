import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Layout from '../../components/Layout';
import { Button, ConfirmModal, DataTable, EmptyState, PageHeader, Panel, Spinner } from '@aspectum/ui';
import { sessionsAPI } from '../../api/generation';
import { parseApiError } from '../../utils/apiError';

export default function GenerationList() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
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

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await sessionsAPI.delete(deleteTarget.id);
      setDeleteTarget(null);
      await loadSessions();
    } catch (err) {
      console.error(err);
      throw new Error(parseApiError(err, 'Не удалось удалить сессию'));
    }
  };

  if (loading) {
    return (
      <Layout>
        <EmptyState icon={<Spinner size="md" />} title="Загрузка..." />
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <EmptyState icon="⚠️" title={`Ошибка: ${error}`} tone="danger" />
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="mb-8">
        <PageHeader
          title="Список сессий"
          titleSize="xl"
          description="Управление сессиями создания контента для городов"
          actions={<Button
            variant="primary"
            onClick={() => navigate('/generation/new')}
            size="xl"
          >
            + Создать сессию
          </Button>}
        />

        {sessions.length === 0 ? (
          <Panel className="p-12 text-center shadow-aspectum-card">
            <div className="text-6xl mb-4">📋</div>
            <p className="text-aspectum-text-subtle text-lg mb-6">Нет созданных сессий</p>
            <Button
              variant="primary"
              onClick={() => navigate('/generation/new')}
              size="lg"
            >
              Создать первую сессию
            </Button>
          </Panel>
        ) : (
          <DataTable
            rows={sessions.map((session, index) => ({ ...session, listIndex: index + 1 }))}
            columns={[
              {
                key: 'name',
                label: 'Название',
                render: (value, row) => (
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-aspectum-primary-light to-aspectum-primary rounded-aspectum-control flex items-center justify-center text-aspectum-on-accent font-semibold">
                      {row.listIndex}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-aspectum-text max-w-xs truncate">{value || 'Без названия'}</div>
                      <div className="text-xs text-aspectum-text-muted font-mono">{row.uuid?.substring(0, 12)}...</div>
                    </div>
                  </div>
                ),
              },
              {
                key: 'status',
                label: 'Статус',
                render: (value, row) => (
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                    value === 'draft' ? 'bg-aspectum-surface-subtle text-aspectum-text-emphasis' :
                    value === 'in_progress' ? 'bg-aspectum-caution-muted text-aspectum-caution-emphasis' :
                    value === 'completed' ? 'bg-aspectum-positive-muted text-aspectum-positive-emphasis' :
                    value === 'published' ? 'bg-aspectum-primary-muted text-aspectum-primary-strong' :
                    'bg-aspectum-danger-muted text-aspectum-danger-emphasis'
                  }`}>
                    {row.status_display || value}
                  </span>
                ),
              },
              {
                key: 'publicationStatus',
                label: 'Статус публикации',
                render: (_, row) => row.status === 'published' ? (
                  <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-aspectum-positive-muted text-aspectum-positive-emphasis">✅ Опубликовано</span>
                ) : (
                  <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-aspectum-surface-subtle text-aspectum-text-subtle">📝 Черновик</span>
                ),
              },
              {
                key: 'published_city',
                label: 'Город',
                render: (value) => value?.name ? <span className="font-medium">{value.name}</span> : <span className="text-aspectum-text-disabled">—</span>,
              },
              {
                key: 'created_at',
                label: 'Дата создания',
                className: 'whitespace-nowrap text-sm text-aspectum-text-subtle',
                render: (value) => new Date(value).toLocaleDateString('ru-RU', {
                  year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                }),
              },
            ]}
            actions={(session) => (
              <>
                <Link
                  to={`/generation/${session.id}`}
                  className="inline-flex items-center justify-center w-9 h-9 rounded-aspectum-control text-aspectum-primary hover:bg-aspectum-primary-muted transition-colors font-medium"
                  title="Редактировать"
                >
                  ✏️
                </Link>
                {session.status === 'draft' && (
                  <Button
                    type="button"
                    variant="softDanger"
                    size="sm"
                    onClick={() => setDeleteTarget(session)}
                    title="Удалить"
                  >
                    🗑️
                  </Button>
                )}
              </>
            )}
          />
        )}
      </div>

      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Удалить сессию?"
        message={`Сессия «${deleteTarget?.name || 'Без названия'}» будет удалена без возможности восстановления.`}
        confirmLabel="Удалить"
        danger
      />
    </Layout>
  );
}
