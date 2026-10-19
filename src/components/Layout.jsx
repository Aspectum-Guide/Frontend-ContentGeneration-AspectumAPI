import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { sessionsAPI, workspacesAPI } from '../api/generation';
import { useLayoutActions } from '../context/useLayoutActions';
import useTokenValidation from '../hooks/useTokenValidation';
import TokenManager from '../utils/TokenManager';
import { getWorkspace, setWorkspace, workspaceTitle } from '../utils/workspace';
import { FormLabel, Button, Heading, IconButton, Panel, Select, Sidebar, SidebarActions, SidebarFooter, SidebarHeader, SidebarIconButton, SidebarOverlay } from './ui';
import AppNav from './AppNav';
import { pageTitleFor } from '../config/nav';

/**
 * Переключатель рабочего пространства (Россия / Европа / …). Сужает списки
 * сессий и тегов во всей админке; при смене страница перезагружается, чтобы
 * все экраны взяли данные нового пространства.
 */
function WorkspaceSwitcher({ compact }) {
  const [items, setItems] = useState([]);
  const current = getWorkspace();

  useEffect(() => {
    workspacesAPI.list().then((r) => {
      const list = Array.isArray(r?.data?.results) ? r.data.results : [];
      setItems(list);
      // Пространство удалили из справочника — сбрасываем на «все».
      if (current && list.length && !list.some((w) => w.code === current)) {
        setWorkspace('');
        window.location.reload();
      }
    }).catch(() => { });
  }, [current]);

  const onChange = (event) => {
    setWorkspace(event.target.value);
    window.location.reload();
  };

  const active = items.find((w) => w.code === current);
  if (compact) {
    return (
      <div
        className="mx-auto rounded-aspectum-control bg-aspectum-surface-muted px-1.5 py-0.5 text-[11px] font-semibold text-aspectum-text"
        title={`Пространство: ${active ? workspaceTitle(active) : 'все'}`}
      >
        {active ? workspaceTitle(active).slice(0, 3) : 'Все'}
      </div>
    );
  }
  return (
    <FormLabel  layout="stack">
      <span className="text-[11px] font-medium uppercase tracking-wide text-aspectum-text-muted">Пространство</span>
      <Select
        value={current}
        onChange={onChange}
        className="w-full rounded-aspectum-control border border-aspectum-border bg-aspectum-surface px-2 py-1.5 text-sm text-aspectum-text focus:border-aspectum-primary focus:outline-none focus:ring-1 focus:ring-aspectum-primary"
      >
        <option value="">Все пространства</option>
        {items.map((w) => (
          <option key={w.code} value={w.code}>{workspaceTitle(w)}</option>
        ))}
      </Select>
    </FormLabel>
  );
}

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
  const [rightPanelOpen, setRightPanelOpen] = useState(
    () => localStorage.getItem('rightPanelOpen') !== 'false'
  );
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

  const sessionNavItems = activeSessions.slice(0, 3).map((s) => ({
    label: s.name || s.uuid?.slice(0, 12) + '…',
    to: `/generation/${s.id}`,
    badge: s.status === 'in_progress' ? 'Active' : null,
    badgeColor: 'bg-aspectum-orange-subtle',
  }));

  const routePageTitle = pageTitleFor(location.pathname);
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

  return (
    <div className="flex h-screen bg-aspectum-surface-muted">
      {isMobile && mobileSidebarOpen && (
        <SidebarOverlay
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {isMobile && mobileActionsOpen && (
        <SidebarOverlay onClick={() => setMobileActionsOpen(false)} label="Закрыть панель действий" />
      )}

      {/* Left Sidebar */}
      <Sidebar expanded={sidebarExpanded || isMobile} label="Основная навигация" className={`fixed inset-y-0 bg-aspectum-surface border-aspectum-border shadow-aspectum-card transition-all duration-300 flex flex-col z-40 ${isMobile
        ? `w-[var(--aspectum-layout-sidebar-mobile)] max-w-[85vw] transform ${mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`
        : sidebarExpanded ? 'w-[var(--aspectum-layout-sidebar-expanded)]' : 'w-[var(--aspectum-layout-sidebar-collapsed)]'
        }`}>
        {/* Sidebar Header with User Info */}
        <SidebarHeader>
          <div className="flex items-center justify-between gap-2">
            {(sidebarExpanded || isMobile) && (
              <div className="truncate">
                <p className="text-sm font-bold text-aspectum-text truncate">{user?.username || 'User'}</p>
                <p className="text-xs text-aspectum-text-muted truncate">{user?.email || ''}</p>
              </div>
            )}
            {isMobile ? (
              <SidebarIconButton label="Закрыть меню" onClick={() => setMobileSidebarOpen(false)}>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </SidebarIconButton>
            ) : (
              <SidebarIconButton
                label={sidebarExpanded ? 'Свернуть меню' : 'Развернуть меню'}
                title={sidebarExpanded ? 'Collapse' : 'Expand'}
                onClick={() => setSidebarExpanded(!sidebarExpanded)}
              >
                <svg className={`w-5 h-5 transition-transform ${sidebarExpanded ? 'rotate-0' : 'rotate-180'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </SidebarIconButton>
            )}
          </div>
          <WorkspaceSwitcher compact={!sidebarExpanded && !isMobile} />
        </SidebarHeader>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto p-3">
          <AppNav pathname={location.pathname} collapsed={!sidebarExpanded && !isMobile} extraItems={{ sessions: sessionNavItems }} onNavigate={isMobile ? () => setMobileSidebarOpen(false) : undefined} />
        </div>

        {/* User Actions */}
        <SidebarFooter>
          <Link
            to="/account/settings"
            className={`w-full flex items-center justify-center gap-2 rounded-aspectum-control text-sm font-medium text-aspectum-text hover:bg-aspectum-surface-muted transition-colors py-2 ${(sidebarExpanded || isMobile) ? 'px-3' : 'px-1'}`}
            title={(!sidebarExpanded && !isMobile) ? 'Настройки аккаунта' : ''}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15.5A3.5 3.5 0 1 0 12 8a3.5 3.5 0 0 0 0 7.5ZM19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.12 2.12-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V20.3h-3v-.08A1.7 1.7 0 0 0 10.68 18.66a1.7 1.7 0 0 0-1.88.34l-.06.06-2.12-2.12.06-.06A1.7 1.7 0 0 0 7.02 15a1.7 1.7 0 0 0-1.56-1.03h-.08v-3h.08A1.7 1.7 0 0 0 7.02 9.94a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.12-2.12.06.06a1.7 1.7 0 0 0 1.88.34 1.7 1.7 0 0 0 1.03-1.56v-.08h3v.08a1.7 1.7 0 0 0 1.03 1.56 1.7 1.7 0 0 0 1.88-.34l.06-.06L19.8 8l-.06.06a1.7 1.7 0 0 0-.34 1.88 1.7 1.7 0 0 0 1.56 1.03h.08v3h-.08A1.7 1.7 0 0 0 19.4 15Z" /></svg>
            {(sidebarExpanded || isMobile) && 'Настройки аккаунта'}
          </Link>
          <Button
            onClick={handleLogout}
            className={`w-full flex items-center justify-center gap-2 rounded-aspectum-control text-sm font-medium text-aspectum-danger hover:bg-aspectum-danger-soft transition-colors py-2 ${(sidebarExpanded || isMobile) ? 'px-3' : 'px-1'
              }`}
            title={(!sidebarExpanded && !isMobile) ? 'Logout' : ''}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            {(sidebarExpanded || isMobile) && 'Выход'}
          </Button>

          {/* Build version */}
          {(sidebarExpanded || isMobile) && (
            <div className="text-center text-[10px] text-aspectum-text-muted pt-1">
              rev {__APP_VERSION__} · {__APP_BUILD_DATE__}
            </div>
          )}
        </SidebarFooter>
      </Sidebar>

      {isMobile && (
        <Sidebar
          side="right"
          mobile
          expanded={mobileActionsOpen}
          label="Панель действий"
          className={`fixed inset-y-0 z-40 w-[var(--aspectum-layout-sidebar-mobile)] max-w-[85vw] bg-aspectum-surface border-aspectum-border shadow-aspectum-modal transform transition-transform duration-300 ${mobileActionsOpen ? 'translate-x-0' : 'translate-x-full'}`}
        >
          <div className="h-full flex flex-col">
            <div className="border-b border-aspectum-border p-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-aspectum-text">Кнопки формы</p>
                <p className="text-xs text-aspectum-text-muted mt-0.5">{mobilePageTitle}</p>
              </div>
              <IconButton
                onClick={() => setMobileActionsOpen(false)}
                label="Закрыть панель действий"
                variant="ghost"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </IconButton>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              <div className="text-xs uppercase tracking-wide text-aspectum-text-muted mb-2">Кнопки формы</div>
              <SidebarActions
                actions={mobileActions}
                emptyText="Для этой страницы дополнительных кнопок пока нет."
                onAction={(action) => {
                  setMobileActionsOpen(false);
                  action.onClick?.();
                }}
                onRefresh={mobileActions.length === 0 ? () => window.location.reload() : undefined}
              />

            </div>
          </div>
        </Sidebar>
      )}

      {/* Main Content */}
      <main className={`flex-1 overflow-auto transition-all duration-300 ${isMobile ? 'ml-0' : sidebarExpanded ? 'ml-[var(--aspectum-layout-sidebar-expanded)]' : 'ml-[var(--aspectum-layout-sidebar-collapsed)]'
        }`}>
        {isMobile && (
          <div className="sticky top-0 z-20 bg-aspectum-surface-muted/95 backdrop-blur border-b border-aspectum-border px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <Button type="button" variant="outline" size="md" onClick={() => setMobileSidebarOpen(true)} className="gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
                Меню
              </Button>

              <div className="min-w-0 flex-1 text-center px-2">
                <div className="text-sm font-semibold text-aspectum-text truncate">{mobilePageTitle}</div>
                <div className="text-[11px] text-aspectum-text-muted truncate">{location.pathname}</div>
              </div>

              <Button type="button" variant="outline" size="md" onClick={() => setMobileActionsOpen(true)} className="gap-1">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h.01M12 12h.01M19 12h.01" />
                </svg>
                Действия
              </Button>
            </div>
          </div>
        )}
        <div className="px-[var(--aspectum-space-page-x)] py-[var(--aspectum-space-page-y)] md:px-[var(--aspectum-space-page-x-lg)]">
          <div className="flex items-start gap-[var(--aspectum-space-layout-gap)]">
            <div className="min-w-0 flex-1">
              {shouldRenderPageHeader && (
                <div className="mb-4 md:mb-5">
                  <Heading level={1} size="lg" weight="bold">{pageHeader.title}</Heading>
                  {pageHeader.description && (
                    <p className="mt-0.5 text-sm text-aspectum-text-muted">{pageHeader.description}</p>
                  )}
                </div>
              )}
              {children}
            </div>

            {!isMobile && (
              <aside className="hidden lg:block shrink-0">
                {rightPanelOpen ? (
                  <Panel as="div" className="w-[var(--aspectum-layout-actions-panel)] sticky top-6 shadow-aspectum-card overflow-hidden">
                    <div className="flex items-center justify-between px-3 py-2 border-b border-aspectum-border">
                      <span className="text-xs uppercase tracking-wide font-semibold text-aspectum-text-muted">
                        Действия
                      </span>
                      <IconButton
                        type="button"
                        onClick={() => {
                          setRightPanelOpen(false);
                          localStorage.setItem('rightPanelOpen', 'false');
                        }}
                        label="Скрыть панель"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                      </IconButton>
                    </div>
                    <div className="p-3">
                      <SidebarActions
                        actions={formActions}
                        onAction={(action) => action.onClick?.()}
                        onRefresh={() => window.location.reload()}
                      />
                    </div>
                  </Panel>
                ) : (
                  <div className="sticky top-6">
                    <Button
                      type="button"
                      onClick={() => {
                        setRightPanelOpen(true);
                        localStorage.setItem('rightPanelOpen', 'true');
                      }}
                      title="Показать панель действий"
                      variant="outline"
                      size="sidebarRail"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                      </svg>
                      {formActions.length > 0 && (
                        <span className="w-1.5 h-1.5 rounded-full bg-aspectum-primary" title={`${formActions.length} действий`} />
                      )}
                    </Button>
                  </div>
                )}
              </aside>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
