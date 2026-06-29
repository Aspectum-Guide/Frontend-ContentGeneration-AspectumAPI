export const CONTENT_CATALOG_SECTION = {
  id: 'content',
  title: 'Контент',
  description: 'Города, ивенты, теги и медиа',
  badge: 'CONTENT',
  badgeClass: 'bg-violet-100 text-violet-700',
  items: [
    { to: '/catalog/cities', title: 'Города', description: 'Контент, карта, теги города', icon: '🏙️' },
    { to: '/catalog/events', title: 'Ивенты', description: 'События, видимость, букинг', icon: '🎪' },
    { to: '/catalog/tags', title: 'Теги и фильтры', description: 'Теги городов и событий', icon: '🏷️' },
    { to: '/catalog/audio-guides', title: 'Аудиогиды', description: 'Треки по языкам, загрузка MP3', icon: '🎧' },
    { to: '/catalog/interactive-locations', title: 'Интерактивные локации', description: 'Опубликованные IL из сессий, тогл видимости', icon: '📍' },
    { to: '/catalog/photos', title: 'Фотографии', description: 'Медиа (изображения)', icon: '🖼️' },
  ],
};

export const BOOKING_REFERENCE_ITEMS = [
  { to: '/catalog/ticket-types', title: 'Типы билетов', description: 'Глобальный каталог типов с кодами', icon: '🎟️' },
  { to: '/catalog/slot-availabilities', title: 'Слоты', description: 'Доступные слоты по времени и ивенту', icon: '🕒' },
  { to: '/catalog/ticket-prices', title: 'Цены слотов', description: 'Цены по слотам и типам билетов', icon: '💶' },
  { to: '/catalog/base-prices', title: 'Базовые цены', description: 'Fallback-цены ивент × тип для ценового движка', icon: '💰' },
  { to: '/catalog/pricing-rules', title: 'Правила цен', description: 'Цены по дням недели, датам и времени', icon: '📋' },
];

export const BOOKING_OPS_ITEMS = [
  { to: '/catalog/booking-setup', title: 'Настройка продаж', description: 'Мастер: типы, слоты, цены, готовность к shop', icon: '🧭' },
  { to: '/catalog/analytics', title: 'Аналитика', description: 'Выручка и резервации по типам и ивентам', icon: '📊' },
  { to: '/catalog/reservations', title: 'Резервации', description: 'Подтверждённые бронирования', icon: '🧾' },
];

export const BOOKING_CATALOG_SECTION = {
  id: 'booking',
  title: 'Букинг',
  description: 'Настройка и управление продажами билетов',
  badge: 'BOOKING',
  badgeClass: 'bg-blue-100 text-blue-700',
  items: [...BOOKING_OPS_ITEMS, ...BOOKING_REFERENCE_ITEMS],
};

export const SUBSCRIPTION_CATALOG_SECTION = {
  id: 'subscription',
  title: 'Подписки',
  description: 'Управление типами подписок и кодами активации',
  badge: 'SUBSCRIPTION',
  badgeClass: 'bg-emerald-100 text-emerald-700',
  items: [
    { to: '/catalog/subscription-types', title: 'Типы подписки', description: 'Настройка пакетов подписки', icon: '🧩' },
    { to: '/catalog/activation-codes', title: 'Коды активации', description: 'Коды для активации подписок', icon: '🔐' },
  ],
};

export const CATALOG_SECTIONS = [
  CONTENT_CATALOG_SECTION,
  BOOKING_CATALOG_SECTION,
  SUBSCRIPTION_CATALOG_SECTION,
];

export const BOOKING_CATALOG_SECTIONS = [
  {
    id: 'booking-refs',
    title: 'Справочники',
    description: 'CRUD по сущностям BookingAPI — как города и ивенты для контента',
    badge: 'API',
    badgeClass: 'bg-sky-100 text-sky-700',
    items: BOOKING_REFERENCE_ITEMS,
  },
  {
    id: 'booking-ops',
    title: 'Операции',
    description: 'Настройка продаж, отчёты и бронирования',
    badge: 'OPS',
    badgeClass: 'bg-blue-100 text-blue-700',
    items: BOOKING_OPS_ITEMS,
  },
];
