import {
  ArrowLeftRight, AudioLines, BadgeDollarSign, BookOpen, Building2, CalendarCheck, CalendarDays,
  ChartColumn, ChartLine, ClipboardCheck, Download, FileText, FlaskConical, FolderKanban, Globe,
  Headphones, Image, Images, KeyRound, Layers, LifeBuoy, Library, List, ListChecks, ListTodo,
  MapPin, MapPinOff, MessageSquareText, Mic, ScrollText, SlidersHorizontal, Smartphone, Sparkles,
  Table, Tags, Ticket, Upload, UserCheck, Users,
} from 'lucide-react';

/**
 * Single source of truth for the admin navigation and page titles.
 *
 * `scopes` says which deployment a group belongs to: the generation studio
 * ('studio') or the live catalog/booking admin ('catalog'). A group listed in both
 * is shown in both. VITE_NAV_SCOPE=studio|catalog trims the menu for a build that
 * only serves one of them; the default ('all') keeps today's full menu.
 */
export const NAV_GROUPS = [
  {
    id: 'sessions',
    title: 'Сессии',
    icon: FolderKanban,
    scopes: ['studio'],
    items: [
      { label: 'Все сессии', to: '/generation', icon: List },
      { label: 'Загрузить из файла', to: '/generation/upload', icon: Upload },
    ],
  },
  {
    id: 'ai',
    title: 'Работа с ИИ',
    icon: Sparkles,
    scopes: ['studio'],
    items: [
      { label: 'Настройки ИИ', to: '/ai/settings', icon: SlidersHorizontal },
      { label: 'Промпты', to: '/ai/prompts', icon: MessageSquareText },
      { label: 'Настройки TTS', to: '/ai/tts', icon: AudioLines },
      { label: 'Тестовый стенд', to: '/ai/playground', icon: FlaskConical },
      { label: 'Поиск картинок', to: '/ai/images', icon: Images },
      { label: 'Генерация городов', to: '/ai/cities', icon: Building2, badge: 'AI' },
    ],
  },
  {
    id: 'tasks',
    title: 'Задачи',
    icon: ListChecks,
    scopes: ['studio'],
    items: [
      { label: 'Мои задачи', to: '/tasks', icon: ListTodo },
      { label: 'Очередь озвучки', to: '/tasks/audio-queue', icon: Mic },
      { label: 'Восстановление аудио', to: '/tasks/media-recovery', icon: LifeBuoy },
    ],
  },
  {
    id: 'content',
    title: 'Контент',
    icon: Library,
    scopes: ['catalog'],
    items: [
      { label: 'Города', to: '/catalog/cities', icon: Building2 },
      { label: 'Ивенты', to: '/catalog/events', icon: CalendarDays },
      { label: 'Ивенты без города', to: '/catalog/events/orphans', icon: MapPinOff },
      { label: 'Авторы', to: '/catalog/authors', icon: Users },
      { label: 'Теги и фильтры', to: '/catalog/tags', icon: Tags },
      { label: 'Аудиогиды', to: '/catalog/audio-guides', icon: Headphones },
      { label: 'Интерактивные локации', to: '/catalog/interactive-locations', icon: MapPin },
      { label: 'Фотографии', to: '/catalog/photos', icon: Image },
      { label: 'Продуктовая аналитика', to: '/catalog/product-analytics', icon: ChartColumn },
    ],
  },
  {
    id: 'booking',
    title: 'Букинг',
    icon: Ticket,
    scopes: ['catalog'],
    items: [
      { label: 'Настройка продаж', to: '/catalog/booking-setup', icon: ClipboardCheck },
      { label: 'Цены по городу', to: '/catalog/city-pricing', icon: BadgeDollarSign },
      { label: 'Справочники', to: '/catalog/booking', icon: BookOpen },
      { label: 'Аналитика', to: '/catalog/analytics', icon: ChartLine },
      { label: 'Резервации', to: '/catalog/reservations', icon: CalendarCheck },
    ],
  },
  {
    id: 'subscriptions',
    title: 'Подписки',
    icon: KeyRound,
    scopes: ['catalog'],
    items: [
      { label: 'Типы подписки', to: '/catalog/subscription-types', icon: Layers },
      { label: 'Коды активации', to: '/catalog/activation-codes', icon: KeyRound },
      { label: 'Логи активации', to: '/catalog/code-usage-logs', icon: ScrollText },
      { label: 'Подписки пользователей', to: '/catalog/user-subscriptions', icon: UserCheck },
      { label: 'Все подписки на города', to: '/catalog/city-subscriptions', icon: Globe },
      { label: 'IAP покупки', to: '/catalog/iap-purchases', icon: Smartphone },
    ],
  },
  {
    id: 'transfer',
    title: 'Экспорт / Импорт',
    icon: ArrowLeftRight,
    scopes: ['studio', 'catalog'],
    items: [
      { label: 'Экспорт ZIP (всё)', to: '/export/zip', icon: Download },
      { label: 'Только города', to: '/export/cities', icon: Download },
      { label: 'Только ивенты', to: '/export/events', icon: Download },
      { label: 'Импорт', to: '/import/google-sheet', icon: Table },
    ],
  },
];

/** Icon for the dynamic "active session" entries injected into the sessions group. */
export const SESSION_ITEM_ICON = FileText;

export function resolveNavScope(value = import.meta.env?.VITE_NAV_SCOPE) {
  return value === 'studio' || value === 'catalog' ? value : 'all';
}

export function getNavGroups(scope = resolveNavScope()) {
  if (scope === 'all') return NAV_GROUPS;
  return NAV_GROUPS.filter((group) => group.scopes.includes(scope));
}

// An item is active on its own path or any sub-path, except that "Ивенты" must not
// light up on "Ивенты без города" (a sibling that shares the prefix).
export function isNavItemActive(pathname, item) {
  if (pathname === item.to) return true;
  if (item.to === '/' || item.to.length <= 1) return false;
  if (item.to === '/catalog/events' && pathname.startsWith('/catalog/events/orphans')) return false;
  return pathname.startsWith(item.to);
}

export function findActiveGroupId(pathname, groups = NAV_GROUPS) {
  const group = groups.find((g) => g.items.some((item) => isNavItemActive(pathname, item)));
  return group?.id ?? null;
}

export const PAGE_TITLES = [
  { startsWith: '/generation/upload', title: 'Загрузка из файла' },
  { startsWith: '/generation/new', title: 'Новая сессия' },
  { startsWith: '/generation/list', title: 'Список генерации' },
  { startsWith: '/generation/', title: 'Редактор сессии' },
  { startsWith: '/generation', title: 'Сессии' },
  { startsWith: '/ai/tts', title: 'Настройки TTS' },
  { startsWith: '/ai/settings', title: 'Настройки ИИ' },
  { startsWith: '/ai/prompts', title: 'Промпты генерации' },
  { startsWith: '/ai/playground', title: 'Тестовый стенд' },
  { startsWith: '/ai/images', title: 'Поиск картинок' },
  { startsWith: '/ai/cities', title: 'Генерация городов' },
  { startsWith: '/tasks/audio-queue', title: 'Очередь озвучки' },
  { startsWith: '/tasks', title: 'Мои задачи' },
  { startsWith: '/account/settings', title: 'Настройки аккаунта' },
  { startsWith: '/catalog/cities', title: 'Справочник городов' },
  { startsWith: '/catalog/events/orphans', title: 'Ивенты без города' },
  { startsWith: '/catalog/events', title: 'Справочник ивентов' },
  { startsWith: '/catalog/authors', title: 'Авторы контента' },
  { startsWith: '/catalog/ticket-types', title: 'Справочник типов билетов' },
  { startsWith: '/catalog/slot-availabilities', title: 'Справочник слотов (доступность)' },
  { startsWith: '/catalog/ticket-prices', title: 'Справочник цен билетов' },
  { startsWith: '/catalog/base-prices', title: 'Базовые цены' },
  { startsWith: '/catalog/pricing-rules', title: 'Правила ценообразования' },
  { startsWith: '/catalog/product-analytics', title: 'Продуктовая аналитика' },
  { startsWith: '/catalog/analytics', title: 'Аналитика бронирований' },
  { startsWith: '/catalog/booking-setup', title: 'Booking Setup (мастер)' },
  { startsWith: '/catalog/city-pricing', title: 'Массовые цены по городу' },
  { startsWith: '/catalog/booking', title: 'Справочники букинга' },
  { startsWith: '/catalog/llm/keys', title: 'Ключи LLM API' },
  { startsWith: '/catalog/llm/usage', title: 'Использование моделей' },
  { startsWith: '/catalog/reservations', title: 'Резервации' },
  { startsWith: '/catalog/subscription-types', title: 'Справочник типов подписки' },
  { startsWith: '/catalog/activation-codes', title: 'Справочник кодов активации' },
  { startsWith: '/catalog/user-subscriptions', title: 'Подписки пользователей' },
  { startsWith: '/catalog/city-subscriptions', title: 'Все подписки на города' },
  { startsWith: '/catalog/code-usage-logs', title: 'Логи активации кодов' },
  { startsWith: '/catalog/iap-purchases', title: 'IAP покупки' },
  { startsWith: '/catalog/audio-guides', title: 'Аудиогиды' },
  { startsWith: '/catalog/interactive-locations', title: 'Интерактивные локации' },
  { startsWith: '/catalog/photos', title: 'Каталог фото' },
  { startsWith: '/catalog/tags', title: 'Теги и фильтры' },
  { startsWith: '/export/zip', title: 'Экспорт ZIP' },
  { startsWith: '/export/cities', title: 'Экспорт городов' },
  { startsWith: '/export/events', title: 'Экспорт ивентов' },
  { startsWith: '/import/google-sheet', title: 'Импорт' },
];

export function pageTitleFor(pathname) {
  return PAGE_TITLES.find((p) => pathname.startsWith(p.startsWith))?.title || 'Aspectum Admin';
}
