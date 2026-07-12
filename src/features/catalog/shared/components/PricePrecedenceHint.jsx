import { Link } from 'react-router-dom';

/**
 * Цена билета резолвится из трёх разных таблиц с приоритетом:
 * TicketPrice (точная цена на слот) > PricingRule (правило по дате/дню) >
 * EventTicketTypePrice (базовая цена). Эта страница редактирует только одну
 * из трёх — здесь нет способа увидеть, какая цена реально победит.
 * См. `BookingSetupPricingPanels.jsx` → `PricePreviewPanel` в Workbench,
 * которая это показывает.
 */
export default function PricePrecedenceHint() {
  return (
    <div className="mb-4 rounded-lg border border-blue-100 bg-blue-50/60 px-3 py-2 text-xs text-gray-700">
      <div className="font-medium text-gray-800">Приоритет цены билета</div>
      <div className="mt-1">
        Цена на слоте (эта таблица, если это «Цены на слотах») побеждает над правилом,
        правило — над базовой ценой. Здесь редактируется только один из трёх уровней —
        итоговую резолвленную цену с указанием источника показывает{' '}
        <Link to="/catalog/booking-setup" className="text-blue-600 hover:underline">
          Workbench
        </Link>
        .
      </div>
    </div>
  );
}
