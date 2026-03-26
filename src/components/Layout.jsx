import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import useTokenValidation from '../hooks/useTokenValidation';
import TokenManager from '../utils/TokenManager';
import { sessionsAPI } from '../api/generation';

function getActiveSessions(sessions) {
  return sessions.filter(
    (s) => s.status === 'draft' || s.status === 'in_progress'
  );
}

export default function Layout({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [activeSessions, setActiveSessions] = useState([]);
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const [user, setUser] = useState(null);
  useTokenValidation();

  // Загрузить информацию о пользователе из токена
  useEffect(() => {
    const tokens = TokenManager.getTokens();
    if (tokens?.access) {
      const decoded = TokenManager.decodeJwtPayload(tokens.access);
      if (decoded) {
        setUser({
          username: decoded.username || decoded.email || 'User',
          email: decoded.email || '',
        });
      }
    }
  }, []);

  useEffect(() => {
    sessionsAPI.list().then((r) => {
      const data = r?.data;
      const list = Array.isArray(data?.results) ? data.results
        : Array.isArray(data) ? data : [];
      setActiveSessions(getActiveSessions(list));
    }).catch(() => {});
  }, [location.pathname]);

  const handleLogout = () => {
    TokenManager.clearTokens();
    navigate('/token-auth');
  };

  const sidebarSections = [
    {
      title: 'Сессии',
      items: [
        ...activeSessions.slice(0, 3).map((s) => ({
          label: s.name || s.uuid?.slice(0, 12) + '…',
          to: `/generation/${s.id}`,
          badge: s.status === 'in_progress' ? 'Active' : null,
          badgeColor: 'bg-orange-500',
        })),
        { label: 'Все сессии', to: '/generation' },
        { label: 'Загрузить из файла', to: '/generation/upload' },
      ],
    },
    {
      title: 'Работа с ИИ',
      items: [
        { label: 'Настройки ИИ', to: '/ai/settings' },
        { label: 'Тестовый стенд', to: '/ai/playground' },
        { label: 'Поиск картинок', to: '/ai/images' },
        { label: 'Генерация городов', to: '/ai/cities', badge: 'AI' },
        { label: 'Генерация событий', to: '/ai/events', badge: 'AI' },
      ],
    },
    {
      title: 'Задачи',
      items: [{ label: 'Мои задачи', to: '/tasks' }],
    },
    {
      title: 'Справочники',
      items: [
        { label: 'Города', to: '/catalog/cities' },
        { label: 'Ивенты', to: '/catalog/events' },
        { label: 'Фотографии', to: '/catalog/photos' },
        { label: 'Теги и фильтры', to: '/catalog/tags' },
      ],
    },
    {
      title: 'Экспорт / Импорт',
      items: [
        { label: '⬇ Экспорт ZIP (всё)', to: '/export/zip' },
        { label: '⬇ Только города', to: '/export/cities' },
        { label: '⬇ Только ивенты', to: '/export/events' },
        { label: '📊 Импорт', to: '/import/google-sheet' },
      ],
    },
  ];

  const SidebarContent = () => (
    <nav className="space-y-4">
      {sidebarSections.map((section) => (
        <div key={section.title}>
          <p className={`pb-2 text-xs font-semibold uppercase tracking-wide text-gray-400 ${
            sidebarExpanded ? 'px-3' : 'px-1 text-center'
          }`}>
            {sidebarExpanded ? section.title : section.title.charAt(0)}
          </p>
          <div className="space-y-0.5">
            {section.items.map((item) => {
              const isActive = location.pathname === item.to
                || (item.to !== '/' && location.pathname.startsWith(item.to) && item.to.length > 1);

              return (
                <Link
                  key={`${section.title}-${item.label}`}
                  to={item.to}
                  title={!sidebarExpanded ? item.label : ''}
                  className={`flex items-center justify-between rounded-lg text-sm font-medium transition-colors ${
                    sidebarExpanded ? 'px-3' : 'px-1 justify-center'
                  } py-2 ${
                    isActive
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <span className={`truncate ${!sidebarExpanded && 'hidden'}`}>{item.label}</span>
                  {item.badge && sidebarExpanded && (
                    <span className={`ml-2 shrink-0 inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white ${item.badgeColor || 'bg-blue-600'}`}>
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Left Sidebar */}
      <aside className={`fixed inset-y-0 left-0 bg-white border-r border-gray-200 shadow-sm transition-all duration-300 flex flex-col z-40 ${
        sidebarExpanded ? 'w-64' : 'w-20'
      }`}>
        {/* Sidebar Header with User Info */}
        <div className="border-b border-gray-200 p-3 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            {sidebarExpanded && (
              <div className="truncate">
                <p className="text-sm font-bold text-gray-900 truncate">{user?.username || 'User'}</p>
                <p className="text-xs text-gray-500 truncate">{user?.email || ''}</p>
              </div>
            )}
            <button
              onClick={() => setSidebarExpanded(!sidebarExpanded)}
              className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors shrink-0"
              title={sidebarExpanded ? 'Collapse' : 'Expand'}
            >
              <svg className={`w-5 h-5 transition-transform ${sidebarExpanded ? 'rotate-0' : 'rotate-180'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto p-3">
          <SidebarContent />
        </div>

        {/* User Actions */}
        <div className="border-t border-gray-200 p-3 space-y-2">
          <button
            onClick={handleLogout}
            className={`w-full flex items-center justify-center gap-2 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors py-2 ${
              sidebarExpanded ? 'px-3' : 'px-1'
            }`}
            title={!sidebarExpanded ? 'Logout' : ''}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            {sidebarExpanded && 'Выход'}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className={`flex-1 overflow-auto transition-all duration-300 ${
        sidebarExpanded ? 'ml-64' : 'ml-20'
      }`}>
        <div className="p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
