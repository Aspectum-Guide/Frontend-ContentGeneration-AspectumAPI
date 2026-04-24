import { Link } from 'react-router-dom';
import Layout from '../../components/Layout';

const CATALOG_SECTIONS = [
  {
    id: 'booking',
    title: 'Booking API',
    description: 'Справочники бронирования: билеты, слоты и цены',
    badge: 'BOOKING',
    badgeClass: 'bg-blue-100 text-blue-700',
    items: [
      { to: '/catalog/ticket-types', title: 'Типы билетов', description: 'Ticket types (booking)', icon: '🎟️' },
      { to: '/catalog/slot-availabilities', title: 'Слоты (доступность)', description: 'Доступные слоты по времени', icon: '🕒' },
      { to: '/catalog/ticket-prices', title: 'Цены билетов', description: 'Цены по слотам и типам', icon: '💶' },
      { to: '/catalog/reservations', title: 'Резервы', description: 'Резервы людей (user/guest) по слотам', icon: '🧾' },
    ],
  },
  {
    id: 'subscription',
    title: 'Subscription API',
    description: 'Управление типами подписок и кодами активации',
    badge: 'SUBSCRIPTION',
    badgeClass: 'bg-emerald-100 text-emerald-700',
    items: [
      { to: '/catalog/subscription-types', title: 'Типы подписки', description: 'Настройка пакетов подписки', icon: '🧩' },
      { to: '/catalog/activation-codes', title: 'Коды активации', description: 'Коды для активации подписок', icon: '🔐' },
    ],
  },
  {
    id: 'events-city',
    title: 'Events & City API',
    description: 'Базовый контент: города, события и классификация',
    badge: 'CONTENT',
    badgeClass: 'bg-violet-100 text-violet-700',
    items: [
      { to: '/catalog/cities', title: 'Города', description: 'Контент, карта, теги города', icon: '🏙️' },
      { to: '/catalog/events', title: 'Ивенты', description: 'События, видимость, теги', icon: '🎪' },
      { to: '/catalog/tags', title: 'Теги и фильтры', description: 'Теги городов и событий', icon: '🏷️' },
    ],
  },
  {
    id: 'media',
    title: 'Media API',
    description: 'Медиаресурсы, связанные с городами и событиями',
    badge: 'MEDIA',
    badgeClass: 'bg-amber-100 text-amber-700',
    items: [
      { to: '/catalog/photos', title: 'Фотографии', description: 'Медиа (изображения)', icon: '🖼️' },
    ],
  },
];

function CatalogCard({ to, title, description, icon }) {
  return (
    <Link
      to={to}
      className="group block rounded-xl border border-gray-200 bg-white p-4 hover:shadow-md hover:border-blue-200 transition-all"
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-gray-50 border border-gray-200 flex items-center justify-center text-xl">
          {icon}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-gray-900 group-hover:text-blue-700 truncate">
              {title}
            </h2>
            <span className="text-xs text-gray-400 group-hover:text-blue-500">→</span>
          </div>
          <p className="text-sm text-gray-500 mt-1 line-clamp-2">
            {description}
          </p>
          <p className="text-xs text-gray-300 mt-2 font-mono truncate">
            {to}
          </p>
        </div>
      </div>
    </Link>
  );
}

function CatalogSection({ section }) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4 md:p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">{section.title}</h2>
          <p className="mt-1 text-sm text-gray-500">{section.description}</p>
        </div>
        <span className={`shrink-0 rounded-md px-2 py-1 text-[11px] font-semibold tracking-wide ${section.badgeClass}`}>
          {section.badge}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {section.items.map((item) => (
          <CatalogCard key={item.to} {...item} />
        ))}
      </div>
    </section>
  );
}

export default function CatalogHome() {
  return (
    <Layout>
      <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-4 md:p-5">
        <h1 className="text-2xl font-bold text-gray-900">Каталог API-справочников</h1>
        <p className="mt-1 text-sm text-gray-500">
          Внешняя админ-панель: сущности сгруппированы по backend API-доменам.
        </p>
      </div>

      <div className="space-y-4">
        {CATALOG_SECTIONS.map((section) => (
          <CatalogSection key={section.id} section={section} />
        ))}
      </div>
    </Layout>
  );
}

