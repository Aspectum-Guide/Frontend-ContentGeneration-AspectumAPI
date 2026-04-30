import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { sessionsAPI } from '../api/generation';
import { useLayoutActions } from '../context/useLayoutActions';
import useTokenValidation from '../hooks/useTokenValidation';
import TokenManager from '../utils/TokenManager';

function getActiveSessions(sessions) {
  return sessions.filter(
    (s) => s.status === 'draft' || s.status === 'in_progress'
  );
}

export default function Layout({ children, pageHeader = null, pageHeaderMode = 'desktop' }) {
  const { mobileActions } = useLayoutActions();
  const location = useLocation();
  const navigate = useNavigate();
  const [activeSessions, setActiveSessions] = useState([]);
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [mobileActionsOpen, setMobileActionsOpen] = useState(false);
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
    }).catch(() => { });
  }, [location.pathname]);

  useEffect(() => {
    const updateMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (!mobile) {
        setMobileSidebarOpen(false);
      }
    };

    updateMobile();
    window.addEventListener('resize', updateMobile);
    return () => window.removeEventListener('resize', updateMobile);
  }, []);

  useEffect(() => {
    if (isMobile) {
      setMobileSidebarOpen(false);
      setMobileActionsOpen(false);
    }
  }, [location.pathname, isMobile]);

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
        { label: 'Каталог (все справочники)', to: '/catalog' },
        { label: 'Города', to: '/catalog/cities' },
        { label: 'Ивенты', to: '/catalog/events' },
        { label: 'Типы билетов', to: '/catalog/ticket-types' },
        { label: 'Слоты (Доступность)', to: '/catalog/slot-availabilities' },
        { label: 'Цены билетов', to: '/catalog/ticket-prices' },
        { label: 'Типы подписки', to: '/catalog/subscription-types' },
        { label: 'Коды активации', to: '/catalog/activation-codes' },
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

  const pageTitles = [
    { startsWith: '/generation/upload', title: 'Загрузка из файла' },
    { startsWith: '/generation/new', title: 'Новая сессия' },
    { startsWith: '/generation/list', title: 'Список генерации' },
    { startsWith: '/generation/', title: 'Редактор сессии' },
    { startsWith: '/generation', title: 'Сессии' },
    { startsWith: '/ai/settings', title: 'Настройки ИИ' },
    { startsWith: '/ai/playground', title: 'Тестовый стенд' },
    { startsWith: '/ai/images', title: 'Поиск картинок' },
    { startsWith: '/ai/cities', title: 'Генерация городов' },
    { startsWith: '/ai/events', title: 'Генерация событий' },
    { startsWith: '/tasks', title: 'Мои задачи' },
    { startsWith: '/catalog/cities', title: 'Справочник городов' },
    { startsWith: '/catalog/events', title: 'Справочник ивентов' },
    { startsWith: '/catalog/ticket-types', title: 'Справочник типов билетов' },
    { startsWith: '/catalog/slot-availabilities', title: 'Справочник слотов (доступность)' },
    { startsWith: '/catalog/ticket-prices', title: 'Справочник цен билетов' },
    { startsWith: '/catalog/subscription-types', title: 'Справочник типов подписки' },
    { startsWith: '/catalog/activation-codes', title: 'Справочник кодов активации' },
    { startsWith: '/catalog/photos', title: 'Каталог фото' },
    { startsWith: '/catalog/tags', title: 'Теги и фильтры' },
    { startsWith: '/export/zip', title: 'Экспорт ZIP' },
    { startsWith: '/export/cities', title: 'Экспорт городов' },
    { startsWith: '/export/events', title: 'Экспорт ивентов' },
    { startsWith: '/import/google-sheet', title: 'Импорт' },
  ];
  const routePageTitle = pageTitles.find((p) => location.pathname.startsWith(p.startsWith))?.title || 'Aspectum Admin';
  const mobilePageTitle = pageHeader?.mobileTitle || pageHeader?.title || routePageTitle;
  const shouldRenderPageHeader = !!pageHeader && (
    pageHeaderMode === 'always'
    || (pageHeaderMode === 'desktop' && !isMobile)
    || (pageHeaderMode === 'mobile' && isMobile)
  );
  const pageHeaderActions = Array.isArray(pageHeader?.actions) ? pageHeader.actions : [];
  const formActions = [
    ...mobileActions,
    ...pageHeaderActions.filter((action) => !mobileActions.some((existing) => (
      (action.id && existing.id && action.id === existing.id)
      || action.label === existing.label
    ))),
  ];

  const getPageHeaderActionClass = (variant) => {
    if (variant === 'danger') {
      return 'bg-red-600 text-white hover:bg-red-700 disabled:opacity-60';
    }
    if (variant === 'secondary') {
      return 'bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-60';
    }
    return 'bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60';
  };

  const SidebarContent = () => (
    <nav className="space-y-4">
      {sidebarSections.map((section) => (
        <div key={section.title}>
          <p className={`pb-2 text-xs font-semibold uppercase tracking-wide text-gray-400 ${sidebarExpanded ? 'px-3' : 'px-1 text-center'
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
                  className={`flex items-center justify-between rounded-lg text-sm font-medium transition-colors ${sidebarExpanded ? 'px-3' : 'px-1 justify-center'
                    } py-2 ${isActive
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
      {isMobile && mobileSidebarOpen && (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-black/40"
          onClick={() => setMobileSidebarOpen(false)}
          aria-label="Закрыть меню"
        />
      )}

      {isMobile && mobileActionsOpen && (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-black/40"
          onClick={() => setMobileActionsOpen(false)}
          aria-label="Закрыть панель действий"
        />
      )}

      {/* Left Sidebar */}
      <aside className={`fixed inset-y-0 left-0 bg-white border-r border-gray-200 shadow-sm transition-all duration-300 flex flex-col z-40 ${isMobile
        ? `w-72 max-w-[85vw] transform ${mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`
        : sidebarExpanded ? 'w-64' : 'w-20'
        }`}>
        {/* Sidebar Header with User Info */}
        <div className="border-b border-gray-200 p-3 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            {(sidebarExpanded || isMobile) && (
              <div className="truncate">
                <p className="text-sm font-bold text-gray-900 truncate">{user?.username || 'User'}</p>
                <p className="text-xs text-gray-500 truncate">{user?.email || ''}</p>
              </div>
            )}
            {isMobile ? (
              <button
                onClick={() => setMobileSidebarOpen(false)}
                className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors shrink-0"
                title="Закрыть меню"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            ) : (
              <button
                onClick={() => setSidebarExpanded(!sidebarExpanded)}
                className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors shrink-0"
                title={sidebarExpanded ? 'Collapse' : 'Expand'}
              >
                <svg className={`w-5 h-5 transition-transform ${sidebarExpanded ? 'rotate-0' : 'rotate-180'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}
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
            className={`w-full flex items-center justify-center gap-2 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors py-2 ${(sidebarExpanded || isMobile) ? 'px-3' : 'px-1'
              }`}
            title={(!sidebarExpanded && !isMobile) ? 'Logout' : ''}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            {(sidebarExpanded || isMobile) && 'Выход'}
          </button>
        </div>
      </aside>

      {isMobile && (
        <aside className={`fixed inset-y-0 right-0 z-40 w-72 max-w-[85vw] bg-white border-l border-gray-200 shadow-xl transform transition-transform duration-300 ${mobileActionsOpen ? 'translate-x-0' : 'translate-x-full'}`}>
          <div className="h-full flex flex-col">
            <div className="border-b border-gray-200 p-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-gray-900">Кнопки формы</p>
                <p className="text-xs text-gray-500 mt-0.5">{mobilePageTitle}</p>
              </div>
              <button
                type="button"
                onClick={() => setMobileActionsOpen(false)}
                className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500"
                aria-label="Закрыть панель действий"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              <div className="text-xs uppercase tracking-wide text-gray-400 mb-2">Кнопки формы</div>
              <div className="space-y-2">
                {mobileActions.length > 0 ? mobileActions.map((action, index) => (
                  <button
                    key={action.id || `${action.label}-${index}`}
                    type="button"
                    disabled={!!action.disabled}
                    onClick={() => {
                      setMobileActionsOpen(false);
                      action.onClick?.();
                    }}
                    className={`w-full px-3 py-2 rounded-lg text-left text-sm font-medium transition-colors disabled:opacity-50 ${action.variant === 'danger'
                      ? 'bg-red-50 text-red-700 hover:bg-red-100'
                      : action.variant === 'primary'
                        ? 'bg-blue-600 text-white hover:bg-blue-700'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                  >
                    {action.label}
                  </button>
                )) : (
                  <div className="text-sm text-gray-500 border border-dashed border-gray-300 rounded-lg p-3">
                    Для этой страницы дополнительных кнопок пока нет.
                  </div>
                )}
              </div>

              {mobileActions.length === 0 && (
                <div className="mt-4 pt-4 border-t border-gray-100 space-y-2">
                  <button
                    type="button"
                    onClick={() => window.location.reload()}
                    className="w-full px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 text-left"
                  >
                    Обновить страницу
                  </button>
                </div>
              )}
            </div>
          </div>
        </aside>
      )}

      {/* Main Content */}
      <main className={`flex-1 overflow-auto transition-all duration-300 ${isMobile ? 'ml-0' : sidebarExpanded ? 'ml-64' : 'ml-20'
        }`}>
        {isMobile && (
          <div className="sticky top-0 z-20 bg-gray-50/95 backdrop-blur border-b border-gray-200 px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setMobileSidebarOpen(true)}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
                Меню
              </button>

              <div className="min-w-0 flex-1 text-center px-2">
                <div className="text-sm font-semibold text-gray-900 truncate">{mobilePageTitle}</div>
                <div className="text-[11px] text-gray-500 truncate">{location.pathname}</div>
              </div>

              <button
                type="button"
                onClick={() => setMobileActionsOpen(true)}
                className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h.01M12 12h.01M19 12h.01" />
                </svg>
                Действия
              </button>
            </div>
          </div>
        )}
        <div className="p-4 md:p-6">
          <div className="flex items-start gap-6">
            <div className="min-w-0 flex-1">
              {shouldRenderPageHeader && (
                <div className="mb-4 md:mb-5">
                  <h1 className="text-2xl font-bold text-gray-900">{pageHeader.title}</h1>
                  {pageHeader.description && (
                    <p className="mt-0.5 text-sm text-gray-500">{pageHeader.description}</p>
                  )}
                </div>
              )}
              {children}
            </div>

            {!isMobile && (
              <aside className="hidden lg:block w-72 shrink-0">
                <div className="sticky top-6 rounded-xl border border-gray-200 bg-white p-4">
                  <div className="text-xs uppercase tracking-wide text-gray-400 mb-2">Кнопки формы</div>
                  <div className="space-y-2">
                    {formActions.length > 0 ? formActions.map((action, index) => (
                      <button
                        key={action.id || `${action.label}-${index}`}
                        type="button"
                        onClick={action.onClick}
                        disabled={!!action.disabled}
                        className={`w-full px-3 py-2 rounded-lg text-left text-sm font-medium transition-colors disabled:opacity-50 ${getPageHeaderActionClass(action.variant)}`}
                      >
                        {action.label}
                      </button>
                    )) : (
                      <div className="text-sm text-gray-500 border border-dashed border-gray-300 rounded-lg p-3">
                        Для этой страницы дополнительных кнопок пока нет.
                      </div>
                    )}
                  </div>

                  {formActions.length === 0 && (
                    <div className="mt-4 pt-4 border-t border-gray-100 space-y-2">
                      <button
                        type="button"
                        onClick={() => window.location.reload()}
                        className="w-full px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 text-left"
                      >
                        Обновить страницу
                      </button>
                    </div>
                  )}
                </div>
              </aside>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
