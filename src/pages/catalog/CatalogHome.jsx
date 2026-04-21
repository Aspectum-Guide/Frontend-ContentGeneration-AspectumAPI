import { Link } from 'react-router-dom';
import Layout from '../../components/Layout';

const CATALOG_ITEMS = [
  { to: '/catalog/cities', title: 'Города', description: 'Контент, карта, теги города', icon: '🏙️' },
  { to: '/catalog/events', title: 'Ивенты', description: 'События, видимость, теги', icon: '🎪' },
  { to: '/catalog/tags', title: 'Теги и фильтры', description: 'Теги городов и событий', icon: '🏷️' },
  { to: '/catalog/photos', title: 'Фотографии', description: 'Медиа (изображения)', icon: '🖼️' },
  { to: '/catalog/ticket-types', title: 'Типы билетов', description: 'Ticket types (booking)', icon: '🎟️' },
  { to: '/catalog/slot-availabilities', title: 'Слоты (доступность)', description: 'Доступные слоты по времени', icon: '🕒' },
  { to: '/catalog/ticket-prices', title: 'Цены билетов', description: 'Цены по слотам и типам', icon: '💶' },
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

export default function CatalogHome() {
  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Каталог</h1>
        <p className="mt-1 text-sm text-gray-500">
          Единая точка входа в справочники. Со временем можно оставить в меню только этот пункт.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {CATALOG_ITEMS.map((item) => (
          <CatalogCard key={item.to} {...item} />
        ))}
      </div>
    </Layout>
  );
}

